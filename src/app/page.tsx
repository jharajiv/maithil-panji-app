import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ListChecks, Printer, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Motif, PatternBand } from "@/components/landing/Motif";

const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Warm, formal, built for printing.", img: "/templates/classic.png" },
  { id: "madhubani", name: "Mithila Madhubani", blurb: "Fish, lotus, sun and parrot in the Mithila hand.", img: "/templates/madhubani.png" },
  { id: "minimal", name: "Modern Minimal", blurb: "Thin lines, lots of whitespace.", img: "/templates/minimal.png" },
] as const;

const STEPS = [
  { icon: ListChecks, title: "Chat with our assistant", text: "A friendly interviewer asks one question at a time — in English, Hindi or Hinglish. Skip anything you don’t know." },
  { icon: Sprout, title: "Watch your tree grow", text: "Your Panji-style tree appears as you talk. Tap anyone to correct details or add a photo, and pick a style." },
  { icon: Printer, title: "Download and share", text: "A print-ready PDF in A3 or A4, and a WhatsApp invite for relatives." },
];

function Cta({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={`h-14 px-7 text-base ${className ?? ""}`}>
      <Link href="/build">Start building your family tree <ArrowRight /></Link>
    </Button>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-wash">
        <PatternBand className="absolute inset-x-0 top-0" />
        <Motif name="sun" className="pointer-events-none absolute right-4 top-7 size-16 opacity-90 sm:right-10 sm:top-10 sm:size-44" />
        <Motif name="fish" className="pointer-events-none absolute bottom-6 left-4 size-16 opacity-90 sm:left-10 sm:size-32" />
        <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-28 text-center sm:pb-24 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji</p>
          <h1 className="font-display mt-3 text-4xl font-bold leading-tight text-indigo sm:text-6xl">
            Preserve your Maithil ancestry.
            <br />Build a tree. Join the lineage.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-indigo/80">
            A free community project built around the Panji Prabandh tradition: gotra, mool and pravara are first-class, not footnotes.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-indigo/70">
            Chat with our assistant on your phone, watch your tree grow, print and frame it, and invite relatives to add their own branches.
          </p>
          <div className="mt-8"><Cta /></div>
          <p className="mt-3 text-sm text-indigo/70">No marketing. Your data is never sold or shared.</p>
        </div>
        <PatternBand className="absolute inset-x-0 bottom-0" />
      </section>

      {/* Templates */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Three ways to see your family</h2>
        <p className="mt-1 text-muted-foreground">Switch templates any time — your data stays the same.</p>
        <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {TEMPLATES.map((t) => (
            <figure key={t.id} className="w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border bg-card shadow-sm md:w-auto">
              <Image src={t.img} alt={`${t.name} template preview`} width={600} height={800} className="aspect-[3/4] w-full object-cover object-top" />
              <figcaption className="p-4">
                <div className="font-display text-lg font-semibold">{t.name}</div>
                <div className="text-sm text-muted-foreground">{t.blurb}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-secondary/50">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <s.icon className="size-5 text-terracotta" />
                </div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative overflow-hidden bg-indigo text-cream">
        <Motif name="lotus" className="pointer-events-none absolute -left-6 -top-4 size-28 opacity-20" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-4xl">Your family’s story, in your family’s tradition.</h2>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" variant="secondary" className="h-14 px-7 text-base"><Link href="/build">Start building your family tree <ArrowRight /></Link></Button>
          </div>
          <p className="mt-6 text-sm text-cream/70">A community project preserving the Panji Prabandh. Day 1 preview — sample data only.</p>
        </div>
      </section>
    </div>
  );
}
