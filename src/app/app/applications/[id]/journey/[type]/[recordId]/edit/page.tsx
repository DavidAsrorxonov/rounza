import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getApplication } from "@/features/applications/data";
import { getJourneyRecord } from "@/features/journey/data";
import { JourneyForm } from "@/features/journey/form";
import { DeleteJourney } from "@/features/journey/controls";
import { initialValues } from "@/features/journey/fields";
import { journeyTypes } from "@/features/journey/model";
export const metadata = { title: "Edit your hiring journey" };
export default async function EditJourneyPage({
  params,
}: {
  params: Promise<{ id: string; type: string; recordId: string }>;
}) {
  const route = await params;
  const application = await getApplication(route.id);
  const parsed = z.enum(journeyTypes).safeParse(route.type);
  if (!parsed.success) notFound();
  const type = parsed.data;
  const record = await getJourneyRecord(type, application.id, route.recordId);
  return (
    <>
      <Link
        href={`/app/applications/${application.id}#${type}s`}
        className="back-link"
      >
        ← Back to application
      </Link>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">
            {application.company} · {application.role}
          </p>
          <h1 className="workspace-title">Edit {type}</h1>
          <p className="workspace-intro">
            {type === "round"
              ? "Reschedule, record a deadline, or update the outcome. Earlier schedules stay in history."
              : "Keep the details up to date."}
          </p>
        </div>
      </div>
      <JourneyForm
        key={record.id}
        type={type}
        applicationId={application.id}
        id={record.id}
        revision={record.revision}
        roundId={"round_id" in record ? record.round_id : null}
        initial={initialValues(type, record)}
      />
      <div className="tracking-delete">
        <p>
          {type === "round"
            ? "You can mark a round Cancelled to keep its history."
            : "No longer need this record?"}
        </p>
        <DeleteJourney
          type={type}
          applicationId={application.id}
          id={record.id}
          revision={record.revision}
        />
      </div>
    </>
  );
}
