import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import { PAGE_SIZE, type Filters } from "./model";

const summaryColumns =
  "id, company, role, status, location, applied_on, created_at, updated_at";

export async function listApplications(filters: Filters) {
  const { supabase, user } = await requireAccount();
  const column =
    filters.sort === "company"
      ? "company"
      : filters.sort === "updated"
        ? "updated_at"
        : "created_at";
  const { data, count, error } = await supabase
    .rpc(
      "search_applications",
      {
        search_term: filters.q,
        status_filter: filters.status === "All" ? null : filters.status,
      },
      { count: "exact" },
    )
    .select(summaryColumns)
    .eq("user_id", user.id)
    .order(column, {
      ascending: filters.sort === "oldest" || filters.sort === "company",
    })
    .order("id")
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);
  // PostgREST reports an out-of-range page as 416. Let the UI offer page one.
  if (error && error.code !== "PGRST103")
    throw new Error("Applications are unavailable.");
  return {
    applications: data ?? [],
    count: count ?? 0,
    outOfRange: error?.code === "PGRST103",
  };
}

export async function getApplication(id: string) {
  const { supabase, user } = await requireAccount();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Application is unavailable.");
  if (!data) notFound();
  return data;
}

export async function applicationOverview() {
  const { supabase, user } = await requireAccount();
  const [recent, interviewing, offers] = await Promise.all([
    supabase
      .from("applications")
      .select(summaryColumns)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("id")
      .limit(5),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "Interviewing"),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "Offer"),
  ]);
  if (recent.error || interviewing.error || offers.error)
    throw new Error("Application overview is unavailable.");
  return {
    recent: recent.data,
    interviewing: interviewing.count ?? 0,
    offers: offers.count ?? 0,
  };
}
