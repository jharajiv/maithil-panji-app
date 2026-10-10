/**
 * Server-side storage for shared trees. Two interchangeable backends:
 *  - Supabase (PostgREST over fetch, service-role key, server only) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set;
 *  - a JSON file in .data/ for local development (never in production — Vercel's disk is read-only).
 * Without either, sharing is "not configured" and the app keeps working on the device only.
 */
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fold } from "./lookup";
import type { DFamily } from "./family";
import type { CombineDelta } from "./combine";
import type { Profile } from "./profile";
import { flatten, type PersonRow, type RelRow } from "./flatten";

/**
 * A person with access to a tree. Legacy members hold a private-link token (token_hash). Account members are tied to an
 * email-verified account; invited people hold an invitation (invite_hash = hash of the secret in their WhatsApp link) until they join.
 */
export interface Member {
  id: string; name: string; role: "owner" | "editor"; token_hash?: string; person_id?: string; created_at: string;
  /** E.164 number the owner invited (unverified contact detail) */
  phone?: string; email?: string; account_id?: string; status?: "invited" | "joined"; invite_hash?: string;
  /** owner only: view-only links were replaced this many times / are switched off */
  view_epoch?: number; view_off?: boolean;
  /** owner only: other families may find this tree when matching married women (off until the owner turns it on) */
  discoverable?: boolean;
  /** owner only: short notes about changes others made (a link confirmed, a correction applied) — newest last, at most 30 */
  activity?: { at: string; by: string; text: string }[];
  /** owner only: requests to connect with the owner of a similar tree (sent "out" or received "in"), at most 40 */
  requests?: ConnectRequest[];
  /** owner only: the last combine of two trees, kept so it can be undone */
  combine_undo?: { at: string; req: string; title: string; delta: CombineDelta };
}
/** what the other owner is shown about a person: community facts always, contact details because they agreed to share them with this one request */
export interface OwnerCard { name: string; pravar?: string; native_place?: string; current_city?: string; marital_status?: string; occupation?: string; about?: string; phone?: string; email?: string; address?: string }
export interface ConnectRequest {
  id: string; dir: "in" | "out"; tree: string; title: string; percent: number; message?: string; at: string;
  status: "pending" | "accepted" | "declined";
  /** the other owner: on an incoming request, the person who asked; on an outgoing one, filled in once they accept */
  who?: OwnerCard;
  /** once connected, one owner may offer their whole tree to be combined into the other's (the same note sits on both sides) */
  combine?: { from: string; status: "offered" | "applied"; at: string };
}
export interface Suggestion { id: string; tree_id: string; person_id: string; field: string; value: string; note?: string; from_name?: string; created_at: string; status: "new" | "applied" | "dismissed" }
export interface TreeRow { id: string; family: DFamily; rev: number; members: Member[]; updated_at: string; title?: string; people_count?: number }
export type TreeSummary = Pick<TreeRow, "id" | "members" | "updated_at" | "title" | "people_count">;
export interface AccountRow { id: string; email: string; phone?: string; name: string; created_at: string; consent_version?: string; profile?: Profile }
/** a pending one-time sign-in code (only its hash is kept) */
export interface LoginCode { email: string; code_hash: string; expires_at: string; attempts: number }
export interface SessionRow { token_hash: string; account_id: string; expires_at: string; created_at: string }
export interface ConsentRow { tree_id: string; member_id: string; kind: string; version: string; given_at: string }
/** a newsletter subscriber: "pending" until the link in the confirmation email is opened */
export interface Subscriber { email: string; status: "pending" | "confirmed" | "unsubscribed"; lang: "en" | "hi"; source: string; created_at: string; last_sent_at?: string; confirmed_at?: string; unsubscribed_at?: string }
export interface RefRow { kind: "gotra" | "mool"; key: string; roman: string; dev?: string }

