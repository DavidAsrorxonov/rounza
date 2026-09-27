import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { PAGE_SIZE } from "./model";
export async function listResumes(page: number) {
  const { supabase, user } = await requireAccount();
  const query = (p: number) =>
    supabase
      .from("resumes")
      .select("id,name,source,character_count,created_at,updated_at", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("id")
      .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  let actualPage = page;
  let result = await query(page);
  if (
    page > 1 &&
    (result.error?.code === "PGRST103" ||
      (!result.error && !result.data?.length))
  ) {
    actualPage = 1;
    result = await query(1);
  }
  if (result.error) throw new Error("Resume library is unavailable.");
  return {
    rows: result.data ?? [],
    count: result.count ?? 0,
    page: actualPage,
  };
}
export async function getResume(id: string) {
  const { supabase, user } = await requireAccount();
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Resume is unavailable.");
  if (!data) notFound();
  return data;
}
