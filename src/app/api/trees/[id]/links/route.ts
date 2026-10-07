import { NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { checkPair, load, mutateTree, noteTo, withLink } from "@/lib/connect-server";

export const dynamic = "force-dynamic";

const nameOf = (row: { family: { persons: { id: string; name_roman: string }[] } }, id: string) => row.family.persons.find((p) => p.id === id)?.name_roman ?? "a woman";

/**
 * POST { k?, person, tree, p } — an owner or helper confirms that <person> here is the same woman as <p> in <tree>.
 * The link is written on both women. Helpers' links are noted for the owner; the other tree's owner gets a short note too.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-link", 60);
  if (l instanceof NextResponse) return l;
  const [person, tree, p] = [body.person, body.tree, body.p];
  if (typeof person !== "string" || typeof tree !== "string" || typeof p !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const pair = await checkPair(l.store, l.row, person, tree, p);
  if (!pair) return NextResponse.json({ error: "This match is not available any more." }, { status: 404 });
  if (l.row.family.persons.find((x) => x.id === person)?.links?.some((x) => x.tree === tree && x.person === p)) return NextResponse.json({ ok: true, already: true });
  const at = new Date().toISOString();
  const by = l.me.name;

  // her entry in the other tree first (the owner of that tree learns that someone linked it), then ours
  const myTitle = l.row.title ?? "Family tree";
  const other = await mutateTree(l.store, tree, (r) => ({
    family: withLink(r.family, p, { tree: id, person, title: myTitle, at }),
    members: noteTo(r.members, `Another family tree linked "${nameOf(r, p)}" in this tree with the same woman in theirs.`, "Connector"),
  }));
  if (!other) return NextResponse.json({ error: "The other tree is busy. Please try again." }, { status: 409 });
  const mine = await mutateTree(l.store, id, (r) => ({
    family: withLink(r.family, person, { tree, person: p, title: other.title ?? "Family tree", at, by }),
    ...(l.me.role === "editor" ? { members: noteTo(r.members, `${by} linked "${nameOf(r, person)}" with the same woman in "${other.title ?? "another tree"}".`, by) } : {}),
  }));
  if (!mine) {
    await mutateTree(l.store, tree, (r) => ({ family: withLink(r.family, p, null, id) })); // undo the other side
    return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
  }
  logEvent("woman_linked");
  return NextResponse.json({ ok: true });
}

/** DELETE { k?, person, tree } — remove a link (both sides) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-link", 60);
  if (l instanceof NextResponse) return l;
  const [person, tree] = [body.person, body.tree];
  if (typeof person !== "string" || typeof tree !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const link = l.row.family.persons.find((x) => x.id === person)?.links?.find((x) => x.tree === tree);
  if (!link) return NextResponse.json({ ok: true });
  const by = l.me.name;
  await mutateTree(l.store, tree, (r) => ({ family: withLink(r.family, link.person, null, id) }));
  const mine = await mutateTree(l.store, id, (r) => ({
    family: withLink(r.family, person, null, tree),
    ...(l.me.role === "editor" ? { members: noteTo(r.members, `${by} removed the link for "${nameOf(r, person)}".`, by) } : {}),
  }));
  if (!mine) return NextResponse.json({ error: "The tree changed at the same moment. Please try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
