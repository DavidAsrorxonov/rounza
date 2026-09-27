import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ResumeNotFound() {
  return (
    <div className="workspace-welcome">
      <div>
        <h1 className="workspace-title">Resume not found.</h1>
        <p>This resume is unavailable in your account.</p>
        <Button asChild className="mt-6">
          <Link href="/app/resumes">Back to resume library</Link>
        </Button>
      </div>
    </div>
  );
}
