# Implementation roadmap

Milestones 1–4 are included in this implementation. Later milestones start when
requested. Each milestone should deliver a working result and relevant checks.

| Milestone                         | Result                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Project foundation             | Next.js, TypeScript, Tailwind, shadcn/ui, source structure, environment examples, reproducible installation, and GitHub quality/build/test checks |
| 2. Design and interactive demo    | Responsive navigation, next-actions dashboard, application board/list and detail layouts, fictional data, and a resettable isolated demo          |
| 3. Accounts and database          | Supabase, Google sign-in, sessions, migrations, ownership, and row-level isolation                                                                |
| 4. Core application tracking      | Create, edit, search, filter, and organize applications with company, role, job description, URL, dates, location, and notes                      |
| 5. Hiring rounds and next actions | Custom/repeated interviews, assessments, tasks, contacts, meetings, scheduling history, and in-app reminders                                      |
| 6. Employer portals and vault     | Reusable portal accounts, encrypted credentials, separate vault unlock, recovery, reveal/copy, and automatic locking                              |
| 7. Resume library                 | Reviewed text from PDF/DOCX/paste, named resumes, import errors, editing, and deletion                                                            |
| 8. AI and resume analysis         | Server-side OpenAI integration, schema validation, quotas and budget accounting, grounded comparisons and bullet rewrites                         |
| 9. Recruiter updates              | Local credential review, message extraction, reviewable proposals, confirmation, deduplication, and rescheduling                                  |
| 10. Integration and release       | Full journey, accessibility, mobile, and security checks; production configuration; Vercel deployment; release documentation                      |

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

## Product scope

The first version is an English-language, personal job-search tool with a public
demo and private accounts. The next-action view is central; the board is a summary
of the full hiring journey. Multiple interview rounds and portal credentials are
planned first-class features.

Email integrations, email notifications, automatic portal login, scraping,
auto-applications, cover letters, interview coaching, subscriptions, and OCR are
outside the initial scope. Deployment can use a Vercel URL before a domain is
purchased. `Rounza` is the chosen name; no domain purchase is implied.
