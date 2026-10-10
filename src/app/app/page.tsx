import type { Metadata } from "next";
import { Dashboard } from "@/components/account/Dashboard";

export const metadata: Metadata = { title: "My family trees — PAAG Foundation" };

export default function AppHome() {
  return <Dashboard />;
}
