import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAccount } from "@/lib/auth/account";
import { ApplicationForm } from "@/features/applications/form";

export const metadata: Metadata = { title: "Add application" };
export default async function NewApplicationPage() {
  await requireAccount();
  return (
    <>
      <Link href="/app/applications" className="back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        All applications
      </Link>
      <h1 className="workspace-title">One more possibility.</h1>
      <p className="workspace-intro mb-8">
        Add an opportunity to your own job search.
      </p>
      <ApplicationForm />
    </>
  );
}
