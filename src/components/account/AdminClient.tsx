"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/build/widgets";
import { useAccount } from "./useAccount";

interface P { id: string; tree: string; title: string; name: string; gender?: string; born?: number; deceased: boolean; gotra?: string; mool?: string; place?: string; steps?: number; via?: string }
interface Stats { trees: number; people: number; links: number; treesLinked: number; groups: number; largestGroup: number }
interface PathRes { found: boolean; steps?: number; degree?: string; trees?: number; path?: P[] }

const line = (p: P) => [p.born ? `b. ${p.born}` : "", p.deceased ? "deceased" : "", p.gotra ? `gotra ${p.gotra}` : "", p.mool ? `mool ${p.mool}` : "", p.place].filter(Boolean).join(" · ");

/** Admin: find people by any attribute and trace the chain of relationships between two of them across all trees */
export function AdminClient() {
  const auth = useAccount();
  const [ok, setOk] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [f, setF] = useState({ q: "", gotra: "", mool: "", place: "", gender: "", from: "", to: "" });
  const [res, setRes] = useState<P[] | null>(null);
  const [a, setA] = useState<P | null>(null);
  const [b, setB] = useState<P | null>(null);
  const [path, setPath] = useState<PathRes | null>(null);
  const [near, setNear] = useState<P[] | null>(null);
  const [busy, setBusy] = useState("");

  const get = useCallback(async (qs: Record<string, string>) => fetch(`/api/admin/graph?${new URLSearchParams(qs)}`, { cache: "no-store" }), []);
  useEffect(() => {
    if (auth.loading) return;
    get({ op: "stats" }).then(async (r) => { if (r.ok) { setStats(await r.json()); setOk(true); } else setOk(false); }).catch(() => setOk(false));
  }, [auth.loading, get]);

  const search = async () => {
    setBusy("search"); setRes(null);
    const r = await get({ op: "search", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    setRes(r.ok ? (await r.json()).people : []); setBusy("");
  };
  const trace = async () => {
    if (!a || !b) return; setBusy("path"); setPath(null);
    const r = await get({ op: "path", from: a.id, to: b.id }); setPath(r.ok ? await r.json() : { found: false }); setBusy("");
  };
  const explore = async (p: P) => { setBusy("near"); const r = await get({ op: "around", node: p.id, depth: "3" }); setNear(r.ok ? (await r.json()).people : []); setBusy(""); };

  if (ok === null) return <div className="grid h-dvh place-items-center text-muted-foreground">Loading…</div>;
  if (!ok) return <div className="grid h-dvh place-items-center px-6 text-center"><div><p className="text-lg">This page is not available.</p><Link href="/" className="mt-3 inline-block underline">Go to the home page</Link></div></div>;

  const Pick = ({ p }: { p: P }) => (
    <li className="rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium">{p.name}</span><span className="text-xs text-muted-foreground">{p.title}</span>{p.steps !== undefined && <span className="rounded-full bg-secondary px-2 text-xs">{p.steps} step{p.steps === 1 ? "" : "s"}</span>}</div>
      <p className="text-xs text-muted-foreground">{line(p)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant={a?.id === p.id ? "default" : "outline"} onClick={() => setA(p)}>From</Button>
        <Button size="sm" variant={b?.id === p.id ? "default" : "outline"} onClick={() => setB(p)}>To</Button>
        <Button size="sm" variant="ghost" onClick={() => explore(p)}>Who is around</Button>
      </div>
    </li>
  );
  const fld = (k: keyof typeof f, label: string, type = "text") => (
    <div><label className="text-xs text-muted-foreground" htmlFor={`ad-${k}`}>{label}</label><input id={`ad-${k}`} type={type} className={`${inputCls} h-10`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && search()} /></div>
  );

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="border-b bg-card"><div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3"><Link href="/app" className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">PAAG Foundation</Link><span className="text-sm text-muted-foreground">Admin · connections</span></div></header>
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        {stats && (
          <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([["Trees", stats.trees], ["People", stats.people], ["Links between trees", stats.links], ["Trees linked", stats.treesLinked], ["Separate groups", stats.groups]] as const).map(([k, v]) => <div key={k} className="rounded-xl border bg-card p-3"><div className="text-2xl font-bold text-indigo">{v}</div><div className="text-xs text-muted-foreground">{k}</div></div>)}
          </section>
        )}

        <section aria-label="Find people" className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Find people by any attribute</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fld("q", "Name contains")}{fld("gotra", "Gotra")}{fld("mool", "Mool")}{fld("place", "Village / place")}
            <div><label className="text-xs text-muted-foreground" htmlFor="ad-gender">Gender</label><select id="ad-gender" className={`${inputCls} h-10`} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Any</option><option value="male">Male</option><option value="female">Female</option></select></div>
            {fld("from", "Born from (year)", "number")}{fld("to", "Born to (year)", "number")}
          </div>
          <Button onClick={search} disabled={!!busy}>{busy === "search" ? <Loader2 className="animate-spin" /> : <Search />} Search</Button>
          {res && (res.length ? <ul className="grid gap-2 sm:grid-cols-2">{res.map((p) => <Pick key={p.id} p={p} />)}</ul> : <p className="text-sm text-muted-foreground">No one matches.</p>)}
        </section>

        <section aria-label="Trace a connection" className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">How are two people connected?</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-secondary/60 p-3"><span className="text-xs text-muted-foreground">From</span><br />{a ? <><strong>{a.name}</strong> <span className="text-muted-foreground">· {a.title}</span></> : "Pick someone above"}</div>
            <div className="rounded-xl bg-secondary/60 p-3"><span className="text-xs text-muted-foreground">To</span><br />{b ? <><strong>{b.name}</strong> <span className="text-muted-foreground">· {b.title}</span></> : "Pick someone above"}</div>
          </div>
          <Button onClick={trace} disabled={!a || !b || !!busy}>{busy === "path" ? <Loader2 className="animate-spin" /> : null} Find the path</Button>
          {path && !path.found && <p className="rounded-xl bg-secondary p-3 text-sm">No path: these two people are not connected through any trees yet.</p>}
          {path?.found && path.path && (
            <div>
              <p className="mb-2 font-display text-lg font-semibold text-indigo">{path.degree} <span className="text-sm font-normal text-muted-foreground">· {path.steps} relationship step{path.steps === 1 ? "" : "s"} · {path.trees} tree{path.trees === 1 ? "" : "s"}</span></p>
              <ol className="space-y-1">
                {path.path.map((p, i) => (
                  <li key={p.id}>
                    {p.via && <p className="flex items-center gap-1 pl-4 text-xs italic text-muted-foreground"><ArrowDown className="size-3" /> {p.via}</p>}
                    <div className="rounded-xl border bg-background p-2 text-sm"><span className="font-medium">{p.name}</span> <span className="text-xs text-muted-foreground">{p.title}{i === 0 ? " · start" : i === path.path!.length - 1 ? " · end" : ""}</span><p className="text-xs text-muted-foreground">{line(p)}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {near && (
          <section aria-label="Around" className="space-y-2 rounded-2xl border bg-card p-4">
            <h2 className="font-semibold">People within 3 steps</h2>
            {near.length ? <ul className="grid gap-2 sm:grid-cols-2">{near.map((p) => <Pick key={p.id} p={p} />)}</ul> : <p className="text-sm text-muted-foreground">No one else is connected to this person yet.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
