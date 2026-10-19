"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarHeart, Loader2 } from "lucide-react";

interface State { on: boolean; lead: "week" | "day"; email: string; mailReady: boolean; living: number; withDate: number; missing?: { tree: string; id: string; name: string; partial: boolean }[]; next: { name: string; name_dev?: string; when: string; daysAway: number; turns?: number }[] }

/** My profile → birthday reminders. Saves on its own (not with the profile button) because switching a reminder on or off should take effect at once. */
export function RemindersCard() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/me/reminders", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); const j = (await r.json()) as State; setS(j); }).catch(() => setErr("Could not load the reminder settings."));
  }, []);
  useEffect(() => { if (s && window.location.hash === "#reminders") document.getElementById("reminders")?.scrollIntoView({ block: "start" }); }, [!!s]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (on: boolean, lead: "week" | "day") => {
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await fetch("/api/me/reminders", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ on, lead }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save.");
      setS(j as State); setNote(on ? "Birthday reminders are on." : "Birthday reminders are off.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await fetch("/api/me/reminders", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not send.");
      setNote(`A test email is on its way to ${s?.email}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not send."); } finally { setBusy(false); }
  };

  return (
    <section id="reminders" className="scroll-mt-4 space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="rem-h">
      <div className="flex items-start gap-3">
        <CalendarHeart className="mt-0.5 size-6 shrink-0 text-terracotta" aria-hidden />
        <div>
          <h2 id="rem-h" className="text-lg font-semibold">Birthday reminders <span lang="hi" className="text-base font-medium text-muted-foreground">· जन्मदिन की याद</span></h2>
          <p className="text-sm text-muted-foreground">We email you before the birthdays of living relatives in your family tree, so you can call or send a wish. Only you get the email, at the address you sign in with.</p>
          <p lang="hi" className="mt-1 text-sm text-muted-foreground">आपकी वंशावली में जीवित रिश्तेदारों के जन्मदिन से पहले हम आपको ईमेल भेजेंगे। ईमेल सिर्फ़ आपको जाता है।</p>
        </div>
      </div>

      {!s ? <p className="text-sm text-muted-foreground">{err || "Loading…"}</p> : (<>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3">
          <input type="checkbox" className="size-6 accent-[var(--primary)]" checked={s.on} disabled={busy || !s.mailReady} onChange={(e) => save(e.target.checked, s.lead)} />
          <span className="text-[15px]"><strong>Email me about family birthdays</strong><span lang="hi" className="block text-muted-foreground">परिवार के जन्मदिन की याद ईमेल से भेजें</span></span>
          {busy && <Loader2 className="ml-auto size-5 animate-spin" />}
        </label>
        {!s.mailReady && <p className="text-sm text-terracotta">Email sending is not switched on on this site yet.</p>}

        {s.on && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground/80">When</legend>
            {([["week", "7 days before, and on the day", "7 दिन पहले और जन्मदिन के दिन"], ["day", "On the day only", "सिर्फ़ जन्मदिन के दिन"]] as const).map(([v, en, hi]) => (
              <label key={v} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-[15px]">
                <input type="radio" name="rem-lead" className="size-5 accent-[var(--primary)]" checked={s.lead === v} disabled={busy} onChange={() => save(true, v)} />
                <span>{en}<span lang="hi" className="block text-sm text-muted-foreground">{hi}</span></span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p className="font-medium">{s.next.length ? "Coming up in your family" : "No birthday in the next 60 days"}</p>
          {s.next.length > 0 && <ul className="mt-1.5 space-y-1">{s.next.map((b, i) => <li key={i}>{b.name}{b.name_dev ? ` · ${b.name_dev}` : ""} — {b.when}{b.turns ? ` (turns ${b.turns})` : ""} <span className="text-muted-foreground">{b.daysAway === 0 ? "today" : b.daysAway === 1 ? "tomorrow" : `in ${b.daysAway} days`}</span></li>)}</ul>}
          <p className="mt-2 text-muted-foreground">{s.living === 0 ? "Add family members in your tree to get started." : `${s.withDate} of ${s.living} living people in your tree have a full birthday (day, month and year).`} {s.withDate < s.living && "Add the rest in the tree: tap a person, then their birth date."}</p>
        </div>

        {s.missing && s.missing.length > 0 && (
          <div className="rounded-xl border border-dashed p-3 text-sm">
            <p className="font-medium">Add a birthday to be reminded <span lang="hi" className="font-normal text-muted-foreground">· जन्मदिन जोड़ें</span></p>
            <p className="mt-0.5 text-muted-foreground">Open the person in your tree and fill in their date of birth (day, month and year).</p>
            <ul className="mt-2 flex flex-wrap gap-2">{s.missing.map((m) => <li key={`${m.tree}:${m.id}`}><Link href={`/app/tree/${m.tree}`} className="inline-flex min-h-10 items-center rounded-full border bg-card px-3 hover:bg-secondary">{m.name}{m.partial ? " · year only" : ""}</Link></li>)}</ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {s.mailReady && s.withDate > 0 && <button type="button" onClick={test} disabled={busy} className="h-11 rounded-xl border px-4 text-[15px] font-medium hover:bg-secondary disabled:opacity-50">Send me a test email</button>}
          <Link href="/safety" className="text-sm underline underline-offset-2">How we keep your family data safe</Link>
        </div>
        <p role="status" className="min-h-5 text-sm">{err ? <span className="text-terracotta">{err}</span> : note ? <span className="text-green-700">{note}</span> : null}</p>
      </>)}
    </section>
  );
}