export interface Store {
  kind: "supabase" | "file";
  createTree(row: TreeRow): Promise<void>;
  getTree(id: string): Promise<TreeRow | null>;
  /** compare-and-set on rev; returns null when the stored rev differs */
  updateTree(id: string, expectedRev: number, patch: Partial<Pick<TreeRow, "family" | "members" | "title" | "people_count">>, bump: boolean): Promise<TreeRow | null>;
  /* accounts (email-verified) and their cookie sessions */
  getAccount(id: string): Promise<AccountRow | null>;
  getAccountByEmail(email: string): Promise<AccountRow | null>;
  putLoginCode(row: LoginCode): Promise<void>;
  getLoginCode(email: string): Promise<LoginCode | null>;
  setLoginAttempts(email: string, attempts: number): Promise<void>;
  deleteLoginCode(email: string): Promise<void>;
  createAccount(row: AccountRow): Promise<void>;
  /** change the name, mobile or profile of an account (a field set to null is removed) */
  updateAccount(id: string, patch: { name?: string; phone?: string | null; profile?: Profile }): Promise<AccountRow | null>;
  /** removes the account and its sessions; trees it owns are NOT touched here */
  deleteAccount(id: string): Promise<void>;
  createSession(row: SessionRow): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRow | null>;
  deleteSession(tokenHash: string): Promise<void>;
  /** trees this account has joined */
  listTreesFor(accountId: string): Promise<TreeSummary[]>;
  addRefs(refs: RefRow[]): Promise<void>;
  listRefs(): Promise<RefRow[]>;
  /** rebuild the flat people/relations rows of a tree from its family (best effort; the JSON copy is the source of truth) */
  syncPeople(treeId: string, family: DFamily): Promise<void>;
  addConsent(row: ConsentRow): Promise<void>;
  /** removes the tree and its flat rows; returns false when it did not exist */
  deleteTree(id: string): Promise<boolean>;
  /** women whose name starts with any of these letters (1–3 each), in any tree — used to find the same woman in another family's tree */
  findWomen(prefixes: string[], limit?: number): Promise<{ tree_id: string; person_id: string }[]>;
  /** ids of other trees whose root person has this gotra AND mool (the first filter for "may be the same family") */
  findTreesBySameStock(gotra: { id?: string; roman: string }, mool: { id?: string; roman: string }, limit?: number): Promise<string[]>;
  /** every tree, newest first — admin tools only */
  listAllTrees(limit?: number): Promise<TreeRow[]>;
  /* corrections suggested by people viewing a tree */
  addSuggestion(row: Suggestion): Promise<void>;
  listSuggestions(treeId: string): Promise<Suggestion[]>;
  resolveSuggestion(treeId: string, id: string, status: "applied" | "dismissed"): Promise<boolean>;
  /** one anonymous usage count (a name and a time — nothing about the person) */
  addEvent(name: string): Promise<void>;
  /* newsletter */
  getSubscriber(email: string): Promise<Subscriber | null>;
  /** create or replace the subscriber with this email */
  putSubscriber(row: Subscriber): Promise<void>;
  listSubscribers(): Promise<Subscriber[]>;
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(18).toString("base64url");
export const newTreeId = () => randomBytes(9).toString("base64url");
export const newAccountId = () => randomBytes(9).toString("base64url");
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
    async getAccount(id) { return ((await call(`accounts?id=eq.${encodeURIComponent(id)}&select=*`)) as AccountRow[])[0] ?? null; },
    async getAccountByEmail(email) { return ((await call(`accounts?email=eq.${encodeURIComponent(email)}&select=*`)) as AccountRow[])[0] ?? null; },
    async putLoginCode(row) { await call("login_codes?on_conflict=email", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" }); },
    async getLoginCode(email) { return ((await call(`login_codes?email=eq.${encodeURIComponent(email)}&select=*`)) as LoginCode[])[0] ?? null; },
    async setLoginAttempts(email, attempts) { await call(`login_codes?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify({ attempts }), prefer: "return=minimal" }); },
    async deleteLoginCode(email) { await call(`login_codes?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", prefer: "return=minimal" }); },
    async createAccount(row) { await call("accounts", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" }); },
    async updateAccount(id, patch) {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.phone !== undefined) body.phone = patch.phone;
      if (patch.profile !== undefined) body.profile = patch.profile;
      if (!Object.keys(body).length) return ((await call(`accounts?id=eq.${encodeURIComponent(id)}&select=*`)) as AccountRow[])[0] ?? null;
      const rows = (await call(`accounts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body), prefer: "return=representation" })) as AccountRow[];
      return rows[0] ?? null;
    },
    async deleteAccount(id) {
      await call(`sessions?account_id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
      await call(`accounts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
    },
    async createSession(row) { await call("sessions", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" }); },
    async getSession(h) { return ((await call(`sessions?token_hash=eq.${encodeURIComponent(h)}&select=*`)) as SessionRow[])[0] ?? null; },
    async deleteSession(h) { await call(`sessions?token_hash=eq.${encodeURIComponent(h)}`, { method: "DELETE", prefer: "return=minimal" }); },
    async listTreesFor(accountId) {
      return (await call(`trees?select=id,title,people_count,members,updated_at&members=cs.${encodeURIComponent(JSON.stringify([{ account_id: accountId }]))}&order=updated_at.desc&limit=100`)) as TreeSummary[];
    },
    async addRefs(refs) {
      if (!refs.length) return;
      await call("custom_refs?on_conflict=kind,key", { method: "POST", body: JSON.stringify(refs), prefer: "resolution=ignore-duplicates,return=minimal" });
    },
    async listRefs() { return (await call("custom_refs?select=kind,key,roman,dev&status=neq.rejected&order=seen_at.desc&limit=500")) as RefRow[]; },
    async findWomen(prefixes, limit = 600) {
      const ps = [...new Set(prefixes.map((x) => x.replace(/[^A-Za-z]/g, "").slice(0, 3)).filter(Boolean))].slice(0, 8);
      if (!ps.length) return [];
      const or = ps.map((x) => `name_roman.ilike.${x}*`).join(",");
      return (await call(`persons?gender=eq.female&or=(${encodeURIComponent(or)})&select=tree_id,person_id&limit=${limit}`)) as { tree_id: string; person_id: string }[];
    },
    async findTreesBySameStock(gotra, mool, limit = 200) {
      const pat = (x: string) => encodeURIComponent(x.trim().replace(/[^A-Za-z0-9 ]+/g, "*"));
      const rows = (await call(`persons?is_me=eq.true&gotra=ilike.${pat(gotra.roman)}&mool=ilike.${pat(mool.roman)}&select=tree_id&limit=${limit}`)) as { tree_id: string }[];
      return [...new Set(rows.map((r) => r.tree_id))];
    },
    async listAllTrees(limit = 5000) { return (await call(`trees?select=*&order=updated_at.desc&limit=${limit}`)) as TreeRow[]; },
    async addSuggestion(row) { await call("suggestions", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" }); },
    async listSuggestions(treeId) { return (await call(`suggestions?tree_id=eq.${encodeURIComponent(treeId)}&status=eq.new&order=created_at.desc&limit=100&select=*`)) as Suggestion[]; },
    async resolveSuggestion(treeId, id, status) {
      const rows = (await call(`suggestions?tree_id=eq.${encodeURIComponent(treeId)}&id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }), prefer: "return=representation" })) as unknown[] | null;
      return !!rows?.length;
    },
    async addEvent(name) { await call("events", { method: "POST", body: JSON.stringify({ name }), prefer: "return=minimal" }); },
    async getSubscriber(email) { return ((await call(`newsletter?email=eq.${encodeURIComponent(email)}&select=*&limit=1`)) as Subscriber[])[0] ?? null; },
    async putSubscriber(row) { await call("newsletter?on_conflict=email", { method: "POST", body: JSON.stringify(row), prefer: "resolution=merge-duplicates,return=minimal" }); },
    async listSubscribers() { return (await call("newsletter?select=*&order=created_at.desc&limit=20000")) as Subscriber[]; },
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
  const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), ".data"); // DATA_DIR: keep the dev file outside the project so editing/testing never makes the dev server recompile
  const f = path.join(dir, "store.json");
  type Db = { suggestions?: Suggestion[]; events?: { name: string; at: string }[]; subscribers?: Subscriber[]; trees: Record<string, TreeRow>; refs: Record<string, RefRow>; persons?: PersonRow[]; rels?: RelRow[]; consents?: ConsentRow[]; accounts?: AccountRow[]; sessions?: SessionRow[]; codes?: LoginCode[] };
  const read = async (): Promise<Db> => { try { return JSON.parse(await fs.readFile(f, "utf8")) as Db; } catch { return { trees: {}, refs: {} }; } };
  const write = async (db: Db) => { await fs.mkdir(dir, { recursive: true }); const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`; await fs.writeFile(tmp, JSON.stringify(db)); await fs.rename(tmp, f); }; // atomic: a reader never sees half a file
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
    getAccount: (id) => lock(async () => (await read()).accounts?.find((a) => a.id === id) ?? null),
    getAccountByEmail: (email) => lock(async () => (await read()).accounts?.find((a) => a.email === email) ?? null),
    putLoginCode: (row) => lock(async () => { const db = await read(); db.codes = [...(db.codes ?? []).filter((c) => c.email !== row.email), row]; await write(db); }),
    getLoginCode: (email) => lock(async () => (await read()).codes?.find((c) => c.email === email) ?? null),
    setLoginAttempts: (email, attempts) => lock(async () => { const db = await read(); for (const c of db.codes ?? []) if (c.email === email) c.attempts = attempts; await write(db); }),
    deleteLoginCode: (email) => lock(async () => { const db = await read(); db.codes = (db.codes ?? []).filter((c) => c.email !== email); await write(db); }),
    createAccount: (row) => lock(async () => { const db = await read(); (db.accounts ??= []).push(row); await write(db); }),
    updateAccount: (id, patch) => lock(async () => {
      const db = await read(); const a = db.accounts?.find((x) => x.id === id); if (!a) return null;
      if (patch.name !== undefined) a.name = patch.name;
      if (patch.phone !== undefined) { if (patch.phone === null) delete a.phone; else a.phone = patch.phone; }
      if (patch.profile !== undefined) a.profile = patch.profile;
      await write(db); return a;
    }),
    deleteAccount: (id) => lock(async () => { const db = await read(); db.accounts = (db.accounts ?? []).filter((a) => a.id !== id); db.sessions = (db.sessions ?? []).filter((x) => x.account_id !== id); await write(db); }),
    createSession: (row) => lock(async () => { const db = await read(); (db.sessions ??= []).push(row); await write(db); }),
    getSession: (h) => lock(async () => (await read()).sessions?.find((x) => x.token_hash === h) ?? null),
    deleteSession: (h) => lock(async () => { const db = await read(); db.sessions = (db.sessions ?? []).filter((x) => x.token_hash !== h); await write(db); }),
    listTreesFor: (accountId) => lock(async () => dedupeTrees(Object.values((await read()).trees)
      .filter((t) => t.members.some((m) => m.account_id === accountId))
      .map(({ id, title, people_count, members, updated_at }) => ({ id, title, people_count, members, updated_at })))),
    addRefs: (refs) => lock(async () => { const db = await read(); for (const r of refs) db.refs[`${r.kind}:${r.key}`] ??= r; await write(db); }),
    listRefs: () => lock(async () => Object.values((await read()).refs)),
    findWomen: (prefixes, limit = 600) => lock(async () => {
      const ps = [...new Set(prefixes.map((x) => x.replace(/[^A-Za-z]/g, "").slice(0, 3).toLowerCase()).filter(Boolean))];
      if (!ps.length) return [];
      const out: { tree_id: string; person_id: string }[] = [];
      for (const t of Object.values((await read()).trees)) for (const x of t.family.persons) if (x.gender === "female" && ps.some((q) => x.name_roman.toLowerCase().startsWith(q))) out.push({ tree_id: t.id, person_id: x.id });
      return out.slice(0, limit);
    }),
    findTreesBySameStock: (gotra, mool, limit = 200) => lock(async () => {
      const same = (r: { id?: string; roman?: string } | undefined, w: { id?: string; roman: string }) => !!r && (r.id && w.id ? r.id === w.id : fold(r.roman ?? "") === fold(w.roman) && !!fold(w.roman));
      return Object.values((await read()).trees).filter((t) => { const me = t.family.persons.find((x) => x.is_me); return same(me?.gotra, gotra) && same(me?.mool, mool); }).map((t) => t.id).slice(0, limit);
    }),
    listAllTrees: (limit = 5000) => lock(async () => Object.values((await read()).trees).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)),
    addSuggestion: (row) => lock(async () => { const db = await read(); db.suggestions = [...(db.suggestions ?? []), row]; await write(db); }),
    listSuggestions: (treeId) => lock(async () => ((await read()).suggestions ?? []).filter((x) => x.tree_id === treeId && x.status === "new").sort((a, b) => b.created_at.localeCompare(a.created_at))),
    resolveSuggestion: (treeId, id, status) => lock(async () => { const db = await read(); const s = db.suggestions?.find((x) => x.tree_id === treeId && x.id === id); if (!s) return false; s.status = status; await write(db); return true; }),
    addEvent: (name) => lock(async () => { const db = await read(); db.events = [...(db.events ?? []).slice(-4999), { name, at: new Date().toISOString() }]; await write(db); }),
    getSubscriber: (email) => lock(async () => (await read()).subscribers?.find((x) => x.email === email) ?? null),
    putSubscriber: (row) => lock(async () => { const db = await read(); db.subscribers = [...(db.subscribers ?? []).filter((x) => x.email !== row.email), row]; await write(db); }),
    listSubscribers: () => lock(async () => [...((await read()).subscribers ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))),
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
      db.suggestions = (db.suggestions ?? []).filter((x) => x.tree_id !== id);
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

const dedupeTrees = (rows: TreeSummary[]) => [...new Map(rows.map((r) => [r.id, r])).values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

/** the member a private-link token belongs to (legacy links) */
export function authorize(row: TreeRow, token: string | null | undefined): Member | null {
  if (!token) return null;
  const h = hashToken(token);
  return row.members.find((m) => m.token_hash === h) ?? null;
}

/** dashboard / header facts kept next to the tree so lists don't need to load whole families */
export function treeMeta(f: DFamily): { title: string; people_count: number } {
  const first = f.persons.find((p) => p.is_me)?.name_roman.split(" ")[0]?.trim();
  return { title: first ? `${first}’s family` : "Family tree", people_count: f.persons.length };
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
