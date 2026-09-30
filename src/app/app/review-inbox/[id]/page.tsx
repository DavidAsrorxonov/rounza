import type { Metadata } from "next";
import Link from "next/link";
import { getProposal } from "@/features/proposals/data";
import { recordHref } from "@/features/proposals/model";
import { ReviewForm } from "@/features/proposals/review-form";
import "@/app/connections.css";
import "@/app/review.css";
export const metadata: Metadata = { title: "Review proposal" };
export const dynamic = "force-dynamic";
const labels: Record<string, string> = {
  job_url: "Job URL",
  applied_on: "Date applied",
  scheduled_at: "Meeting time (with offset)",
  time_zone: "Time zone",
  duration_minutes: "Duration in minutes",
  due_on: "Deadline",
  meeting_url: "Meeting URL",
  schedule_note: "Schedule note",
  round_id: "Linked round",
  body: "Resume text",
};
const show = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "Empty"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const {
    proposal: p,
    owner,
    observedAt,
  } = await getProposal((await params).id);
  const expired = observedAt >= new Date(p.expires_at).getTime();
  return (
    <>
      <Link className="tracking-back" href="/app/review-inbox">
        Back to review inbox
      </Link>
      <header className="workspace-heading">
        <p className="eyebrow">ASSISTANT PROPOSAL</p>
        <h1 className="workspace-title">{p.title}</h1>
        <p>
          From {p.client_name} · Received {p.created_at.slice(0, 10)} (UTC)
        </p>
      </header>
      <p role="status" className="account-notice">
        {p.status === "approved"
          ? "Approved. All changes were applied together."
          : p.status === "rejected"
            ? "Rejected. No changes were applied."
            : expired
              ? "Expired. Ask your assistant for a fresh proposal."
              : "Pending review. Your records have not changed."}
      </p>
      <section className="review-summary">
        <h2>Why the assistant suggested this</h2>
        <p>{p.summary}</p>
        <p className="journey-help">
          Assistant-provided text can be wrong. Check facts, links, dates and
          resume claims before approving. This proposal expires{" "}
          {p.expires_at.slice(0, 10)} (UTC).
        </p>
      </section>
      <div className="review-changes">
        {p.changes.map((change, index) => {
          const fields = Object.keys(change.after).filter(
            (field) =>
              !change.before || change.before[field] !== change.after[field],
          );
          return (
            <section className="review-change" key={change.record_id}>
              <div className="review-change-heading">
                <h2>
                  {index + 1}.{" "}
                  {change.action === "create" ? "Create" : "Update"}{" "}
                  {change.entity}
                </h2>
                {change.action === "update" && (
                  <Link href={recordHref(change)}>Open current record</Link>
                )}
              </div>
              <p className="review-record-name">
                {change.entity === "application"
                  ? `${change.after.company} — ${change.after.role}`
                  : show(change.after.title ?? change.after.name)}
              </p>
              <p className="journey-help">
                {change.action === "create"
                  ? "New record"
                  : `Based on revision ${change.expected_revision}`}
                {change.application_revision !== null
                  ? ` · Application revision ${change.application_revision}`
                  : ""}
              </p>
              {"application_id" in change && (
                <p className="journey-help">
                  Application: {change.application_label}
                </p>
              )}
              {!fields.length && <p>No field changes.</p>}
              {fields.map((field) => (
                <div className="review-field" key={field}>
                  <h3>
                    {labels[field] ??
                      field[0].toUpperCase() +
                        field.slice(1).replaceAll("_", " ")}
                  </h3>
                  <div className="review-comparison">
                    {change.before && (
                      <div>
                        <h4>Before</h4>
                        <pre tabIndex={0} aria-label={`${field} before`}>
                          {show(change.before[field])}
                        </pre>
                      </div>
                    )}
                    <div>
                      <h4>Proposed</h4>
                      <pre tabIndex={0} aria-label={`${field} proposed`}>
                        {show(change.after[field])}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      {p.status === "pending" ? (
        <ReviewForm
          key={p.id}
          owner={owner}
          id={p.id}
          revision={p.revision}
          expired={expired}
        />
      ) : (
        p.status === "approved" && (
          <section className="review-summary">
            <h2>Applied records</h2>
            <ul>
              {p.result.map((r) => (
                <li key={r.record_id}>
                  <Link href={recordHref(r)}>Open {r.entity}</Link> · Applied
                  revision {r.revision}
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </>
  );
}
