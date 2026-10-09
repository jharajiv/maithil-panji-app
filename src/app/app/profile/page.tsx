import type { Metadata } from "next";
import { ProfileClient } from "@/components/account/ProfileClient";

export const metadata: Metadata = { title: "My profile — PAAG Foundation" };

export default function ProfilePage() {
  return <ProfileClient />;
}
