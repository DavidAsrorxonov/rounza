import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getAccount = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return null;
  // Never authorize using the unverified user embedded in a session cookie.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  return { supabase, user: data.user };
});

export async function requireAccount() {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

export async function getWorkspace() {
  const { supabase, user } = await requireAccount();
  const [profile, applications] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  // Fail visibly if migration/permissions/provider are broken; never seed demo data.
  if (profile.error || applications.error)
    throw new Error("Workspace data is unavailable.");
  return {
    email: user.email ?? "Google account",
    name: profile.data.display_name || "Your account",
    applicationCount: applications.count ?? 0,
  };
}
