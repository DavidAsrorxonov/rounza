# Connect your AI (step 8)

Users add Rounza as a remote MCP connector in their own assistant, sign in to
Rounza with Google, and explicitly select data access. Rounza reads stored records;
the user's assistant performs the reasoning. Rounza does not call model APIs,
store model keys, or provide embedded chat. Hosting and database usage still
belong to the Rounza operator. Assistant account eligibility is provider-dependent.

## What is included

- `/app/ai-connections`: setup guidance, paginated connections, permissions and revocation.
- `/auth/consent`: Supabase OAuth consent with application/resume selection.
- `/mcp`: stateless Streamable HTTP, JSON responses, POST only; GET/SSE is unsupported.
- `/.well-known/oauth-protected-resource/mcp` and its root alias: public resource metadata.
- Six read-only tools: `search_applications`, `get_application`, `list_journey_records`,
  `get_next_actions`, `list_resumes`, and `get_resume`.

Applications can be inaccessible, individually selected, or all current/future
applications. Their descriptions, notes, rounds, tasks, contacts and schedule
history follow the same grant. Resumes have an independent permission, initially
none. Selection supports search and pagination, retaining selections across pages;
up to 500 IDs per category. Clear selections to remove IDs for deleted records.
All-record access is available without that selection limit.

Tools paginate at 20 records by default, maximum 50. Next actions accept a named
IANA time zone (UTC by default) and optional bucket 0–3. Responses contain source
links and revisions where the stored record has one. Immutable schedule history
uses its ID and creation timestamp; derived next actions refer to their source
records. Resume text is limited by the existing 100,000-character library bound.
Tool response JSON is capped at 1 MB, request bodies at 64 KiB. No mutation tools,
application packages, shared career context, email integration or AI workflows
are included yet. Those belong to subsequent milestones.

## Set up your existing Supabase project

Keep your existing Google provider and database. Do not create a replacement
project or reset its database. Apply pending migrations in order using the
[account setup procedure](accounts-setup.md), including
`202609290001_ai_connections.sql`. Inspect the migration dry-run before applying.
The migration retains previous ownership policies and adds restrictive rules for
delegated access. Existing normal website sessions keep their behavior.

1. Use an asymmetric Supabase Auth signing key (ES256 or RS256). MCP verifies
   project-issued JWTs through `/auth/v1/.well-known/jwks.json`; legacy HS256
   secrets are never copied into Rounza.
2. Set the canonical MCP resource in Supabase SQL Editor as the project owner:

   ```sql
   insert into rounza_private.mcp_settings (singleton, resource)
   values (true, 'https://rounza.app/mcp')
   on conflict (singleton) do update set resource = excluded.resource;
   ```

3. Enable the **Custom Access Token** hook, choosing the database function
   `public.rounza_access_token_hook`. Preserve any existing custom-hook logic by
   composing it deliberately; do not silently replace a hook used by other apps.
   This function preserves normal session claims and sets delegated token
   `aud` to the configured MCP resource, on issuance and refresh.
4. Enable the Supabase **OAuth 2.1 server** and **dynamic client registration**.
   Set the authorization/consent path to `/auth/consent` on the configured site.
   Keep PKCE S256 enabled and use the provider's registered redirect URI checks.
   Public clients use token endpoint authentication `none`; confidential clients
   use the registration's supported method. Do not put client secrets in GitHub.
5. Keep only `public` exposed through the database API. Never expose
   `rounza_private` or `auth`, or grant clients access to Auth session tables.
6. Set `MCP_ENABLED=true` on the configured Rounza deployment after these steps.

Supabase publishes authorization discovery at
`https://YOUR_PROJECT_REF.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
The resource metadata points to that project's Auth issuer. Clients request
`openid`; these identity scopes do not define database permissions. Rounza's
database grants provide the separate record restrictions. OAuth client display
names are untrusted labels, not verified provider identities.

References: [Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
[MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
[token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## Deploy with Vercel and rounza.app

The domain is purchased; attaching it and deploying are separate setup actions.

1. Import `DavidAsrorxonov/rounza` into Vercel using the Next.js preset, repository
   root, Node 22, `npm ci` and `npm run build`. Deploy the reviewed step 8 revision.
2. Add `rounza.app` to the Vercel project. At the domain registrar, apply the DNS
   records Vercel shows for that project and wait for DNS and HTTPS verification.
3. Configure production environment values: `SITE_URL=https://rounza.app`, the
   existing `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `MCP_ENABLED=true`.
   These are server variables; no `NEXT_PUBLIC_` variants or service-role key are needed.
4. Set Supabase's site URL to `https://rounza.app` and allow exactly
   `https://rounza.app/auth/callback`. Retain localhost only if still used for
   development. Keep the Google-to-Supabase callback unchanged; add the production
   origin to the Google OAuth client where required. Do not use wildcard callbacks.
