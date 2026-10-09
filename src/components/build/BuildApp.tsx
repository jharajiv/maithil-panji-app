"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Download, GitMerge, MessageCircle, MessageSquareWarning, Network, Pencil, RotateCcw, Share2, Users } from "lucide-react";
import { PaagMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ExportSheet } from "@/components/tree/ExportSheet";
import { cn } from "@/lib/utils";
import { applyOps, changeRelation, emptyFamily, toFamilyData, type DFamily, type Gender, type Pending, type PersonFields, type RelationSpec, type RelationWord } from "@/lib/family";
import { mergeFamilies } from "@/lib/merge";
import { registerExtras, type ExtraRef } from "@/lib/lookup";
import { romanToDevanagari } from "@/lib/translit";
import { CORRECTABLE, isListKind, nextGoal, replyGoal } from "@/lib/interview";
import type { TemplateId } from "@/lib/types";
import { ChatPane, type ChatMessage, type QuestionHelp, type ReplyCtx } from "./ChatPane";
import { track } from "@/lib/track";
import { hiGoal, type Lang } from "@/lib/hi";
import { askRelativeUrl, gotraHelpMessage, moolSearchUrl, stillToFill } from "@/lib/help";
import { TreeMenu, type TreeMenuState } from "./TreeMenu";
import { LiveTree, type LiveTreeHandle } from "./LiveTree";
import { FreeformEditor } from "./FreeformEditor";
import { HelperPane } from "./HelperPane";
import { MatchesPane, PreviewBody } from "./MatchesPane";
import { useConnect } from "./useConnect";
import { useSimilar } from "./useSimilar";
import { useSuggestions } from "./useSuggestions";
import { SuggestionsSheet } from "./SuggestionsSheet";
import { ChatRail, PaneDivider, FamiliesRail, usePaneLayout } from "./PaneDivider";
import { PersonEditSheet } from "./PersonEditSheet";
import { ShareSheet } from "./ShareSheet";
import { SavePrompt } from "./SavePrompt";
import { useShare } from "./useShare";
import { useAccount } from "@/components/account/useAccount";

const KEY = "maithil-panji.session.v1";
type Tab = "chat" | "tree" | "matches";
interface Session { family: DFamily; messages: ChatMessage[]; goalId?: string; section?: string; repeats: number; template: TemplateId; pending?: Pending }

/** everything the chat needs to step back one answer */
interface Snap { family: DFamily; messages: ChatMessage[]; goalId?: string; section?: string; repeats: number; pending?: Pending }

/** "Your sisters" / "Ramesh’s sons" / "Your father" — what a reply is about */
function replyTitle(f: DFamily, goalId: string): string {
  const [kind, id] = goalId.split(":");
  const p = f.persons.find((x) => x.id === id) ?? f.persons.find((x) => x.is_me);
  if (!kind || !p) return "an earlier question";
  const poss = p.is_me ? "Your" : `${p.name_roman.split(" ")[0]}’s`;
  const t: Record<string, string> = {
    brothers: `${poss} brothers`, sisters: `${poss} sisters`, wife: `${poss} wife`, husband: `${poss} husband`, sons: `${poss} sons`, daughters: `${poss} daughters`,
    father: `${poss} father`, mother: `${poss} mother`, details: `${poss} details`, self_name: "Your name", self_gender: "Your gender", self_birth: "Your birth date", self_place: "Where you live", gender: `${poss} gender`,
  };
  return t[kind] ?? "an earlier question";
}

