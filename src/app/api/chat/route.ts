import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { runTurn, type ChatMsg } from "@/lib/agent";
import type { Pending } from "@/lib/family";
import { basicTurn } from "@/lib/basic-turn";
import { sanitizeFamily } from "@/lib/sanitize";
import { clientIp, limited } from "@/lib/ratelimit";
import { registerExtras } from "@/lib/lookup";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 45;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

/** user-added gotras/mools (see lookup.ts) — refreshed at most once a minute per server instance */
let extrasAt = 0;
async function loadExtras() {
  if (Date.now() - extrasAt < 60_000) return;
  extrasAt = Date.now();
  try { const s = getStore(); if (s) registerExtras(await s.listRefs()); } catch { /* optional */ }
}

export async function GET(req: Request) {
  // ?test=1 makes one tiny real call so you can see WHY the AI is not answering (wrong key, no credit, wrong model…)
  if (hasKey() && new URL(req.url).searchParams.get("test")) {
    if (limited("chat-test", clientIp(req), 10, 10 * 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    try {
      const client = new Anthropic({ timeout: 20_000, maxRetries: 0 });
      await client.messages.create({ model: MODEL, max_tokens: 8, messages: [{ role: "user", content: "Say OK" }] });
      return NextResponse.json({ ai: true, model: MODEL, ok: true });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      return NextResponse.json({ ai: true, model: MODEL, ok: false, status: err.status ?? null, error: String(err.message ?? e).slice(0, 220) });
    }
  }
  return NextResponse.json({ ai: hasKey(), model: hasKey() ? MODEL : null });
}

function cleanPending(v: unknown): Pending | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>, r = o.ref as Record<string, unknown> | undefined;
  if (typeof o.goalId !== "string" || (o.kind !== "gotra" && o.kind !== "mool") || !r || typeof r.roman !== "string") return undefined;
  return { goalId: o.goalId.slice(0, 60), kind: o.kind, rejected: o.rejected === true, ref: { id: typeof r.id === "string" ? r.id.slice(0, 60) : undefined, roman: r.roman.slice(0, 80), dev: typeof r.dev === "string" ? r.dev.slice(0, 80) : undefined } };
}

export async function POST(req: Request) {
  if (limited("chat", clientIp(req), Number(process.env.CHAT_RATE_LIMIT) || 60)) return NextResponse.json({ error: "Too many messages. Please wait a few minutes." }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const family = sanitizeFamily(body.family);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 700) : "";
  if (!family || !text) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const history: ChatMsg[] = Array.isArray(body.history)
    ? (body.history as ChatMsg[]).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-10)
    : [];
  const input = {
    family, text, history,
    prevGoalId: typeof body.prevGoalId === "string" ? body.prevGoalId : undefined,
    repeats: typeof body.repeats === "number" ? Math.min(5, Math.max(0, body.repeats)) : 0,
    pending: cleanPending(body.pending),
  };
  await loadExtras();

  if (hasKey()) {
    try {
      const client = new Anthropic({ timeout: 40_000, maxRetries: 1 });
      const out = await runTurn({ client, model: MODEL }, input);
      return NextResponse.json({ ...out, mode: "ai" });
    } catch (e) {
      console.error("AI turn failed, falling back to basic mode:", e instanceof Error ? e.message : e);
      return NextResponse.json({ ...basicTurn(input), mode: "basic", notice: "The AI assistant is unavailable right now, so I switched to simple questions." });
    }
  }
  return NextResponse.json({ ...basicTurn(input), mode: "basic" });
}
