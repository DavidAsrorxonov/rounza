import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function resumeChecks(t, db, as, alice, bob) {
  const a = randomUUID(),
    b = randomUUID();
  await as("authenticated", bob);
  await db.query(
    "insert into public.resumes(id,name,body,source) values ($1,'Bob version','Private Bob resume','pdf')",
    [b],
  );
  await as("authenticated", alice);
  await db.query(
    "insert into public.resumes(id,name,body,source) values ($1,'Alice version','Private Alice resume','paste')",
    [a],
  );
  await t.test(
    "resumes deny anonymous and cross-owner reads, writes, deletes and ownership spoofing",
    async () => {
      await as("anon");
      for (const sql of [
        "select * from public.resumes",
        "delete from public.resumes",
        "truncate public.resumes",
        "insert into public.resumes(name,body,source) values ('x','y','paste')",
        "update public.resumes set name='x'",
      ])
        await assert.rejects(db.query(sql), { code: "42501" });
      await as("authenticated", alice);
      assert.equal(
        (await db.query("select * from public.resumes where id=$1", [b])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "update public.resumes set body='Stolen' where id=$1 returning id",
            [b],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.resumes where id=$1 returning id",
            [b],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into public.resumes(user_id,name,body,source) values ($1,'Spoof','Text','paste')",
          [bob],
        ),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("update public.resumes set user_id=$1 where id=$2", [bob, a]),
        { code: "23514" },
      );
      await assert.rejects(
        db.query("update public.resumes set id=$1 where id=$2", [
          randomUUID(),
          a,
        ]),
        { code: "23514" },
      );
      await assert.rejects(db.query("truncate public.resumes"), {
        code: "42501",
      });
      await assert.rejects(db.query("select public.validate_resume()"), {
        code: "42501",
      });
      await as("authenticated");
      assert.equal(
        (await db.query("select * from public.resumes")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "resume constraints and generated counts enforce valid bounded text",
    async () => {
      await as("authenticated", alice);
      for (const [column, value] of [
        ["name", " "],
        ["name", "\t"],
        ["name", " padded "],
        ["name", "x".repeat(161)],
        ["body", "\n\t"],
        ["body", "x".repeat(100001)],
        ["source", "html"],
      ])
        await assert.rejects(
          db.query(`update public.resumes set ${column}=$1 where id=$2`, [
            value,
            a,
          ]),
          { code: "23514" },
        );
      const before = (
        await db.query("select * from public.resumes where id=$1", [a])
      ).rows[0];
      assert.equal(before.character_count, before.body.length);
      await assert.rejects(
        db.query("update public.resumes set character_count=1 where id=$1", [
          a,
        ]),
        { code: "428C9" },
      );
      await db.query(
        "update public.resumes set body='Unicode 🦉',revision=999,created_at='2000-01-01',updated_at='2000-01-01' where id=$1 and revision=$2",
        [a, before.revision],
      );
      const after = (
        await db.query("select * from public.resumes where id=$1", [a])
      ).rows[0];
      assert.equal(after.revision, before.revision + 1);
      assert.equal(after.character_count, 9);
      assert.equal(String(after.created_at), String(before.created_at));
    },
  );
  await t.test(
    "resume revisions reject stale saves and deletes, while confirmed deletion preserves other users",
    async () => {
      await as("authenticated", alice);
      assert.equal(
        (
          await db.query(
            "update public.resumes set body='Old' where id=$1 and revision=1 returning id",
            [a],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.resumes where id=$1 and revision=1 returning id",
            [a],
          )
        ).rows.length,
        0,
      );
      const current = (
        await db.query("select revision from public.resumes where id=$1", [a])
      ).rows[0].revision;
      assert.equal(
        (
          await db.query(
            "delete from public.resumes where id=$1 and revision=$2 returning id",
            [a, current],
          )
        ).rows.length,
        1,
      );
      await as("authenticated", bob);
      assert.equal(
        (await db.query("select * from public.resumes")).rows.length,
        1,
      );
    },
  );
}