const uid = () => Math.random().toString(36).slice(2, 10);
const GREETING = "Namaste! I will help you record your family’s lineage, one simple question at a time. You can answer in English, Hindi or Hinglish — and skip anything you don’t know.";
const GREETING_HI = "नमस्ते! मैं आपकी वंशावली लिखने में मदद करूँगा — एक-एक सरल प्रश्न के साथ। आप अंग्रेज़ी, हिन्दी या हिंग्लिश में उत्तर दे सकते हैं, और जो न पता हो उसे छोड़ सकते हैं।";
const LANG_KEY = "maithil-panji.lang.v1";
const readLang = (): Lang => { try { return localStorage.getItem(LANG_KEY) === "hi" ? "hi" : "en"; } catch { return "en"; } };
/** the question in the chosen language (English when there is no Hindi version) */
const askIn = (f: DFamily, g: { question: string } & Parameters<typeof hiGoal>[1], lang: Lang) => (lang === "hi" ? hiGoal(f, g)?.question ?? g.question : g.question);
const firstMessage = (lang: Lang = readLang()): { messages: ChatMessage[]; goalId?: string; section?: string } => {
  const g = nextGoal(emptyFamily());
  return { messages: [{ id: uid(), role: "assistant", text: `${lang === "hi" ? GREETING_HI : GREETING}\n\n${g ? askIn(emptyFamily(), g, lang) : ""}`, quick: [], goalId: g?.id }], goalId: g?.id, section: g?.section };
};

