import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { load, mutateTree, noteTo } from "@/lib/connect-server";
import { clientIp, limited } from "@/lib/ratelimit";
import { logEvent } from "@/lib/events";
import { canApprove, canRemove, canSee, cleanStory, MAX_PHOTOS_PER_PERSON, MAX_STORIES_PER_PERSON, MAX_STORIES_PER_TREE, startStatus, storyView, type Story } from "@/lib/stories";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * GET [?k=]                → what is waiting for you: stories you must approve, and (owner) stories people flagged
 * GET [?k=][&count=1]      → just the two numbers { waiting, flagged } (for the badge)
 * GET [?k=]&person=<id>    → the stories you may see for one person
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(req.url);
  const l = await load(req, id, url.searchParams.get("k"), "tree-stories", 400);
  if (l instanceof NextResponse) return l;
  const { store, row, me } = l;
  const person = url.searchParams.get("person");
  if (person) {
    const all = await store.listStories(id, { person });
    return NextResponse.json({ stories: all.filter((s) => canSee(row, me, s)).map((s) => storyView(row, me, s)) });
  }
  const count = url.searchParams.get("count") === "1";
  const all = await store.listStories(id, { light: count });
  const alive = new Set(row.family.persons.map((p) => p.id));
  const waiting = all.filter((s) => alive.has(s.person_id) && canApprove(row, me, s));
  const flagged = me.role === "owner" ? all.filter((s) => alive.has(s.person_id) && s.status === "shown" && s.flags.length > 0) : [];
  if (count) return NextResponse.json({ waiting: waiting.length, flagged: flagged.length });
  return NextResponse.json({ waiting: waiting.length, flagged: flagged.length, inbox: [...waiting, ...flagged].slice(0, 30).map((s) => storyView(row, me, s)) });
}

/** POST { k?, action: "add", person, text?, photo? } | { k?, action: "approve" | "reject" | "remove" | "flag" | "unflag", id } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const text = await req.text();
  if (text.length > 120_000) return NextResponse.json({ error: "That is too large." }, { status: 413 });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const l = await load(req, id, typeof body.k === "string" ? body.k : null, "tree-stories-act", 240);
  if (l instanceof NextResponse) return l;
  const { store, row, me } = l;
  const action = body.action;

  if (action === "add") {
    if (limited("story-add", clientIp(req), 30, 60 * 60_000)) return NextResponse.json({ error: "Too many stories in a short time. Please try again a little later." }, { status: 429 });
    const c = cleanStory(body);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    const person = row.family.persons.find((p) => p.id === c.person && !p.placeholder);
    if (!person) return NextResponse.json({ error: "That person is not in this tree." }, { status: 404 });
    const mine = await store.listStories(id, { light: true });
    if (mine.length >= MAX_STORIES_PER_TREE) return NextResponse.json({ error: "This tree already has many stories. Please remove some first." }, { status: 429 });
    const forPerson = mine.filter((s) => s.person_id === person.id);
    if (forPerson.length >= MAX_STORIES_PER_PERSON) return NextResponse.json({ error: "This person already has many stories. Please remove some first." }, { status: 429 });
    // the light list leaves out the photo, so count photos on the full list of this one person
    if (c.photo && (await store.listStories(id, { person: person.id })).filter((s) => s.photo).length >= MAX_PHOTOS_PER_PERSON) return NextResponse.json({ error: `A person can have ${MAX_PHOTOS_PER_PERSON} photos. Please remove one first.` }, { status: 429 });
    const status = startStatus(person, me);
    const story: Story = { id: randomBytes(6).toString("hex"), tree_id: id, person_id: person.id, text: c.text, photo: c.photo, by_member: me.id, by_name: me.name, created_at: new Date().toISOString(), status, flags: [] };
    await store.addStory(story);
    logEvent("story_added");
    return NextResponse.json({ ok: true, status, story: storyView(row, me, story) });
  }

  const sid = typeof body.id === "string" ? body.id : "";
  const s = (await store.listStories(id)).find((x) => x.id === sid);
  if (!s) return NextResponse.json({ ok: true, gone: true });
  if (!canSee(row, me, s)) return NextResponse.json({ ok: true, gone: true });

  if (action === "approve") {
    if (!canApprove(row, me, s)) return NextResponse.json({ error: "Only the person this is about can approve it." }, { status: 403 });
    await store.updateStory(id, sid, { status: "shown" });
    logEvent("story_approved");
    return NextResponse.json({ ok: true });
  }
  if (action === "reject") {
    if (!canApprove(row, me, s)) return NextResponse.json({ error: "Only the person this is about can turn it down." }, { status: 403 });
    await store.deleteStory(id, sid);
    return NextResponse.json({ ok: true });
  }
  if (action === "remove") {
    if (!canRemove(row, me, s)) return NextResponse.json({ error: "Only the person who wrote it, or the owner of the tree, can remove it." }, { status: 403 });
    await store.deleteStory(id, sid);
    return NextResponse.json({ ok: true });
  }
  if (action === "flag" || action === "unflag") {
    if (s.status !== "shown") return NextResponse.json({ error: "Only stories that are shown can be flagged." }, { status: 400 });
    if (s.by_member === me.id) return NextResponse.json({ error: "You wrote this one. You can remove it instead." }, { status: 400 });
    const has = s.flags.includes(me.id);
    if (action === "flag" && !has) {
      await store.updateStory(id, sid, { flags: [...s.flags, me.id].slice(-20) });
      const who = row.family.persons.find((p) => p.id === s.person_id)?.name_roman ?? "someone";
      await mutateTree(store, id, (r) => ({ members: noteTo(r.members, `flagged a story about ${who} for the owner to look at`, me.name) }));
    }
    if (action === "unflag" && has) await store.updateStory(id, sid, { flags: s.flags.filter((m) => m !== me.id) });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
