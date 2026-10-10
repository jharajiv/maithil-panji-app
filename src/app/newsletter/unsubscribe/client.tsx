"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PaagLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<"ask" | "busy" | "done" | "bad">(token ? "ask" : "bad");
  const go = async () => {
    setState("busy");
    try {
      const r = await fetch(`/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      setState(r.ok ? "done" : "bad");
    } catch { setState("bad"); }
  };
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-5 text-center">
      <PaagLogo height={40} className="mx-auto" />
      {state === "done" ? (<>
        <h1 className="font-display text-2xl font-bold text-indigo">You are unsubscribed</h1>
        <p className="text-foreground/85">We will not send you the newsletter any more. You can subscribe again at any time from the bottom of the home page.</p>
      </>) : state === "bad" ? (<>
        <h1 className="font-display text-2xl font-bold text-indigo">This link is not valid</h1>
        <p className="text-foreground/85">Please open the unsubscribe link from the latest email again, or write to us and we will remove you.</p>
      </>) : (<>
        <h1 className="font-display text-2xl font-bold text-indigo">Unsubscribe from the newsletter?</h1>
        <p className="text-foreground/85">You will stop receiving updates from PAAG Foundation.</p>
        <Button size="lg" onClick={go} disabled={state === "busy"} className="mx-auto">{state === "busy" && <Loader2 className="animate-spin" />} Yes, unsubscribe me</Button>
      </>)}
      <Link href="/" className="text-sm underline">Go to the home page</Link>
    </main>
  );
}
