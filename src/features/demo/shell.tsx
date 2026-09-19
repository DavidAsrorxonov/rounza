"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleHelp,
  LayoutDashboard,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modal } from "./shared";
import { demoActions, useDemo } from "./store";

export function DemoShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const demo = useDemo();
  const [guideOpen, setGuideOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const navigation = [
    {
      href: "/demo",
      label: "Overview",
      icon: LayoutDashboard,
      active: path === "/demo",
    },
    {
      href: "/demo/applications",
      label: "Applications",
      icon: BriefcaseBusiness,
      active: path.startsWith("/demo/applications"),
    },
  ];
  const links = navigation.map(({ href, label, icon: Icon, active }) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("workspace-nav-link", active && "nav-active")}
    >
      <Icon size={18} aria-hidden="true" />
      {label}
      {label === "Applications" && demo && (
        <span className="nav-count">{demo.data.applications.length}</span>
      )}
    </Link>
  ));
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link href="/" className="wordmark text-white" aria-label="Rounza home">
          rounza<span>.</span>
        </Link>
        <div className="workspace-label">
          <span className="size-1.5 rounded-full bg-accent" /> PERSONAL
          WORKSPACE
        </div>
        <nav aria-label="Main navigation" className="space-y-2">
          {links}
        </nav>
        <div className="sidebar-note">
          <Sparkles size={20} className="text-accent" aria-hidden="true" />
          <p className="mt-4 text-lg font-medium leading-snug tracking-tight">
            Big moves start
            <br />
            with a little clarity.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/55">
            One place for every possibility.
          </p>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">AR</span>
          <div>
            <p className="text-sm font-medium text-white">Alex Rivera</p>
            <p className="mt-0.5 text-xs text-white/50">Sample job seeker</p>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <Link
            href="/"
            className="wordmark lg:hidden"
            aria-label="Rounza home"
          >
            rounza<span>.</span>
          </Link>
          <p className="hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
            Workspace <span className="text-border">/</span>
            <span className="text-foreground">
              {path === "/demo" ? "Overview" : "Applications"}
            </span>
          </p>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="demo-badge">
              <span aria-hidden="true" />
              Demo workspace
            </span>
            <button
              className="icon-button"
              aria-label="About this demo"
              onClick={() => setGuideOpen(true)}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="Reset demo"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={18} />
            </button>
            <span className="profile-avatar hidden sm:flex" aria-hidden="true">
              AR
            </span>
          </div>
        </header>
        <nav aria-label="Mobile navigation" className="mobile-navigation">
          {links}
        </nav>
        <div className="demo-banner">
          <span className="demo-banner-tag">PLAYGROUND</span>
          <p>
            Explore a fictional job search. Edits stay in this tab.{" "}
            <span className="hidden sm:inline">
              Use sample information only.
            </span>
          </p>
          <button onClick={() => setGuideOpen(true)}>
            How it works <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>
        {demo?.memoryOnly && (
          <p role="alert" className="storage-warning">
            Session storage is unavailable in this browser. Changes will be lost
            when you reload.
          </p>
        )}
        <main id="main-content" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Small steps. New possibilities.</span>
          <span>
            Rounza demo <span aria-hidden="true">↗</span>
          </span>
        </footer>
        <div className={cn("demo-notice", !demo?.notice && "sr-only")}>
          <p role="status" aria-live="polite">
            {demo?.notice}
          </p>
          {demo?.notice && (
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => demoActions.dismissNotice()}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <Modal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        title="Make yourself at home"
        description="This is a public, fictional workspace for trying Rounza. No account is needed."
      >
        <ol className="guide-list">
          <li>
            <span>01</span>
            <div>
              <h3>Start with your next action</h3>
              <p>
                Complete a task, open an application, or see what interview is
                coming up.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Follow the whole journey</h3>
              <p>
                Switch between list and board views. Explore multiple interview
                rounds, reschedule one, or save a sample note.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Experiment, then reset</h3>
              <p>
                Changes survive reloads in this tab. Reset restores the original
                examples. Use fictional information; this is not a private
                account or secure vault.
              </p>
            </div>
          </li>
        </ol>
        <p className="mt-5 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          AI analysis is a precomputed example. Portal credentials are
          deliberately fake. No live AI, authentication, or employer portal
          connections are active.
        </p>
        <Button className="mt-6 w-full" onClick={() => setGuideOpen(false)}>
          Let’s explore
        </Button>
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Start fresh?"
        description="Resetting removes your demo additions and edits, and brings back the ten original fictional applications."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setResetOpen(false)}>
            Keep exploring
          </Button>
          <Button
            onClick={() => {
              demoActions.reset();
              setResetOpen(false);
              router.replace("/demo");
            }}
          >
            Reset sample workspace
          </Button>
        </div>
      </Modal>
    </div>
  );
}
