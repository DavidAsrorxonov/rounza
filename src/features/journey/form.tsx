"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveJourney } from "./actions";
import { fields } from "./fields";
import type { JourneyType, JourneyState } from "./model";

export function JourneyForm({
  type,
  applicationId,
  id,
  revision,
  roundId,
  initial,
}: {
  type: JourneyType;
  applicationId: string;
  id: string | null;
  revision: number | null;
  roundId: string | null;
  initial: Record<string, string>;
}) {
  const [values, setValues] = useState(initial);
  // Freeze the version paired with this draft; retries must not adopt newer props.
  const [identity] = useState({ id, revision, applicationId, roundId, type });
  const [state, action, pending] = useActionState<JourneyState, FormData>(
    saveJourney.bind(
      null,
      identity.type,
      identity.applicationId,
      identity.id,
      identity.revision,
      identity.roundId,
    ),
    {},
  );
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) summary.current?.focus();
  }, [state]);
  const back = `/app/applications/${applicationId}#${type}s`;
  const optionLabel: Record<string, string> = {
    reject: "Ask me if ambiguous",
    earlier: "First occurrence",
    later: "Second occurrence",
    false: "To do",
    true: "Completed",
  };
  return (
    <form action={action} className="tracking-form">
      {state.message && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="tracking-form-error"
        >
          <p>{state.message}</p>
          {state.conflict && (
            <a
              href={back}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Open latest version in a new tab
            </a>
          )}
        </div>
      )}
      <fieldset disabled={pending} className="tracking-form-section">
        <legend className="sr-only">{type} details</legend>
        <div className="tracking-form-grid">
          {fields[type].map((field) => {
            const error = state.errors?.[field.name]?.[0];
            const control = {
              id: field.name,
              name: field.name,
              value: values[field.name],
              className: "field",
              required: field.required,
              "aria-invalid": Boolean(error),
              "aria-describedby":
                [
                  field.help ? `${field.name}-help` : "",
                  error ? `${field.name}-error` : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined,
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                >,
              ) => {
                const value = event.target.value;
                setValues((current) => ({
                  ...current,
                  [field.name]: value,
                  ...(["scheduled_local", "time_zone"].includes(field.name)
                    ? { occurrence: "reject" }
                    : {}),
                }));
              },
            };
            return (
              <div
                key={field.name}
                className={`field-label ${field.wide ? "journey-field-wide" : ""}`}
              >
                <label htmlFor={field.name}>
                  {field.label}
                  {field.required && (
                    <span className="tracking-required"> (required)</span>
                  )}
                </label>
                {field.options ? (
                  <select {...control}>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {optionLabel[option] ?? option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea {...control} rows={4} maxLength={field.maxLength} />
                ) : (
                  <input
                    {...control}
                    type={field.type ?? "text"}
                    maxLength={field.maxLength}
                    min={field.min}
                    max={field.max}
                    step={field.type === "datetime-local" ? 60 : undefined}
                  />
                )}
                {field.help && (
                  <span className="journey-help" id={`${field.name}-help`}>
                    {field.help}
                  </span>
                )}
                {field.name === "time_zone" && (
                  <button
                    type="button"
                    className="journey-text-button"
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        time_zone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                        occurrence: "reject",
                      }))
                    }
                  >
                    Use my time zone
                  </button>
                )}
                {error && (
                  <span
                    className="tracking-field-error"
                    id={`${field.name}-error`}
                  >
                    {error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="tracking-form-footer">
        <p>Save to keep your changes.</p>
        <div>
          <Button asChild variant="outline">
            <Link href={back}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : id ? "Save changes" : `Add ${type}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
