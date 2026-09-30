# Implementation roadmap

Milestones 1–9 are included in this implementation. Later milestones start when
requested. Each milestone should deliver a working result and relevant checks.

| Milestone                          | Result                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Project foundation              | Next.js, TypeScript, Tailwind, shadcn/ui, source structure, environment examples, reproducible installation, and GitHub quality/build/test checks |
| 2. Design and interactive demo     | Responsive navigation, next-actions dashboard, application board/list and detail layouts, fictional data, and a resettable isolated demo          |
| 3. Accounts and database           | Supabase, Google sign-in, sessions, migrations, ownership, and row-level isolation                                                                |
| 4. Core application tracking       | Create, edit, search, filter, and organize applications with company, role, job description, URL, dates, location, and notes                      |
| 5. Hiring rounds and next actions  | Custom/repeated interviews, assessments, tasks, contacts, meetings, scheduling history, and in-app reminders                                      |
| 6. Employer portals and vault      | Reusable portal accounts, encrypted credentials, separate vault unlock, recovery, reveal/copy, and automatic locking                              |
| 7. Resume library                  | Reviewed text from PDF/DOCX/paste, named resumes, import errors, editing, and deletion                                                            |
| 8. Connect your AI                 | Controlled read-only MCP access, consent, connection permissions and revocation                                                                   |
| 9. Review inbox                    | Assistant proposals with in-Rounza approval, atomic application and stale/duplicate protection                                                    |
| 10. Application packages           | Job-specific resumes, letters and prep with immutable user-confirmed submitted snapshots                                                          |
| 11. Shared career context          | User-confirmed facts, preferences and structured application briefs shared across assistants                                                      |
| 12. Resume and letter assistance   | Evidence-based tailoring and comparisons using permitted context                                                                                  |
| 13. Interview assistance           | Preparation, debriefs and proposed next tasks                                                                                                     |
| 14. Ready-made workflows           | Repeatable assistant workflows and reviewed recruiter updates                                                                                     |
| 15. Exports                        | PDF/DOCX, printable preparation and calendar downloads                                                                                            |
| 16. Compatibility and core release | Grok/Gemini compatibility, hosted checks, accessibility, mobile and security review                                                               |
| 17. Native email import            | Separate Gmail/Outlook authorization and manual read-only message import                                                                          |
| 18. Optional email background sync | Selected folders/labels, reliable incremental sync and reviewed candidates                                                                        |

## Milestone 1 acceptance

- A fresh clone installs with `npm ci` on the supported Node version.
- The app starts locally and builds without external service credentials.
- Formatting, lint, TypeScript, production build, and browser smoke tests pass.
- The environment example is committed; secrets, dependencies, build output, and
  browser reports are ignored.
- The initial repository is published to GitHub with CI configured.

## Milestone 2 acceptance

- The public demo has a responsive dashboard, list/board, and application details.
- Ten fictional applications include multiple interviews, assessments, preparation
  tasks, and both active and closed journeys.
- Demo edits persist on reload in their tab, are isolated from independent tabs,
  and can be reset to the original sample after confirmation.
- Tasks, status changes, notes, and rescheduling remain consistent across views.
- Empty searches, missing applications, and invalid/unavailable storage are handled.
- AI and portal credentials are labeled examples with no live external requests.
- Desktop and mobile browser tests cover the core demo flows and existing routes.

## Milestone 3 acceptance

- Configured accounts use Google OAuth with PKCE, cookie sessions, refresh, and sign-out.
- `/app` requires a server-verified identity; private queries additionally filter ownership.
- Migrations create profiles and applications with explicit grants and per-user RLS.
- Profile bootstrap, cross-account isolation, anonymous denial, ownership spoofing,
  and cascading account cleanup have automated database tests.
- Public demo behavior is independent of account configuration and authentication.
- Missing setup, rejected/expired sign-in, and private database failures have usable states.
- Setup instructions cover Supabase, migrations, Google, and both callback URLs.
- A live provider acceptance check remains necessary after the owner configures services.

## Milestone 4 acceptance

- Signed-in users can create, view, edit, and permanently delete their own applications.
- Records include company, role, status, location, job URL, date applied, description,
  notes, and automatic added/updated dates.
- Company/role/location search, status filtering, sorting, and list/board views use
  database queries and URL state; pagination covers the full result set.
- The overview shows live counts and recently updated applications.
- Server Actions validate every submitted field and derive ownership from the
  verified account. Missing and other users' records have the same not-found result.
- Revision checks reject stale edits/deletes, and failed saves retain form contents.
- Deletion requires an explicit confirmation; empty, loading, invalid, and failed
  states remain usable on desktop and mobile.
- Automated checks cover record persistence, account changes, pagination, search,
  unsafe URLs, conflict handling, and the new SQL migration.

## Milestone 5 acceptance

- Applications support custom/repeated Interview, Assessment and Other rounds,
  independent statuses, ordering, meeting details and date-only deadlines.
- Named time zones and daylight-saving gaps/overlaps are handled explicitly.
- Initial schedules and every time/zone/duration/deadline/status change create
  immutable before/after history in the same database transaction.
- General and round-linked tasks can be edited, completed, reopened and deleted;
  application contacts retain recruiter/interviewer details.
