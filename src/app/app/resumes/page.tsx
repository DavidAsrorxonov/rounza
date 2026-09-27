import Link from "next/link";
import { Plus, FileText, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listResumes } from "@/features/resumes/data";
import { PAGE_SIZE, resumePage, sources } from "@/features/resumes/model";
export const metadata = { title: "Resume library" };
export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const { rows, count, page } = await listResumes(resumePage(query.page));
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">YOUR EXPERIENCE, READY</p>
          <h1 className="workspace-title">Your resume library.</h1>
          <p className="workspace-intro">
            Keep reviewed versions together, ready for your next opportunity.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/resumes/new">
            <Plus size={17} aria-hidden="true" />
            Add resume
          </Link>
        </Button>
      </div>
      {query.deleted === "1" && (
        <p role="status" className="tracking-success">
          Resume deleted.
        </p>
      )}
      <p className="journey-help mb-6">
        {count} saved {count === 1 ? "resume" : "resumes"} · most recently
        updated first
      </p>
      {rows.length ? (
        <ul className="resume-library" aria-label="Saved resumes">
          {rows.map((resume) => (
            <li className="resume-library-card" key={resume.id}>
              <FileText size={24} aria-hidden="true" />
              <div>
                <p className="eyebrow">{sources[resume.source]}</p>
                <h2>
                  <Link href={`/app/resumes/${resume.id}`}>
                    {resume.name}
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                </h2>
                <p className="journey-help">
                  {resume.character_count.toLocaleString("en")} characters ·
                  Updated {resume.updated_at.slice(0, 10)} (UTC)
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="workspace-welcome">
          <FileText size={36} aria-hidden="true" />
          <div>
            <h2>A place for every version.</h2>
            <p>
              Import a PDF or DOCX, or paste your resume. Review the text before
              saving it to your account.
            </p>
            <Button asChild className="mt-6">
              <Link href="/app/resumes/new">Add your first resume</Link>
            </Button>
          </div>
        </section>
      )}
      <nav className="journey-pagination" aria-label="Resume pages">
        {page > 1 && (
          <Button variant="outline" asChild>
            <Link href={`/app/resumes?page=${page - 1}`}>Previous page</Link>
          </Button>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(count / PAGE_SIZE))}
        </span>
        {page * PAGE_SIZE < count && (
          <Button variant="outline" asChild>
            <Link href={`/app/resumes?page=${page + 1}`}>Next page</Link>
          </Button>
        )}
      </nav>
    </>
  );
}
