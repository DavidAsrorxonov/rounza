import type { Metadata } from "next";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";
import { requireAccount } from "@/lib/auth/account";
import { SignOutForm } from "@/components/sign-out-form";

export const metadata: Metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccount();
  return (
    <div className="account-page private-workspace">
      <header className="account-header">
        <Link href="/app" className="wordmark" aria-label="Rounza workspace">
          rounza<span>.</span>
        </Link>
        <WorkspaceNav />
        <SignOutForm />
      </header>
      <main id="main-content" tabIndex={-1} className="workspace-main">
        {children}
      </main>
    </div>
  );
}
