"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveApplication } from "./actions";
import {
  statuses,
  type Application,
  type ApplicationFields,
  type FormState,
} from "./model";

export function ApplicationForm({
  application,
}: {
  application?: Application;
}) {
  const [values, setValues] = useState<ApplicationFields>({
    company: application?.company ?? "",
    role: application?.role ?? "",
    status: application?.status ?? "Saved",
    location: application?.location ?? "",
    job_url: application?.job_url ?? "",
    applied_on: application?.applied_on ?? "",
    description: application?.description ?? "",
    notes: application?.notes ?? "",
  });
  // Keep the version that these edits started from, even if a server render
  // brings newer props. Retrying a stale form must never overwrite that version.
  const [identity] = useState({
    id: application?.id ?? null,
    revision: application?.revision ?? null,
  });
  const action = saveApplication.bind(null, identity.id, identity.revision);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message) errorSummary.current?.focus();
  }, [state]);
  const cancelHref = application
    ? `/app/applications/${application.id}`
    : "/app/applications";
  function field(name: keyof ApplicationFields) {
    return {
      name,
      id: name,
      value: values[name],
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => setValues({ ...values, [name]: event.target.value }),
      "aria-invalid": Boolean(state.errors?.[name]),
      "aria-describedby": state.errors?.[name] ? `${name}-error` : undefined,
    };
  }
  function error(name: keyof ApplicationFields) {
    return (
      state.errors?.[name] && (
        <span id={`${name}-error`} className="tracking-field-error">
          {state.errors[name]?.[0]}
        </span>
      )
    );
  }
  return (
    <form action={formAction} className="tracking-form">
      {state.message && (
        <div
          ref={errorSummary}
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
      <fieldset disabled={pending}>
        <legend className="sr-only">Application details</legend>
        <section className="tracking-form-section">
          <h2>The opportunity</h2>
          <p>
            Start with the essentials. You can add more details whenever you’re
            ready.
          </p>
          <div className="tracking-form-grid">
            <div className="field-label">
              <label htmlFor="company">
                Company <span className="tracking-required">(required)</span>
              </label>
              <input
                {...field("company")}
                className="field"
                required
                maxLength={160}
                autoComplete="off"
                placeholder="e.g. Northstar"
              />
              {error("company")}
            </div>
            <div className="field-label">
              <label htmlFor="role">
                Role title <span className="tracking-required">(required)</span>
              </label>
              <input
                {...field("role")}
                className="field"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="e.g. Product Designer"
              />
              {error("role")}
            </div>
            <div className="field-label">
              <label htmlFor="location">Location</label>
              <input
                {...field("location")}
                className="field"
                maxLength={200}
                placeholder="City, remote, or hybrid"
              />
              {error("location")}
            </div>
            <div className="field-label">
              <label htmlFor="job_url">Job posting URL</label>
              <input
                {...field("job_url")}
                type="url"
                className="field"
                maxLength={2048}
                placeholder="https://…"
              />
              {error("job_url")}
            </div>
            <div className="field-label">
              <label htmlFor="status">Application status</label>
              <select {...field("status")} className="field">
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              {error("status")}
            </div>
            <div className="field-label">
              <label htmlFor="applied_on">
                Date applied{" "}
                <span className="tracking-required">(optional)</span>
              </label>
              <input
                {...field("applied_on")}
                type="date"
                className="field"
                min="0001-01-01"
                max="9999-12-31"
              />
              {error("applied_on")}
            </div>
          </div>
        </section>
        <section className="tracking-form-section">
          <h2>A place for the details</h2>
          <p>Keep the job description and your own thoughts together.</p>
          <div className="field-label mt-6">
            <label htmlFor="description">Job description</label>
            <textarea
              {...field("description")}
              className="field min-h-48 resize-y"
              maxLength={50000}
              placeholder="Paste the job description…"
            />
            {error("description")}
          </div>
          <div className="field-label mt-6">
            <label htmlFor="notes">Notes</label>
            <textarea
              {...field("notes")}
              className="field min-h-36 resize-y"
              maxLength={20000}
              placeholder="What interests you, questions to ask, things to remember…"
            />
            {error("notes")}
          </div>
        </section>
      </fieldset>
      <div className="tracking-form-footer">
        <p>
          Changes are saved when you choose{" "}
          {application ? "Save changes" : "Add application"}.
        </p>
        <div>
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : application
                ? "Save changes"
                : "Add application"}
          </Button>
        </div>
      </div>
    </form>
  );
}
