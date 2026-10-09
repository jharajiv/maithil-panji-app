import type { Metadata } from "next";
import { AdminClient } from "@/components/account/AdminClient";

export const metadata: Metadata = { title: "Admin — PAAG Foundation", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminClient />;
}
