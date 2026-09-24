import { z } from "zod";
import { safeJobUrl } from "@/features/applications/model";
import { scheduledInstant, validTimeZone } from "./time";

export const kinds = ["Interview", "Assessment", "Other"] as const;
export const roundStatuses = [
  "Planned",
  "Scheduled",
  "Completed",
  "Cancelled",
] as const;
export const journeyTypes = ["round", "task", "contact"] as const;
export type JourneyType = (typeof journeyTypes)[number];
export const tables = {
  round: "hiring_rounds",
  task: "preparation_tasks",
  contact: "application_contacts",
} as const;
export type JourneyState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  conflict?: boolean;
};
const title = z.string().trim().min(1, "Enter a title.").max(200);
const date = z.union([z.literal(""), z.iso.date()]).transform((v) => v || null);
export const roundInput = z
  .object({
    title,
    kind: z.enum(kinds),
    status: z.enum(roundStatuses),
    position: z.coerce.number().int().min(1).max(999),
    scheduled_local: z.union([
      z.literal(""),
      z.iso.datetime({ local: true, precision: -1 }),
    ]),
    time_zone: z
      .string()
      .trim()
      .max(100)
      .refine(
        validTimeZone,
        "Enter an IANA time zone, such as Asia/Tokyo or Europe/London.",
      )
      .transform(
        (zone) =>
          new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions()
            .timeZone,
      ),
    occurrence: z.enum(["reject", "earlier", "later"]),
    duration_minutes: z.coerce.number().int().min(5).max(1440),
    due_on: date,
    meeting_url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (v) => !v || Boolean(safeJobUrl(v)),
        "Enter a complete http:// or https:// URL without login credentials.",
      )
      .transform((v) => (v ? safeJobUrl(v) : null)),
    location: z.string().trim().max(300),
    people: z.string().trim().max(500),
    notes: z.string().max(20000),
    schedule_note: z.string().max(1000),
  })
  .transform((input, ctx) => {
    let scheduled_at: string | null = null;
    if (input.scheduled_local && validTimeZone(input.time_zone)) {
      try {
        scheduled_at = scheduledInstant(
          input.scheduled_local,
          input.time_zone,
          input.occurrence,
        );
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["scheduled_local"],
          message:
            error instanceof Error
              ? error.message
              : "Check this date and time.",
        });
      }
    }
    if (input.status === "Scheduled" && !input.scheduled_local)
      ctx.addIssue({
        code: "custom",
        path: ["scheduled_local"],
        message: "Add the meeting date and time, or choose Planned.",
      });
    if (input.status === "Planned" && input.scheduled_local)
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message:
          "Choose Scheduled when a meeting time is set, or clear the meeting time.",
      });
    const {
      scheduled_local: _local,
      occurrence: _occurrence,
      ...record
    } = input;
    void _local;
    void _occurrence;
    return { ...record, scheduled_at };
  });
export const taskInput = z.object({
  title,
  due_on: date,
  completed: z.enum(["false", "true"]).transform((v) => v === "true"),
  notes: z.string().max(10000),
});
export const contactInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(160),
  role: z.string().trim().max(200),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z.string().trim().max(80),
  notes: z.string().max(5000),
});
export const bucketNames = [
  "Overdue",
  "Today",
  "Upcoming",
  "Unscheduled",
] as const;
export const PAGE_SIZE = 20;
export function pageNumber(value?: string) {
  return z.coerce.number().int().min(1).max(100000).catch(1).parse(value);
}
