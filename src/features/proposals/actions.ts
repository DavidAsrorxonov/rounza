"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/account";
export async function decideProposal(
  owner: string,
  id: string,
  revision: number,
  _state: { message?: string },
  form: FormData,
) {
  const { supabase, user } = await requireAccount();
  if (user.id !== owner)
    return { message: "Your account changed. Reload before reviewing." };
  const decision = form.get("decision");
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !["approve", "reject"].includes(String(decision))
  )
    return { message: "Reload this proposal and try again." };
  if (decision === "approve" && form.get("reviewed") !== "yes")
    return { message: "Review every change and confirm before approving." };
  const { error } = await supabase.rpc("decide_ai_proposal", {
    proposal_id: id,
    expected_revision: revision,
    decision: String(decision),
  });
  if (error)
    return {
      message:
        "Nothing was applied. A source record, connection permission, or proposal may have changed, or this request has expired. Reload to check its status. If it is still pending, reject it and ask your assistant for a fresh proposal.",
    };
  revalidatePath("/app", "layout");
  redirect(`/app/review-inbox/${id}?decision=${decision}`);
}
