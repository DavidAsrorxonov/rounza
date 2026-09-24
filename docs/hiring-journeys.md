# Hiring journeys and next actions

Milestone 5 adds private rounds, assessments, preparation tasks, contacts and
schedule history to each application. The public demo stays independent.

## Update an existing installation

Apply all pending migrations before starting this version:

```sh
npx supabase db push
```

Use the project link and setup steps in [accounts setup](accounts-setup.md).
The new migration is `202609240001_hiring_journeys.sql`. For an unlinked project,
apply the migration files in filename order in the Supabase SQL editor. Never
rerun or edit an already applied migration.

Existing applications are retained. One security correction clears job URLs
containing embedded login credentials or backslashes before adding a database
constraint against them. Other fields stay intact. Those links need to be
re-entered without credentials. The migration does not copy discarded credentials
into notes, history, or logs. Meeting links have the same restriction.

No new environment variables are required. Real Google/Supabase service setup is
still necessary for private accounts; the automated tests use disposable fixtures.

## Use a hiring journey

Open an application to see its rounds, tasks and contacts above the opportunity
and notes. Each section pages independently through 20 records, preserving the
other sections' page choices. Repeated titles are allowed.

- **Rounds:** add an Interview, Assessment or Other step with your own title.
  Journey order controls placement; ties use the added time and ID. Planned is
  for a round without a meeting time. Scheduled requires a meeting time. Completed
  and Cancelled retain details and history. Statuses do not change the application's
  broad status or complete preparation tasks automatically.
- **Meetings:** keep the local date/time, IANA time zone, duration, location, link
  and attendees together. Use a named zone such as `Asia/Tokyo` or
  `America/New_York`. The default is UTC; **Use my time zone** fills your browser's
  zone. Saved meetings always display their recorded zone.
- **Deadlines:** any round can have a date-only deadline, including an assessment
  without a meeting. A deadline stays on that calendar date; it does not mean
  midnight UTC or a precise submission cutoff. Put any exact cutoff instructions
  in the notes.
- **Rescheduling:** choose Edit or reschedule. Changes to time, time zone,
  duration, deadline or status append a before/after history entry automatically.
  An optional reason is attached to that change. Initial creation also records a
  history entry; notes-only edits do not. Individual history entries cannot be
  edited or deleted. History pages through 20 entries, newest first.
- **Preparation:** add a general application task or choose Add preparation task
  on a round to link it to that round. Tasks support notes, a date-only due date,
  completion, reopening, editing and deletion. A completed/cancelled round does
  not resolve an unfinished task; decide what remains useful yourself.
- **Contacts:** save a name, role, email, phone and notes for the application.
  These are reference details; the app does not send messages or make calls.

Edits save only when submitted. A failed save preserves the draft. A stale edit
or delete is refused: open the latest record in another tab, copy any draft you
need, then reload to edit the current version. Leaving a form loses unsaved text.
Journey activity also updates the application's Last updated date and revision.

Deleting a round requires confirmation and removes its history, while retaining
its preparation tasks as general application tasks. Deleting an application
removes all its rounds, history, tasks and contacts. Keep a cancelled/closed
record instead when you still need the context.

## Next actions

The overview previews the first five open actions. **Next actions** lists all of
them across active applications, with filters and 20-row pagination:

- **Overdue:** meeting start time has passed, or a date-only deadline precedes today.
- **Today:** meeting starts later today, or the deadline falls on today.
- **Upcoming:** a later meeting or deadline.
- **Unscheduled:** an open task without a date, or a Planned round without a deadline.

A round with a meeting and a deadline produces two distinct actions. Rescheduling
replaces its current action time; the old time is kept only in history. Past
meetings stay overdue until their status is updated.

The overview groups days in UTC. The full list lets you choose an IANA time zone;
that choice and the filter/page live in the URL and survive reload. A date-only
value remains unchanged, while “today” is calculated in the selected zone. The
Temporal polyfill handles clock changes: nonexistent local times are rejected,
and repeated local times require an explicit first/second occurrence. See
[Temporal time-zone disambiguation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html).

Saved, Applied and Interviewing applications contribute actions. Offer, Rejected
and Withdrawn pause reminders and preserve the entire journey. Reopening the
application resumes its unfinished actions. Completed tasks and completed/cancelled
rounds do not appear. These are in-app reminders shown when you visit; email,
calendar sync, push notifications and background reminders are outside this scope.

## Verification

`npm run test:unit` covers validation, ownership-field stripping, daylight-saving
gaps/overlaps and day boundaries. `npm run test:db` applies every migration and
checks RLS, grants, cross-application foreign keys, fixed identities, revision
conflicts, append-only history, rollback behavior, reminder state transitions,
cascades and URL constraints. It uses PGlite locally and native Postgres 17 in CI.

The desktop/mobile Playwright suite checks repeated rounds, assessments, complete
meeting details, rescheduling/history, persistence, task completion/reopening,
contact editing/deletion, closed journeys, failed writes, clock-change validation,
stale forms, account switches, pagination and deletion behavior. The loopback
Auth/REST fixture is test-only and is not a substitute for real database tests.

After configuring hosted Supabase, run the same acceptance flow with two Google
accounts: create a scheduled round, add a linked task/contact, reschedule it,
confirm history and Next actions agree, complete/reopen the task, close/reopen
the application, and confirm the second account cannot see or change the records.
The hosted migration/provider acceptance check requires your configured project.
