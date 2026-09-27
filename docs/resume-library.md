# Resume library

Milestone 7 adds named, private resume versions at `/app/resumes`. Import a
text-based PDF or DOCX on your device, or paste text, review it, and explicitly
save the version you want to keep. You can edit, replace text, or delete it later.
Resume analysis and job matching belong to milestone 8.

## Setup

Complete [account setup](accounts-setup.md) and apply pending migrations:

```sh
npx supabase db push
```

The new migration is `supabase/migrations/202609270001_resume_library.sql`.
It creates the private `resumes` table, owner policies, a generated character
count, an update-order index and an immutable-identity/revision trigger. No
storage bucket, new environment variable, external parser service or AI key is
needed. Use the locked dependencies with `npm ci` and build normally.

## Import and review

1. Choose **Resumes → Add resume**, then choose a PDF/DOCX or paste directly into
   **Resume text**. Choose a name that distinguishes this version.
2. File extraction first shows a read-only preview. Compare it with the original,
   especially contact details, dates, headings, columns and tables. **Use extracted
   text** replaces the draft; **Discard import** preserves it. A failed import
   also preserves the current text.
3. Correct the text and confirm **I have reviewed this text and it is ready to
   save**. Any text change clears that confirmation. Saving sends only the name,
   reviewed text and source category with record identity/revision to the server.
4. The saved page displays text as text, never interpreted HTML. Edit to make
   changes or import a replacement. Duplicate names are allowed, so use meaningful
   version names. Deleting a version requires confirmation and does not affect
   job applications, other resumes or the original file.

Files are read on the device and never uploaded or retained by Rounza. A filename
can prefill the editable name, but no separate filename/path is stored. Drafts and
previews are not persisted to Web Storage or IndexedDB; leaving/reloading loses
unsaved work. The source label records the chosen import category, not a retained
original file or a guarantee that its text is unchanged. Resumes are private
account data protected by authentication and row-level access controls; they are
not encrypted with the separate credential-vault key.

## Supported files and limits

- PDF/DOCX up to 5 MiB, PDFs up to 50 pages, saved text up to 100,000 JavaScript
  characters, and names up to 160. Input accepts uppercase file extensions and
  does not depend on the operating system reporting a particular MIME type.
- [PDF.js](https://mozilla.github.io/pdf.js/examples/) extracts a PDF text layer
  from local bytes in its bundled worker. Original layout is not retained.
  Images and scans are not OCR'd. Empty pages produce a partial-extraction warning;
  no readable text produces an error. Complex fonts and damaged documents may
  require a fresh export or pasting. Password-protected PDFs are rejected without
  asking for a document password.
- [Mammoth](https://github.com/mwilliamson/mammoth.js) extracts DOCX raw text using
  its browser entry in a dedicated worker. Formatting, images, headers, footers
  and some other elements may be omitted. Raw text never executes document links,
  scripts or macros. Unsupported parser features produce a review warning.
- DOCX archives are limited to 500 entries and 20 MiB of declared expanded size,
  with at most 4 MiB per XML part. [fflate](https://github.com/101arrowz/fflate)
  inflates selected XML into bounded buffers; only that bounded XML is repacked
  for Mammoth. Original compressed entries never go directly to Mammoth. DTDs,
  entity declarations, macro features and unsafe/duplicate paths are rejected.
- Imports time out after 30 seconds. Cancel, replacement and navigation terminate
  pending workers; late results cannot overwrite the draft. Browser parser limits
  are practical safeguards, not a guarantee that arbitrary malformed documents
  can never exhaust device resources.
- Older `.doc`, scanned documents, OCR, original-file storage, formatted export,
  application-to-resume history and AI analysis are outside this milestone.

For an unsupported or protected file, export an unlocked text-based PDF/DOCX or
paste its text. The app does not silently truncate long resumes. The manual
review is necessary because extraction cannot guarantee a faithful reading order.

## Persistence and access

Every server read/write requires a verified account and filters by its user ID.
No service-role client is used. PostgreSQL independently enforces owner RLS,
explicit grants, fixed identity, text/source constraints and revision increments.
The server checks the form's original owner, so signing into a different account
cannot save an old draft there. Stale saves/deletes are rejected; use the latest
version before retrying. Failed saves keep current form text available.

The library loads 20 summaries at a time, without full resume text. Ordering uses
updated time and ID, and an out-of-range page returns to page one. Database account
deletion cascades to resumes. Permanent deletion affects the active database;
the deployment's normal backup-retention rules still apply.

## Verification

Unit tests use the actual DOCX parser with generated fictional documents and test
validation, Unicode, literal markup, malformed/empty/macro/entity archives and
decompression bounds. Real SQL tests cover owner isolation, grants, spoofing,
constraints, generated counts, immutable identities, stale revisions and cascades.
Production-browser tests exercise PDF/DOCX workers, review and replacement,
outgoing-request privacy before saving, CRUD, failures, cancellation/timeouts,
pagination, account changes and desktop/mobile layout. All file fixtures contain
invented text and are generated locally in the test suite.

After connecting a hosted Supabase project, check with disposable resumes:

1. Two signed-in users must see separate libraries. Direct record URLs and API
   requests must not expose or mutate another user's resume.
2. Import a short text PDF and DOCX, plus a multi-column version from your normal
   editor. Inspect and correct extraction before saving, then reload and edit.
3. Verify no original file/unsaved text is sent in network requests. Check the
   database contains only the explicitly saved text and metadata.
4. Try a scan, protected file, damaged file, oversized file, cancellation and a
   network failure on save. Existing draft text must remain available.
5. Edit the same resume in two tabs and verify stale-save/delete protection. Delete
   a disposable version; other resumes and job applications must remain.

Hosted OAuth/PostgREST and target-device behavior still require this acceptance
check after service setup; the automated local fixture does not verify deployment.
