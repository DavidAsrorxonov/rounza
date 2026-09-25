import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function vaultChecks(t, db, as, alice, bob, app, bobApp) {
  const vault = randomUUID(),
    bobVault = randomUUID(),
    portal = randomUUID(),
    bobPortal = randomUUID();
  const nonce = "A".repeat(16),
    ciphertext = "A".repeat(64),
    salt = "A".repeat(22) + "==";
  const createVault = async (id, owner) =>
    db.query(
      "insert into public.credential_vaults(id,user_id,version,kdf,memory_kib,iterations,parallelism,salt,passphrase_nonce,passphrase_wrapped_key,recovery_nonce,recovery_wrapped_key) values ($1,$2,1,'argon2id',65536,3,4,$3,$4,$5,$4,$5)",
      [id, owner, salt, nonce, ciphertext],
    );
  const createPortal = async (id, vaultId, appId) =>
    db.query("select public.create_portal_account($1,$2,$3,$4,$5)", [
      id,
      vaultId,
      nonce,
      ciphertext,
      appId,
    ]);
  const rejected = (sql, args, code) =>
    assert.rejects(db.query(sql, args), { code });
  const tables = [
    "credential_vaults",
    "portal_accounts",
    "application_portals",
  ];
  await as("authenticated", bob);
  await createVault(bobVault, bob);
  await createPortal(bobPortal, bobVault, bobApp);
  await as("authenticated", alice);
  await createVault(vault, alice);
  await createPortal(portal, vault, app);

  await t.test(
    "vaults and portal links enforce ownership, fixed identities and ciphertext-only schema",
    async () => {
      await as("anon");
      for (const table of tables)
        for (const op of ["select * from", "delete from", "truncate"])
          await rejected(`${op} public.${table}`, [], "42501");
      await rejected(
        "select * from public.list_portal_accounts(null)",
        [],
        "42501",
      );
      await rejected(
        "select public.create_portal_account($1,$2,$3,$4,null)",
        [randomUUID(), vault, nonce, ciphertext],
        "42501",
      );
      await as("authenticated", alice);
      assert.equal(
        (await db.query("select * from public.list_portal_accounts(null)")).rows
          .length,
        1,
      );
      assert.equal(
        (
          await db.query("select * from public.list_portal_accounts($1)", [
            bobApp,
          ])
        ).rows.length,
        0,
      );
      for (const table of tables) {
        assert.equal(
          (
            await db.query(`select * from public.${table} where user_id=$1`, [
              bob,
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `delete from public.${table} where user_id=$1 returning user_id`,
              [bob],
            )
          ).rows.length,
          0,
        );
        await rejected(`truncate public.${table}`, [], "42501");
      }
      await rejected(
        "update public.credential_vaults set user_id=$1 where id=$2",
        [bob, vault],
        "23514",
      );
      await rejected(
        "update public.portal_accounts set vault_id=$1 where id=$2",
        [bobVault, portal],
        "23514",
      );
      await rejected(
        "update public.application_portals set application_id=$1",
        [bobApp],
        "42501",
      );
      await rejected(
        "insert into public.application_portals(application_id,portal_id,vault_id,user_id) values ($1,$2,$3,$4)",
        [bobApp, portal, vault, alice],
        "23503",
      );
      await rejected(
        "insert into public.application_portals(application_id,portal_id,vault_id,user_id) values ($1,$2,$3,$4)",
        [app, bobPortal, bobVault, alice],
        "23503",
      );
      await rejected(
        "insert into public.application_portals(application_id,portal_id,vault_id,user_id) values ($1,$2,$3,$4)",
        [app, portal, vault, bob],
        "42501",
      );
      await rejected("select public.validate_vault_record()", [], "42501");
      const columns = (
        await db.query(
          "select column_name from information_schema.columns where table_schema='public' and table_name in ('credential_vaults','portal_accounts','application_portals')",
        )
      ).rows.map((row) => row.column_name);
      for (const name of [
        "password",
        "username",
        "name",
        "url",
        "notes",
        "passphrase",
        "recovery_key",
        "data_key",
      ])
        assert.ok(!columns.includes(name));
      await as("authenticated");
      for (const table of tables)
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
    },
  );
  await t.test(
    "atomic account creation rolls back invalid links and encrypted parameters are bounded",
    async () => {
      await as("authenticated", alice);
      const failedId = randomUUID();
      await assert.rejects(createPortal(failedId, vault, bobApp), {
        code: "23503",
      });
      assert.equal(
        (
          await db.query("select * from public.portal_accounts where id=$1", [
            failedId,
          ])
        ).rows.length,
        0,
      );
      await assert.rejects(createPortal(randomUUID(), bobVault, app), {
        code: "23503",
      });
      await rejected(
        "update public.credential_vaults set memory_kib=999999 where id=$1",
        [vault],
        "23514",
      );
      await rejected(
        "update public.credential_vaults set iterations=1 where id=$1",
        [vault],
        "23514",
      );
      await rejected(
        "update public.credential_vaults set version=2 where id=$1",
        [vault],
        "23514",
      );
      await rejected(
        "update public.credential_vaults set salt='invalid' where id=$1",
        [vault],
        "23514",
      );
      await rejected(
        "update public.portal_accounts set ciphertext='plaintext' where id=$1",
        [portal],
        "23514",
      );
      await rejected(
        "update public.portal_accounts set nonce='short' where id=$1",
        [portal],
        "23514",
      );
      await rejected(
        "update public.portal_accounts set ciphertext=repeat('A',87388) where id=$1",
        [portal],
        "23514",
      );
    },
  );
  await t.test(
    "stale ciphertext saves, key replacements and destructive resets cannot overwrite newer revisions",
    async () => {
      await as("authenticated", alice);
      for (const [table, id, field] of [
        ["portal_accounts", portal, "ciphertext"],
        ["credential_vaults", vault, "passphrase_wrapped_key"],
      ]) {
        const before = (
          await db.query(`select revision from public.${table} where id=$1`, [
            id,
          ])
        ).rows[0].revision;
        await db.query(
          `update public.${table} set ${field}=$1, revision=1 where id=$2 and revision=$3`,
          ["B".repeat(64), id, before],
        );
        assert.equal(
          (
            await db.query(`select revision from public.${table} where id=$1`, [
              id,
            ])
          ).rows[0].revision,
          before + 1,
        );
        assert.equal(
          (
            await db.query(
              `update public.${table} set ${field}=$1 where id=$2 and revision=$3 returning id`,
              [ciphertext, id, before],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              `delete from public.${table} where id=$1 and revision=$2 returning id`,
              [id, before],
            )
          ).rows.length,
          0,
        );
      }
    },
  );
  await t.test(
    "shared accounts survive application removal; portal and vault deletions cascade only their links",
    async () => {
      await as("authenticated", alice);
      const secondApp = randomUUID();
      await db.query(
        "insert into public.applications(id,company,role) values ($1,'Second application','Role')",
        [secondApp],
      );
      await db.query(
        "insert into public.application_portals(application_id,portal_id,vault_id) values ($1,$2,$3)",
        [secondApp, portal, vault],
      );
      await db.query("delete from public.applications where id=$1", [
        secondApp,
      ]);
      assert.equal(
        (await db.query("select * from public.portal_accounts")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.application_portals")).rows
          .length,
        1,
      );
      await db.query("delete from public.portal_accounts where id=$1", [
        portal,
      ]);
      assert.equal(
        (await db.query("select * from public.application_portals")).rows
          .length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.credential_vaults")).rows.length,
        1,
      );
      await createPortal(randomUUID(), vault, app);
      await db.query("delete from public.credential_vaults where id=$1", [
        vault,
      ]);
      for (const table of tables)
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      assert.equal(
        (await db.query("select * from public.applications where id=$1", [app]))
          .rows.length,
        1,
      );
      await as("authenticated", bob);
      for (const table of tables)
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          1,
        );
    },
  );
}
