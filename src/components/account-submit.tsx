"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function AccountSubmit({
  children,
  pendingLabel,
  disabled = false,
  variant = "default",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="h-12 w-full rounded-lg"
      variant={variant}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
