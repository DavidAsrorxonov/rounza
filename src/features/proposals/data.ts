import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
export const proposalFilter = z.enum([
  "pending",
  "approved",
  "rejected",
  "all",
]);
export async function listProposals(
  page: number,
  status: z.infer<typeof proposalFilter>,
) {
  const { supabase, user } = await requireAccount();
  let query = supabase
    .from("ai_proposals")
    .select("id,title,client_name,status,created_at,expires_at", {
      count: "exact",
    })
    .eq("user_id", user.id);
  if (status !== "all") query = query.eq("status", status);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error && error.code !== "PGRST103")
    throw new Error("Review inbox is unavailable. Check the step 9 migration.");
  return { rows: data ?? [], count: count ?? 0, observedAt: Date.now() };
}
export async function getProposal(id: string) {
  const { supabase, user } = await requireAccount();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from("ai_proposals")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Proposal is unavailable.");
  if (!data) notFound();
  return { proposal: data, owner: user.id, observedAt: Date.now() };
}
