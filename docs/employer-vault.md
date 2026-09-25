# Employer portals and credential vault

Milestone 6 adds private reusable portal accounts. A Workday or other employer
login can belong to several applications without duplicating its password.
Names, portal URLs, usernames, passwords and notes are all encrypted on the
device before being sent to Rounza. Opening a portal is a normal external link;
Rounza does not sign in automatically or scrape it.

## Setup

Complete [account setup](accounts-setup.md), including Google sign-in and all prior
migrations. Apply the new migration before running this version:

```sh
npx supabase db push
```

This includes `supabase/migrations/202609250001_employer_vault.sql`, creating
`credential_vaults`, `portal_accounts`, `application_portals`, owner policies,
revision triggers and invoker RPCs. No new environment variables, service-role
keys, external crypto service or password manager integration are needed. The
`hash-wasm` Argon2id worker is bundled with the app, including its WASM code.
Use HTTPS in production; localhost works for development. Web Crypto, Web Workers,
WebAssembly and JavaScript are required. Test on intended mobile devices too;
derivation intentionally uses 64 MiB and can be slower on limited devices.

The application has no service-role key. Keep default Next Server Action origin
checks enabled. Do not add analytics, session replay, request-body logging, or AI
processing to the credential interface. Any future content security policy must
be tested against the bundled worker and WebAssembly before enforcement.

## Using the vault

1. Open **Portals & vault**, or **Manage portals** on an application.
2. Create a unique vault passphrase of at least 12 characters, separate from your
   Google account. Passphrases are case-sensitive and used exactly as typed.
3. Save the generated recovery key somewhere outside Rounza. Acknowledging that
   it is saved enables the final save. Cancelling leaves the previous vault
   unchanged. The complete key is displayed only during setup/replacement.
4. Unlock, then add a portal account. Adding from an application links it in the
   same transaction. Use **Link an existing account** to reuse one elsewhere.
5. Reveal a password temporarily or explicitly copy its username/password. The
   password hides after 15 seconds. Clipboard contents remain outside Rounza's
   control; locking does not clear the operating system clipboard.

The vault locks on page navigation, reload, tab hiding, page lifecycle events,
sign-out, explicit lock, or five minutes without pointer, keyboard or wheel
activity. Locking discards unsaved credential forms and pending recovery setup.
Each tab must unlock independently; a same-origin broadcast propagates explicit
lock, sign-out, access changes and reset to other tabs. Suspended tabs lock when
their page lifecycle resumes. Session/account checks also run before sensitive
operations, on focus, and every 15 seconds while visible and idle from operations.
If the account cannot be checked, the page locks.

Accounts are paginated in groups of 20, newest updated first. Application screens
show a count without decrypting names. Failed saves retain the current form until
it is cancelled or locked. A stale edit/delete is rejected; close it and reload
the accounts to use the latest version. A damaged/unsupported encrypted record
gets an unreadable-account state without blocking the remaining records.

Deleting an application removes its portal links, not the shared portal account.
Deleting a portal account removes all its links after confirmation. Account
deletion at the database level also cascades through vault data.

## Recovery and loss

**Use a recovery key** accepts the saved key and a new passphrase. **Change
passphrase** accepts the current passphrase and a new one. Both generate a new
recovery key, require the save acknowledgement, replace both stored envelopes,
and lock the vault. Keep the replacement recovery key and discard the old one.
Changing Google sign-in access does not change or recover the vault passphrase.

These operations rewrap the existing data key. They do **not** rotate it or revoke
copies of older envelopes/keys already obtained by someone else. Anyone holding
an old envelope plus its unlock secret can still recover that data key. This
milestone does not implement compromise recovery through full data-key rotation.

If both passphrase and recovery key are lost, Rounza cannot recover credentials.
**Reset vault** requires typing `DELETE VAULT` and permanently removes encrypted
portal accounts and application links from the active database, keeping job
applications intact. Normal database backup retention still applies. Reset
permits starting a new empty vault; it does not recover the old credentials.
Backups must include the encrypted accounts, vault envelopes and relationships;
restoring ciphertext alone is insufficient. Unlock secrets must be backed up
separately by the user. There is no vault export/import interface in this milestone.

