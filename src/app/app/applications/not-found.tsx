import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ApplicationNotFound() {
  return (
    <section className="tracking-empty">
      <h1>Application not found.</h1>
      <p>
        It may have been deleted, or this link isn’t available in your account.
      </p>
      <Button asChild>
        <Link href="/app/applications">Back to applications</Link>
      </Button>
    </section>
  );
}
