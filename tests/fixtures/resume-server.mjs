import { randomUUID } from "node:crypto";
import { allowedRecord } from "./connection-server.mjs";
export const resumes = new Map();
export async function handleResumes(request, response, url, account, json) {
  const fixture = url.pathname === "/fixture/resumes";
  if (!fixture && url.pathname !== "/rest/v1/resumes") return false;
  const reply = (status, data) => {
    json(response, status, data);
    return true;
  };
  let body;
  if (["POST", "PATCH"].includes(request.method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  const own = () =>
    [...resumes.values()].filter(
      (row) =>
        row.user_id === account.user.id &&
        allowedRecord(account, "resume", row.id),
    );
  if (fixture && request.method === "GET") return reply(200, own());
  const create = (values) => {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      name: "Sample resume",
      body: "Sample experience",
      source: "paste",
      ...values,
      user_id: account.user.id,
      revision: 1,
      created_at: now,
      updated_at: now,
      character_count: [...(values.body ?? "Sample experience")].length,
    };
  };
  if (fixture && request.method === "POST") {
    for (const value of body) {
      const row = create(value);
      resumes.set(row.id, row);
    }
    return reply(201, {});
  }
  const result = (rows) =>
    request.headers.accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows;
  if (
    ["POST", "PATCH", "DELETE"].includes(request.method) &&
    account.writeError
  )
    return reply(503, { message: "Fixture write failed" });
  if (request.method === "POST") {
    if (body.user_id !== account.user.id)
      return reply(403, { message: "Wrong owner" });
    if (resumes.has(body.id)) return reply(409, { code: "23505" });
    const row = create(body);
    resumes.set(row.id, row);
    return reply(201, result([{ id: row.id }]));
  }
  if (url.searchParams.get("user_id") !== `eq.${account.user.id}`)
    return reply(403, { message: "Missing ownership filter" });
  let rows = own();
  const pattern = url.searchParams.get("name");
  if (pattern?.startsWith("ilike.%")) {
    const q = pattern
      .slice(7, -1)
      .replace(/\\([\\%_])/g, "$1")
      .toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  for (const field of ["id", "revision"]) {
    const filter = url.searchParams.get(field);
    if (filter?.startsWith("eq."))
      rows = rows.filter((row) => String(row[field]) === filter.slice(3));
  }
  if (["PATCH", "DELETE"].includes(request.method)) {
    if (!url.searchParams.has("id") || !url.searchParams.has("revision"))
      return reply(403, { message: "Missing identity" });
    for (const row of rows) {
      if (request.method === "DELETE") resumes.delete(row.id);
      else
        resumes.set(row.id, {
          ...row,
          ...body,
          revision: row.revision + 1,
          updated_at: new Date().toISOString(),
          character_count: [...(body.body ?? row.body)].length,
        });
    }
    return reply(200, result(rows.map((row) => ({ id: row.id }))));
  }
  rows.sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id),
  );
  const count = rows.length,
    offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 1000);
  if (offset > 0 && offset >= count) return reply(416, { code: "PGRST103" });
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
  return reply(200, result(rows));
}
