import type { Metadata } from "next";
import { BuildApp } from "@/components/build/BuildApp";

export const metadata: Metadata = { title: "Family tree — Maithil Panji" };

export default async function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuildApp treeId={id} />;
}
