"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Eye, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CombinePanel } from "./CombinePanel";
import type { ConnectRequest, Glance, Similar, SimilarTree } from "./useSimilar";

const TONE = { "very likely": "bg-green-100 text-green-900", likely: "bg-emerald-100 text-emerald-900", possible: "bg-amber-100 text-amber-900" } as const;
const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function GlanceBody({ g }: { g: Glance }) {
  return (
    <div className="rounded-xl border bg-background p-3 text-sm">
      <p className="text-xs text-muted-foreground">{g.people} people{g.gotra ? ` · gotra ${g.gotra}` : ""}{g.mool ? ` · mool ${g.mool}` : ""}</p>
      {g.ancestors.length > 0 && <p className="mt-2"><span className="text-muted-foreground">Oldest ancestors recorded: </span>{g.ancestors.join(", ")}</p>}
      {g.places.length > 0 && <p className="mt-1"><span className="text-muted-foreground">Villages: </span>{g.places.join(", ")}</p>}
      <p className="mt-2 text-muted-foreground">People who appear in both trees:</p>
      <ul className="mt-1 space-y-1">
        {g.pairs.map((p, i) => <li key={i} className="flex flex-wrap gap-x-2"><span>{p.mine} ↔ {p.theirs}</span><span className="text-xs text-muted-foreground">{p.reasons.slice(0, 3).join(" · ")}</span></li>)}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Living people show by first name only.</p>
    </div>
  );
}

function TreeCard({ t, sim, req }: { t: SimilarTree; sim: Similar; req?: ConnectRequest }) {
  const [g, setG] = useState<{ loading?: boolean; glance?: Glance; error?: string }>({});
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; needsPhone?: boolean } | null>(null);
  const look = async () => { setG({ loading: true }); setG(await sim.glance(t.tree)); };
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await sim.send(t.tree, msg);
    setBusy(false);
    if (r.ok) { setAsk(false); setOk(true); } else setErr({ text: r.error ?? "Could not send.", needsPhone: r.needsPhone });
  };
  return (
    <li className="rounded-2xl border bg-background p-3">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-display text-base font-bold text-primary" aria-label={`${t.percent} percent similar`}>{t.percent}%</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{t.title}</p>
          <p className="text-xs text-muted-foreground">{t.people} people · gotra {t.gotra} · mool {t.mool}</p>
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold first-letter:uppercase", TONE[t.strength])}>{t.strength} the same family</span>
          <p className="mt-1 text-xs text-muted-foreground">{t.matched} people found in both, such as {t.pairs.slice(0, 3).map((p) => p.mine.split(" ")[0]).join(", ")}</p>
        </div>
      </div>
      {g.glance && <div className="mt-3"><GlanceBody g={g.glance} /></div>}
      {g.error && <p role="alert" className="mt-2 text-sm text-terracotta">{g.error}</p>}
      {req && <RequestLine r={req} />}
      {ok && !req && <p className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-900">Request sent. You will see the answer here.</p>}
      {ask && (
        <div className="mt-3 space-y-2 rounded-xl border bg-card p-3">
          <p className="text-sm">Ask the owner of “{t.title}” to get in touch. <strong>Your name, mobile number and email, and the details in your profile, will be shown to them.</strong></p>
          <textarea aria-label="Message" className="h-20 w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus:border-primary" maxLength={300} placeholder="Optional message, for example: We may be cousins — my grandfather was Ramnath Jha of Sarisab." value={msg} onChange={(e) => setMsg(e.target.value)} />
          {err && <p role="alert" className="text-sm text-terracotta">{err.text} {err.needsPhone && <Link href="/app/profile" className="underline">Open My profile</Link>}</p>}
          <div className="flex gap-2"><Button className="h-11" onClick={send} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send request</Button><Button variant="ghost" className="h-11" onClick={() => setAsk(false)}>Cancel</Button></div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!g.glance && <Button variant="outline" className="h-11" onClick={look} disabled={g.loading}>{g.loading ? <Loader2 className="animate-spin" /> : <Eye />} Preview this tree</Button>}
        {sim.canAct && !req && !ok && !ask && <Button className="h-11" onClick={() => setAsk(true)}><MessageCircle /> Connect with the owner</Button>}
      </div>
      {!sim.canAct && <p className="mt-2 text-xs text-muted-foreground">Only the owner of this tree can contact another family.</p>}
    </li>
  );
}

function RequestLine({ r }: { r: ConnectRequest }) {
  if (r.status === "pending") return <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm">{r.dir === "out" ? "Request sent — waiting for the owner to answer." : "This family has asked to connect — see Requests above."}</p>;
  if (r.status === "declined") return <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">{r.dir === "out" ? "The owner did not accept this request." : "You declined this request."}</p>;
  return <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">Connected — see their details above.</p>;
}

function Person({ r }: { r: ConnectRequest }) {
  const w = r.who;
  const [copied, setCopied] = useState(false);
  if (!w) return null;
  const rows: [string, string | undefined][] = [["Pravar", w.pravar], ["Native place", w.native_place], ["Lives in", w.current_city], ["Marital status", w.marital_status], ["Occupation", w.occupation], ["Address", w.address], ["Email", w.email], ["Mobile", w.phone]];
  const hello = `Namaste ${w.name.split(" ")[0]}, I am writing from PAAG Foundation about our family trees “${r.title}”.`;
  return (
    <div className="mt-2 rounded-xl border bg-card p-3 text-sm">
      <p className="font-medium">{w.name}</p>
      <dl className="mt-1 space-y-0.5">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-all">{v}</dd></div>)}</dl>
      {w.about && <p className="mt-1 text-muted-foreground">{w.about}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {w.phone && <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"><a href={waLink(w.phone, hello)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>}
        {w.phone && <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(w.phone!); setCopied(true); } catch { /* ignore */ } }}>{copied ? <Check /> : <Copy />} Copy number</Button>}
      </div>
    </div>
  );
}

