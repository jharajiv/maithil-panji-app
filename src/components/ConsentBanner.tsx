"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BANNER_PATHS, CONSENT_EVENT, gaId, readConsent, setConsent } from "@/lib/consent";

/** one small line at the bottom of the public pages, only when Google Analytics is set up and the visitor has not chosen yet */
export function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(!!gaId() && readConsent() === null && BANNER_PATHS.test(pathname));
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, [pathname]);
  if (!open) return null;
  return (
    <div role="region" aria-label="Visitor statistics" className="fixed inset-x-0 bottom-0 z-50 border-t bg-card px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-[13px] leading-snug text-foreground/85">
          May we count visits with Google Analytics, to improve the site? No names and no family trees are shared.
          <span lang="hi" className="mt-0.5 block text-[12.5px] text-muted-foreground">क्या हम साइट सुधारने के लिए Google Analytics से विज़िट गिन सकते हैं? कोई नाम या वंशावली साझा नहीं होती।</span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setConsent("granted"); setOpen(false); }} className="h-10 flex-1 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground sm:flex-none">Allow · ठीक है</button>
          <button type="button" onClick={() => { setConsent("denied"); setOpen(false); }} className="h-10 flex-1 rounded-xl border px-5 text-[15px] font-medium sm:flex-none">No thanks · नहीं</button>
        </div>
      </div>
    </div>
  );
}
