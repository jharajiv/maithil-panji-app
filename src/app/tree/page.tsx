import type { Metadata } from "next";
import { TreeView } from "@/components/tree/TreeView";

export const metadata: Metadata = { title: "Your family tree — Maithil Panji" };

export default function TreePage() {
  return <TreeView />;
}
