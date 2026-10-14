import { adminEmails } from "./auth";
import { logEvent } from "./events";
import { sendMail } from "./mail";
import { getStore } from "./store";

/**
 * Watching what the AI helper costs, without ever switching it off.
 * Every AI answer is counted (event "ai_turn"). When a day's count reaches 70 % and then 100 % of AI_DAILY_ALERT, the admins
 * (ADMIN_EMAILS) get one email each. The day is India's calendar day. Nothing is blocked: it is only a warning.
 */
export const alertLevel = () => Number(process.env.AI_DAILY_ALERT) || 300;

/** start of today in India (UTC+5:30) as an ISO time */
export function istDayStart(now = Date.now()): string {
  const ist = new Date(now + 19_800_000); ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 19_800_000).toISOString();
}

/** which warning is due: the highest level reached whose email has not gone out today */
export function dueLevel(count: number, limit: number, sent: { a70: number; a100: number }): 70 | 100 | null {
  if (count >= limit && !sent.a100) return 100;
  if (count >= Math.ceil(limit * 0.7) && !sent.a70 && !sent.a100) return 70;
  return null;
}

let last = 0;
/** called after an AI answer; looks at the day's count at most every two minutes per server instance */
export async function watchBudget(now = Date.now()): Promise<void> {
  if (now - last < 120_000) return;
  last = now;
  try {
    const store = getStore(); const to = adminEmails();
    if (!store || !to.length) return;
    const c = await store.countEvents(istDayStart(now));
    const n = c.ai_turn ?? 0, limit = alertLevel();
    const level = dueLevel(n, limit, { a70: c.ai_alert_70 ?? 0, a100: c.ai_alert_100 ?? 0 });
    if (!level) return;
    logEvent(level === 70 ? "ai_alert_70" : "ai_alert_100"); // marked first, so a second server instance does not send it again
    const pct = Math.round((n / limit) * 100);
    const subject = level === 100 ? `AI helper: ${n} answers today — over your alert level of ${limit}` : `AI helper: ${n} answers today — ${pct}% of your alert level`;
    const gate = (c.ai_save_gate ?? 0);
    const lines = [
      `The AI helper has written ${n} answers so far today (India time). Your alert level is ${limit} a day.`,
      gate ? `Today the helper stepped aside ${gate === 1 ? "once" : `${gate} times`} because a tree was not saved yet.` : "",
      "Nothing has been switched off — this is only a heads-up. If the number looks too high, look at Usage in the Anthropic console (console.anthropic.com) to see the spend, and you can change the alert level (AI_DAILY_ALERT) or the number of people allowed before saving in Vercel.",
    ].filter(Boolean);
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#222">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
    for (const addr of to) await sendMail({ to: addr, subject, html, text: lines.join("\n\n") });
  } catch (e) { console.error("ai budget check failed", e instanceof Error ? e.message : e); }
}
