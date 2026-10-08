"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, LogOut, Network, Plus, Trees } from "lucide-react";
import { Button } from "@/components/ui/button";
import { familyFor } from "@/lib/new-tree";
import { useAccount } from "./useAccount";

interface TreeItem { id: string; title: string; people: number; updated_at: string; owner: string; members?: number; invitedAs?: string }
interface Lists { mine: TreeItem[]; shared: TreeItem[] }
const DRAFT_KEY = "maithil-panji.session.v1";

/** a family tree somebody started on this device before signing in */
function localDraft(): { family: unknown; people: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    const n = s?.family?.persons?.length ?? 0;
    return n > 1 ? { family: s.family, people: n } : null;
  } catch { return null; }
}
const ago = (iso: string) => {
  const d = Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000;
  return d < 2 ? "just now" : d < 60 ? `${Math.round(d)} min ago` : d < 1440 ? `${Math.round(d / 60)} h ago` : `${Math.round(d / 1440)} days ago`;
};

export function Dashboard() {
  const router = useRouter();
  const auth = useAccount();
  const [lists, setLists] = useState<Lists | null>(null);
  const [draft, setDraft] = useState<{ family: unknown; people: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [complete, setComplete] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/trees", { cache: "no-store" });
    if (res.status === 401) { router.replace("/login?next=/app"); return; }
    if (res.ok) setLists(await res.json());
  }, [router]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.enabled) { router.replace("/build"); return; }
    if (!auth.account) { router.replace("/login?next=/app"); return; }
    load().catch(() => setErr("Could not load your trees. Please refresh."));
    fetch("/api/me/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setComplete(j.complete)).catch(() => {});
    setDraft(localDraft());
  }, [auth.loading, auth.enabled, auth.account, load, router]);

  // arriving from "Save my tree": move the tree built on this device into the account straight away
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (autoDone || !lists || !draft || busy) return;
    if (new URLSearchParams(window.location.search).get("import") !== "1") return;
    setAutoDone(true);
    void create(draft.family, "import");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, draft, busy, autoDone]);

  const create = async (family: unknown, key: string) => {
    setBusy(key); setErr("");
    try {
      const res = await fetch("/api/trees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ family, ownerName: auth.account?.name }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not create the tree.");
      if (key === "import") { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
      router.push(`/app/tree/${j.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not create the tree."); setBusy(""); }
  };
  if (!auth.account || !lists) return <div className="grid h-dvh place-items-center text-muted-foreground">Loading…</div>;
  const first = auth.account.name.split(" ")[0];

  const Row = ({ t, cta }: { t: TreeItem; cta: React.ReactNode }) => (
    <li className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Trees className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg font-semibold leading-tight">{t.title}</div>
        <div className="truncate text-sm text-muted-foreground">{t.people} {t.people === 1 ? "person" : "people"} · updated {ago(t.updated_at)}{t.owner && t.members === undefined ? ` · by ${t.owner}` : ""}{t.members && t.members > 1 ? ` · ${t.members - 1} helper${t.members > 2 ? "s" : ""}` : ""}</div>
      </div>
      {cta}
    </li>
  );
  const open = (id: string) => <Button asChild><Link href={`/app/tree/${id}`}>Open <ArrowRight /></Link></Button>;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji</Link>
          <span className="flex-1" />
          <Link href="/app/profile" className="truncate text-sm font-medium text-indigo underline-offset-4 hover:underline">{auth.account.name}</Link>
          <Button size="sm" variant="outline" onClick={async () => { await auth.logout(); router.replace("/"); }}><LogOut /> Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        <h1 className="font-display text-3xl font-bold text-indigo">Namaste, {first}</h1>
        <Link href="/app/connections" className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-secondary/50">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Network className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">My connections</span><span className="block text-sm text-muted-foreground">See how your family is connected to other families, and through whom.</span></span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        {err && <p role="alert" className="rounded-xl bg-terracotta/10 p-3 text-sm text-terracotta">{err}</p>}
        {complete !== null && complete < 100 && (
          <Link href="/app/profile" className="flex items-center gap-3 rounded-2xl border bg-secondary/50 p-4 hover:bg-secondary">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-sm font-semibold text-primary">{complete}%</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">Complete your profile</span><span className="block text-sm text-muted-foreground">Add your pravar, native village and city so other families can recognise yours.</span></span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        )}

        <section aria-label="My trees" className="space-y-3">
          <h2 className="text-lg font-semibold">My family trees</h2>
          {lists.mine.length > 0 ? <ul className="space-y-3">{lists.mine.map((t) => <Row key={t.id} t={t} cta={open(t.id)} />)}</ul> : (
            <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
              <p className="text-muted-foreground">{lists.shared.length > 0 ? "You are helping with a family tree shared with you (below). If you belong to that family, add your branch there — you do not need a new tree. To record a different family, you can create one of your own." : "You have not started a family tree yet. Our assistant asks one simple question at a time."}</p>
              <Button size="lg" className="mt-4 h-12" disabled={!!busy} onClick={() => create(familyFor(auth.account!.name), "new")}>{busy === "new" ? <Loader2 className="animate-spin" /> : <Plus />} {lists.shared.length > 0 ? "Create a different family tree for me" : "Start my family tree"}</Button>
            </div>
          )}
          {lists.mine.length > 0 && <Button variant="outline" disabled={!!busy} onClick={() => create(familyFor(auth.account!.name), "new")}>{busy === "new" ? <Loader2 className="animate-spin" /> : <Plus />} Start another tree</Button>}
        </section>

        {draft && (
          <section aria-label="Tree on this device" className="rounded-2xl border bg-secondary/50 p-5">
            <h2 className="font-semibold">You have a tree on this device</h2>
            <p className="mt-1 text-sm text-muted-foreground">It has {draft.people} people and is only saved in this browser. Save it to your account to open it anywhere and invite relatives.</p>
            <Button className="mt-3" disabled={!!busy} onClick={() => create(draft.family, "import")}>{busy === "import" ? <Loader2 className="animate-spin" /> : <Plus />} Save it to my account</Button>
          </section>
        )}

        {lists.shared.length > 0 && (
          <section aria-label="Shared with me" className="space-y-3">
            <h2 className="text-lg font-semibold">Shared with me</h2>
            <ul className="space-y-3">{lists.shared.map((t) => <Row key={t.id} t={t} cta={open(t.id)} />)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
