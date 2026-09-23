# Architecture

## Implemented foundation, demo, accounts, and application tracking

- One Next.js App Router application, suitable for the planned Vercel deployment.
- Route composition in `src/app`, reusable primitives in `src/components/ui`, and
  shared utilities in `src/lib`, and the isolated demo in `src/features/demo`.
- Server Components by default; add client boundaries for actual browser state or
  interaction. Demo screens are client components behind server-rendered route
  and metadata wrappers. The landing page remains a Server Component.
- Tailwind CSS 4 through PostCSS, shared CSS tokens, and the `@/*` source alias.
- Strict TypeScript, Next's ESLint rules, consistent formatting, and browser tests
  against the production server. CI and local verification use the same commands.
- Supabase handles private accounts and database requests when configured. No live AI
  or employer-credential handling is implemented. No deployment is configured.

ESLint is pinned to 9.39.5 because the React plugin bundled with Next.js 16.3.5's
ESLint config fails under ESLint 10. Revisit the pin when that configuration
supports the new rule API; do not force incompatible peer dependencies.

### Demo state and behavior

`/demo` is the next-actions view, `/demo/applications` provides search, status
filters, and list/board views, and `/demo/applications/[id]` shows a full journey.
Dialogs and detail tabs use Radix primitives for focus management and keyboard
navigation. The board supports horizontal scrolling, including keyboard focus,
with application changes made explicitly in the detail view.

`useSyncExternalStore` shares one immutable snapshot across screens. The initial
server snapshot is a loading state, so browser-local dates and storage do not
create hydration mismatches. `sessionStorage` uses the namespaced key
`rounza.demo.v1`; Zod validates shape, version, string bounds, and collections on
read. Corrupt data gets a new seed. Blocked or full storage falls back to memory
with a visible explanation. Reset replaces only demo data and restores current
relative sample dates. There are no account, database, or AI requests.

Demo actions include adding fictional applications, changing broad status,
checking/reopening tasks, saving notes, scheduling/rescheduling existing rounds,
and completing rounds. Closing an application excludes its tasks and rounds from
upcoming views, while preserving history. A completed round does not imply an
offer or complete its preparation tasks. Reschedule history retains old/new times.

Appointments use browser-local date/time strings and task deadlines use date-only
strings. All screens label the device time zone. This is a demo convention;
production timezone storage and scheduling rules belong to the hiring milestone.
The Northstar portal card has hard-coded fake credentials and no credential input
or login action. Its AI preview is labeled, precomputed, and based on fictional
inputs. These examples provide no vault or live-AI security guarantee.

## Accounts and database

`/login` starts Google OAuth through a Server Action. Supabase SSR manages PKCE and
HttpOnly, SameSite=Lax cookies (Secure with HTTPS). `/auth/callback` exchanges the
code and redirects to a fixed `/app` destination on the configured `SITE_URL`.
User-supplied return URLs, provider error text, and forwarded hosts never determine
that destination. Sign-out is a POST Server Action scoped to this browser and
invalidates Next's route cache. Next's Server Action origin checks remain enabled.

`src/proxy.ts` refreshes sessions only for account/auth routes and marks responses
private/no-store. Every private data accessor calls `requireAccount`, which uses
Supabase `getUser`, not an unverified session-cookie user. React `cache` only
memoizes the account within a server render; private pages are dynamic and never
use a shared data cache. The public landing and demo make no Supabase requests.

The app uses a publishable key with the user's session, never a service-role key.
Private reads explicitly filter the verified user ID. SQL RLS also scopes every
application operation to `auth.uid()`; an update cannot transfer ownership.
Anonymous roles have no table privileges. Profiles are readable only by their
owner and permit updates to display name only. A narrowly scoped SECURITY DEFINER
trigger creates profiles; its search path is empty and direct client execution is
revoked. Metadata supplies display text, never authorization. Account deletion
cascades profiles/applications. There is no account-deletion UI in this milestone.

