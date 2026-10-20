import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { AgentDeps, ChatMsg } from "@/lib/agent";
import { takeTurn } from "@/lib/turn";
import type { Pending } from "@/lib/family";
import { sanitizeFamily } from "@/lib/sanitize";
import { clientIp, limited } from "@/lib/ratelimit";
import { registerExtras } from "@/lib/lookup";
import { getStore } from "@/lib/store";
import { DEVICE_RX } from "@/lib/device";
import { authEnabled, currentAccount } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { watchBudget } from "@/lib/ai-budget";
import { AI_FREE_PEOPLE, aiPeopleLeft } from "@/lib/save-prompt";
import { noteQuestion } from "@/lib/question-count";

export const runtime = "nodejs";
export const maxDuration = 60;
/** after this many seconds the AI is given up on and the simple questions answer instead, so the person always gets an answer (the host cuts the request off at maxDuration) */
const AI_BUDGET_MS = 50_000;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
/** the smaller model that only READS names out of an answer (about a third of the price); set it to the main model to switch this off */
const LIGHT_MODEL = process.env.ANTHROPIC_MODEL_LIGHT || "claude-haiku-4-5";
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
      // the small model that reads names: if this one fails the app quietly uses the main model, but you should know
      let light: { model: string; ok: boolean; error?: string } = { model: LIGHT_MODEL, ok: true };
      if (LIGHT_MODEL !== MODEL) {
        try { await client.messages.create({ model: LIGHT_MODEL, max_tokens: 8, messages: [{ role: "user", content: "Say OK" }] }); }
        catch (e) { light = { model: LIGHT_MODEL, ok: false, error: String((e as Error).message ?? e).slice(0, 160) }; }
      }
      return NextResponse.json({ ai: true, model: MODEL, ok: true, light });
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
  try { return await handle(req); }
  catch (e) {
    // whatever goes wrong, the browser gets JSON it can show, never a plain-text error page
    console.error("chat failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something went wrong on our side, and nothing was changed. Please try again." }, { status: 500 });
  }
}

async function handle(req: Request) {
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
    // set when the user replied to an earlier chat message or to a person's box in the tree
    answerGoal: typeof body.answerGoal === "string" && /^[a-z_]+(:p\d+)?$/.test(body.answerGoal) ? body.answerGoal : undefined,
    mode: body.mode === "replace" ? ("replace" as const) : ("add" as const),
    lang: body.lang === "hi" ? ("hi" as const) : ("en" as const),
    detour: body.detour === "ask" || body.detour === "paused" ? (body.detour as "ask" | "paused") : undefined,
  };
  await loadExtras();

  // who is asking: a signed-in account, or just a browser. Accounts are counted by account (clearing the browser does not reset it).
  const account = authEnabled() ? await currentAccount(req).catch(() => null) : null;
  const dev = req.headers.get("x-device-id") ?? "";

  // A tree that is not saved online gets the AI helper only for its first few people; after that the simple questions carry on
  // until the tree is saved (free, Google or email). The client tells the person why (see "gate" below).
  const named = family.persons.filter((p) => !p.placeholder).length;
  if (hasKey() && authEnabled() && !account && named >= AI_FREE_PEOPLE) {
    logEvent("ai_save_gate");
    const gated = await takeTurn(null, input);
    noteQuestion(input.text, gated);
    return NextResponse.json({ ...gated, gate: "save" });
  }

  // a day's limit per person/device (and a wider one per network) protects the AI budget; past it the simple reader carries on
  const perDevice = Number(process.env.CHAT_DAILY_LIMIT) || 150;
  const who = account ? `a:${account.id}` : DEVICE_RX.test(dev) ? dev : clientIp(req);
  const overLimit = hasKey() && (limited("chat-day-ip", clientIp(req), perDevice * 4, 24 * 3_600_000) || limited("chat-day", who, perDevice, 24 * 3_600_000));
  if (overLimit) { logEvent("ai_day_limit"); const capped = await takeTurn(null, input); noteQuestion(input.text, capped); return NextResponse.json({ ...capped, notice: "You have used today’s AI answers on this phone, so I switched to simple questions. They work just as well for your tree." }); }

  if (hasKey()) {
    try {
      const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
      const used: { calls: number; light?: number; rows?: NonNullable<AgentDeps["used"]>["rows"] } = { calls: 0, rows: [] };
      // one slow AI call must never turn into the host's plain-text "An error occurred" page: past the budget the simple reader answers
      let timer: ReturnType<typeof setTimeout> | undefined;
      const out = await Promise.race([
        takeTurn({ client, model: MODEL, lightModel: LIGHT_MODEL, used }, input),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("AI turn took too long")), AI_BUDGET_MS); }),
      ]).finally(() => clearTimeout(timer));
      if (used.calls > 0) { logEvent("ai_turn"); for (let i = 0; i < Math.min(used.calls, 12); i++) logEvent(i < (used.light ?? 0) ? "ai_call_light" : "ai_call"); await watchBudget(); void getStore()?.addAiCalls((used.rows ?? []).slice(0, 12)).catch(() => {}); } // counted only when the AI model was really called
      noteQuestion(input.text, out);
      // a tree that is not saved: say once, a little early, how many more people the AI helper will work for
      const left = authEnabled() && !account ? aiPeopleLeft(out.family.persons.filter((p) => !p.placeholder).length) : null;
      return NextResponse.json(left ? { ...out, left } : out);
    } catch (e) {
      console.error("AI turn failed, falling back to basic mode:", e instanceof Error ? e.message : e);
      const slow = e instanceof Error && /took too long|timed? ?out/i.test(e.message);
      return NextResponse.json({ ...(await takeTurn(null, input)), notice: slow ? "That took longer than expected, so nothing from it was saved and I used simple questions for this one. Please try again." : "The AI assistant is unavailable right now, so I switched to simple questions." });
    }
  }
  const plain = await takeTurn(null, input);
  noteQuestion(input.text, plain);
  return NextResponse.json(plain);
}
