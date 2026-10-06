"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "maithil-panji.savehint.v1";
/** the card first shows once a few relatives have been added, and may come back after another batch if it was dismissed */
export const SAVE_PROMPT_AT = 5;

/**
 * A gentle, never-blocking reminder: the tree so far lives only in this browser. Signing in saves it to an account
 * (the Dashboard moves the tree from this device across), so it can be opened anywhere and relatives can be invited.
 */
export function SavePrompt({ people, signedIn }: { people: number; signedIn: boolean }) {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null); // null = not read yet
  useEffect(() => { try { setDismissedAt(Number(localStorage.getItem(KEY) ?? -100)); } catch { setDismissedAt(-100); } }, []);
  if (dismissedAt === null || people < SAVE_PROMPT_AT || people < dismissedAt + 10) return null;
  const href = signedIn ? "/app?import=1" : `/login?next=${encodeURIComponent("/app?import=1")}`;
  const hide = () => { try { localStorage.setItem(KEY, String(people)); } catch { /* ignore */ } setDismissedAt(people); };
  return (
    <div role="region" aria-label="Save your tree" className="relative mx-3 mt-2 shrink-0 rounded-2xl border bg-card p-3 shadow-sm lg:fixed lg:inset-x-auto lg:bottom-6 lg:right-6 lg:z-30 lg:m-0 lg:w-[22rem] lg:p-4 lg:shadow-lg">
      <button type="button" aria-label="Not now" onClick={hide} className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><CloudUpload className="size-5" /></span>
        <div>
          <div className="font-display text-lg font-semibold leading-tight">Keep your tree safe</div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground lg:line-clamp-none">You have {people} people so far — saved only on this device. {signedIn ? "Save it to your account" : "Sign in with your email"} to keep it, continue anywhere, and invite relatives to help.</p>
          <div className="mt-2 flex items-center gap-3 lg:mt-3">
            <Button asChild size="sm"><Link href={href}>{signedIn ? "Save my tree" : "Save my tree — free"}</Link></Button>
            <button type="button" onClick={hide} className="text-sm text-muted-foreground underline-offset-2 hover:underline">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
