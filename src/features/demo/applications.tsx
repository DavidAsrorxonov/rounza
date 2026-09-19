"use client";

import Link from "next/link";
import { ArrowRight, LayoutGrid, List, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddApplication } from "./add-application";
import {
  statuses,
  type ApplicationStatus,
  formatDay,
  nextRound,
  isActive,
} from "./model";
import {
  ApplicationCard,
  CompanyMark,
  DemoLoading,
  EmptyState,
  StatusBadge,
} from "./shared";
import { useDemo } from "./store";

export function Applications() {
  const demo = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "All">("All");
  const [view, setView] = useState<"list" | "board">("list");
  if (!demo) return <DemoLoading />;
  const applications = demo.data.applications.filter(
    (application) =>
      (status === "All" || application.status === status) &&
      `${application.company} ${application.role} ${application.location}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EVERY POSSIBILITY, TOGETHER</p>
          <h1>
            Your applications<span className="text-primary">.</span>
          </h1>
          <p>From “this looks interesting” to “you’re hired.”</p>
        </div>
        <AddApplication />
      </div>
      <div className="applications-toolbar">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search applications"
            placeholder="Search company, role, or location…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <label className="sr-only" htmlFor="status-filter">
          Filter by status
        </label>
        <select
          id="status-filter"
          className="field status-filter"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as ApplicationStatus | "All")
          }
        >
          <option value="All">All statuses</option>
          {statuses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <div className="view-toggle" aria-label="Application view">
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            className={cn(view === "list" && "selected")}
            onClick={() => setView("list")}
          >
            <List size={17} />
            <span>List</span>
          </button>
          <button
            aria-label="Board view"
            aria-pressed={view === "board"}
            className={cn(view === "board" && "selected")}
            onClick={() => setView("board")}
          >
            <LayoutGrid size={16} />
            <span>Board</span>
          </button>
        </div>
      </div>
      <p role="status" className="results-count">
        {applications.length}{" "}
        {applications.length === 1 ? "application" : "applications"}
        {status !== "All" ? ` · ${status}` : ""}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
      </p>
      {!applications.length ? (
        <div className="panel">
          <EmptyState
            title="No matches this time"
            description="Try another company, role, or status. Your other applications are still here."
          >
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatus("All");
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        </div>
      ) : view === "list" ? (
        <section
          className="panel applications-list"
          aria-label="Application list"
        >
          <div className="application-table-head" aria-hidden="true">
            <span>COMPANY & ROLE</span>
            <span>STATUS</span>
            <span>NEXT STEP</span>
            <span>ADDED</span>
            <span />
          </div>
          <ul>
            {applications.map((application) => {
              const next = isActive(application.status)
                ? nextRound(application)
                : undefined;
              return (
                <li key={application.id}>
                  <Link
                    className="application-row"
                    href={`/demo/applications/${application.id}`}
                  >
                    <div className="application-identity">
                      <CompanyMark application={application} />
                      <div className="min-w-0">
                        <h2>{application.role}</h2>
                        <p>
                          {application.company}{" "}
                          <span aria-hidden="true">·</span>{" "}
                          {application.location || "Location not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="application-status">
                      <StatusBadge status={application.status} />
                    </div>
                    <div className="application-next">
                      <span>
                        {next
                          ? next.title
                          : !isActive(application.status)
                            ? "Journey closed"
                            : "Ready for the next step"}
                      </span>
                      {next?.scheduledAt && (
                        <small>
                          {formatDay(next.scheduledAt.slice(0, 10))}
                        </small>
                      )}
                    </div>
                    <time
                      className="application-added"
                      dateTime={application.addedOn}
                    >
                      {formatDay(application.addedOn)}
                    </time>
                    <ArrowRight
                      className="application-arrow"
                      size={16}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div
          className="board-container"
          tabIndex={0}
          role="region"
          aria-label="Application board. Scroll horizontally to see all statuses."
        >
          <div className="application-board">
            {statuses
              .filter((value) => status === "All" || status === value)
              .map((value) => {
                const column = applications.filter(
                  (application) => application.status === value,
                );
                return (
                  <section
                    className="board-column"
                    key={value}
                    aria-label={`${value} applications`}
                  >
                    <div className="board-heading">
                      <StatusBadge status={value} />
                      <span className="count-chip">{column.length}</span>
                    </div>
                    <div className="board-cards">
                      {column.map((application) => (
                        <ApplicationCard
                          key={application.id}
                          application={application}
                        />
                      ))}
                      {!column.length && (
                        <p className="board-empty">No applications here yet.</p>
                      )}
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        Open an application to update its status and explore its hiring journey.
        {view === "board" && " Scroll the board to see every stage."}
      </p>
    </>
  );
}
