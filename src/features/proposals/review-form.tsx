"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { decideProposal } from "./actions";
export function ReviewForm({
  owner,
  id,
  revision,
  expired,
}: {
  owner: string;
  id: string;
  revision: number;
  expired: boolean;
}) {
  const [identity] = useState({ owner, id, revision });
  const [reviewed, setReviewed] = useState(false);
  const [state, submit, pending] = useActionState<
    { message?: string },
    FormData
  >(
    decideProposal.bind(null, identity.owner, identity.id, identity.revision),
    {},
  );
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.message) alert.current?.focus();
  }, [state]);
  return (
    <form action={submit} className="review-decision">
      {state.message && (
        <p ref={alert} tabIndex={-1} role="alert" className="account-notice">
          {state.message}
        </p>
      )}
      <h2>Your decision</h2>
      <p>
        Approve applies the entire batch together. A changed or unavailable
        source blocks the whole batch. Reject leaves your records unchanged.
      </p>
      {expired ? (
        <p className="account-notice">
          This proposal has expired. Reject it and ask for a fresh proposal.
        </p>
      ) : (
        <label className="connection-check">
          <input
            type="checkbox"
            name="reviewed"
            value="yes"
            checked={reviewed}
            disabled={pending}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          I reviewed every change, including any resume text, and confirm its
          accuracy.
        </label>
      )}
      <div className="vault-buttons mt-5">
        <Button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending || !reviewed || expired}
        >
          {pending ? "Saving decision…" : "Approve all changes"}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="outline"
          disabled={pending}
        >
          Reject proposal
        </Button>
      </div>
    </form>
  );
}
