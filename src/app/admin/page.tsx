import type { Metadata } from "next";
import { AdminClient } from "@/components/account/AdminClient";

export const metadata: Metadata = { title: "Admin — Maithil Panji", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminClient />;
}