function Incoming({ r, sim }: { r: ConnectRequest; sim: Similar }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState<{ text: string; needsPhone?: boolean } | null>(null);
  const [yes, setYes] = useState(false);
  const act = async (a: "accept" | "decline") => { setBusy(a); setErr(null); const x = await sim.answer(r.id, a); setBusy(""); if (!x.ok) setErr({ text: x.error ?? "Could not save.", needsPhone: x.needsPhone }); };
  return (
    <li className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
      <p className="font-medium leading-snug">“{r.title}” would like to connect <span className="font-normal text-muted-foreground">· {r.percent}% similar</span></p>
      {r.message && <p className="mt-1 rounded-lg bg-card p-2 text-sm italic">“{r.message}”</p>}
      <Person r={r} />
      {yes && <p className="mt-2 text-sm"><strong>If you accept, your name, mobile number, email and profile details are shown to this owner.</strong></p>}
      {err && <p role="alert" className="mt-2 text-sm text-terracotta">{err.text} {err.needsPhone && <Link href="/app/profile" className="underline">Open My profile</Link>}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!yes ? <Button className="h-11" onClick={() => setYes(true)}><Check /> Accept…</Button> : <Button className="h-11" onClick={() => act("accept")} disabled={!!busy}>{busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />} Accept and share my details</Button>}
        <Button variant="ghost" className="h-11" onClick={() => act("decline")} disabled={!!busy}>{busy === "decline" ? <Loader2 className="animate-spin" /> : <X />} Decline</Button>
      </div>
    </li>
  );
}

/** "Similar family trees": same gotra and mool, similar people — preview, ask the owner to connect, answer requests */
export function SimilarTrees({ sim }: { sim: Similar }) {
  const { data, requests } = sim;
  const incoming = requests.filter((r) => r.dir === "in" && r.status === "pending");
  const connected = requests.filter((r) => r.status === "accepted");
  const byTree = new Map(requests.filter((r) => r.status !== "declined" || r.dir === "out").map((r) => [r.tree, r]));
  return (
    <section aria-label="Similar family trees" className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Similar family trees</h3>
        <p className="text-xs text-muted-foreground">Trees with the same gotra and mool, and people who look alike. Perhaps the same family was entered twice.</p>
      </div>
      {incoming.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold">Requests</h4><ul className="space-y-3">{incoming.map((r) => <Incoming key={r.id} r={r} sim={sim} />)}</ul></div>}
      {connected.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Connected families</h4>
          <ul className="space-y-2">{connected.map((r) => <li key={r.id} className="rounded-xl border bg-background p-3 text-sm"><p className="font-medium">“{r.title}”</p><Person r={r} /><CombinePanel r={r} sim={sim} /></li>)}</ul>
        </div>
      )}
      {sim.loading && !data && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking…</p>}
      {sim.error && <p role="alert" className="text-sm text-terracotta">{sim.error} <button className="underline" onClick={() => sim.reload()}>Try again</button></p>}
      {data && !data.hasStock && <p className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">Add the gotra and mool of the person this tree is about, and we will look for similar trees.</p>}
      {data?.hasStock && data.trees.length > 0 && <ul className="space-y-3">{data.trees.map((t) => <TreeCard key={t.tree} t={t} sim={sim} req={byTree.get(t.tree)} />)}</ul>}
      {data?.hasStock && !data.trees.length && <p className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">No similar tree found yet. We look again as you add people, or when another family joins.</p>}
    </section>
  );
}
