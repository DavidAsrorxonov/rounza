"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import {
  authorizationId,
  readPermissions,
  type ConnectionState,
} from "./model";
import { getMcpConfig } from "@/lib/mcp/config";

const unavailable = {
  message:
    "This request expired or changed. Restart the connection from your AI assistant.",
};
export async function authorizeConnection(
  owner: string,
  id: string,
  clientId: string,
  _state: ConnectionState,
  form: FormData,
): Promise<ConnectionState> {
  const { supabase, user } = await requireAccount();
  if (user.id !== owner)
    return { message: "Your account changed. Reload before approving." };
  if (
    !getMcpConfig() ||
    !authorizationId.safeParse(id).success ||
    !z.uuid().safeParse(clientId).success
  )
    return unavailable;
  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(id);
  if (
    error ||
    !details ||
    !("authorization_id" in details) ||
    details.user.id !== user.id ||
    details.client.id !== clientId
  )
    return unavailable;
  if (form.get("decision") === "deny") {
    const denied = await supabase.auth.oauth.denyAuthorization(id, {
      skipBrowserRedirect: true,
    });
    if (denied.error || !denied.data) return unavailable;
    redirect(denied.data.redirect_url);
  }
  if (form.get("confirm") !== "yes")
    return { message: "Confirm the selected access before connecting." };
  const parsed = readPermissions(form);
  if (!parsed.success)
    return {
      message:
        "Check your permissions. Select at most 500 records in each category.",
    };
  // Approve the provider request first, then save the grant before revealing its
  // code to the client. A failed database save does not create new data access.
  const approval = await supabase.auth.oauth.approveAuthorization(id, {
    skipBrowserRedirect: true,
  });
  if (approval.error || !approval.data) return unavailable;
  const saved = await supabase.from("ai_connections").upsert(
    {
      ...parsed.data,
      user_id: user.id,
      client_id: clientId,
      client_name: (details.client.name || "AI assistant").slice(0, 160),
      revoked_at: null,
    },
    { onConflict: "user_id,client_id" },
  );
  if (saved.error) {
    await supabase.auth.oauth.revokeGrant({ clientId });
    return {
      message:
        "We couldn’t save these permissions. Restart authorization and select records that still exist.",
    };
  }
  revalidatePath("/app/ai-connections");
  redirect(approval.data.redirect_url);
}
export async function updateConnection(
  owner: string,
  id: string,
  revision: number,
  _state: ConnectionState,
  form: FormData,
): Promise<ConnectionState> {
  const { supabase, user } = await requireAccount();
  if (user.id !== owner)
    return { message: "Your account changed. Reload before saving." };
  const parsed = readPermissions(form);
  if (
    !parsed.success ||
    !z.uuid().safeParse(id).success ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return {
      message: "Check your selections and reload if this connection changed.",
    };
  const { data, error } = await supabase
    .from("ai_connections")
    .update(parsed.data)
    .eq("user_id", user.id)
    .eq("id", id)
    .eq("revision", revision)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      message:
        "Permissions couldn’t be saved. The connection or selected records may have changed. Reload and try again.",
    };
  revalidatePath("/app/ai-connections");
  redirect("/app/ai-connections?updated=1");
}
export async function revokeConnection(
  owner: string,
  id: string,
  _state: ConnectionState,
  form: FormData,
): Promise<ConnectionState> {
  const { supabase, user } = await requireAccount();
  if (user.id !== owner || !z.uuid().safeParse(id).success) return unavailable;
  if (form.get("confirm") !== "revoke")
    return { message: "Confirm that you want to revoke access." };
  // Revocation intentionally overrides concurrent edits. Block data access first;
  // even a provider outage must not leave a previously issued JWT usable.
  const { data, error } = await supabase
    .from("ai_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("id", id)
    .select("client_id")
    .maybeSingle();
  if (error || !data)
    return { message: "We couldn’t revoke access. Please try again." };
  const provider = await supabase.auth.oauth.revokeGrant({
    clientId: data.client_id,
  });
  revalidatePath("/app/ai-connections");
  if (provider.error)
    return {
      message:
        "Rounza data access is blocked. The provider could not clear its sign-in grant. Retry revocation before reconnecting.",
    };
  redirect("/app/ai-connections?revoked=1");
}
