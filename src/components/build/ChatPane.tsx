"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CornerUpLeft, ExternalLink, Loader2, MessageCircle, Mic, MicOff, Send, Undo2, X } from "lucide-react";
import { DATE_PLACEHOLDER, DATE_PLACEHOLDER_HI, GOTRA_SOURCES, HINT, HINT_HI } from "@/lib/help";
import type { SugSet } from "@/lib/chips";
import type { Bundle, HAnswer } from "@/lib/household";
import { HouseholdCard } from "./HouseholdCard";
import { cn } from "@/lib/utils";
import { hiRel, hiSection, quickLabel, tr, type Lang } from "@/lib/hi";

export interface ChatMessage {
  id: string; role: "user" | "assistant"; text: string; quick?: string[];
  /** assistant: the question this message asks. Replying to it adds to / corrects that answer. */
  goalId?: string;
  /** assistant: the people this answer added to the tree (shown as "Added X — your father · See in tree") */
  added?: { id: string; name: string; role: string }[];
  /** user: the question this message answered (so replying to your own answer works too) */
  answeredGoal?: string;
  /** user: the message this was a reply to, shown as a quote inside the bubble like WhatsApp */
  replyTo?: { author: string; quote: string; msgId?: string; mode?: "add" | "replace" };
}
/** the earlier message the next answer is a reply to */
export interface ReplyCtx { goalId: string; title: string; quote: string; mode: "add" | "replace"; /** fixed list steps can add or replace; opening questions can only be corrected */ isList: boolean; author: string; msgId?: string }

const authorOf = (m: ChatMessage) => (m.role === "user" ? "You" : "Panji Sahayak");

/** WhatsApp-style: swipe a bubble to the right (touch), right-click, press-and-hold, or tap the ↩ button */
function Bubble({ m, onReply }: { m: ChatMessage; onReply: (m: ChatMessage) => void }) {
  const mine = m.role === "user";
  const [dx, setDx] = useState(0);
  const st = useRef<{ x: number; y: number; id: number; t?: ReturnType<typeof setTimeout>; moved: boolean } | null>(null);
  const end = () => { if (st.current?.t) clearTimeout(st.current.t); st.current = null; setDx(0); };
  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, t: setTimeout(() => { if (st.current && !st.current.moved) { st.current.t = undefined; onReply(m); end(); } }, 550) };
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current; if (!s) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (Math.hypot(ddx, ddy) > 10) { s.moved = true; if (s.t) { clearTimeout(s.t); s.t = undefined; } }
    if (s.moved && ddx > 0 && Math.abs(ddy) < 40) setDx(Math.min(ddx, 80));
  };
  const up = (e: React.PointerEvent) => { const s = st.current; if (s && e.clientX - s.x > 64 && Math.abs(e.clientY - s.y) < 40) onReply(m); end(); };
  const btn = (
    <button type="button" onClick={() => onReply(m)} aria-label={`Reply to this message from ${authorOf(m)}`}
      className="grid size-9 shrink-0 place-items-center self-center rounded-full text-muted-foreground opacity-70 hover:bg-secondary hover:opacity-100 focus-visible:opacity-100"><CornerUpLeft className="size-[18px]" /></button>
  );
  return (
    <div id={`msg-${m.id}`} className={cn("group flex items-end gap-1 rounded-2xl transition-colors", mine ? "flex-row-reverse" : "flex-row")}>
      <div onContextMenu={(e) => { e.preventDefault(); onReply(m); }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={end}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cn("max-w-[84%] rounded-2xl px-4 py-3 text-[17px] leading-relaxed [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
        {m.replyTo && (
          <button type="button" onClick={() => { const el = m.replyTo?.msgId && document.getElementById(`msg-${m.replyTo.msgId}`); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("bg-primary/10"); setTimeout(() => el.classList.remove("bg-primary/10"), 1200); } }}
            className={cn("mb-2 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left text-sm", mine ? "border-white/70 bg-white/15 text-primary-foreground" : "border-primary bg-secondary")}>
            <span className="block text-xs font-semibold">{m.replyTo.author}{m.replyTo.mode === "replace" ? " · replacing" : m.replyTo.mode === "add" ? " · adding to" : ""}</span>
            <span className="line-clamp-2 whitespace-pre-wrap opacity-90">{m.replyTo.quote}</span>
          </button>
        )}
        <span className="whitespace-pre-wrap">{m.text}</span>
      </div>
      {btn}
    </div>
  );
}

