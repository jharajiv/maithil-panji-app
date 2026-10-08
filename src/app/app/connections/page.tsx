import type { Metadata } from "next";
import { ConnectionsClient } from "@/components/account/ConnectionsClient";

export const metadata: Metadata = { title: "My connections — Maithil Panji · PAAG Foundation" };

export default function ConnectionsPage() {
  return <ConnectionsClient />;
}
