import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-6 py-16"
    >
      <p className="mb-4 text-sm font-semibold text-primary">404</p>
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This page may have moved, or the address may be incorrect.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/">Back to Rounza</Link>
        </Button>
      </div>
    </main>
  );
}
