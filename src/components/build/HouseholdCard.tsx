"use client";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PER_GROUP, type Bundle, type HAnswer, type HKind } from "@/lib/household";
import type { Lang } from "@/lib/hi";

/**
 * One card instead of several questions. Step 1: Yes / No for each group, and a number for every Yes. Step 2: one line per person.
 * Typing a sentence in the chat still works — "Type instead" closes the card.
 */
const T = {
  en: { yes: "Yes", no: "No", howMany: "How many?", next: "Continue", back: "Back", add: "Add to my tree", instead: "Type instead", empty: "Leave a line empty if you do not know the name.", title: "Tap Yes or No", names: "Their names", name: "Name" },
  hi: { yes: "हाँ", no: "नहीं", howMany: "कितने?", next: "आगे बढ़िए", back: "वापस", add: "वंशावली में जोड़िए", instead: "लिखकर बताइए", empty: "जिसका नाम न पता हो, उसकी पंक्ति खाली छोड़ दीजिए।", title: "हाँ या नहीं दबाइए", names: "उनके नाम", name: "नाम" },
} as const;

const Q: Record<Lang, Record<HKind, (me: boolean, n: string) => string>> = {
  en: {
    wife: (me, n) => (me ? "Are you married?" : `Is ${n} married?`),
    sons: (me, n) => (me ? "Do you have sons?" : `Does ${n} have sons?`),
    daughters: (me, n) => (me ? "Do you have daughters?" : `Does ${n} have daughters?`),
    brothers: (me, n) => (me ? "Do you have brothers?" : `Did ${n} have brothers?`),
    sisters: (me, n) => (me ? "Do you have sisters?" : `Did ${n} have sisters?`),
  },
  hi: {
    wife: (me, n) => (me ? "क्या आपका विवाह हो चुका है?" : `क्या ${n} का विवाह हुआ है?`),
    sons: (me, n) => (me ? "क्या आपके पुत्र हैं?" : `क्या ${n} के पुत्र हैं?`),
    daughters: (me, n) => (me ? "क्या आपकी पुत्रियाँ हैं?" : `क्या ${n} की पुत्रियाँ हैं?`),
    brothers: (me, n) => (me ? "क्या आपके भाई हैं?" : `क्या ${n} के भाई थे?`),
    sisters: (me, n) => (me ? "क्या आपकी बहनें हैं?" : `क्या ${n} की बहनें थीं?`),
  },
};
const LINE: Record<Lang, Record<HKind, [string, string]>> = {
  en: { wife: ["Wife’s name", "Wife’s name"], sons: ["Son", "Son’s name"], daughters: ["Daughter", "Daughter’s name"], brothers: ["Brother", "Brother’s name"], sisters: ["Sister", "Sister’s name"] },
  hi: { wife: ["पत्नी", "पत्नी का नाम"], sons: ["पुत्र", "पुत्र का नाम"], daughters: ["पुत्री", "पुत्री का नाम"], brothers: ["भाई", "भाई का नाम"], sisters: ["बहन", "बहन का नाम"] },
};

type Pick = { yes?: boolean; count: number };

