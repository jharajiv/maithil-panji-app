"use client";
/**
 * Cloud copy + collaboration. The tree lives in this browser first; once the owner chooses "Share", a copy is kept on the
 * server and every browser that holds a link (owner or invited helper) edits the same tree. Saves are optimistic: if
 * someone else saved first, the server answers 409 and we three-way merge (see lib/merge.ts) and retry.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DFamily } from "@/lib/family";
import { mergeFamilies } from "@/lib/merge";

const KEY = "maithil-panji.share.v1";
const POLL_MS = 15_000;

/** token = private link (guest mode); in account mode (account: true) the cookie session is the key and token is "" */
export interface ShareInfo { treeId: string; token: string; role: "owner" | "editor"; rev: number; memberName?: string; personId?: string; memberId?: string; account?: boolean; title?: string }
export interface MemberRow { id: string; name: string; role: "owner" | "editor"; person_id?: string; status?: "invited" | "joined"; phone_hint?: string; email_hint?: string }
export type SyncStatus = "off" | "synced" | "saving" | "offline" | "invalid";

const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const read = (): ShareInfo | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const write = (s: ShareInfo | null) => { if (s?.account) return; try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* ignore */ } };

const keyQs = (s: ShareInfo) => (s.token ? `k=${encodeURIComponent(s.token)}` : "");
const keyBody = (s: ShareInfo) => (s.token ? { k: s.token } : {});

