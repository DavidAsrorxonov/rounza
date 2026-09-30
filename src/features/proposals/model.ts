import { z } from "zod";
import { safeJobUrl, statuses } from "@/features/applications/model";
import { kinds, roundStatuses } from "@/features/journey/model";
import { validTimeZone } from "@/features/journey/time";

const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => !v.includes("\u0000"));
const required = (max: number) => text(max).trim().min(1);
const date = z.iso.date().nullable();
const url = text(2048)
  .refine((v) => Boolean(safeJobUrl(v)))
  .nullable();
const identity = {
  action: z.enum(["create", "update"]),
  record_id: z
    .uuid()
    .describe(
      "For create, generate a fresh UUID. Reuse it when retrying this proposal.",
    ),
  expected_revision: z
    .number()
    .int()
    .positive()
    .max(2147483647)
    .nullable()
    .default(null),
};
const app = z
  .strictObject({
    company: required(160),
    role: required(200),
    status: z.enum(statuses),
    location: text(200),
    job_url: url,
    applied_on: date,
    description: text(50000),
    notes: text(20000),
  })
  .partial();
const round = z
  .strictObject({
    title: required(200),
    kind: z.enum(kinds),
    status: z.enum(roundStatuses),
    position: z.number().int().min(1).max(999),
    scheduled_at: z.iso.datetime({ offset: true }).nullable(),
    time_zone: text(100).refine(validTimeZone),
    duration_minutes: z.number().int().min(5).max(1440),
    due_on: date,
    meeting_url: url,
    location: text(300),
    people: text(500),
    notes: text(20000),
    schedule_note: text(1000),
  })
  .partial();
const task = z
  .strictObject({
    title: required(200),
    round_id: z.uuid().nullable(),
    due_on: date,
    completed: z.boolean(),
    notes: text(10000),
  })
  .partial();
const contact = z
  .strictObject({
    name: required(160),
    role: text(200),
    email: z.union([z.literal(""), z.email().max(254)]),
    phone: text(80),
    notes: text(5000),
  })
  .partial();
const resume = z
  .strictObject({ name: required(160), body: required(100000) })
  .partial();
export const changeInput = z.discriminatedUnion("entity", [
  z.strictObject({ ...identity, entity: z.literal("application"), data: app }),
  z.strictObject({
    ...identity,
    entity: z.literal("round"),
    application_id: z.uuid(),
    data: round,
  }),
  z.strictObject({
    ...identity,
    entity: z.literal("task"),
    application_id: z.uuid(),
    data: task,
  }),
  z.strictObject({
    ...identity,
    entity: z.literal("contact"),
    application_id: z.uuid(),
    data: contact,
  }),
  z.strictObject({ ...identity, entity: z.literal("resume"), data: resume }),
]);
export const proposalInput = z
  .strictObject({
    idempotency_key: z
      .uuid()
      .describe(
        "Use the same key and identical contents when retrying. Use a new key for revised proposals.",
      ),
    title: required(160),
    summary: required(2000).describe(
      "Explain the user's requested change and its source. Do not invent career facts.",
    ),
    changes: z.array(changeInput).min(1).max(10),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    for (const [i, change] of input.changes.entries()) {
      const invalid = (message: string) =>
        ctx.addIssue({ code: "custom", path: ["changes", i], message });
      if (seen.has(change.record_id))
        invalid("Each record can appear only once in a batch.");
      seen.add(change.record_id);
      if ((change.action === "update") !== (change.expected_revision !== null))
        invalid(
          "Updates need the source revision; creates must have no revision.",
        );
      if (!Object.keys(change.data).length)
        invalid("Include at least one changed field.");
      if (change.action === "create") {
        const requiredFields =
          change.entity === "application"
            ? ["company", "role"]
            : change.entity === "resume"
              ? ["name", "body"]
              : change.entity === "contact"
                ? ["name"]
                : ["title"];
        if (requiredFields.some((field) => !Object.hasOwn(change.data, field)))
          invalid("Required fields for this new record are missing.");
      }
    }
  });
export type ProposalInput = z.infer<typeof proposalInput>;
export type ProposedChange = ProposalInput["changes"][number] & {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  application_revision: number | null;
  application_label: string | null;
};
export type Proposal = {
  id: string;
  user_id: string;
  connection_id: string;
  client_name: string;
  connection_activated_at: string;
  oauth_session_id: string;
  idempotency_key: string;
  title: string;
  summary: string;
  request: ProposalInput;
  changes: ProposedChange[];
  status: "pending" | "approved" | "rejected";
  revision: number;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  result: {
    entity: string;
    record_id: string;
    revision: number;
    application_id: string | null;
  }[];
};
export type ProposalSummary = Pick<
  Proposal,
  "id" | "title" | "client_name" | "status" | "created_at" | "expires_at"
>;
export function recordHref(change: {
  entity: string;
  record_id: string;
  application_id?: string | null;
}) {
  if (change.entity === "application")
    return `/app/applications/${change.record_id}`;
  if (change.entity === "resume") return `/app/resumes/${change.record_id}`;
  const segment =
    change.entity === "round"
      ? "rounds"
      : change.entity === "task"
        ? "tasks"
        : "contacts";
  return `/app/applications/${change.application_id}/journey/${segment}/${change.record_id}`;
}
