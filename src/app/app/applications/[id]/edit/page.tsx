import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getApplication } from "@/features/applications/data";
import { ApplicationForm } from "@/features/applications/form";

export const metadata: Metadata = { title: "Edit application" };
export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const application = await getApplication((await params).id);
  return (
    <>
      <Link href={`/app/applications/${application.id}`} className="back-link">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to application
      </Link>
      <h1 className="workspace-title">Keep the details current.</h1>
      <p className="workspace-intro mb-8">
        Update your application at {application.company}.
      </p>
      <ApplicationForm key={application.id} application={application} />
    </>
  );
}
