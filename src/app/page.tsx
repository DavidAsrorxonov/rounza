import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between gap-4 border-b py-7">
        <span className="text-2xl font-bold tracking-tighter">
          rounza<span className="text-primary">.</span>
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
          Coming soon
        </span>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col justify-center py-20 sm:py-28"
      >
        <p className="mb-6 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
          Every application. Every round.
        </p>
        <h1 className="max-w-4xl text-5xl leading-[1.05] font-bold tracking-[-0.055em] sm:text-7xl lg:text-8xl">
          A home for your
          <br className="hidden sm:block" /> next chapter.
        </h1>
        <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
          Your job search has a lot of moving parts. Rounza is taking shape to
          help you keep them together, from the first application to the final
          round.
        </p>
        <div className="mt-9">
          <Button asChild size="lg">
            <a href="https://github.com/DavidAsrorxonov/rounza">
              Follow the project <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </main>

      <footer className="border-t py-6 text-sm text-muted-foreground">
        A little more clarity for what comes next.
      </footer>
    </div>
  );
}
