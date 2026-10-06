"use client";
import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Loader2, Mic, MicOff, Send, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string; role: "user" | "assistant"; text: string; quick?: string[];
  /** assistant: the fixed step this question asks. Such a message can be replied to later (right-click, long-press or the Reply button). */
  goalId?: string;
  /** user: which earlier question this answer was a reply to */
  replyTo?: { title: string; mode: "add" | "replace" };
}
/** the earlier question (or tree box) the next message will be an answer to */
export interface ReplyCtx { goalId: string; title: string; quote: string; mode: "add" | "replace" }

/** long-press (touch) and right-click (mouse) on a bubble → onTrigger */
function useHold(onTrigger: () => void, enabled: boolean) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<[number, number]>([0, 0]);
  const stop = () => { if (t.current) clearTimeout(t.current); t.current = undefined; };
  if (!enabled) return {};
  return {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onTrigger(); },
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === "mouse") return; start.current = [e.clientX, e.clientY]; stop(); t.current = setTimeout(() => { t.current = undefined; onTrigger(); }, 500); },
    onPointerMove: (e: React.PointerEvent) => { if (t.current && Math.hypot(e.clientX - start.current[0], e.clientY - start.current[1]) > 10) stop(); },
    onPointerUp: stop, onPointerCancel: stop,
  };
}

function Bubble({ m, onReply }: { m: ChatMessage; onReply: (m: ChatMessage) => void }) {
  const replyable = m.role === "assistant" && !!m.goalId;
  const hold = useHold(() => onReply(m), replyable);
  return (
    <div className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
      {m.replyTo && (
        <div className="mb-1 max-w-[88%] rounded-lg border-l-4 border-primary/50 bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
          <CornerUpLeft className="mr-1 inline size-3" />Reply to: {m.replyTo.title}{m.replyTo.mode === "replace" ? " · replacing it" : " · adding to it"}
        </div>
      )}
      <div {...hold} className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[17px] leading-relaxed",
        m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card",
        replyable && "[-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none")}>{m.text}</div>
      {replyable && (
        <button type="button" onClick={() => onReply(m)} className="mt-1 flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-primary hover:bg-primary/5" aria-label="Reply to this question, to add or correct what you told me">
          <CornerUpLeft className="size-3.5" /> Reply / correct this
        </button>
      )}
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

export function ChatPane({ messages, busy, onSend, section, mode, className, reply, onReply, onMode, onClearReply, canUndo, onUndo }: {
  messages: ChatMessage[]; busy: boolean; onSend: (text: string) => void; section?: string; mode?: "ai" | "basic"; className?: string;
  reply?: ReplyCtx | null; onReply?: (m: ChatMessage) => void; onMode?: (m: "add" | "replace") => void; onClearReply?: () => void;
  canUndo?: boolean; onUndo?: () => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [vlang, setVlang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [canVoice, setCanVoice] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const rec = useRef<SR | null>(null);
  useEffect(() => setCanVoice(!!getSR()), []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages.length, busy]);

  const last = messages[messages.length - 1];
  const quick = !busy && !reply && last?.role === "assistant" ? last.quick ?? [] : [];
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);

  const submit = (v = text) => {
    const t = v.trim();
    if (!t || busy) return;
    setText("");
    onSend(t);
  };
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
    <section className={cn("flex min-h-0 flex-col bg-background", className)} aria-label="Family interview chat">
      <div className="border-b bg-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold leading-tight">Panji Sahayak <span lang="hi" className="text-muted-foreground">· पञ्जी सहायक</span></h2>
            <p className="text-xs text-muted-foreground">{section ? `${section} · ` : ""}I only help with your family tree</p>
          </div>
          {mode && <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", mode === "ai" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground")}>{mode === "ai" ? "AI assistant" : "Simple mode"}</span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.map((m) => <Bubble key={m.id} m={m} onReply={(x) => onReply?.(x)} />)}
        {busy && (
          <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> <span className="text-sm">Writing…</span></div></div>
        )}
        <div ref={end} />
      </div>

      <div className="border-t bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {reply && (
          <div className="mb-2 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-primary/5 p-2.5" role="group" aria-label="You are replying to an earlier question">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm"><span className="font-semibold text-primary"><CornerUpLeft className="mr-1 inline size-3.5" />Replying to: {reply.title}</span><span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{reply.quote}</span></p>
              <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
            </div>
            <div role="radiogroup" aria-label="What should this reply do?" className="mt-2 grid grid-cols-2 gap-2">
              {([["add", "Add to this"], ["replace", "Replace this"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={reply.mode === v} onClick={() => onMode?.(v)}
                  className={cn("h-10 rounded-lg border text-sm font-medium", reply.mode === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{l}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{reply.mode === "replace" ? "Your new answer replaces what was entered for this question — people added under them are removed too." : "Your answer is added to what is already there. Nothing else changes."}</p>
          </div>
        )}
        {canUndo && !reply && !busy && (
          <button type="button" onClick={onUndo} className="mb-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"><Undo2 className="size-4" /> Undo my last answer</button>
        )}
        {quick.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" aria-label="Quick replies">
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => submit(q)} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-[15px] font-medium text-primary active:bg-primary/15">{q}</button>
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
            placeholder={reply ? "Type the names…" : "Type your answer…  English / हिन्दी"} aria-label="Your answer" lang="en"
            className="h-12 min-w-0 flex-1 rounded-full border border-input bg-background px-5 text-[17px] outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20" />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Send className="size-5" /></button>
        </form>
      </div>
    </section>
  );
}
