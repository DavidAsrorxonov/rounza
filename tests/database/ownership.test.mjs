import { journeyChecks } from "./journey-checks.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

// Same SQL assertions run in embedded Postgres locally and native Postgres in CI.
// The optional URL must identify a disposable LOCAL cluster, never a hosted project.
async function database() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const client = new PGlite();
    return {
      query: (sql, args) =>
        args ? client.query(sql, args) : client.exec(sql).then((r) => r.at(-1)),
      close: () => client.close(),
    };
  }
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
    "Use a disposable local Postgres cluster.",
  );
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  const name = `rounza_test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`create database ${name}`);
  const clientUrl = new URL(url);
  clientUrl.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: clientUrl.href });
  await client.connect();
  return {
    query: (sql, args) => client.query(sql, args),
    close: async () => {
      await client.end();
      await admin.query(`drop database ${name}`);
      await admin.end();
    },
  };
}

test("private records enforce ownership in Postgres", async (t) => {
  const db = await database();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  const app = "33333333-3333-4333-8333-333333333333";
  const bobApp = "44444444-4444-4444-8444-444444444444";
  const as = async (role, id = "") => {
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      id,
    ]);
    await db.query(`set role ${role}`);
  };
  const denied = (sql, args) =>
    assert.rejects(db.query(sql, args), { code: "42501" });
  try {
    await db.query(`
      do $$ begin
        if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `);
    await db.query("insert into auth.users values ($1, $2)", [
      alice,
      '{"full_name":"Alice Example"}',
    ]);
    for (const file of (await readdir("supabase/migrations"))
      .filter((p) => p.endsWith(".sql"))
      .sort()) {
      if (file.includes("hiring_journeys")) {
        await db.query(
          "insert into public.applications(id,user_id,company,role,job_url) values ($1,$2,'Legacy','Role','https://old:password@example.com')",
          [app, alice],
        );
      }
      await db.query(await readFile(`supabase/migrations/${file}`, "utf8"));
      if (file.includes("hiring_journeys")) {
        assert.equal(
          (
            await db.query(
              "select job_url from public.applications where id=$1",
              [app],
            )
          ).rows[0].job_url,
          null,
        );
        await db.query("delete from public.applications where id=$1", [app]);
      }
    }
    await db.query("insert into auth.users values ($1, $2)", [
      bob,
      JSON.stringify({ full_name: "B".repeat(400), role: "admin" }),
    ]);
    await db.query(
      "insert into public.applications(id,user_id,company,role) values ($1,$2,'Bob only','Engineer')",
      [bobApp, bob],
    );

    await t.test(
      "existing users are backfilled and new profiles are safely bootstrapped",
      async () => {
        const rows = (
          await db.query(
            "select id, display_name from public.profiles order by id",
          )
        ).rows;
        assert.equal(rows.length, 2);
        assert.equal(rows[0].display_name, "Alice Example");
        assert.equal(rows[1].display_name.length, 120);
      },
    );
    await t.test(
      "anonymous clients cannot read or mutate private tables",
      async () => {
        await as("anon");
        for (const table of ["profiles", "applications"]) {
          await denied(`select * from public.${table}`);
          await denied(`delete from public.${table}`);
          await denied(`truncate public.${table}`);
        }
        await denied("insert into public.profiles(id) values ($1)", [alice]);
        await denied("update public.profiles set display_name='Intruder'");
        await denied(
          "insert into public.applications(company,role) values ('Intruder','Role')",
        );
        await denied("update public.applications set company='Intruder'");
      },
    );
    await t.test(
      "owners can read their profile but cannot create, delete, or transfer profiles",
      async () => {
        await as("authenticated", alice);
        assert.equal(
          (await db.query("select * from public.profiles")).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "update public.profiles set display_name='Alice updated' where id=$1 returning id",
              [alice],
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "update public.profiles set display_name='Hacked' where id=$1 returning id",
              [bob],
            )
          ).rows.length,
          0,
        );
        await denied("update public.profiles set id=$1 where id=$2", [
          bob,
          alice,
        ]);
        await denied("delete from public.profiles where id=$1", [alice]);
        await denied("insert into public.profiles(id) values ($1)", [bob]);
        await denied("select public.create_user_profile()");
      },
    );
    await t.test(
      "owners can create, read, update, and delete their own applications",
      async () => {
        await as("authenticated", alice);
        const inserted = await db.query(
          "insert into public.applications(id,company,role) values ($1,'Alice only','Designer') returning *",
          [app],
        );
        assert.equal(inserted.rows[0].user_id, alice);
        assert.equal(inserted.rows[0].status, "Saved");
        assert.equal(
          (await db.query("select * from public.applications")).rows.length,
          1,
        );
        const updated = (
          await db.query(
            "update public.applications set notes='My notes', created_at='2000-01-01' where id=$1 returning *",
            [app],
          )
        ).rows[0];
        assert.equal(updated.notes, "My notes");
        assert.equal(
          String(updated.created_at),
          String(inserted.rows[0].created_at),
        );
      },
    );
    await t.test(
      "cross-account reads, writes, deletes, ownership changes and spoofed inserts fail",
      async () => {
        await as("authenticated", alice);
        assert.equal(
          (
            await db.query("select * from public.applications where id=$1", [
              bobApp,
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "update public.applications set notes='Hacked' where id=$1 returning id",
              [bobApp],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "delete from public.applications where id=$1 returning id",
              [bobApp],
            )
          ).rows.length,
          0,
        );
        await denied(
          "insert into public.applications(user_id,company,role) values ($1,'Spoof','Role')",
          [bob],
        );
        await denied("update public.applications set user_id=$1 where id=$2", [
          bob,
          app,
        ]);
        await denied("truncate public.applications");
        await as("authenticated", bob);
        assert.deepEqual(
          (await db.query("select id from public.applications")).rows,
          [{ id: bobApp }],
        );
        assert.equal(
          (await db.query("select * from public.profiles where id=$1", [alice]))
            .rows.length,
          0,
        );
      },
    );
    await t.test(
      "a role without an authenticated user ID has no row access",
      async () => {
        await as("authenticated");
        assert.equal(
          (await db.query("select * from public.applications")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.profiles")).rows.length,
          0,
        );
        await denied(
          "insert into public.applications(user_id,company,role) values ($1,'Spoof','Role')",
          [alice],
        );
      },
    );
    await t.test(
      "search respects ownership and treats wildcard/filter punctuation literally",
      async () => {
        await as("authenticated", alice);
        assert.equal(
          (
            await db.query(
              "select * from public.search_applications('Bob', null)",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.search_applications('designer', 'Saved')",
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.search_applications('', 'Offer')",
            )
          ).rows.length,
          0,
        );
        await db.query(
          "update public.applications set company=$1 where id=$2",
          ["50%_.*,Acme (Labs)", app],
        );
        assert.equal(
          (
            await db.query(
              "select * from public.search_applications($1, null)",
              ["%_.*,Acme"],
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.search_applications($1, null)",
              ["id.neq.0)"],
            )
          ).rows.length,
          0,
        );
        await as("anon");
        await denied("select * from public.search_applications('', null)");
      },
    );
    await t.test(
      "revision checks prevent stale updates and deletes, even if a client sets revision",
      async () => {
        await as("authenticated", alice);
        const before = (
          await db.query(
            "select revision from public.applications where id=$1",
            [app],
          )
        ).rows[0].revision;
        const changed = (
          await db.query(
            "update public.applications set notes='New version', revision=1 where id=$1 and revision=$2 returning revision",
            [app, before],
          )
        ).rows;
        assert.equal(changed[0].revision, before + 1);
        assert.equal(
          (
            await db.query(
              "update public.applications set notes='Stale edit' where id=$1 and revision=$2 returning id",
              [app, before],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "delete from public.applications where id=$1 and revision=$2 returning id",
              [app, before],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select notes from public.applications where id=$1",
              [app],
            )
          ).rows[0].notes,
          "New version",
        );
      },
    );
    await journeyChecks(t, db, as, alice, bob, app, bobApp);
    await t.test(
      "database constraints reject invalid records and owners can delete",
      async () => {
        await as("authenticated", alice);
        await assert.rejects(
          db.query(
            "insert into public.applications(company,role) values (' ','Role')",
          ),
          { code: "23514" },
        );
        await assert.rejects(
          db.query(
            "update public.applications set job_url='javascript:alert(1)' where id=$1",
            [app],
          ),
          { code: "23514" },
        );
        assert.equal(
          (
            await db.query(
              "delete from public.applications where id=$1 returning id",
              [app],
            )
          ).rows.length,
          1,
        );
      },
    );
    await t.test(
      "deleting an auth user cascades only that user's records",
      async () => {
        await db.query("reset role");
        await db.query("delete from auth.users where id=$1", [bob]);
        assert.equal(
          (await db.query("select * from public.applications")).rows.length,
          0,
        );
        assert.deepEqual(
          (await db.query("select id from public.profiles")).rows,
          [{ id: alice }],
        );
      },
    );
  } finally {
    await db.close();
  }
});
