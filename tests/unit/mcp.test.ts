import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST, GET } from "../../src/app/mcp/route";
import { GET as metadata } from "../../src/app/.well-known/oauth-protected-resource/mcp/route";
import {
  authorizationId,
  consentDestination,
  consentReturnDestination,
  permissionsInput,
} from "../../src/features/connections/model";

test("MCP uses signed delegated tokens, live grants, discovery and bounded read-only tools", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "protocol-test",
    alg: "RS256",
    use: "sig",
  };
  const user = "11111111-1111-4111-8111-111111111111",
    clientId = "22222222-2222-4222-8222-222222222222",
    sessionId = "33333333-3333-4333-8333-333333333333";
  let grant = true,
    origin = "";
  const reads: { path: string; search: URLSearchParams; method: string }[] = [];
  const http = createServer(async (req, res) => {
    const url = new URL(req.url!, origin);
    if (url.pathname === "/mcp") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const response = req.method === "POST" ? await POST(request) : GET();
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === "/rest/v1/rpc/ai_connection_status") {
      res.end(JSON.stringify(grant));
      return;
    }
    reads.push({
      path: url.pathname,
      search: url.searchParams,
      method: req.method!,
    });
    const row = {
      id: sessionId,
      application_id: sessionId,
      name: "Reviewed resume",
      company: "Example",
      role: "Engineer",
      revision: 3,
      body: "User-reviewed experience",
    };
    const data = req.headers.accept?.includes("vnd.pgrst.object") ? row : [row];
    res.setHeader("Content-Range", "0-0/1");
    res.end(JSON.stringify(data));
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  origin = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  const old = { ...process.env };
  Object.assign(process.env, {
    SITE_URL: origin,
    SUPABASE_URL: origin,
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_protocol_test",
    MCP_ENABLED: "true",
  });
  const mint = (overrides: Record<string, unknown> = {}) =>
    new SignJWT({
      sub: user,
      client_id: clientId,
      session_id: sessionId,
      role: "authenticated",
      is_anonymous: false,
      iss: `${origin}/auth/v1`,
      aud: `${origin}/mcp`,
      exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "protocol-test" })
      .sign(privateKey);
  const client = new Client({ name: "rounza-test", version: "1" });
  try {
    const document = await metadata().json();
    assert.equal(document.resource, `${origin}/mcp`);
    assert.deepEqual(document.authorization_servers, [`${origin}/auth/v1`]);
    const unauth = await POST(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: { cookie: "fake-session=1" },
      }),
    );
    assert.equal(unauth.status, 401);
    assert.match(unauth.headers.get("www-authenticate")!, /resource_metadata/);
    for (const overrides of [
      { aud: "authenticated" },
      { iss: "https://wrong.example/auth/v1" },
      { exp: 1 },
      { exp: undefined },
      { client_id: undefined },
      { session_id: "invalid" },
      { role: "service_role" },
      { is_anonymous: true },
    ]) {
      const token = await mint(overrides);
      const response = await POST(
        new Request(`${origin}/mcp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      assert.equal(response.status, 401, JSON.stringify(overrides));
    }
    const valid = await mint();
    const tampered = valid.split(".");
    tampered[1] = Buffer.from(JSON.stringify({ sub: user })).toString(
      "base64url",
    );
    assert.equal(
      (
        await POST(
          new Request(`${origin}/mcp`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tampered.join(".")}` },
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await POST(
          new Request(`${origin}/mcp`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${valid}`,
              Origin: "https://evil.example",
            },
          }),
        )
      ).status,
      403,
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${valid}` } },
      }),
    );
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 6);
    assert.ok(tools.tools.every((t) => t.annotations?.readOnlyHint === true));
    for (const [name, args] of [
      ["search_applications", { query: "Example", page: 2, limit: 5 }],
      ["get_application", { id: sessionId }],
      ["list_journey_records", { application_id: sessionId, kind: "contacts" }],
      ["get_next_actions", { time_zone: "Asia/Tokyo" }],
      ["list_resumes", {}],
      ["get_resume", { id: sessionId }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, name);
      assert.ok(result.structuredContent, name);
    }
    assert.ok(reads.every((r) => r.search.get("user_id") === `eq.${user}`));
    assert.ok(
      reads.every(
        (r) => !r.path.includes("vault") && !r.path.includes("portal"),
      ),
    );
    assert.equal(reads[0].search.get("offset"), "5");
    assert.equal(reads[0].search.get("limit"), "5");
    const before = reads.length;
    assert.equal(
      (
        await client.callTool({
          name: "list_resumes",
          arguments: { limit: 5000 },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await client.callTool({
          name: "get_next_actions",
          arguments: { time_zone: "bad/zone" },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await client.callTool({
          name: "delete_application",
          arguments: { id: sessionId },
        })
      ).isError,
      true,
    );
    assert.equal(reads.length, before);
    const oversized = await POST(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${valid}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: " ".repeat(65537),
      }),
    );
    assert.equal(oversized.status, 413);
    grant = false;
    const revoked = await POST(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${valid}` },
      }),
    );
    assert.equal(revoked.status, 401);
    assert.match(revoked.headers.get("cache-control")!, /no-store/);
    process.env.MCP_ENABLED = "false";
    assert.equal(metadata().status, 503);
  } finally {
    await client.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
    for (const key of [
      "SITE_URL",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "MCP_ENABLED",
    ]) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});
test("consent return destinations and permission inputs are strictly bounded", () => {
  assert.equal(consentDestination("https://evil.example"), null);
  assert.equal(consentDestination("//evil.example"), null);
  // Supabase's public authorization ID is an opaque string, not its row UUID.
  const id = "abcdefghijklmnopqrstuvwxyz234567";
  assert.equal(authorizationId.safeParse(id).success, true);
  assert.equal(consentDestination(id), `/auth/consent?authorization_id=${id}`);
  const destination = `/auth/consent?authorization_id=${id}`;
  assert.equal(consentReturnDestination(destination), destination);
  for (const invalid of [
    undefined,
    `https://evil.example${destination}`,
    `//evil.example${destination}`,
    `/app?authorization_id=${id}`,
    `${destination}&next=https://evil.example`,
    `${destination}#fragment`,
    `${destination}\n`,
  ]) {
    assert.equal(consentReturnDestination(invalid), null);
  }
  for (const invalid of [
    undefined,
    "",
    "11111111-1111-4111-8111-111111111111",
    id.slice(1),
    `${id}a`,
    `${id}&next=https://evil.example`,
    `${id}#fragment`,
    `../${id}`,
    `%2F${id}`,
    `${id}\n`,
    [id, id],
  ]) {
    assert.equal(consentDestination(invalid), null);
    assert.equal(
      consentReturnDestination(`/auth/consent?authorization_id=${invalid}`),
      null,
    );
  }
  assert.equal(
    permissionsInput.safeParse({
      application_access: "all",
      application_ids: [],
      resume_access: "write",
      resume_ids: [],
    }).success,
    false,
  );
});
