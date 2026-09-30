# Review inbox (step 9)

Assistants can suggest creating or updating applications, hiring rounds, tasks,
contacts and resume text. Suggestions are stored as proposals. Only the user can
approve a whole batch inside Rounza. No model API calls, AI keys, autonomous edits,
deletion proposals, vault access, application packages or shared career context
are added in this milestone.

## Enable on the existing deployment

1. Apply `202609300001_review_inbox.sql` to the existing Supabase project using
   the [migration procedure](accounts-setup.md). Review the dry-run first. Do not
   reset the project. Deploy the matching application revision to Vercel.
2. Existing connections keep `allow_proposals=false`. In **AI connections → Manage
   access**, explicitly enable **Allow this assistant to submit proposals to my
   review inbox** and save. New consent also offers this separate, unchecked option.
3. Refresh the tool list in the assistant if necessary. `/mcp` adds `submit_proposal`
   and `get_proposal_status` to the six existing read tools. The submission tool is
   correctly marked as a write, even though it only writes a pending proposal.
   There is no MCP approval, rejection or direct record mutation tool.

The existing OAuth configuration, audience hook, PKCE and Google callbacks stay
the same. No additional API key or environment variable is required.

## Permissions and review

Updates are limited to permitted applications and their journeys, or separately
permitted resumes. Creating a new application requires all-application access;
creating a resume requires whole-library access. A selected-application connection
can propose new rounds, tasks and contacts within those applications. This keeps
new records readable under the same grant after approval. Vault entities, portal
relationships, ownership, identities, source flags and system timestamps are not
editable fields. Resumes created through review have source `paste`.

The inbox shows pending proposals and approved/rejected history, 20 per page.
Each detail page identifies the submitting client, explanation, source revision
and before/proposed values for each changed field. Text is rendered as plain text,
including assistant explanations and external URLs. Approval requires an explicit
acknowledgement that all changes, including resume text, were reviewed for accuracy.
Rejecting leaves live records unchanged. To revise a proposal, reject it and ask
the assistant for a new one. Approved records have links and resulting revisions.

The stored before/after values remain an audit of the decision, not a live view.
Use **Open current record** for the latest data. Applied changes can subsequently
be edited with the normal website forms. There is no automatic undo of a batch.

## Tool contract

`submit_proposal` accepts a UUID `idempotency_key`, a title (160 characters), an
explanation (2,000 characters), and 1–10 ordered changes. Each change has:

- `entity`: `application`, `round`, `task`, `contact` or `resume`.
- `action`: `create` or `update`.
- `record_id`: an existing UUID for updates; a fresh UUID for creates, kept stable
  across retries. Each record appears once per batch.
- `expected_revision`: the revision from a fresh read for updates; null/omitted for creates.
- `application_id`: required for rounds, tasks and contacts; absent for applications/resumes.
- `data`: a nonempty patch of allowed fields. Omitted update fields are preserved.
  Creates use existing record defaults and require company/role, round/task title,
  contact name, or resume name/body as appropriate.

Put a newly created application before its children, and a newly created round
before a linked task. Reference those same UUIDs in `application_id` / `round_id`.
This allows one application and its initial journey to be approved together.
Meeting timestamps must include an offset or `Z`, with an accompanying named IANA
time zone. Assistants must clarify ambiguous local meeting times before proposing.

```json
{
  "idempotency_key": "68ea57d0-b8a0-4eb4-aead-c9e68208cd68",
  "title": "Add the recruiter follow-up",
  "summary": "You asked for a reminder to follow up after the screening call.",
  "changes": [
    {
      "entity": "task",
      "action": "create",
      "record_id": "b9dca6c3-b4a1-4d4d-9a93-60dc820afcaa",
      "application_id": "d5d5b6ef-fd79-44d8-90fb-65c2184b0e74",
      "data": {
        "title": "Follow up with the recruiter",
        "due_on": "2026-10-05"
      }
    }
  ]
}
```

The tool returns proposal status and a Rounza review URL. Retrying the same key and
identical content returns the same proposal, including its decided status. Reusing
the key for different content fails; revisions require a new key. Repeated approval
returns the original receipt without reapplying changes. Stable record UUIDs and
revision checks additionally reject duplicate creations or repeated stale updates.
This is retry protection, not semantic deduplication of similar jobs with different IDs.

`get_proposal_status` returns only decision metadata for this connection's proposals.
It never returns stored snapshots: reducing read permissions must not expose old
record text through proposal history. Users can read their full history in Rounza.

## Transaction and security boundaries

`ai_proposals` has browser-owner SELECT RLS and no client INSERT/UPDATE/DELETE grants.
The narrowly scoped `submit_ai_proposal` RPC verifies a live delegated session,
active connection and proposal opt-in, validates an explicit entity/field allowlist,
checks current per-record access, and captures owned source snapshots. It can only
insert proposals. Unknown/unsafe fields, invalid schedules and unsupported entities
are rejected; no service-role key is used by the application.

`decide_ai_proposal` requires a normal website identity and the proposal owner.
Approval locks the connection, proposal and source records, validates the entire
batch again, then applies it in one database transaction. Existing revision,
ownership constraints, timestamps, generated counts, schedule-history and
application-recency triggers still run. The SQL function's write identifiers come
only from fixed allowlists. Internal helpers cannot be called by client roles.

Any changed source or parent application, missing record, changed grant, disabled
proposal permission, revoked connection/provider session, reconnect activation,
expiration or database write failure aborts the whole batch. Rejection remains
available after expiration or revocation. A concurrent revocation serializes with
approval; an approval already holding the lock may complete first. Permission
changes cannot retroactively undo an applied decision.

Proposals expire after seven days. Each connection can have at most 50 unexpired
pending proposals. The MCP request ceiling is 256 KiB; proposal arguments are
limited to 200,000 bytes and SQL JSON storage input to 220,000 bytes (allowing JSON
spacing). Responses retain the 1 MB bound. Existing per-field text limits apply.
Snapshots and decisions are retained until account/connection deletion; there is
no automatic purge job. Private routes remain no-store, and code does not log
proposal text, record contents or credentials.

## Verification

Unit/protocol tests validate schemas, tool discovery, opt-in failure, submission,
status, unsupported approval tools and bounded transport. Actual migration tests
cover cross-account isolation, staging, atomic creation, rollback, revisions,
idempotent retries, reduced grants, revocation, reconnects and expiration. Browser
tests cover opt-in, before/after review, approval, rejection, stale batches and
pagination on desktop and mobile. Run `npm run verify`; CI runs native PostgreSQL.

After applying the migration and deploying, use a dedicated test account to enable
proposals in ChatGPT and Claude, submit and approve a small batch, then verify
rejection, a stale source, revoked permissions and retry behavior. Record live
assistant results separately from fixture/CI results. No hosted migration or live
assistant approval is implied by the automated test results.
