"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DupPair, NewRef, Quality, Queue, QSide } from "@/lib/admin-queue";
import { plainRoman, searchGotras, searchMools } from "@/lib/lookup";

interface Check { id: string; label: string; ok: boolean; detail: string; extra?: string }

/** Admin: which settings are in place (never their values) */
export function SetupStatus() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  useEffect(() => { fetch("/api/admin/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => setChecks(j?.checks ?? [])).catch(() => setChecks([])); }, []);
  if (!checks?.length) return null;
  const todo = checks.filter((c) => !c.ok).length;
  return (
    <section aria-label="Setup status" className="rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Setup status <span className="text-sm font-normal text-muted-foreground">· {todo ? `${todo} still to set up` : "everything is set"}</span></h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Settings live in Vercel → Settings → Environment Variables. After a change, redeploy. Values are never shown here.</p>
      <ul className="mt-3 divide-y text-sm">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-2.5 py-2">
            {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-label="in place" /> : <Circle className="mt-0.5 size-4 shrink-0 text-ochre" aria-label="not yet" />}
            <div className="min-w-0"><div className="font-medium">{c.label}</div><div className="break-words text-xs text-muted-foreground">{c.detail}</div>{c.extra && <div className="mt-0.5 break-all text-xs text-foreground/80">{c.extra}</div>}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Nums { enabled: boolean; mail: boolean; total: number; confirmed: number; pending: number; unsubscribed: number; confirmedEn: number; confirmedHi: number }

/** Admin: how many people asked for updates, and their list as a spreadsheet to import into a mailing platform. Newsletters are not written here. */
export function SubscribersAdmin() {
  const [n, setN] = useState<Nums | null>(null);
  useEffect(() => { fetch("/api/admin/newsletter", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setN).catch(() => {}); }, []);
  if (!n) return null;
  return (
    <section aria-label="Newsletter subscribers" className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Newsletter subscribers</h2>
      {!n.enabled && <p className="rounded-xl bg-secondary p-3 text-sm">Sign-ups are not switched on yet: they need the database, email sending (Resend) and AUTH_SECRET. See “Setup status” above.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Confirmed", n.confirmed], ["Waiting to confirm", n.pending], ["Unsubscribed", n.unsubscribed], ["Hindi / English", `${n.confirmedHi} / ${n.confirmedEn}`]] as const).map(([k, v]) => <div key={k} className="rounded-xl border bg-background p-3"><div className="text-xl font-bold text-indigo">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>)}
      </div>
      <Button asChild variant="outline" size="sm"><a href="/api/admin/newsletter?format=csv"><Download /> Download the list (spreadsheet)</a></Button>
      <p className="text-xs text-muted-foreground">Newsletters are written and sent from a mailing platform (for example Resend Broadcasts), which handles layout, unsubscribe links and delivery. Import only the <em>confirmed</em> rows.</p>
    </section>
  );
}

const ago = (iso: string) => {
  const d = Math.max(0, Date.now() - new Date(iso).getTime()) / 86_400_000;
  return d < 1 ? "today" : d < 2 ? "yesterday" : `${Math.round(d)} days ago`;
};
const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function Side({ s, other }: { s: QSide; other: QSide }) {
  const o = s.owner;
  const hello = `Namaste${o?.name ? ` ${o.name.split(" ")[0]}` : ""}! This is PAAG Foundation. We noticed that your family tree “${s.title}” may be the same family as another tree on our site. May we help you check?`;
  return (
    <div className="min-w-0 flex-1 rounded-xl border bg-background p-3 text-sm">
      <div className="truncate font-medium">{s.title}</div>
      <div className="text-xs text-muted-foreground">{s.people} people · updated {ago(s.updated)}</div>
      {o ? (
        <div className="mt-1.5 space-y-0.5 text-xs">
          <div>{o.name}</div>
          {o.email && <div className="break-all"><a className="underline" href={`mailto:${o.email}?subject=${encodeURIComponent("Your family tree on PAAG Foundation")}`}>{o.email}</a></div>}
          {o.phone && <div><a className="inline-flex items-center gap-1 underline" href={waLink(o.phone, hello)} target="_blank" rel="noopener noreferrer">WhatsApp {o.phone} <ExternalLink className="size-3" /></a></div>}
        </div>
      ) : <div className="mt-1.5 text-xs text-muted-foreground">No contact on record{other.owner ? "" : ""}.</div>}
    </div>
  );
}

function Dup({ d }: { d: DupPair }) {
  return (
    <li className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.strength === "very likely" ? "bg-terracotta text-white" : "bg-secondary"}`}>{d.percent}% · {d.strength}</span>
        <span className="text-xs text-muted-foreground">{d.matched} people match · gotra {d.gotra} · mool {d.mool}</span>
        {d.sameOwner && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">same person started twice</span>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row"><Side s={d.a} other={d.b} /><Side s={d.b} other={d.a} /></div>
      {d.pairs.length > 0 && <p className="text-xs text-muted-foreground">For example: {d.pairs.map((p) => (p.mine === p.theirs ? p.mine : `${p.mine} ≈ ${p.theirs}`)).join(" · ")}</p>}
    </li>
  );
}

function Refs({ list }: { list: NewRef[] }) {
  const [gone, setGone] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<{ key: string; mode: "approve" | "map" } | null>(null);
  const [roman, setRoman] = useState("");
  const [dev, setDev] = useState("");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const keyOf = (r: NewRef) => `${r.kind}:${r.roman}`;
  const start = (r: NewRef, mode: "approve" | "map") => { setOpen({ key: keyOf(r), mode }); setRoman(r.roman); setDev(r.dev ?? ""); setFind(mode === "map" ? r.roman : ""); setErr(""); };
  const sugg = (r: NewRef) => {
    const q = find.trim();
    if (q.length < 2) return [];
    return (r.kind === "gotra" ? searchGotras(q) : searchMools(q)).slice(0, 5).map((h) => ({ id: h.item.id, roman: plainRoman(h.item.roman), dev: h.item.dev }));
  };
  const send = async (r: NewRef, body: Record<string, unknown>) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/refs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: r.kind, from: r.roman, ...body }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not save that.");
      setGone((g) => ({ ...g, [keyOf(r)]: `${j.now?.roman ?? ""}${j.now?.dev ? ` (${j.now.dev})` : ""} · ${j.people} ${j.people === 1 ? "person" : "people"} in ${j.trees} ${j.trees === 1 ? "tree" : "trees"} updated${j.failed ? `, ${j.failed} could not be saved: press the button again` : ""}` }));
      setOpen(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save that."); } finally { setBusy(false); }
  };
  return (
    <ul className="divide-y text-sm">
      {list.map((r) => {
        const k = keyOf(r), done = gone[k], o = open?.key === k ? open : null;
        return (
          <li key={k} className="py-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold uppercase">{r.kind}</span>
              <span className={`font-medium ${done ? "line-through opacity-60" : ""}`}>{r.roman}</span>{r.dev && <span lang="hi" className="text-muted-foreground">{r.dev}</span>}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{r.trees} tree{r.trees === 1 ? "" : "s"}</span>
            </div>
            {done ? <p className="mt-1 text-xs text-green-800">Done → {done}</p> : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button size="sm" variant={o?.mode === "approve" ? "default" : "outline"} onClick={() => start(r, "approve")}>Approve (or correct the spelling)</Button>
                <Button size="sm" variant={o?.mode === "map" ? "default" : "outline"} onClick={() => start(r, "map")}>Same as one in the list</Button>
              </div>
            )}
            {o?.mode === "approve" && !done && (
              <div className="mt-2 space-y-2 rounded-xl bg-secondary/60 p-3">
                <p className="text-xs text-muted-foreground">This becomes a real {r.kind} that people are offered from now on. Change the spelling if it is not right; everybody who typed it gets the approved spelling.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input aria-label="Spelling in English letters" value={roman} onChange={(e) => setRoman(e.target.value)} maxLength={60} className="h-11 rounded-xl border bg-card px-3" />
                  <input aria-label="Spelling in Devanagari" lang="hi" placeholder="देवनागरी" value={dev} onChange={(e) => setDev(e.target.value)} maxLength={60} className="h-11 rounded-xl border bg-card px-3" />
                </div>
                <Button size="sm" disabled={busy || !roman.trim()} onClick={() => send(r, { action: "approve", roman, dev })}>{busy ? "Saving…" : "Approve and update all trees"}</Button>
              </div>
            )}
            {o?.mode === "map" && !done && (
              <div className="mt-2 space-y-2 rounded-xl bg-secondary/60 p-3">
                <p className="text-xs text-muted-foreground">Search the list and tap the entry this really is. Everybody who typed “{r.roman}” gets that entry.</p>
                <input aria-label="Search the Panji list" value={find} onChange={(e) => setFind(e.target.value)} className="h-11 w-full rounded-xl border bg-card px-3" />
                <div className="flex flex-wrap gap-2">
                  {sugg(r).map((x) => <Button key={x.id} size="sm" variant="outline" disabled={busy} onClick={() => send(r, { action: "map", id: x.id })}>{x.roman}{x.dev ? ` (${x.dev})` : ""}</Button>)}
                  {find.trim().length >= 2 && sugg(r).length === 0 && <span className="text-xs text-muted-foreground">Nothing in the list looks like that.</span>}
                </div>
              </div>
            )}
            {o && err && <p role="alert" className="mt-1 text-xs text-terracotta">{err}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Admin: what needs a decision or a conversation */
export function ActionQueue() {
  const [q, setQ] = useState<Queue | null | "error">(null);
  useEffect(() => { fetch("/api/admin/queue", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setQ).catch(() => setQ("error")); }, []);
  if (q === null) return <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Looking for things that need you…</section>;
  if (q === "error") return <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">The to-do list could not be loaded. Please refresh.</section>;
  const nothing = !q.duplicates.length && !q.newRefs.length;
  return (
    <section aria-label="Needs your attention" className="space-y-4 rounded-2xl border border-terracotta/30 bg-card p-4">
      <div>
        <h2 className="font-semibold">Needs your attention <span className="text-sm font-normal text-muted-foreground">· {q.duplicates.length + q.newRefs.length} item{q.duplicates.length + q.newRefs.length === 1 ? "" : "s"}</span></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{q.scanned} trees checked. Duplicates are looked for only among the {q.optedIn} tree{q.optedIn === 1 ? "" : "s"} whose owners agreed to be found, as the privacy page says.</p>
      </div>
      {nothing && <p className="rounded-xl bg-secondary p-3 text-sm">Nothing needs you right now.</p>}
      {q.duplicates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Trees that may be the same family ({q.duplicates.length})</h3>
          <ul className="space-y-2">{q.duplicates.map((d) => <Dup key={`${d.a.tree}-${d.b.tree}`} d={d} />)}</ul>
          <p className="text-xs text-muted-foreground">Nothing is merged from here. Talk to the owners; they can connect or combine the trees themselves from the Families tab.</p>
        </div>
      )}
      {q.newRefs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">New gotra and mool spellings to review ({q.newRefs.length})</h3>
          <Refs list={q.newRefs} />
          <p className="text-xs text-muted-foreground">People typed these because they were not in the Panji list. For each one, either approve it (correcting the spelling if needed) or say it is the same as an entry already in the list. Check with a panjikar or an elder when unsure. Nothing changes until you press a button.</p>
        </div>
      )}
      {q.usage && (
        <div className="space-y-1.5 border-t pt-3">
          <h3 className="text-sm font-medium">Usage <span className="font-normal text-muted-foreground">· last {q.usage.days} days</span></h3>
          {q.usage.failed ? <p role="alert" className="text-sm text-terracotta">The counts could not be read just now. Try again in a minute.</p> : null}
          <table className={`w-full text-sm ${q.usage.failed ? "hidden" : ""}`}><tbody>{q.usage.rows.map((r) => <tr key={r.name} className="border-b last:border-0"><td className="py-1 pr-3">{r.label}</td><td className="py-1 text-right font-medium tabular-nums">{r.count}</td></tr>)}</tbody></table>
          {q.usage.unsaved && !q.usage.failed && (
            q.usage.unsaved.reached3 + q.usage.unsaved.reached8 + q.usage.unsaved.finished > 0 ? (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">Built in a browser, not saved: roughly <strong>{q.usage.unsaved.waiting}</strong> {q.usage.unsaved.waiting === 1 ? "tree" : "trees"} reached 3 people ({q.usage.unsaved.reached3} did, {q.usage.unsaved.saved} were saved); {q.usage.unsaved.reached8} reached 8 people and {q.usage.unsaved.finished} finished the questions. These are anonymous counts: we cannot see who they are or contact them, so the only way to reach them is the in-app “save your tree” reminder.</p>
            ) : (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">Built in a browser, not saved: <strong>none counted yet</strong>. These three counts started with v12.1: a browser is counted the next time someone opens the app with a tree of 3 people or more that is not saved (once per browser), so older unsaved trees appear only when their owners return. A rough pointer from the older counts: {q.usage.unsaved.started} {q.usage.unsaved.started === 1 ? "tree was" : "trees were"} started and {q.usage.unsaved.saved} saved in these {q.usage.days} days, but “started” counts a person each visit, so it overstates.</p>
            )
          )}
          {!q.usage.failed && <ChatHealth q={q.usage.quality} days={q.usage.days} />}
          {!q.usage.failed && <TokenTable t={q.usage.tokens} />}
          {q.usage.ai && !q.usage.failed && (
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">AI cost check: <strong>{q.usage.ai.perAnswer}</strong> model calls per AI answer ({q.usage.ai.calls} calls for {q.usage.ai.answers} answers); <strong>{q.usage.ai.lightShare}%</strong> of the calls went to the small, cheaper model. Lower is better for the first number; the second should be well above 0 once people answer the brothers, sisters and children questions. Counting started with v12, so older days are not included.</p>
          )}
          {q.usage.questions && !q.usage.failed && (
            <div className="mt-3 border-t pt-3">
              <h4 className="text-sm font-medium">Questions people asked in the chat <span className="font-normal text-muted-foreground">· answers given, most asked first</span></h4>
              {q.usage.questions.rows.length ? <table className="mt-1 w-full text-sm"><tbody>{q.usage.questions.rows.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="py-1 pr-3">{r.q}</td><td className="py-1 text-right font-medium tabular-nums">{r.count}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">No ready-made answer has been given yet.</p>}
              <p className="mt-1 text-sm"><span className="font-medium tabular-nums">{q.usage.questions.unanswered}</span> typed questions had no ready-made answer <span className="text-muted-foreground">(the AI may still have answered them). Only the count is kept, never the words, so a high number is a hint to add FAQ entries.</span></p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">These count visits and taps, not different people — one person can be counted more than once. No names or trees are kept.</p>
        </div>
      )}
      {q.invites && (
        <div className="space-y-1.5 border-t pt-3">
          <h3 className="text-sm font-medium">Invitations <span className="font-normal text-muted-foreground">· the site is open; this only counts</span></h3>
          <p className="text-sm">{q.invites.byInvite} of {q.invites.total} saved tree{q.invites.total === 1 ? "" : "s"} came through an invitation link{q.invites.inviters ? `, from ${q.invites.inviters} ${q.invites.inviters === 1 ? "person" : "people"}` : ""}.</p>
          {q.invites.top.length > 0 && <ul className="text-sm text-muted-foreground">{q.invites.top.map((t, i) => <li key={i}>{t.name} — {t.count} tree{t.count === 1 ? "" : "s"}</li>)}</ul>}
          <p className="text-xs text-muted-foreground">If many families come through invitations, you can announce that the site is by invitation and switch on invite codes.</p>
        </div>
      )}
    </section>
  );
}

const rate = (a: number, of: number) => (of ? `${Math.round((1000 * a) / of) / 10}%` : "–");
/** How the chat is doing, from anonymous counts of every turn: where people stop, how often it did not understand, how the commands and thumbs are used */
function ChatHealth({ q, days }: { q?: Quality; days: number }) {
  if (!q) return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <p className="font-medium">How the chat is doing</p>
      <p className="text-muted-foreground">Nothing counted yet. Counting starts with the first chat answer after v12.3 is live. Only numbers are kept: never what people type, and never who they are.</p>
    </div>
  );
  const max = Math.max(1, ...q.questions.map((x) => x.reached));
  const stat = (k: string, v: string, hint: string) => <div key={k} className="rounded-xl border bg-background p-2.5"><div className="text-lg font-bold text-indigo">{v}</div><div className="text-xs font-medium">{k}</div><div className="text-[11px] leading-snug text-muted-foreground">{hint}</div></div>;
  const paceRows = (label: string, list: { label: string; count: number }[]) => <div><div className="text-xs font-medium">{label}</div><ul className="text-sm">{list.map((r) => <li key={r.label} className="flex justify-between border-b py-0.5 last:border-0"><span>{r.label}</span><span className="font-medium tabular-nums">{r.count}</span></li>)}</ul></div>;
  return (
    <div className="space-y-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <p className="font-medium">How the chat is doing <span className="font-normal text-muted-foreground">· last {days} days, anonymous counts</span></p>
      <p>{q.turns} chat answers. Look at these numbers once a week: find the question where people stop, or a share that keeps rising.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Did not understand", rate(q.fallback, q.turns), `${q.fallback} times (“Sorry, I did not catch that”). Lower is better.`)}
        {stat("Question skipped", rate(q.loopSkip, q.turns), `${q.loopSkip} times a question was asked 3 times and skipped.`)}
        {stat("Off-topic", rate(q.offTopic, q.turns), `${q.offTopic} messages that were not about the tree.`)}
        {stat("AI slow or failed", String(q.timeouts + q.errors), `${q.timeouts} too slow, ${q.errors} errors; simple questions took over.`)}
        {stat("Commands run", String(q.cmdRun), `${q.cmdYes} then went back to the questions, ${q.cmdNo} chose not to.`)}
        {stat("👍 Helpful", String(q.up), "Thumbs up under a chat answer.")}
        {stat("👎 Not helpful", String(q.down), `${q.shared} of them also sent the exchange to us.`)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-1 pr-2 text-left font-medium">Question (in the order asked)</th><th className="py-1 pl-2 text-right font-medium">Reached</th><th className="py-1 pl-2 text-right font-medium">Skipped</th></tr></thead>
          <tbody>{q.questions.map((r) => <tr key={r.kind} className="border-b last:border-0"><td className="py-1 pr-2"><div>{r.label}</div><div className="mt-0.5 h-1 rounded bg-primary/25" style={{ width: `${Math.round((100 * r.reached) / max)}%` }} aria-hidden /></td><td className="py-1 pl-2 text-right tabular-nums">{r.reached}</td><td className="py-1 pl-2 text-right tabular-nums">{r.skipped ? <>{r.skipped}<span className="block text-xs text-muted-foreground">{rate(r.skipped, r.reached)}</span></> : 0}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{paceRows("Time from first answer to 3 people", q.pace.three)}{paceRows("Time from first answer to 8 people", q.pace.eight)}</div>
      <p className="text-xs text-muted-foreground">“Reached” counts how many times the chat asked that question; a big drop between two neighbouring questions shows where people give up. “Skipped” is how often the reply was “skip” or “don’t know”. Pace counts each browser once. These are visits and taps, not different people.</p>
    </div>
  );
}

interface Fb { id: number; at: string; lang: string; goal: string | null; user_text: string; bot_text: string; note: string | null }
/** Admin: exchanges people chose to send after a 👎 (only with their agreement). Read them, improve the chat, delete them. */
export function FeedbackAdmin() {
  const [list, setList] = useState<Fb[] | null>(null);
  const [missing, setMissing] = useState(false);
  const load = () => fetch("/api/admin/feedback", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j) return; setList(j.items ?? []); setMissing(!!j.missing); }).catch(() => {});
  useEffect(() => { void load(); }, []);
  if (!list && !missing) return null;
  const del = async (id: number) => { await fetch(`/api/admin/feedback?id=${id}`, { method: "DELETE" }).catch(() => {}); await load(); };
  return (
    <section aria-label="Chat feedback" className="space-y-2 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Chat feedback <span className="text-sm font-normal text-muted-foreground">· shared by users after 👎</span></h2>
      {missing ? <p className="rounded-xl bg-secondary p-3 text-sm">This list needs one more table. In Supabase → SQL editor, run section 12 of <code>supabase/schema.sql</code>. Thumbs are still counted meanwhile.</p>
        : !list?.length ? <p className="text-sm text-muted-foreground">Nothing shared yet. Only people who press 👎 <em>and</em> agree to send the exchange appear here.</p>
        : <ul className="space-y-2">{list.map((f) => (
          <li key={f.id} className="rounded-xl border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{ago(f.at)} · {f.lang === "hi" ? "Hindi" : "English"}{f.goal ? ` · question: ${f.goal}` : ""}</span><Button variant="ghost" size="sm" onClick={() => del(f.id)}>Delete</Button></div>
            <p className="mt-1"><span className="font-medium">They wrote:</span> {f.user_text}</p>
            <p className="mt-1"><span className="font-medium">The chat said:</span> {f.bot_text}</p>
            {f.note && <p className="mt-1"><span className="font-medium">Their note:</span> {f.note}</p>}
          </li>))}</ul>}
      <p className="text-xs text-muted-foreground">Shown only because the person agreed to send it. There is no name or tree with it, but people sometimes type a name in their message, so delete each one once you have learned from it.</p>
    </section>
  );
}

/** Admin: a copy of everything, because the free database plan has no automatic backups */
export function BackupAdmin() {
  return (
    <section aria-label="Backup" className="space-y-2 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Backup <span className="text-sm font-normal text-muted-foreground">· do this every week</span></h2>
      <p className="text-sm text-muted-foreground">The free Supabase plan keeps no automatic backups. Press the first button once a week and keep the file somewhere safe (it holds every family’s data, so keep it private). The second is a spreadsheet of all people, to read or share with a panjikar. After you move to a paid plan, the database makes daily backups itself and this stays as an extra copy.</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><a href="/api/admin/export?kind=trees"><Download /> Download all trees (backup file)</a></Button>
        <Button asChild variant="outline" size="sm"><a href="/api/admin/export?kind=people"><Download /> Download all people (spreadsheet)</a></Button>
      </div>
    </section>
  );
}

const n = (x: number) => (x >= 10_000 ? `${(x / 1000).toFixed(x >= 100_000 ? 0 : 1)}K` : String(x));
const usd = (x: number) => `$${x < 1 ? x.toFixed(3) : x.toFixed(2)}`;
/** The real token counts of the AI calls, by day and by model, with a price estimate */
function TokenTable({ t }: { t?: import("@/lib/admin-queue").Tokens }) {
  if (!t) return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <p className="font-medium">AI tokens</p>
      <p className="text-muted-foreground">No token counts yet. They start with the first AI answer after this version is live. If this stays empty after people have used the AI helper, run section 11 of <code>supabase/schema.sql</code> in Supabase.</p>
    </div>
  );
  const head = "py-1 pl-2 text-right font-medium";
  const rows = (list: import("@/lib/admin-queue").TokenRow[]) => list.map((r) => (
    <tr key={r.key} className="border-b last:border-0"><td className="py-1 pr-2">{r.key}</td><td className="py-1 pl-2 text-right tabular-nums">{r.calls}</td><td className="py-1 pl-2 text-right tabular-nums">{n(r.input)}</td><td className="py-1 pl-2 text-right tabular-nums">{n(r.cache_read)}</td><td className="py-1 pl-2 text-right tabular-nums">{n(r.cache_write)}</td><td className="py-1 pl-2 text-right tabular-nums">{n(r.output)}</td><td className="py-1 pl-2 text-right font-medium tabular-nums">{usd(r.usd)}</td></tr>
  ));
  const cols = <tr className="border-b text-xs text-muted-foreground"><th className="py-1 pr-2 text-left font-medium"> </th><th className={head}>Calls</th><th className={head}>New in</th><th className={head}>Cached in</th><th className={head}>Cache write</th><th className={head}>Out</th><th className={head}>Est. cost</th></tr>;
  return (
    <div className="space-y-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <p className="font-medium">AI tokens and estimated cost</p>
      <p>Last {t.days.length} days with AI use: <strong>{n(t.total.input + t.total.cache_read + t.total.cache_write)}</strong> tokens in, <strong>{n(t.total.output)}</strong> out, about <strong>{usd(t.total.usd)}</strong> in all, <strong>{usd(t.usdPerAnswer)}</strong> per AI answer. <strong>{t.cachePercent}%</strong> of the input came from the cache (cached input costs a tenth, so higher is better).</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[30rem] text-sm"><thead>{cols}</thead><tbody>{rows(t.days)}</tbody></table></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[30rem] text-sm"><thead>{cols}</thead><tbody>{rows(t.models)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">“New in” is input that was not cached. Prices are my estimate (Sonnet $3 in / $15 out, Haiku $1 / $5 per million tokens; cache writes cost 1.25 times and cache reads 0.1 times the input price), so check the real bill in the Anthropic console. Only numbers are kept here: no text and no person.</p>
    </div>
  );
}

/** Admin: fill the blank gotra and mool of trees saved by older versions (the family rule: everyone on the father's line) */
export function StockFix() {
  const [n, setN] = useState<{ trees: number; affected: number; entries: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const check = () => fetch("/api/admin/fix-stock", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setN).catch(() => {});
  useEffect(() => { void check(); }, []);
  if (!n) return null;
  const run = async () => {
    setBusy(true); setDone("");
    try {
      const r = await fetch("/api/admin/fix-stock", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setDone(r.ok ? `Done: ${j.entries} blank gotra / mool entries filled in ${j.fixed} trees${j.failed ? `; ${j.failed} could not be saved, try again` : ""}.` : "Could not do that. Please try again.");
      await check();
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Family gotra and mool" className="space-y-2 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Family gotra and mool</h2>
      <p className="text-sm text-muted-foreground">Everyone on the user’s father’s line (father, grandfathers, brothers, sisters, uncles, aunts, sons, daughters and the sons’ children) carries the family’s gotra and mool. Wives, husbands, mothers and the mother’s and daughters’ families do not. The app now fills this in by itself whenever a tree is opened or changed. This button does the same for saved trees nobody has opened yet. It only fills blanks and never changes a value that is already there.</p>
      <p className="text-sm">{n.affected ? <>Blanks found in <strong>{n.affected}</strong> of {n.trees} trees ({n.entries} entries).</> : <>All {n.trees} saved trees are already complete.</>}</p>
      {n.affected > 0 && <Button size="sm" disabled={busy} onClick={run}>{busy ? "Filling…" : "Fill the blanks now"}</Button>}
      {done && <p role="status" className="text-sm text-green-800">{done}</p>}
    </section>
  );
}
