"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Circle, MapPin, Sparkles, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type DemoApplication,
  type ApplicationStatus,
  dueLabel,
  dateKey,
} from "./model";
import { demoActions } from "./store";

export function CompanyMark({
  application,
  small = false,
}: {
  application: Pick<DemoApplication, "company" | "color">;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "company-mark",
        `company-${application.color}`,
        small && "company-small",
      )}
    >
      {application.company
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("status-badge", `status-${status.toLowerCase()}`)}>
      <span aria-hidden="true" />
      {status}
    </span>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={cn("dialog-content", wide && "dialog-wide")}>
          <Dialog.Title className="pr-8 text-2xl font-semibold tracking-tight">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </Dialog.Description>
          <Dialog.Close asChild>
            <button
              className="icon-button absolute top-4 right-4"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
          <div className="mt-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SampleAnalysis({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="A clearer story for Northstar"
      description="Precomputed AI example using a fictional resume and job description. No live analysis runs in this demo."
      wide
      trigger={
        trigger ?? (
          <Button variant="outline">
            <Sparkles size={16} /> View sample analysis
          </Button>
        )
      }
    >
      <div className="rounded-xl border bg-muted/50 p-4 text-sm">
        <span className="eyebrow">SAMPLE CONTEXT</span>
        <p className="mt-2">
          Alex has four years of product design experience, has partnered with
          engineers on onboarding, and has contributed reusable interface
          components. Northstar asks for product thinking, collaboration, and
          research leadership.
        </p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Check size={16} className="text-emerald-700" /> Evidence to bring
            forward
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Product design and prototyping</li>
            <li>Engineering collaboration</li>
            <li>Reusable UI components</li>
          </ul>
        </section>
        <section className="rounded-xl border p-4">
          <p className="text-sm font-semibold">Something to clarify</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The sample resume does not establish research leadership. Add a
            concrete example only if it reflects work you actually did.
          </p>
        </section>
      </div>
      <section className="mt-5 rounded-xl border p-4">
        <p className="eyebrow">A MORE SPECIFIC BULLET</p>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Before:</span> Worked on
          onboarding screens.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          <span className="font-medium">After:</span> Designed onboarding flows
          with engineering partners, using reusable interface components to
          bring consistency across screens.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          A wording example, grounded in the fictional resume. No invented
          metrics or hiring score.
        </p>
      </section>
      <div className="mt-6 flex justify-end">
        <Button onClick={() => setOpen(false)}>Got it</Button>
      </div>
    </Modal>
  );
}

export function TaskRow({
  application,
  task,
  showCompany = true,
}: {
  application: DemoApplication;
  task: DemoApplication["tasks"][number];
  showCompany?: boolean;
}) {
  return (
    <li className="task-row">
      <button
        className={cn("task-checkbox", task.done && "is-checked")}
        aria-label={`${task.done ? "Reopen" : "Complete"}: ${task.title}`}
        aria-pressed={task.done}
        onClick={() => demoActions.toggleTask(application.id, task.id)}
      >
        {task.done ? <Check size={14} /> : <Circle size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium leading-relaxed",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        {showCompany && (
          <Link
            className="mt-1 inline-block text-xs text-muted-foreground hover:text-primary hover:underline"
            href={`/demo/applications/${application.id}`}
          >
            {application.company} <span aria-hidden="true">·</span>{" "}
            {application.role}
          </Link>
        )}
      </div>
      {!task.done && (
        <span
          className={cn("due-label", task.dueOn < dateKey() && "due-overdue")}
        >
          {dueLabel(task.dueOn)}
        </span>
      )}
    </li>
  );
}

export function ApplicationCard({
  application,
}: {
  application: DemoApplication;
}) {
  return (
    <Link
      href={`/demo/applications/${application.id}`}
      className="application-card group"
    >
      <div className="flex items-start justify-between gap-3">
        <CompanyMark application={application} />
        <ArrowUpRight
          size={17}
          className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 text-xs font-medium text-muted-foreground">
        {application.company}
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight">
        {application.role}
      </h3>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin size={13} aria-hidden="true" />
        {application.location || "Location not specified"}
      </p>
      <div className="mt-5">
        <StatusBadge status={application.status} />
      </div>
    </Link>
  );
}

export function DemoLoading() {
  return (
    <div className="demo-loading" role="status">
      <span className="block h-3 w-28 rounded bg-border" />
      <span className="mt-6 block h-10 w-2/3 rounded bg-border" />
      <span className="mt-8 block h-64 rounded-2xl bg-white" />
      <span className="sr-only">Loading sample workspace…</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span
        aria-hidden="true"
        className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-muted"
      >
        <Check size={20} />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
