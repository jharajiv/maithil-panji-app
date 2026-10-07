import { NextResponse } from "next/server";
import { applyOps } from "@/lib/family";
import { load, mutateTree } from "@/lib/connect-server";
import { changeFor } from "@/lib/suggest";

export const dynamic = "force-dynamic";

/** GET [?k=] → the corrections people have suggested (owner and helpers) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await load(req, id, new URL(req.url).searchParams.get("k"), "tree-suggestions", 240);
  if (l instanceof NextResponse) return l;
  const list = await l.store.listSuggestions(id);
  return NextResponse.json({ suggestions: list.map((s) => ({ ...s, canApply: !!changeFor(s) && l.row.family.persons.some((p) => p.id === s.person_id) })) });
}

/** POST { k?, id, action: "apply" | "done" | "dismiss" } — apply changes the tree (name, dates, place only); "done" means it was fixed by hand */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-suggestions-act", 120);
  if (l instanceof NextResponse) return l;
  const sid = typeof body.id === "string" ? body.id : "";
  const s = (await l.store.listSuggestions(id)).find((x) => x.id === sid);
  if (!s) return NextResponse.json({ ok: true, gone: true });
  if (body.action === "apply") {
    const change = changeFor(s);
    if (!change) return NextResponse.json({ error: "This one has to be changed by hand: tap the person in the tree." }, { status: 400 });
    const saved = await mutateTree(l.store, id, (r) => (r.family.persons.some((p) => p.id === s.person_id) ? { family: applyOps(r.family, [{ op: "update_person", id: s.person_id, set: change }]).family } : null));
    if (!saved) return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
    await l.store.resolveSuggestion(id, sid, "applied");
    return NextResponse.json({ ok: true });
  }
  if (body.action === "done") { await l.store.resolveSuggestion(id, sid, "applied"); return NextResponse.json({ ok: true }); }
  if (body.action === "dismiss") { await l.store.resolveSuggestion(id, sid, "dismissed"); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
