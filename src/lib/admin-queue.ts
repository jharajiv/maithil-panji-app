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
import { FAQ } from "./faq";
import type { AiCall, Store, TreeRow } from "./store";

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
export interface Usage {
  days: number; rows: { name: string; label: string; count: number }[];
  /** which ready-made answers were given, most asked first, and how many typed questions had none (counts only, never the words) */
  questions?: { rows: { id: string; q: string; count: number }[]; unanswered: number };
  /** how many model calls one AI answer needs, and how much of the work the small model does — the two numbers that decide the AI bill */
  ai?: { answers: number; calls: number; light: number; perAnswer: number; lightShare: number };
  /** the real token counts of the AI calls (v12.1 onwards), by day and by model */
  tokens?: Tokens;
  /** trees built in a browser and not (yet) saved: people who reached 3 people, minus trees saved in the same days. Anonymous counts, so no names, only a number. */
  unsaved?: { reached3: number; reached8: number; finished: number; saved: number; waiting: number };
  /** the counts could not be read */ failed?: boolean;
}
export interface TokenRow { key: string; calls: number; input: number; cache_read: number; cache_write: number; output: number; usd: number }
export interface Tokens { days: TokenRow[]; models: TokenRow[]; total: TokenRow; answers: number; usdPerAnswer: number; cachePercent: number }

/** US dollars per million tokens (input, output). Estimates only: the Anthropic console is the truth. Cache writes cost 1.25x and cache reads 0.1x the input price. */
const PRICE: [RegExp, number, number][] = [[/haiku/i, 1, 5], [/opus/i, 5, 25], [/sonnet|./i, 3, 15]];
export const costOf = (model: string, c: Pick<AiCall, "input" | "cache_write" | "cache_read" | "output">) => {
  const [, pin, pout] = PRICE.find(([rx]) => rx.test(model))!;
  return (c.input * pin + c.cache_write * pin * 1.25 + c.cache_read * pin * 0.1 + c.output * pout) / 1e6;
};
const blank = (key: string): TokenRow => ({ key, calls: 0, input: 0, cache_read: 0, cache_write: 0, output: 0, usd: 0 });
const add = (r: TokenRow, c: AiCall) => { r.calls++; r.input += c.input; r.cache_read += c.cache_read; r.cache_write += c.cache_write; r.output += c.output; r.usd += costOf(c.model, c); };
/** adds the calls up by day (newest first) and by model */
export function sumTokens(calls: AiCall[], answers: number): Tokens | undefined {
  if (!calls.length) return undefined;
  const byDay = new Map<string, TokenRow>(), byModel = new Map<string, TokenRow>(), total = blank("total");
  for (const c of calls) {
    const d = c.at.slice(0, 10);
    add(byDay.get(d) ?? byDay.set(d, blank(d)).get(d)!, c); add(byModel.get(c.model) ?? byModel.set(c.model, blank(c.model)).get(c.model)!, c); add(total, c);
  }
  const read = total.cache_read, all = total.input + total.cache_read + total.cache_write;
  return {
    days: [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 14), models: [...byModel.values()].sort((a, b) => b.usd - a.usd), total, answers,
    usdPerAnswer: answers ? total.usd / answers : 0, cachePercent: all ? Math.round((100 * read) / all) : 0,
  };
}
export const USAGE_ROWS: [string, string][] = [
  ["tree_started", "Started a tree (answered the first question)"],
  ["tree_3_people", "Not saved: reached 3 people in a browser"],
  ["tree_8_people", "Not saved: reached 8 people in a browser"],
  ["tree_complete", "Not saved: finished all the questions in a browser"],
  ["save_card_shown", "Saw the “save your tree” reminder"],
  ["save_card_clicked", "Tapped “Save my tree”"],
  ["tree_saved", "Trees saved online"],
  ["pdf_downloaded", "PDFs downloaded"],
  ["share_clicked", "Share buttons used"],
  ["story_added", "Stories and photos added to people"],
  ["story_approved", "Waiting stories approved"],
  ["invite_shared", "Invitation links shared"],
  ["sample_opened", "Opened the sample tree"],
  ["ai_turn", "AI helper answers (each one costs money)"],
  ["ai_call", "Calls to the main AI model (Sonnet)"],
  ["ai_call_light", "Calls to the small AI model (Haiku, a third of the price)"],
  ["ai_save_gate", "AI helper stepped aside: tree not saved yet"],
  ["ai_day_limit", "AI helper stepped aside: a device used its day’s answers"],
  ["community_clicked", "Tapped “Join our WhatsApp community”"],
];
export async function buildUsage(store: Store, days = 30): Promise<Usage> {
  let c: Record<string, number> = {}; let failed = false;
  try { c = await store.countEvents(new Date(Date.now() - days * 86_400_000).toISOString()); } catch { failed = true; /* usage counts are optional */ }
  const asked = FAQ.map((f) => ({ id: f.id, q: f.q.en, count: c[`faq:${f.id}`] ?? 0 })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const answers = c["ai_turn"] ?? 0, calls = (c["ai_call"] ?? 0) + (c["ai_call_light"] ?? 0), light = c["ai_call_light"] ?? 0;
  const ai = answers ? { answers, calls, light, perAnswer: +(calls / answers).toFixed(2), lightShare: calls ? Math.round((100 * light) / calls) : 0 } : undefined;
  let tokens: Tokens | undefined;
  try { tokens = sumTokens(await store.listAiCalls(new Date(Date.now() - days * 86_400_000).toISOString()), answers); } catch { /* the table may not exist yet: the section then says so */ }
  const reached3 = c["tree_3_people"] ?? 0, saved = c["tree_saved"] ?? 0;
  const unsaved = reached3 || c["tree_8_people"] || c["tree_complete"] ? { reached3, reached8: c["tree_8_people"] ?? 0, finished: c["tree_complete"] ?? 0, saved, waiting: Math.max(0, reached3 - saved) } : undefined;
  return { days, failed, ai, tokens, unsaved, rows: USAGE_ROWS.map(([name, label]) => ({ name, label, count: c[name] ?? 0 })), questions: { rows: asked, unanswered: c["faq_unanswered"] ?? 0 } };
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
