"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { consentDestination } from "@/features/connections/model";

export async function signInWithGoogle(form: FormData) {
  const config = getSupabaseConfig();
  const supabase = await createClient();
  if (!config || !supabase) redirect("/login?error=configuration");
  const destination = consentDestination(form.get("authorization_id"));
  const cookieStore = await cookies();
  cookieStore.set("rounza-consent-return", destination ?? "", {
    httpOnly: true,
    secure: config.origin.startsWith("https:"),
    sameSite: "lax",
    path: "/auth/callback",
    maxAge: destination ? 600 : 0,
  });
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
