"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const config = getSupabaseConfig();
  const supabase = await createClient();
  if (!config || !supabase) redirect("/login?error=configuration");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${config.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=signin");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) redirect("/app?error=signout");
  }
  revalidatePath("/", "layout");
  redirect("/login?signedOut=1");
}
