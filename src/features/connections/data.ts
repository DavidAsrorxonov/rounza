import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";

export async function listConnections(page: number) {
  const { supabase, user } = await requireAccount();
  const { data, error, count } = await supabase
    .from("ai_connections")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error && error.code !== "PGRST103")
    throw new Error(
      "AI connections are unavailable. Check the step 8 migration.",
    );
  return { rows: data ?? [], count: count ?? 0 };
}
export async function getConnection(id: string) {
  const { supabase, user } = await requireAccount();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from("ai_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("AI connection is unavailable.");
  if (!data) notFound();
  return data;
}
