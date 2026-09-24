"use client";

import { useActionState, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteApplication } from "./actions";
import type { FormState } from "./model";

export function DeleteApplication({
  id,
  revision,
  company,
}: {
  id: string;
  revision: number;
  company: string;
}) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState({ id, revision });
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteApplication.bind(null, identity.id, identity.revision),
    {},
  );
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          if (value) setIdentity({ id, revision });
          setOpen(value);
        }
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button variant="outline">
          <Trash2 size={15} aria-hidden="true" />
          Delete application
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="text-2xl font-semibold">
            Delete this application?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your application at {company}, including its description, notes,
            rounds, schedule history, tasks, and contacts, will be permanently
            deleted. This can’t be undone.
          </AlertDialog.Description>
          {state.message && (
            <p role="alert" className="tracking-form-error mt-4">
              {state.message}
            </p>
          )}
          <form
            action={action}
            className="mt-6 flex flex-wrap justify-end gap-3"
          >
            <input type="hidden" name="confirm" value="delete" />
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Keep application
              </Button>
            </AlertDialog.Cancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
