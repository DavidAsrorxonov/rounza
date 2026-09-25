// Test-only encrypted REST fixture. Authorization and constraints use real SQL tests.
const vaults = new Map(),
  portals = new Map(),
  links = new Map();
const stores = {
  credential_vaults: vaults,
  portal_accounts: portals,
  application_portals: links,
};
export function cascadeVaultApplication(applicationId) {
  for (const [id, row] of links)
    if (row.application_id === applicationId) links.delete(id);
}
function removePortal(id) {
  portals.delete(id);
  for (const [key, link] of links) if (link.portal_id === id) links.delete(key);
}
function removeVault(id) {
  vaults.delete(id);
  for (const record of portals.values())
    if (record.vault_id === id) removePortal(record.id);
}
export async function handleVault(
  request,
  response,
  url,
  account,
  applications,
  json,
) {
  const table = url.pathname.replace("/rest/v1/", "");
  const create = table === "rpc/create_portal_account",
    list = table === "rpc/list_portal_accounts";
  const inspect = url.pathname === "/fixture/vault-state";
  if (!stores[table] && !create && !list && !inspect) return false;
  if (inspect) {
    json(
      response,
      200,
      Object.fromEntries(
        Object.entries(stores).map(([name, store]) => [
          name,
          [...store.values()].filter((row) => row.user_id === account.user.id),
        ]),
      ),
    );
    return true;
  }
  let body = {};
  if (["POST", "PATCH"].includes(request.method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  const reply = (status, data) => {
    json(response, status, data);
    return true;
  };
  const error = (code, message) => reply(400, { code, message });
  const accountOwns = (id) => vaults.get(id)?.user_id === account.user.id;
  const parentOwns = (id) => applications.get(id)?.user_id === account.user.id;
  const result = (rows) =>
    request.headers.accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows;
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !list &&
    account.writeError
  )
    return error("fixture", "Fixture write failed");
  if (create) {
    if (
      !accountOwns(body.p_vault_id) ||
      (body.p_application_id && !parentOwns(body.p_application_id))
    )
      return error("23503", "Wrong parent");
    if (portals.has(body.p_id)) return error("23505", "Already exists");
    portals.set(body.p_id, {
      id: body.p_id,
      user_id: account.user.id,
      vault_id: body.p_vault_id,
      version: 1,
      nonce: body.p_nonce,
      ciphertext: body.p_ciphertext,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (body.p_application_id)
      links.set(`${body.p_application_id}:${body.p_id}`, {
        application_id: body.p_application_id,
        portal_id: body.p_id,
        vault_id: body.p_vault_id,
        user_id: account.user.id,
        created_at: new Date().toISOString(),
      });
    return reply(200, body.p_id);
  }
  if (!list && request.method === "POST") {
    if (body.user_id !== account.user.id) return error("42501", "Wrong owner");
    if (table === "credential_vaults") {
      if ([...vaults.values()].some((row) => row.user_id === account.user.id))
        return error("23505", "Vault exists");
      const row = {
        ...body,
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      vaults.set(row.id, row);
      return reply(201, result([row]));
    }
    if (table === "application_portals") {
      if (
        !parentOwns(body.application_id) ||
        !accountOwns(body.vault_id) ||
        portals.get(body.portal_id)?.vault_id !== body.vault_id ||
        portals.get(body.portal_id)?.user_id !== account.user.id
      )
        return error("23503", "Wrong parent");
      const key = `${body.application_id}:${body.portal_id}`;
      if (links.has(key)) return error("23505", "Already linked");
      links.set(key, { ...body, created_at: new Date().toISOString() });
      return reply(201, null);
    }
    return error("42501", "Use the create RPC");
  }
  if (url.searchParams.get("user_id") !== `eq.${account.user.id}`)
    return error("42501", "Missing ownership filter");
  let rows = [...(list ? portals : stores[table]).values()].filter(
    (row) => row.user_id === account.user.id,
  );
  if (list && body.p_application_id)
    rows = rows.filter((row) =>
      links.has(`${body.p_application_id}:${row.id}`),
    );
  for (const field of [
    "id",
    "vault_id",
    "portal_id",
    "application_id",
    "revision",
  ]) {
    const value = url.searchParams.get(field);
    if (value?.startsWith("eq."))
      rows = rows.filter((row) => String(row[field]) === value.slice(3));
    else if (value?.startsWith("in.(")) {
      const choices = value.slice(4, -1).split(",");
      rows = rows.filter((row) => choices.includes(row[field]));
    }
  }
  if (["PATCH", "DELETE"].includes(request.method)) {
    if (
      table !== "application_portals" &&
      (!url.searchParams.has("id") || !url.searchParams.has("revision"))
    )
      return error("42501", "Missing revision");
    const changed = [];
    for (const row of rows) {
      if (request.method === "DELETE") {
        if (table === "credential_vaults") removeVault(row.id);
        else if (table === "portal_accounts") removePortal(row.id);
        else links.delete(`${row.application_id}:${row.portal_id}`);
        changed.push({ id: row.id });
      } else {
        const next = {
          ...row,
          ...body,
          revision: row.revision + 1,
          updated_at: new Date().toISOString(),
        };
        stores[table].set(row.id, next);
        changed.push(next);
      }
    }
    return reply(200, result(changed));
  }
  const count = rows.length;
  rows.sort((a, b) => {
    for (const part of (url.searchParams.get("order") ?? "").split(",")) {
      const [field, direction] = part.split(".");
      const delta = String(a[field]).localeCompare(String(b[field]));
      if (delta) return direction === "desc" ? -delta : delta;
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 1000);
  if (offset > 0 && offset >= count)
    return reply(416, {
      code: "PGRST103",
      message: "Requested range not satisfiable",
    });
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
    response.end();
    return true;
  }
  return reply(200, result(rows));
}
