import { NextResponse } from "next/server";
import { cookieOptions, SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { getStore, hashToken } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const store = getStore(), t = sessionToken(req);
  if (store && t) await store.deleteSession(hashToken(t)).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}
