import { NextResponse } from "next/server";
import { authEnabled, currentAccount } from "@/lib/auth";
import { isDiscoverable } from "@/lib/connect-server";
import { nid, otherFamilies, seenAs, shortestPath } from "@/lib/graph";
import { graphOf } from "@/lib/graph-cache";
import { getStore } from "@/lib/store";
import { clientIp, limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Your connections to other families — a free benefit for signed-in owners.
 *  - Only trees whose owners switched on "let other families find this tree" take part, and yours must be one of them.
 *  - Paths run only through such trees; living people are shown by first name only.
 * GET [?tree=<id>]            → { trees[], tree, on, people[] }  other families you are connected to, nearest first
 * GET ?tree=<id>&to=<node>    → { path[] }                       how you are connected to one of them
 */
export async function GET(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (limited("connections", clientIp(req), 120, 60 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const q = new URL(req.url).searchParams;

  const mine = (await store.listTreesFor(a.id)).filter((t) => t.members.some((m) => m.account_id === a.id && m.role === "owner" && m.status !== "invited"));
  const trees = mine.map((t) => ({ id: t.id, title: t.title ?? "Family tree" }));
  const pick = trees.find((t) => t.id === q.get("tree")) ?? trees[0];
  if (!pick) return NextResponse.json({ trees, tree: null, on: false, people: [] });

  const row = await store.getTree(pick.id);
  if (!row || !isDiscoverable(row)) return NextResponse.json({ trees, tree: pick, on: false, people: [] });
  const root = row.family.persons.find((p) => p.is_me);
  const g = await graphOf("open", q.get("fresh") === "1");
  if (!root || !g) return NextResponse.json({ trees, tree: pick, on: true, people: [] });
  const me = nid(row.id, root.id);

  const to = q.get("to");
  if (to) {
    const r = shortestPath(g, me, to);
    if (!r || g.nodes.get(to)?.tree === row.id) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, steps: r.steps, degree: r.degree, path: r.path.map((s, i) => ({ ...(i === 0 ? { ...seenAs(s.node), name: "You" } : seenAs(s.node)), via: s.via })) });
  }
  return NextResponse.json({ trees, tree: pick, on: true, people: g.nodes.has(me) ? otherFamilies(g, me) : [] });
}
