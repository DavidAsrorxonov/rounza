"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Circle,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type DemoApplication,
  type HiringRound,
  formatDay,
  formatAppointment,
  isActive,
  offsetDay,
  statuses,
  statusSchema,
} from "./model";
import {
  CompanyMark,
  DemoLoading,
  EmptyState,
  Modal,
  SampleAnalysis,
  StatusBadge,
  TaskRow,
} from "./shared";
import { demoActions, useDemo } from "./store";

function ScheduleRound({
  application,
  round,
}: {
  application: DemoApplication;
  round: HiringRound;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={
        round.scheduledAt
          ? "Make room for a new time"
          : "Put it on the calendar"
      }
      description={`${round.title} at ${application.company}. The demo uses your device’s time zone.`}
      trigger={
        <Button variant="outline" size="sm">
          <CalendarDays size={13} aria-hidden="true" />
          {round.scheduledAt ? "Reschedule" : "Schedule round"}
        </Button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(
            new FormData(event.currentTarget).get("scheduledAt"),
          );
          demoActions.reschedule(application.id, round.id, value);
          setOpen(false);
        }}
      >
        <label className="field-label">
          Date and time
          <input
            className="field"
            type="datetime-local"
            name="scheduledAt"
            required
            defaultValue={round.scheduledAt ?? `${offsetDay(1)}T10:00`}
            min="2000-01-01T00:00"
            max="2100-12-31T23:59"
          />
        </label>
        {round.scheduledAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Currently: {formatAppointment(round.scheduledAt)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit">Save schedule</Button>
        </div>
      </form>
    </Modal>
  );
}

function Journey({ application }: { application: DemoApplication }) {
  const completed = application.rounds.filter(
    (round) => round.state === "Completed",
  ).length;
  return (
    <section className="panel journey-panel">
      <div className="panel-heading">
        <h2>Every round, connected</h2>
        <span className="text-xs text-muted-foreground">
          {completed} of {application.rounds.length} completed
        </span>
      </div>
      <p className="panel-description">
        A clear picture of where you’ve been and what’s ahead.
      </p>
      {application.rounds.length ? (
        <ol className="journey-timeline">
          {application.rounds.map((round, index) => (
            <li
              key={round.id}
              className={cn(
                "journey-round",
                round.state === "Completed" && "round-completed",
                round.state === "Scheduled" && "round-scheduled",
              )}
            >
              <span className="round-marker" aria-hidden="true">
                {round.state === "Completed" ? (
                  <Check size={15} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <div className="round-content">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="eyebrow">{round.kind}</span>
                  <span
                    className={cn(
                      "round-state",
                      `round-state-${round.state.toLowerCase()}`,
                    )}
                  >
                    {round.state}
                  </span>
                </div>
                <h3>{round.title}</h3>
                <div className="round-meta">
                  <span>
                    <CalendarDays size={13} aria-hidden="true" />
                    {round.scheduledAt ? (
                      <time dateTime={round.scheduledAt}>
                        {formatAppointment(round.scheduledAt)}
                      </time>
                    ) : (
                      "Date to be confirmed"
                    )}
                  </span>
                  <span>
                    <Clock3 size={13} aria-hidden="true" />
                    {round.duration}
                  </span>
                </div>
                <p className="round-description">{round.description}</p>
                {isActive(application.status) &&
                  round.state !== "Completed" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ScheduleRound application={application} round={round} />
                      {round.state === "Scheduled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            demoActions.completeRound(application.id, round.id)
                          }
                        >
                          <Check size={14} aria-hidden="true" /> Mark complete
                        </Button>
                      )}
                    </div>
                  )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Every journey starts somewhere"
          description="This application has no hiring rounds yet. Open Northstar to explore a sample journey with five stages."
        >
          <Button variant="outline" asChild>
            <Link href="/demo/applications/northstar">
              Explore Northstar’s journey
            </Link>
          </Button>
        </EmptyState>
      )}
      <p className="panel-footnote">
        Completing a round doesn’t change the application’s overall status.
      </p>
    </section>
  );
}

function Notes({ application }: { application: DemoApplication }) {
  const [notes, setNotes] = useState(application.notes);
  return (
    <div className="space-y-5">
      <section className="panel p-6">
        <div className="flex items-center gap-2">
          <MessageSquare
            size={18}
            className="text-primary"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold tracking-tight">
            A place for the details
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions to ask, impressions to remember, and thoughts for later.
        </p>
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            demoActions.saveNotes(application.id, notes);
          }}
        >
          <label className="field-label" htmlFor="application-notes">
            Sample notes
          </label>
          <textarea
            id="application-notes"
            className="field min-h-52 resize-y"
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Try writing a fictional note…"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {notes.length}/4,000 ·{" "}
              {notes !== application.notes
                ? "Unsaved edits"
                : "Saved in this tab"}
            </span>
            <Button type="submit" disabled={notes === application.notes}>
              Save notes
            </Button>
          </div>
        </form>
      </section>
      <section className="panel p-6">
        <h2 className="text-lg font-semibold tracking-tight">Your contact</h2>
        {application.contact ? (
          <div className="mt-5 flex items-start gap-3">
            <span className="contact-avatar">
              <UserRound size={20} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-medium">{application.contact.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {application.contact.role}
              </p>
              <p className="mt-2 break-all text-sm text-primary">
                {application.contact.email}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Fictional contact · example address
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No contact in this sample application.
          </p>
        )}
      </section>
    </div>
  );
}

function PortalExample() {
  const [visible, setVisible] = useState(false);
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole size={16} aria-hidden="true" /> Employer portal
        </h2>
        <span className="sample-tag">EXAMPLE</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        A place for the portal that comes with your application.
      </p>
      <div className="mt-4 rounded-lg bg-muted p-3">
        <p className="text-xs font-medium">careers.example.com</p>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
          alex.rivera@example.com
        </p>
        <p
          className="mt-2 break-all font-mono text-xs"
          aria-label="Sample password"
        >
          {visible ? "demo-password-only" : "••••••••••••"}
        </p>
      </div>
      <button
        className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"
        onClick={() => setVisible(!visible)}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff size={14} aria-hidden="true" />
        ) : (
          <Eye size={14} aria-hidden="true" />
        )}
        {visible ? "Hide sample password" : "Reveal sample password"}
      </button>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Fake credentials for illustration. This is not a secure vault. Never
        enter real passwords in the demo.
      </p>
    </section>
  );
}

