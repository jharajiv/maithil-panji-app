"use client";
import Link from "next/link";
import { useAccount } from "./useAccount";

/** top-right link on the landing page: "Sign in", or "My trees" when already signed in. Hidden when accounts are off. */
export function AuthLink() {
  const a = useAccount();
  if (a.loading || !a.enabled) return null;
  return (
    <Link href={a.account ? "/app" : "/login?next=/app"} className="absolute right-4 top-3 z-10 rounded-full bg-card/90 px-4 py-2 text-sm font-medium text-indigo shadow-sm backdrop-blur hover:bg-card sm:right-8 sm:top-5">
      {a.account ? "My family trees" : "Sign in"}
    </Link>
  );
}

/** the big "Start" buttons: a new visitor goes straight to building (no sign-up first); someone signed in goes to their trees */
export function StartLink({ children }: { children: React.ReactNode }) {
  const a = useAccount();
  return <Link href={a.account ? "/app" : "/build"}>{children}</Link>;
}
