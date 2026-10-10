import { isStaging } from "@/lib/env";

/** a thin bar on every page of the test copy, so nobody mistakes it for the real site */
export function StagingBanner() {
  if (!isStaging()) return null;
  return (
    <div role="status" className="sticky top-0 z-[100] bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-amber-950">
      STAGING — a test copy of paag.org.in. Nothing here is real; data can be erased at any time.
    </div>
  );
}
