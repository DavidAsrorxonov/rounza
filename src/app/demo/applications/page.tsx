import type { Metadata } from "next";
import { Applications } from "@/features/demo/applications";

export const metadata: Metadata = { title: "Applications · Demo" };

export default function ApplicationsPage() {
  return <Applications />;
}
