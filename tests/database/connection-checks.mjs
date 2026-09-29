import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function connectionChecks(t, db, as, alice, bob) {
  const client = randomUUID(),
    otherClient = randomUUID(),
    session = randomUUID();
  const app = randomUUID(),
    hidden = randomUUID(),
    resume = randomUUID(),
    hiddenResume = randomUUID(),
    round = randomUUID(),
    vault = randomUUID();
  const resource = "https://rounza.app/mcp";
  const claims = {
    sub: alice,
    client_id: client,
    session_id: session,
    aud: resource,
    role: "authenticated",
    is_anonymous: false,
  };
  const agent = async (overrides = {}) => {
    await as("authenticated", overrides.sub ?? alice);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ ...claims, ...overrides }),
    ]);
  };
  await as("authenticated", alice);
  for (const id of [app, hidden])
    await db.query(
      "insert into public.applications(id,company,role) values ($1,'AI fixture','Engineer')",
      [id],
    );
  for (const id of [resume, hiddenResume])
    await db.query(
      "insert into public.resumes(id,name,body,source) values ($1,'AI resume','Reviewed experience','paste')",
      [id],
    );
  await db.query(
    "insert into public.hiring_rounds(id,application_id,title) values ($1,$2,'Interview')",
    [round, app],
  );
  await db.query(
    "insert into public.preparation_tasks(application_id,title) values ($1,'Prepare')",
    [app],
  );
  await db.query(
    "insert into public.application_contacts(application_id,name) values ($1,'Recruiter')",
    [app],
  );
  await db.query(
    "insert into public.credential_vaults(id,user_id,version,kdf,memory_kib,iterations,parallelism,salt,passphrase_nonce,passphrase_wrapped_key,recovery_nonce,recovery_wrapped_key) values ($1,$2,1,'argon2id',65536,3,4,$3,$4,$5,$4,$5)",
    [vault, alice, "A".repeat(22) + "==", "A".repeat(16), "A".repeat(64)],
  );
  await db.query("select public.create_portal_account($1,$2,$3,$4,$5)", [
    randomUUID(),
    vault,
    "A".repeat(16),
    "A".repeat(64),
    app,
  ]);
  const connection = (
    await db.query(
      "insert into public.ai_connections(client_id,client_name,application_ids) values ($1,'Fixture assistant',$2) returning *",
      [client, [app]],
    )
  ).rows[0];
  await db.query("reset role");
  await db.query(
    "insert into rounza_private.mcp_settings(resource) values ($1)",
    [resource],
  );
  await db.query(
    "insert into auth.sessions(id,user_id,oauth_client_id) values ($1,$2,$3)",
    [session, alice, client],
  );

  await t.test(
    "delegated RLS reads only selected applications and their journeys; resumes require separate permission",
    async () => {
      await agent();
      assert.equal(
        (await db.query("select public.ai_connection_status() as allowed"))
          .rows[0].allowed,
        true,
      );
      assert.deepEqual(
        (await db.query("select id from public.applications")).rows,
        [{ id: app }],
      );
      assert.deepEqual(
        (await db.query("select id from public.search_applications('AI',null)"))
          .rows,
        [{ id: app }],
      );
      for (const table of [
        "hiring_rounds",
        "preparation_tasks",
        "application_contacts",
        "round_schedule_history",
      ])
        assert.ok(
          (await db.query(`select * from public.${table}`)).rows.every(
            (r) => r.application_id === app,
          ),
        );
      assert.equal(
        (await db.query("select * from public.resumes")).rows.length,
        0,
      );
      await as("authenticated", alice);
      await db.query(
        "update public.ai_connections set resume_access='selected',resume_ids=$1 where id=$2",
        [[resume], connection.id],
      );
      await agent();
      assert.deepEqual((await db.query("select id from public.resumes")).rows, [
        { id: resume },
      ]);
      const next = (
        await db.query(
          "select * from public.next_actions(current_date,now()+interval '1 day',now())",
        )
      ).rows;
      assert.ok(next.every((r) => r.application_id === app));
    },
  );
  await t.test(
    "delegated tokens cannot read vault data, profile, grants or modify records through tables and RPCs",
    async () => {
      await agent();
      for (const table of [
        "credential_vaults",
        "portal_accounts",
        "application_portals",
        "profiles",
        "ai_connections",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
          table,
        );
      assert.equal(
        (await db.query("select * from public.list_portal_accounts(null)")).rows
          .length,
        0,
      );
      for (const [table, field, value] of [
        ["applications", "company", "Changed"],
        ["hiring_rounds", "title", "Changed"],
        ["preparation_tasks", "title", "Changed"],
        ["application_contacts", "name", "Changed"],
        ["resumes", "name", "Changed"],
        ["ai_connections", "client_name", "Changed"],
      ]) {
        assert.equal(
          (
            await db.query(
              `update public.${table} set ${field}=$1 returning id`,
              [value],
            )
          ).rows.length,
          0,
          table,
        );
      }
      for (const table of [
        "applications",
        "hiring_rounds",
        "preparation_tasks",
        "application_contacts",
        "resumes",
        "credential_vaults",
        "portal_accounts",
      ])
        assert.equal(
          (await db.query(`delete from public.${table} returning id`)).rows
            .length,
          0,
          table,
        );
      for (const sql of [
        "insert into public.applications(company,role) values ('x','y')",
        "insert into public.resumes(name,body,source) values ('x','y','paste')",
        "insert into public.ai_connections(client_id,client_name) values (gen_random_uuid(),'x')",
      ])
        await assert.rejects(db.query(sql), { code: "42501" });
      await assert.rejects(
        db.query("select public.create_portal_account($1,$2,$3,$4,null)", [
          randomUUID(),
          vault,
          "A".repeat(16),
          "A".repeat(64),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("select public.rounza_access_token_hook('{}')"),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("select * from rounza_private.mcp_settings"),
        { code: "42501" },
      );
    },
  );
  await t.test(
    "permissions change immediately; all-app access includes future records without exposing other owners",
    async () => {
      await as("authenticated", alice);
      await db.query(
        "update public.ai_connections set application_access='none',resume_access='none' where id=$1",
        [connection.id],
      );
      await agent();
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.hiring_rounds")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.resumes")).rows.length,
        0,
      );
      await as("authenticated", alice);
      await db.query(
        "update public.ai_connections set application_access='all',resume_access='all' where id=$1",
        [connection.id],
      );
      const future = randomUUID();
      await db.query(
        "insert into public.applications(id,company,role) values ($1,'Future','Engineer')",
        [future],
      );
      await agent();
      const rows = (await db.query("select * from public.applications")).rows;
      assert.ok(rows.some((r) => r.id === future));
      assert.ok(rows.every((r) => r.user_id === alice));
      assert.ok(
        (await db.query("select * from public.resumes")).rows.every(
          (r) => r.user_id === alice,
        ),
      );
      await as("authenticated", alice);
      await db.query("delete from public.applications where id=$1", [future]);
    },
  );
  await t.test(
    "wrong audience, user, client, session and ended sessions cannot bypass grants",
    async () => {
      for (const override of [
        { aud: "authenticated" },
        { sub: bob },
        { client_id: otherClient },
        { session_id: randomUUID() },
        { is_anonymous: true },
      ]) {
        await agent(override);
        assert.equal(
          (await db.query("select public.ai_connection_status() as allowed"))
            .rows[0].allowed,
          false,
        );
        assert.equal(
          (await db.query("select * from public.applications")).rows.length,
          0,
        );
      }
      await db.query("reset role");
      await db.query(
        "update auth.sessions set not_after=now()-interval '1 second' where id=$1",
        [session],
      );
      await agent();
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
      await db.query("reset role");
      await db.query("update auth.sessions set not_after=null where id=$1", [
        session,
      ]);
    },
  );
  await t.test(
    "revocation survives provider failure, reconnect, refreshed old tokens and deleted sessions",
    async () => {
      await as("authenticated", alice);
      await db.query(
        "update public.ai_connections set revoked_at=now() where id=$1",
        [connection.id],
      );
      await agent();
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
      await as("authenticated", alice);
      await db.query(
        "update public.ai_connections set revoked_at=null,activated_at='2000-01-01' where id=$1",
        [connection.id],
      );
      await agent({ iat: Math.floor(Date.now() / 1000) + 100 });
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
      const fresh = randomUUID();
      await db.query("reset role");
      await db.query(
        "insert into auth.sessions(id,user_id,oauth_client_id) values ($1,$2,$3)",
        [fresh, alice, client],
      );
      await agent({ session_id: fresh });
      assert.ok(
        (await db.query("select * from public.applications")).rows.length > 0,
      );
      await db.query("reset role");
      await db.query("delete from auth.sessions where id=$1", [fresh]);
      await agent({ session_id: fresh });
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "browser grant management enforces ownership, record selections, revisions and immutable identity",
    async () => {
      await as("authenticated", bob);
      assert.equal(
        (
          await db.query("select * from public.ai_connections where id=$1", [
            connection.id,
          ])
        ).rows.length,
        0,
      );
      await as("authenticated", alice);
      await assert.rejects(
        db.query("update public.ai_connections set client_id=$1 where id=$2", [
          otherClient,
          connection.id,
        ]),
        { code: "23514" },
      );
      await assert.rejects(
        db.query(
          "update public.ai_connections set application_access='selected',application_ids=$1 where id=$2",
          [[randomUUID()], connection.id],
        ),
        { code: "23514" },
      );
      assert.equal(
        (
          await db.query(
            "update public.ai_connections set resume_access='none' where id=$1 and revision=1 returning id",
            [connection.id],
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "access token hook preserves browser claims and binds delegated audience on issuance and refresh",
    async () => {
      const browser = {
        sub: alice,
        aud: "authenticated",
        role: "authenticated",
        exp: 10000,
      };
      await db.query("reset role");
      await db.query("set role supabase_auth_admin");
      for (const authentication_method of ["oauth", "token_refresh"]) {
        assert.deepEqual(
          (
            await db.query(
              "select public.rounza_access_token_hook($1) as result",
              [{ claims: browser, authentication_method }],
            )
          ).rows[0].result,
          { claims: browser },
        );
        const delegated = { ...browser, client_id: client };
        assert.deepEqual(
          (
            await db.query(
              "select public.rounza_access_token_hook($1) as result",
              [{ claims: delegated, authentication_method }],
            )
          ).rows[0].result,
          { claims: { ...delegated, aud: resource } },
        );
      }
    },
  );
  await db.query("reset role");
  await db.query("delete from public.ai_connections where id=$1", [
    connection.id,
  ]);
  await db.query("delete from public.applications where id=any($1)", [
    [app, hidden],
  ]);
  await db.query("delete from public.resumes where id=any($1)", [
    [resume, hiddenResume],
  ]);
  await db.query("delete from public.credential_vaults where id=$1", [vault]);
  await db.query("delete from auth.sessions where id=$1", [session]);
  await as("authenticated", alice);
}
