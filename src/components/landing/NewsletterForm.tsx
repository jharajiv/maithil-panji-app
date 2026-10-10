"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Updates from PAAG Foundation": email, language, agreement. Hides itself until the site's newsletter is switched on. */
export function NewsletterForm({ source = "footer", dark }: { source?: string; dark?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [agree, setAgree] = useState(false);
  const [trap, setTrap] = useState(""); // hidden field: only robots fill it
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/newsletter", { cache: "no-store" }).then((r) => r.json()).then((j: { enabled?: boolean }) => { if (live) setEnabled(!!j.enabled); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setState("busy");
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, lang, source, consent: agree, website: trap }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(j.error ?? "Something went wrong. Please try again."); setState("idle"); return; }
      setState("done");
    } catch { setError("Could not reach the server. Please try again."); setState("idle"); }
  };

  const muted = dark ? "text-cream/70" : "text-muted-foreground";
  const field = `h-11 rounded-xl border px-3 text-base ${dark ? "border-cream/30 bg-white/10 text-cream placeholder:text-cream/50" : "bg-background"}`;
  return (
    <section aria-labelledby="nl-title" className="mx-auto mb-6 max-w-md text-left">
      <h2 id="nl-title" className={`font-display text-lg font-semibold ${dark ? "text-cream" : "text-indigo"}`}>Updates from PAAG Foundation</h2>
      <p className={`mt-0.5 text-sm ${muted}`}>New features and stories of Maithil families, a few times a year. Free, and you can stop any time.</p>
      {state === "done" ? (
        <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${dark ? "border-cream/30" : "bg-card"}`}>Thank you. We have sent you an email: please open it and press <strong>Confirm my email</strong>. Look in Spam or Promotions if you do not see it.</p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2.5">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="nl-email">Email address</label>
            <input id="nl-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" className={`${field} min-w-0 flex-1`} />
            <label className="sr-only" htmlFor="nl-lang">Language</label>
            <select id="nl-lang" value={lang} onChange={(e) => setLang(e.target.value === "hi" ? "hi" : "en")} className={`${field} w-28`}>
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
          </div>
          {/* a real person never sees or fills this */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label></div>
          <label className={`flex items-start gap-2 text-xs leading-snug ${muted}`}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
            <span>I agree to receive occasional emails from PAAG Foundation. I can unsubscribe at any time. <a href="/privacy" className="underline">Privacy</a></span>
          </label>
          {error && <p role="alert" className={`text-sm ${dark ? "text-ochre" : "text-terracotta"}`}>{error}</p>}
          <Button type="submit" disabled={state === "busy" || !email || !agree} variant={dark ? "secondary" : "default"} className="w-full sm:w-auto">
            {state === "busy" && <Loader2 className="animate-spin" />} Subscribe
          </Button>
        </form>
      )}
    </section>
  );
}
