# Implementation roadmap

Only milestone 1 is included in this implementation. Later milestones start when
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

## Product scope

The first version is an English-language, personal job-search tool with a public
demo and private accounts. The next-action view is central; the board is a summary
of the full hiring journey. Multiple interview rounds and portal credentials are
planned first-class features.

Email integrations, email notifications, automatic portal login, scraping,
auto-applications, cover letters, interview coaching, subscriptions, and OCR are
outside the initial scope. Deployment can use a Vercel URL before a domain is
purchased. `Rounza` is the chosen name; no domain purchase is implied.
