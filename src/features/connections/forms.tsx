"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  authorizeConnection,
  updateConnection,
  revokeConnection,
} from "./actions";
import {
  emptyPermissions,
  type Connection,
  type ConnectionState,
  type Permissions,
  type RecordOption,
} from "./model";

function RecordPicker({
  kind,
  selected,
  onChange,
}: {
  kind: "applications" | "resumes";
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    items: RecordOption[];
    has_more: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          kind,
          q: query,
          page: String(page),
        });
        const response = await fetch(`/app/ai-connections/options?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setResult(data);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult(null);
          setError("Records couldn’t load. Retry or change your search.");
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, page, retry]);
  return (
    <div className="connection-picker">
      <label className="field-label">
        Search {kind}
        <input
          type="search"
          className="field"
          value={query}
          maxLength={120}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setResult(null);
          }}
        />
      </label>
      <p className="journey-help" aria-live="polite">
        {selected.length} selected across all pages
      </p>
      {selected.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
        >
          Clear selected {kind}
        </Button>
      )}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRetry((x) => x + 1)}
          >
            Retry
          </Button>
        </div>
      ) : result ? (
        <>
          <ul>
            {result.items.map((item) => (
              <li key={item.id}>
                <label className="connection-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...selected, item.id]
                          : selected.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          {!result.items.length && <p>No matching {kind}.</p>}
          <div className="connection-pagination">
            <Button
              type="button"
              variant="outline"
              disabled={page === 1}
              onClick={() => {
                setPage((p) => p - 1);
                setResult(null);
              }}
            >
              Previous {kind}
            </Button>
            <span>Page {page}</span>
            <Button
              type="button"
              variant="outline"
              disabled={!result.has_more}
              onClick={() => {
                setPage((p) => p + 1);
                setResult(null);
              }}
            >
              Next {kind}
            </Button>
          </div>
        </>
      ) : (
        <p role="status">Loading {kind}…</p>
      )}
    </div>
  );
}
export function PermissionForm({
  owner,
  connection,
  authorization,
}: {
  owner: string;
  connection?: Connection;
  authorization?: { id: string; clientId: string };
}) {
  const [identity] = useState({ owner, connection, authorization });
  const action = identity.authorization
    ? authorizeConnection.bind(
        null,
        identity.owner,
        identity.authorization.id,
        identity.authorization.clientId,
      )
    : updateConnection.bind(
        null,
        identity.owner,
        identity.connection!.id,
        identity.connection!.revision,
      );
  const [state, submit, pending] = useActionState<ConnectionState, FormData>(
    action,
    {},
  );
  const [permissions, setPermissions] = useState<Permissions>(
    connection ?? emptyPermissions,
  );
  const [confirmed, setConfirmed] = useState(false);
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) alert.current?.focus();
  }, [state]);
  return (
    <form
      action={submit}
      className="tracking-form connection-form"
      onReset={(e) => e.preventDefault()}
    >
      {state.message && (
        <div
          role="alert"
          tabIndex={-1}
          ref={alert}
          className="tracking-form-error"
        >
          {state.message}
        </div>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Assistant read permissions</legend>
        {(["applications", "resumes"] as const).map((kind) => {
          const access =
            kind === "applications" ? "application_access" : "resume_access";
          const ids =
            kind === "applications" ? "application_ids" : "resume_ids";
          return (
            <section className="tracking-form-section" key={kind}>
              <h2>
                {kind === "applications"
                  ? "Applications and hiring journeys"
                  : "Resume library"}
              </h2>
              <p>
                {kind === "applications"
                  ? "Includes descriptions, notes, rounds, tasks, contacts and schedule history for the applications you allow."
                  : "Resume text can include your contact details and work history. Resume access is separate from application access."}
              </p>
              <label className="field-label mt-4">
                {kind === "applications"
                  ? "Application access"
                  : "Resume access"}
                <select
                  className="field"
                  name={access}
                  value={permissions[access]}
                  onChange={(e) => {
                    setPermissions((p) => ({ ...p, [access]: e.target.value }));
                    setConfirmed(false);
                  }}
                >
                  <option value="none">No access</option>
                  <option value="selected">Selected {kind} only</option>
                  <option value="all">
                    All {kind}, including future records
                  </option>
                </select>
              </label>
              {permissions[access] === "all" && (
                <p className="account-notice mt-4">
                  This includes every current and future{" "}
                  {kind === "applications"
                    ? "application and its hiring journey"
                    : "resume in your library"}
                  .
                </p>
              )}
              {permissions[access] === "selected" && (
                <RecordPicker
                  kind={kind}
                  selected={permissions[ids]}
                  onChange={(values) => {
                    setPermissions((p) => ({ ...p, [ids]: values }));
                    setConfirmed(false);
                  }}
                />
              )}
              {permissions[access] === "selected" &&
                permissions[ids].map((id) => (
                  <input key={id} type="hidden" name={ids} value={id} />
                ))}
            </section>
          );
        })}
        <p className="account-notice">
          Read access only. Your portal vault and credentials are never shared.
          Revoking access stops future reads; it cannot remove information
          already received by an assistant.
        </p>
        {authorization && (
          <label className="connection-check mt-5">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I approve this assistant reading the records selected above.
          </label>
        )}
        <div className="vault-buttons mt-6">
          {authorization && (
            <Button
              name="decision"
              value="deny"
              variant="outline"
              formNoValidate
            >
              Decline connection
            </Button>
          )}
          <Button
            name="decision"
            value="approve"
            disabled={pending || Boolean(authorization && !confirmed)}
          >
            {pending
              ? "Saving…"
              : authorization
                ? "Allow read access"
                : "Save permissions"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function RevokeForm({
  owner,
  connection,
}: {
  owner: string;
  connection: Connection;
}) {
  const [state, action, pending] = useActionState<ConnectionState, FormData>(
    revokeConnection.bind(null, owner, connection.id),
    {},
  );
  return (
    <form
      action={action}
      className="connection-revoke"
      onReset={(e) => e.preventDefault()}
    >
      <h2>Revoke access</h2>
      <p>
        Block this assistant from further reads. Reconnecting requires fresh
        authorization.
      </p>
      {state.message && (
        <p role="alert" className="account-notice">
          {state.message}
        </p>
      )}
      <label className="connection-check">
        <input
          type="checkbox"
          name="confirm"
          value="revoke"
          required
          disabled={pending}
        />
        Revoke this assistant’s access
      </label>
      <Button variant="outline" disabled={pending}>
        {pending
          ? "Revoking…"
          : connection.revoked_at
            ? "Retry provider revocation"
            : "Revoke connection"}
      </Button>
    </form>
  );
}
