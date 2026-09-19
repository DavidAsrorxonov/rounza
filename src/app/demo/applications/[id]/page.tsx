import type { Metadata } from "next";
import { ApplicationDetail } from "@/features/demo/application-detail";

export const metadata: Metadata = { title: "Application · Demo" };

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicationDetail id={id} />;
}
