import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount } from "@/lib/auth/account";
import { signOut } from "@/lib/auth/actions";
import { AccountSubmit } from "@/components/account-submit";

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
    <div className="account-page">
      <header className="account-header">
        <Link href="/app" className="wordmark" aria-label="Rounza workspace">
          rounza<span>.</span>
        </Link>
        <form action={signOut}>
          <AccountSubmit pendingLabel="Signing out…" variant="outline">
            Sign out
          </AccountSubmit>
        </form>
      </header>
      <main id="main-content" tabIndex={-1} className="workspace-main">
        {children}
      </main>
    </div>
  );
}
