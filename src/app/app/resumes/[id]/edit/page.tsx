import { getResume } from "@/features/resumes/data";
import { ResumeForm } from "@/features/resumes/form";
export const metadata = { title: "Edit resume" };
export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resume = await getResume(id);
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">REFINE YOUR STORY</p>
          <h1 className="workspace-title">Edit your resume.</h1>
          <p className="workspace-intro">
            Update the name or text, or import a replacement before saving.
          </p>
        </div>
      </div>
      <ResumeForm
        key={`${resume.user_id}:${id}`}
        owner={resume.user_id}
        id={id}
        resume={resume}
      />
    </>
  );
}