Versioned migrations live in `supabase/migrations`. `profiles` contains no duplicate
email or provider tokens. `applications` stores private records for the implemented create/edit/detail/list/board
flows. The account overview reads counts and recent records.
Interview/task/contact schemas arrive with milestone 5; no plaintext credential
columns exist. A failed private read shows an error, never demo fallback data.

All SDK use is server-side in this milestone, so HttpOnly session cookies are
intentional. Adding a browser Supabase client later would require revisiting that
choice. Missing/invalid configuration disables sign-in while keeping the demo
available. See [setup and verification](accounts-setup.md) and Supabase's
[SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

The automated OAuth fixture tests the real SDK over local HTTP; database tests
apply the actual migration in Postgres. Neither verifies a hosted provider's
configuration. The live sign-in checklist belongs to service setup.

### Private application tracking

`src/features/applications` is independent of the demo store and sample records.
Server Components read account-scoped data for the overview, listing, and detail
pages. Client forms use validated Server Actions for writes. Every operation
checks the current account; client input cannot set ownership, timestamps, or
revision. Updates/deletes filter on owner, ID, and the revision seen when editing
began. A database trigger increments revision, preventing stale forms from silently
replacing newer data. Failed submissions preserve controlled field values.

Search uses the SECURITY INVOKER `search_applications` function, retaining RLS
and explicitly matching `auth.uid()`. Bound text is a case-insensitive literal
substring of company, role, and location; punctuation is not a filter expression
or SQL wildcard. The caller also filters the verified user ID, selects summary
columns, applies stable sorting with an ID tie-breaker, and requests 24 rows plus
an exact count. Pagination is shared by the list and board; board column counts
refer to the current page. Query parameters hold search/filter/view/sort/page state.
Descriptions and notes are loaded only for detail/edit views, not every list row.

Job URLs are restricted to HTTP(S) without embedded credentials, and validated
again before rendering external links. Descriptions/notes render as text. Applied
on is a date-only value; created/updated timestamps are stored with a time zone
and displayed as UTC calendar dates for consistent server rendering. Application
status does not manufacture an applied date or imply any interview outcome.

See [application tracking](application-tracking.md) for user behavior, migration,
and the acceptance checks. The local Auth/REST fixture supports application
requests solely for tests; database authorization and search run separately
against the actual migration in Postgres.

## Planned boundaries

These are design constraints for later milestones, not implemented guarantees.

### Applications and hiring journeys

An application's broad status (Saved, Applied, Interviewing, Offer, Rejected,
Withdrawn) is separate from individual hiring steps. Steps must support repeated
interviews, assessments, cancellation, rescheduling, and history. Timezone-aware
appointments and date-only deadlines are different data types.

### Portal credentials

Portal links and accounts can be shared across a user's applications. The planned
vault encrypts credentials in the browser with a random AES-256-GCM data key.
The key is wrapped using a key derived from a separate vault passphrase with
Argon2id, with a separate recovery-key mechanism. The server stores ciphertext,
wrapped keys, and versioned parameters. Unlocked keys stay in memory.

Credentials must never enter AI requests, application logs, or analytics.
Account password resets cannot decrypt the vault. Losing both vault passphrase
and recovery key means losing access to the encrypted credentials. This design
does not protect against a compromised browser or malicious frontend code;
cryptographic parameters and recovery flows require dedicated review and tests.

### Resume and AI processing

Resume text will be extracted locally from text-based PDF, DOCX, or pasted text,
reviewed by the user, and saved as text. Scanned documents and legacy DOC files
are outside the initial scope.

OpenAI requests will originate on the server. The proposed limits are five AI
requests per user per day and a configurable $5 application-wide monthly budget,
with atomic reservations and usage reconciliation. Live AI requires login;
the public demo uses labeled precomputed examples.

Resume suggestions must be grounded in supplied information. Pasted recruiter
messages go through a local credential review before transmission; proposed
changes are reviewed by the user before application. Schema validation,
ownership checks, idempotency, and stale-proposal checks belong on the server.
No keys or model identifiers are wired in during the foundation milestone.
