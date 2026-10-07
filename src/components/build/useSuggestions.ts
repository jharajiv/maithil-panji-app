"use client";
/** Corrections that viewers suggested — for the owner and helpers. */
import { useCallback, useEffect, useState } from "react";
import type { Suggestion } from "@/lib/store";
import type { ShareInfo } from "./useShare";

export type Inbox = Suggestion & { canApply: boolean };

export function useSuggestions(share: ShareInfo | null, auth: { qs: string; body: Record<string, unknown> }, refresh: () => Promise<void>) {
  const [list, setList] = useState<Inbox[]>([]);
  const treeId = share?.treeId;
  const qs = auth.qs;
  const load = useCallback(async () => {
    if (!treeId) { setList([]); return; }
    try {
      const res = await fetch(`/api/trees/${treeId}/suggestions${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (res.ok) setList(((await res.json()) as { suggestions: Inbox[] }).suggestions);
    } catch { /* offline: keep what we have */ }
  }, [treeId, qs]);
  useEffect(() => {
    if (!treeId) return;
    const t = setTimeout(load, 3000);
    const i = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [treeId, load]);

  const act = useCallback(async (id: string, action: "apply" | "done" | "dismiss") => {
    if (!treeId) return;
    const res = await fetch(`/api/trees/${treeId}/suggestions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...auth.body, id, action }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Could not do that.");
    setList((l) => l.filter((x) => x.id !== id));
    if (action === "apply") await refresh();
  }, [treeId, auth.body, refresh]);
  return { list, act, reload: load };
}
export type SuggestionsState = ReturnType<typeof useSuggestions>;
