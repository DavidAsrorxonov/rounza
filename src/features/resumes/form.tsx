"use client";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveResume } from "./actions";
import {
  MAX_TEXT,
  sources,
  type Resume,
  type ResumeState,
  type ImportResult,
} from "./model";
import { importResume } from "./import";

export function ResumeForm({
  owner,
  id,
  resume,
}: {
  owner: string;
  id: string;
  resume?: Resume;
}) {
  const [identity] = useState({
    owner,
    id,
    revision: resume?.revision ?? null,
  });
  const [state, action, pending] = useActionState<ResumeState, FormData>(
    saveResume.bind(null, identity.owner, identity.id, identity.revision),
    {},
  );
  const [name, setName] = useState(resume?.name ?? "");
  const [body, setBody] = useState(resume?.body ?? "");
  const [source, setSource] = useState<Resume["source"]>(
    resume?.source ?? "paste",
  );
  const [reviewed, setReviewed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [candidate, setCandidate] = useState<
    (ImportResult & { name: string }) | null
  >(null);
  const [importError, setImportError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const job = useRef<{ controller: AbortController; token: number } | null>(
    null,
  );
  const sequence = useRef(0);
  const errors = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) errors.current?.focus();
  }, [state]);
  useLayoutEffect(
    () => () => {
      sequence.current++;
      job.current?.controller.abort();
      job.current = null;
      setCandidate(null);
      setImporting(false);
    },
    [],
  );
  const cancelImport = () => {
    sequence.current++;
    job.current?.controller.abort();
    job.current = null;
    setImporting(false);
    setCandidate(null);
    setImportError("");
  };
  async function chooseFile(file: File) {
    cancelImport();
    const token = ++sequence.current;
    const controller = new AbortController();
    job.current = { token, controller };
    setImporting(true);
    try {
      const result = await importResume(file, controller.signal);
      if (token !== sequence.current) return;
      setCandidate({
        ...result,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 160),
      });
    } catch (error) {
      if (token === sequence.current)
        setImportError(
          error instanceof Error
            ? error.message
            : "Import failed. Try another file or paste the text.",
        );
    } finally {
      if (token === sequence.current) {
        job.current = null;
        setImporting(false);
      }
    }
  }
  const cancelHref = resume ? `/app/resumes/${id}` : "/app/resumes";
  return (
    <form action={action} className="tracking-form resume-form">
      {state.message && (
        <div
          ref={errors}
          tabIndex={-1}
          role="alert"
          className="tracking-form-error"
        >
          <p>{state.message}</p>
          {state.conflict && (
            <a
              href={cancelHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Open latest version in a new tab
            </a>
          )}
        </div>
      )}
      <section className="tracking-form-section resume-import">
        <h2>
          <Upload size={20} aria-hidden="true" />
          Start with your document
        </h2>
        <p>
          Choose a text-based PDF or DOCX, or paste directly into the text field
          below. Files stay on this device. Only the text you review and save is
          stored in your account.
        </p>
        <label className="field-label mt-5" htmlFor="resume-file">
          Import PDF or DOCX
        </label>
        <input
          id="resume-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="field resume-file"
          disabled={pending}
          aria-describedby="resume-import-help"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void chooseFile(file);
          }}
        />
        <p id="resume-import-help" className="journey-help mt-3">
          Up to 5 MB and 50 PDF pages. Scans, images, password-protected files
          and older .doc files are not supported.
        </p>
        {importing && (
          <div className="resume-import-status">
            <p role="status">Reading your file on this device…</p>
            <Button type="button" variant="outline" onClick={cancelImport}>
              Cancel import
            </Button>
          </div>
        )}
        {importError && (
          <p role="alert" className="tracking-form-error mt-4">
            {importError}
          </p>
        )}
        {candidate && (
          <div className="resume-import-preview">
            <h3 className="text-lg font-semibold">Check the extracted text</h3>
            {candidate.warnings.map((warning) => (
              <p className="journey-help mt-2" key={warning}>
                {warning}
              </p>
            ))}
            <label className="field-label mt-4" htmlFor="extracted-text">
              Extracted text preview
            </label>
            <textarea
              id="extracted-text"
              value={candidate.text}
              readOnly
              rows={10}
              className="field resume-text"
            />
            <p className="journey-help mt-3">
              {body
                ? "Using this text will replace your current draft below."
                : "Move this into your draft, make corrections, then confirm it is ready to save."}
            </p>
            <div className="vault-buttons mt-4">
              <Button type="button" variant="outline" onClick={cancelImport}>
                Discard import
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setBody(candidate.text);
                  setSource(candidate.source);
                  setWarnings(candidate.warnings);
                  if (!name.trim()) setName(candidate.name);
                  setReviewed(false);
                  setCandidate(null);
                }}
              >
                Use extracted text
              </Button>
            </div>
          </div>
        )}
      </section>
      <fieldset disabled={pending || importing || Boolean(candidate)}>
        <legend className="sr-only">Reviewed resume</legend>
        <section className="tracking-form-section">
          <h2>
            <FileText size={20} aria-hidden="true" />
            Review and save
          </h2>
          <p>
            Keep a clear name for each version, such as “Product designer —
            September”. Text is saved privately in your account. You can return
            to edit or replace it later.
          </p>
          <div className="field-label mt-6">
            <label htmlFor="resume-name">Resume name (required)</label>
            <input
              id="resume-name"
              name="name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              required
              autoComplete="off"
              aria-invalid={Boolean(state.errors?.name)}
              aria-describedby={
                state.errors?.name ? "resume-name-error" : undefined
              }
            />
            {state.errors?.name && (
              <span id="resume-name-error" className="tracking-field-error">
                {state.errors.name[0]}
              </span>
            )}
          </div>
          <input type="hidden" name="source" value={source} />
          <div className="resume-source-line">
            <span>{sources[source]}</span>
            {source !== "paste" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSource("paste");
                  setWarnings([]);
                  setReviewed(false);
                }}
              >
                Use pasted text instead
              </Button>
            )}
          </div>
          {warnings.map((warning) => (
            <p key={warning} className="journey-help mb-3">
              {warning}
            </p>
          ))}
          <div className="field-label">
            <label htmlFor="resume-body">Resume text (required)</label>
            <textarea
              id="resume-body"
              name="body"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setReviewed(false);
              }}
              className="field resume-text"
              rows={18}
              maxLength={MAX_TEXT}
              required
              spellCheck
              aria-invalid={Boolean(state.errors?.body)}
              aria-describedby={
                state.errors?.body
                  ? "resume-text-help resume-body-error"
                  : "resume-text-help"
              }
            />
            <span id="resume-text-help" className="journey-help">
              {body.length.toLocaleString("en")} / 100,000 characters. Check
              contact details, dates, skills and reading order against your
              original.
            </span>
            {state.errors?.body && (
              <span id="resume-body-error" className="tracking-field-error">
                {state.errors.body[0]}
              </span>
            )}
          </div>
          <label className="vault-checkbox">
            <input
              type="checkbox"
              name="reviewed"
              value="yes"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              required
            />
            I have reviewed this text and it is ready to save.
          </label>
          {state.errors?.reviewed && (
            <p className="tracking-field-error">{state.errors.reviewed[0]}</p>
          )}
        </section>
      </fieldset>
      <div className="tracking-form-footer">
        <p>
          Unsaved edits are kept only on this page. Original files are not
          uploaded or stored.
        </p>
        <div>
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={pending || importing || Boolean(candidate) || !reviewed}
          >
            {pending ? "Saving…" : resume ? "Save changes" : "Save resume"}
          </Button>
        </div>
      </div>
    </form>
  );
}
