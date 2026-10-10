"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/build/widgets";

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

/** Admin: how many subscribers, the list as a spreadsheet, and a plain-text newsletter to send */
export function NewsletterAdmin() {
  const [n, setN] = useState<Nums | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "en" | "hi">("all");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/admin/newsletter", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setN).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!n) return null;

  const count = audience === "en" ? n.confirmedEn : audience === "hi" ? n.confirmedHi : n.confirmed;
  const send = async (test: boolean) => {
    if (!test && !window.confirm(`Send this to ${count} confirmed subscriber${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusy(test ? "test" : "send"); setMsg("");
    try {
      const r = await fetch("/api/admin/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, body, audience, test }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: number; total?: number };
      setMsg(!r.ok ? (j.error ?? "Could not send.") : test ? "A test copy was sent to your own email address." : `Sent to ${j.sent} of ${j.total}${j.failed ? ` (${j.failed} failed)` : ""}.`);
    } catch { setMsg("Could not reach the server."); }
    setBusy("");
  };

  return (
    <section aria-label="Newsletter" className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Newsletter</h2>
      {!n.enabled && <p className="rounded-xl bg-secondary p-3 text-sm">Not switched on yet: it needs the database, email sending (Resend) and AUTH_SECRET. See “Setup status” above.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Confirmed", n.confirmed], ["Waiting to confirm", n.pending], ["Unsubscribed", n.unsubscribed], ["Hindi / English", `${n.confirmedHi} / ${n.confirmedEn}`]] as const).map(([k, v]) => <div key={k} className="rounded-xl border bg-background p-3"><div className="text-xl font-bold text-indigo">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>)}
      </div>
      <Button asChild variant="outline" size="sm"><a href="/api/admin/newsletter?format=csv"><Download /> Download the list (spreadsheet)</a></Button>

      {n.enabled && (
        <div className="space-y-2.5 border-t pt-3">
          <h3 className="text-sm font-medium">Write a newsletter</h3>
          <div><label className="text-xs text-muted-foreground" htmlFor="nl-subject">Subject</label><input id="nl-subject" className={`${inputCls} h-10`} value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} /></div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="nl-body">Message (plain text: a blank line starts a new paragraph, a line starting with “## ” is a heading, web addresses starting with https:// become links)</label>
            <textarea id="nl-body" rows={9} className={`${inputCls} min-h-40 py-2`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-muted-foreground" htmlFor="nl-aud">Send to</label>
              <select id="nl-aud" className={`${inputCls} h-10`} value={audience} onChange={(e) => setAudience(e.target.value as "all" | "en" | "hi")}><option value="all">Everyone confirmed ({n.confirmed})</option><option value="en">English readers ({n.confirmedEn})</option><option value="hi">Hindi readers ({n.confirmedHi})</option></select></div>
            <Button variant="outline" disabled={!subject.trim() || !body.trim() || !!busy} onClick={() => send(true)}>{busy === "test" ? <Loader2 className="animate-spin" /> : null} Send a test to me</Button>
            <Button disabled={!subject.trim() || !body.trim() || !!busy || !count} onClick={() => send(false)}>{busy === "send" ? <Loader2 className="animate-spin" /> : <Send />} Send to {count}</Button>
          </div>
          {msg && <p role="status" className="text-sm">{msg}</p>}
          <p className="text-xs text-muted-foreground">Every copy carries an unsubscribe link. Always send a test to yourself first. Resend’s free plan allows about 100 emails a day and 3,000 a month; send in parts by language if the list is larger.</p>
        </div>
      )}
    </section>
  );
}
