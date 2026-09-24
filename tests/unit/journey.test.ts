import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import {
  roundInput,
  taskInput,
  contactInput,
} from "../../src/features/journey/model";
import { initialValues } from "../../src/features/journey/fields";
import {
  scheduledInstant,
  localSchedule,
  validTimeZone,
  actionClock,
} from "../../src/features/journey/time";

test("rounds validate scheduling, repeated titles, URLs and strip ownership", () => {
  const input = {
    ...initialValues("round"),
    title: "Technical interview",
    status: "Scheduled",
    scheduled_local: "2026-10-01T09:30",
    time_zone: "Asia/Tokyo",
    user_id: "intruder",
  };
  const parsed = roundInput.parse(input);
  assert.equal(parsed.scheduled_at, "2026-10-01T00:30:00Z");
  assert.equal(
    roundInput.parse({ ...input, time_zone: "asia/tokyo" }).time_zone,
    "Asia/Tokyo",
  );
  assert.equal(parsed.meeting_url, null);
  assert.ok(!("user_id" in parsed));
  for (const invalid of [
    { status: "Planned" },
    { scheduled_local: "" },
    { time_zone: "Bad/Zone" },
    { position: 0 },
    { duration_minutes: 1 },
    { due_on: "2026-02-30" },
    { meeting_url: "https://user:pass@example.com" },
    { meeting_url: "javascript:alert(1)" },
    { title: " " },
  ]) {
    assert.equal(
      roundInput.safeParse({ ...input, ...invalid }).success,
      false,
      JSON.stringify(invalid),
    );
  }
  assert.equal(roundInput.parse(input).title, parsed.title);
});
test("nonexistent times are rejected and repeated clock times require an explicit choice", () => {
  assert.throws(
    () => scheduledInstant("2026-03-08T02:30", "America/New_York", "earlier"),
    /does not exist/,
  );
  assert.throws(
    () => scheduledInstant("2026-03-08T02:30", "America/New_York", "later"),
    /does not exist/,
  );
  assert.throws(
    () => scheduledInstant("2026-11-01T01:30", "America/New_York", "reject"),
    /occurs twice/,
  );
  const first = scheduledInstant(
    "2026-11-01T01:30",
    "America/New_York",
    "earlier",
  );
  const second = scheduledInstant(
    "2026-11-01T01:30",
    "America/New_York",
    "later",
  );
  assert.equal(first, "2026-11-01T05:30:00Z");
  assert.equal(second, "2026-11-01T06:30:00Z");
  assert.equal(localSchedule(second, "America/New_York").occurrence, "later");
  assert.equal(
    localSchedule("2026-10-01T05:30:00Z", "America/New_York").occurrence,
    "reject",
  );
  assert.equal(
    localSchedule(second, "America/New_York").local,
    "2026-11-01T01:30",
  );
  assert.equal(validTimeZone("+09:00"), false);
  assert.equal(validTimeZone("UTC"), true);
});
test("reminder day boundaries follow the selected zone, including 23-hour days", () => {
  assert.deepEqual(
    actionClock("Asia/Tokyo", Temporal.Instant.from("2026-09-24T23:00:00Z")),
    {
      today: "2026-09-25",
      day_end: "2026-09-25T15:00:00Z",
      at_time: "2026-09-24T23:00:00Z",
    },
  );
  assert.equal(
    actionClock(
      "America/New_York",
      Temporal.Instant.from("2026-03-08T05:00:00Z"),
    ).day_end,
    "2026-03-09T04:00:00Z",
  );
});
test("task dates and contact fields are bounded and ownership is never accepted", () => {
  const task = taskInput.parse({
    ...initialValues("task"),
    title: " Prepare ",
    completed: "true",
    round_id: "spoof",
  });
  assert.equal(task.title, "Prepare");
  assert.equal(task.completed, true);
  assert.equal(task.due_on, null);
  assert.ok(!("round_id" in task));
  assert.equal(
    taskInput.safeParse({
      ...initialValues("task"),
      title: "Task",
      due_on: "2026-02-29",
    }).success,
    false,
  );
  assert.equal(
    contactInput.safeParse({
      ...initialValues("contact"),
      name: "Recruiter",
      email: "bad\naddress",
    }).success,
    false,
  );
  assert.equal(
    contactInput.safeParse({
      ...initialValues("contact"),
      name: "a".repeat(161),
    }).success,
    false,
  );
});
