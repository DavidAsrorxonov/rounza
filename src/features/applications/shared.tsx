import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { displayDate, type ApplicationSummary } from "./model";

export function StatusBadge({
  status,
}: {
  status: ApplicationSummary["status"];
}) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  );
}

export function ApplicationCard({
  application,
}: {
  application: ApplicationSummary;
}) {
  return (
    <Link
      href={`/app/applications/${application.id}`}
      className="tracking-card"
    >
      <div className="tracking-card-top">
        <span className="tracking-company">{application.company}</span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </div>
      <h3>{application.role}</h3>
      <p className="tracking-location">
        <MapPin size={14} aria-hidden="true" />
        {application.location || "Location not specified"}
      </p>
      <div className="tracking-card-footer">
        <StatusBadge status={application.status} />
        <span>Added {displayDate(application.created_at)}</span>
      </div>
    </Link>
  );
}

export function ApplicationList({
  applications,
}: {
  applications: ApplicationSummary[];
}) {
  return (
    <ul className="tracking-list" aria-label="Application list">
      {applications.map((application) => (
        <li key={application.id}>
          <Link
            href={`/app/applications/${application.id}`}
            className="tracking-row"
          >
            <span className="tracking-monogram" aria-hidden="true">
              {application.company.slice(0, 1).toUpperCase()}
            </span>
            <div className="tracking-row-identity">
              <h2>{application.role}</h2>
              <p>
                {application.company} ·{" "}
                {application.location || "Location not specified"}
              </p>
            </div>
            <StatusBadge status={application.status} />
            <time
              className="tracking-row-date"
              dateTime={application.created_at}
            >
              Added {displayDate(application.created_at)}
            </time>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