export function ApplicationDetail({ id }: { id: string }) {
  const demo = useDemo();
  if (!demo) return <DemoLoading />;
  const application = demo.data.applications.find((item) => item.id === id);
  if (!application)
    return (
      <div className="panel">
        <EmptyState
          title="This sample application isn’t here"
          description="It may have been removed by a demo reset, or the link may be incorrect."
        >
          <Button asChild>
            <Link href="/demo/applications">Back to applications</Link>
          </Button>
        </EmptyState>
      </div>
    );
  return (
    <>
      <Link href="/demo/applications" className="back-link">
        <ChevronLeft size={15} aria-hidden="true" /> All applications
      </Link>
      <div className="detail-heading">
        <CompanyMark application={application} />
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {application.company}
          </p>
          <h1>{application.role}</h1>
          <div className="detail-meta">
            <span>
              <MapPin size={14} aria-hidden="true" />
              {application.location || "Location not specified"}
            </span>
            <span>{application.salary}</span>
          </div>
        </div>
        <div className="detail-status">
          <label htmlFor="application-status" className="eyebrow mb-2 block">
            APPLICATION STATUS
          </label>
          <select
            className="field"
            id="application-status"
            value={application.status}
            onChange={(event) =>
              demoActions.setStatus(
                application.id,
                statusSchema.parse(event.target.value),
              )
            }
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>
      {!isActive(application.status) && (
        <p className="closed-banner">
          <Check size={16} aria-hidden="true" />
          This journey is closed. Its history is kept, and its tasks and rounds
          are excluded from upcoming reminders.
        </p>
      )}
      <div className="detail-grid">
        <div className="min-w-0">
          <Tabs.Root defaultValue="journey" className="detail-tabs">
            <Tabs.List
              aria-label="Application details"
              className="detail-tab-list"
            >
              <Tabs.Trigger value="journey">
                <Circle size={15} aria-hidden="true" />
                Hiring journey
              </Tabs.Trigger>
              <Tabs.Trigger value="job">
                <FileText size={15} aria-hidden="true" />
                Job details
              </Tabs.Trigger>
              <Tabs.Trigger value="notes">
                <MessageSquare size={15} aria-hidden="true" />
                Notes & contact
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="journey">
              <Journey application={application} />
            </Tabs.Content>
            <Tabs.Content value="job">
              <section className="panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    The opportunity
                  </h2>
                  <StatusBadge status={application.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Fictional job description · added{" "}
                  {formatDay(application.addedOn)}
                </p>
                <p className="mt-6 text-sm leading-loose whitespace-pre-wrap text-muted-foreground">
                  {application.description}
                </p>
              </section>
            </Tabs.Content>
            <Tabs.Content value="notes">
              <Notes key={application.id} application={application} />
            </Tabs.Content>
          </Tabs.Root>
          <section className="panel mt-6 p-6">
            <h2 className="text-sm font-semibold">Along the way</h2>
            <ol className="history-list">
              {application.history.map((event) => (
                <li key={event.id}>
                  <span aria-hidden="true" />
                  <p>{event.text}</p>
                  <time dateTime={event.date}>{formatDay(event.date)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <div className="panel-heading">
              <h2>Your next steps</h2>
              <span className="count-chip">
                {application.tasks.filter((task) => !task.done).length}
              </span>
            </div>
            {isActive(application.status) ? (
              application.tasks.length ? (
                <ul className="detail-task-list">
                  {application.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      application={application}
                      task={task}
                      showCompany={false}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                  No tasks in this sample yet. Explore Northstar for a
                  ready-to-try checklist.
                </p>
              )
            ) : (
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                No active reminders for a closed journey. Reopen the application
                to return to its checklist.
              </p>
            )}
          </section>
          {id === "northstar" && (
            <>
              <PortalExample />
              <section className="sample-ai-panel">
                <Sparkles size={20} aria-hidden="true" />
                <h2 className="mt-3 font-semibold">
                  Make your experience count.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  See a sample comparison between this role and a fictional
                  resume.
                </p>
                <div className="mt-4">
                  <SampleAnalysis />
                </div>
              </section>
            </>
          )}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            All dates and times use your device’s time zone. Everything in this
            workspace is sample data.
          </p>
        </aside>
      </div>
    </>
  );
}
