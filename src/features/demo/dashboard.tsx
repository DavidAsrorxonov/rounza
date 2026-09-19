"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddApplication } from "./add-application";
import { dateKey, formatAppointment, formatDay, isActive } from "./model";
import {
  ApplicationCard,
  CompanyMark,
  DemoLoading,
  EmptyState,
  SampleAnalysis,
  TaskRow,
} from "./shared";
import { useDemo } from "./store";

export function Dashboard() {
  const demo = useDemo();
  const [taskView, setTaskView] = useState("Upcoming");
  if (!demo) return <DemoLoading />;
  const applications = demo.data.applications;
  const active = applications.filter((application) =>
    isActive(application.status),
  );
  const tasks = active
    .flatMap((application) =>
      application.tasks.map((task) => ({ application, task })),
    )
    .sort((a, b) => a.task.dueOn.localeCompare(b.task.dueOn));
  const visibleTasks = tasks.filter(({ task }) =>
    taskView === "Completed"
      ? task.done
      : !task.done && (taskView !== "Today" || task.dueOn <= dateKey()),
  );
  const events = active
    .flatMap((application) =>
      application.rounds
        .filter(
          (round) =>
            round.state === "Scheduled" &&
            round.scheduledAt &&
            new Date(round.scheduledAt).getTime() >= Date.now(),
        )
        .map((round) => ({ application, round })),
    )
    .sort((a, b) => a.round.scheduledAt!.localeCompare(b.round.scheduledAt!));
  const inProgress = active.filter(
    (application) => application.status === "Interviewing",
  );
  const metrics = [
    {
      label: "Applications",
      value: applications.length,
      detail: "Possibilities in one place",
      icon: BriefcaseBusiness,
    },
    {
      label: "In progress",
      value: active.length,
      detail: "Your search is moving",
      icon: ArrowUpRight,
    },
    {
      label: "Upcoming rounds",
      value: events.length,
      detail: "A chance to connect",
      icon: CalendarDays,
    },
    {
      label: "Offers received",
      value: applications.filter(
        (application) => application.status === "Offer",
      ).length,
      detail: "Something to celebrate",
      icon: Sparkles,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {formatDay(dateKey(), {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>
            Your next move,{" "}
            <span className="font-normal text-muted-foreground">in focus.</span>
          </h1>
          <p>A little clarity for the day. A little closer to what’s next.</p>
        </div>
        <AddApplication />
      </div>
      <section
        aria-label="Your job search at a glance"
        className="metrics-grid"
      >
        {metrics.map(({ label, value, detail, icon: Icon }, index) => (
          <div
            key={label}
            className={cn("metric", index === 3 && "metric-highlight")}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel tasks-panel">
          <div className="panel-heading">
            <h2>
              One thing at a time{" "}
              <span className="count-chip">
                {tasks.filter(({ task }) => !task.done).length}
              </span>
            </h2>
            <span className="text-xs text-muted-foreground">YOUR TO-DOS</span>
          </div>
          <div className="task-filters" aria-label="Filter tasks">
            {["Upcoming", "Today", "Completed"].map((view) => (
              <button
                key={view}
                aria-pressed={taskView === view}
                onClick={() => setTaskView(view)}
                className={cn(taskView === view && "selected")}
              >
                {view}
                {view === "Today" && (
                  <span>
                    {
                      tasks.filter(
                        ({ task }) => !task.done && task.dueOn <= dateKey(),
                      ).length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>
          {visibleTasks.length ? (
            <ul className="task-list">
              {visibleTasks.map(({ application, task }) => (
                <TaskRow
                  key={`${application.id}-${task.id}`}
                  application={application}
                  task={task}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title={
                taskView === "Completed"
                  ? "Your progress will show up here"
                  : "You’re all caught up"
              }
              description={
                taskView === "Completed"
                  ? "Check off a task to see it here. You can always reopen it."
                  : "There’s nothing waiting in this view. Take a breath, or explore your applications."
              }
            />
          )}
          <div className="panel-footnote">
            <Check size={13} aria-hidden="true" /> Every small step counts.
          </div>
        </section>
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <h2>On the horizon</h2>
            <CalendarDays
              size={18}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <p className="panel-description">
            Your next conversations, at a glance.
          </p>
          {events.length ? (
            <ol className="event-list">
              {events.slice(0, 3).map(({ application, round }, index) => (
                <li key={`${application.id}-${round.id}`}>
                  <Link
                    href={`/demo/applications/${application.id}`}
                    className={cn(
                      "event-card",
                      index === 0 && "event-featured",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <CompanyMark application={application} small />
                      <span className="text-sm font-medium">
                        {application.company}
                      </span>
                      <ArrowUpRight
                        className="ml-auto"
                        size={16}
                        aria-hidden="true"
                      />
                    </div>
                    <h3>{round.title}</h3>
                    <p>
                      <Clock3 size={13} aria-hidden="true" />
                      <time dateTime={round.scheduledAt!}>
                        {formatAppointment(round.scheduledAt!)}
                      </time>
                      <span>· {round.duration}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Room for what’s next"
              description="Scheduled rounds from active applications will appear here."
            />
          )}
          <p className="panel-footnote">
            Times shown in your device’s time zone.
          </p>
        </section>
      </div>
      <div className="overview-grid mt-7">
        <section>
          <div className="section-heading">
            <h2>In the running</h2>
            <Link href="/demo/applications">
              All applications <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {inProgress.length ? (
            <div className="running-grid">
              {inProgress.slice(0, 3).map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                />
              ))}
            </div>
          ) : (
            <div className="panel">
              <EmptyState
                title="Your next chapter is taking shape"
                description="Applications marked Interviewing appear here, so you can keep every conversation in view."
              />
            </div>
          )}
        </section>
        <section className="ai-promo">
          <div className="flex items-center justify-between">
            <span className="ai-example-badge">
              <Sparkles size={12} aria-hidden="true" /> AI PREVIEW
            </span>
            <span className="ai-orbit" aria-hidden="true">
              ✳
            </span>
          </div>
          <h2>
            A second pair
            <br /> of eyes.
          </h2>
          <p>
            Find the strongest story in your experience. See how a resume can
            speak to a role.
          </p>
          <SampleAnalysis
            trigger={
              <Button className="mt-5 w-full justify-between bg-white text-primary hover:bg-white/90">
                Explore a sample analysis{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Button>
            }
          />
          <span className="mt-3 block text-[11px] text-white/70">
            Precomputed example · fictional resume
          </span>
        </section>
      </div>
    </>
  );
}
