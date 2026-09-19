import type { Metadata } from "next";
import { Dashboard } from "@/features/demo/dashboard";

export const metadata: Metadata = { title: "Overview · Demo" };

export default function DemoPage() {
  return <Dashboard />;
}
