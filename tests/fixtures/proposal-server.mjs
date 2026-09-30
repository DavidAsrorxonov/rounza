// HTTP fixture for browser behavior. Security, rollback and atomicity are tested
// against the actual migration in tests/database/proposal-checks.mjs.
import { randomUUID } from "node:crypto";
import { connections, allowedConnection } from "./connection-server.mjs";
import { resumes } from "./resume-server.mjs";
import { stores, addHistory } from "./journey-server.mjs";
const proposals = new Map();
const defaults = {
  application: {
    company: "",
    role: "",
    status: "Saved",
    location: "",
    job_url: null,
    applied_on: null,
    description: "",
    notes: "",
  },
  resume: { name: "", body: "" },
  round: {
    title: "",
    kind: "Interview",
    status: "Planned",
    position: 1,
    scheduled_at: null,
    time_zone: "UTC",
    duration_minutes: 60,
    due_on: null,
    meeting_url: null,
    location: "",
    people: "",
    notes: "",
    schedule_note: "",
  },
  task: {
    title: "",
    round_id: null,
    due_on: null,
    completed: false,
    notes: "",
  },
  contact: { name: "", role: "", email: "", phone: "", notes: "" },
};
export async function handleProposals(
  request,
  response,
  url,
  account,
  applications,
  json,
) {
  if (!url.pathname.includes("ai_proposal")) return false;
  const reply = (status, data) => {
    json(response, status, data);
    return true;
  };
  let body = {};
  if (request.method === "POST") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  const tables = {
    application: applications,
    resume: resumes,
    round: stores.hiring_rounds,
    task: stores.preparation_tasks,
    contact: stores.application_contacts,
  };
  const own = (row) => row?.user_id === account.user.id;
  const allowed = (c, op) => {
    const category = op.entity === "resume" ? "resume" : "application";
    const id = op.application_id ?? op.record_id;
    return (
      c &&
      c.allow_proposals &&
      !c.revoked_at &&
      (c[`${category}_access`] === "all" ||
        (c[`${category}_access`] === "selected" &&
          c[`${category}_ids`].includes(id) &&
          !(
            op.action === "create" &&
            ["application", "resume"].includes(op.entity)
          )))
    );
  };
  if (url.pathname.endsWith("/submit_ai_proposal")) {
    const c = allowedConnection(account),
      p = body.payload;
    if (
      !account.clientId ||
      !c?.allow_proposals ||
      p.changes.some((op) => !allowed(c, op))
    )
      return reply(403, { message: "Proposal permission required" });
    const prior = [...proposals.values()].find(
      (p2) =>
        p2.connection_id === c.id && p2.idempotency_key === p.idempotency_key,
    );
    if (prior)
      return JSON.stringify(prior.request) === JSON.stringify(p)
        ? reply(200, prior.id)
        : reply(400, { message: "Key used" });
    const changes = [];
    for (const op of p.changes) {
      const row = tables[op.entity]?.get(op.record_id);
      if (
        op.action === "update" &&
        (!own(row) || row.revision !== op.expected_revision)
      )
        return reply(409, { message: "Stale" });
      const before =
        op.action === "update"
          ? Object.fromEntries(
              Object.keys(defaults[op.entity]).map((k) => [
                k,
                row[k] ?? defaults[op.entity][k],
              ]),
            )
          : null;
      changes.push({
        ...op,
        before,
        after: { ...(before ?? defaults[op.entity]), ...op.data },
        application_revision: op.application_id
          ? (applications.get(op.application_id)?.revision ?? null)
          : null,
        application_label: op.application_id
          ? `${applications.get(op.application_id)?.company ?? "New application"} — ${applications.get(op.application_id)?.role ?? ""}`
          : null,
      });
    }
    const now = new Date().toISOString();
    const id = randomUUID();
    proposals.set(id, {
      id,
      user_id: account.user.id,
      connection_id: c.id,
      client_name: c.client_name,
      connection_activated_at: c.activated_at,
      oauth_session_id: account.sessionId,
      idempotency_key: p.idempotency_key,
      title: p.title,
      summary: p.summary,
      request: p,
      changes,
      status: "pending",
      revision: 1,
      created_at: now,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      decided_at: null,
      result: [],
    });
    return reply(200, id);
  }
  if (url.pathname.endsWith("/ai_proposal_status")) {
    const p = proposals.get(body.proposal_id),
      c = allowedConnection(account);
    if (
      !c?.allow_proposals ||
      !own(p) ||
      p.connection_id !== c.id ||
      p.connection_activated_at !== c.activated_at
    )
      return reply(403, { message: "Unavailable" });
    return reply(200, {
      id: p.id,
      status: p.status,
      created_at: p.created_at,
      expires_at: p.expires_at,
      decided_at: p.decided_at,
    });
  }
  if (account.clientId)
    return reply(403, { message: "Website session required" });
  if (url.pathname.endsWith("/decide_ai_proposal")) {
    const p = proposals.get(body.proposal_id);
    if (!own(p)) return reply(403, { message: "Unavailable" });
    const target = body.decision === "approve" ? "approved" : "rejected";
    if (p.status === target) return reply(200, p.result);
    if (p.status !== "pending" || p.revision !== body.expected_revision)
      return reply(409, { message: "Already decided" });
    if (target === "approved") {
      const c = connections.get(p.connection_id);
      if (
        !c ||
        c.activated_at !== p.connection_activated_at ||
        new Date(p.expires_at) <= new Date() ||
        p.changes.some((op) => !allowed(c, op))
      )
        return reply(409, { message: "Permissions changed" });
      for (const op of p.changes) {
        const row = tables[op.entity].get(op.record_id);
        if (
          (op.action === "update" &&
            (!own(row) || row.revision !== op.expected_revision)) ||
          (op.action === "create" && row) ||
          (op.application_revision !== null &&
            applications.get(op.application_id)?.revision !==
              op.application_revision)
        )
          return reply(409, { message: "Stale" });
      }
      for (const op of p.changes) {
        const previous = tables[op.entity].get(op.record_id);
        const row = {
          ...previous,
          ...op.after,
          id: op.record_id,
          user_id: p.user_id,
          application_id: op.application_id,
          revision: (previous?.revision ?? 0) + 1,
          created_at: previous?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (op.entity === "resume") {
          row.source = previous?.source ?? "paste";
          row.character_count = row.body.length;
        }
        tables[op.entity].set(row.id, row);
        if (op.entity === "round") addHistory(row, previous);
        if (op.application_id) {
          const app = applications.get(op.application_id);
          app.revision++;
          app.updated_at = row.updated_at;
        }
      }
      p.result = p.changes.map((op) => ({
        entity: op.entity,
        record_id: op.record_id,
        application_id: op.application_id ?? null,
        revision: tables[op.entity].get(op.record_id).revision,
      }));
    }
    p.status = target;
    p.revision++;
    p.decided_at = new Date().toISOString();
    return reply(200, p.result);
  }
  if (
    request.method !== "GET" ||
    url.searchParams.get("user_id") !== `eq.${account.user.id}`
  )
    return reply(403, { message: "Missing ownership" });
  let rows = [...proposals.values()].filter(own);
  for (const key of ["id", "status"]) {
    const v = url.searchParams.get(key);
    if (v?.startsWith("eq.")) rows = rows.filter((r) => r[key] === v.slice(3));
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
  const select = url.searchParams.get("select");
  if (select && select !== "*")
    rows = rows.map((r) =>
      Object.fromEntries(select.split(",").map((k) => [k, r[k]])),
    );
  return reply(
    200,
    request.headers.accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows,
  );
}
