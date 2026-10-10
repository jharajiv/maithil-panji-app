import { NextResponse } from "next/server";
import { currentAccount, isAdmin } from "@/lib/auth";
import { googleEnabled, originOf } from "@/lib/google";
import { mailConfigured } from "@/lib/mail";
import { newsletterEnabled } from "@/lib/newsletter";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const set = (k: string) => !!process.env[k]?.trim();

/** Admin only. Which settings are in place — never their values (only public ones: the address and the sender's domain). */
export async function GET(req: Request) {
  const a = await currentAccount(req);
  if (!isAdmin(a)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const fromDomain = /@([^>\s]+)>?\s*$/.exec(from)?.[1] ?? "";
  const store = getStore();
  const checks = [
    { id: "site", label: "Public address", ok: /^https:\/\//.test(site), detail: site || "NEXT_PUBLIC_SITE_URL is not set (set it to https://paag.org.in)" },
    { id: "contact", label: "Contact email on the Privacy page", ok: set("NEXT_PUBLIC_CONTACT_EMAIL"), detail: set("NEXT_PUBLIC_CONTACT_EMAIL") ? "set" : "NEXT_PUBLIC_CONTACT_EMAIL is not set" },
    { id: "store", label: "Database (saved trees, accounts)", ok: store?.kind === "supabase", detail: store ? (store.kind === "supabase" ? "Supabase" : "local file (development only)") : "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set" },
    { id: "secret", label: "Signing secret (AUTH_SECRET)", ok: set("AUTH_SECRET"), detail: set("AUTH_SECRET") ? "set" : "AUTH_SECRET is not set (a long random text; needed for safe newsletter links)" },
    { id: "mail", label: "Email sending (Resend)", ok: mailConfigured(), detail: mailConfigured() ? `sender domain: ${fromDomain || "?"}` : "RESEND_API_KEY and EMAIL_FROM are not both set" },
    { id: "google", label: "Sign in with Google", ok: googleEnabled(), detail: googleEnabled() ? "on" : "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set", extra: `Authorised redirect URI to register with Google: ${originOf(req)}/api/auth/google/callback` },
    { id: "newsletter", label: "Newsletter", ok: newsletterEnabled(), detail: newsletterEnabled() ? "on" : "needs the database, email sending and the signing secret" },
    { id: "admin", label: "Admin emails", ok: set("ADMIN_EMAILS"), detail: set("ADMIN_EMAILS") ? "set" : "ADMIN_EMAILS is not set" },
    { id: "places", label: "Village suggestions (Google Places)", ok: set("GOOGLE_PLACES_API_KEY"), detail: set("GOOGLE_PLACES_API_KEY") ? "on" : "off: the free OpenStreetMap service is used" },
    { id: "ai", label: "AI interviewer", ok: set("ANTHROPIC_API_KEY"), detail: set("ANTHROPIC_API_KEY") ? "on" : "off: Simple mode is used" },
    { id: "donate", label: "Voluntary contribution (UPI / card link)", ok: set("NEXT_PUBLIC_DONATE_UPI_ID") || set("NEXT_PUBLIC_DONATE_CARD_URL"), detail: set("NEXT_PUBLIC_DONATE_UPI_ID") || set("NEXT_PUBLIC_DONATE_CARD_URL") ? "on" : "off: nothing is asked" },
    { id: "wa", label: "WhatsApp community button", ok: set("NEXT_PUBLIC_WA_COMMUNITY_URL"), detail: set("NEXT_PUBLIC_WA_COMMUNITY_URL") ? "on" : "off" },
  ];
  return NextResponse.json({ checks }, { headers: { "cache-control": "no-store" } });
}
