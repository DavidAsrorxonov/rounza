"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalDetails, PortalRecord } from "./model";
export type OpenPortal = {
  record: PortalRecord;
  details: PortalDetails | null;
};
export function PortalCard({
  entry,
  linked,
  linking,
  busy,
  onCopy,
  onEdit,
  onDelete,
  onLink,
  onReveal,
}: {
  entry: OpenPortal;
  linked: boolean;
  linking: boolean;
  busy: boolean;
  onCopy: (text: string) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onLink: () => void;
  onReveal: () => Promise<boolean>;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(timer);
  }, [visible]);
  const details = entry.details;
  return (
    <li className="vault-card">
      {details ? (
        <>
          <div className="journey-card-heading">
            <div>
              <p className="eyebrow">ENCRYPTED PORTAL ACCOUNT</p>
              <h2>{details.name}</h2>
            </div>
            {linked && (
              <span className="journey-status journey-status-completed">
                Linked
              </span>
            )}
          </div>
          <a
            className="vault-portal-link"
            href={details.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open portal <ArrowUpRight size={15} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <p className="journey-help vault-url">
            {new URL(details.url).hostname}
          </p>
          <dl className="vault-credentials">
            <div>
              <dt>Username</dt>
              <dd>{details.username || "Not saved"}</dd>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !details.username}
                onClick={async () => {
                  await onCopy(details.username);
                }}
              >
                Copy username
              </Button>
            </div>
            <div>
              <dt>Password</dt>
              <dd className="vault-password">
                {details.password
                  ? visible
                    ? details.password
                    : "••••••••••••"
                  : "Not saved"}
              </dd>
              <div className="vault-buttons">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !details.password}
                  onClick={async () => {
                    if (visible) setVisible(false);
                    else if (await onReveal()) setVisible(true);
                  }}
                >
                  {visible ? "Hide password" : "Reveal password"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !details.password}
                  onClick={async () => {
                    await onCopy(details.password);
                  }}
                >
                  Copy password
                </Button>
              </div>
            </div>
          </dl>
          {details.notes && (
            <p className="tracking-prose journey-notes">{details.notes}</p>
          )}
          <div className="vault-buttons">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onEdit}
            >
              Edit account
            </Button>
            {linking && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onLink}
              >
                {linked ? "Unlink application" : "Link to application"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onDelete}
            >
              Delete account
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2>Account could not be decrypted</h2>
          <p>
            Its encrypted record may be damaged or use an unsupported format.
            Other accounts remain available.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onDelete}
          >
            Delete unreadable account
          </Button>
        </>
      )}
    </li>
  );
}
