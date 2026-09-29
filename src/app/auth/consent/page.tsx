import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { getMcpConfig } from "@/lib/mcp/config";
import { authorizationId } from "@/features/connections/model";
import { PermissionForm } from "@/features/connections/forms";
import "@/app/connections.css";
export const metadata: Metadata = {
  title: "Authorize your assistant",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const params = await searchParams;
  const id = authorizationId.safeParse(params.authorization_id);
  let message =
    "This authorization request is missing or expired. Restart the connection from your AI assistant.";
  if (id.success && getMcpConfig()) {
    const account = await getAccount();
    if (!account) redirect(`/login?authorization_id=${id.data}`);
    const { data, error } =
      await account.supabase.auth.oauth.getAuthorizationDetails(id.data);
    // Supabase can return a redirect for previously approved identity scopes.
    // This cannot create or expand a Rounza grant; database permission checks still apply.
    if (!error && data && "redirect_url" in data) redirect(data.redirect_url);
    if (
      !error &&
      data &&
      "authorization_id" in data &&
      data.user.id === account.user.id
    ) {
      return (
        <div className="account-page">
          <header className="account-header">
            <Link href="/" className="wordmark">
              rounza<span>.</span>
            </Link>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="workspace-main connection-consent"
          >
            <section className="workspace-heading">
              <p className="eyebrow">CONNECT YOUR AI</p>
              <h1 className="workspace-title">
                Allow {data.client.name || "this assistant"} to read Rounza?
              </h1>
              <p>
                Signed in as {account.user.email}. Choose the records this
                assistant can access.
              </p>
              <p className="journey-help">
                Client names are provided by the connecting app. Client ID:{" "}
                <span className="connection-id">{data.client.id}</span>
              </p>
              <p className="journey-help">
                Requested identity scopes: {data.scope || "none"}. Rounza record
                permissions are selected below.
              </p>
            </section>
            <PermissionForm
              owner={account.user.id}
              authorization={{ id: id.data, clientId: data.client.id }}
            />
          </main>
        </div>
      );
    }
  } else if (!getMcpConfig())
    message = "AI connections are not enabled on this deployment yet.";
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="workspace-main connection-consent"
    >
      <h1 className="workspace-title">Connection unavailable</h1>
      <p role="alert" className="account-notice">
        {message}
      </p>
      <Link href="/app/ai-connections">Return to AI connections</Link>
    </main>
  );
}
