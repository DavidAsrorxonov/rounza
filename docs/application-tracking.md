# Private application tracking

Milestone 4 connects the private workspace to Supabase application records.
After sign-in, `/app` shows application, interview, and offer counts plus recently
updated records. `/app/applications` is the searchable list or board.

## What you can do

- Add an opportunity with a company and role. Optional details include location,
  job posting URL, date applied, job description, and personal notes.
- Use Saved, Applied, Interviewing, Offer, Rejected, or Withdrawn as the broad
  application status. Changing status leaves the recorded applied date alone.
- Open any application to review its complete details, visit its posting, or edit it.
- Search company, role, and location with a case-insensitive literal substring.
  Filter by status; sort by newest, oldest, recent updates, or company.
- Switch between list and board while retaining filters. Results are paginated
  at 24 records per page; the board groups the current page by status. Its counts
  do not imply totals for columns on other pages.
- Delete a record after confirmation. This is permanent. Use Withdrawn or Rejected
  when you want to retain its details instead.

Dates entered as “date applied” remain calendar dates. Automatic added/updated
fields display UTC calendar dates, so the date can differ from your local day
around midnight. Interview scheduling and local-time reminders arrive in step 5.

## Saving and conflicts

Forms save only when submitted. Validation and database errors preserve what you
entered. Invalid links and oversized fields receive errors; descriptions and notes
are plain text. An HTTP(S) posting URL must not include a username or password.

Each record has a database-managed revision. If another tab changes or deletes it,
the older edit/delete is rejected. Keep your draft open, use **Open latest version
in a new tab**, and copy over the edits you want. Reloading the old page discards
its unsaved text and loads the latest saved version. Closing or navigating away
from an unsaved form also discards that draft; there is no local draft autosave.

The public demo remains tab-local, fictional, and separate. Demo records are never
imported into the private account. Real hiring rounds, tasks, contacts, portal
credentials, resumes, and AI are not part of this milestone.

## Database setup

Complete [account setup](accounts-setup.md) first. If step 3 is already configured,
apply `supabase/migrations/202609230001_application_tracking.sql` before starting
this version. It adds the revision column/trigger and the RLS-preserving search
function without removing existing application data.

```sh
npx supabase@2.117.0 db push --dry-run
npx supabase@2.117.0 db push
```

The CLI must already be linked to your Rounza project. No new environment keys are
needed. The hosted migration is an owner setup step; test runs never connect to
your hosted data or apply changes there.

## Acceptance checks with your configured project

1. Sign in and create a record with every field populated. Reload and verify the
   values. Edit the status, notes, and location; verify the detail and overview.
2. Sign out and back in. Confirm the saved application still exists.
3. Search by part of the company, role, and location. Try status filters and both
   views, including a query with no matches. Test pagination with more than 24 rows.
4. Open the same edit page in two tabs. Save the second tab, then submit the first:
   the first must show a conflict and keep its unsaved text.
5. Sign in with another account in a separate browser profile. The first account's
   list entries and detail URLs must be inaccessible.
6. Open Delete application, cancel, and confirm the record remains. Then confirm
   deletion on a disposable record and verify its detail URL is unavailable.

Automated coverage runs the same browser flows on desktop and mobile against a
local provider/REST fixture. The migration, literal search, RLS, and conditional
revision writes are separately tested in embedded Postgres locally and native
Postgres 17 in GitHub Actions. Real provider configuration and hosted persistence
still require the acceptance checks above.
