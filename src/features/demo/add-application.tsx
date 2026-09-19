"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { statusSchema, statuses } from "./model";
import { Modal } from "./shared";
import { demoActions } from "./store";

export function AddApplication() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError("");
      }}
      title="A new possibility"
      description="Try adding a fictional application. This demo saves changes in this tab only; use sample information."
      trigger={
        <Button className="h-11 rounded-lg px-5">
          <Plus size={17} aria-hidden="true" /> Add application
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const company = String(form.get("company") ?? "").trim();
          const role = String(form.get("role") ?? "").trim();
          if (!company || !role) {
            setError("Enter a company and role, using more than spaces.");
            return;
          }
          const id = demoActions.addApplication({
            company,
            role,
            location: String(form.get("location") ?? "").trim(),
            status: statusSchema.parse(form.get("status")),
          });
          if (!id) {
            setError(
              "This demo holds up to 100 applications. Reset it to try again.",
            );
            return;
          }
          setOpen(false);
          router.push(`/demo/applications/${id}`);
        }}
      >
        <label className="field-label">
          Company<span className="text-destructive"> *</span>
          <input
            className="field"
            name="company"
            placeholder="e.g. Paperplane Studio"
            required
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <label className="field-label">
          Role<span className="text-destructive"> *</span>
          <input
            className="field"
            name="role"
            placeholder="e.g. Product Designer"
            required
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <label className="field-label">
          Location
          <input
            className="field"
            name="location"
            placeholder="e.g. Remote · Europe"
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <label className="field-label">
          Application status
          <select className="field" name="status" defaultValue="Saved">
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit">Add to demo</Button>
        </div>
      </form>
    </Modal>
  );
}
