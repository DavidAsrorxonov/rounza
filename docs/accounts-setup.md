# Set up Rounza accounts

Milestone 3 supplies the integration and migration. A real Supabase project and
Google OAuth client must be configured before real sign-in works. The public
landing page and fictional demo work without either service. Nothing is deployed
by these steps.

## 1. Create a Supabase project

Create a project in your own [Supabase dashboard](https://supabase.com/dashboard).
Record the project URL and **publishable key** from its connection/API settings.
Use a key beginning `sb_publishable_`, not a secret, service-role, or legacy JWT key.

Copy `.env.example` to `.env.local`, which Git ignores:

```dotenv
SITE_URL=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

All account operations use a server client and HttpOnly cookies, so these variables
do not need a `NEXT_PUBLIC_` prefix. The unused public-prefixed placeholders from
milestone 2 have been replaced. `SITE_URL` is the canonical origin, without a path,
query, or credentials. Remote origins require HTTPS; local HTTP is supported.
Do not mix `localhost` and `127.0.0.1` during login: PKCE cookies belong to one host.
Restart the app after changing environment variables.

## 2. Apply the database migration

Use the Supabase CLI to link this checkout to your new project. The commands below
pin the CLI version used for these instructions:

```sh
npx supabase@2.117.0 login
npx supabase@2.117.0 link --project-ref YOUR_PROJECT_REF
npx supabase@2.117.0 db push --dry-run
npx supabase@2.117.0 db push
```

Read the dry-run before applying. `supabase/migrations/202609200001_accounts.sql`
creates private profiles, application records, ownership indexes, access policies,
and profile/timestamp triggers. It backfills existing auth users and seeds no
applications. Do not run `db reset` against a hosted database. This migration is
intended for the new Rounza project, not an unrelated shared database.

Step 4 adds `202609230001_application_tracking.sql`, which preserves existing records
and adds revision checks and a private search function. Run the same dry-run and
`db push` commands on an existing Rounza project before opening the new tracking UI.
For a fresh project, apply both migrations in filename order.

The alternative for an initial, empty project is running the complete migration
once in Supabase's SQL Editor. If using that route, reconcile the CLI migration
history before subsequently using `db push`; do not apply the file twice.

The checked-in `database.types.ts` reflects this migration. After linking, it can
be regenerated with:

```sh
npx supabase@2.117.0 gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
npm run format
npm run typecheck
```

## 3. Configure Google

Follow Supabase's [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google):

1. Create a Google Cloud project and configure its OAuth audience and consent
   screen. While Google is in testing mode, add the Google accounts you will use
   as test users.
2. Create an OAuth client of type **Web application**. For local development,
   add `http://localhost:3000` to its authorized JavaScript origins.
3. Add the exact callback URL shown in Supabase's Google provider settings as an
   authorized redirect URI in Google. Normally this is
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Enable the Google provider in Supabase and enter the Google client ID and client
   secret there. Do not add the Google secret to Rounza, GitHub, or chat.
5. Limit scopes to `openid`, `userinfo.email`, and `userinfo.profile`. Rounza does
   not request Gmail or Drive permissions.

There are **two callbacks**: Google returns to Supabase's `/auth/v1/callback`;
Supabase returns to Rounza's `/auth/callback`.

## 4. Configure Supabase redirects

In Supabase Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect allowlist: `http://localhost:3000/auth/callback`

Keep anonymous sign-ins disabled. Google is the app's only implemented login UI;
other providers, email/password, and automatic account linking are outside this
milestone. Before release, repeat the origin/redirect setup with the actual HTTPS
site URL and review Google's production consent requirements. Avoid broad wildcard
redirects. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 5. Verify the real connection

Start `npm run dev` and open the hostname configured in `SITE_URL`.

- Open `/login` and choose **Continue with Google**. Sign in with an allowed account.
- Confirm `/app` shows your name/email and zero applications for a fresh account.
- Reload: your session should remain active. Visit `/login`: it returns to `/app`.
- Sign out, then revisit `/app`: it must return to `/login`.
- Repeat in a separate browser profile with a different Google account. It must
  have its own profile and empty workspace.
- Visit `/demo`: fictional examples remain separate from the account.

Application tracking is now available at `/app/applications`. Follow the
[tracking acceptance checklist](application-tracking.md) after verifying sign-in.

## Troubleshooting

| Symptom                              | Check                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Google button is disabled            | All three environment values must be present and valid; use a publishable key and restart Next.js.                                         |
| Redirect mismatch                    | Compare both callbacks above with the corresponding Google and Supabase settings.                                                          |
| Sign-in expired/couldn't be verified | Start again from `/login` in the same browser and hostname; avoid opening the callback in another browser.                                 |
| Workspace couldn't load              | Confirm the migration is applied and the provider/database are available. The app never substitutes sample data for a failed private read. |
| Google blocks the account            | Check Google's test-user list, audience, and consent configuration.                                                                        |

## Automated verification

`npm run test:unit` checks configuration validation and malformed demo dates.
`npm run test:db` applies the migration in a fresh embedded Postgres (PGlite) and
exercises allowed/denied operations for two users and the anonymous role. CI runs
the same suite in native Postgres 17. The minimal `auth.users` / `auth.uid()` test
bootstrap models Supabase's database contract; it does not replace a hosted Auth
service test.

To run against your own **disposable local Postgres cluster**, set
`TEST_DATABASE_URL` to that cluster's admin connection when running `npm run test:db`.
The runner accepts loopback hosts only, creates a uniquely named database, and
removes that test database afterward. It may create the standard Supabase role
names if absent. Do not point it at your working Supabase database.

`npm test` uses a fresh production build and ports 3100, 3102, and 54329. One app
instance has no account configuration. The second talks to a loopback-only fixture
that verifies PKCE exchanges, signed tokens, refresh, sign-out, error states,
server ownership filters, and separate browser accounts. No real Google account,
secret, or remote service is used. The fixture is only in `tests/`; production
contains no test authentication endpoints or bypass switches.

Automated fixtures cannot verify Google's consent screen, dashboard configuration,
or the hosted Supabase migration. Complete the real-connection checklist above
once your service setup is ready.
