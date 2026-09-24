import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getApplication } from "@/features/applications/data";
import { displayDate } from "@/features/applications/model";
import { getJourneyRecord, getScheduleHistory } from "@/features/journey/data";
import { pageNumber } from "@/features/journey/model";
import { RoundFacts, JourneyPagination } from "@/features/journey/views";
import { formatMeeting } from "@/features/journey/time";
import type { HiringRound } from "@/lib/supabase/database.types";
export const metadata = { title: "Round and schedule history" };
export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; type: string; recordId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const route = await params;
  const application = await getApplication(route.id);
  if (route.type !== "round") notFound();
  const round = (await getJourneyRecord(
    "round",
    application.id,
    route.recordId,
  )) as HiringRound;
  const page = pageNumber((await searchParams).page);
  const history = await getScheduleHistory(application.id, round.id, page);
  const base = `/app/applications/${application.id}`;
  return (
    <>
      <Link href={`${base}#rounds`} className="back-link">
        ← Back to application
      </Link>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">
            {application.company} · {round.kind} · {round.status}
          </p>
          <h1 className="workspace-title">{round.title}</h1>
        </div>
        <Button asChild>
          <Link href={`${base}/journey/round/${round.id}/edit`}>
            Edit or reschedule
          </Link>
        </Button>
      </div>
      <section className="tracking-detail-panel">
        <h2>Round details</h2>
        <RoundFacts round={round} />
        {round.notes && (
          <p className="tracking-prose journey-notes">{round.notes}</p>
        )}
        <div className="journey-links">
          <Link href={`${base}/journey/task/new?round=${round.id}`}>
            Add preparation task
          </Link>
          <Link href={`${base}#tasks`}>View preparation tasks</Link>
        </div>
      </section>
      <section className="journey-section mt-8">
        <h2>Schedule history</h2>
        <p className="journey-help">
          Times, deadlines, duration and status changes are saved automatically.
          Newest first.
        </p>
        <ol className="schedule-history" aria-label="Schedule history">
          {history.rows.map((entry) => (
            <li key={entry.id}>
              <p className="journey-kind">
                Recorded {formatMeeting(entry.created_at, "UTC")}
              </p>
              <h3>
                {entry.previous_status === null
                  ? "Round added"
                  : "Schedule or status updated"}
              </h3>
              {entry.previous_status !== null && (
                <div>
                  <strong>Before</strong>
                  <p>
                    {entry.previous_status} · {entry.previous_duration_minutes}{" "}
                    minutes
                  </p>
                  <p>
                    {entry.previous_at
                      ? formatMeeting(
                          entry.previous_at,
                          entry.previous_time_zone ?? "UTC",
                        )
                      : "Meeting time not set"}
                  </p>
                  <p>
                    {entry.previous_due_on
                      ? `Deadline: ${displayDate(entry.previous_due_on)}`
                      : "No deadline"}
                  </p>
                </div>
              )}
              <div>
                <strong>
                  {entry.previous_status === null
                    ? "Initial schedule"
                    : "After"}
                </strong>
                <p>
                  {entry.status} · {entry.duration_minutes} minutes
                </p>
                <p>
                  {entry.scheduled_at
                    ? formatMeeting(entry.scheduled_at, entry.time_zone)
                    : "Meeting time not set"}
                </p>
                <p>
                  {entry.due_on
                    ? `Deadline: ${displayDate(entry.due_on)}`
                    : "No deadline"}
                </p>
              </div>
              {entry.note && <p className="tracking-prose">{entry.note}</p>}
            </li>
          ))}
        </ol>
        <JourneyPagination
          page={page}
          count={history.count}
          label="History pages"
          href={(value) => `${base}/journey/round/${round.id}?page=${value}`}
        />
      </section>
    </>
  );
}
