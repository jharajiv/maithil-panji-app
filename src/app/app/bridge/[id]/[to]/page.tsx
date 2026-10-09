import type { Metadata } from "next";
import { ViewClient } from "@/components/account/ViewClient";

export const metadata: Metadata = { title: "Her family’s tree — Maithil Panji", robots: { index: false, follow: false } };

/** the other side of a bridge: the tree of the family a linked woman comes from (or married into), read-only */
export default async function BridgePage({ params, searchParams }: { params: Promise<{ id: string; to: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id, to } = await params;
  const { k } = await searchParams;
  return <ViewClient id={id} v="" bridge={{ to, k: k ?? "" }} />;
}
