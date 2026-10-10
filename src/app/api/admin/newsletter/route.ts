import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { mailConfigured, sendBatch } from "@/lib/mail";
import { newsletterEnabled, newsletterMail } from "@/lib/newsletter";
import { clientIp, limited } from "@/lib/ratelimit";
import { getStore, type Subscriber } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO = { "cache-control": "no-store" };

const csvCell = (x: string | undefined) => { const v = (x ?? "").replace(/\r?\n/g, " "); return /^[=+\-@]/.test(v) || /[",]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : "") + v.replace(/"/g, '""')}"` : v; };

/** Admin only. GET → the numbers; GET ?format=csv → the list as a spreadsheet file */
export async function GET(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store) return NextResponse.json({ error: "No store is configured." }, { status: 503 });
  const all = await store.listSubscribers();
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const head = "email,status,language,source,subscribed,confirmed,unsubscribed";
    const rows = all.map((s) => [s.email, s.status, s.lang, s.source, s.created_at, s.confirmed_at, s.unsubscribed_at].map(csvCell).join(","));
    return new NextResponse(`﻿${[head, ...rows].join("\r\n")}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="PAAG-newsletter-subscribers.csv"', ...NO } });
  }
  const n = (f: (s: Subscriber) => boolean) => all.filter(f).length;
  return NextResponse.json({
    enabled: newsletterEnabled(), mail: mailConfigured(), total: all.length,
    confirmed: n((s) => s.status === "confirmed"), pending: n((s) => s.status === "pending"), unsubscribed: n((s) => s.status === "unsubscribed"),
    confirmedEn: n((s) => s.status === "confirmed" && s.lang === "en"), confirmedHi: n((s) => s.status === "confirmed" && s.lang === "hi"),
  }, { headers: NO });
}

/**
 * Admin only. POST { subject, body, audience: "all"|"en"|"hi", test?: true }
 *  test: sends one copy to the signed-in admin only.  Otherwise: one copy to every confirmed subscriber of that language.
 */
export async function POST(req: Request) {
  const a = await currentAccount(req);
  if (!a || !isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const store = getStore();
  if (!store || !newsletterEnabled()) return NextResponse.json({ error: "The newsletter is not switched on yet." }, { status: 503, headers: NO });
  if (limited("newsletter-send", clientIp(req), 6, 60 * 60_000)) return NextResponse.json({ error: "Too many sends. Please wait." }, { status: 429, headers: NO });
  const b = (await req.json().catch(() => null)) as { subject?: unknown; body?: unknown; audience?: unknown; test?: unknown } | null;
  const subject = typeof b?.subject === "string" ? b.subject.trim().slice(0, 150) : "", text = typeof b?.body === "string" ? b.body.trim().slice(0, 20000) : "";
  if (!subject || !text) return NextResponse.json({ error: "Write a subject and a message." }, { status: 400, headers: NO });
  if (b?.test === true) {
    const r = await sendBatch([newsletterMail({ email: a.email, lang: "en" }, `[Test] ${subject}`, text)]);
    return NextResponse.json({ ...r, total: 1, test: true }, { headers: NO });
  }
  const aud = b?.audience === "en" || b?.audience === "hi" ? b.audience : "all";
  const to = (await store.listSubscribers()).filter((s) => s.status === "confirmed" && (aud === "all" || s.lang === aud));
  if (!to.length) return NextResponse.json({ error: "Nobody has confirmed yet for that audience.", sent: 0, failed: 0, total: 0 }, { status: 400, headers: NO });
  const r = await sendBatch(to.map((s) => newsletterMail(s, subject, text)));
  return NextResponse.json({ ...r, total: to.length }, { headers: NO });
}
