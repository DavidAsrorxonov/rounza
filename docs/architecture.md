# Architecture

## Foundation in this milestone

- One Next.js App Router application, suitable for the planned Vercel deployment.
- Route composition in `src/app`, reusable primitives in `src/components/ui`, and
  shared utilities in `src/lib`. Add feature folders when features need them.
- Server Components by default; add client boundaries for actual browser state or
  interaction. The holding page uses a local shadcn Button primitive.
- Tailwind CSS 4 through PostCSS, shared CSS tokens, and the `@/*` source alias.
- Strict TypeScript, Next's ESLint rules, consistent formatting, and browser tests
  against the production server. CI and local verification use the same commands.
- No database, authentication provider, AI client, credential handling, or external
  runtime requests yet. No deployment has been configured.

ESLint is pinned to 9.39.5 because the React plugin bundled with Next.js 16.3.5's
ESLint config fails under ESLint 10. Revisit the pin when that configuration
supports the new rule API; do not force incompatible peer dependencies.

## Planned boundaries

These are design constraints for later milestones, not implemented guarantees.

### Accounts and data

Supabase will provide Google authentication and Postgres. Every private record
must belong to a user and be isolated with row-level security as well as server
ownership checks. The public demo will use fictional data isolated from accounts.
Database migrations arrive with the accounts milestone.

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
