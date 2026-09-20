import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <span className="wordmark">
          rounza<span>.</span>
        </span>
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-medium"
        >
          Sign in <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="landing-main">
        <div className="landing-copy">
          <p className="eyebrow">EVERY APPLICATION. EVERY ROUND.</p>
          <h1>
            Your search.
            <br />A little <span>clearer.</span>
          </h1>
          <p className="landing-description">
            A home for your next chapter. Bring your applications, interviews,
            and next steps together, so you can focus on the possibilities.
          </p>
          <Button size="lg" className="mt-8 h-12 rounded-lg px-6" asChild>
            <Link href="/demo">
              Try the interactive demo{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            No sign-up. Fictional data. Room to explore.
          </p>
          <div className="landing-points">
            <span>
              <Check size={14} aria-hidden="true" /> See the whole journey
            </span>
            <span>
              <Check size={14} aria-hidden="true" /> Know your next step
            </span>
          </div>
        </div>
        <div
          className="landing-preview"
          aria-label="A preview of Rounza’s sample workspace"
        >
          <div className="preview-label">
            <span className="demo-badge">
              <span aria-hidden="true" />A little look inside
            </span>
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <p className="mt-7 text-xs font-medium text-muted-foreground">
            YOUR NEXT MOVE
          </p>
          <div className="preview-application">
            <span className="company-mark company-lilac" aria-hidden="true">
              N
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Northstar</p>
              <p className="mt-1 text-base font-semibold">Portfolio review</p>
            </div>
            <span className="preview-dot" aria-hidden="true" />
          </div>
          <div className="preview-journey">
            <div>
              <span className="is-done">
                <Check size={12} />
              </span>
              <p>Screening</p>
            </div>
            <div>
              <span className="is-done">
                <Check size={12} />
              </span>
              <p>Design lead</p>
            </div>
            <div>
              <span className="is-current">3</span>
              <p>Portfolio</p>
            </div>
            <div>
              <span>4</span>
              <p>Team</p>
            </div>
          </div>
          <div className="preview-task">
            <Circle size={17} className="text-primary" aria-hidden="true" />
            <div>
              <p>Polish your case study</p>
              <span>One small step toward the next round.</span>
            </div>
          </div>
          <div className="preview-footer">
            <span>THE WHOLE PICTURE, AT LAST.</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <span>Small steps. New possibilities.</span>
        <a href="https://github.com/DavidAsrorxonov/rounza">
          Follow the project <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
