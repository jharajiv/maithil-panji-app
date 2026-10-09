import type { Metadata } from "next";
import { JoinClient } from "@/components/account/JoinClient";

export const metadata: Metadata = { title: "Family tree invitation — PAAG Foundation", robots: { index: false } };

export default async function JoinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ i?: string }> }) {
  const { id } = await params;
  const { i } = await searchParams;
  return <JoinClient treeId={id} invite={typeof i === "string" ? i : ""} />;
}
