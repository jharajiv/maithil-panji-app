import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { around, searchPeople, shortestPath, stats } from "@/lib/graph";
import { graphOf } from "@/lib/graph-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** names, years and places only — no phone numbers, notes or photos */
const lite = (n: import("@/lib/graph").GNode) => ({ id: n.id, tree: n.tree, title: n.title, name: n.name, gender: n.gender, born: n.birthYear, deceased: n.deceased, gotra: n.gotra, mool: n.mool, place: n.place, isMe: n.isMe });

/**
 * Admin only (ADMIN_EMAILS).  GET ?op=stats | search | path | around
 *   search: q, gotra, mool, place, gender, tree, from, to, limit
 *   path:   from=<tree>:<person>&to=<tree>:<person>
 *   around: node=<tree>:<person>&depth=3
 */
export async function GET(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 }); // do not reveal that the page exists
  const url = new URL(req.url), q = url.searchParams;
  const g = await graphOf("all", q.get("fresh") === "1");
  if (!g) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  switch (q.get("op") ?? "stats") {
    case "stats": return NextResponse.json(stats(g));
    case "search": {
      const num = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
      const people = searchPeople(g, { q: q.get("q") ?? "", gotra: q.get("gotra") ?? "", mool: q.get("mool") ?? "", place: q.get("place") ?? "", gender: q.get("gender") ?? "", tree: q.get("tree") ?? "", from: num("from"), to: num("to"), limit: Math.min(100, num("limit") ?? 50) });
      return NextResponse.json({ people: people.map(lite) });
    }
    case "path": {
      const r = shortestPath(g, q.get("from") ?? "", q.get("to") ?? "");
      if (!r) return NextResponse.json({ found: false });
      return NextResponse.json({ ...r, path: r.path.map((s) => ({ ...lite(s.node), via: s.via })) });
    }
    case "around": {
      const depth = Math.min(6, Math.max(1, Number(q.get("depth")) || 3));
      return NextResponse.json({ people: around(g, q.get("node") ?? "", depth).map((x) => ({ ...lite(x.node), steps: x.steps })) });
    }
    default: return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
