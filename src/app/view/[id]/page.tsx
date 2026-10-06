import type { Metadata } from "next";
import { ViewClient } from "@/components/account/ViewClient";

export const metadata: Metadata = { title: "Family tree — Maithil Panji", robots: { index: false, follow: false } };

export default async function ViewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const { v } = await searchParams;
  return <ViewClient id={id} v={v ?? ""} />;
}
