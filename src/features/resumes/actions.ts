"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
import { recordIdentity } from "@/features/applications/model";
import { resumeInput, type ResumeState } from "./model";
const conflict = (): ResumeState => ({
  conflict: true,
  message:
    "This resume changed or is no longer available. Your draft is still here. Open the latest version before trying again.",
});
export async function saveResume(
  owner: string,
  id: string,
  revision: number | null,
  _state: ResumeState,
  form: FormData,
): Promise<ResumeState> {
  const { supabase, user } = await requireAccount();
  if (user.id !== owner)
    return { message: "Your account changed. Reload this page before saving." };
  if (
    !z.uuid().safeParse(id).success ||
    (revision !== null && !recordIdentity.safeParse({ id, revision }).success)
  )
    return conflict();
  const parsed = resumeInput.safeParse({
    name: form.get("name"),
    body: form.get("body"),
    source: form.get("source"),
  });
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  if (form.get("reviewed") !== "yes")
    return {
      message: "Review the text and confirm it is ready to save.",
      errors: { reviewed: ["Confirm that you reviewed this text."] },
    };
  const result =
    revision === null
      ? await supabase
          .from("resumes")
          .insert({ ...parsed.data, id, user_id: user.id })
          .select("id")
          .single()
      : await supabase
          .from("resumes")
          .update(parsed.data)
          .eq("user_id", user.id)
          .eq("id", id)
          .eq("revision", revision)
          .select("id")
          .maybeSingle();
  if (result.error?.code === "23505" || (!result.error && !result.data))
    return conflict();
  if (result.error)
    return {
      message:
        "We couldn’t save this resume. Your draft is still here. Please try again.",
    };
  revalidatePath("/app/resumes", "layout");
  redirect(`/app/resumes/${id}?saved=1`);
}
export async function deleteResume(
  owner: string,
  id: string,
  revision: number,
  _state: ResumeState,
  form: FormData,
): Promise<ResumeState> {
  const { supabase, user } = await requireAccount();
  if (owner !== user.id)
    return { message: "Your account changed. Reload before deleting." };
  if (
    form.get("confirm") !== "delete" ||
    !recordIdentity.safeParse({ id, revision }).success
  )
    return conflict();
  const { data, error } = await supabase
    .from("resumes")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  if (error)
    return { message: "We couldn’t delete this resume. Please try again." };
  if (!data) return conflict();
  revalidatePath("/app/resumes", "layout");
  redirect("/app/resumes?deleted=1");
}
