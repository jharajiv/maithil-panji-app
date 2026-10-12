import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { newsletterEnabled } from "@/lib/newsletter";
import { getStore, type Subscriber } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO = { "cache-control": "no-store" };

const csvCell = (x: string | undefined) => { const v = (x ?? "").replace(/\r?\n/g, " "); return /^[=+\-@]/.test(v) || /[",]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : "") + v.replace(/"/g, '""')}"` : v; };

/**
 * Admin only. GET → the numbers; GET ?format=csv → the list as a spreadsheet file.
 * Newsletters themselves are written and sent from a proper mailing platform (for example Resend Broadcasts): import the CSV there.
 */
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
