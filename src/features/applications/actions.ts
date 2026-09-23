"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import { applicationInput, recordIdentity, type FormState } from "./model";

function conflict(): FormState {
  return {
    conflict: true,
    message:
      "This application changed or is no longer available. Your edits are still here. Open the latest version before trying again.",
  };
}

export async function saveApplication(
  id: string | null,
  revision: number | null,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireAccount();
  const parsed = applicationInput.safeParse(
    Object.fromEntries(
      Object.keys(applicationInput.shape).map((key) => [key, form.get(key)]),
    ),
  );
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  let savedId: string;
  if (id !== null) {
    const identity = recordIdentity.safeParse({ id, revision });
    if (!identity.success) return conflict();
    const { data, error } = await supabase
      .from("applications")
      .update(parsed.data)
      .eq("user_id", user.id)
      .eq("id", identity.data.id)
      .eq("revision", identity.data.revision)
      .select("id")
      .maybeSingle();
    if (error)
      return {
        message:
          "We couldn’t save your changes. Your edits are still here. Please try again.",
      };
    if (!data) return conflict();
    savedId = data.id;
  } else {
    const { data, error } = await supabase
      .from("applications")
      .insert({ ...parsed.data, user_id: user.id })
      .select("id")
      .single();
    if (error || !data)
      return {
        message:
          "We couldn’t add this application. Your details are still here. Please try again.",
      };
    savedId = data.id;
  }
  revalidatePath("/app", "layout");
  redirect(`/app/applications/${savedId}?saved=1`);
}

export async function deleteApplication(
  id: string,
  revision: number,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase, user } = await requireAccount();
  if (form.get("confirm") !== "delete")
    return { message: "Confirm that you want to delete this application." };
  const identity = recordIdentity.safeParse({ id, revision });
  if (!identity.success) return conflict();
  const { data, error } = await supabase
    .from("applications")
    .delete()
    .eq("user_id", user.id)
    .eq("id", identity.data.id)
    .eq("revision", identity.data.revision)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      message: "We couldn’t delete this application. Please try again.",
    };
  if (!data) return conflict();
  revalidatePath("/app", "layout");
  redirect("/app/applications?deleted=1");
}
