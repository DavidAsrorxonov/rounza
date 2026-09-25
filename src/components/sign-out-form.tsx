"use client";
import { AccountSubmit } from "./account-submit";
import { signOut } from "@/lib/auth/actions";
import { broadcastVaultLock } from "@/features/vault/lock";
export function SignOutForm() {
  return (
    <form action={signOut} onSubmit={broadcastVaultLock}>
      <AccountSubmit pendingLabel="Signing out…" variant="outline">
        Sign out
      </AccountSubmit>
    </form>
  );
}
