"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field } from "./fields";
import { visibleSteps, type Answers, type StepDef } from "./steps";

const COMMUNITY_URL = process.env.NEXT_PUBLIC_WA_COMMUNITY_URL; // set in Vercel env when the group exists
const TAIL = ["share", "community", "finish"] as const;
type Tail = (typeof TAIL)[number];

function stepValid(step: StepDef, a: Answers): boolean {
  const instances = step.repeat ? Math.min(Number(a[step.repeat.countKey] || 0), step.repeat.max) : 1;
  for (let i = 0; i < instances; i++) {
    const ns = step.repeat ? `${step.id}.${i}` : step.id;
    for (const f of step.fields) {
      if (!f.required) continue;
      const v = (a[`${ns}.${f.key}`] ?? "").trim();
      if (!v) return false;
      if (f.kind === "contact" && !(v.includes("@") || v.replace(/\D/g, "").length >= 7)) return false;
    }
  }
  return true;
}

export function IntakeFlow() {
  const [answers, setAnswers] = useState<Answers>({});
  const [idx, setIdx] = useState(0);
  const [consent, setConsent] = useState(false);
  const [research, setResearch] = useState(false);
  const [sent, setSent] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const total = steps.length + TAIL.length;
  const onTail = idx >= steps.length;
  const tail: Tail | null = onTail ? TAIL[Math.min(idx - steps.length, TAIL.length - 1)] : null;
  const step = onTail ? null : steps[idx]!;
  const contactIdx = steps.findIndex((s) => s.id === "contact");

  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));

  const go = (i: number) => {
    const n = Math.max(0, Math.min(total - 1, i));
    const target = n < steps.length ? steps[n] : null;
    if (target?.prefill) {
      setAnswers((a) => {
        const next = { ...a };
        for (const [to, from] of Object.entries(target.prefill!)) if (!next[to] && next[from]) next[to] = next[from]!;
        return next;
      });
    }
    setIdx(n);
  };

  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); window.scrollTo(0, 0); }, [idx]);

  const valid = step ? stepValid(step, answers) : true;
  const canSkip = !!step && !step.fields.some((f) => f.required);
  const isFinish = tail === "finish";
  const next = () => { if (valid) go(idx + 1); };

  const you = answers["you.name"]?.split(" ")[0];

  return (
    <div className="flex min-h-dvh flex-col bg-background" ref={top}>
      <header className="sticky top-0 z-20 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-3">
          {idx > 0 ? (
            <button onClick={() => go(idx - 1)} aria-label="Back" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="size-5" /></button>
          ) : (
            <Link href="/" aria-label="Back to home" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="size-5" /></Link>
          )}
          <div className="flex-1">
            <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={idx + 1} className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }} />
            </div>
          </div>
          <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{idx + 1} of {total}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-48 pt-6">
        {step && (
          <section key={step.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">{step.section}</p>
            <h1 className="font-display mt-1 text-2xl font-semibold leading-snug sm:text-3xl">{step.title}</h1>
            {step.helper && <p className="mt-2 text-muted-foreground">{step.helper}</p>}
            <div className="mt-6 space-y-5">
              {step.repeat
                ? Array.from({ length: Math.min(Number(answers[step.repeat.countKey] || 0), step.repeat.max) }, (_, i) => (
                    <div key={i} className="space-y-4 rounded-2xl border bg-card p-4">
                      <h2 className="font-display text-lg font-semibold">{step.repeat!.noun} {i + 1}</h2>
                      {step.fields.map((f) => (
                        <Field key={f.key} def={f} ns={`${step.id}.${i}`} answers={answers} set={set} />
                      ))}
                    </div>
                  ))
                : step.fields.map((f, i) => (
                    <Field key={f.key} def={f} ns={step.id} answers={answers} set={set} autoFocus={i === 0} />
                  ))}
            </div>
          </section>
        )}

        {tail === "share" && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Wrap-up</p>
            <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">Share with relatives?</h1>
            <p className="mt-2 text-muted-foreground">
              Pick living relatives and send each a WhatsApp message from your own phone, so they can view the tree, correct their details and add their branch.
            </p>
            <div className="mt-6 rounded-2xl border bg-card p-5">
              <Share2 className="mb-2 size-6 text-primary" />
              <p className="font-medium">Invitations arrive on Day 3 of the build.</p>
              <p className="text-sm text-muted-foreground">For now you can skip this and see your tree.</p>
            </div>
          </section>
        )}

        {tail === "community" && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Wrap-up</p>
            <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">Join our WhatsApp community?</h1>
            <p className="mt-2 text-muted-foreground">Optional. Meet others from the Maithil community who are preserving their lineage.</p>
            <div className="mt-6 space-y-3">
              {COMMUNITY_URL ? (
                <Button asChild size="lg" className="h-14 w-full text-base"><a href={COMMUNITY_URL} target="_blank" rel="noreferrer"><MessageCircle /> Join on WhatsApp</a></Button>
              ) : (
                <Button size="lg" className="h-14 w-full text-base" disabled><MessageCircle /> Join on WhatsApp (link coming)</Button>
              )}
            </div>
          </section>
        )}

        {isFinish && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">Last step</p>
            <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">{sent ? "Your tree is ready" : "Save your tree"}</h1>
            {!sent ? (
              <>
                <p className="mt-2 text-muted-foreground">
                  We’ll send {answers["contact.contact"] ? <strong className="text-foreground">{answers["contact.contact"]}</strong> : "you"} a magic link to come back and edit. No password.
                </p>
                <div className="mt-6 space-y-3 rounded-2xl border bg-card p-4 text-sm">
                  <label className="flex gap-3">
                    <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>
                      I understand this is a community genealogy project: the family details I enter join a shared genealogical dataset, and I can ask for my account and tree to be deleted at any time. No marketing; my data is never sold or shared with third parties.
                    </span>
                  </label>
                  <label className="flex gap-3">
                    <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={research} onChange={(e) => setResearch(e.target.checked)} />
                    <span className="text-muted-foreground">(Optional) Keep anonymised gotra / mool / moolgrama patterns for the research dataset if I delete my account.</span>
                  </label>
                </div>
              </>
            ) : (
              <p className="mt-2 text-muted-foreground">
                {you ? `Thank you, ${you}. ` : ""}This is the Day 1 preview, so no message was actually sent and your answers aren’t stored yet. Here is a sample family tree so you can try the templates and PDF export.
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3">
          <div className="flex items-center gap-3">
            {isFinish ? (
              sent ? (
                <Button asChild size="lg" className="h-14 flex-1 text-base"><Link href="/tree">See my tree <ArrowRight /></Link></Button>
              ) : (
                <Button size="lg" className="h-14 flex-1 text-base" disabled={!consent} onClick={() => setSent(true)}><Send /> Send me a link</Button>
              )
            ) : (
              <>
                {canSkip || onTail ? (
                  <button onClick={() => go(idx + 1)} className="px-3 py-3 text-base font-medium text-muted-foreground hover:text-foreground">Skip</button>
                ) : <span className="px-3 py-3 text-base text-transparent select-none" aria-hidden>Skip</span>}
                {tail ? (
                  <Button size="lg" className="h-14 flex-1 text-base" onClick={() => go(idx + 1)}>Next <ArrowRight /></Button>
                ) : (
                  <Button size="lg" className="h-14 flex-1 text-base" disabled={!valid} onClick={next}>Next <ArrowRight /></Button>
                )}
              </>
            )}
          </div>
          {!isFinish && idx > contactIdx && contactIdx >= 0 && (
            <button onClick={() => go(steps.length + TAIL.indexOf("finish"))} className={cn("mt-2 block w-full py-1 text-center text-sm text-muted-foreground underline-offset-4 hover:underline")}>
              Save &amp; finish later
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

