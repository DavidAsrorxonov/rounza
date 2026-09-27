import { requireAccount } from "@/lib/auth/account";
import { ResumeForm } from "@/features/resumes/form";
export const metadata = { title: "Add resume" };
export default async function NewResumePage() {
  const { user } = await requireAccount();
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">MAKE YOUR EXPERIENCE COUNT</p>
          <h1 className="workspace-title">Add a resume.</h1>
          <p className="workspace-intro">
            Start with a file or pasted text, then make it yours.
          </p>
        </div>
      </div>
      <ResumeForm key={user.id} owner={user.id} id={crypto.randomUUID()} />
    </>
  );
}