export function HouseholdCard({ bundle, lang, onSubmit, onType }: { bundle: Bundle; lang: Lang; onSubmit: (answers: HAnswer[]) => void; onType: () => void }) {
  const t = T[lang];
  const [pick, setPick] = useState<Partial<Record<HKind, Pick>>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [names, setNames] = useState<Partial<Record<HKind, string[]>>>({});
  const get = (k: HKind): Pick => pick[k] ?? { count: 1 };
  const set = (k: HKind, v: Partial<Pick>) => setPick((p) => ({ ...p, [k]: { ...get(k), ...v } }));
  const yesGroups = bundle.groups.filter((k) => get(k).yes);
  const allAnswered = bundle.groups.every((k) => get(k).yes !== undefined);
  const count = (k: HKind) => (k === "wife" ? 1 : get(k).count);

  const finish = () => {
    onSubmit(bundle.groups.map((k): HAnswer => {
      if (!get(k).yes) return { kind: k, names: [] };
      const list = (names[k] ?? []).slice(0, count(k));
      return { kind: k, names: list, yesNoNames: !list.some((x) => x.trim()) };
    }));
  };
  const go = () => { if (!yesGroups.length) finish(); else setStep(2); };

  const btn = (on: boolean) => cn("h-11 min-w-[5.5rem] flex-1 rounded-xl border text-base font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card");
  return (
    <div className="mb-2 max-h-[44dvh] overflow-y-auto overscroll-contain rounded-2xl border border-primary/30 bg-primary/5 p-3" role="group" aria-label={t.title}>
      {step === 1 ? (
        <>
          <p className="mb-2 text-sm font-medium text-primary">{t.title}</p>
          <ul className="space-y-3">
            {bundle.groups.map((k) => {
              const p = get(k);
              return (
                <li key={k}>
                  <p className="mb-1.5 text-[16px]" lang={lang === "hi" ? "hi" : undefined}>{Q[lang][k](bundle.owner.isMe, bundle.owner.name)}</p>
                  <div className="flex gap-2" role="radiogroup" aria-label={Q[lang][k](bundle.owner.isMe, bundle.owner.name)}>
                    <button type="button" role="radio" aria-checked={p.yes === true} className={btn(p.yes === true)} onClick={() => set(k, { yes: true })}>{t.yes}</button>
                    <button type="button" role="radio" aria-checked={p.yes === false} className={btn(p.yes === false)} onClick={() => set(k, { yes: false })}>{t.no}</button>
                  </div>
                  {p.yes && k !== "wife" && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{t.howMany}</span>
                      <button type="button" aria-label="−" disabled={p.count <= 1} onClick={() => set(k, { count: p.count - 1 })} className="grid size-11 place-items-center rounded-full border bg-card disabled:opacity-40"><Minus className="size-5" /></button>
                      <span className="w-8 text-center text-xl font-semibold" aria-live="polite">{p.count}</span>
                      <button type="button" aria-label="+" disabled={p.count >= MAX_PER_GROUP} onClick={() => set(k, { count: p.count + 1 })} className="grid size-11 place-items-center rounded-full border bg-card disabled:opacity-40"><Plus className="size-5" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" disabled={!allAnswered} onClick={go} className="h-12 flex-1 rounded-xl bg-primary text-base font-medium text-primary-foreground disabled:opacity-40">{t.next}</button>
            <button type="button" onClick={onType} className="h-12 rounded-xl px-3 text-sm font-medium text-muted-foreground underline underline-offset-2">{t.instead}</button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm font-medium text-primary">{t.names}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t.empty}</p>
          <div className="space-y-3">
            {yesGroups.map((k) => (
              <div key={k} className="space-y-2">
                {Array.from({ length: count(k) }, (_, i) => (
                  <input key={i} value={names[k]?.[i] ?? ""} maxLength={80} autoComplete="off" enterKeyHint="next" lang="en"
                    autoFocus={k === yesGroups[0] && i === 0}
                    aria-label={k === "wife" ? LINE[lang][k][1] : `${LINE[lang][k][0]} ${i + 1}`}
                    placeholder={k === "wife" ? LINE[lang][k][1] : `${LINE[lang][k][1]}${count(k) > 1 ? ` ${i + 1}` : ""}`}
                    onChange={(e) => setNames((n) => { const arr = [...(n[k] ?? [])]; arr[i] = e.target.value; return { ...n, [k]: arr }; })}
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-[17px] outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20" />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="h-12 rounded-xl border px-4 text-base font-medium">{t.back}</button>
            <button type="button" onClick={finish} className="h-12 flex-1 rounded-xl bg-primary text-base font-medium text-primary-foreground">{t.add}</button>
          </div>
        </>
      )}
    </div>
  );
}
