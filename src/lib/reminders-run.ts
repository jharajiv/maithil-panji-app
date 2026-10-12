import { type Mail, sendMail } from "./mail";
import type { DFamily } from "./family";
import { dueToday, leadOf, reminderMail, remindersOn, todayIST, trimSent, upcoming, type Birthday, type Ymd } from "./reminders";
import type { AccountRow, Store } from "./store";

/** the family trees this person belongs to (their own, and trees they were invited into), at most 5, newest first */
export async function familiesOf(store: Store, accountId: string): Promise<{ id: string; family: DFamily }[]> {
  const out: { id: string; family: DFamily }[] = [];
  for (const t of (await store.listTreesFor(accountId)).slice(0, 5)) {
    const row = await store.getTree(t.id);
    if (row) out.push({ id: row.id, family: row.family });
  }
  return out;
}

export async function birthdaysOf(store: Store, accountId: string, today: Ymd, within = 366): Promise<Birthday[]> {
  const all: Birthday[] = [];
  const seen = new Set<string>();
  for (const f of await familiesOf(store, accountId)) {
    for (const b of upcoming(f.family, f.id, today, within)) {
      const k = `${b.person.name_roman.toLowerCase()}|${b.person.birth}`; // the same person in two of someone's trees is one reminder
      if (seen.has(k)) continue; seen.add(k); all.push(b);
    }
  }
  return all.sort((a, b) => a.daysAway - b.daysAway);
}

export interface RunResult { accounts: number; emails: number; failed: number; skipped: number }

/** the daily job: for every account with reminders on, send what is due today. `send` can be replaced in tests. */
export async function runBirthdayReminders(store: Store, now = new Date(), send: (m: Mail) => Promise<boolean> = sendMail): Promise<RunResult> {
  const today = todayIST(now);
  const res: RunResult = { accounts: 0, emails: 0, failed: 0, skipped: 0 };
  for (const a of await store.listReminderAccounts(2000)) {
    if (!remindersOn(a.profile) || !a.email) { res.skipped++; continue; }
    res.accounts++;
    try {
      const sent = a.profile?._sent ?? [];
      const due = dueToday(await birthdaysOf(store, a.id, today, 8), leadOf(a.profile), sent);
      if (!due.length) continue;
      if (await send(reminderMail(a.email, a.id, due))) {
        res.emails++;
        await store.updateAccount(a.id, { profile: { ...(a.profile ?? {}), _sent: trimSent(sent, due.map((d) => d.key)) } });
      } else res.failed++;
    } catch (e) { res.failed++; console.error("birthday reminder failed for one account", (e as Error).message); }
  }
  return res;
}

export const accountEmail = (a: AccountRow) => a.email;
