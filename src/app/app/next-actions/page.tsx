import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getNextActions } from "@/features/journey/data";
import { bucketNames, pageNumber } from "@/features/journey/model";
import { validTimeZone } from "@/features/journey/time";
import { NextActionList, JourneyPagination } from "@/features/journey/views";
export const metadata = { title: "Next actions" };
export default async function NextActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string; bucket?: string; page?: string }>;
}) {
  const query = await searchParams;
  const zone = query.tz && validTimeZone(query.tz) ? query.tz : "UTC";
  const bucket =
    query.bucket && ["0", "1", "2", "3"].includes(query.bucket)
      ? Number(query.bucket)
      : null;
  const page = pageNumber(query.page);
  const result = await getNextActions(zone, page, bucket);
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">ONE THING AT A TIME</p>
          <h1 className="workspace-title">Your next actions.</h1>
          <p className="workspace-intro">
            Meetings, deadlines, and preparation across your active
            applications.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/applications">View applications</Link>
        </Button>
      </div>
      <form className="next-action-filters" action="/app/next-actions">
        <div className="field-label">
          <label htmlFor="bucket">Show actions</label>
          <select
            className="field"
            name="bucket"
            id="bucket"
            defaultValue={bucket ?? "all"}
          >
            <option value="all">All actions</option>
            {bucketNames.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-label">
          <label htmlFor="tz">Day grouping time zone</label>
          <input
            className="field"
            name="tz"
            id="tz"
            defaultValue={zone}
            maxLength={100}
            aria-describedby="zone-help"
          />
        </div>
        <Button type="submit">Apply filters</Button>
      </form>
      {query.tz && query.tz !== zone && (
        <p role="status" className="account-notice">
          That time zone wasn’t recognized. Showing UTC.
        </p>
      )}
      <p className="journey-help mb-6" id="zone-help">
        Today uses {zone}. Enter an IANA name such as Asia/Tokyo or
        Europe/London. Meetings show their saved time zone; date-only deadlines
        stay on their calendar date. Reminders appear here when you visit.
      </p>
      <p role="status" className="journey-help mb-3">
        {result.count} open {result.count === 1 ? "action" : "actions"}
      </p>
      {result.rows.length ? (
        <NextActionList actions={result.rows} />
      ) : (
        <section className="journey-empty">
          <h2>Nothing on this page.</h2>
          <p>Add rounds and tasks to an application, or change the filters.</p>
          <Link href="/app/applications">Go to applications</Link>
        </section>
      )}
      <JourneyPagination
        page={page}
        count={result.count}
        label="Next action pages"
        href={(value) =>
          `/app/next-actions?${new URLSearchParams({ tz: zone, bucket: bucket === null ? "all" : String(bucket), page: String(value) })}`
        }
      />
      <p className="journey-help mt-6">
        Completed or cancelled rounds and completed tasks leave this list.
        Offer, Rejected and Withdrawn applications keep their history but no
        longer show reminders. Past meetings stay overdue until you update their
        status.
      </p>
    </>
  );
}
