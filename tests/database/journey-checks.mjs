import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function journeyChecks(t, db, as, alice, bob, app, bobApp) {
  const round = randomUUID(),
    otherRound = randomUUID(),
    task = randomUUID(),
    contact = randomUUID();
  const bobRound = randomUUID(),
    bobTask = randomUUID(),
    bobContact = randomUUID();
  const tables = [
    "hiring_rounds",
    "preparation_tasks",
    "application_contacts",
    "round_schedule_history",
  ];
  const rejected = (sql, args, code) =>
    assert.rejects(db.query(sql, args), { code });
  const count = async (sql) => Number((await db.query(sql)).rows[0].count);
  const reminderQuery =
    "select * from public.next_actions('2026-09-24','2026-09-25T00:00Z','2026-09-24T12:00Z')";
  await as("authenticated", bob);
  await db.query(
    "insert into public.hiring_rounds(id,application_id,title) values ($1,$2,'Private Bob interview')",
    [bobRound, bobApp],
  );
  await db.query(
    "insert into public.preparation_tasks(id,application_id,title,round_id) values ($1,$2,'Private Bob task',$3)",
    [bobTask, bobApp, bobRound],
  );
  await db.query(
    "insert into public.application_contacts(id,application_id,name) values ($1,$2,'Private Bob contact')",
    [bobContact, bobApp],
  );
  await as("authenticated", alice);
  await db.query(
    "insert into public.hiring_rounds(id,application_id,title,status,scheduled_at,time_zone,notes) values ($1,$2,'Technical interview','Scheduled','2026-09-24T15:00Z','Asia/Tokyo','Original notes')",
    [round, app],
  );
  await db.query(
    "insert into public.hiring_rounds(id,application_id,title,kind,due_on) values ($1,$2,'Technical interview','Assessment','2026-09-25')",
    [otherRound, app],
  );
  await db.query(
    "insert into public.preparation_tasks(id,application_id,round_id,title,due_on) values ($1,$2,$3,'Review portfolio','2026-09-24')",
    [task, app, round],
  );
  await db.query(
    "insert into public.application_contacts(id,application_id,name) values ($1,$2,'Alice recruiter')",
    [contact, app],
  );

  await t.test(
    "journey tables deny anonymous access, spoofed owners, cross-application links and identity changes",
    async () => {
      await as("anon");
      for (const table of tables)
        for (const operation of ["select * from", "delete from", "truncate"])
          await rejected(`${operation} public.${table}`, [], "42501");
      await rejected(reminderQuery, [], "42501");
      await as("authenticated", alice);
      for (const [table, id] of [
        ["hiring_rounds", bobRound],
        ["preparation_tasks", bobTask],
        ["application_contacts", bobContact],
      ]) {
        assert.equal(
          (await db.query(`select * from public.${table} where id=$1`, [id]))
            .rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `update public.${table} set notes='Intruder' where id=$1 returning id`,
              [id],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `delete from public.${table} where id=$1 returning id`,
              [id],
            )
          ).rows.length,
          0,
        );
        await rejected(`truncate public.${table}`, [], "42501");
      }
      assert.equal(
        (
          await db.query(
            "select * from public.round_schedule_history where round_id=$1",
            [bobRound],
          )
        ).rows.length,
        0,
      );
      await rejected(
        "insert into public.hiring_rounds(user_id,application_id,title) values ($1,$2,'Spoofed')",
        [bob, bobApp],
        "42501",
      );
      await rejected(
        "insert into public.hiring_rounds(application_id,title) values ($1,'Wrong parent')",
        [bobApp],
        "23503",
      );
      await rejected(
        "insert into public.preparation_tasks(application_id,title,round_id) values ($1,'Wrong round',$2)",
        [app, bobRound],
        "23503",
      );
      const secondApp = randomUUID();
      await db.query(
        "insert into public.applications(id,company,role) values ($1,'Second','Role')",
        [secondApp],
      );
      await rejected(
        "insert into public.preparation_tasks(application_id,title,round_id) values ($1,'Other application',$2)",
        [secondApp, round],
        "23503",
      );
      await rejected(
        "update public.hiring_rounds set application_id=$1 where id=$2",
        [secondApp, round],
        "23514",
      );
      await rejected(
        "update public.preparation_tasks set user_id=$1 where id=$2",
        [bob, task],
        "23514",
      );
      await rejected(
        "update public.application_contacts set id=$1 where id=$2",
        [randomUUID(), contact],
        "23514",
      );
      await db.query("delete from public.applications where id=$1", [
        secondApp,
      ]);
      await as("authenticated");
      for (const table of tables)
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      assert.equal((await db.query(reminderQuery)).rows.length, 0);
    },
  );
  await t.test(
    "schedule history is transactional, immutable, complete, and protected against stale updates",
    async () => {
      await as("authenticated", alice);
      const before = (
        await db.query(
          "select revision from public.hiring_rounds where id=$1",
          [round],
        )
      ).rows[0].revision;
      const initialCount = await count(
        "select count(*) from public.round_schedule_history",
      );
      const parentRevision = (
        await db.query("select revision from public.applications where id=$1", [
          app,
        ])
      ).rows[0].revision;
      await db.query(
        "update public.hiring_rounds set scheduled_at='2026-09-26T01:00Z', duration_minutes=90, due_on='2026-09-27', schedule_note='Recruiter requested a change', revision=1 where id=$1 and revision=$2",
        [round, before],
      );
      assert.equal(
        (
          await db.query(
            "select revision from public.hiring_rounds where id=$1",
            [round],
          )
        ).rows[0].revision,
        before + 1,
      );
      assert.ok(
        (
          await db.query(
            "select revision from public.applications where id=$1",
            [app],
          )
        ).rows[0].revision > parentRevision,
      );
      assert.equal(
        await count("select count(*) from public.round_schedule_history"),
        initialCount + 1,
      );
      const entry = (
        await db.query(
          "select (previous_at at time zone 'UTC')::text as previous_at, (scheduled_at at time zone 'UTC')::text as scheduled_at, previous_duration_minutes, duration_minutes, previous_due_on, due_on::text, note from public.round_schedule_history where round_id=$1 and previous_status is not null",
          [round],
        )
      ).rows[0];
      assert.match(entry.previous_at, /2026-09-24 15:00/);
      assert.match(entry.scheduled_at, /2026-09-26 01:00/);
      assert.equal(entry.previous_duration_minutes, 60);
      assert.equal(entry.duration_minutes, 90);
      assert.equal(entry.previous_due_on, null);
      assert.equal(entry.due_on, "2026-09-27");
      assert.equal(entry.note, "Recruiter requested a change");
      assert.equal(
        (
          await db.query(
            "update public.hiring_rounds set scheduled_at='2026-09-28' where id=$1 and revision=$2 returning id",
            [round, before],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.hiring_rounds where id=$1 and revision=$2 returning id",
            [round, before],
          )
        ).rows.length,
        0,
      );
      await db.query(
        "update public.hiring_rounds set notes='Only notes changed' where id=$1",
        [round],
      );
      await rejected(
        "update public.hiring_rounds set time_zone='Bad/Zone' where id=$1",
        [round],
        "23514",
      );
      assert.equal(
        await count("select count(*) from public.round_schedule_history"),
        initialCount + 1,
      );
      await rejected(
        "insert into public.round_schedule_history(user_id,application_id,round_id,time_zone,status,duration_minutes,note) values ($1,$2,$3,'UTC','Planned',60,'Forged')",
        [alice, app, round],
        "42501",
      );
      await rejected(
        "update public.round_schedule_history set note='Rewritten'",
        [],
        "42501",
      );
      await rejected("delete from public.round_schedule_history", [], "42501");
      for (const name of [
        "record_round_schedule",
        "validate_journey_record",
        "touch_journey_application",
      ])
        await rejected(`select public.${name}()`, [], "42501");
    },
  );
  await t.test(
    "next actions use current schedules and deadlines, hide completed/closed journeys, and retain open preparation",
    async () => {
      await as("authenticated", alice);
      let rows = (await db.query(reminderQuery)).rows;
      assert.equal(rows.length, 4);
      assert.ok(rows.every((row) => row.user_id === alice));
      assert.equal(rows.find((row) => row.source === "task").bucket, 1);
      assert.equal(rows.find((row) => row.source === "meeting").bucket, 2);
      await db.query(
        "update public.preparation_tasks set due_on='2026-09-23' where id=$1",
        [task],
      );
      assert.equal(
        (await db.query(reminderQuery)).rows.find(
          (row) => row.source === "task",
        ).bucket,
        0,
      );
      await db.query(
        "update public.hiring_rounds set status='Completed' where id=$1",
        [round],
      );
      rows = (await db.query(reminderQuery)).rows;
      assert.equal(rows.length, 2);
      assert.ok(rows.some((row) => row.record_id === task));
      await db.query(
        "update public.hiring_rounds set status='Cancelled' where id=$1",
        [otherRound],
      );
      assert.equal((await db.query(reminderQuery)).rows.length, 1);
      await db.query(
        "update public.preparation_tasks set completed=true where id=$1",
        [task],
      );
      assert.equal((await db.query(reminderQuery)).rows.length, 0);
      await db.query(
        "update public.preparation_tasks set completed=false, due_on=null where id=$1",
        [task],
      );
      assert.equal((await db.query(reminderQuery)).rows[0].bucket, 3);
      for (const status of ["Offer", "Rejected", "Withdrawn"]) {
        await db.query("update public.applications set status=$1 where id=$2", [
          status,
          app,
        ]);
        assert.equal((await db.query(reminderQuery)).rows.length, 0);
      }
      await db.query(
        "update public.applications set status='Saved' where id=$1",
        [app],
      );
      assert.equal((await db.query(reminderQuery)).rows.length, 1);
    },
  );
  await t.test(
    "direct writes reject credential-bearing links and invalid schedules; cascades preserve unrelated records",
    async () => {
      await as("authenticated", alice);
      for (const url of [
        "https://name:password@example.com",
        "https://name@example.com",
        "https://user%40example.com:pass@example.com",
        "https://example.com\\@evil.test",
      ]) {
        await rejected(
          "update public.applications set job_url=$1 where id=$2",
          [url, app],
          "23514",
        );
        await rejected(
          "update public.hiring_rounds set meeting_url=$1 where id=$2",
          [url, round],
          "23514",
        );
      }
      await rejected(
        "update public.hiring_rounds set status='Scheduled', scheduled_at=null where id=$1",
        [round],
        "23514",
      );
      await db.query("delete from public.hiring_rounds where id=$1", [round]);
      assert.equal(
        (
          await db.query(
            "select round_id from public.preparation_tasks where id=$1",
            [task],
          )
        ).rows[0].round_id,
        null,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.round_schedule_history where round_id=$1",
            [round],
          )
        ).rows.length,
        0,
      );
      await db.query("delete from public.hiring_rounds where id=$1", [
        otherRound,
      ]);
      await db.query("delete from public.preparation_tasks where id=$1", [
        task,
      ]);
      await db.query("delete from public.application_contacts where id=$1", [
        contact,
      ]);
      await as("authenticated", bob);
      assert.equal(
        (await db.query("select * from public.hiring_rounds")).rows.length,
        1,
      );
      // A parent delete must remove every child including schedule history.
      await db.query("delete from public.applications where id=$1", [bobApp]);
      for (const table of tables)
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      // Restore the application used by the existing account-deletion assertions.
      await db.query(
        "insert into public.applications(id,company,role) values ($1,'Bob only','Engineer')",
        [bobApp],
      );
    },
  );
}
