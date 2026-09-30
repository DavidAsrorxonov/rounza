import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function proposalChecks(t, db, as, alice, bob) {
  const client = randomUUID(),
    session = randomUUID(),
    app = randomUUID(),
    resume = randomUUID(),
    hidden = randomUUID();
  const createdApps = [app, hidden],
    createdResumes = [resume];
  const browser = () => as("authenticated", alice);
  const agent = async () => {
    await browser();
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: alice,
        client_id: client,
        session_id: session,
        aud: "https://rounza.app/mcp",
        role: "authenticated",
        is_anonymous: false,
      }),
    ]);
  };
  const read = async (table, id) =>
    (await db.query(`select * from public.${table} where id=$1`, [id])).rows[0];
  const payload = (changes) => ({
    idempotency_key: randomUUID(),
    title: "Review fixture",
    summary: "User requested these changes",
    changes,
  });
  const create = (entity, data, extra = {}) => ({
    entity,
    action: "create",
    record_id: randomUUID(),
    expected_revision: null,
    data,
    ...extra,
  });
  const update = (entity, id, revision, data, extra = {}) => ({
    entity,
    action: "update",
    record_id: id,
    expected_revision: revision,
    data,
    ...extra,
  });
  const submit = async (p) =>
    (
      await db.query("select public.submit_ai_proposal($1::jsonb) as id", [
        JSON.stringify(p),
      ])
    ).rows[0].id;
  const decide = async (id, decision = "approve", revision = 1) =>
    (
      await db.query("select public.decide_ai_proposal($1,$2,$3) as result", [
        id,
        revision,
        decision,
      ])
    ).rows[0].result;
  await browser();
  await db.query(
    "insert into public.applications(id,company,role) values ($1,'Original','Engineer'),($2,'Unshared','Engineer')",
    [app, hidden],
  );
  await db.query(
    "insert into public.resumes(id,name,body,source) values ($1,'Resume','Original reviewed text','paste')",
    [resume],
  );
  const connection = (
    await db.query(
      "insert into public.ai_connections(client_id,client_name,application_ids,resume_access,resume_ids) values ($1,'Proposal assistant',$2,'selected',$3) returning *",
      [client, [app], [resume]],
    )
  ).rows[0];
  await db.query("reset role");
  await db.query(
    "insert into rounza_private.mcp_settings(resource) values ('https://rounza.app/mcp') on conflict(singleton) do nothing",
  );
  await db.query(
    "insert into auth.sessions(id,user_id,oauth_client_id) values ($1,$2,$3)",
    [session, alice, client],
  );
  try {
    await t.test(
      "proposal access is off by default; only delegated submit and browser decisions are allowed",
      async () => {
        assert.equal(connection.allow_proposals, false);
        const p = payload([
          update("application", app, 1, { notes: "Suggested" }),
        ]);
        await agent();
        await assert.rejects(submit(p), { code: "42501" });
        await assert.rejects(decide(randomUUID()), { code: "42501" });
        await assert.rejects(
          db.query("select rounza_private.proposal_defaults('application')"),
          { code: "42501" },
        );
        await browser();
        await assert.rejects(submit(p), { code: "42501" });
        await db.query(
          "update public.ai_connections set allow_proposals=true where id=$1",
          [connection.id],
        );
        await as("anon");
        await assert.rejects(submit(p), { code: "42501" });
      },
    );
    await t.test(
      "staging captures immutable snapshots without changing records; retries do not duplicate",
      async () => {
        const p = payload([
          update("application", app, 1, { notes: "Suggested" }),
        ]);
        await agent();
        const id = await submit(p);
        assert.equal(await submit(p), id);
        await assert.rejects(submit({ ...p, title: "Changed request" }), {
          code: "22023",
        });
        assert.equal((await read("applications", app)).notes, "");
        assert.equal(
          (await db.query("select * from public.ai_proposals")).rows.length,
          0,
        );
        const status = (
          await db.query("select public.ai_proposal_status($1) as value", [id])
        ).rows[0].value;
        assert.equal(status.status, "pending");
        assert.equal(status.changes, undefined);
        await browser();
        const stored = await read("ai_proposals", id);
        assert.equal(stored.changes[0].before.notes, "");
        assert.equal(stored.changes[0].after.notes, "Suggested");
        assert.equal(stored.changes[0].before.user_id, undefined);
        for (const sql of [
          "update public.ai_proposals set status='approved'",
          "delete from public.ai_proposals",
          "insert into public.ai_proposals(id) values (gen_random_uuid())",
        ])
          await assert.rejects(db.query(sql), { code: "42501" });
        await as("authenticated", bob);
        assert.equal(
          (await db.query("select * from public.ai_proposals")).rows.length,
          0,
        );
        await assert.rejects(decide(id), { code: "42501" });
        await browser();
        await decide(id);
        const revised = await read("applications", app);
        assert.equal(revised.notes, "Suggested");
        await decide(id);
        assert.equal(
          (await read("applications", app)).revision,
          revised.revision,
        );
        await agent();
        assert.equal(await submit(p), id);
        assert.equal(
          (
            await db.query("select public.ai_proposal_status($1) as value", [
              id,
            ])
          ).rows[0].value.status,
          "approved",
        );
      },
    );
    await t.test(
      "proposal boundaries reject hidden records, vault entities, identity injection and malformed changes",
      async () => {
        await agent();
        for (const change of [
          update("application", hidden, 1, { notes: "Hidden" }),
          create("application", { company: "New", role: "Role" }),
          create("resume", { name: "CV", body: "Text" }),
        ])
          await assert.rejects(submit(payload([change])), { code: "42501" });
        for (const change of [
          update("application", app, 2, { user_id: bob }),
          update("application", app, 2, { portal_id: randomUUID() }),
          create("portal", { name: "Vault" }),
          update("application", app, 2, {
            job_url: "https://name:password@example.com",
          }),
          update("application", app, 2, { status: "Invented" }),
          create(
            "round",
            { title: "Bad", time_zone: "Mars/Test" },
            { application_id: app },
          ),
          create(
            "round",
            { title: "Bad", status: "Scheduled" },
            { application_id: app },
          ),
        ])
          await assert.rejects(submit(payload([change])), { code: "22023" });
        await assert.rejects(submit(payload([])), { code: "22023" });
        const dup = update("application", app, 2, { notes: "Twice" });
        await assert.rejects(submit(payload([dup, dup])), { code: "22023" });
      },
    );
    await t.test(
      "whole-workspace batches create an application, round, linked task, contact and resume atomically",
      async () => {
        await browser();
        await db.query(
          "update public.ai_connections set application_access='all',resume_access='all' where id=$1",
          [connection.id],
        );
        const a = create("application", {
          company: "New company",
          role: "Designer",
        });
        const r = create(
          "round",
          {
            title: "First interview",
            status: "Scheduled",
            scheduled_at: "2026-10-02T10:00:00+09:00",
            time_zone: "Asia/Tokyo",
          },
          { application_id: a.record_id },
        );
        const task = create(
          "task",
          { title: "Prepare", round_id: r.record_id },
          { application_id: a.record_id },
        );
        const contact = create(
          "contact",
          { name: "Recruiter" },
          { application_id: a.record_id },
        );
        const cv = create("resume", {
          name: "Reviewed proposal",
          body: "User-confirmed experience",
        });
        createdApps.push(a.record_id);
        createdResumes.push(cv.record_id);
        await agent();
        const p = payload([a, r, task, contact, cv]),
          id = await submit(p);
        assert.equal(await read("applications", a.record_id), undefined);
        await browser();
        const receipt = await decide(id);
        assert.equal(receipt.length, 5);
        assert.equal(
          (await read("preparation_tasks", task.record_id)).round_id,
          r.record_id,
        );
        assert.equal((await read("resumes", cv.record_id)).body, cv.data.body);
        assert.equal(
          (
            await db.query(
              "select * from public.round_schedule_history where round_id=$1",
              [r.record_id],
            )
          ).rows.length,
          1,
        );
        await decide(id);
        assert.equal(
          (
            await db.query(
              "select * from public.round_schedule_history where round_id=$1",
              [r.record_id],
            )
          ).rows.length,
          1,
        );
        assert.equal(
          receipt[0].revision,
          (await read("applications", a.record_id)).revision,
        );
      },
    );
    await t.test(
      "stale batches apply nothing and can be rejected; decisions cannot be reversed",
      async () => {
        await browser();
        const source = await read("applications", app);
        const cv = create("resume", { name: "Must not save", body: "Pending" });
        await agent();
        const id = await submit(
          payload([
            cv,
            update("application", app, source.revision, { notes: "Stale" }),
          ]),
        );
        await browser();
        await db.query(
          "update public.applications set notes='Newer user edit' where id=$1",
          [app],
        );
        await assert.rejects(decide(id), { code: "40001" });
        assert.equal(await read("resumes", cv.record_id), undefined);
        assert.equal(
          (await read("applications", app)).notes,
          "Newer user edit",
        );
        await decide(id, "reject");
        await decide(id, "reject");
        await assert.rejects(decide(id), { code: "40001" });
      },
    );
    await t.test(
      "late database failures roll back earlier writes and keep the proposal pending",
      async () => {
        const collision = randomUUID();
        await as("authenticated", bob);
        await db.query(
          "insert into public.resumes(id,name,body,source) values ($1,'Other owner','Private','paste')",
          [collision],
        );
        const a = create("application", {
          company: "Must roll back",
          role: "Role",
        });
        await agent();
        const id = await submit(
          payload([
            a,
            create(
              "resume",
              { name: "Collision", body: "Text" },
              { record_id: collision },
            ),
          ]),
        );
        await browser();
        await assert.rejects(decide(id), { code: "23505" });
        assert.equal(await read("applications", a.record_id), undefined);
        assert.equal((await read("ai_proposals", id)).status, "pending");
        await decide(id, "reject");
      },
    );
    await t.test(
      "permission reductions, disabled proposals and reconnects block pending approval",
      async () => {
        await browser();
        const revision = (await read("applications", app)).revision;
        await agent();
        const id = await submit(
          payload([update("application", app, revision, { notes: "Blocked" })]),
        );
        await browser();
        await db.query(
          "update public.ai_connections set application_access='none' where id=$1",
          [connection.id],
        );
        await assert.rejects(decide(id), { code: "42501" });
        await db.query(
          "update public.ai_connections set application_access='all',allow_proposals=false where id=$1",
          [connection.id],
        );
        await assert.rejects(decide(id), { code: "40001" });
        await db.query(
          "update public.ai_connections set allow_proposals=true,revoked_at=now() where id=$1",
          [connection.id],
        );
        await assert.rejects(decide(id), { code: "40001" });
        await db.query(
          "update public.ai_connections set revoked_at=null where id=$1",
          [connection.id],
        );
        await assert.rejects(decide(id), { code: "40001" });
        await agent();
        await assert.rejects(
          submit(
            payload([
              update("application", app, revision, { notes: "Old session" }),
            ]),
          ),
          { code: "42501" },
        );
        await browser();
        await decide(id, "reject");
        await db.query("reset role");
        await db.query(
          "update auth.sessions set created_at=clock_timestamp() where id=$1",
          [session],
        );
      },
    );
    await t.test(
      "pending proposal capacity is bounded without breaking retries",
      async () => {
        await browser();
        const count = Number(
          (
            await db.query(
              "select count(*) as n from public.ai_proposals where connection_id=$1 and status='pending' and expires_at>now()",
              [connection.id],
            )
          ).rows[0].n,
        );
        await agent();
        let last, lastId;
        for (let i = count; i < 50; i++) {
          last = payload([
            create(
              "task",
              { title: "Capacity fixture" },
              { application_id: app },
            ),
          ]);
          lastId = await submit(last);
        }
        assert.equal(await submit(last), lastId);
        await assert.rejects(
          submit(
            payload([
              create(
                "task",
                { title: "Over capacity" },
                { application_id: app },
              ),
            ]),
          ),
          { code: "22023" },
        );
        await db.query("reset role");
        await db.query(
          "update public.ai_proposals set expires_at=now()-interval '1 second' where connection_id=$1 and status='pending'",
          [connection.id],
        );
      },
    );
    await t.test(
      "expired and provider-revoked proposals cannot be approved, but can be rejected",
      async () => {
        await agent();
        const id = await submit(
          payload([
            create("task", { title: "Expired" }, { application_id: app }),
          ]),
        );
        await db.query("reset role");
        await db.query(
          "update public.ai_proposals set expires_at=now()-interval '1 second' where id=$1",
          [id],
        );
        await browser();
        await assert.rejects(decide(id), { code: "40001" });
        await decide(id, "reject");
        await agent();
        const revoked = await submit(
          payload([
            create("task", { title: "Revoked" }, { application_id: app }),
          ]),
        );
        await db.query("reset role");
        await db.query("delete from auth.sessions where id=$1", [session]);
        await browser();
        await assert.rejects(decide(revoked), { code: "40001" });
        await decide(revoked, "reject");
      },
    );
  } finally {
    await db.query("reset role");
    await db.query("delete from public.ai_connections where id=$1", [
      connection.id,
    ]);
    await db.query("delete from public.applications where id=any($1::uuid[])", [
      createdApps,
    ]);
    await db.query("delete from public.resumes where id=any($1::uuid[])", [
      createdResumes,
    ]);
    await db.query("delete from auth.sessions where id=$1", [session]);
  }
}
