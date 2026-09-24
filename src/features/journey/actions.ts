"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { recordIdentity } from "@/features/applications/model";
import {
  contactInput,
  roundInput,
  taskInput,
  tables,
  journeyTypes,
  type JourneyType,
  type JourneyState,
} from "./model";

const conflict = (): JourneyState => ({
  conflict: true,
  message:
    "This record changed or is no longer available. Your edits are still here. Open the latest version before trying again.",
});
const failure = (): JourneyState => ({
  message:
    "We couldn’t save this change. Your details are still here. Please try again.",
});
export async function saveJourney(
  type: JourneyType,
  applicationId: string,
  id: string | null,
  revision: number | null,
  roundId: string | null,
  _state: JourneyState,
  form: FormData,
): Promise<JourneyState> {
  const { supabase, user } = await requireAccount();
  if (
    !z.enum(journeyTypes).safeParse(type).success ||
    !z.uuid().safeParse(applicationId).success
  )
    return conflict();
  const parent = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (parent.error) return failure();
  if (!parent.data) return conflict();
  if (id !== null && !recordIdentity.safeParse({ id, revision }).success)
    return conflict();
  const fields = Object.fromEntries(form);
  const owner = { user_id: user.id, application_id: applicationId };
  // Each schema strips unknown fields; ownership and task links come from checked identities.
  let result;
  if (type === "round") {
    const parsed = roundInput.safeParse(fields);
    if (!parsed.success)
      return {
        message: "Check the highlighted fields.",
        errors: z.flattenError(parsed.error).fieldErrors,
      };
    result = id
      ? await supabase
          .from("hiring_rounds")
          .update(parsed.data)
          .eq("user_id", user.id)
          .eq("application_id", applicationId)
          .eq("id", id)
          .eq("revision", revision!)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("hiring_rounds")
          .insert({ ...parsed.data, ...owner })
          .select("id")
          .single();
  } else if (type === "task") {
    const parsed = taskInput.safeParse(fields);
    if (!parsed.success)
      return {
        message: "Check the highlighted fields.",
        errors: z.flattenError(parsed.error).fieldErrors,
      };
    if (roundId !== null && id === null) {
      if (!z.uuid().safeParse(roundId).success) return conflict();
      const round = await supabase
        .from("hiring_rounds")
        .select("id")
        .eq("user_id", user.id)
        .eq("application_id", applicationId)
        .eq("id", roundId)
        .maybeSingle();
      if (round.error) return failure();
      if (!round.data) return conflict();
    }
    result = id
      ? await supabase
          .from("preparation_tasks")
          .update(parsed.data)
          .eq("user_id", user.id)
          .eq("application_id", applicationId)
          .eq("id", id)
          .eq("revision", revision!)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("preparation_tasks")
          .insert({ ...parsed.data, ...owner, round_id: roundId })
          .select("id")
          .single();
  } else {
    const parsed = contactInput.safeParse(fields);
    if (!parsed.success)
      return {
        message: "Check the highlighted fields.",
        errors: z.flattenError(parsed.error).fieldErrors,
      };
    result = id
      ? await supabase
          .from("application_contacts")
          .update(parsed.data)
          .eq("user_id", user.id)
          .eq("application_id", applicationId)
          .eq("id", id)
          .eq("revision", revision!)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("application_contacts")
          .insert({ ...parsed.data, ...owner })
          .select("id")
          .single();
  }
  if (result.error) return failure();
  if (!result.data) return conflict();
  revalidatePath("/app", "layout");
  redirect(`/app/applications/${applicationId}?journey=saved#${type}s`);
}
export async function deleteJourney(
  type: JourneyType,
  applicationId: string,
  id: string,
  revision: number,
  _state: JourneyState,
  form: FormData,
): Promise<JourneyState> {
  const { supabase, user } = await requireAccount();
  if (form.get("confirm") !== "delete")
    return { message: "Confirm that you want to delete this record." };
  if (
    !z.enum(journeyTypes).safeParse(type).success ||
    !z.uuid().safeParse(applicationId).success ||
    !recordIdentity.safeParse({ id, revision }).success
  )
    return conflict();
  const result = await supabase
    .from(tables[type])
    .delete()
    .eq("user_id", user.id)
    .eq("application_id", applicationId)
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) return failure();
  if (!result.data) return conflict();
  revalidatePath("/app", "layout");
  redirect(`/app/applications/${applicationId}?journey=deleted#${type}s`);
}
export async function setTaskCompleted(
  applicationId: string,
  id: string,
  revision: number,
  completed: boolean,
  _state: JourneyState,
): Promise<JourneyState> {
  void _state;
  const { supabase, user } = await requireAccount();
  if (
    !z.uuid().safeParse(applicationId).success ||
    !recordIdentity.safeParse({ id, revision }).success ||
    typeof completed !== "boolean"
  )
    return conflict();
  const result = await supabase
    .from("preparation_tasks")
    .update({ completed })
    .eq("user_id", user.id)
    .eq("application_id", applicationId)
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (result.error) return failure();
  if (!result.data) return conflict();
  revalidatePath("/app", "layout");
  return {};
}
