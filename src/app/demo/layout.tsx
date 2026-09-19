import type { Metadata } from "next";
import { DemoShell } from "@/features/demo/shell";

export const metadata: Metadata = {
  title: "Demo workspace",
  robots: { index: false, follow: false },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoShell>{children}</DemoShell>;
}
