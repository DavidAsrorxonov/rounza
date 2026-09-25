import { vaultSettings } from "@/features/vault/data";
import { getApplication } from "@/features/applications/data";
import { VaultClient } from "@/features/vault/client";
export const metadata = { title: "Employer portals and vault" };
export default async function PortalsPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const query = await searchParams;
  const [{ owner, settings }, application] = await Promise.all([
    vaultSettings(),
    query.application
      ? getApplication(query.application)
      : Promise.resolve(null),
  ]);
  return (
    <>
      <div className="tracking-heading">
        <div>
          <p className="eyebrow">KEEP THE DOOR OPEN</p>
          <h1 className="workspace-title">Your employer portals.</h1>
          <p className="workspace-intro">
            {application
              ? `Manage portal accounts for ${application.company} · ${application.role}.`
              : "Keep login details together, and reuse an account across applications."}
          </p>
        </div>
      </div>
      <VaultClient
        key={`${owner}:${application?.id ?? "all"}`}
        owner={owner}
        initial={settings}
        application={
          application
            ? {
                id: application.id,
                company: application.company,
                role: application.role,
              }
            : null
        }
      />
    </>
  );
}
