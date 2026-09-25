"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { passphraseInput, portalDetails, type PortalDetails } from "./model";

// Sensitive fields intentionally have no `name` and no Server Action binding.
// Only the client submit callback handles plaintext; no native form submission
// or progressive-enhancement fallback can serialize credentials to the server.
export function AccessForm({
  mode,
  busy,
  onSubmit,
  onCancel,
}: {
  mode: "setup" | "unlock" | "recovery" | "change";
  busy: boolean;
  onSubmit: (secret: string, next: string) => void;
  onCancel?: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const creating = mode !== "unlock";
  return (
    <form
      className="vault-access-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        if (creating) {
          const parsed = passphraseInput.safeParse(next);
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (next !== confirm) {
            setError("The new passphrases do not match.");
            return;
          }
        }
        onSubmit(secret, next);
      }}
    >
      <fieldset disabled={busy}>
        <legend className="sr-only">Vault access</legend>
        {mode !== "setup" && (
          <div className="field-label">
            <label htmlFor="vault-secret">
              {mode === "recovery"
                ? "Recovery key"
                : mode === "change"
                  ? "Current vault passphrase"
                  : "Vault passphrase"}
            </label>
            <input
              className="field"
              id="vault-secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              required
              maxLength={256}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
        )}
        {creating && (
          <>
            <div className="field-label">
              <label htmlFor="vault-new">New vault passphrase</label>
              <input
                className="field"
                id="vault-new"
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
              />
              <span className="journey-help">
                Use a unique passphrase of at least 12 characters. It is
                separate from your Google sign-in.
              </span>
            </div>
            <div className="field-label">
              <label htmlFor="vault-confirm">Confirm new passphrase</label>
              <input
                className="field"
                id="vault-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                maxLength={256}
                autoComplete="new-password"
              />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="tracking-field-error">
            {error}
          </p>
        )}
        <div className="vault-buttons">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">
            {busy
              ? "Working…"
              : mode === "unlock"
                ? "Unlock vault"
                : mode === "setup"
                  ? "Create recovery key"
                  : "Prepare new vault access"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function RecoveryConfirmation({
  code,
  busy,
  onConfirm,
  onCancel,
}: {
  code: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  return (
    <section className="vault-access-panel">
      <h2>Keep your recovery key safe.</h2>
      <p>
        Save this key somewhere separate from Rounza. It can unlock your vault
        and replace a forgotten passphrase. Rounza does not store the recovery
        key.
      </p>
      <label className="field-label" htmlFor="recovery-copy">
        Your new recovery key
      </label>
      <textarea
        id="recovery-copy"
        className="field vault-recovery-code"
        value={code}
        readOnly
        rows={3}
        spellCheck={false}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied("Copied. Keep it in a safe place.");
          } catch {
            setCopied("Copy is unavailable. Select and copy the key above.");
          }
        }}
      >
        Copy recovery key
      </Button>
      <p role="status" className="journey-help">
        {copied}
      </p>
      <label className="vault-checkbox">
        <input
          type="checkbox"
          checked={saved}
          disabled={busy}
          onChange={(event) => setSaved(event.target.checked)}
        />
        I have saved this recovery key somewhere safe.
      </label>
      <p className="journey-help">
        Losing both the passphrase and recovery key means losing access to the
        saved credentials.
      </p>
      <div className="vault-buttons">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" disabled={!saved || busy} onClick={onConfirm}>
          {busy ? "Saving…" : "Finish saving vault access"}
        </Button>
      </div>
    </section>
  );
}
export function PortalForm({
  initial,
  editing,
  busy,
  onSave,
  onCancel,
}: {
  initial: PortalDetails;
  editing: boolean;
  busy: boolean;
  onSave: (details: PortalDetails) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = [
    {
      key: "name",
      label: "Portal account name",
      max: 160,
      required: true,
      type: "text",
    },
    { key: "url", label: "Portal URL", max: 2048, required: true, type: "url" },
    {
      key: "username",
      label: "Portal username or email",
      max: 320,
      type: "text",
    },
    { key: "password", label: "Portal password", max: 1024, type: "password" },
    {
      key: "notes",
      label: "Private portal notes",
      max: 5000,
      type: "textarea",
    },
  ] as const;
  return (
    <section className="vault-access-panel">
      <h2>{editing ? "Edit portal account" : "Add portal account"}</h2>
      <p>
        Every field below is encrypted before it is saved. One account can be
        linked to several applications.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const result = portalDetails.safeParse(values);
          if (!result.success) {
            setErrors(
              Object.fromEntries(
                result.error.issues.map((issue) => [
                  String(issue.path[0]),
                  issue.message,
                ]),
              ),
            );
            return;
          }
          setErrors({});
          onSave(result.data);
        }}
      >
        <fieldset disabled={busy} className="vault-fields">
          <legend className="sr-only">Portal credentials</legend>
          {fields.map((field) => {
            const props = {
              id: `portal-${field.key}`,
              className: "field",
              value: values[field.key],
              maxLength: field.max,
              "aria-invalid": Boolean(errors[field.key]),
              "aria-describedby": errors[field.key]
                ? `portal-${field.key}-error`
                : undefined,
              autoComplete: "off",
              spellCheck: false,
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => {
                const value = event.target.value;
                setValues((current) => ({ ...current, [field.key]: value }));
              },
            };
            return (
              <div className="field-label" key={field.key}>
                <label htmlFor={props.id}>{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea {...props} rows={4} />
                ) : (
                  <input
                    {...props}
                    type={field.type}
                    required={"required" in field && field.required}
                  />
                )}
                {errors[field.key] && (
                  <span
                    id={`portal-${field.key}-error`}
                    className="tracking-field-error"
                  >
                    {errors[field.key]}
                  </span>
                )}
              </div>
            );
          })}
          <div className="vault-buttons">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {busy ? "Encrypting and saving…" : "Save portal account"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