/* Web Speech API (Chrome, Edge, Android, Safari). Hindi works well; Maithili is not supported, so we offer Hindi + English. */
type SRResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SR = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: SRResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const getSR = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** what is offered next to the current question */
export interface QuestionHelp {
  kind?: "gotra" | "mool";
  moolUrl?: string;
  /** WhatsApp link that asks a relative this question */
  askUrl?: string;
  /** "Answer later" — only for optional questions about yourself */
  onLater?: () => void;
  /** things skipped earlier that can still be filled in */
  still?: { label: string; onOpen: () => void }[];
  /** buttons that fill in a common answer (the typing box stays) */
  suggest?: { title: string; set: SugSet; moreLabel: string };
  /** a short plain answer to "what is this?", already in the chosen language */
  what?: { q: string; a: string };
  /** a date is being asked for: show the format and a small date picker */
  date?: boolean;
  /** the tree is complete: offer to add a photo */
  onPhoto?: () => void;
  /** several questions about one household answered together on one card */
  household?: { bundle: Bundle; onSubmit: (answers: HAnswer[]) => void };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

/** optional: choose day, month and year instead of typing. Sends DD.MM.YYYY, or just the year. */
function DatePicker({ lang, onUse }: { lang: Lang; onUse: (text: string) => void }) {
  const [d, setD] = useState(""); const [m, setM] = useState(""); const [y, setY] = useState("");
  const year = /^\d{4}$/.test(y) && +y >= 1800 && +y <= new Date().getFullYear() ? y : "";
  const partial = (!!d || !!m) && !(d && m);
  const ok = !!year && !partial;
  const text = ok ? (d && m ? `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${year}` : year) : "";
  const sel = "h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-[16px]";
  return (
    <details className="mb-2 rounded-xl border bg-secondary/40 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-primary">{tr(lang, "Pick a date")}</summary>
      <div className="mt-2 flex gap-2">
        <select aria-label={tr(lang, "Day")} value={d} onChange={(e) => setD(e.target.value)} className={sel}>
          <option value="">{tr(lang, "Day")}</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
        </select>
        <select aria-label={tr(lang, "Month")} value={m} onChange={(e) => setM(e.target.value)} className={cn(sel, "flex-[1.6]")}>
          <option value="">{tr(lang, "Month")}</option>{(lang === "hi" ? MONTHS_HI : MONTHS).map((n, i) => <option key={n} value={String(i + 1)}>{n}</option>)}
        </select>
        <input aria-label={tr(lang, "Year")} placeholder={tr(lang, "Year")} inputMode="numeric" maxLength={4} value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, ""))} className={cn(sel, "flex-1")} />
      </div>
      <button type="button" disabled={!ok} onClick={() => { onUse(text); setD(""); setM(""); setY(""); }}
        className="mt-2 h-11 w-full rounded-lg bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-40">{d && m ? tr(lang, "Use this date") : tr(lang, "Only the year")}{text ? ` · ${text}` : ""}</button>
    </details>
  );
}

