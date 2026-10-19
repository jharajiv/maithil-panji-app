"use client";
/** Story board: how many stories wait for this person to approve, and how many the owner has to look at (flagged). */
import { useCallback, useEffect, useState } from "react";
import type { ShareInfo } from "./useShare";

export function useStories(share: ShareInfo | null, qs: string) {
  const [counts, setCounts] = useState({ waiting: 0, flagged: 0 });
  const treeId = share?.treeId;
  const load = useCallback(async () => {
    if (!treeId) { setCounts({ waiting: 0, flagged: 0 }); return; }
    try {
      const res = await fetch(`/api/trees/${treeId}/stories?count=1${qs ? `&${qs}` : ""}`, { cache: "no-store" });
      if (res.ok) { const j = (await res.json()) as { waiting: number; flagged: number }; setCounts({ waiting: j.waiting, flagged: j.flagged }); }
    } catch { /* offline: keep what we have */ }
  }, [treeId, qs]);
  useEffect(() => {
    if (!treeId) return;
    const t = setTimeout(load, 4000);
    const i = setInterval(() => { if (document.visibilityState === "visible") load(); }, 90_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [treeId, load]);
  return { ...counts, total: counts.waiting + counts.flagged, reload: load };
}
export type StoriesState = ReturnType<typeof useStories>;
