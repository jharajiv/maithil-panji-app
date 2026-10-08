"use client";
/** Trees that may be the same family (same gotra + mool, similar people) and the requests to connect with their owners. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Glance, SimilarTree } from "@/lib/similar-server";
import type { ConnectRequest } from "@/lib/store";

export type { Glance, SimilarTree, ConnectRequest };
export interface CombinePreview {
  ok: boolean; reason?: string; used: number;
  pairs: { id: string; mine: string; theirs: string; reasons: string[]; score: number }[];
  added: { name: string; place?: string; years?: string }[]; addedCount: number;
  filled: { person: string; field: string; value: string }[]; filledCount: number;
  conflicts: { person: string; field: string; mine: string; theirs: string }[]; conflictCount: number;
  skippedRelations: number; leftOut: number;
}
export interface CombineView { error?: string; combine?: ConnectRequest["combine"] | null; role?: "giver" | "receiver" | null; canUndo?: boolean; title?: string; preview?: CombinePreview }
interface Data { on: boolean; hasStock: boolean; trees: SimilarTree[] }

export function useSimilar(treeId: string | undefined, qs: string, role: "owner" | "editor" | undefined, discoverable: boolean, sig: string, onTreeChanged?: () => Promise<void> | void) {
  const [data, setData] = useState<Data | null>(null);
  const [requests, setRequests] = useState<ConnectRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const q = qs ? `?${qs}` : "";

  const load = useCallback(async () => {
    if (!treeId) { setData(null); return; }
    const n = ++seq.current;
    setLoading(true); setError("");
    try {
      const [a, b] = await Promise.all([fetch(`/api/trees/${treeId}/similar${q}`, { cache: "no-store" }), fetch(`/api/trees/${treeId}/requests${q}`, { cache: "no-store" })]);
      if (!a.ok) throw new Error(String(a.status));
      const d = (await a.json()) as Data;
      const r = b.ok ? ((await b.json()) as { requests: ConnectRequest[] }).requests : [];
      if (n === seq.current) { setData(d); setRequests(r); }
    } catch { if (n === seq.current) setError("Could not look for similar trees right now."); }
    finally { if (n === seq.current) setLoading(false); }
  }, [treeId, q]);

  useEffect(() => {
    if (!treeId) return;
    const t = setTimeout(load, 3000); // after the tree itself has been saved
    return () => clearTimeout(t);
  }, [treeId, discoverable, sig, load]);

  const glance = useCallback(async (tree: string): Promise<{ glance?: Glance; error?: string }> => {
    if (!treeId) return { error: "Save the tree online first." };
    const p = new URLSearchParams(qs); p.set("tree", tree);
    const res = await fetch(`/api/trees/${treeId}/similar?${p}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    return res.ok ? j : { error: j.error ?? "Could not load that tree." };
  }, [treeId, qs]);

  const send = useCallback(async (to: string, message: string): Promise<{ ok?: boolean; error?: string; needsPhone?: boolean }> => {
    if (!treeId) return { error: "Save the tree online first." };
    const res = await fetch(`/api/trees/${treeId}/requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, message, share: true, ...(qs ? { k: new URLSearchParams(qs).get("k") ?? undefined } : {}) }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) await load();
    return res.ok ? { ok: true } : { error: j.error ?? "Could not send.", needsPhone: !!j.needsPhone };
  }, [treeId, qs, load]);

  const answer = useCallback(async (id: string, action: "accept" | "decline"): Promise<{ ok?: boolean; error?: string; needsPhone?: boolean }> => {
    if (!treeId) return { error: "Save the tree online first." };
    const res = await fetch(`/api/trees/${treeId}/requests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, share: action === "accept", ...(qs ? { k: new URLSearchParams(qs).get("k") ?? undefined } : {}) }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) await load();
    return res.ok ? { ok: true } : { error: j.error ?? "Could not save.", needsPhone: !!j.needsPhone };
  }, [treeId, qs, load]);

  /** combining two connected trees (see /api/trees/[id]/combine) */
  const combineGet = useCallback(async (req: string, exclude?: string[]): Promise<CombineView> => {
    if (!treeId) return { error: "Save the tree online first." };
    const p = new URLSearchParams(qs); p.set("req", req);
    if (exclude) { p.set("preview", "1"); if (exclude.length) p.set("x", exclude.join(",")); }
    const res = await fetch(`/api/trees/${treeId}/combine?${p}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    return res.ok ? j : { error: j.error ?? "Could not load." };
  }, [treeId, qs]);
  const combineDo = useCallback(async (req: string, action: "offer" | "withdraw" | "decline" | "apply" | "undo", extra: Record<string, unknown> = {}): Promise<{ ok?: boolean; error?: string; added?: number; filled?: number; conflicts?: number }> => {
    if (!treeId) return { error: "Save the tree online first." };
    const res = await fetch(`/api/trees/${treeId}/combine`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ req, action, ...extra, ...(qs ? { k: new URLSearchParams(qs).get("k") ?? undefined } : {}) }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { await load(); if (action === "apply" || action === "undo") await onTreeChanged?.(); }
    return res.ok ? j : { error: j.error ?? "Could not save." };
  }, [treeId, qs, load, onTreeChanged]);

  return { data, requests, loading, error, reload: load, glance, send, answer, combineGet, combineDo, canAct: role === "owner" };
}
export type Similar = ReturnType<typeof useSimilar>;
