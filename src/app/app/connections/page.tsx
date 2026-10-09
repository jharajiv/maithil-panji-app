import type { Metadata } from "next";
import { ConnectionsClient } from "@/components/account/ConnectionsClient";

export const metadata: Metadata = { title: "My connections — PAAG Foundation" };

export default function ConnectionsPage() {
  return <ConnectionsClient />;
}
