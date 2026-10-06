"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Download, GitMerge, MessageCircle, Network, RotateCcw, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ExportSheet } from "@/components/tree/ExportSheet";
import { cn } from "@/lib/utils";
import { applyOps, emptyFamily, toFamilyData, type DFamily, type Gender, type Pending, type PersonFields, type RelationSpec } from "@/lib/family";
import { mergeFamilies } from "@/lib/merge";
import { registerExtras, type ExtraRef } from "@/lib/lookup";
import { romanToDevanagari } from "@/lib/translit";
import { nextGoal } from "@/lib/interview";
import type { TemplateId } from "@/lib/types";
import { ChatPane, type ChatMessage } from "./ChatPane";
import { LiveTree, type LiveTreeHandle } from "./LiveTree";
import { HelperPane } from "./HelperPane";
import { MatchesPane } from "./MatchesPane";
import { PersonEditSheet } from "./PersonEditSheet";
import { ShareSheet } from "./ShareSheet";
import { useShare } from "./useShare";
import { useAccount } from "@/components/account/useAccount";

const KEY = "maithil-panji.session.v1";
type Tab = "chat" | "tree" | "matches";
interface Session { family: DFamily; messages: ChatMessage[]; goalId?: string; section?: string; repeats: number; template: TemplateId; pending?: Pending }

const uid = () => Math.random().toString(36).slice(2, 10);
const GREETING = "Namaste! I will help you record your family’s lineage, one simple question at a time. You can answer in English, Hindi or Hinglish — and skip anything you don’t know.";
const firstMessage = (): { messages: ChatMessage[]; goalId?: string; section?: string } => {
  const g = nextGoal(emptyFamily());
  return { messages: [{ id: uid(), role: "assistant", text: `${GREETING}\n\n${g?.question ?? ""}`, quick: [] }], goalId: g?.id, section: g?.section };
};

/** photos and phone numbers never go to the chat server */
const stripPrivate = (f: DFamily): DFamily => ({ ...f, persons: f.persons.map((p) => ({ ...p, photo: undefined, whatsapp: undefined })) });
const WELCOME_BACK = "Welcome back! Let’s carry on with your family tree.";

