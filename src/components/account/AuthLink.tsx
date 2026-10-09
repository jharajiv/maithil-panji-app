"use client";
import Link from "next/link";
import { useAccount } from "./useAccount";

/** link in the landing page's top bar: "Sign in", or "My family trees" when already signed in. Hidden when accounts are off. */
export function AuthLink() {
  const a = useAccount();
  if (a.loading || !a.enabled) return null;
  return (
    <Link href={a.account ? "/app" : "/login?next=/app"} className="rounded-md border border-indigo/25 px-3.5 py-2 text-sm font-semibold text-indigo hover:bg-indigo/5">
      {a.account ? "My family trees" : "Sign in"}
    </Link>
  );
}

/** the big "Start" buttons: a new visitor goes straight to building (no sign-up first); someone signed in goes to their trees.
 *  Takes the styling a <Button asChild> hands down — without forwarding it the button looked like plain text. */
export function StartLink({ children, ...props }: Omit<React.ComponentProps<typeof Link>, "href">) {
  const a = useAccount();
  return <Link {...props} href={a.account ? "/app" : "/build"}>{children}</Link>;
}
