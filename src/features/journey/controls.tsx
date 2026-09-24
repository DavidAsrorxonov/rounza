"use client";
import { useActionState, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { deleteJourney, setTaskCompleted } from "./actions";
import type { JourneyState, JourneyType } from "./model";

export function DeleteJourney({
  type,
  applicationId,
  id,
  revision,
}: {
  type: JourneyType;
  applicationId: string;
  id: string;
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<JourneyState, FormData>(
    deleteJourney.bind(null, type, applicationId, id, revision),
    {},
  );
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button variant="outline">Delete {type}</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="text-2xl font-semibold">
            Delete this {type}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This permanently deletes this {type}
            {type === "round"
              ? " and its schedule history. Its preparation tasks will stay with the application"
              : ""}
            . This can’t be undone.
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
                Keep {type}
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
export function TaskCompletion({
  applicationId,
  id,
  revision,
  completed,
}: {
  applicationId: string;
  id: string;
  revision: number;
  completed: boolean;
}) {
  const [state, action, pending] = useActionState<JourneyState, FormData>(
    setTaskCompleted.bind(null, applicationId, id, revision, !completed),
    {},
  );
  return (
    <form action={action}>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving…" : completed ? "Reopen task" : "Mark complete"}
      </Button>
      {state.message && (
        <p role="alert" className="tracking-field-error">
          {state.message} Refresh to see its current status.
        </p>
      )}
    </form>
  );
}
