import { NextResponse } from "next/server";
import { authEnabled, currentAccount } from "@/lib/auth";
import { mailConfigured, sendMail } from "@/lib/mail";
import { birthdayLabel, coverage, leadOf, reminderMail, remindersOn, todayIST } from "@/lib/reminders";
import { birthdaysOf, familiesOf } from "@/lib/reminders-run";
import { clientIp, limited } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function state(accountId: string, profile: Parameters<typeof remindersOn>[0], email: string) {
  const store = getStore()!;
  const today = todayIST();
  const fams = await familiesOf(store, accountId);
  let living = 0, withDate = 0;
  for (const f of fams) { const c = coverage(f.family); living += c.living; withDate += c.withDate; }
  const next = (await birthdaysOf(store, accountId, today, 60)).slice(0, 5).map((b) => ({ name: b.person.name_roman, name_dev: b.person.name_dev, when: birthdayLabel(b), daysAway: b.daysAway, turns: b.turns }));
  return { on: remindersOn(profile), lead: leadOf(profile), email, mailReady: mailConfigured(), living, withDate, next };
}

/** GET → the person's reminder settings, how many living people have a full birthday, and the next birthdays (so they see it working before they switch it on) */
export async function GET(req: Request) {
  if (!authEnabled() || !getStore()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json(await state(a.id, a.profile, a.email), { headers: { "cache-control": "no-store" } });
}

/** PUT { on, lead } → switch birthday reminders on or off. POST { test: true } → one example email to the person's own address. */
export async function PUT(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (limited("rem-save", clientIp(req), 60, 60 * 60_000)) return NextResponse.json({ error: "Too many changes. Please wait a little." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { on?: unknown; lead?: unknown } | null;
  if (!b || typeof b.on !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const lead = b.lead === "day" ? "day" : "week";
  const cur = a.profile ?? {};
  const turningOn = b.on && !cur.reminders?.birthdays;
  const next = await store.updateAccount(a.id, { profile: { ...cur, reminders: { birthdays: b.on, lead }, ...(turningOn ? { _remind_on: new Date().toISOString() } : {}) } });
  if (!next) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true, ...(await state(a.id, next.profile, next.email)) });
}

export async function POST(req: Request) {
  const store = getStore();
  if (!store || !authEnabled()) return NextResponse.json({ error: "Sign-in is not switched on yet." }, { status: 503 });
  const a = await currentAccount(req);
  if (!a) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!mailConfigured()) return NextResponse.json({ error: "Email sending is not switched on yet." }, { status: 503 });
  if (limited("rem-test", a.id, 3, 60 * 60_000)) return NextResponse.json({ error: "A test email was sent a moment ago. Please try again in an hour." }, { status: 429 });
  const items = await birthdaysOf(store, a.id, todayIST(), 366);
  if (!items.length) return NextResponse.json({ error: "No living person in your tree has a full birth date yet (day, month and year), so there is nothing to remind you about." }, { status: 400 });
  const first = items[0]!;
  const ok = await sendMail(reminderMail(a.email, a.id, [{ ...first, kind: "week", key: "test" }], { test: true }));
  return NextResponse.json(ok ? { ok: true } : { error: "The email could not be sent. Please try again later." }, { status: ok ? 200 : 502 });
}
