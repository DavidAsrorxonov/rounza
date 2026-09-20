"use client";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <section className="account-card" role="alert">
      <h1 className="text-2xl font-semibold">Your workspace couldn’t load.</h1>
      <p>We couldn’t reach your account data. Please try again in a moment.</p>
      <Button onClick={reset} className="mt-5">
        Try again
      </Button>
    </section>
  );
}
