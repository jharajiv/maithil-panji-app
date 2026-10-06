/**
 * Server-side storage for shared trees. Two interchangeable backends:
 *  - Supabase (PostgREST over fetch, service-role key, server only) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set;
 *  - a JSON file in .data/ for local development (never in production — Vercel's disk is read-only).
 * Without either, sharing is "not configured" and the app keeps working on the device only.
 */
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DFamily } from "./family";
import { flatten, type PersonRow, type RelRow } from "./flatten";

export interface Member { id: string; name: string; role: "owner" | "editor"; token_hash: string; person_id?: string; created_at: string }
export interface TreeRow { id: string; family: DFamily; rev: number; members: Member[]; updated_at: string }
export interface ConsentRow { tree_id: string; member_id: string; kind: string; version: string; given_at: string }
export interface RefRow { kind: "gotra" | "mool"; key: string; roman: string; dev?: string }

export interface Store {
  kind: "supabase" | "file";
  createTree(row: TreeRow): Promise<void>;
  getTree(id: string): Promise<TreeRow | null>;
  /** compare-and-set on rev; returns null when the stored rev differs */
  updateTree(id: string, expectedRev: number, patch: Partial<Pick<TreeRow, "family" | "members">>, bump: boolean): Promise<TreeRow | null>;
  addRefs(refs: RefRow[]): Promise<void>;
  listRefs(): Promise<RefRow[]>;
  /** rebuild the flat people/relations rows of a tree from its family (best effort; the JSON copy is the source of truth) */
  syncPeople(treeId: string, family: DFamily): Promise<void>;
  addConsent(row: ConsentRow): Promise<void>;
  /** removes the tree and its flat rows; returns false when it did not exist */
  deleteTree(id: string): Promise<boolean>;
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(18).toString("base64url");
export const newTreeId = () => randomBytes(9).toString("base64url");
export const newMemberId = () => randomBytes(5).toString("hex");

/* ───────── Supabase (PostgREST) ───────── */
function supabase(url: string, key: string): Store {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const call = async (p: string, init: RequestInit & { prefer?: string } = {}) => {
    const res = await fetch(`${base}/${p}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
  return {
    kind: "supabase",
    async createTree(row) { await call("trees", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" }); },
    async getTree(id) { const rows = (await call(`trees?id=eq.${encodeURIComponent(id)}&select=*`)) as TreeRow[]; return rows[0] ?? null; },
    async updateTree(id, expectedRev, patch, bump) {
      const body = { ...patch, rev: bump ? expectedRev + 1 : expectedRev, updated_at: new Date().toISOString() };
      const rows = (await call(`trees?id=eq.${encodeURIComponent(id)}&rev=eq.${expectedRev}`, { method: "PATCH", body: JSON.stringify(body), prefer: "return=representation" })) as TreeRow[];
      return rows[0] ?? null;
    },
    async addRefs(refs) {
      if (!refs.length) return;
      await call("custom_refs?on_conflict=kind,key", { method: "POST", body: JSON.stringify(refs), prefer: "resolution=ignore-duplicates,return=minimal" });
    },
    async listRefs() { return (await call("custom_refs?select=kind,key,roman,dev&status=neq.rejected&order=seen_at.desc&limit=500")) as RefRow[]; },
    async syncPeople(treeId, family) {
      const { persons, rels } = flatten(treeId, family);
      const t = encodeURIComponent(treeId);
      // upsert (not delete + insert) so two overlapping saves can never collide; then drop people who are gone
      if (persons.length) await call("persons?on_conflict=tree_id,person_id", { method: "POST", body: JSON.stringify(persons), prefer: "resolution=merge-duplicates,return=minimal" });
      const keep = persons.map((p) => `"${p.person_id}"`).join(",");
      await call(`persons?tree_id=eq.${t}${keep ? `&person_id=not.in.(${keep})` : ""}`, { method: "DELETE", prefer: "return=minimal" });
      await call(`relations?tree_id=eq.${t}`, { method: "DELETE", prefer: "return=minimal" });
      if (rels.length) await call("relations?on_conflict=tree_id,type,a,b", { method: "POST", body: JSON.stringify(rels), prefer: "resolution=ignore-duplicates,return=minimal" });
    },
    async addConsent(row) { await call("consents", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" }); },
    async deleteTree(id) {
      const rows = (await call(`trees?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=representation" })) as unknown[] | null;
      return !!rows?.length; // persons / relations go with it (ON DELETE CASCADE)
    },
  };
}

/* ───────── local JSON file (development) ───────── */
function file(): Store {
  const dir = path.join(process.cwd(), ".data");
  const f = path.join(dir, "store.json");
  type Db = { trees: Record<string, TreeRow>; refs: Record<string, RefRow>; persons?: PersonRow[]; rels?: RelRow[]; consents?: ConsentRow[] };
  const read = async (): Promise<Db> => { try { return JSON.parse(await fs.readFile(f, "utf8")) as Db; } catch { return { trees: {}, refs: {} }; } };
  const write = async (db: Db) => { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f, JSON.stringify(db)); };
  let chain: Promise<unknown> = Promise.resolve();
  const lock = <T,>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
  return {
    kind: "file",
    createTree: (row) => lock(async () => { const db = await read(); db.trees[row.id] = row; await write(db); }),
    getTree: (id) => lock(async () => (await read()).trees[id] ?? null),
    updateTree: (id, expectedRev, patch, bump) => lock(async () => {
      const db = await read();
      const cur = db.trees[id];
      if (!cur || cur.rev !== expectedRev) return null;
      const next: TreeRow = { ...cur, ...patch, rev: bump ? cur.rev + 1 : cur.rev, updated_at: new Date().toISOString() };
      db.trees[id] = next; await write(db); return next;
    }),
    addRefs: (refs) => lock(async () => { const db = await read(); for (const r of refs) db.refs[`${r.kind}:${r.key}`] ??= r; await write(db); }),
    listRefs: () => lock(async () => Object.values((await read()).refs)),
    syncPeople: (treeId, family) => lock(async () => {
      const db = await read(); const flat = flatten(treeId, family);
      db.persons = [...(db.persons ?? []).filter((p) => p.tree_id !== treeId), ...flat.persons];
      db.rels = [...(db.rels ?? []).filter((r) => r.tree_id !== treeId), ...flat.rels];
      await write(db);
    }),
    addConsent: (row) => lock(async () => { const db = await read(); (db.consents ??= []).push(row); await write(db); }),
    deleteTree: (id) => lock(async () => {
      const db = await read(); if (!db.trees[id]) return false;
      delete db.trees[id];
      db.persons = (db.persons ?? []).filter((p) => p.tree_id !== id);
      db.rels = (db.rels ?? []).filter((r) => r.tree_id !== id);
      await write(db); return true;
    }),
  };
}

