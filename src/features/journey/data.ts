import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import { PAGE_SIZE, tables, type JourneyType } from "./model";
import { actionClock } from "./time";

function checked<T>(result: {
  data: T | null;
  error: { code?: string } | null;
  count: number | null;
}) {
  if (result.error && result.error.code !== "PGRST103")
    throw new Error("Hiring journey is unavailable.");
  return { rows: result.data ?? [], count: result.count ?? 0 };
}
export async function getJourney(
  applicationId: string,
  pages: { rounds: number; tasks: number; contacts: number },
) {
  const { supabase, user } = await requireAccount();
  const range = (page: number): [number, number] => [
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE - 1,
  ];
  const [rounds, tasks, contacts] = await Promise.all([
    supabase
      .from("hiring_rounds")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .order("position")
      .order("created_at")
      .order("id")
      .range(...range(pages.rounds)),
    supabase
      .from("preparation_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .order("completed")
      .order("due_on", { nullsFirst: false })
      .order("id")
      .range(...range(pages.tasks)),
    supabase
      .from("application_contacts")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .order("name")
      .order("id")
      .range(...range(pages.contacts)),
  ]);
  return {
    rounds: checked(rounds),
    tasks: checked(tasks),
    contacts: checked(contacts),
  };
}
export async function getJourneyRecord(
  type: JourneyType,
  applicationId: string,
  id: string,
) {
  const { supabase, user } = await requireAccount();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from(tables[type])
    .select("*")
    .eq("user_id", user.id)
    .eq("application_id", applicationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Journey record is unavailable.");
  if (!data) notFound();
  return data;
}
export async function getScheduleHistory(
  applicationId: string,
  roundId: string,
  page: number,
) {
  const { supabase, user } = await requireAccount();
  return checked(
    await supabase
      .from("round_schedule_history")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .eq("round_id", roundId)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  );
}
export async function getNextActions(
  zone: string,
  page = 1,
  bucket: number | null = null,
  limit = PAGE_SIZE,
) {
  const { supabase, user } = await requireAccount();
  let query = supabase
    .rpc("next_actions", actionClock(zone), { count: "exact" })
    .eq("user_id", user.id);
  if (bucket !== null) query = query.eq("bucket", bucket);
  return checked(
    await query
      .order("bucket")
      .order("sort_at")
      .order("id")
      .range((page - 1) * limit, page * limit - 1),
  );
}
