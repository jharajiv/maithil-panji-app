import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./client";

export const metadata: Metadata = { title: "Sign in — Maithil Panji" };

export default function LoginPage() {
  return <Suspense><LoginClient /></Suspense>;
}
