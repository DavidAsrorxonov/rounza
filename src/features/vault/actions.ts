"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import {
  vaultEnvelope,
  encryptedPortal,
  VAULT_PAGE_SIZE,
  type VaultResult,
  type VaultRecord,
  type PortalRecord,
} from "./model";
const changed = (): VaultResult<never> => ({
  ok: false,
  lock: true,
  message:
    "Your account or vault changed. The vault is locked; reload to continue.",
});
const failed = (): VaultResult<never> => ({
  ok: false,
  message:
    "This change could not be saved. Check your connection and try again.",
});
const stale = (): VaultResult<never> => ({
  ok: false,
  message:
    "This record changed or was removed. Close this form and reload the vault before editing again.",
});
const uuid = (value: unknown) => z.uuid().safeParse(value).success;
const revisionValid = (value: unknown) =>
  z.number().int().positive().max(2147483647).safeParse(value).success;
function invalidate() {
  revalidatePath("/app", "layout");
}

export async function checkVault(
  owner: string,
): Promise<VaultResult<VaultRecord | null>> {
  const { supabase, user } = await requireAccount();
  if (owner !== user.id) return changed();
  const { data, error } = await supabase
    .from("credential_vaults")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return {
      ok: false,
      lock: true,
      message:
        "Your session could not be checked. Unlock again when your connection returns.",
    };
  return { ok: true, data };
}
export async function saveVaultAccess(
  owner: string,
  vaultId: string,
  revision: number | null,
  input: unknown,
): Promise<VaultResult<VaultRecord>> {
  const { supabase, user } = await requireAccount();
  if (owner !== user.id || !uuid(vaultId)) return changed();
  const parsed = vaultEnvelope.safeParse(input);
  if (!parsed.success || (revision !== null && !revisionValid(revision)))
    return failed();
  const result =
    revision === null
      ? await supabase
          .from("credential_vaults")
          .insert({ ...parsed.data, id: vaultId, user_id: user.id })
          .select("*")
          .single()
      : await supabase
          .from("credential_vaults")
          .update(parsed.data)
          .eq("user_id", user.id)
          .eq("id", vaultId)
          .eq("revision", revision)
          .select("*")
          .maybeSingle();
  if (result.error?.code === "23505" || (!result.error && !result.data))
    return changed();
  if (result.error || !result.data) return failed();
  invalidate();
  return { ok: true, data: result.data };
}
export async function loadPortalPage(
  owner: string,
  vaultId: string,
  applicationId: string | null,
  onlyLinked: boolean,
  page: number,
): Promise<
  VaultResult<{
    records: PortalRecord[];
    count: number;
    linked: string[];
    page: number;
  }>
> {
  const { supabase, user } = await requireAccount();
  if (
    owner !== user.id ||
    !uuid(vaultId) ||
    (applicationId !== null && !uuid(applicationId))
  )
    return changed();
  if (
    !z.number().int().min(1).max(100000).safeParse(page).success ||
    typeof onlyLinked !== "boolean"
  )
    return failed();
  const queryPage = (requestedPage: number) =>
    supabase
      .rpc(
        "list_portal_accounts",
        { p_application_id: onlyLinked ? applicationId : null },
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .eq("vault_id", vaultId)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(
        (requestedPage - 1) * VAULT_PAGE_SIZE,
        requestedPage * VAULT_PAGE_SIZE - 1,
      );
  let actualPage = page;
  let result = await queryPage(page);
  // Concurrent deletion/unlinking can remove the requested page. Re-query page
  // one for an accurate count; PostgREST's 416 error does not include one.
  if (
    page > 1 &&
    (result.error?.code === "PGRST103" ||
      (!result.error && !result.data?.length))
  ) {
    actualPage = 1;
    result = await queryPage(1);
  }
  if (result.error) return failed();
  const records = result.data ?? [];
  let linked: string[] = [];
  if (applicationId && records.length) {
    const links = await supabase
      .from("application_portals")
      .select("portal_id")
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .eq("vault_id", vaultId)
      .in(
        "portal_id",
        records.map((record) => record.id),
      );
    if (links.error) return failed();
    linked = links.data.map((row) => row.portal_id);
  }
  return {
    ok: true,
    data: { records, count: result.count ?? 0, linked, page: actualPage },
  };
}
export async function savePortal(
  owner: string,
  vaultId: string,
  id: string,
  revision: number | null,
  input: unknown,
  applicationId: string | null,
): Promise<VaultResult> {
  const { supabase, user } = await requireAccount();
  if (
    owner !== user.id ||
    !uuid(vaultId) ||
    !uuid(id) ||
    (applicationId !== null && !uuid(applicationId))
  )
    return changed();
  const parsed = encryptedPortal.safeParse(input);
  if (!parsed.success || (revision !== null && !revisionValid(revision)))
    return failed();
  if (revision === null) {
    const result = await supabase.rpc("create_portal_account", {
      p_id: id,
      p_vault_id: vaultId,
      p_nonce: parsed.data.nonce,
      p_ciphertext: parsed.data.ciphertext,
      p_application_id: applicationId,
    });
    if (result.error)
      return result.error.code === "23503" ? changed() : failed();
  } else {
    const result = await supabase
      .from("portal_accounts")
      .update(parsed.data)
      .eq("user_id", user.id)
      .eq("vault_id", vaultId)
      .eq("id", id)
      .eq("revision", revision)
      .select("id")
      .maybeSingle();
    if (result.error) return failed();
    if (!result.data) return stale();
  }
  invalidate();
  return { ok: true, data: undefined };
}
export async function linkPortal(
  owner: string,
  vaultId: string,
  portalId: string,
  applicationId: string,
  linked: boolean,
): Promise<VaultResult> {
  const { supabase, user } = await requireAccount();
  if (
    owner !== user.id ||
    ![vaultId, portalId, applicationId].every(uuid) ||
    typeof linked !== "boolean"
  )
    return changed();
  const result = linked
    ? await supabase.from("application_portals").insert({
        application_id: applicationId,
        portal_id: portalId,
        vault_id: vaultId,
        user_id: user.id,
      })
    : await supabase
        .from("application_portals")
        .delete()
        .eq("user_id", user.id)
        .eq("vault_id", vaultId)
        .eq("portal_id", portalId)
        .eq("application_id", applicationId);
  if (result.error && !(linked && result.error.code === "23505"))
    return result.error.code === "23503" ? changed() : failed();
  invalidate();
  return { ok: true, data: undefined };
}
export async function deletePortal(
  owner: string,
  vaultId: string,
  id: string,
  revision: number,
  confirmation: string,
): Promise<VaultResult> {
  const { supabase, user } = await requireAccount();
  if (owner !== user.id || ![vaultId, id].every(uuid)) return changed();
  if (!revisionValid(revision) || confirmation !== "delete") return failed();
  const result = await supabase
    .from("portal_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("vault_id", vaultId)
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) return failed();
  if (!result.data) return stale();
  invalidate();
  return { ok: true, data: undefined };
}
export async function resetVault(
  owner: string,
  vaultId: string,
  revision: number,
  confirmation: string,
): Promise<VaultResult> {
  const { supabase, user } = await requireAccount();
  if (owner !== user.id || !uuid(vaultId)) return changed();
  if (!revisionValid(revision) || confirmation !== "DELETE VAULT")
    return failed();
  const result = await supabase
    .from("credential_vaults")
    .delete()
    .eq("user_id", user.id)
    .eq("id", vaultId)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) return failed();
  if (!result.data) return changed();
  invalidate();
  return { ok: true, data: undefined };
}
