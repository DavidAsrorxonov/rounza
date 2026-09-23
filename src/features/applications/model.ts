import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export const statuses = [
  "Saved",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export const statusSchema = z.enum(statuses);
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type ApplicationSummary = Pick<
  Application,
  | "id"
  | "company"
  | "role"
  | "status"
  | "location"
  | "applied_on"
  | "created_at"
  | "updated_at"
>;

export function safeJobUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !/\s/.test(value)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const applicationInput = z.object({
  company: z
    .string()
    .trim()
    .min(1, "Enter the company name.")
    .max(160, "Use 160 characters or fewer."),
  role: z
    .string()
    .trim()
    .min(1, "Enter the role title.")
    .max(200, "Use 200 characters or fewer."),
  status: statusSchema,
  location: z.string().trim().max(200, "Use 200 characters or fewer."),
  job_url: z
    .string()
    .trim()
    .max(2048, "Use a shorter URL.")
    .refine(
      (value) => value === "" || safeJobUrl(value) !== null,
      "Enter a complete http:// or https:// URL without login credentials.",
    )
    .transform((value) => value || null),
  applied_on: z
    .union([
      z.literal(""),
      z.iso.date({ error: "Enter a valid application date." }),
    ])
    .transform((value) => value || null),
  description: z.string().max(50000, "Use 50,000 characters or fewer."),
  notes: z.string().max(20000, "Use 20,000 characters or fewer."),
});
export type ApplicationFields = z.input<typeof applicationInput>;
export type FormState = {
  message?: string;
  errors?: Partial<Record<keyof ApplicationFields, string[]>>;
  conflict?: boolean;
};
export const recordIdentity = z.object({
  id: z.uuid(),
  revision: z.coerce.number().int().positive().max(2147483647),
});

export const sortOptions = {
  newest: "Newest added",
  updated: "Recently updated",
  oldest: "Oldest added",
  company: "Company A–Z",
} as const;
export type Filters = {
  q: string;
  status: "All" | Application["status"];
  sort: keyof typeof sortOptions;
  view: "list" | "board";
  page: number;
};
export const PAGE_SIZE = 24;
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): Filters {
  const one = (name: string) =>
    typeof params[name] === "string" ? (params[name] as string) : "";
  const status = statusSchema.safeParse(one("status"));
  const sort = one("sort");
  const page = Number(one("page"));
  return {
    q: one("q").trim().slice(0, 120),
    status: status.success ? status.data : "All",
    sort: Object.hasOwn(sortOptions, sort)
      ? (sort as Filters["sort"])
      : "newest",
    view: one("view") === "board" ? "board" : "list",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}
export function applicationsHref(
  filters: Filters,
  change: Partial<Filters> = {},
) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status !== "All") params.set("status", next.status);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.view !== "list") params.set("view", next.view);
  if (next.page > 1) params.set("page", String(next.page));
  return `/app/applications${params.size ? `?${params}` : ""}`;
}
export function displayDate(value: string) {
  // Date-only application dates and server-rendered timestamps use a stable UTC day.
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
