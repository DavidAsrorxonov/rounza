import { handleVault, cascadeVaultApplication } from "./vault-server.mjs";
// Loopback-only OAuth/Auth/PostgREST protocol fixture; never loaded by the app.
// It tests the real Supabase SDK's PKCE/cookies/refresh against deterministic HTTP.
// Database authorization is tested separately against actual Postgres.
import { handleJourney, cascadeJourney } from "./journey-server.mjs";
import { createServer } from "node:http";
import { createHash, createHmac, randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:54329";
const applications = new Map();
const codes = new Map();
const refreshTokens = new Map();
const sessions = new Map();
const secret = "local-auth-fixture-only-never-a-production-secret";
const users = {
  alice: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "alice@example.com",
    user_metadata: { full_name: "Alice Example" },
  },
  bob: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "bob@example.com",
    user_metadata: { full_name: "Bob Example" },
  },
};
function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
function session(user, options = {}) {
  const sessionId = options.sessionId ?? randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    exp: now + (options.expired ? -60 : 3600),
    iat: now - 120,
    iss: `${origin}/auth/v1`,
    session_id: sessionId,
  };
  const parts = [{ alg: "HS256", typ: "JWT" }, payload].map((part) =>
    Buffer.from(JSON.stringify(part)).toString("base64url"),
  );
  const data = parts.join(".");
  const accessToken = `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  const refreshToken = randomUUID();
  refreshTokens.set(refreshToken, { user, sessionId });
  sessions.set(sessionId, {
    user,
    databaseError: options.databaseError ?? false,
    writeError: options.writeError ?? false,
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: options.expired ? -60 : 3600,
    expires_at: payload.exp,
    user: {
      ...user,
      aud: "authenticated",
      role: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "google", providers: ["google"] },
      is_anonymous: false,
    },
  };
}
function identity(request) {
  try {
    const token = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const [header, data, signature] = token.split(".");
    if (
      createHmac("sha256", secret)
        .update(`${header}.${data}`)
        .digest("base64url") !== signature
    )
      return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    const stored = sessions.get(payload.session_id);
    if (!stored || payload.exp <= Date.now() / 1000) return null;
    return { ...stored, sessionId: payload.session_id };
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname === "/health") return json(response, 200, { ready: true });
  if (url.pathname === "/auth/v1/authorize") {
    if (
      url.searchParams.get("provider") !== "google" ||
      url.searchParams.get("code_challenge_method") !== "s256"
    )
      return json(response, 400, { error: "Invalid PKCE request" });
    const callback = new URL(url.searchParams.get("redirect_to"));
    if (callback.href !== "http://127.0.0.1:3102/auth/callback")
      return json(response, 400, { error: "Unexpected callback" });
    const code = randomUUID();
    codes.set(code, {
      challenge: url.searchParams.get("code_challenge"),
      user: users.alice,
    });
    callback.searchParams.set("code", code);
    response.writeHead(302, { Location: callback.href });
    return response.end();
  }
  if (url.pathname === "/auth/v1/token") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (url.searchParams.get("grant_type") === "pkce") {
      const code = codes.get(body.auth_code);
      codes.delete(body.auth_code);
      if (
        !code ||
        createHash("sha256")
          .update(body.code_verifier ?? "")
          .digest("base64url") !== code.challenge
      )
        return json(response, 400, {
          msg: "Invalid code verifier",
          code: "bad_code_verifier",
        });
      return json(response, 200, session(code.user));
    }
    const old = refreshTokens.get(body.refresh_token);
    refreshTokens.delete(body.refresh_token);
    if (!old || !sessions.has(old.sessionId))
      return json(response, 400, {
        msg: "Invalid refresh token",
        code: "refresh_token_not_found",
      });
    return json(response, 200, session(old.user, { sessionId: old.sessionId }));
  }
  // Test-only seeding: no production application endpoints or bypass switches.
  if (url.pathname === "/fixture/session") {
    const key = url.searchParams.get("user") ?? "alice";
    if (key === "fresh") {
      const id = randomUUID();
      users[id] = {
        id,
        email: `tracker-${id}@example.com`,
        user_metadata: { full_name: "Tracker Example" },
      };
      return json(
        response,
        200,
        session(users[id], { writeError: url.searchParams.has("writeError") }),
      );
    }
    const user = users[key];
    if (!user) return json(response, 400, {});
    return json(
      response,
      200,
      session(user, {
        writeError: url.searchParams.has("writeError"),
        expired: url.searchParams.has("expired"),
        databaseError: url.searchParams.has("databaseError"),
      }),
    );
  }
  const account = identity(request);
  if (!account)
    return json(response, 401, { msg: "Invalid session", code: "bad_jwt" });
  if (url.pathname === "/auth/v1/user")
    return json(response, 200, { ...account.user, is_anonymous: false });
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(account.sessionId);
    response.writeHead(204);
    return response.end();
  }
  if (account.databaseError)
    return json(response, 503, { message: "Fixture database unavailable" });
  if (await handleVault(request, response, url, account, applications, json))
    return;
  if (await handleJourney(request, response, url, account, applications, json))
    return;
  if (url.pathname === "/rest/v1/profiles") {
    if (url.searchParams.get("id") !== `eq.${account.user.id}`)
      return json(response, 403, { message: "Missing ownership filter" });
    return json(response, 200, {
      display_name: account.user.user_metadata.full_name,
      created_at: "2026-01-01T00:00:00Z",
    });
  }
  if (url.pathname === "/fixture/applications" && request.method === "POST") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rows = JSON.parse(Buffer.concat(chunks).toString());
    for (const row of rows) {
      const id = row.id ?? randomUUID();
      applications.set(id, {
        id,
        company: "Example",
        role: "Designer",
        status: "Saved",
        location: "",
        job_url: null,
        description: "",
        notes: "",
        applied_on: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revision: 1,
        ...row,
        user_id: account.user.id,
      });
    }
    return json(response, 200, { seeded: rows.length });
  }
  if (
    url.pathname === "/rest/v1/applications" ||
    url.pathname === "/rest/v1/rpc/search_applications"
  ) {
    const rpc = url.pathname.includes("/rpc/");
    let body = {};
    if (["POST", "PATCH"].includes(request.method)) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
    if (!rpc && request.method === "POST") {
      if (account.writeError)
        return json(response, 503, { message: "Fixture write failed" });
      if (body.user_id !== account.user.id)
        return json(response, 403, { message: "Wrong owner" });
      const row = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revision: 1,
        ...body,
      };
      applications.set(row.id, row);
      return json(
        response,
        201,
        request.headers.accept?.includes("vnd.pgrst.object")
          ? { id: row.id }
          : [{ id: row.id }],
      );
    }
    if (url.searchParams.get("user_id") !== `eq.${account.user.id}`)
      return json(response, 403, { message: "Missing ownership filter" });
    let rows = [...applications.values()].filter(
      (row) => row.user_id === account.user.id,
    );
    for (const field of ["id", "status", "revision"]) {
      const value = url.searchParams.get(field);
      if (value?.startsWith("eq."))
        rows = rows.filter((row) => String(row[field]) === value.slice(3));
    }
    if (["PATCH", "DELETE"].includes(request.method)) {
      if (account.writeError)
        return json(response, 503, { message: "Fixture write failed" });
      if (!url.searchParams.has("id") || !url.searchParams.has("revision"))
        return json(response, 400, {
          message: "Missing record/version filter",
        });
      for (const row of rows) {
        if (request.method === "DELETE") {
          applications.delete(row.id);
          cascadeJourney(row.id);
          cascadeVaultApplication(row.id);
        } else
          applications.set(row.id, {
            ...row,
            ...body,
            revision: row.revision + 1,
            updated_at: new Date().toISOString(),
          });
      }
      return json(response, 200, rows.length ? { id: rows[0].id } : null);
    }
    if (rpc)
      rows = rows.filter(
        (row) =>
          (!body.status_filter || row.status === body.status_filter) &&
          `${row.company} ${row.role} ${row.location}`
            .toLowerCase()
            .includes((body.search_term ?? "").toLowerCase()),
      );
    const count = rows.length;
    const order = (url.searchParams.get("order") ?? "").split(",");
    rows.sort((a, b) => {
      for (const part of order) {
        const [field, direction] = part.split(".");
        const compare = String(a[field]).localeCompare(String(b[field]));
        if (compare) return direction === "desc" ? -compare : compare;
      }
      return 0;
    });
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    rows = rows.slice(offset, offset + limit);
    const select = url.searchParams.get("select");
    if (select && select !== "*")
      rows = rows.map((row) =>
        Object.fromEntries(select.split(",").map((key) => [key, row[key]])),
      );
    response.setHeader(
      "Content-Range",
      count ? `${offset}-${offset + rows.length - 1}/${count}` : "*/0",
    );
    if (request.method === "HEAD") {
      response.writeHead(200);
      return response.end();
    }
    return json(
      response,
      200,
      request.headers.accept?.includes("vnd.pgrst.object")
        ? (rows[0] ?? null)
        : rows,
    );
  }
  json(response, 404, { message: "Unknown fixture endpoint" });
}).listen(54329, "127.0.0.1", () =>
  console.log("Local auth fixture ready on 54329"),
);
