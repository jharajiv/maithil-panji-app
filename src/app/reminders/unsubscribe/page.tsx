import type { Metadata } from "next";
import { StopClient } from "./client";

export const metadata: Metadata = { title: "Stop birthday reminders — PAAG Foundation", robots: { index: false } };

export default async function StopPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <StopClient token={t ?? ""} />;
}
