import Link from "next/link";
import { ArrowUpRight, Check, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/auth/account";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [workspace, params] = await Promise.all([getWorkspace(), searchParams]);
  return (
    <>
      <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
      <h1 className="workspace-title">Room for your next chapter.</h1>
      <p className="workspace-intro">
        Welcome, {workspace.name}. You’re signed in as{" "}
        <span>{workspace.email}</span>.
      </p>
      {params.error === "signout" && (
        <p role="alert" className="account-notice">
          We couldn’t finish signing you out. Please try again.
        </p>
      )}
      <section className="workspace-welcome" aria-labelledby="workspace-ready">
        <span className="workspace-sprout">
          <Sprout size={38} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">
            <Check size={14} aria-hidden="true" /> ACCOUNT CONNECTED
          </p>
          <h2 id="workspace-ready">Your space is ready.</h2>
          <p>
            Application tracking is coming in the next update. For now, explore
            the full hiring journey in the public demo.
          </p>
          <Button asChild className="mt-6">
            <Link href="/demo">
              Explore the demo <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
      <div className="workspace-summary">
        <div>
          <span>{workspace.applicationCount}</span>
          <p>Applications in your account</p>
        </div>
        <p>
          Demo examples stay in the demo. They aren’t added to your account.
        </p>
      </div>
    </>
  );
}
