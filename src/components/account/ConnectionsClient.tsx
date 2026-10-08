"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ChevronLeft, Loader2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "./useAccount";

interface Person { id: string; name: string; years?: string; gotra?: string; mool?: string; living: boolean; steps: number; degree: string; via?: string }
interface Data { trees: { id: string; title: string }[]; tree: { id: string; title: string } | null; on: boolean; people: Person[] }

/** how you are connected to other families — the "2nd / 3rd connection" idea, for families that chose to be found */
export function ConnectionsClient() {
  const router = useRouter();
  const auth = useAccount();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("");
  const [path, setPath] = useState<{ found: boolean; degree?: string; steps?: number; path?: Person[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (tree?: string) => {
    setErr("");
    const r = await fetch(`/api/me/connections${tree ? `?tree=${tree}` : ""}`, { cache: "no-store" });
    if (r.status === 401) { router.replace("/login?next=/app/connections"); return; }
    if (!r.ok) { setErr("Could not load your connections. Please refresh."); return; }
    setD(await r.json()); setOpen(""); setPath(null);
  }, [router]);
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.enabled) { router.replace("/build"); return; }
    if (!auth.account) { router.replace("/login?next=/app/connections"); return; }
    void load();
  }, [auth.loading, auth.enabled, auth.account, load, router]);

  const show = async (p: Person) => {
    if (!d?.tree) return;
    if (open === p.id) { setOpen(""); setPath(null); return; }
    setOpen(p.id); setPath(null); setBusy(true);
    const r = await fetch(`/api/me/connections?tree=${d.tree.id}&to=${encodeURIComponent(p.id)}`, { cache: "no-store" });
    setPath(r.ok ? await r.json() : { found: false }); setBusy(false);
  };

  if (!d) return <div className="grid h-dvh place-items-center text-muted-foreground">{err || "Loading…"}</div>;
  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="border-b bg-card"><div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3"><Link href="/app" className="flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" /> My family trees</Link></div></header>
      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">My connections</h1>
          <p className="mt-1 text-muted-foreground">Other families you are connected to through linked daughters and wives. A 2nd connection is a relative’s relative; a 3rd connection is one step further. Only families who chose to be found appear, and living people show by first name only.</p>
        </div>
        {d.trees.length > 1 && (
          <label className="block text-sm"><span className="text-muted-foreground">Connections of</span>
            <select className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-base" value={d.tree?.id} onChange={(e) => void load(e.target.value)}>{d.trees.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          </label>
        )}
        {!d.tree && <div className="rounded-2xl border border-dashed bg-card p-6 text-center"><p className="text-muted-foreground">Connections start from your own family tree.</p><Button asChild className="mt-4 h-12"><Link href="/app">Start my family tree</Link></Button></div>}
        {d.tree && !d.on && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
            <h2 className="font-display text-lg font-semibold">Switch on “let families find each other”</h2>
            <p className="mt-2 text-sm text-muted-foreground">Connections work like this: you see families who chose to take part, and they can see yours. It is off until you switch it on in your tree’s Families pane, and you can switch it off any time.</p>
            <Button asChild className="mt-3 h-11"><Link href={`/app/tree/${d.tree.id}`}>Open my tree</Link></Button>
          </div>
        )}
        {d.tree && d.on && !d.people.length && (
          <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground"><Network className="size-4" /> No connected families yet</p>
            <p className="mt-2">Connections appear when a married woman in your tree is linked to the same woman in another family’s tree. Add the married women of your family, and open the Families pane in your tree to look for matches. We check again whenever a new family joins.</p>
            <Button asChild variant="outline" className="mt-3"><Link href={`/app/tree/${d.tree.id}`}>Open my tree</Link></Button>
          </div>
        )}
        {d.on && d.people.length > 0 && (
          <ul className="space-y-2">
            {d.people.map((p) => (
              <li key={p.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary" aria-label={p.degree}>{p.steps}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{p.name}{p.years ? <span className="font-normal text-muted-foreground"> · b. {p.years}</span> : null}</p>
                    <p className="text-xs text-muted-foreground">{p.degree}{p.gotra ? ` · gotra ${p.gotra}` : ""}{p.mool ? ` · mool ${p.mool}` : ""}</p>
                  </div>
                  <Button size="sm" variant={open === p.id ? "default" : "outline"} onClick={() => show(p)}>{open === p.id ? "Hide" : "Show the path"}</Button>
                </div>
                {open === p.id && (
                  <div className="mt-3 border-t pt-3">
                    {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Tracing…</p>}
                    {path && !path.found && <p className="text-sm text-muted-foreground">This connection is no longer available.</p>}
                    {path?.found && path.path && (
                      <ol className="space-y-1">
                        {path.path.map((s) => (
                          <li key={s.id}>
                            {s.via && <p className="flex items-center gap-1 pl-3 text-xs italic text-muted-foreground"><ArrowDown className="size-3" /> {s.via}</p>}
                            <div className="rounded-xl border bg-background px-3 py-2 text-sm"><span className="font-medium">{s.name}</span>{s.years ? <span className="text-muted-foreground"> · b. {s.years}</span> : null}{s.gotra ? <span className="text-xs text-muted-foreground"> · gotra {s.gotra}</span> : null}</div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