## Cryptographic format and limits

- One random 256-bit data key per vault; imported Web Crypto keys are
  non-extractable. AES-256-GCM uses a fresh random 96-bit nonce and 128-bit tag for
  each record/envelope.
- AAD is UTF-8 `rounza:v1:<owner UUID>:<vault UUID>:<purpose>`, where purpose is
  `passphrase`, `recovery`, or `portal:<portal UUID>`. Swapping owner, vault, record
  or envelope purpose fails authentication.
- Argon2id v1.3 uses a random 16-byte salt, 65,536 KiB, three iterations, four lanes
  and a 32-byte derived key. This follows the memory-constrained recommendation
  in [RFC 9106 section 7.4](https://www.rfc-editor.org/rfc/rfc9106.html#section-7.4).
  [hash-wasm](https://github.com/Daninet/hash-wasm) runs in a per-operation worker
  terminated on completion, error, lock or a 60-second timeout.
- Recovery uses 32 cryptographically random bytes, encoded as `RZ1-` followed by
  43 base64url characters. That key directly wraps the data key with AES-GCM; it
  has its own nonce and authenticated purpose.
- Format version 1 accepts only the exact algorithm/parameters above. Unknown
  versions or parameters fail closed before the KDF. Future formats need explicit
  migration support; there is no automatic algorithm downgrade.
- Portal plaintext is bounded and validated before encryption and after
  decryption. URLs permit HTTP(S), reject embedded login credentials and render
  only as escaped links/text. Ciphertext is bounded to 87,384 base64 characters.
- Envelopes and ciphertext use canonical standard base64. See the Web Crypto
  [AES-GCM documentation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
  for the nonce and authenticated-data contract.

This protects stored credential contents against a database-only disclosure,
subject to the strength of the passphrase. Owners, record sizes, timestamps,
counts and application relationships remain visible to the server. RLS also
restricts access to encrypted records. A malicious database can delete or replay
old records; revisions prevent ordinary stale writes, not malicious rollback.

This is not an independently audited password manager. It cannot protect secrets
from compromised frontend code, XSS, hostile extensions, malware, screen capture,
or someone using an unlocked device. JavaScript strings and CryptoKeys cannot be
reliably zeroized; clearing state and best-effort byte-buffer cleanup are not
guaranteed memory erasure. Browser autofill/password-manager behavior is also
outside Rounza's control. Independent cryptographic and application security
review remains part of release preparation before relying on it for real secrets.

## Verification

`npm run test:unit` exercises actual Argon2id, wrapping, recovery, tamper/context
rejection, non-extractable keys and strict format validation. `npm run test:db`
applies the real migration and checks anonymous/cross-owner access, grants,
composite foreign keys, immutable identity, transactional creation, stale
revisions and deletion cascades. CI uses native PostgreSQL 17; local tests also
support PGlite. `npm test` runs the bundled worker against production Next servers
in desktop and mobile Chromium using disposable Auth/REST fixture accounts.
Browser checks cover the user flows, lock lifecycle, damaged ciphertext,
pagination, failed/stale writes, and no plaintext in outgoing requests or Web
Storage. The public demo continues to use fictional credentials only.

After configuring a hosted Supabase project, verify with disposable credentials:

1. Sign in as two different Google users. Each starts with an independent vault;
   neither can fetch or mutate the other's encrypted records or application links.
2. Create a vault and save its recovery key. Add a portal, reload, unlock and edit.
   Inspect the database and request payloads: no credential fields or unlock
   secrets should appear in plaintext.
3. Link one portal to two applications. Delete one application; the portal and
   remaining link survive. Unlinking leaves the account intact.
4. Try a wrong passphrase, then recover with the saved key and a new passphrase.
   Save the new recovery key, unlock, and confirm existing credentials survive.
5. Verify hide-tab, reload, navigation, inactivity, explicit lock and cross-tab
   sign-out on desktop and mobile. Unsaved fields must disappear.
6. Test stale edits, network failure, confirmed portal deletion and a confirmed
   reset using only disposable records. Applications must survive reset.

The automated fixture is not a hosted Supabase acceptance test. Real Google OAuth,
PostgREST configuration, deployment headers and target-device performance still
need that check once the project is connected.