let cached: Store | null | undefined;
export function getStore(): Store | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) cached = supabase(url, key);
  else if (process.env.NODE_ENV !== "production" || process.env.STORE === "file") cached = file();
  else cached = null;
  return cached;
}

/** keep the flat tables + custom refs in step with a saved tree. Awaited (serverless may stop work after the response) but never throws. */
export async function syncAll(store: Store, treeId: string, family: DFamily) {
  await Promise.all([
    store.syncPeople(treeId, family).catch((e) => console.error("syncPeople failed", e instanceof Error ? e.message : e)),
    store.addRefs(customRefs(family)).catch(() => {}),
  ]);
}

export function authorize(row: TreeRow, token: string | null | undefined): Member | null {
  if (!token) return null;
  const h = hashToken(token);
  return row.members.find((m) => m.token_hash === h) ?? null;
}

/** custom (not in the seed) gotras / mools typed by users — collected for the Panji team to review */
export function customRefs(f: DFamily): RefRow[] {
  const out = new Map<string, RefRow>();
  for (const p of f.persons) {
    for (const kind of ["gotra", "mool"] as const) {
      const r = p[kind];
      if (r?.custom && r.roman.trim()) {
        const key = r.roman.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, "-").slice(0, 60);
        if (key) out.set(`${kind}:${key}`, { kind, key, roman: r.roman.trim().slice(0, 60), dev: r.dev?.slice(0, 60) });
      }
    }
  }
  return [...out.values()];
}
