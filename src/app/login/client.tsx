"use client";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/account/LoginForm";

export function LoginClient() {
  const q = useSearchParams();
  return <LoginForm next={q.get("next") ?? undefined} />;
}
