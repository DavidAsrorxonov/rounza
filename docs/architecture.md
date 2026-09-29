# Architecture

## Implemented foundation, accounts, journeys, and vault

- One Next.js App Router application, suitable for the planned Vercel deployment.
- Route composition in `src/app`, reusable primitives in `src/components/ui`, and
  shared utilities in `src/lib`, and the isolated demo in `src/features/demo`.
- Server Components by default; add client boundaries for actual browser state or
  interaction. Demo screens are client components behind server-rendered route
  and metadata wrappers. The landing page remains a Server Component.
- Tailwind CSS 4 through PostCSS, shared CSS tokens, and the `@/*` source alias.
- Strict TypeScript, Next's ESLint rules, consistent formatting, and browser tests
  against the production server. CI and local verification use the same commands.
- Supabase handles private accounts and database requests when configured. Employer portal
  data is encrypted in the browser. Remote read-only MCP is available when OAuth and hosting are configured.

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
code and redirects to `/app` or a validated pending consent request on the configured `SITE_URL`.
User-supplied return URLs, provider error text, and forwarded hosts never determine
that destination. Sign-out is a POST Server Action scoped to this browser and
invalidates Next's route cache. Next's Server Action origin checks remain enabled.

`src/proxy.ts` refreshes sessions only for account/auth routes and marks responses
private/no-store. Every private data accessor calls `requireAccount`, which uses
Supabase `getUser` and verified claims, rejecting delegated OAuth clients as website sessions. React `cache` only
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
Hiring rounds, preparation tasks, contacts and schedule history accompany each
application. Portal accounts use separate encrypted tables; no plaintext credential
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

## Private hiring journeys

`features/journey` owns validated Server Actions, authenticated reads, forms and
views for rounds, tasks, contacts and Next actions. Each child has its own revision
and a composite foreign key to `(application_id, user_id)`. Task-to-round links
also include the application and owner, preventing cross-application links even
through direct PostgREST calls. A trigger rejects changes to record identity,
forces revision increments and timestamps, and validates database time zones.
Explicit grants and per-operation RLS deny anonymous access and account transfer.

A narrowly scoped SECURITY DEFINER trigger appends before/after schedule history
inside the round's transaction. Clients have SELECT-only access to their own
history. Round deletion cascades to history but sets task round links to null;
application/account deletion cascades through the entire journey. Child writes
also touch the application, updating recency and invalidating old edit revisions.

A SECURITY INVOKER `next_actions` function unions open tasks, scheduled meetings,
round deadlines and unscheduled rounds, explicitly checking ownership and active
application status in addition to RLS. Filtering/sorting happens in Postgres before
pagination, so reminders are not limited to the first application page. The server
supplies the current instant and day boundaries for the selected IANA zone.
Meeting instants use timestamptz plus their named zone; date-only deadlines use date.
The Temporal polyfill rejects skipped wall times and distinguishes repeated ones.

See [hiring journeys](hiring-journeys.md) for reminder semantics, migration details
and checks. The URL constraint is enforced in both application validation and SQL.

## Employer portal vault

`features/vault` owns a browser-only cryptography module and short-lived Argon2id
Web Worker, controlled credential forms, encrypted Server Actions and reads.
The server-rendered page supplies wrapped keys and metadata; sensitive forms
appear only after hydration and submit exclusively to client callbacks. They have
no named input fields or Server Action bindings. No browser Supabase client or
change to the HttpOnly authentication cookies is required.

A random AES-256-GCM data key encrypts every portal field. Each operation has a
fresh 96-bit nonce, a 128-bit authentication tag, and additional authenticated data
binding the owner, vault, format and record/purpose. Argon2id v1.3 derives a wrapping
key from a separate passphrase using 64 MiB, three iterations, four lanes and a
random 128-bit salt. A separate random 256-bit recovery secret wraps the same data
key. The server stores both envelopes and exact versioned parameters, never the
passphrase, recovery secret, plaintext data key or decrypted portal fields.