/** photos and phone numbers never go to the chat server */
const stripPrivate = (f: DFamily): DFamily => ({ ...f, persons: f.persons.map((p) => ({ ...p, photo: undefined, whatsapp: undefined })) });
const WELCOME_BACK = "Welcome back! Let’s carry on with your family tree.";
const WELCOME_BACK_HI = "फिर से स्वागत है! चलिए, आपकी वंशावली आगे बढ़ाते हैं।";

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
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => setLang(readLang()), []);
  const [tab, setTab] = useState<Tab>("chat");
  const [unseen, setUnseen] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [exportOpen, setExportOpen] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState<string | undefined>();
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyCtx, setReplyCtx] = useState<ReplyCtx | null>(null);
  const [undo, setUndo] = useState<Snap[]>([]);
  const [menu, setMenu] = useState<TreeMenuState | null>(null);
  const [relFor, setRelFor] = useState<string | undefined>();
  const layout = usePaneLayout();
  const mainRef = useRef<HTMLElement>(null);
  const afterTurn = useRef("");
  const tree = useRef<LiveTreeHandle>(null);
  const famRef = useRef(family); famRef.current = family;
  const sh = useShare(family, setFamily, ready, { treeId });
  const isHelper = sh.share?.role === "editor";
  const cx = useConnect(sh.share, family, { qs: sh.keyQs, body: sh.keyBody }, sh.refresh, sh.discoverable);
  const simSig = family.persons.length + "|" + (family.persons.find((p) => p.is_me)?.gotra?.roman ?? "") + "|" + (family.persons.find((p) => p.is_me)?.mool?.roman ?? "");
  const sm = useSimilar(sh.share?.treeId, sh.keyQs, sh.share?.role, sh.discoverable, simSig, sh.refresh);
  const sg = useSuggestions(sh.share, { qs: sh.keyQs, body: sh.keyBody }, sh.refresh);
  const [sgOpen, setSgOpen] = useState(false);
  const [see, setSee] = useState<{ person: string; tree: string; p: string; state?: { loading?: boolean; preview?: import("@/lib/connect").Preview; error?: string } } | null>(null);
  const seeLinked = (person: string, tree: string, p: string) => {
    setSee({ person, tree, p, state: { loading: true } });
    cx.preview({ person, tree, p }).then((r) => setSee((c) => (c && c.person === person && c.tree === tree ? { ...c, state: r } : c)));
  };
  const openMatches = () => { if (desktop) { if (layout.soonCollapsed) layout.toggleSoon(); } else setTab("matches"); };

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
    const l = readLang();
    setMessages([{ id: uid(), role: "assistant", text: g ? `${l === "hi" ? WELCOME_BACK_HI : WELCOME_BACK}\n\n${askIn(famRef.current, g, l)}` : `${WELCOME_BACK} The tree is complete — tap anyone to correct details, or ask me to change something.`, quick: g?.quick ?? [], goalId: g?.id }]);
    setGoalId(g?.id); setSection(g?.section); setRepeats(0); setPending(undefined); setTab(g && sh.share?.role === "owner" ? "chat" : "tree");
  }, [sh.adopted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetch("/api/chat").then((r) => r.json()).then((j: { ai: boolean }) => setMode(j.ai ? "ai" : "basic")).catch(() => {}); }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

  useEffect(() => { if (undo.length && JSON.stringify(family) !== afterTurn.current) setUndo([]); }, [family]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = useMemo(() => toFamilyData(family), [family]);
  const stillTo = useMemo(() => stillToFill(family).map((s) => ({ label: s.label, onOpen: () => { const m = family.persons.find((p) => p.is_me); if (m) { setRelFor(undefined); setSelected(m.id); } } })), [family]);
  const people = family.persons.length;

  const send = useCallback(async (text: string, display?: string) => {
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.text }));
    const ctx = replyCtx;
    if (!messages.some((m) => m.role === "user")) track("tree_started", "session");
    const snap: Snap = { family: famRef.current, messages, goalId, section, repeats, pending };
    setMessages((m) => [...m, { id: uid(), role: "user", text: display ?? text, answeredGoal: ctx?.goalId ?? goalId, replyTo: ctx ? { author: ctx.author, quote: ctx.quote, msgId: ctx.msgId, mode: ctx.isList ? ctx.mode : undefined } : undefined }]);
    setBusy(true);
    const sent = stripPrivate(famRef.current);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ family: sent, history, text, prevGoalId: goalId, repeats, pending, answerGoal: ctx?.goalId, mode: ctx?.mode, lang }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Something went wrong.");
      // someone else may have edited the tree while the assistant was thinking: merge instead of overwriting
      const next = mergeFamilies(sent, j.family as DFamily, famRef.current);
      if (next.persons.length !== famRef.current.persons.length && !desktop && tab === "chat") setUnseen((n) => n + 1);
      afterTurn.current = JSON.stringify(next);
      setFamily(next);
      // told us they do not know their gotra: the next message says where to find it
      const nm = next.persons.find((p) => p.is_me);
      const gotraHelp = goalId === "self_gotra" && nm && !nm.gotra && nm.flags.gotra ? `${gotraHelpMessage(lang)}\n\n` : "";
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: `${gotraHelp}${j.reply}`, quick: j.quick, goalId: j.goal?.id as string | undefined }]);
      setGoalId(j.goal?.id); setSection(j.goal?.section); setRepeats(j.repeats ?? 0); setPending(j.pending);
      if (j.ops > 0) setUndo((u) => [...u.slice(-14), snap]);
      if (ctx && j.ops > 0) setReplyCtx(null); // an answer that was not understood keeps the reply open
      if (j.mode) setMode(j.mode);
      if (j.notice) setNotice(j.notice);
    } catch (e) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: `${e instanceof Error ? e.message : "I could not reach the server."} Please try sending that again.`, quick: [] }]);
    } finally {
      setBusy(false);
    }
  }, [messages, goalId, section, repeats, pending, desktop, tab, replyCtx, lang]);

  /** switch the language of the questions; the question now open is asked again in the new language */
  const changeLang = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    const g = famRef.current.persons.length ? nextGoal(famRef.current) : nextGoal(emptyFamily());
    if (!g || isHelper) return;
    const h = l === "hi" ? hiGoal(famRef.current, g) : null;
    setMessages((m) => [...m, { id: uid(), role: "assistant", text: `${l === "hi" ? "ठीक है, अब मैं हिन्दी में पूछूँगा।" : "Okay, I will ask in English now."}\n\n${h?.question ?? g.question}`, quick: g.quick, goalId: g.id }]);
    setGoalId(g.id); setSection(g.section);
  };
  const undoLast = () => {
    const snap = undo[undo.length - 1];
    if (!snap) return;
    afterTurn.current = JSON.stringify(snap.family);
    setUndo((u) => u.slice(0, -1));
    setFamily(snap.family); setMessages(snap.messages); setGoalId(snap.goalId); setSection(snap.section); setRepeats(snap.repeats); setPending(snap.pending); setReplyCtx(null);
    setNotice("Your last answer was undone.");
  };
  /** reply to an earlier message or a tree box: the next answer goes to THAT question */
  const replyTo = (goal: string, quote?: string, who = "Panji Sahayak", msgId?: string) => {
    const kind = goal.split(":")[0]!;
    const g = replyGoal(famRef.current, goal);
    if (kind === "self_gotra" || kind === "self_mool") {
      // gotra and mool are picked from the Panji list in the edit sheet
      const m = famRef.current.persons.find((x) => x.is_me);
      if (m) { setRelFor(undefined); setSelected(m.id); setNotice("Gotra and mool are chosen from the Panji list here."); }
      return;
    }
    if (!g) { setNotice("That earlier message can’t be replied to. Tap the person in the tree to change their details."); return; }
    setReplyCtx({ goalId: goal, title: replyTitle(famRef.current, goal), quote: (quote ?? g.question).slice(0, 220), mode: "add", isList: isListKind(kind) && !CORRECTABLE.has(kind), author: who, msgId });
    setTab("chat");
  };
  const changeRel = (id: string, toId: string, word: RelationWord) => {
    const r = changeRelation(famRef.current, id, toId, word);
    if (r.ok) { afterTurn.current = ""; setFamily(r.family); }
    return { ok: r.ok, message: r.message };
  };

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
    setFamily(emptyFamily()); setMessages(f.messages); setGoalId(f.goalId); setSection(f.section); setRepeats(0); setPending(undefined); setSelected(undefined); setResetOpen(false); setReplyCtx(null); setUndo([]);
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

  const questionHelp: QuestionHelp | undefined = (() => {
    const kind = goalId?.split(":")[0];
    const m = family.persons.find((p) => p.is_me);
    const g = family.persons.length ? nextGoal(family) : null;
    if (!kind || !g || g.id !== goalId) return { still: stillTo };
    return {
      kind: kind === "self_gotra" ? "gotra" : kind === "self_mool" ? "mool" : undefined,
      moolUrl: kind === "self_mool" ? moolSearchUrl(m?.gotra?.roman) : undefined,
      askUrl: kind === "self_name" || kind === "self_gender" ? undefined : askRelativeUrl(lang === "hi" ? hiGoal(family, g)?.question ?? g.question : g.question, lang),
      onLater: g.optional && kind.startsWith("self_") && g.quick[0] ? () => send(g.quick[0]!) : undefined,
      still: stillTo,
    };
  })();
  const matchesProps = { family, online: !!sh.share, role: sh.share?.role, connect: cx, similar: sm, discoverable: sh.discoverable, onDiscoverable: sh.setDiscoverable, activity: sh.activity, onSee: seeLinked, bridgeHref: sh.share ? (tree: string) => `/app/bridge/${sh.share!.treeId}/${tree}${sh.keyQs ? `?${sh.keyQs}` : ""}` : undefined, onOpenShare: () => { setInviteFor(undefined); setShareOpen(true); } };
  const leftPane = (cls: string) => isHelper
    ? <HelperPane className={cls} name={sh.share?.memberName} onOpenShare={() => { setInviteFor(undefined); setShareOpen(true); }} ownTreeHref={inAccount ? "/app" : undefined} />
    : <ChatPane className={cls} messages={messages} busy={busy} onSend={send} section={section} mode={mode}
      reply={replyCtx} onReply={(m) => { const g = m.role === "assistant" ? m.goalId : m.answeredGoal; if (g) replyTo(g, m.text, m.role === "user" ? "You" : "Panji Sahayak", m.id); else setNotice("That older message can’t be replied to. Tap the person in the tree to change their details."); }} onMode={(md) => setReplyCtx((c) => (c ? { ...c, mode: md } : c))} onClearReply={() => setReplyCtx(null)} canUndo={undo.length > 0} onUndo={undoLast} help={questionHelp} lang={lang} onLang={changeLang} />;
  const treePane = <LiveTree ref={tree} family={family} template={template} onTemplate={setTemplate} onSelect={setSelected} onContext={(id, x, y, touch) => setMenu({ id, x, y, touch })} className="flex min-h-0 flex-1 flex-col"
    extra={data ? <Button size="sm" variant="outline" onClick={() => setFreeOpen(true)} aria-label="Edit freely with boxes and connectors"><Pencil /> <span className="hidden min-[420px]:inline">Edit freely</span></Button> : undefined} />;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="z-30 flex items-center gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href={inAccount ? "/app" : "/"} aria-label={inAccount ? "Back to my trees" : "Back to home"} className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><ChevronLeft className="size-5" /></Link>
        <PaagMark size={26} className="hidden shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base font-semibold leading-tight">{data ? `${family.persons.find((p) => p.is_me)?.name_roman.split(" ")[0]}’s family` : "Build your family tree"}</h1>
          <p className="truncate text-xs text-muted-foreground">{people ? `${people} ${people === 1 ? "person" : "people"} · ${sh.share ? (sh.status === "saving" ? "saving…" : sh.status === "offline" ? "offline — will retry" : sh.status === "invalid" ? "link no longer valid" : isHelper ? "shared with you" : `saved online${sh.members.length > 1 ? ` · ${sh.members.length - 1} helper${sh.members.length > 2 ? "s" : ""}` : ""}`) : "saved on this device"}` : "Maithil Panji"}</p>
        </div>
        {sg.list.length > 0 && <Button size="sm" variant="outline" onClick={() => setSgOpen(true)} aria-label={`${sg.list.length} suggested corrections`} className="relative"><MessageSquareWarning /> <span className="hidden sm:inline">Corrections</span><span className="ml-0.5 rounded-full bg-terracotta px-1.5 text-xs font-semibold text-white">{sg.list.length}</span></Button>}
        {people > 0 && <Button size="sm" variant="outline" onClick={() => { setInviteFor(undefined); setShareOpen(true); }} aria-label="Share"><Share2 /> <span className="hidden sm:inline">Share</span></Button>}
        {people > 1 && <Button size="sm" variant="outline" onClick={openMatches} aria-label="Families: connect trees through married women" className="relative hidden md:inline-flex"><GitMerge /> Families{cx.matches.length > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-terracotta" aria-label="Possible matches found" />}</Button>}
        <Button size="sm" onClick={() => setExportOpen(true)} disabled={!data} aria-label="Download PDF"><Download /> <span className="hidden min-[400px]:inline">PDF</span></Button>
        {!isHelper && !inAccount && <Button size="icon" variant="ghost" onClick={() => setResetOpen(true)} aria-label="Start over"><RotateCcw /></Button>}
      </header>

      {!inAccount && ready && !auth.loading && auth.enabled && !sh.share && !exportOpen && !shareOpen && <SavePrompt people={family.persons.length} signedIn={!!auth.account} />}
      {notice && <div role="status" className="border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{notice}</div>}

      {desktop ? (
        <main ref={mainRef} className="flex min-h-0 flex-1">
          {layout.collapsed
            ? <ChatRail onOpen={layout.toggle} />
            : <div style={{ width: layout.width }} className="flex min-h-0 shrink-0 flex-col">{leftPane("flex-1")}</div>}
          <PaneDivider width={layout.width} collapsed={layout.collapsed} container={mainRef} onChange={layout.set} onToggle={() => { layout.toggle(); setTimeout(() => tree.current?.fit(), 60); }} onReset={() => { layout.reset(); setTimeout(() => tree.current?.fit(), 60); }} onSettled={() => tree.current?.fit()} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{treePane}</div>
          <PaneDivider side="right" width={layout.soonWidth} collapsed={layout.soonCollapsed} container={mainRef} onChange={layout.setSoon} onToggle={() => { layout.toggleSoon(); setTimeout(() => tree.current?.fit(), 60); }} onReset={() => { layout.resetSoon(); setTimeout(() => tree.current?.fit(), 60); }} onSettled={() => tree.current?.fit()} />
          {layout.soonCollapsed
            ? <FamiliesRail onOpen={layout.toggleSoon} dot={cx.matches.length > 0} />
            : <div style={{ width: layout.soonWidth }} className="flex min-h-0 shrink-0 flex-col"><MatchesPane className="flex-1" {...matchesProps} /></div>}
        </main>
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col">
            {tab === "chat" && leftPane("flex-1")}
            {tab === "tree" && treePane}
            {tab === "matches" && <MatchesPane className="flex-1" {...matchesProps} />}
          </main>
          <nav className="grid grid-cols-3 border-t bg-card pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label="Sections">
            {([["chat", isHelper ? "Welcome" : "Chat", isHelper ? Users : MessageCircle], ["tree", "My tree", Network], ["matches", "Families", GitMerge]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => goTab(k)} aria-current={tab === k} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium", tab === k ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-5" />{l}
                {k === "matches" && cx.matches.length > 0 && <span className="absolute right-[calc(50%-1.6rem)] top-1.5 size-2.5 rounded-full bg-terracotta" aria-label="Possible matches found" />}
                {k === "tree" && unseen > 0 && <span className="absolute right-[calc(50%-1.6rem)] top-1.5 size-2.5 rounded-full bg-terracotta" aria-label="New people added" />}
              </button>
            ))}
          </nav>
        </>
      )}

      <FreeformEditor open={freeOpen} onClose={() => setFreeOpen(false)} family={family} onFamily={setFamily} onEdit={setSelected} />
      <TreeMenu family={family} menu={menu} onClose={() => setMenu(null)} onChat={(kind, id) => replyTo(`${kind}:${id}`)} onEdit={(id) => { setRelFor(undefined); setSelected(id); }} onChange={(id) => { setRelFor(id); setSelected(id); }} />
      <PersonEditSheet family={family} personId={selected} openRelation={!!selected && relFor === selected} onChangeRelation={changeRel} onClose={() => { setSelected(undefined); setRelFor(undefined); }} onSave={saveEdit} onDelete={deletePerson} onCentre={(id) => tree.current?.centreOn(id)}
        onSeeLinked={seeLinked} bridgeHref={matchesProps.bridgeHref} hasMatch={!!selected && cx.matches.some((m) => m.person === selected)} onOpenMatches={openMatches}
        onAdd={addRelative} canInvite={(sh.enabled === true || auth.enabled) && sh.share?.role !== "editor"} onInvite={(id) => { setInviteFor(id); setShareOpen(true); }} />
      {data && <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} data={data} template={template} defaultScope="all" viewUrl={sh.viewUrl || undefined} saveHref={auth.enabled && !sh.share ? `/login?next=${encodeURIComponent("/app?import=1")}` : undefined} />}
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} family={family} enabled={sh.enabled} share={sh.share} status={sh.status} members={sh.members} ownerLink={sh.ownerLink}
        invitePersonId={inviteFor} onCreate={sh.create} onInvite={sh.invite} onRevoke={sh.revoke} onRememberPhone={rememberPhone} onLeave={() => { sh.leave(); setShareOpen(false); }}
        onDeleteOnline={async () => { await sh.deleteOnline(); if (inAccount) router.replace("/app"); }}
        onLeaveTree={async () => { await sh.leaveTree(); router.replace("/app"); }}
        viewUrl={sh.viewUrl} viewUrlFull={sh.viewUrlFull} viewOff={sh.viewOff} onViewLink={sh.viewLink} discoverable={sh.discoverable} onDiscoverable={sh.share?.role === "owner" ? sh.setDiscoverable : undefined} signInHref={auth.enabled && !sh.share ? "/app" : undefined} ownerName={family.persons.find((p) => p.is_me)?.name_roman ?? sh.share?.memberName} />
      <SuggestionsSheet open={sgOpen} onClose={() => setSgOpen(false)} family={family} sg={sg} onEdit={(id) => { setRelFor(undefined); setSelected(id); }} />
      <Sheet open={!!see} onClose={() => setSee(null)} title="Her family in the other tree">
        <h2 className="font-display text-xl font-semibold">Her family in the other tree</h2>
        <div className="mt-3">
          {see?.state?.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground">Loading…</p>}
          {see?.state?.error && <p role="alert" className="text-sm text-terracotta">{see.state.error}</p>}
          {see?.state?.preview && <PreviewBody preview={see.state.preview} />}
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => setSee(null)}>Close</Button>
      </Sheet>
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Start over">
        <h2 className="font-display text-xl font-semibold">Start over?</h2>
        <p className="mt-1 text-sm text-muted-foreground">This clears the tree and the conversation on this device. It cannot be undone.{sh.share ? " The online copy is not deleted, but this device stops syncing with it — copy your private link from Share first if you want to open it again." : ""}</p>
        <div className="mt-4 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>Keep it</Button><Button className="flex-1 bg-terracotta text-white hover:bg-terracotta/90" onClick={reset}>Start over</Button></div>
      </Sheet>
    </div>
  );
}
