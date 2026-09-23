import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationInput,
  applicationsHref,
  displayDate,
  parseFilters,
  recordIdentity,
  safeJobUrl,
} from "../../src/features/applications/model";

const fields = {
  company: "  Acme  ",
  role: "Designer",
  status: "Saved",
  location: "",
  job_url: "",
  applied_on: "",
  description: "",
  notes: "",
};
test("application input trims essentials, normalizes blanks, and excludes injected ownership", () => {
  const parsed = applicationInput.parse({
    ...fields,
    user_id: "someone-else",
    revision: 100,
  });
  assert.equal(parsed.company, "Acme");
  assert.equal(parsed.job_url, null);
  assert.equal(parsed.applied_on, null);
  assert.ok(!("user_id" in parsed));
  assert.ok(!("revision" in parsed));
});
test("invalid required fields, dates, status, large inputs, and unsafe URLs are rejected", () => {
  for (const invalid of [
    { company: " " },
    { role: "" },
    { company: "a".repeat(161) },
    { notes: "n".repeat(20001) },
    { description: "d".repeat(50001) },
    { status: "Hired" },
    { applied_on: "2026-02-31" },
    { job_url: "javascript:alert(1)" },
    { job_url: "https://user:password@example.com" },
    { job_url: "https://example.com/a b" },
  ]) {
    assert.equal(
      applicationInput.safeParse({ ...fields, ...invalid }).success,
      false,
    );
  }
  assert.equal(
    applicationInput.safeParse({
      ...fields,
      applied_on: "2028-02-29",
      job_url: "https://example.com/jobs?id=123",
    }).success,
    true,
  );
  assert.equal(safeJobUrl("data:text/html,hello"), null);
  assert.equal(
    recordIdentity.safeParse({ id: "invalid", revision: 0 }).success,
    false,
  );
});
test("filters are bounded and encoded, preserve view/sort, and reset pagination explicitly", () => {
  assert.deepEqual(
    parseFilters({
      page: "-1",
      status: "admin",
      sort: "__proto__",
      q: ["one", "two"],
    }),
    { q: "", status: "All", sort: "newest", view: "list", page: 1 },
  );
  const filters = parseFilters({
    page: "2",
    status: "Interviewing",
    view: "board",
    sort: "company",
    q: "Acme & Sons",
  });
  assert.equal(
    applicationsHref(filters, { page: 1 }),
    "/app/applications?q=Acme+%26+Sons&status=Interviewing&sort=company&view=board",
  );
  assert.equal(
    parseFilters({ q: "a".repeat(500), page: "99999999" }).q.length,
    120,
  );
  assert.equal(displayDate("2026-09-23"), "Sep 23, 2026");
});
