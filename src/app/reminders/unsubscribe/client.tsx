"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PaagLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function StopClient({ token }: { token: string }) {
  const [state, setState] = useState<"ask" | "busy" | "done" | "bad">(token ? "ask" : "bad");
  const go = async () => {
    setState("busy");
    try {
      const r = await fetch(`/api/reminders/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      setState(r.ok ? "done" : "bad");
    } catch { setState("bad"); }
  };
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 px-5 text-center">
      <PaagLogo height={40} className="mx-auto" />
      {state === "done" ? (<>
        <h1 className="font-display text-2xl font-bold text-indigo">Birthday reminders are off</h1>
        <p className="text-foreground/85">We will not send you birthday reminders any more. You can switch them on again any time in My profile.</p>
        <p lang="hi" className="text-foreground/85">अब आपको जन्मदिन के ईमेल नहीं आएँगे। चाहें तो “मेरी प्रोफ़ाइल” में दोबारा चालू कर सकते हैं।</p>
      </>) : state === "bad" ? (<>
        <h1 className="font-display text-2xl font-bold text-indigo">This link is not valid</h1>
        <p className="text-foreground/85">Please open the link from your latest reminder email again, or switch reminders off in My profile.</p>
      </>) : (<>
        <h1 className="font-display text-2xl font-bold text-indigo">Stop birthday reminders?</h1>
        <p className="text-foreground/85">You will no longer get emails about family birthdays. Your family tree is not affected.</p>
        <p lang="hi" className="text-foreground/85">जन्मदिन के ईमेल बंद हो जाएँगे। आपकी वंशावली पर कोई असर नहीं पड़ेगा।</p>
        <Button size="lg" onClick={go} disabled={state === "busy"} className="mx-auto">{state === "busy" && <Loader2 className="animate-spin" />} Yes, stop them · हाँ, बंद करें</Button>
      </>)}
      <Link href="/" className="text-sm underline">Go to the home page</Link>
    </main>
  );
}
