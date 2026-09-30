import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { listProposals, proposalFilter } from "@/features/proposals/data";
import { pageNumber } from "@/features/journey/model";
import "@/app/connections.css";
import "@/app/review.css";
export const metadata: Metadata = { title: "Review inbox" };
export const dynamic = "force-dynamic";
export default async function ReviewInbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = proposalFilter.catch("pending").parse(params.status),
    page = pageNumber(params.page);
  const { rows, count, observedAt } = await listProposals(page, status);
  return (
    <>
      <header className="workspace-heading">
        <p className="eyebrow">YOU DECIDE WHAT CHANGES</p>
        <h1 className="workspace-title">Review inbox</h1>
        <p>
          Suggestions from your assistants stay here until you review and
          approve them.
        </p>
      </header>
      <nav className="review-filters" aria-label="Proposal filters">
        {(["pending", "approved", "rejected", "all"] as const).map((value) => (
          <Link
            key={value}
            href={`/app/review-inbox?status=${value}`}
            aria-current={status === value ? "page" : undefined}
          >
            {value === "pending"
              ? "Needs review"
              : value[0].toUpperCase() + value.slice(1)}
          </Link>
        ))}
      </nav>
      <section className="connection-list">
        <h2>
          <Inbox size={20} aria-hidden="true" />{" "}
          {status === "pending"
            ? "Waiting for your decision"
            : "Proposal history"}
        </h2>
        {!rows.length ? (
          <div className="review-empty">
            <p>No proposals on this page.</p>
            <p>
              Enable proposals in{" "}
              <Link href="/app/ai-connections">AI connections</Link>, then ask
              your assistant to suggest a change. It will return a link for your
              review.
            </p>
          </div>
        ) : (
          <ul>
            {rows.map((p) => (
              <li key={p.id}>
                <div>
                  <h3>
                    <Link href={`/app/review-inbox/${p.id}`}>{p.title}</Link>
                  </h3>
                  <p>
                    From {p.client_name} ·{" "}
                    {p.status === "pending" &&
                    new Date(p.expires_at).getTime() <= observedAt
                      ? "Expired"
                      : p.status}
                  </p>
                  <p className="journey-help">
                    Received {p.created_at.slice(0, 10)} (UTC)
                  </p>
                </div>
                <Link href={`/app/review-inbox/${p.id}`}>Review proposal</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <nav className="journey-pagination" aria-label="Proposal pages">
        {page > 1 && (
          <Link href={`/app/review-inbox?status=${status}&page=${page - 1}`}>
            Previous page
          </Link>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(count / 20))}
        </span>
        {page * 20 < count && (
          <Link href={`/app/review-inbox?status=${status}&page=${page + 1}`}>
            Next page
          </Link>
        )}
      </nav>
    </>
  );
}
