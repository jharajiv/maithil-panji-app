/**
 * What the admin can ACT on (not just look at):
 *  1. trees that may be the same family entered twice — only trees whose owner agreed to be found (the same promise the privacy page makes);
 *  2. gotra / mool spellings that people typed because they were not in the Panji list, with the number of trees using each.
 * Nothing here changes any data: the admin reads the list, talks to the owners, and decides.
 */
import { ownerOf, isDiscoverable } from "./connect-server";
import { fold } from "./lookup";
import { compareTrees, stockOf, type TreeMatch } from "./similar";
import { refCodeOf } from "./invite";
import type { Store, TreeRow } from "./store";

export interface QOwner { name: string; email?: string; phone?: string }
export interface QSide { tree: string; title: string; people: number; updated: string; owner?: QOwner }
export interface DupPair {
  a: QSide; b: QSide; gotra: string; mool: string;
  percent: number; strength: TreeMatch["strength"]; matched: number;
  /** both trees belong to the same sign-in: most likely one person who started twice */
  sameOwner: boolean;
  pairs: { mine: string; theirs: string }[];
}
export interface NewRef { kind: "gotra" | "mool"; roman: string; dev?: string; trees: number }
/** how many trees came through someone's invitation link (the site is open: this only counts, nothing is blocked) */
export interface Invites { total: number; byInvite: number; inviters: number; top: { name: string; count: number }[] }
/** anonymous usage counts for the last 30 days, in the order people move through the site */
export interface Usage { days: number; rows: { name: string; label: string; count: number }[]; /** the counts could not be read */ failed?: boolean }
export const USAGE_ROWS: [string, string][] = [
  ["tree_started", "Started a tree (answered the first question)"],
  ["save_card_shown", "Saw the “save your tree” reminder"],
  ["save_card_clicked", "Tapped “Save my tree”"],
  ["tree_saved", "Trees saved online"],
  ["pdf_downloaded", "PDFs downloaded"],
  ["share_clicked", "Share buttons used"],
  ["invite_shared", "Invitation links shared"],
  ["sample_opened", "Opened the sample tree"],
];
export async function buildUsage(store: Store, days = 30): Promise<Usage> {
  let c: Record<string, number> = {}; let failed = false;
  try { c = await store.countEvents(new Date(Date.now() - days * 86_400_000).toISOString()); } catch { failed = true; /* usage counts are optional */ }
  return { days, failed, rows: USAGE_ROWS.map(([name, label]) => ({ name, label, count: c[name] ?? 0 })) };
}

export interface Queue { duplicates: DupPair[]; newRefs: NewRef[]; scanned: number; optedIn: number; invites: Invites; usage?: Usage }

const MAX_GROUP = 120;
const MAX_PAIRS = 30;
const peopleOf = (t: TreeRow) => t.people_count ?? t.family.persons.filter((p) => !p.placeholder).length;

export async function buildInvites(trees: TreeRow[]): Promise<Invites> {
  const owners = trees.map((t) => ({ t, o: ownerOf(t) }));
  const codes = new Map<string, string>(); // invite code → the inviter's name
  for (const { t, o } of owners) codes.set(await refCodeOf(t.id), o?.name ?? t.title ?? "A family");
  const count = new Map<string, number>();
  let byInvite = 0;
  for (const { o } of owners) { const by = o?.invited_by; if (by) { byInvite++; count.set(by, (count.get(by) ?? 0) + 1); } }
  const top = [...count.entries()].map(([code, n]) => ({ name: codes.get(code) ?? "Someone who has since deleted their tree", count: n })).sort((a, b) => b.count - a.count).slice(0, 10);
  return { total: trees.length, byInvite, inviters: count.size, top };
}

export async function buildQueue(store: Store, rows?: TreeRow[]): Promise<Queue> {
  const trees = rows ?? (await store.listAllTrees(5000));
  const accounts = new Map<string, QOwner | null>();
  const ownerInfo = async (t: TreeRow): Promise<{ owner?: QOwner; acct?: string }> => {
    const m = ownerOf(t);
    if (!m) return {};
    if (!m.account_id) return { owner: { name: m.name } };
    if (!accounts.has(m.account_id)) {
      const a = await store.getAccount(m.account_id).catch(() => null);
      accounts.set(m.account_id, a ? { name: a.name, email: a.email, phone: a.phone } : null);
    }
    return { owner: accounts.get(m.account_id) ?? { name: m.name }, acct: m.account_id };
  };

  /* 1. possible duplicates — same gotra AND mool, both owners agreed to be found */
  const open = trees.filter(isDiscoverable);
  const groups = new Map<string, TreeRow[]>();
  for (const t of open) {
    const s = stockOf(t.family);
    if (!s.gotra?.roman || !s.mool?.roman) continue;
    const key = `${s.gotra.id ?? fold(s.gotra.roman)}|${s.mool.id ?? fold(s.mool.roman)}`;
    const g = groups.get(key) ?? [];
    if (g.length < MAX_GROUP) g.push(t);
    groups.set(key, g);
  }
  const found: { a: TreeRow; b: TreeRow; m: TreeMatch }[] = [];
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const m = compareTrees(g[i]!.family, g[j]!.family);
      if (m) found.push({ a: g[i]!, b: g[j]!, m });
    }
  }
  found.sort((x, y) => y.m.percent - x.m.percent);
  const duplicates: DupPair[] = [];
  for (const f of found.slice(0, MAX_PAIRS)) {
    const [oa, ob] = [await ownerInfo(f.a), await ownerInfo(f.b)];
    const s = stockOf(f.a.family);
    const side = (t: TreeRow, o: { owner?: QOwner }): QSide => ({ tree: t.id, title: t.title ?? "Family tree", people: peopleOf(t), updated: t.updated_at, owner: o.owner });
    duplicates.push({
      a: side(f.a, oa), b: side(f.b, ob), gotra: s.gotra!.roman, mool: s.mool!.roman,
      percent: f.m.percent, strength: f.m.strength, matched: f.m.matched,
      sameOwner: !!oa.acct && oa.acct === ob.acct,
      pairs: f.m.pairs.slice(0, 3).map((p) => ({ mine: p.mine, theirs: p.theirs })),
    });
  }

  /* 2. spellings people typed because they were not in the Panji list (counted per tree, no names of people) */
  const seen = new Map<string, NewRef & { set: Set<string> }>();
  for (const t of trees) {
    for (const p of t.family.persons) {
      for (const kind of ["gotra", "mool"] as const) {
        const r = p[kind];
        if (!r?.custom || !r.roman) continue;
        const k = `${kind}:${fold(r.roman)}`;
        const cur = seen.get(k) ?? { kind, roman: r.roman, dev: r.dev, trees: 0, set: new Set<string>() };
        if (!cur.dev && r.dev) cur.dev = r.dev;
        cur.set.add(t.id); cur.trees = cur.set.size;
        seen.set(k, cur);
      }
    }
  }
  const newRefs = [...seen.values()].map(({ set, ...r }) => { void set; return r; }).sort((a, b) => b.trees - a.trees || a.roman.localeCompare(b.roman)).slice(0, 60);

  return { duplicates, newRefs, scanned: trees.length, optedIn: open.length, invites: await buildInvites(trees), usage: await buildUsage(store) };
}
