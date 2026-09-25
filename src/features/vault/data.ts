import "server-only";
import { requireAccount } from "@/lib/auth/account";
export async function vaultSettings() {
  const { supabase, user } = await requireAccount();
  const { data, error } = await supabase
    .from("credential_vaults")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Vault is unavailable.");
  return { owner: user.id, settings: data };
}
export async function portalLinkCount(applicationId: string) {
  const { supabase, user } = await requireAccount();
  const { count, error } = await supabase
    .from("application_portals")
    .select("portal_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("application_id", applicationId);
  if (error) throw new Error("Portal links are unavailable.");
  return count ?? 0;
}