function useIsDesktop() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setV(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

const TEMPLATE_KEY = "maithil-panji.template.v1";

/** treeId set → the signed-in account's own tree (opened from /app); otherwise the guest builder that lives in this browser */
export function BuildApp({ treeId }: { treeId?: string } = {}) {
  const router = useRouter();
  const auth = useAccount();
  const inAccount = !!treeId;
  const desktop = useIsDesktop();
  const [ready, setReady] = useState(false);
  const [family, setFamily] = useState<DFamily>(emptyFamily());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [goalId, setGoalId] = useState<string | undefined>();
  const [section, setSection] = useState<string | undefined>();
  const [repeats, setRepeats] = useState(0);
  const [pending, setPending] = useState<Pending | undefined>();
  const [template, setTemplate] = useState<TemplateId>("madhubani");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "basic" | undefined>();
  const [tab, setTab] = useState<Tab>("chat");
  const [unseen, setUnseen] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState<string | undefined>();
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tree = useRef<LiveTreeHandle>(null);
  const famRef = useRef(family); famRef.current = family;
  const sh = useShare(family, setFamily, ready, { treeId });
  const isHelper = sh.share?.role === "editor";

  /* restore / persist on this device (the shared online copy is handled by useShare) */
  useEffect(() => {
    if (inAccount) {
      // the tree itself comes from the server; only the style choice is remembered on this device
      try { const t = localStorage.getItem(TEMPLATE_KEY); if (t === "classic" || t === "madhubani" || t === "minimal") setTemplate(t); } catch { /* ignore */ }
      const f = firstMessage(); setMessages(f.messages); setGoalId(f.goalId); setSection(f.section);
      setReady(true); return;
    }
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Session | null;
      if (s?.family?.persons && s.messages?.length) {
        setFamily(s.family); setMessages(s.messages); setGoalId(s.goalId); setSection(s.section); setRepeats(s.repeats ?? 0); setPending(s.pending); setTemplate(s.template ?? "madhubani");
        setReady(true); return;
      }
    } catch { /* ignore */ }
    const f = firstMessage();
    setMessages(f.messages); setGoalId(f.goalId); setSection(f.section);
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    if (inAccount) { try { localStorage.setItem(TEMPLATE_KEY, template); } catch { /* ignore */ } return; } // never overwrite the guest draft with an account tree
    try { localStorage.setItem(KEY, JSON.stringify({ family, messages, goalId, section, repeats, template, pending } satisfies Session)); } catch { /* quota */ }
  }, [ready, inAccount, family, messages, goalId, section, repeats, template, pending]);
  useEffect(() => { fetch("/api/refs").then((r) => r.json()).then((j: { refs: ExtraRef[] }) => registerExtras(j.refs ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    const list: ExtraRef[] = [];
    for (const p of family.persons) for (const k of ["gotra", "mool"] as const) { const r = p[k]; if (r?.custom) list.push({ kind: k, roman: r.roman, dev: r.dev }); }
    if (list.length) registerExtras(list);
  }, [family]);
  /* a tree opened from a link replaces this device's draft; the conversation restarts from where the tree stands */
  useEffect(() => {
    if (!sh.adopted) return;
    const g = nextGoal(famRef.current);
    setMessages([{ id: uid(), role: "assistant", text: g ? `${WELCOME_BACK}\n\n${g.question}` : `${WELCOME_BACK} The tree is complete — tap anyone to correct details, or ask me to change something.`, quick: g?.quick ?? [] }]);
    setGoalId(g?.id); setSection(g?.section); setRepeats(0); setPending(undefined); setTab(g && sh.share?.role === "owner" ? "chat" : "tree");
  }, [sh.adopted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetch("/api/chat").then((r) => r.json()).then((j: { ai: boolean }) => setMode(j.ai ? "ai" : "basic")).catch(() => {}); }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

  const data = useMemo(() => toFamilyData(family), [family]);
  const people = family.persons.length;

  const send = useCallback(async (text: string) => {
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { id: uid(), role: "user", text }]);
    setBusy(true);
    const sent = stripPrivate(famRef.current);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ family: sent, history, text, prevGoalId: goalId, repeats, pending }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Something went wrong.");
      // someone else may have edited the tree while the assistant was thinking: merge instead of overwriting
      const next = mergeFamilies(sent, j.family as DFamily, famRef.current);
      if (next.persons.length !== famRef.current.persons.length && !desktop && tab === "chat") setUnseen((n) => n + 1);
      setFamily(next);
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: j.reply, quick: j.quick }]);
      setGoalId(j.goal?.id); setSection(j.goal?.section); setRepeats(j.repeats ?? 0); setPending(j.pending);
      if (j.mode) setMode(j.mode);
      if (j.notice) setNotice(j.notice);
    } catch (e) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: `${e instanceof Error ? e.message : "I could not reach the server."} Please try sending that again.`, quick: [] }]);
    } finally {
      setBusy(false);
    }
  }, [messages, goalId, repeats, pending, desktop, tab]);

  const saveEdit = (id: string, set: PersonFields) => {
    const ops: Parameters<typeof applyOps>[1] = [{ op: "update_person", id, set: { ...set, name_roman: set.name_roman?.trim() || undefined } }];
    setFamily((f) => applyOps(f, ops).family);
  };
  const deletePerson = (id: string) => setFamily((f) => applyOps(f, [{ op: "remove_person", id }]).family);
  const addRelative = (toId: string, type: RelationSpec["type"], name: string, gender?: Gender) =>
    setFamily((f) => applyOps(f, [{ op: "add_person", name_roman: name, name_dev: romanToDevanagari(name), gender, relation: { type, to: toId } }]).family);
  const rememberPhone = (id: string, e164: string) => setFamily((f) => applyOps(f, [{ op: "update_person", id, set: { whatsapp: e164 } }]).family);
  const reset = () => {
    const f = firstMessage();
    sh.leave();
    setFamily(emptyFamily()); setMessages(f.messages); setGoalId(f.goalId); setSection(f.section); setRepeats(0); setPending(undefined); setSelected(undefined); setResetOpen(false);
  };
  const goTab = (t: Tab) => { setTab(t); if (t === "tree") setUnseen(0); };

  if (inAccount && sh.status === "invalid") return (
    <div className="grid h-dvh place-content-center gap-4 bg-background px-6 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">This tree is not available</h1>
      <p className="max-w-sm text-muted-foreground">{auth.account ? "It may have been deleted, or it was not shared with this mobile number." : "Please sign in with your mobile number to open it."}</p>
      <Button asChild><Link href={auth.account ? "/app" : `/login?next=${encodeURIComponent(`/app/tree/${treeId}`)}`}>{auth.account ? "Go to my trees" : "Sign in"}</Link></Button>
    </div>
  );
  if (!ready || (inAccount && !sh.adopted)) return <div className="grid h-dvh place-items-center bg-background text-muted-foreground">Loading…</div>;

  const leftPane = (cls: string) => isHelper
    ? <HelperPane className={cls} name={sh.share?.memberName} onOpenShare={() => { setInviteFor(undefined); setShareOpen(true); }} ownTreeHref={inAccount ? "/app" : undefined} />
    : <ChatPane className={cls} messages={messages} busy={busy} onSend={send} section={section} mode={mode} />;
  const treePane = <LiveTree ref={tree} family={family} template={template} onTemplate={setTemplate} onSelect={setSelected} className="flex min-h-0 flex-1 flex-col" />;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="z-30 flex items-center gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href={inAccount ? "/app" : "/"} aria-label={inAccount ? "Back to my trees" : "Back to home"} className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><ChevronLeft className="size-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-semibold leading-tight">{data ? `${family.persons.find((p) => p.is_me)?.name_roman.split(" ")[0]}’s family` : "Build your family tree"}</h1>
          <p className="truncate text-xs text-muted-foreground">{people ? `${people} ${people === 1 ? "person" : "people"} · ${sh.share ? (sh.status === "saving" ? "saving…" : sh.status === "offline" ? "offline — will retry" : sh.status === "invalid" ? "link no longer valid" : isHelper ? "shared with you" : `saved online${sh.members.length > 1 ? ` · ${sh.members.length - 1} helper${sh.members.length > 2 ? "s" : ""}` : ""}`) : "saved on this device"}` : "Maithil Panji"}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setInviteFor(undefined); setShareOpen(true); }} aria-label="Share"><Share2 /> <span className="hidden sm:inline">Share</span></Button>
        <Button size="sm" onClick={() => setExportOpen(true)} disabled={!data} aria-label="Download PDF"><Download /> <span className="hidden min-[400px]:inline">PDF</span></Button>
        {!isHelper && !inAccount && <Button size="icon" variant="ghost" onClick={() => setResetOpen(true)} aria-label="Start over"><RotateCcw /></Button>}
      </header>

      {notice && <div role="status" className="border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{notice}</div>}

      {desktop ? (
        <main className="grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)_300px]">
          {leftPane("border-r")}
          {treePane}
          <MatchesPane className="border-l" />
        </main>
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col">
            {tab === "chat" && leftPane("flex-1")}
            {tab === "tree" && treePane}
            {tab === "matches" && <MatchesPane className="flex-1" />}
          </main>
          <nav className="grid grid-cols-3 border-t bg-card pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label="Sections">
            {([["chat", isHelper ? "Welcome" : "Chat", isHelper ? Users : MessageCircle], ["tree", "My tree", Network], ["matches", "Matches", GitMerge]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => goTab(k)} aria-current={tab === k} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium", tab === k ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-5" />{l}
                {k === "tree" && unseen > 0 && <span className="absolute right-[calc(50%-1.6rem)] top-1.5 size-2.5 rounded-full bg-terracotta" aria-label="New people added" />}
                {k === "matches" && <span className="absolute right-[calc(50%-2.3rem)] top-1 rounded-full bg-secondary px-1.5 text-[9px] text-muted-foreground">soon</span>}
              </button>
            ))}
          </nav>
        </>
      )}

      <PersonEditSheet family={family} personId={selected} onClose={() => setSelected(undefined)} onSave={saveEdit} onDelete={deletePerson} onCentre={(id) => tree.current?.centreOn(id)}
        onAdd={addRelative} canInvite={(sh.enabled === true || auth.enabled) && sh.share?.role !== "editor"} onInvite={(id) => { setInviteFor(id); setShareOpen(true); }} />
      {data && <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} data={data} template={template} defaultScope="paternal" />}
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} family={family} enabled={sh.enabled} share={sh.share} status={sh.status} members={sh.members} ownerLink={sh.ownerLink}
        invitePersonId={inviteFor} onCreate={sh.create} onInvite={sh.invite} onRevoke={sh.revoke} onRememberPhone={rememberPhone} onLeave={() => { sh.leave(); setShareOpen(false); }}
        onDeleteOnline={async () => { await sh.deleteOnline(); if (inAccount) router.replace("/app"); }}
        onLeaveTree={async () => { await sh.leaveTree(); router.replace("/app"); }}
        signInHref={auth.enabled && !sh.share ? "/app" : undefined} ownerName={family.persons.find((p) => p.is_me)?.name_roman ?? sh.share?.memberName} />
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Start over">
        <h2 className="font-display text-xl font-semibold">Start over?</h2>
        <p className="mt-1 text-sm text-muted-foreground">This clears the tree and the conversation on this device. It cannot be undone.{sh.share ? " The online copy is not deleted, but this device stops syncing with it — copy your private link from Share first if you want to open it again." : ""}</p>
        <div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>Keep it</Button><Button className="flex-1 bg-terracotta text-white hover:bg-terracotta/90" onClick={reset}>Start over</Button></div>
      </Sheet>
    </div>
  );
}
