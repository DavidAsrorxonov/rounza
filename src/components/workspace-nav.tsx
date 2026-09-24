"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  CalendarClock,
} from "lucide-react";
export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Workspace">
      <Link href="/app" aria-current={pathname === "/app" ? "page" : undefined}>
        <LayoutDashboard size={16} aria-hidden="true" />
        Overview
      </Link>
      <Link
        href="/app/applications"
        aria-current={
          pathname.startsWith("/app/applications") ? "page" : undefined
        }
      >
        <BriefcaseBusiness size={16} aria-hidden="true" />
        Applications
      </Link>
      <Link
        href="/app/next-actions"
        aria-current={pathname === "/app/next-actions" ? "page" : undefined}
      >
        <CalendarClock size={16} aria-hidden="true" />
        Next actions
      </Link>
    </nav>
  );
}
