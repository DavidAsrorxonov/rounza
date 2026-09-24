// HTTP protocol fixture only. Real SQL/RLS/history assertions live in tests/database.
import { randomUUID } from "node:crypto";
const stores = Object.fromEntries(
  [
    "hiring_rounds",
    "preparation_tasks",
    "application_contacts",
    "round_schedule_history",
  ].map((name) => [name, new Map()]),
);
function addHistory(row, previous) {
  const keys = [
    "scheduled_at",
    "due_on",
    "time_zone",
    "status",
    "duration_minutes",
  ];
  if (previous && keys.every((key) => row[key] === previous[key])) return;
  const id = randomUUID();
  stores.round_schedule_history.set(id, {
    id,
    user_id: row.user_id,
    application_id: row.application_id,
    round_id: row.id,
    previous_at: previous?.scheduled_at ?? null,
    scheduled_at: row.scheduled_at,
    previous_due_on: previous?.due_on ?? null,
    due_on: row.due_on,
    previous_time_zone: previous?.time_zone ?? null,
    time_zone: row.time_zone,
    previous_status: previous?.status ?? null,
    status: row.status,
    previous_duration_minutes: previous?.duration_minutes ?? null,
    duration_minutes: row.duration_minutes,
    note: row.schedule_note,
    created_at: new Date().toISOString(),
  });
}
export function cascadeJourney(applicationId) {
  for (const store of Object.values(stores))
    for (const [id, row] of store)
      if (row.application_id === applicationId) store.delete(id);
}
function touch(applications, id) {
  const row = applications.get(id);
  if (row) {
    row.revision += 1;
    row.updated_at = new Date().toISOString();
  }
}
function removeRound(roundId) {
  for (const [id, row] of stores.round_schedule_history)
    if (row.round_id === roundId) stores.round_schedule_history.delete(id);
  for (const row of stores.preparation_tasks.values())
    if (row.round_id === roundId) {
      row.round_id = null;
      row.revision += 1;
    }
}
function listActions(applications, userId, clock) {
  const result = [];
  const add = (row, source, due_at, due_on) => {
    const app = applications.get(row.application_id);
    if (
      !app ||
      app.user_id !== userId ||
      row.user_id !== userId ||
      !["Saved", "Applied", "Interviewing"].includes(app.status)
    )
      return;
    const bucket =
      (due_at && due_at < clock.at_time) || (due_on && due_on < clock.today)
        ? 0
        : (due_at && due_at < clock.day_end) || due_on === clock.today
          ? 1
          : due_at || due_on
            ? 2
            : 3;
    result.push({
      id: `${source}:${row.id}`,
      user_id: row.user_id,
      application_id: row.application_id,
      record_id: row.id,
      source,
      company: app.company,
      role: app.role,
      title: row.title,
      due_at,
      due_on,
      time_zone: row.time_zone ?? "UTC",
      bucket,
      sort_at: due_at ?? (due_on ? `${due_on}T00:00:00Z` : "infinity"),
    });
  };
  for (const row of stores.preparation_tasks.values())
    if (!row.completed) add(row, "task", null, row.due_on);
  for (const row of stores.hiring_rounds.values()) {
    if (row.status === "Scheduled") add(row, "meeting", row.scheduled_at, null);
    if (["Planned", "Scheduled"].includes(row.status) && row.due_on)
      add(row, "deadline", null, row.due_on);
    if (row.status === "Planned" && !row.due_on) add(row, "round", null, null);
  }
  return result;
}
export async function handleJourney(
  request,
  response,
  url,
  account,
  applications,
  json,
) {
  const table = url.pathname.replace("/rest/v1/", "");
  const rpc = table === "rpc/next_actions";
  const fixture = url.pathname === "/fixture/journey";
  if (!stores[table] && !rpc && !fixture) return false;
  let body = {};
  if (["POST", "PATCH"].includes(request.method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  if (fixture) {
    if (!stores[body.table] || body.table === "round_schedule_history") {
      json(response, 400, {});
      return true;
    }
    for (const item of body.rows) {
      if (applications.get(item.application_id)?.user_id !== account.user.id) {
        json(response, 403, {});
        return true;
      }
      const row = {
        id: randomUUID(),
        title: "Example task",
        name: "Example contact",
        role: "",
        email: "",
        phone: "",
        notes: "",
        kind: "Interview",
        status: "Planned",
        position: 1,
        scheduled_at: null,
        time_zone: "UTC",
        duration_minutes: 60,
        due_on: null,
        round_id: null,
        completed: false,
        meeting_url: null,
        location: "",
        people: "",
        schedule_note: "",
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
        user_id: account.user.id,
      };
      stores[body.table].set(row.id, row);
      if (body.table === "hiring_rounds") addHistory(row);
    }
    json(response, 200, { seeded: body.rows.length });
    return true;
  }
  if (!rpc && request.method === "POST") {
    if (account.writeError) {
      json(response, 503, {});
      return true;
    }
    const parent = applications.get(body.application_id);
    const round = body.round_id
      ? stores.hiring_rounds.get(body.round_id)
      : null;
    if (
      table === "round_schedule_history" ||
      body.user_id !== account.user.id ||
      parent?.user_id !== account.user.id ||
      (body.round_id &&
        (!round ||
          round.application_id !== body.application_id ||
          round.user_id !== account.user.id))
    ) {
      json(response, 403, {});
      return true;
    }
    const row = {
      id: randomUUID(),
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    stores[table].set(row.id, row);
    if (table === "hiring_rounds") addHistory(row);
    touch(applications, row.application_id);
    json(
      response,
      201,
      request.headers.accept?.includes("vnd.pgrst.object")
        ? { id: row.id }
        : [{ id: row.id }],
    );
    return true;
  }
  if (url.searchParams.get("user_id") !== `eq.${account.user.id}`) {
    json(response, 403, { message: "Missing ownership filter" });
    return true;
  }
  let rows = rpc
    ? listActions(applications, account.user.id, body)
    : [...stores[table].values()].filter(
        (row) => row.user_id === account.user.id,
      );
  for (const key of [
    "id",
    "application_id",
    "round_id",
    "revision",
    "bucket",
  ]) {
    const value = url.searchParams.get(key);
    if (value?.startsWith("eq."))
      rows = rows.filter((row) => String(row[key]) === value.slice(3));
  }
  if (["PATCH", "DELETE"].includes(request.method)) {
    if (account.writeError) {
      json(response, 503, {});
      return true;
    }
    if (
      table === "round_schedule_history" ||
      !url.searchParams.has("id") ||
      !url.searchParams.has("revision") ||
      !url.searchParams.has("application_id")
    ) {
      json(response, 403, {});
      return true;
    }
    for (const row of rows) {
      if (request.method === "DELETE") {
        stores[table].delete(row.id);
        if (table === "hiring_rounds") removeRound(row.id);
      } else {
        const next = {
          ...row,
          ...body,
          revision: row.revision + 1,
          updated_at: new Date().toISOString(),
        };
        stores[table].set(row.id, next);
        if (table === "hiring_rounds") addHistory(next, row);
      }
      touch(applications, row.application_id);
    }
    json(response, 200, rows.length ? { id: rows[0].id } : null);
    return true;
  }
  const count = rows.length;
  rows.sort((a, b) => {
    for (const part of (url.searchParams.get("order") ?? "").split(",")) {
      const [key, direction, nulls] = part.split(".");
      const av = a[key],
        bv = b[key];
      if (av == null && bv != null) return nulls === "nullsfirst" ? -1 : 1;
      if (bv == null && av != null) return nulls === "nullsfirst" ? 1 : -1;
      const delta =
        typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      if (delta) return direction === "desc" ? -delta : delta;
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 1000);
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
  json(
    response,
    200,
    request.headers.accept?.includes("vnd.pgrst.object")
      ? (rows[0] ?? null)
      : rows,
  );
  return true;
}
