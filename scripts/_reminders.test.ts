import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.STORE = "file"; process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "rem-")); process.env.AUTH_SECRET = "test-secret-long-enough-0123456789abcdef";
process.env.NEXT_PUBLIC_SITE_URL = "https://paag.org.in";
delete process.env.NEXT_PUBLIC_APP_ENV; delete process.env.VERCEL_ENV;

(async () => {
  const { birthMonthDay, coverage, dueToday, reminderMail, remindable, todayIST, trimSent, upcoming, accountFromRemToken, remUnsubToken } = await import("../src/lib/reminders");
  const { runBirthdayReminders, birthdaysOf } = await import("../src/lib/reminders-run");
  const { getStore, newAccountId, newTreeId } = await import("../src/lib/store");
  const { cleanProfile } = await import("../src/lib/profile");
  type P = import("../src/lib/family").DPerson;
  const person = (id: string, name: string, birth?: string, extra: Partial<P> = {}): P => ({ id, name_roman: name, birth, flags: {}, ...extra });

  // dates: only a full day-month-year counts; India's calendar day decides "today"
  assert.deepEqual(birthMonthDay("1958-03-14"), { y: 1958, m: 3, d: 14 });
  assert.equal(birthMonthDay("1958"), null); assert.equal(birthMonthDay("1958-03"), null); assert.equal(birthMonthDay(undefined), null);
  assert.deepEqual(todayIST(new Date("2026-10-12T20:00:00Z")), { y: 2026, m: 10, d: 13 }); // 1:30 am next day in India
  assert.deepEqual(todayIST(new Date("2026-10-12T02:30:00Z")), { y: 2026, m: 10, d: 12 });

  // who is included: living, named, full date. Not: deceased, a death date, a placeholder, a partial date
  assert.ok(remindable(person("a", "Aarav Jha", "2014-10-14")));
  assert.ok(!remindable(person("b", "Late Ram", "1930-10-14", { status: "deceased" })));
  assert.ok(!remindable(person("c", "Has death", "1930-10-14", { death: "1999" })));
  assert.ok(!remindable(person("d", "", "1990-10-14")));
  assert.ok(!remindable(person("e", "Unknown", "1990-10-14", { placeholder: true })));
  assert.ok(!remindable(person("f", "Year only", "1990")));

  const fam = { persons: [person("1", "Aarav Jha", "2014-10-14", { name_dev: "आरव झा" }), person("2", "Sita Devi", "1960-10-19"), person("3", "Leap Baby", "2016-02-29"), person("4", "Late Ram", "1930-10-14", { status: "deceased" }), person("5", "No Day", "1980")], rels: [], next: 6 };
  assert.deepEqual(coverage(fam), { living: 4, withDate: 3 });

  const today = { y: 2026, m: 10, d: 12 };
  const up = upcoming(fam, "T1", today, 60);
  assert.deepEqual(up.map((b) => [b.person.name_roman, b.daysAway, b.turns]), [["Aarav Jha", 2, 12], ["Sita Devi", 7, 66]]);
  // a birthday that passed this year comes round next year; 29 February falls on 28 February in a normal year
  const nov = upcoming(fam, "T1", { y: 2026, m: 11, d: 1 }, 366);
  assert.equal(nov.find((b) => b.person.name_roman === "Aarav Jha")!.on.y, 2027);
  const leap = upcoming(fam, "T1", { y: 2027, m: 2, d: 27 }, 5).find((b) => b.person.name_roman === "Leap Baby")!;
  assert.deepEqual([leap.on.m, leap.on.d, leap.daysAway], [2, 28, 1]);
  const leap2 = upcoming(fam, "T1", { y: 2028, m: 2, d: 27 }, 5).find((b) => b.person.name_roman === "Leap Baby")!;
  assert.deepEqual([leap2.on.m, leap2.on.d], [2, 29]);

  // what is due: today's, and exactly 7 days ahead for "week"; not 3 days ahead; never twice
  const sevenOut = upcoming(fam, "T1", { y: 2026, m: 10, d: 12 }, 8);
  assert.deepEqual(dueToday(sevenOut, "week", []).map((d) => `${d.person.name_roman}:${d.kind}`), ["Sita Devi:week"]);
  assert.deepEqual(dueToday(sevenOut, "day", []).length, 0);
  const onDay = upcoming(fam, "T1", { y: 2026, m: 10, d: 14 }, 8);
  const due = dueToday(onDay, "day", []);
  assert.deepEqual(due.map((d) => `${d.person.name_roman}:${d.kind}`), ["Aarav Jha:day"]);
  assert.equal(dueToday(onDay, "day", [due[0]!.key]).length, 0);
  assert.equal(trimSent(["a", "b"], ["c"], 2).join(), "b,c");

  // the email: names and dates only; the stop link works; nothing private in it
  const m = reminderMail("owner@example.com", "acc1", [{ ...due[0]!, turns: 12 }]);
  assert.match(m.subject, /Today is Aarav Jha’s birthday/);
  assert.match(m.html, /आरव झा/); assert.match(m.html, /wa\.me\/\?text=/); assert.match(m.html, /Stop these emails/);
  assert.match(m.headers!["List-Unsubscribe"]!, /^<https:\/\/paag\.org\.in\/api\/reminders\/unsubscribe\?t=/);
  const tok = decodeURIComponent(/unsubscribe\?t=([^>"]+)/.exec(m.headers!["List-Unsubscribe"]!)![1]!);
  assert.equal(accountFromRemToken(tok), "acc1"); assert.equal(accountFromRemToken(tok + "x"), null); assert.equal(accountFromRemToken("junk"), null);
  assert.equal(accountFromRemToken(remUnsubToken("zzz")), "zzz");
  assert.ok(!/\+91|phone|@.*Aarav/i.test(m.text));
  const week = reminderMail("o@e.com", "a", dueToday(sevenOut, "week", []));
  assert.match(week.subject, /Sita Devi’s birthday is on 19 Oct, in 7 days/);
  assert.ok(!/wa\.me/.test(week.html), "no wish link a week ahead");
  const many = reminderMail("o@e.com", "a", [...due, ...dueToday(upcoming({ ...fam, persons: [person("9", "Raj Kumar", "1970-10-14")] }, "T1", { y: 2026, m: 10, d: 14 }, 3), "day", [])]);
  assert.match(many.subject, /^2 family birthdays: /);

  // profile cleaning: a browser cannot forge the server's records
  const cp = cleanProfile({ reminders: { birthdays: true, lead: "day" }, _sent: ["x"], _remind_on: "2020-01-01", occupation: "teacher" });
  assert.deepEqual(cp, { occupation: "teacher", reminders: { birthdays: true, lead: "day" } });
  assert.deepEqual(cleanProfile({ reminders: { birthdays: "yes" } }).reminders, { birthdays: false, lead: "week" });

  // the daily job against the (file) store
  const store = getStore()!;
  const mk = async (email: string, on: boolean, lead: "week" | "day") => {
    const id = newAccountId();
    await store.createAccount({ id, email, name: email.split("@")[0]!, created_at: new Date().toISOString(), profile: on ? { reminders: { birthdays: true, lead } } : {} });
    return id;
  };
  const a1 = await mk("one@example.com", true, "week"), a2 = await mk("two@example.com", false, "week"), a3 = await mk("three@example.com", true, "day");
  const tid = newTreeId();
  const family = { persons: [person("1", "Aarav Jha", "2014-10-14"), person("2", "Sita Devi", "1960-10-19")], rels: [], next: 3 };
  const member = (account_id: string) => ({ id: "m" + account_id, name: "x", role: "owner" as const, created_at: new Date().toISOString(), account_id, status: "joined" as const });
  await store.createTree({ id: tid, family, rev: 1, members: [member(a1), member(a2)], updated_at: new Date().toISOString(), title: "Jha", people_count: 2 });
  const tid3 = newTreeId();
  await store.createTree({ id: tid3, family: { persons: [person("1", "Zed Kumar", "1990-10-12")], rels: [], next: 2 }, rev: 1, members: [member(a3)], updated_at: new Date().toISOString(), title: "Kumar", people_count: 1 });

  const sent: import("../src/lib/mail").Mail[] = [];
  const send = async (x: import("../src/lib/mail").Mail) => { sent.push(x); return true; };
  // 12 Oct: Sita is 7 days away → a1 (week) gets a mail; a2 has reminders off; a3 (day) gets Zed's birthday today
  const r1 = await runBirthdayReminders(store, new Date("2026-10-12T03:00:00Z"), send);
  assert.deepEqual(r1, { accounts: 2, emails: 2, failed: 0, skipped: 0 });
  assert.deepEqual(sent.map((x) => x.to).sort(), ["one@example.com", "three@example.com"]);
  assert.ok(!sent.some((x) => x.to === "two@example.com"), "a person who has not switched reminders on gets nothing");
  assert.match(sent.find((x) => x.to === "one@example.com")!.subject, /Sita Devi/);
  assert.match(sent.find((x) => x.to === "three@example.com")!.subject, /Today is Zed Kumar/);
  // the same day again: nothing is sent twice
  const r2 = await runBirthdayReminders(store, new Date("2026-10-12T04:00:00Z"), send);
  assert.equal(r2.emails, 0); assert.equal(sent.length, 2);
  // 14 Oct: Aarav's day comes; a1 is "week" (also gets the day-of mail)
  const r3 = await runBirthdayReminders(store, new Date("2026-10-14T03:00:00Z"), send);
  assert.equal(r3.emails, 1); assert.match(sent.at(-1)!.subject, /Today is Aarav Jha/);
  // a failed send is retried the next run, and the log is not written
  const fail = await runBirthdayReminders(store, new Date("2026-10-19T03:00:00Z"), async () => false);
  assert.equal(fail.failed, 1);
  const retry = await runBirthdayReminders(store, new Date("2026-10-19T03:00:00Z"), send);
  assert.equal(retry.emails, 1);
  // the person's tree is read for them only: a2 belongs to the same tree but sees the same people through birthdaysOf, never a3's
  const b2 = await birthdaysOf(store, a2, { y: 2026, m: 10, d: 12 }, 30);
  assert.deepEqual(b2.map((b) => b.person.name_roman), ["Aarav Jha", "Sita Devi"]);
  assert.ok(!(await birthdaysOf(store, a1, { y: 2026, m: 10, d: 1 }, 400)).some((b) => b.person.name_roman === "Zed Kumar"));
  console.log("reminders OK");
})();
