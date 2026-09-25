import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalLinkCount } from "./data";
export async function ApplicationPortals({
  applicationId,
}: {
  applicationId: string;
}) {
  const count = await portalLinkCount(applicationId);
  return (
    <section className="tracking-detail-panel vault-application-section">
      <div>
        <p className="eyebrow">EMPLOYER PORTALS</p>
        <h2>
          {count
            ? `${count} linked portal ${count === 1 ? "account" : "accounts"}`
            : "A home for your portal logins"}
        </h2>
        <p className="journey-help">
          Portal names and login details are encrypted. Unlock your vault to
          view or link an account.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href={`/app/portals?application=${applicationId}`}>
          <LockKeyhole size={16} aria-hidden="true" />
          Manage portals
        </Link>
      </Button>
    </section>
  );
}