/** a few common answers as buttons; the rest of the list sits behind one more button */
function Suggest({ s, lang, onPick }: { s: NonNullable<QuestionHelp["suggest"]>; lang: Lang; onPick: (send: string, label: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? [...s.set.top, ...s.set.rest] : s.set.top;
  return (
    <div className="mb-2" aria-label={s.title}>
      <p className="mb-1.5 text-sm text-muted-foreground">{s.title}</p>
      <div className={cn("flex flex-wrap gap-2", all && "max-h-44 overflow-y-auto rounded-xl border bg-secondary/30 p-2")}>
        {shown.map((x) => (
          <button key={x.label + x.send} type="button" onClick={() => onPick(x.send, lang === "hi" ? x.labelHi : x.label)} className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-[15px] font-medium text-primary active:bg-primary/15"><span lang={lang === "hi" ? "hi" : undefined}>{lang === "hi" ? x.labelHi : x.label}</span></button>
        ))}
        {s.set.rest.length > 0 && <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className="rounded-full border px-3.5 py-1.5 text-[15px] font-medium text-muted-foreground hover:bg-secondary">{all ? tr(lang, "Fewer") : `${s.moreLabel} ▾`}</button>}
      </div>
    </div>
  );
}

export function ChatPane({ messages, busy, onSend, section, mode, className, reply, onReply, onMode, onClearReply, canUndo, onUndo, help, lang = "en", onLang, onSeeInTree, dense }: {
  lang?: Lang; onLang?: (l: Lang) => void;
  messages: ChatMessage[]; busy: boolean; onSend: (text: string, display?: string) => void; section?: string; mode?: "ai" | "basic"; className?: string;
  reply?: ReplyCtx | null; onReply?: (m: ChatMessage) => void; onMode?: (m: "add" | "replace") => void; onClearReply?: () => void;
  canUndo?: boolean; onUndo?: () => void; help?: QuestionHelp;
  /** show a person in the tree (a "See in tree" button under an answer) */
  onSeeInTree?: (id: string) => void;
  /** short screens (a phone with the tree strip above): fewer banners, a shorter helper area */
  dense?: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [vlang, setVlang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [canVoice, setCanVoice] = useState(false);
  const [tip, setTip] = useState(false);
  const [hint, setHint] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("maithil-panji.hint.v1")) setHint(false); } catch { /* ignore */ } }, []);
  useEffect(() => { try { setTip(!localStorage.getItem("maithil-panji.replytip.v1")); } catch { /* ignore */ } }, []);
  const end = useRef<HTMLDivElement>(null);
  const rec = useRef<SR | null>(null);
  useEffect(() => setCanVoice(!!getSR()), []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages.length, busy]);

  const last = messages[messages.length - 1];
  const [typedFor, setTypedFor] = useState("");
  const card = !busy && !reply && last?.role === "assistant" && help?.household && typedFor !== help.household.bundle.goalId ? help.household : null;
  const quick = !busy && !reply && !card && last?.role === "assistant" ? last.quick ?? [] : [];
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);

  const submit = (v = text, display?: string) => {
    const t = v.trim();
    if (!t || busy) return;
    setText("");
    onSend(t, display);
  };
  useEffect(() => setVlang(lang === "hi" ? "hi-IN" : "en-IN"), [lang]);
  const toggleMic = () => {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = getSR();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = vlang; r.interimResults = false;
    r.onresult = (e) => setText((p) => (p ? p + " " : "") + e.results[0]![0]!.transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  };

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden bg-background", className)} aria-label="Family interview chat">
      <div className="border-b bg-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold leading-tight">Panji Sahayak <span lang="hi" className="text-muted-foreground">· पञ्जी सहायक</span></h2>
          {mode && <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", mode === "ai" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground")}>{mode === "ai" ? "AI assistant" : "Simple mode"}</span>}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">{section ? `${lang === "hi" ? hiSection(section) : section} · ` : ""}{lang === "hi" ? "मैं केवल आपकी वंशावली में मदद करता हूँ" : "I only help with your family tree"}</p>
          {onLang && (
            <div role="radiogroup" aria-label="Language of the questions" className="flex shrink-0 overflow-hidden rounded-full border text-xs font-medium">
              {([["en", "English"], ["hi", "हिन्दी"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={lang === v} onClick={() => onLang(v)} className={cn("px-3 py-1.5", lang === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {hint && !dense && messages.length <= 6 && (
        <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <p className="min-w-0 flex-1"><strong>{HINT}</strong> <span lang="hi" className="text-amber-900/80">{HINT_HI}</span> Questions about gotra or mool? Just type them here, or <a href="/faq" target="_blank" rel="noopener" className="font-medium underline">read the answers</a> (<a href="/faq?lang=hi" target="_blank" rel="noopener" lang="hi" className="underline">हिन्दी</a>).</p>
          <button type="button" aria-label="Hide this hint" onClick={() => { setHint(false); try { localStorage.setItem("maithil-panji.hint.v1", "1"); } catch { /* ignore */ } }} className="shrink-0 rounded-full p-1 text-amber-900/70 hover:bg-amber-100"><X className="size-4" /></button>
        </div>
      )}
      {tip && !dense && messages.length > 3 && (
        <div className="flex items-start gap-2 border-b bg-primary/5 px-4 py-2 text-sm">
          <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1">Forgot something, or typed it wrong? <strong>Swipe any message to the right</strong> (or tap ↩, or right-click it) to reply to it and add or correct your answer.</p>
          <button type="button" aria-label="Hide this tip" onClick={() => { setTip(false); try { localStorage.setItem("maithil-panji.replytip.v1", "1"); } catch { /* ignore */ } }} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <Bubble m={m} onReply={(x) => onReply?.(x)} />
            {!!m.added?.length && onSeeInTree && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {(m.added.length > 3 ? [{ id: m.added[0]!.id, text: lang === "hi" ? `${m.added.length} लोग जोड़े गए` : `Added ${m.added.length} people` }] : m.added.map((a) => ({ id: a.id, text: lang === "hi" ? `${a.name} — ${hiRel(a.role)}` : a.role === "you" ? `Added ${a.name} (you)` : `Added ${a.name} — ${a.role}` }))).map((a) => (
                  <button key={a.id} type="button" onClick={() => onSeeInTree(a.id)} className="max-w-full truncate rounded-full border border-green-700/30 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-900">✓ {a.text} · {lang === "hi" ? "वंशावली में देखिए" : "See in tree"}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> <span className="text-sm">{tr(lang, "Writing…")}</span></div></div>
        )}
        <div ref={end} />
      </div>

      <div className="border-t bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {reply && (
          <div className="mb-2 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-primary/5 p-2.5" role="group" aria-label="You are replying to an earlier message">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm"><span className="font-semibold text-primary"><CornerUpLeft className="mr-1 inline size-3.5" />Replying to {reply.author} · {reply.title}</span><span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{reply.quote}</span></p>
              <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
            </div>
            {reply.isList ? (
              <>
                <div role="radiogroup" aria-label="What should this reply do?" className="mt-2 grid grid-cols-2 gap-2">
                  {([["add", "Add to this"], ["replace", "Replace this"]] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={reply.mode === v} onClick={() => onMode?.(v)}
                      className={cn("h-10 rounded-lg border text-sm font-medium", reply.mode === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{l}</button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{reply.mode === "replace" ? "Your new answer replaces what was entered for this question — people added under them are removed too." : "Your answer is added to what is already there. Nothing else changes."}</p>
              </>
            ) : <p className="mt-1.5 text-xs text-muted-foreground">Type the correct answer. Only this one answer is changed.</p>}
          </div>
        )}
        {card && <HouseholdCard key={card.bundle.goalId} bundle={card.bundle} lang={lang} onSubmit={card.onSubmit} onType={() => setTypedFor(card.bundle.goalId)} />}
        <div className={cn("overflow-y-auto overscroll-contain", dense ? "max-h-[26dvh]" : "max-h-[34dvh]", card && "hidden")}>
        {!busy && !reply && help?.suggest && <Suggest s={help.suggest} lang={lang} onPick={(send, label) => submit(send, label)} />}
        {!busy && !reply && help?.what && (
          <details className="mb-2 rounded-xl border bg-secondary/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-primary">{help.what.q}</summary>
            <p className="mt-1.5 text-muted-foreground">{help.what.a}</p>
          </details>
        )}
        {!busy && !reply && help?.date && <DatePicker lang={lang} onUse={(t) => submit(t)} />}
        {!busy && !reply && help?.onPhoto && (
          <button type="button" onClick={help.onPhoto} className="mb-2 flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-[15px] font-medium text-primary"><Camera className="size-4" /> {tr(lang, "Add a photo")}</button>
        )}
        {!busy && !reply && help?.kind === "gotra" && (
          <details className="mb-2 rounded-xl border bg-secondary/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-primary">{tr(lang, "Don’t know your gotra? Where to find it")}</summary>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">{GOTRA_SOURCES.map((x) => <li key={x}>{tr(lang, x)}</li>)}</ul>
          </details>
        )}
        {!busy && !reply && help?.kind === "mool" && help.moolUrl && (
          <p className="mb-2 rounded-xl border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            {tr(lang, "Your mool is tied to your ancestral village. Not sure? Ask an elder, or")}{" "}
            <a href={help.moolUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">{tr(lang, "search for your mool on Google")} <ExternalLink className="size-3.5" /></a>.
          </p>
        )}
        {canUndo && !reply && !busy && (
          <button type="button" onClick={onUndo} className="mb-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"><Undo2 className="size-4" /> {tr(lang, "Undo my last answer")}</button>
        )}
        {!busy && !reply && last?.role === "assistant" && (help?.askUrl || help?.onLater) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {help.askUrl && <a href={help.askUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"><MessageCircle className="size-4" /> {tr(lang, "Ask a relative on WhatsApp")}</a>}
            {help.onLater && <button type="button" onClick={help.onLater} className="rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary">{tr(lang, "Answer later")}</button>}
          </div>
        )}
        {!busy && !reply && !!help?.still?.length && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{tr(lang, "Still to fill in:")}</span>
            {help.still.map((s) => <button key={s.label} type="button" onClick={s.onOpen} className="rounded-full border border-terracotta/40 bg-terracotta/5 px-3 py-1 font-medium text-terracotta">{tr(lang, s.label)}</button>)}
          </div>
        )}
        </div>
        {quick.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" aria-label="Quick replies">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => submit(q, quickLabel(q, lang))} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-[15px] font-medium text-primary active:bg-primary/15">{quickLabel(q, lang)}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
          {canVoice && (
            <div className="flex flex-col items-center gap-0.5">
              <button type="button" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak instead of typing"} aria-pressed={listening}
                className={cn("grid size-12 place-items-center rounded-full border", listening ? "animate-pulse border-terracotta bg-terracotta text-white" : "bg-card text-primary")}>
                {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
              <button type="button" onClick={() => setVlang((v) => (v === "en-IN" ? "hi-IN" : "en-IN"))} className="text-[10px] font-medium text-muted-foreground" aria-label="Voice language">{vlang === "en-IN" ? "EN" : "हिं"}</button>
            </div>
          )}
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={700} enterKeyHint="send" autoComplete="off"
            placeholder={reply ? (lang === "hi" ? "नाम लिखिए…" : "Type the names…") : help?.date ? (lang === "hi" ? DATE_PLACEHOLDER_HI : DATE_PLACEHOLDER) : lang === "hi" ? "अपना उत्तर लिखिए…  हिन्दी / English" : "Type your answer…  English / हिन्दी"} aria-label="Your answer" lang="en"
            className="h-12 min-w-0 flex-1 rounded-full border border-input bg-background px-5 text-[17px] outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20" />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Send className="size-5" /></button>
        </form>
      </div>
    </section>
  );
}
