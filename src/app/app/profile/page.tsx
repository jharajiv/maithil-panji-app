import type { Metadata } from "next";
import { ProfileClient } from "@/components/account/ProfileClient";

export const metadata: Metadata = { title: "My profile — Maithil Panji" };

export default function ProfilePage() {
  return <ProfileClient />;
}
