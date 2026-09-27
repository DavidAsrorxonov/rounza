"use client";
import { useActionState, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { deleteResume } from "./actions";
import type { Resume, ResumeState } from "./model";
export function DeleteResume({ resume }: { resume: Resume }) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState(resume);
  const [state, action, pending] = useActionState<ResumeState, FormData>(
    deleteResume.bind(null, identity.user_id, identity.id, identity.revision),
    {},
  );
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          if (value) setIdentity(resume);
          setOpen(value);
        }
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button variant="outline">Delete resume</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="text-2xl font-semibold">
            Delete this resume?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
            “{resume.name}” and its saved text will be permanently deleted. Your
            job applications and original file stay unchanged. This can’t be
            undone.
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
                Keep resume
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