The active key and decrypted page are held only in the mounted vault component.
Navigation, hidden tabs, page lifecycle events, sign-out/lock broadcasts and five
minutes of inactivity clear state and terminate derivation. Identity and vault
revision are rechecked before unlock completes and before sensitive operations,
on focus, and periodically. Generation checks prevent late asynchronous work
from reopening a locked page. Reveal expires after 15 seconds; the system
clipboard is independent of locking.

`credential_vaults`, `portal_accounts` and `application_portals` have explicit
privileges, RLS and composite ownership foreign keys. Invoker RPCs provide atomic
account-plus-link creation and filtered pagination. Immutable identities and
forced revisions reject stale edits/deletes. Deleting an application removes only
links; deleting a portal or resetting a vault cascades its links. No plaintext
fields are needed to show a linked-account count on an application page.

See [the employer vault guide](employer-vault.md) for exact setup, recovery,
cryptographic boundaries, limitations and hosted verification. Credentials must
never enter future AI requests, logs, analytics or session-replay tools.

## Resume library

`features/resumes` owns local import, reviewed text forms, server operations and
reads. `/app/resumes` lists paginated summaries; full text is fetched only for
an owned detail/edit page. `resumes` stores name, reviewed text, source category,
revision and dates, plus a database-generated character count. Original files
and filenames have no storage bucket or upload endpoint. A filename may seed the
editable name; only its reviewed final value is persisted.

PDF.js reads byte data using a bundled worker. DOCX extraction runs Mammoth's
browser entry in a separate worker after fflate bounds/repackages XML data.
Neither converter renders document HTML or opens document links. Import buffers,
previews and unsaved drafts stay in memory. Limits and a 30-second cancellation
boundary prevent indefinite work; navigation and replacement cancel pending imports.
The text preview is separate from the active draft and must be explicitly adopted.
Saving requires a reviewed checkbox, which clears on any text change.

Server Actions verify the current owner, allowed fields, review acknowledgement,
UUID and revision; RLS and immutable-identity/revision triggers apply to direct
API clients too. Failures preserve controlled form values. Resume text is ordinary
private account data, not part of the encrypted credential vault. Future AI code
can use this reviewed text only within the later authorized analysis flow.
See [the resume library guide](resume-library.md) for limits, setup and verification.

## AI connections and MCP

`features/connections` owns browser consent and grant management. `lib/mcp` provides
JWT authentication, six read-only tools and per-request SDK servers. The Next `/mcp`
route uses stateless Streamable HTTP with JSON responses. Public protected-resource
metadata points to the existing Supabase OAuth issuer. The operator enables DCR,
PKCE, asymmetric signing and the custom token hook; Rounza does not implement its
own authorization/token server. No model API is called and no model key is stored.

`ai_connections` stores owner/client identity, application/resume grants, activation,
revocation and revisions. Restrictive RLS policies AND these permissions with existing
ownership policies. Delegated writes and vault/profile/grant reads are denied.
Private SQL helpers check live Auth sessions and activation cutoffs. The token hook
sets the resource audience for OAuth tokens only. MCP data access uses a publishable
client with that verified bearer token, never a service-role client. See the
[AI connections guide](ai-connections.md) for setup and security boundaries.

## Planned boundaries

Agent mutations begin with proposals in step 9, approved in the Rounza website.
Proposals retain source references and base revisions; applying a batch is atomic
and idempotent. Application packages preserve user-confirmed submitted snapshots;
shared context contains approved career facts and summaries, not conversation sync.
Resume/letter suggestions use supplied evidence and do not invent qualifications.

Email integration is separate, later work. Manual imports precede background sync;
mail stays outside MCP until human review. Gmail verification does not block core
release. Native integration tokens require server encryption separate from the
browser-only credential vault. Embedded BYOK chat and autonomous background AI
processing are deferred beyond this roadmap.
