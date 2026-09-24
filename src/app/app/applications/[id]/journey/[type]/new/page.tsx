import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getApplication } from "@/features/applications/data";
import { getJourneyRecord } from "@/features/journey/data";
import { JourneyForm } from "@/features/journey/form";
import { initialValues } from "@/features/journey/fields";
import { journeyTypes } from "@/features/journey/model";
import type { HiringRound } from "@/lib/supabase/database.types";
export const metadata = { title: "Add to your hiring journey" };
export default async function NewJourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; type: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  const route = await params;
  const application = await getApplication(route.id);
  const parsed = z.enum(journeyTypes).safeParse(route.type);
  if (!parsed.success) notFound();
  const type = parsed.data;
  const query = await searchParams;
  const round =
    type === "task" && query.round
      ? ((await getJourneyRecord(
          "round",
          application.id,
          query.round,
        )) as HiringRound)
      : null;
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
          <h1 className="workspace-title">Add {type}</h1>
          <p className="workspace-intro">
            {round
              ? `Preparation for ${round.title}.`
              : "Keep the next part of your journey in one place."}
          </p>
        </div>
      </div>
      <JourneyForm
        type={type}
        applicationId={application.id}
        id={null}
        revision={null}
        roundId={round?.id ?? null}
        initial={initialValues(type)}
      />
    </>
  );
}
