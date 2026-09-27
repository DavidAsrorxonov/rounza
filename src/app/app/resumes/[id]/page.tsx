import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getResume } from "@/features/resumes/data";
import { sources } from "@/features/resumes/model";
import { DeleteResume } from "@/features/resumes/delete-dialog";
export const metadata = { title: "Saved resume" };
export default async function ResumePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const resume = await getResume(id);
  return (
    <>
      <Link className="journey-text-button" href="/app/resumes">
        Back to resume library
      </Link>
      {query.saved === "1" && (
        <p role="status" className="tracking-success mt-6">
          Resume saved.
        </p>
      )}
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">{sources[resume.source]}</p>
          <h1 className="workspace-title tracking-wrap">{resume.name}</h1>
          <p className="workspace-intro">
            {resume.character_count.toLocaleString("en")} characters · Updated{" "}
            {resume.updated_at.slice(0, 10)} (UTC)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/app/resumes/${id}/edit`}>Edit resume</Link>
        </Button>
      </div>
      <section className="tracking-detail-panel">
        <h2>Reviewed resume text</h2>
        <p className="tracking-prose resume-saved-text">{resume.body}</p>
      </section>
      <div className="tracking-delete">
        <p>Delete this version when you no longer need it.</p>
        <DeleteResume resume={resume} />
      </div>
    </>
  );
}
