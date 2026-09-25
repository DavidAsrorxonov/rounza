import { ApplicationPortals } from "@/features/vault/application-links";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplication } from "@/features/applications/data";
import { displayDate, safeJobUrl } from "@/features/applications/model";
import { StatusBadge } from "@/features/applications/shared";
import { DeleteApplication } from "@/features/applications/delete-dialog";

import { JourneySections } from "@/features/journey/views";
import { pageNumber } from "@/features/journey/model";

export const metadata: Metadata = { title: "Application details" };
export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    journey?: string;
    rounds?: string;
    tasks?: string;
    contacts?: string;
  }>;
}) {
  const [application, query] = await Promise.all([
    params.then((value) => getApplication(value.id)),
    searchParams,
  ]);
  const jobUrl = safeJobUrl(application.job_url);
  return (
    <>
      <Link href="/app/applications" className="back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        All applications
      </Link>
      {query.saved === "1" && (
        <p role="status" className="tracking-success">
          Application saved.
        </p>
      )}
      {query.journey && (
        <p role="status" className="tracking-success">
          {query.journey === "deleted"
            ? "Journey record deleted."
            : "Journey record saved."}
        </p>
      )}
      <div className="tracking-heading">
        <div className="min-w-0">
          <p className="eyebrow tracking-wrap">{application.company}</p>
          <h1 className="workspace-title tracking-wrap">{application.role}</h1>
          <p className="tracking-location">
            <MapPin size={15} aria-hidden="true" />
            {application.location || "Location not specified"}
          </p>
        </div>
        <Button asChild>
          <Link href={`/app/applications/${application.id}/edit`}>
            <Pencil size={15} aria-hidden="true" />
            Edit application
          </Link>
        </Button>
      </div>
      {["Offer", "Rejected", "Withdrawn"].includes(application.status) && (
        <p className="account-notice">
          This application is closed. Its rounds and tasks are kept here, and
          reminders are paused. Change the application status to resume them.
        </p>
      )}
      <JourneySections
        applicationId={application.id}
        pages={{
          rounds: pageNumber(query.rounds),
          tasks: pageNumber(query.tasks),
          contacts: pageNumber(query.contacts),
        }}
      />
      <ApplicationPortals applicationId={application.id} />
      <div className="tracking-detail-grid">
        <div className="space-y-6 min-w-0">
          <section className="tracking-detail-panel">
            <h2>The opportunity</h2>
            <p className="tracking-prose">
              {application.description || "No job description added yet."}
            </p>
          </section>
          <section className="tracking-detail-panel">
            <h2>Your notes</h2>
            <p className="tracking-prose">
              {application.notes ||
                "No notes yet. Add your thoughts when you’re ready."}
            </p>
          </section>
        </div>
        <aside className="tracking-detail-panel self-start">
          <h2>At a glance</h2>
          <dl className="tracking-facts">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={application.status} />
              </dd>
            </div>
            <div>
              <dt>Date applied</dt>
              <dd>
                {application.applied_on ? (
                  <time dateTime={application.applied_on}>
                    {displayDate(application.applied_on)}
                  </time>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>
                <time dateTime={application.created_at}>
                  {displayDate(application.created_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                <time dateTime={application.updated_at}>
                  {displayDate(application.updated_at)}
                </time>
              </dd>
            </div>
          </dl>
          {jobUrl && (
            <a
              href={jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tracking-posting"
            >
              Open job posting <ArrowUpRight size={15} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </aside>
      </div>
      <div className="tracking-delete">
        <p>
          No longer need this record? You can also mark it Withdrawn or Rejected
          to keep its details.
        </p>
        <DeleteApplication
          id={application.id}
          revision={application.revision}
          company={application.company}
        />
      </div>
    </>
  );
}
