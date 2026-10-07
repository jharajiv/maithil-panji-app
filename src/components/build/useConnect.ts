"use client";
/** Matching married women across trees (opt-in). The server does the matching; this keeps the list, dismissals and confirm/remove calls. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DFamily } from "@/lib/family";
import { womenToMatch, type Candidate, type Preview } from "@/lib/connect";
import type { ShareInfo } from "./useShare";

export type { Candidate, Preview };
export interface PreviewReq { person: string; tree: string; p: string }
interface Data { on: boolean; women: number; matches: Candidate[] }

const dkey = (treeId: string) => `maithil-panji.dismissed.${treeId}`;
const readDismissed = (treeId: string): string[] => { try { return JSON.parse(localStorage.getItem(dkey(treeId)) ?? "[]"); } catch { return []; } };
const cid = (c: { person: string; tree: string; treePerson: string }) => `${c.person}|${c.tree}|${c.treePerson}`;

export function useConnect(share: ShareInfo | null, family: DFamily, auth: { qs: string; body: Record<string, unknown> }, refresh: () => Promise<void>, discoverable: boolean) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const treeId = share?.treeId;
  const qs = auth.qs;
  // refetch when the set of married women changes, or sharing is switched on/off
  const sig = useMemo(() => womenToMatch(family).map((w) => `${w.id}:${w.name}:${w.birthYear ?? ""}:${w.gotra ?? ""}:${w.husband ?? ""}`).join("|"), [family]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!treeId) { setData(null); return; }
    const n = ++seq.current;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/trees/${treeId}/matches${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as Data;
      if (n === seq.current) setData(j);
    } catch { if (n === seq.current) setError("Could not check for matches right now."); }
    finally { if (n === seq.current) setLoading(false); }
  }, [treeId, qs]);

  useEffect(() => { if (treeId) setDismissed(readDismissed(treeId)); }, [treeId]);
  useEffect(() => {
    if (!treeId) return;
    const t = setTimeout(load, 2500); // after the tree itself has been saved
    return () => clearTimeout(t);
  }, [treeId, sig, discoverable, load]);

  const matches = useMemo(() => (data?.matches ?? []).filter((m) => !dismissed.includes(cid(m))), [data, dismissed]);
  const dismiss = (m: Candidate) => { if (!treeId) return; const next = [...dismissed, cid(m)]; setDismissed(next); try { localStorage.setItem(dkey(treeId), JSON.stringify(next)); } catch { /* ignore */ } };

  const preview = useCallback(async (r: PreviewReq): Promise<{ preview?: Preview; strength?: string; error?: string }> => {
    if (!treeId) return { error: "Save the tree online first." };
    const q = new URLSearchParams({ person: r.person, tree: r.tree, p: r.p });
    if (qs) q.set("k", new URLSearchParams(qs).get("k") ?? "");
    const res = await fetch(`/api/trees/${treeId}/preview?${q}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    return res.ok ? j : { error: j.error ?? "Could not load that tree." };
  }, [treeId, qs]);

  const confirm = useCallback(async (r: PreviewReq) => {
    if (!treeId) return;
    const res = await fetch(`/api/trees/${treeId}/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...auth.body, ...r }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not link.");
    await refresh(); await load();
  }, [treeId, auth.body, refresh, load]);

  const unlink = useCallback(async (person: string, tree: string) => {
    if (!treeId) return;
    const res = await fetch(`/api/trees/${treeId}/links`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...auth.body, person, tree }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not remove the link.");
    await refresh(); await load();
  }, [treeId, auth.body, refresh, load]);

  return { data, matches, loading, error, reload: load, dismiss, preview, confirm, unlink };
}
export type Connect = ReturnType<typeof useConnect>;
