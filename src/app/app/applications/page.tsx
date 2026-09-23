import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listApplications } from "@/features/applications/data";
import {
  applicationsHref,
  PAGE_SIZE,
  parseFilters,
  sortOptions,
  statuses,
} from "@/features/applications/model";
import {
  ApplicationCard,
  ApplicationList,
  StatusBadge,
} from "@/features/applications/shared";

export const metadata: Metadata = { title: "Your applications" };
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const { applications, count, outOfRange } = await listApplications(filters);
  const emptyPage = outOfRange || (filters.page > 1 && !applications.length);
  const filtered = Boolean(filters.q || filters.status !== "All");
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">ONE SEARCH. EVERY POSSIBILITY.</p>
          <h1 className="workspace-title">Your applications.</h1>
          <p className="workspace-intro">
            A clear view of every opportunity you’re exploring.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/applications/new">
            <Plus size={17} aria-hidden="true" />
            Add application
          </Link>
        </Button>
      </div>
      {params.deleted === "1" && (
        <p role="status" className="tracking-success">
          Application deleted.
        </p>
      )}
      <form action="/app/applications" className="tracking-filters">
        <div className="field-label tracking-search">
          <label htmlFor="search">Search applications</label>
          <div>
            <Search size={17} aria-hidden="true" />
            <input
              id="search"
              name="q"
              className="field"
              type="search"
              defaultValue={filters.q}
              maxLength={120}
              placeholder="Company, role, or location"
            />
          </div>
        </div>
        <div className="field-label">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            className="field"
            name="status"
            defaultValue={filters.status}
          >
            <option value="All">All statuses</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="field-label">
          <label htmlFor="sort">Sort by</label>
          <select
            id="sort"
            className="field"
            name="sort"
            defaultValue={filters.sort}
          >
            {Object.entries(sortOptions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="view" value={filters.view} />
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>
      <div className="tracking-results">
        <p role="status">
          {emptyPage
            ? "No applications on this page"
            : `${count} ${count === 1 ? "application" : "applications"}`}
          {filters.status !== "All" && ` · ${filters.status}`}
          {filters.q && <> matching “{filters.q}”</>}
        </p>
        <nav className="tracking-view-switch" aria-label="Application view">
          <Link
            href={applicationsHref(filters, { view: "list" })}
            aria-current={filters.view === "list" ? "page" : undefined}
          >
            <List size={16} aria-hidden="true" />
            List
          </Link>
          <Link
            href={applicationsHref(filters, { view: "board" })}
            aria-current={filters.view === "board" ? "page" : undefined}
          >
            <Columns3 size={16} aria-hidden="true" />
            Board
          </Link>
        </nav>
      </div>
      {!applications.length ? (
        <section className="tracking-empty">
          <span aria-hidden="true" className="tracking-empty-symbol">
            ↗
          </span>
          <h2>
            {emptyPage
              ? "You’ve reached the end."
              : filtered
                ? "No matches this time."
                : "Your next chapter starts with one."}
          </h2>
          <p>
            {emptyPage
              ? "Return to the first page to see your current applications."
              : filtered
                ? "Try another company, role, location, or status."
                : "Save an interesting opportunity, or add a job you’ve already applied for."}
          </p>
          <Button asChild>
            <Link
              href={
                emptyPage
                  ? applicationsHref(filters, { page: 1 })
                  : filtered
                    ? "/app/applications"
                    : "/app/applications/new"
              }
            >
              {emptyPage
                ? "Back to first page"
                : filtered
                  ? "Clear filters"
                  : "Add your first application"}
            </Link>
          </Button>
        </section>
      ) : filters.view === "list" ? (
        <ApplicationList applications={applications} />
      ) : (
        <div
          className="board-container"
          tabIndex={0}
          role="region"
          aria-label="Application board. Scroll horizontally to see all statuses."
        >
          <div className="application-board">
            {statuses
              .filter(
                (status) =>
                  filters.status === "All" || filters.status === status,
              )
              .map((status) => {
                const column = applications.filter(
                  (application) => application.status === status,
                );
                return (
                  <section
                    className="board-column"
                    key={status}
                    aria-label={`${status} applications`}
                  >
                    <div className="board-heading">
                      <StatusBadge status={status} />
                      <span
                        className="count-chip"
                        aria-label={`${column.length} on this page`}
                      >
                        {column.length}
                      </span>
                    </div>
                    <div className="board-cards">
                      {column.map((application) => (
                        <ApplicationCard
                          key={application.id}
                          application={application}
                        />
                      ))}
                      {!column.length && (
                        <p className="board-empty">
                          No applications on this page.
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      )}
      {applications.length > 0 && (
        <div className="tracking-pagination">
          <p>
            Showing {first}–{first + applications.length - 1} of {count}
            {filters.view === "board" && ". Columns show this page only."}
          </p>
          <nav aria-label="Application pages">
            {filters.page > 1 && (
              <Button variant="outline" asChild>
                <Link
                  href={applicationsHref(filters, { page: filters.page - 1 })}
                >
                  Previous page
                </Link>
              </Button>
            )}
            {filters.page * PAGE_SIZE < count && (
              <Button variant="outline" asChild>
                <Link
                  href={applicationsHref(filters, { page: filters.page + 1 })}
                >
                  Next page
                </Link>
              </Button>
            )}
          </nav>
        </div>
      )}
      {applications.length > 0 && (
        <p className="tracking-footnote">
          Open an application to review its details or change its status.
        </p>
      )}
    </>
  );
}
