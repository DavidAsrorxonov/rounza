import { z } from "zod";

export const statuses = [
  "Saved",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export const statusSchema = z.enum(statuses);
export type ApplicationStatus = z.infer<typeof statusSchema>;
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/);
const day = z.iso.date();
const appointment = z.iso.datetime({ local: true, precision: -1 });

export const applicationSchema = z.object({
  id,
  company: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(100),
  location: z.string().max(100),
  salary: z.string().max(100),
  color: z.enum(["lilac", "peach", "blue", "mint", "yellow", "slate"]),
  status: statusSchema,
  addedOn: day,
  description: z.string().max(4000),
  notes: z.string().max(4000),
  contact: z
    .object({
      name: z.string().max(80),
      role: z.string().max(100),
      email: z.string().max(150),
    })
    .nullable(),
  rounds: z
    .array(
      z.object({
        id,
        title: z.string().max(100),
        kind: z.enum(["Screening", "Interview", "Assessment", "Decision"]),
        state: z.enum(["Completed", "Scheduled", "Planned"]),
        scheduledAt: appointment.nullable(),
        duration: z.string().max(60),
        description: z.string().max(600),
      }),
    )
    .max(20),
  tasks: z
    .array(
      z.object({
        id,
        title: z.string().max(160),
        dueOn: day,
        done: z.boolean(),
      }),
    )
    .max(30),
  history: z
    .array(z.object({ id, text: z.string().max(500), date: day }))
    .max(30),
});

export const demoDataSchema = z.object({
  version: z.literal(1),
  applications: z.array(applicationSchema).max(100),
});

export type DemoApplication = z.infer<typeof applicationSchema>;
export type DemoData = z.infer<typeof demoDataSchema>;
export type HiringRound = DemoApplication["rounds"][number];

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function offsetDay(amount: number, base = new Date()) {
  const date = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + amount,
    12,
  );
  return dateKey(date);
}

export function formatDay(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en", options).format(
    new Date(`${value}T12:00`),
  );
}

export function formatAppointment(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function dueLabel(day: string) {
  if (day < dateKey()) return "Overdue";
  if (day === dateKey()) return "Today";
  if (day === offsetDay(1)) return "Tomorrow";
  return formatDay(day);
}

export function isActive(status: ApplicationStatus) {
  return (
    status === "Saved" || status === "Applied" || status === "Interviewing"
  );
}

export function nextRound(application: DemoApplication) {
  return application.rounds
    .filter((round) => round.state === "Scheduled" && round.scheduledAt)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
}
