import Link from "next/link";
import { getConnection } from "@/features/connections/data";
import { PermissionForm, RevokeForm } from "@/features/connections/forms";
import "@/app/connections.css";
export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const connection = await getConnection(id);
  return (
    <>
      <Link href="/app/ai-connections" className="account-back">
        Back to AI connections
      </Link>
      <section className="workspace-heading">
        <p className="eyebrow">CONNECTION PERMISSIONS</p>
        <h1 className="workspace-title">{connection.client_name}</h1>
        <p>
          Client ID:{" "}
          <span className="connection-id">{connection.client_id}</span>
        </p>
      </section>
      {connection.revoked_at ? (
        <p role="status" className="account-notice">
          This connection is revoked. Start a new connection from your assistant
          to authorize it again.
        </p>
      ) : (
        <PermissionForm
          key={`${id}:${connection.revision}`}
          owner={connection.user_id}
          connection={connection}
        />
      )}
      <RevokeForm owner={connection.user_id} connection={connection} />
    </>
  );
}