/** guest mode: the tree is opened through a private link / saved share. Account mode (opts.treeId): the signed-in account opens its own tree. */
export function useShare(family: DFamily, setFamily: (f: DFamily) => void, ready: boolean, opts: { treeId?: string } = {}) {
  const [enabled, setEnabled] = useState<boolean | undefined>();
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [status, setStatus] = useState<SyncStatus>("off");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [viewKey, setViewKey] = useState("");
  const [viewKeyFull, setViewKeyFull] = useState("");
  const [viewOff, setViewOff] = useState(false);
  const [adopted, setAdopted] = useState(false); // true once a tree was loaded from a link / server (BuildApp resets chat then)
  const base = useRef<DFamily | null>(null);
  const shareRef = useRef<ShareInfo | null>(null); shareRef.current = share;
  const famRef = useRef(family); famRef.current = family;
  const busy = useRef(false);

  const update = (s: ShareInfo | null) => { shareRef.current = s; setShare(s); write(s); };

  useEffect(() => { fetch("/api/trees").then((r) => r.json()).then((j: { enabled: boolean }) => setEnabled(!!j.enabled)).catch(() => setEnabled(false)); }, []);

  /** fetch the server copy; merge with local edits when both changed */
  const pull = useCallback(async (initial = false): Promise<boolean> => {
    const s = shareRef.current; if (!s) return false;
    const res = await fetch(`/api/trees/${s.treeId}?${[keyQs(s), initial ? "" : `rev=${s.rev}`].filter(Boolean).join("&")}`, { cache: "no-store" });
    if (res.status === 404) { setStatus("invalid"); return false; }
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    if (j.members) setMembers(j.members);
    if (typeof j.viewKey === "string") setViewKey(j.viewKey);
    setViewOff(!!j.viewOff);
    setViewKeyFull(typeof j.viewKeyFull === "string" ? j.viewKeyFull : "");
    if (s.role !== j.role || s.personId !== j.member?.person_id || s.memberName !== j.member?.name || s.memberId !== j.member?.id || s.title !== j.title) update({ ...s, role: j.role, personId: j.member?.person_id, memberName: j.member?.name, memberId: j.member?.id, title: j.title });
    if (j.unchanged) return true;
    const remote = j.family as DFamily;
    const local = famRef.current;
    const b = base.current;
    const dirty = !!b && canon(local) !== canon(b);
    const next = dirty && b ? mergeFamilies(b, local, remote) : remote;
    base.current = remote;
    update({ ...(shareRef.current ?? s), rev: j.rev });
    if (canon(next) !== canon(local)) setFamily(next);
    return true;
  }, [setFamily]);

  /** send local edits */
  const push = useCallback(async () => {
    const s = shareRef.current; if (!s || busy.current) return;
    if (s.account && !base.current) return; // the tree has not been loaded yet — never overwrite it with an empty draft
    if (base.current && canon(famRef.current) === canon(base.current)) return;
    busy.current = true; setStatus("saving");
    try {
      for (let i = 0; i < 4; i++) {
        const sent = famRef.current;
        const res = await fetch(`/api/trees/${s.treeId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...keyBody(s), baseRev: shareRef.current!.rev, family: sent }) });
        if (res.status === 404) { setStatus("invalid"); return; }
        if (res.status === 409) {
          const j = await res.json();
          const merged = mergeFamilies(base.current ?? j.family, famRef.current, j.family as DFamily);
          base.current = j.family; update({ ...shareRef.current!, rev: j.rev });
          setFamily(merged); famRef.current = merged;
          continue;
        }
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        base.current = sent; update({ ...shareRef.current!, rev: j.rev });
        if (canon(famRef.current) === canon(sent)) { setStatus("synced"); return; }
      }
      setStatus("synced");
    } catch { setStatus("offline"); } finally { busy.current = false; }
  }, [setFamily]);

  /** open the tree behind an invitation / owner link, or resume a saved share */
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(location.search);
    const t = q.get("t"), k = q.get("k");
    (async () => {
      try {
        if (opts.treeId) {
          update({ treeId: opts.treeId, token: "", role: "editor", rev: 0, account: true });
          base.current = null;
          if (await pull(true)) { setAdopted(true); setStatus("synced"); }
        } else if (t && k) {
          // a private link from before accounts existed: if this browser is signed in, move that access into the account
          try {
            const me = await (await fetch("/api/auth/me", { cache: "no-store" })).json();
            if (me.account) {
              const r = await fetch(`/api/trees/${t}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k }) });
              if (r.ok) { location.replace(`/app/tree/${t}`); return; }
            }
          } catch { /* fall through to guest mode */ }
          history.replaceState(null, "", location.pathname);
          try { const old = localStorage.getItem("maithil-panji.session.v1"); if (old) localStorage.setItem("maithil-panji.session.backup", old); } catch { /* ignore */ }
          update({ treeId: t, token: k, role: "editor", rev: 0 });
          base.current = null;
          if (await pull(true)) { setAdopted(true); setStatus("synced"); }
        } else {
          const s = read();
          if (s) { update(s); base.current = null; if (await pull(true)) setStatus("synced"); }
        }
      } catch { setStatus("offline"); }
    })();
  }, [ready, pull, opts.treeId]);

  /** autosave shortly after each change, and poll for other people's changes */
  useEffect(() => {
    if (!share || status === "invalid") return;
    const t = setTimeout(push, 1200);
    return () => clearTimeout(t);
  }, [family, share, status, push]);
  useEffect(() => {
    if (!share) return;
    const id = setInterval(() => { if (document.visibilityState === "visible" && !busy.current) pull().then(() => setStatus((x) => (x === "offline" ? "synced" : x))).catch(() => setStatus("offline")); }, POLL_MS);
    return () => clearInterval(id);
  }, [share?.treeId, pull]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useCallback(async (ownerName: string) => {
    const res = await fetch("/api/trees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ family: famRef.current, ownerName, consentVersion: "v1" }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not save.");
    base.current = famRef.current;
    update({ treeId: j.id, token: j.token, role: "owner", rev: j.rev, memberName: ownerName });
    setStatus("synced");
    pull(true).catch(() => {});
  }, [pull]);

  /** account mode: invites a phone number (e164) → the link every invitee uses; guest mode: creates a private editor link */
  const invite = useCallback(async (name: string, personId?: string, phone?: string) => {
    const s = shareRef.current!;
    await push();
    const res = await fetch(`/api/trees/${s.treeId}/members`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...keyBody(s), name, personId, phone }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not create the invitation.");
    setMembers(j.members);
    return phone ? `${location.origin}${j.path}` : `${location.origin}/build?t=${s.treeId}&k=${j.token}`;
  }, [push]);

  const revoke = useCallback(async (memberId: string) => {
    const s = shareRef.current!;
    const res = await fetch(`/api/trees/${s.treeId}/members`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...keyBody(s), memberId }) });
    const j = await res.json();
    if (res.ok) setMembers(j.members);
  }, []);

  const deleteOnline = useCallback(async () => {
    const s = shareRef.current!;
    const res = await fetch(`/api/trees/${s.treeId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(keyBody(s)) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not delete.");
    update(null); base.current = null; setStatus("off"); setMembers([]);
  }, []);

  /** account mode, helper: remove myself from this tree */
  const leaveTree = useCallback(async () => {
    const s = shareRef.current!;
    if (!s.memberId) throw new Error("Please try again in a moment.");
    const res = await fetch(`/api/trees/${s.treeId}/members`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: s.memberId }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not leave the tree.");
  }, []);

  /** owner: switch view-only links off, back on, or replace them (the old ones stop working) */
  const viewLink = useCallback(async (action: "stop" | "start" | "renew") => {
    const s = shareRef.current!;
    const res = await fetch(`/api/trees/${s.treeId}/view-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...keyBody(s), action }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not change the link.");
    await pull();
  }, [pull]);

  const ownerLink = share && !share.account ? `${typeof location !== "undefined" ? location.origin : ""}/build?t=${share.treeId}&k=${share.token}` : "";
  const leave = useCallback(() => { update(null); base.current = null; setStatus("off"); setMembers([]); }, []);

  /** the read-only address printed as a QR code on downloads and shared on social media — living relatives protected (empty until the tree is online) */
  const viewUrl = share && viewKey && typeof location !== "undefined" ? `${location.origin}/view/${share.treeId}?v=${viewKey}` : "";
  /** the same, but living relatives show in full — only the owner gets this one, and only by choosing it */
  const viewUrlFull = share && viewKeyFull && typeof location !== "undefined" ? `${location.origin}/view/${share.treeId}?v=${viewKeyFull}` : "";
  return { enabled, share, status, members, adopted, viewUrl, viewUrlFull, viewOff, viewLink, create, invite, revoke, deleteOnline, ownerLink, leave, leaveTree };
}
