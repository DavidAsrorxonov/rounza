import Link from "next/link";
import {
  CalendarClock,
  Check,
  Users,
  ListChecks,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayDate, safeJobUrl } from "@/features/applications/model";
import type { NextAction, HiringRound } from "@/lib/supabase/database.types";
import { TaskCompletion } from "./controls";
import { getJourney } from "./data";
import { PAGE_SIZE, bucketNames } from "./model";
import { formatMeeting } from "./time";

export function JourneyPagination({
  page,
  count,
  href,
  label,
}: {
  page: number;
  count: number;
  href: (page: number) => string;
  label: string;
}) {
  if (count <= PAGE_SIZE && page === 1) return null;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <nav className="journey-pagination" aria-label={label}>
      {page > 1 && (
        <Link href={href(Math.min(page - 1, pages))}>Previous page</Link>
      )}
      <span>
        Page {page} · {count} records
      </span>
      {page < pages && <Link href={href(page + 1)}>Next page</Link>}
      {page > pages && <Link href={href(1)}>Back to first page</Link>}
    </nav>
  );
}
export function RoundFacts({ round }: { round: HiringRound }) {
  const link = safeJobUrl(round.meeting_url);
  return (
    <div className="journey-round-facts">
      <p>
        {round.scheduled_at ? (
          <time dateTime={round.scheduled_at}>
            {formatMeeting(round.scheduled_at, round.time_zone)} ·{" "}
            {round.duration_minutes} minutes
          </time>
        ) : (
          "Meeting time not set"
        )}
      </p>
      {round.due_on && (
        <p>
          Deadline:{" "}
          <time dateTime={round.due_on}>{displayDate(round.due_on)}</time>
        </p>
      )}
      {round.location && <p>Location: {round.location}</p>}
      {round.people && <p>With: {round.people}</p>}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer">
          Open meeting <ArrowUpRight size={14} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
export async function JourneySections({
  applicationId,
  pages,
}: {
  applicationId: string;
  pages: { rounds: number; tasks: number; contacts: number };
}) {
  const journey = await getJourney(applicationId, pages);
  const base = `/app/applications/${applicationId}`;
  const pageHref = (section: keyof typeof pages, page: number) => {
    const params = new URLSearchParams(
      Object.entries({ ...pages, [section]: page }).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
    return `${base}?${params}#${section}`;
  };
  return (
    <div className="journey-sections">
      <section
        id="rounds"
        className="journey-section"
        aria-labelledby="rounds-heading"
      >
        <div className="tracking-section-heading">
          <div>
            <p className="eyebrow">
              <CalendarClock size={14} aria-hidden="true" /> THE HIRING JOURNEY
            </p>
            <h2 id="rounds-heading">
              Rounds & assessments{" "}
              <span className="journey-count">{journey.rounds.count}</span>
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href={`${base}/journey/round/new`}>
              <Plus size={15} aria-hidden="true" />
              Add round
            </Link>
          </Button>
        </div>
        {journey.rounds.rows.length === 0 && (
          <p className="journey-empty">
            No rounds on this page. Add a recruiter call, another interview, or
            an assessment as the process unfolds.
          </p>
        )}
        <ol className="journey-rounds" aria-label="Hiring rounds">
          {journey.rounds.rows.map((round) => (
            <li
              key={round.id}
              className="journey-round"
              id={`round-${round.id}`}
            >
              <div
                className="journey-order"
                aria-label={`Journey order ${round.position}`}
              >
                {round.position}
              </div>
              <div className="journey-round-body">
                <div className="journey-card-heading">
                  <div>
                    <p className="journey-kind">{round.kind}</p>
                    <h3>{round.title}</h3>
                  </div>
                  <span
                    className={`journey-status journey-status-${round.status.toLowerCase()}`}
                  >
                    {round.status}
                  </span>
                </div>
                <RoundFacts round={round} />
                {round.notes && (
                  <p className="tracking-prose journey-notes">{round.notes}</p>
                )}
                <div className="journey-links">
                  <Link href={`${base}/journey/round/${round.id}/edit`}>
                    Edit or reschedule
                  </Link>
                  <Link href={`${base}/journey/round/${round.id}`}>
                    Schedule history
                  </Link>
                  <Link href={`${base}/journey/task/new?round=${round.id}`}>
                    Add preparation task
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <JourneyPagination
          page={pages.rounds}
          count={journey.rounds.count}
          label="Rounds pages"
          href={(page) => pageHref("rounds", page)}
        />
      </section>
      <section
        id="tasks"
        className="journey-section"
        aria-labelledby="tasks-heading"
      >
        <div className="tracking-section-heading">
          <div>
            <p className="eyebrow">
              <ListChecks size={14} aria-hidden="true" /> MAKE YOUR NEXT MOVE
            </p>
            <h2 id="tasks-heading">
              Preparation tasks{" "}
              <span className="journey-count">{journey.tasks.count}</span>
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href={`${base}/journey/task/new`}>
              <Plus size={15} aria-hidden="true" />
              Add task
            </Link>
          </Button>
        </div>
        {journey.tasks.rows.length === 0 && (
          <p className="journey-empty">
            No tasks on this page. Keep follow-ups, preparation, and things to
            send here.
          </p>
        )}
        <ul className="journey-task-list" aria-label="Preparation tasks">
          {journey.tasks.rows.map((task) => (
            <li
              key={task.id}
              className={task.completed ? "journey-task-complete" : ""}
            >
              <div className="min-w-0">
                <h3>
                  {task.completed && <Check size={16} aria-label="Completed" />}
                  {task.title}
                </h3>
                <p className="journey-help">
                  {task.completed ? "Completed" : "To do"} ·{" "}
                  {task.due_on
                    ? `Due ${displayDate(task.due_on)}`
                    : "No due date"}
                </p>
                {task.notes && (
                  <p className="tracking-prose journey-notes">{task.notes}</p>
                )}
                <div className="journey-links">
                  <Link href={`${base}/journey/task/${task.id}/edit`}>
                    Edit task
                  </Link>
                  {task.round_id && (
                    <Link href={`${base}/journey/round/${task.round_id}`}>
                      View linked round
                    </Link>
                  )}
                </div>
              </div>
              <TaskCompletion
                key={`${task.id}:${task.revision}`}
                applicationId={applicationId}
                id={task.id}
                revision={task.revision}
                completed={task.completed}
              />
            </li>
          ))}
        </ul>
        <JourneyPagination
          page={pages.tasks}
          count={journey.tasks.count}
          label="Task pages"
          href={(page) => pageHref("tasks", page)}
        />
      </section>
      <section
        id="contacts"
        className="journey-section"
        aria-labelledby="contacts-heading"
      >
        <div className="tracking-section-heading">
          <div>
            <p className="eyebrow">
              <Users size={14} aria-hidden="true" /> PEOPLE ALONG THE WAY
            </p>
            <h2 id="contacts-heading">
              Contacts{" "}
              <span className="journey-count">{journey.contacts.count}</span>
            </h2>
          </div>
          <Button asChild variant="outline">
            <Link href={`${base}/journey/contact/new`}>
              <Plus size={15} aria-hidden="true" />
              Add contact
            </Link>
          </Button>
        </div>
        {journey.contacts.rows.length === 0 && (
          <p className="journey-empty">
            No contacts on this page. Keep your recruiter and interviewers close
            to the opportunity.
          </p>
        )}
        <ul className="journey-contacts" aria-label="Application contacts">
          {journey.contacts.rows.map((contact) => (
            <li key={contact.id}>
              <h3>{contact.name}</h3>
              {contact.role && <p>{contact.role}</p>}
              {contact.email && <p>{contact.email}</p>}
              {contact.phone && <p>{contact.phone}</p>}
              {contact.notes && (
                <p className="tracking-prose journey-notes">{contact.notes}</p>
              )}
              <Link href={`${base}/journey/contact/${contact.id}/edit`}>
                Edit contact
              </Link>
            </li>
          ))}
        </ul>
        <JourneyPagination
          page={pages.contacts}
          count={journey.contacts.count}
          label="Contact pages"
          href={(page) => pageHref("contacts", page)}
        />
      </section>
    </div>
  );
}
export function NextActionList({ actions }: { actions: NextAction[] }) {
  const labels = {
    task: "Task",
    meeting: "Meeting",
    deadline: "Deadline",
    round: "Plan a round",
  };
  return (
    <ol className="next-action-list" aria-label="Next actions">
      {actions.map((action) => (
        <li key={action.id}>
          <span className={`next-action-bucket bucket-${action.bucket}`}>
            {bucketNames[action.bucket]}
          </span>
          <div>
            <p className="journey-kind">
              {labels[action.source]} · {action.company}
            </p>
            <h3>
              <Link
                href={`/app/applications/${action.application_id}/journey/${action.source === "task" ? `task/${action.record_id}/edit` : `round/${action.record_id}`}`}
              >
                {action.title}
              </Link>
            </h3>
            <p className="journey-help">
              {action.due_at
                ? formatMeeting(action.due_at, action.time_zone)
                : action.due_on
                  ? `Due ${displayDate(action.due_on)}`
                  : "Choose the next date"}
            </p>
          </div>
          <Link
            href={`/app/applications/${action.application_id}`}
            className="journey-application-link"
          >
            View application
            <span className="sr-only"> at {action.company}</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
