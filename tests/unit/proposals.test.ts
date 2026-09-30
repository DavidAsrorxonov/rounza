import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { proposalInput, recordHref } from "../../src/features/proposals/model";
const base = () => ({
  idempotency_key: randomUUID(),
  title: "Requested edits",
  summary: "Based on the user's notes",
  changes: [
    {
      entity: "application",
      action: "update",
      record_id: randomUUID(),
      expected_revision: 3,
      data: { notes: "Updated notes" },
    },
  ],
});
test("proposal schemas keep patches bounded and reject unknown fields, actions and identities", () => {
  assert.equal(proposalInput.safeParse(base()).success, true);
  for (const bad of [
    { ...base(), idempotency_key: "bad" },
    { ...base(), changes: [] },
    { ...base(), changes: Array.from({ length: 11 }, () => base().changes[0]) },
    { ...base(), changes: [{ ...base().changes[0], expected_revision: null }] },
    { ...base(), changes: [{ ...base().changes[0], action: "delete" }] },
    { ...base(), changes: [{ ...base().changes[0], entity: "portal" }] },
    {
      ...base(),
      changes: [{ ...base().changes[0], data: { user_id: randomUUID() } }],
    },
    {
      ...base(),
      changes: [
        {
          ...base().changes[0],
          data: { job_url: "https://user:password@example.com" },
        },
      ],
    },
    {
      ...base(),
      changes: [{ ...base().changes[0], data: { notes: "x".repeat(20001) } }],
    },
    { ...base(), changes: [{ ...base().changes[0], data: {} }] },
    {
      ...base(),
      changes: [
        {
          ...base().changes[0],
          action: "create",
          expected_revision: null,
          data: { notes: "No company" },
        },
      ],
    },
  ])
    assert.equal(proposalInput.safeParse(bad).success, false);
  const p = base();
  p.changes.push(p.changes[0]);
  assert.equal(proposalInput.safeParse(p).success, false);
});
test("new journey batches use stable IDs and resume sources cannot be fabricated", () => {
  const app = randomUUID();
  const p = proposalInput.parse({
    ...base(),
    changes: [
      {
        entity: "application",
        action: "create",
        record_id: app,
        data: { company: "Example", role: "Engineer" },
      },
      {
        entity: "round",
        action: "create",
        record_id: randomUUID(),
        application_id: app,
        data: {
          title: "Interview",
          status: "Scheduled",
          scheduled_at: "2026-10-01T09:00:00+09:00",
          time_zone: "Asia/Tokyo",
        },
      },
    ],
  });
  assert.equal(p.changes[0].expected_revision, null);
  assert.equal(recordHref(p.changes[0]), `/app/applications/${app}`);
  assert.equal(
    proposalInput.safeParse({
      ...base(),
      changes: [
        {
          entity: "resume",
          action: "create",
          record_id: randomUUID(),
          data: { name: "CV", body: "Reviewed text", source: "pdf" },
        },
      ],
    }).success,
    false,
  );
});
