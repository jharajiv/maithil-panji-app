import type { Metadata } from "next";
import { UnsubscribeClient } from "./client";

export const metadata: Metadata = { title: "Unsubscribe — PAAG Foundation", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <UnsubscribeClient token={t ?? ""} />;
}
