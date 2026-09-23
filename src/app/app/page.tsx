import Link from "next/link";
import { ArrowUpRight, Plus, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/auth/account";
import { applicationOverview } from "@/features/applications/data";
import { ApplicationList } from "@/features/applications/shared";
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [workspace, overview, params] = await Promise.all([
    getWorkspace(),
    applicationOverview(),
    searchParams,
  ]);
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h1 className="workspace-title">A little closer to what’s next.</h1>
          <p className="workspace-intro">
            Welcome, {workspace.name}. You’re signed in as{" "}
            <span>{workspace.email}</span>.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/applications/new">
            <Plus size={17} aria-hidden="true" />
            Add application
          </Link>
        </Button>
      </div>
      {params.error === "signout" && (
        <p role="alert" className="account-notice">
          We couldn’t finish signing you out. Please try again.
        </p>
      )}
      <div className="tracking-stats">
        <Link href="/app/applications">
          <span>{workspace.applicationCount}</span>
          <p>
            All applications <ArrowUpRight size={15} aria-hidden="true" />
          </p>
        </Link>
        <Link href="/app/applications?status=Interviewing">
          <span>{overview.interviewing}</span>
          <p>
            Interviewing <ArrowUpRight size={15} aria-hidden="true" />
          </p>
        </Link>
        <Link href="/app/applications?status=Offer">
          <span>{overview.offers}</span>
          <p>
            Offers <ArrowUpRight size={15} aria-hidden="true" />
          </p>
        </Link>
      </div>
      {workspace.applicationCount === 0 ? (
        <section className="workspace-welcome">
          <span className="workspace-sprout">
            <Sprout size={38} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">MAKE ROOM FOR POSSIBILITY</p>
            <h2>Your space is ready.</h2>
            <p>
              Add your first opportunity and keep its details, status, and your
              own notes in one place.
            </p>
            <Button asChild className="mt-6">
              <Link href="/app/applications/new">
                Add your first application <Plus size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="tracking-recent">
          <div className="tracking-section-heading">
            <h2>Recently updated</h2>
            <Link href="/app/applications?sort=updated">
              View all <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <ApplicationList applications={overview.recent} />
        </section>
      )}
      <div className="tracking-demo-note">
        <p>
          Want to explore a sample hiring journey? Demo examples stay separate
          from your account.
        </p>
        <Link href="/demo">
          Explore the demo <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
