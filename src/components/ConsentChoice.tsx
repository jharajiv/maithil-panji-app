"use client";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, gaId, readConsent, setConsent, type Consent } from "@/lib/consent";

/** on the privacy page: shows the visitor's current choice about visit counting and lets them change it. Hidden when Google Analytics is not set up. */
export function ConsentChoice() {
  const [on, setOn] = useState(false);
  const [v, setV] = useState<Consent>(null);
  useEffect(() => {
    const sync = () => { setOn(!!gaId()); setV(readConsent()); };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  if (!on) return null;
  return (
    <div className="mt-3 rounded-xl border bg-card p-4" data-testid="consent-choice">
      <p className="text-sm leading-relaxed">
        Your choice on this device: <strong>{v === "granted" ? "visits are counted" : v === "denied" ? "visits are not counted" : "not chosen yet"}</strong>.
        <span lang="hi" className="block text-muted-foreground">इस डिवाइस पर आपका चुनाव: {v === "granted" ? "विज़िट गिनी जाती हैं" : v === "denied" ? "विज़िट नहीं गिनी जातीं" : "अभी चुना नहीं"}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setConsent("granted")} disabled={v === "granted"} className="h-11 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground disabled:opacity-50">Allow · ठीक है</button>
        <button type="button" onClick={() => setConsent("denied")} disabled={v === "denied"} className="h-11 rounded-xl border px-5 text-[15px] font-medium disabled:opacity-50">Don’t count · नहीं</button>
      </div>
    </div>
  );
}
