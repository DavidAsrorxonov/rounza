import { randomBytes, randomUUID } from "node:crypto";
export const connections = new Map();
const authorizations = new Map();
export function allowedConnection(account) {
  const c = [...connections.values()].find(
    (c) => c.user_id === account.user.id && c.client_id === account.clientId,
  );
  return c &&
    !c.revoked_at &&
    account.createdAt >= new Date(c.activated_at).getTime()
    ? c
    : null;
}
export function allowedRecord(account, kind, id) {
  if (!account.clientId) return true;
  const c = allowedConnection(account);
  return Boolean(
    c &&
    (c[`${kind}_access`] === "all" ||
      (c[`${kind}_access`] === "selected" && c[`${kind}_ids`].includes(id))),
  );
}
export async function handleConnections(
  request,
  response,
  url,
  account,
  json,
  revokeSessions,
) {
  if (
    ![
      "/fixture/authorization",
      "/rest/v1/ai_connections",
      "/rest/v1/rpc/ai_connection_status",
    ].includes(url.pathname) &&
    !url.pathname.startsWith("/auth/v1/oauth/") &&
    !url.pathname.startsWith("/auth/v1/user/oauth/grants")
  )
    return false;
  const reply = (status, data) => {
    json(response, status, data);
    return true;
  };
  let body = {};
  if (["POST", "PATCH"].includes(request.method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  }
  if (url.pathname === "/rest/v1/rpc/ai_connection_status")
    return reply(200, Boolean(allowedConnection(account)));
  if (account.clientId)
    return reply(403, { message: "Browser session required" });
  if (url.pathname === "/fixture/authorization") {
    // Match Supabase Auth's SecureAlphanumeric(32): lowercase base32, no padding.
    const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
    const id = Array.from(randomBytes(32), (byte) => alphabet[byte & 31]).join(
        "",
      ),
      clientId = url.searchParams.get("client_id") ?? randomUUID();
    authorizations.set(id, {
      authorization_id: id,
      user: { id: account.user.id, email: account.user.email },
      client: {
        id: clientId,
        name: url.searchParams.get("name") ?? "Fixture assistant",
        uri: "https://assistant.example",
        logo_uri: "",
      },
      scope: "openid",
      redirect_uri: "http://127.0.0.1:54329/fixture/connected",
      expired: url.searchParams.has("expired"),
      providerError: url.searchParams.has("providerError"),
    });
    return reply(200, { id, clientId });
  }
  if (url.pathname.startsWith("/auth/v1/oauth/authorizations/")) {
    const id = url.pathname.split("/")[5];
    const auth = authorizations.get(id);
    if (!auth || auth.user.id !== account.user.id || auth.expired)
      return reply(400, {
        msg: "Authorization expired",
        code: "validation_failed",
      });
    if (request.method === "POST") {
      auth.expired = true;
      if (auth.providerError)
        return reply(503, { msg: "Provider unavailable" });
      return reply(200, {
        redirect_url: `${auth.redirect_uri}?result=${body.action}&client_id=${auth.client.id}`,
      });
    }
    return reply(200, auth);
  }
  if (url.pathname.startsWith("/auth/v1/user/oauth/grants")) {
    const clientId = url.searchParams.get("client_id");
    revokeSessions(account.user.id, clientId);
    return reply(200, {});
  }
  const own = () =>
    [...connections.values()].filter((c) => c.user_id === account.user.id);
  const shape = (rows) => {
    const select = url.searchParams.get("select");
    if (select && select !== "*")
      rows = rows.map((row) =>
        Object.fromEntries(select.split(",").map((k) => [k, row[k]])),
      );
    return request.headers.accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows;
  };
  if (request.method === "POST") {
    if (body.user_id !== account.user.id || account.writeError)
      return reply(403, { message: "Write denied" });
    const old = own().find((c) => c.client_id === body.client_id);
    const now = new Date().toISOString();
    const row = {
      id: old?.id ?? randomUUID(),
      application_access: "selected",
      application_ids: [],
      allow_proposals: false,
      resume_access: "none",
      resume_ids: [],
      created_at: old?.created_at ?? now,
      ...old,
      ...body,
      revision: (old?.revision ?? 0) + 1,
      activated_at: !old || old.revoked_at ? now : old.activated_at,
      updated_at: now,
    };
    connections.set(row.id, row);
    return reply(201, shape([row]));
  }
  if (url.searchParams.get("user_id") !== `eq.${account.user.id}`)
    return reply(403, { message: "Missing ownership" });
  let rows = own();
  for (const field of ["id", "revision"]) {
    const filter = url.searchParams.get(field);
    if (filter?.startsWith("eq."))
      rows = rows.filter((c) => String(c[field]) === filter.slice(3));
  }
  if (url.searchParams.get("revoked_at") === "is.null")
    rows = rows.filter((c) => !c.revoked_at);
  if (request.method === "PATCH") {
    for (const row of rows)
      connections.set(row.id, {
        ...row,
        ...body,
        revision: row.revision + 1,
        updated_at: new Date().toISOString(),
      });
    return reply(200, shape(rows.map((r) => ({ ...r, ...body }))));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count = rows.length,
    offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 1000);
  rows = rows.slice(offset, offset + limit);
  response.setHeader(
    "Content-Range",
    count ? `${offset}-${offset + rows.length - 1}/${count}` : "*/0",
  );
  return reply(200, shape(rows));
}
