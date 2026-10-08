import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, GitMerge, Languages, ListChecks, Network, Printer, Sparkles, Sprout, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Motif, PatternBand } from "@/components/landing/Motif";
import { AuthLink, StartLink } from "@/components/account/AuthLink";
import { StickyStart } from "@/components/landing/StickyStart";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ORG_NAME } from "@/lib/site";

const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Warm, formal, built for printing.", img: "/templates/classic.png" },
  { id: "madhubani", name: "Mithila Madhubani", blurb: "Fish, lotus, sun and parrot in the Mithila hand.", img: "/templates/madhubani.png" },
  { id: "minimal", name: "Modern Minimal", blurb: "Thin lines, lots of whitespace.", img: "/templates/minimal.png" },
] as const;

const STEPS = [
  { icon: ListChecks, title: "Chat with our assistant", text: "A friendly interviewer asks one question at a time — in English, Hindi or Hinglish. Skip anything you don’t know." },
  { icon: Sprout, title: "Watch your tree grow", text: "Your Panji-style tree appears as you talk. Tap anyone to correct details or add a photo, and pick a style." },
  { icon: Printer, title: "Download and share", text: "A print-ready PDF in A3 or A4, and a WhatsApp invite so relatives can join your tree with their own mobile number." },
];

/** the one thing we want every visitor to do — large, high-contrast, and repeated on phones in a bar that stays on screen */
function Cta({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <Button asChild size="lg" className={`h-16 rounded-xl px-8 text-lg font-semibold shadow-lg ring-offset-2 transition-transform hover:-translate-y-0.5 ${onDark ? "bg-cream text-indigo hover:bg-white" : "bg-terracotta text-white hover:bg-terracotta/90"} ${className ?? ""}`}>
      <StartLink>Start building your family tree <ArrowRight className="size-5" /></StartLink>
    </Button>
  );
}

const NOW = [
  { icon: GitMerge, title: "Find the same family, entered twice", text: "If you agree, we compare your tree with others that have the same gotra and mool, and show how alike they are. You can preview them and ask the other owner to get in touch." },
  { icon: Users, title: "Trees joined through daughters", text: "A daughter belongs to her father’s tree and to her husband’s. Confirm the match and the two trees are linked, so families can see how they are related." },
  { icon: Network, title: "How are we connected?", text: "Once trees are linked, see your path to another family: through whom, and in how many steps. Only families who chose to take part appear." },
] as const;

const SOON = [
  { icon: BookOpen, title: "The digitised Panji records", text: "We are working with Panjikars to convert the traditional records into a searchable form, so your family can find its place in them." },
  { icon: Languages, title: "Maithili in the chat", text: "Questions in Hindi are here today. Maithili is next, once native speakers have reviewed the wording." },
  { icon: Sparkles, title: "Richer family profiles", text: "Pravar, native village and more, so relatives can recognise each other. This part is live now for signed-in families, and we will keep growing it." },
] as const;

export default function Home() {
  return (
    <div className="min-h-dvh bg-background pb-24 sm:pb-0">
      {/* Hero */}
      <section className="relative overflow-hidden bg-wash">
        <PatternBand className="absolute inset-x-0 top-0" />
        <AuthLink />
        <Motif name="sun" className="pointer-events-none absolute right-4 top-7 size-16 opacity-90 sm:right-10 sm:top-10 sm:size-44" />
        <Motif name="fish" className="pointer-events-none absolute bottom-6 left-4 size-16 opacity-90 sm:left-10 sm:size-32" />
        <div className="relative mx-auto max-w-4xl px-5 pb-28 pt-28 text-center sm:pb-24 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">Maithil Panji <span className="text-indigo/50">·</span> by {ORG_NAME}</p>
          <h1 className="font-display mt-3 text-4xl font-bold leading-tight text-indigo sm:text-6xl">
            Preserve your Maithil ancestry.
            <br />Build a tree. Join the lineage.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-indigo/80">
            A free community project built around the Panji Prabandh tradition: gotra, mool and pravara are first-class, not footnotes.
          </p>
          <div id="hero-cta" className="mt-8 flex justify-center"><Cta /></div>
          <p className="mt-3 text-sm font-medium text-indigo/80">Free · you can start right now — no sign-up</p>
          <p className="mt-2 text-sm"><Link href="/sample" className="font-medium text-terracotta underline underline-offset-4 hover:text-terracotta/80">Not sure yet? View a sample family tree</Link></p>
          <p className="mx-auto mt-6 max-w-xl text-indigo/70">
            Chat with our assistant on your phone, watch your tree grow, print and frame it, and invite relatives to add their own branches.
          </p>
          <p className="mt-2 text-sm text-indigo/70">No marketing. Your data is never sold or shared.</p>
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

      {/* What is already here */}
      <section className="mx-auto max-w-5xl px-5 py-14" aria-labelledby="now">
        <h2 id="now" className="font-display text-2xl font-semibold sm:text-3xl">More than a tree</h2>
        <p className="mt-1 text-muted-foreground">Families who sign in can find each other. It is off until you switch it on, and nothing is linked without your yes.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {NOW.map((c) => (
            <li key={c.title} className="rounded-2xl border bg-card p-5">
              <c.icon className="size-6 text-terracotta" />
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Coming soon */}
      <section className="border-t bg-secondary/40" aria-labelledby="soon">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 id="soon" className="font-display text-2xl font-semibold sm:text-3xl">Coming soon</h2>
          <p className="mt-1 text-muted-foreground">What {ORG_NAME} is building next. Your tree today becomes the starting point for these.</p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {SOON.map((c) => (
              <li key={c.title} className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
                <div className="flex items-center justify-between">
                  <c.icon className="size-6 text-terracotta" />
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Coming soon</span>
                </div>
                <h3 className="mt-3 font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative overflow-hidden bg-indigo text-cream">
        <Motif name="lotus" className="pointer-events-none absolute -left-6 -top-4 size-28 opacity-20" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold sm:text-4xl">Your family’s story, in your family’s tradition.</h2>
          <div className="mt-6 flex justify-center">
            <Cta onDark />
          </div>
        </div>
      </section>
      <SiteFooter dark />

      {/* phones: the main action stays in reach once the hero button has scrolled away */}
      <StickyStart watch="hero-cta"><Cta className="h-14 w-full text-base" /></StickyStart>
    </div>
  );
}
