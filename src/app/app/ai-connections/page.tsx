import type { Metadata } from "next";
import Link from "next/link";
import { Plug, ShieldCheck } from "lucide-react";
import { listConnections } from "@/features/connections/data";
import { getMcpConfig } from "@/lib/mcp/config";
import "@/app/connections.css";
export const metadata: Metadata = { title: "AI connections" };
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; updated?: string; revoked?: string }>;
}) {
  const params = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const { rows, count } = await listConnections(page);
  const config = getMcpConfig();
  return (
    <>
      <section className="workspace-heading">
        <p className="eyebrow">YOUR ASSISTANT, YOUR CHOICE</p>
        <h1 className="workspace-title">AI connections</h1>
        <p>
          Bring the assistant you already use. Choose what it can read and
          manage access here.
        </p>
      </section>
      {params.updated === "1" && (
        <p role="status" className="account-notice">
          Permissions updated. They apply to the next request.
        </p>
      )}
      {params.revoked === "1" && (
        <p role="status" className="account-notice">
          Connection revoked. Further access is blocked.
        </p>
      )}
      <section className="connection-guide">
        <h2>
          <Plug size={22} aria-hidden="true" />
          Connect your AI
        </h2>
        {config ? (
          <>
            <label className="field-label">
              Rounza MCP endpoint
              <input
                className="field"
                readOnly
                value={config.resource}
                onFocus={undefined}
              />
            </label>
            <ol>
              <li>
                Open custom connector or MCP settings in ChatGPT or Claude.
              </li>
              <li>Add the endpoint above and choose OAuth authentication.</li>
              <li>
                Sign in to Rounza, choose your permissions, and approve access.
              </li>
            </ol>
            <p>
              Availability depends on your assistant account and workspace
              settings. See the{" "}
              <a
                href="https://developers.openai.com/plugins/deploy/connect-chatgpt"
                target="_blank"
                rel="noopener noreferrer"
              >
                ChatGPT setup guide
              </a>{" "}
              or{" "}
              <a
                href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claude connector guide
              </a>
              .
            </p>
          </>
        ) : (
          <p className="account-notice">
            AI connections are not enabled on this deployment yet. Hosting and
            OAuth setup must be completed first.
          </p>
        )}
        <p>
          <ShieldCheck size={18} aria-hidden="true" /> Assistants can read
          permitted records and, if you enable proposals, send suggestions to
          your review inbox. Only your approval applies changes. Your credential
          vault stays private.
        </p>
      </section>
      <section className="connection-list">
        <h2>Your connections</h2>
        {!rows.length ? (
          <p>
            No connections on this page. Add Rounza from your assistant to
            begin.
          </p>
        ) : (
          <ul>
            {rows.map((c) => (
              <li key={c.id}>
                <div>
                  <h3>
                    <Link href={`/app/ai-connections/${c.id}`}>
                      {c.client_name}
                    </Link>
                  </h3>
                  <p>
                    {c.revoked_at ? "Revoked" : "Authorized"} · Applications:{" "}
                    {c.application_access}
                    {c.application_access === "selected"
                      ? ` (${c.application_ids.length})`
                      : ""}{" "}
                    · Resumes: {c.resume_access}
                    {c.resume_access === "selected"
                      ? ` (${c.resume_ids.length})`
                      : ""}{" "}
                    · Proposals: {c.allow_proposals ? "Allowed" : "Off"}
                  </p>
                  <p className="journey-help">
                    Authorized {c.activated_at.slice(0, 10)} (UTC)
                  </p>
                </div>
                <Link href={`/app/ai-connections/${c.id}`}>Manage access</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <nav className="journey-pagination" aria-label="Connection pages">
        {page > 1 && (
          <Link href={`/app/ai-connections?page=${page - 1}`}>
            Previous page
          </Link>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(count / 20))}
        </span>
        {page * 20 < count && (
          <Link href={`/app/ai-connections?page=${page + 1}`}>Next page</Link>
        )}
      </nav>
    </>
  );
}