5. Redeploy after environment changes, verify Google login, then verify MCP discovery.

A stable HTTPS Vercel URL can be used for early connection testing. In that case,
use it consistently for SITE_URL, the database MCP resource, Supabase site URL,
and callbacks. Rotating preview URLs are unsuitable for persistent connections.
Changing the canonical resource invalidates old tokens; reconnect assistants.
Do not attach a preview environment with weaker settings to your production data.

## Connect ChatGPT or Claude

In the assistant's custom connector/MCP settings, use `https://rounza.app/mcp`
and OAuth. Follow its current account/workspace requirements:
[ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt),
[ChatGPT authentication](https://developers.openai.com/plugins/build/auth),
[Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

Sign in to Rounza, review the client and requested identity scopes, choose records,
and approve. Ask for permitted applications or upcoming interviews. Returning
users may be redirected by Supabase for already-approved identity scopes; this
never creates or broadens a Rounza record grant. Change permissions in Rounza.
If a connection was revoked, complete provider revocation before reconnecting.

Supabase's `authorization_id` is a 32-character alphanumeric string, distinct
from its internal authorization row UUID. Consent, decisions, and the Google
sign-in return cookie validate this same format. The local Auth fixture mirrors
the provider's lowercase base32 IDs, including letters outside hexadecimal.
See the [Supabase authorization model](https://github.com/supabase/auth/blob/master/internal/models/oauth_authorization.go).

## Authorization and revocation boundaries

Every MCP request verifies signature, issuer, exact resource audience, expiry,
user/client/session IDs, non-anonymous authenticated role, and the current
database grant. Subsequent data reads use the same token and owner filter with
RLS; no service-role client bypasses these rules. Database checks require a live
matching `auth.sessions` row whose `oauth_client_id` matches the client and whose
creation time is at least the connection's activation time. Refresh cannot move
that creation time. Revoking locally blocks subsequent database access even if
the Auth service is unavailable. Reauthorization advances activation time;
pre-reconnection tokens and sessions stay denied.

Normal website access additionally rejects delegated claims, including tokens
copied into cookies. Connection actions verify the signed-in owner; permission
updates use revisions. Revocation intentionally wins over concurrent edits.
Delegated tokens cannot edit records, change grants or access vault ciphertext,
wrapped keys, portal links or profile tables, even through the database API or
existing RPCs. Grant checks never trust user metadata. SQL helper functions use
fixed search paths and restricted privileges.

Permission changes apply to subsequent requests, not data already returned or a
query already executing. Revocation cannot erase an assistant's previous copies.
Private responses use no-store. Application code does not log tokens, request
bodies or record contents. Configure hosting observability accordingly; do not
enable request-body/session recording on these routes. Database usage, not model
usage, is incurred; apply hosting request limits appropriate to deployment traffic.

`MCP_ENABLED=false` disables MCP entry points but is not a database revocation.
For an emergency project-wide delegated-access stop, remove the single row from
`rounza_private.mcp_settings`; this blocks delegated RLS and new OAuth tokens
while preserving normal website access. Restore configuration deliberately.

## Verification and live acceptance

Automated tests use disposable PGlite/native Postgres and a local signed-token
Auth/PostgREST fixture. They cover RLS across the existing tables/RPCs, scope
reductions, reconnect cutoffs, token-hook behavior, consent approval/denial,
sign-in return, stale permission forms, selectors, and browser-token rejection.
A real SDK client exercises discovery, MCP initialization, tool listing/calls,
input bounds, invalid JWTs and revocation. Run `npm run verify`; CI also runs
the desktop/mobile browser suite and native PostgreSQL 17 tests.

**Hosted Supabase and real ChatGPT/Claude acceptance remain separate.** Once HTTPS
and OAuth setup are complete, verify with a dedicated test account:

- Google sign-in still works; previous tracking, rounds, vault and resume flows work.
- Both assistants complete OAuth PKCE and read only selected applications/resumes.
- Inspect issued access-token claims locally: correct issuer, resource audience,
  client and session. Never paste tokens into logs, issues or chat.
- Confirm actual delegated tokens work with RLS-backed reads. Direct unauthorized
  reads and every write are denied, including portal RPCs and grant management.
- Reduce permissions, revoke, reconnect, and confirm the old token remains denied
  even after refresh while the newly authorized session works.
- Check declined/expired authorization, revoked provider sessions and time-zone
  next actions. Record each assistant's actual test result and date.

Do not mark these live checks passed based on local fixtures or a green CI run.
