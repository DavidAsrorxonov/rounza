import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import { AccountSubmit } from "@/components/account-submit";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAccount } from "@/lib/auth/account";
import { signInWithGoogle } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  configuration:
    "Account sign-in is not available yet. You can still explore the demo.",
  signin: "We couldn’t start Google sign-in. Please try again.",
  denied:
    "Google sign-in was cancelled or declined. You can try again when you’re ready.",
  callback:
    "That sign-in link has expired or couldn’t be verified. Please start again below.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string }>;
}) {
  const params = await searchParams;
  const config = getSupabaseConfig();
  if (config && (await getAccount())) redirect("/app");
  const message =
    params.error && Object.hasOwn(messages, params.error)
      ? messages[params.error]
      : null;
  return (
    <div className="account-page">
      <header className="account-header">
        <Link href="/" className="wordmark" aria-label="Rounza home">
          rounza<span>.</span>
        </Link>
        <Link href="/demo" className="account-demo-link">
          Explore the demo <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="account-main">
        <section className="account-story">
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>
            A place for
            <br />
            <span>your possibilities.</span>
          </h1>
          <p>
            Your search deserves a little breathing room. Sign in to your own
            Rounza workspace.
          </p>
          <div className="account-promise">
            <Check size={18} aria-hidden="true" /> One account. Your own space.
          </div>
          <div className="account-promise">
            <LockKeyhole size={17} aria-hidden="true" /> Your workspace is
            separate from the demo.
          </div>
        </section>
        <section className="account-card" aria-labelledby="sign-in-title">
          <span className="account-icon">
            <LockKeyhole size={24} aria-hidden="true" />
          </span>
          <h2 id="sign-in-title">Make yourself at home.</h2>
          <p>Use Google to create an account or pick up where you left off.</p>
          {message && (
            <p role="alert" className="account-notice">
              {message}
            </p>
          )}
          {params.signedOut === "1" && (
            <p role="status" className="account-notice">
              You’re signed out of this browser.
            </p>
          )}
          {!config && !message && (
            <p className="account-notice">
              Account sign-in is not available yet. You can still explore the
              demo.
            </p>
          )}
          <form action={signInWithGoogle} className="mt-7">
            <AccountSubmit pendingLabel="Opening Google…" disabled={!config}>
              Continue with Google <ArrowRight size={16} aria-hidden="true" />
            </AccountSubmit>
          </form>
          <p className="account-fine-print">
            Rounza uses your Google name and email to identify your account. It
            doesn’t request access to Gmail or Drive.
          </p>
          <Link href="/demo" className="account-back">
            <ArrowLeft size={15} aria-hidden="true" /> Try the demo first
          </Link>
        </section>
      </main>
    </div>
  );
}
