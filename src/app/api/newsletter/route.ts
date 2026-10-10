import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { isLang, newsletterEnabled, requestSubscription } from "@/lib/newsletter";
import { clientIp, limited } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO = { "cache-control": "no-store" };

/** GET → is the newsletter switched on? (the form hides itself when it is not) */
export async function GET() {
  return NextResponse.json({ enabled: newsletterEnabled() }, { headers: NO });
}

/**
 * POST { email, lang?: "en"|"hi", source?, consent: true, website?: "" (hidden field: a person leaves it empty) }
 * The answer is the same whether the address is new, already confirmed or asked for a moment ago, so it cannot be used to find out who subscribes.
 */
export async function POST(req: Request) {
  const store = getStore();
  if (!store || !newsletterEnabled()) return NextResponse.json({ error: "The newsletter is not switched on yet." }, { status: 503, headers: NO });
  if (limited("newsletter", clientIp(req), 8)) return NextResponse.json({ error: "Too many tries. Please wait a little." }, { status: 429, headers: NO });
  const b = (await req.json().catch(() => null)) as { email?: unknown; lang?: unknown; source?: unknown; consent?: unknown; website?: unknown } | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO });
  if (typeof b.website === "string" && b.website.trim()) return NextResponse.json({ ok: true }, { headers: NO }); // a robot filled the hidden field: pretend it worked
  const email = normalizeEmail(b.email);
  if (!email) return NextResponse.json({ error: "Please check the email address." }, { status: 400, headers: NO });
  if (b.consent !== true) return NextResponse.json({ error: "Please tick the box to agree." }, { status: 400, headers: NO });
  const lang = isLang(b.lang) ? b.lang : "en";
  const source = typeof b.source === "string" && /^[a-z-]{1,20}$/.test(b.source) ? b.source : "site";
  const r = await requestSubscription(store, email, lang, source, sendMail);
  if (r === "error") return NextResponse.json({ error: "We could not send the email just now. Please try again later." }, { status: 502, headers: NO });
  return NextResponse.json({ ok: true }, { headers: NO });
}