- The overview and paginated Next actions list surface overdue, today, upcoming
  and unscheduled items across all active applications; reschedules and closed
  journeys update reminders consistently.
- Owner checks, RLS, composite foreign keys, fixed identities and revision checks
  protect reads/writes and stale forms. Confirmed deletion has documented cascades.
- Unit, database and desktop/mobile browser checks cover these behaviors.
- The migration/setup guide includes the hosted acceptance flow and notes the
  correction for credential-bearing URLs saved by older direct API clients.

## Milestone 6 acceptance

- Reusable portal accounts link to multiple owned applications. Deleting an
  application removes its links while preserving the shared account.
- Names, URLs, usernames, passwords and notes are encrypted in the browser with
  a random AES-256-GCM key; only ciphertext, wrapped keys and metadata are stored.
- A separate Argon2id-derived vault passphrase and a randomly generated recovery
  key each unlock the data key. Recovery must be saved before setup is committed.
- Recovery and passphrase changes replace both unlock envelopes without losing
  accounts. Reset requires confirmation and preserves job applications.
- Reveal/copy are explicit. Keys stay in memory; inactivity, tab hiding, navigation
  and sign-out lock the vault and clear unsaved credential forms.
- Versioned formats, authenticated record context, RLS, composite owner foreign
  keys and optimistic revisions protect records and reject stale writes.
- Cryptography, SQL isolation and desktop/mobile browser tests cover persistence,
  recovery, shared accounts, locking, damaged records and plaintext boundaries.
- The vault guide documents setup, recovery limitations, threat boundaries and
  the hosted acceptance checklist. An independent security audit is not implied.

## Milestone 7 acceptance

- Signed-in users can keep multiple named resume versions, view/edit their text,
  and permanently delete a version after confirmation.
- PDF and DOCX files are parsed locally with bounded inputs and cancellable workers.
  Original files are never uploaded or stored. Paste remains available without import.
- Extracted text appears in a preview and requires explicit adoption before it
  replaces a draft. All text must be reviewed and confirmed before saving.
- Empty, corrupt, unsupported, scanned, protected, oversized and timed-out imports
  show actionable errors and preserve existing drafts. Partial extraction warns
  about missing content and layout/reading-order limits.
- Private records enforce ownership, RLS, immutable identity, bounded fields,
  generated character counts, and revisions for stale edit/delete protection.
- The library paginates summaries without loading full resume text. Account changes
  cannot save a draft into a different account.
- Unit, database and desktop/mobile browser tests cover imports and CRUD flows.
  Setup documentation includes the new migration and hosted acceptance checklist.

## Milestone 8 acceptance

- ChatGPT/Claude connect through authenticated remote MCP and explicit Rounza consent.
- Users choose selected/all applications and independent none/selected/all resume access.
- Six read-only tools use bounded, paginated reads with source links and stored revisions.
- RLS enforces current grants and live OAuth sessions; direct APIs cannot bypass write or vault restrictions.
- Normal browser sessions manage permissions; reductions and revocation affect subsequent reads.
- Reconnection cannot reactivate old tokens. Permission edits reject stale revisions.
- Local protocol, unit, database and browser tests are distinct from real hosted assistant acceptance.
- See [AI connection setup](ai-connections.md) for OAuth, deployment and live checks.

## Milestone 9 acceptance

- Proposal access is separately opt-in; existing connections remain read-only.
- Assistants stage bounded batches of application, round, task, contact and resume creates/updates.
- The inbox shows client attribution, explanations, source revisions and before/after values.
- Only the owning website user can approve or reject; approval includes explicit text review.
- Source and parent revisions, current grants, OAuth sessions and activation cutoffs are rechecked.
- Applying a batch, its revisions and schedule history is atomic; any failure rolls back all writes.
- Idempotency keys, immutable payloads and stable record IDs protect retries and duplicate decisions.
- Proposal history stays private; assistant status reads never expose stored snapshots.
- Database, protocol and desktop/mobile tests cover the review flow and authorization boundaries.
- See [review inbox setup and contract](review-inbox.md) for migration and hosted acceptance.

## Product scope and later milestones

The personal job tracker and public demo retain milestones 1–7. Users connect their
own assistants; Rounza does not fund model requests, store model keys or provide
embedded BYOK chat in this roadmap. Portal credentials remain outside all AI access.

Step 9 provides proposals, never direct autonomous edits. Users approve proposals
inside Rounza, with source records, revisions, idempotency and atomic batch application.
Steps 10–11 add application packages and approved shared context; submitted copies
survive source-library edits/deletion, and chat transcripts are not synchronized.
Steps 12–14 provide evidence-based assistance and workflows without inventing career
facts or authoritative hiring scores. Step 15 starts with one accessible document
template and one-way calendar downloads. Broader client support and the core release
precede native email integration, so mailbox verification does not block core release.

Gmail/Outlook integrations in steps 17–18 are separate read-only authorizations.
Manual import comes first; opt-in folder/label background sync produces reviewable
candidates. No sending, shared mailboxes, attachment ingestion, autonomous model calls,
or automatic application edits. Unreviewed mail is not exposed through MCP.

Automatic portal login, scraping, auto-applications, OCR and two-way calendar sync
remain outside scope. The purchased domain is rounza.app; deployment and live
assistant validation require the setup steps documented separately.
