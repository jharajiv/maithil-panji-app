import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GitMerge, Globe2, ListChecks, Lock, Network, Printer, Sprout, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatternBand } from "@/components/landing/Motif";
import { AuthLink, StartLink } from "@/components/account/AuthLink";
import { StickyStart } from "@/components/landing/StickyStart";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ORG_NAME } from "@/lib/site";
import { PaagLogo } from "@/components/brand/Logo";

const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Warm and formal. Made for printing and framing.", img: "/templates/classic.png" },
  { id: "madhubani", name: "Mithila Madhubani", blurb: "Fish, lotus and sun, drawn in the Mithila hand.", img: "/templates/madhubani.png" },
  { id: "minimal", name: "Modern Minimal", blurb: "Thin lines and plenty of white space.", img: "/templates/minimal.png" },
] as const;

const STEPS = [
  { icon: ListChecks, title: "Answer a few questions", text: "Our assistant asks one question at a time, in English, Hindi or Hinglish. Skip anything you do not know." },
  { icon: Sprout, title: "Watch the tree grow", text: "Your tree appears as you talk. Tap anyone to correct a detail or add a photo, and choose a style." },
  { icon: Printer, title: "Print it and share it", text: "Download a print-ready PDF in A3 or A4, and invite relatives on WhatsApp to add their own branches." },
];

const ASSURE = [
  { icon: Globe2, text: "Free. Start now, no sign-up" },
  { icon: Users, text: "English, Hindi and Hinglish" },
  { icon: Lock, text: "Private. Never sold or shared" },
];

const NOW = [
  { icon: GitMerge, title: "Find the same family, entered twice", text: "If you agree, we compare your tree with others that share your gotra and mool, and show how alike they are. You can preview a match and ask the other owner to get in touch." },
  { icon: Users, title: "Trees joined through daughters", text: "A daughter belongs to her father’s tree and to her husband’s. Confirm the match and the two trees are linked, so families can see how they are related." },
  { icon: Network, title: "How are we connected?", text: "Once trees are linked, see your path to another family: through whom, and in how many steps. Only families who chose to take part appear." },
] as const;

/** the one thing we want every visitor to do — clear and high-contrast, repeated on phones in a bar that stays on screen */
function Cta({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <Button asChild size="lg" className={`h-14 rounded-lg px-7 text-base font-semibold shadow-sm ${onDark ? "bg-cream text-indigo hover:bg-white" : "bg-indigo text-cream hover:bg-indigo/90"} ${className ?? ""}`}>
      <StartLink>Start your family tree <ArrowRight className="size-5" /></StartLink>
    </Button>
  );
}

/** a section opening: small label, a heading, one line of explanation — the same on every section */
function Head({ label, title, text, id }: { label: string; title: string; text?: string; id?: string }) {
  return (
    <header className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{label}</p>
      <h2 id={id} className="font-display mt-2 text-3xl font-semibold leading-tight text-indigo sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{text}</p>}
    </header>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-background pb-24 text-foreground sm:pb-0">
      <PatternBand className="block" />

      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/about" aria-label={`About ${ORG_NAME}`}><PaagLogo height={36} /></Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-indigo sm:gap-3">
          <Link href="/sample" className="hidden rounded-md px-3 py-2 hover:bg-indigo/5 sm:inline-block">Sample tree</Link>
          <Link href="/about" className="hidden rounded-md px-3 py-2 hover:bg-indigo/5 sm:inline-block">About</Link>
          <AuthLink />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20 lg:pt-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Maithil family trees <span className="text-indigo/40">·</span> <span lang="hi" className="tracking-normal">वंशावली</span></p>
          <h1 className="font-display mt-4 text-4xl font-bold leading-[1.15] text-indigo sm:text-5xl">Preserve your Maithil ancestry.</h1>
          <p lang="hi" className="font-display mt-3 text-2xl text-indigo/85">अपनी वंशावली बनाइए और सहेजिए</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground/85">
            A free community project built around the Panji Prabandh tradition. Gotra, mool and pravara are part of every person, not a footnote. Chat on your phone, watch your tree grow, print it, and invite relatives to add their own branches.
          </p>
          <div id="hero-cta" className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Cta />
            <Link href="/sample" className="text-base font-semibold text-indigo underline underline-offset-4 hover:text-indigo/80">See a sample tree</Link>
          </div>
          <ul className="mt-8 grid gap-3 text-base text-foreground/85 sm:grid-cols-3">
            {ASSURE.map((a) => (
              <li key={a.text} className="flex items-start gap-2.5"><a.icon className="mt-0.5 size-5 shrink-0 text-terracotta" aria-hidden /><span>{a.text}</span></li>
            ))}
          </ul>
        </div>
        <figure className="mx-auto w-full max-w-xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-md">
            <Image src="/templates/madhubani.png" alt="A family tree in the Mithila Madhubani style: four generations, each person with name in English and Hindi, gotra and mool" width={1200} height={864} priority className="h-auto w-full" />
          </div>
          <figcaption className="mt-3 text-center text-sm text-muted-foreground">A family tree in the Mithila Madhubani style (sample family)</figcaption>
        </figure>
      </section>

      {/* How it works */}
      <section className="border-y bg-secondary/60" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <Head id="how" label="How it works" title="Three simple steps" text="Most families have a first tree in about fifteen minutes." />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl font-semibold text-indigo/30">{i + 1}</span>
                  <s.icon className="size-6 text-terracotta" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-indigo">{s.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Templates */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="styles">
        <Head id="styles" label="Styles" title="Three ways to see your family" text="Switch at any time. Your information stays the same." />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <figure key={t.id} className="overflow-hidden rounded-xl border bg-card">
              <Image src={t.img} alt={`${t.name} template: a sample family tree`} width={1200} height={864} className="aspect-[5/3] w-full object-cover object-center" />
              <figcaption className="border-t p-5">
                <div className="font-display text-xl font-semibold text-indigo">{t.name}</div>
                <div className="mt-1 text-base text-muted-foreground">{t.blurb}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* What is already here */}
      <section className="border-y bg-secondary/60" aria-labelledby="now">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <Head id="now" label="Connecting families" title="More than a tree" text="Families who sign in can find each other. This is off until you switch it on, and nothing is linked without your yes." />
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {NOW.map((c) => (
              <li key={c.title} className="rounded-xl border bg-card p-6">
                <c.icon className="size-6 text-terracotta" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-indigo">{c.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{c.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Next, {ORG_NAME} is working with Panjikars to bring the traditional Panji records into a searchable form, and to add Maithili to the chat once native speakers have reviewed the wording.
          </p>
        </div>
      </section>

      {/* Closing */}
      <section className="bg-indigo text-cream">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Your family’s story, in your family’s tradition.</h2>
          <p lang="hi" className="font-display mt-3 text-xl text-cream/80">आज ही अपनी वंशावली शुरू कीजिए</p>
          <div className="mt-8 flex justify-center"><Cta onDark /></div>
        </div>
      </section>
      <SiteFooter dark />

      {/* phones: the main action stays in reach once the hero button has scrolled away */}
      <StickyStart watch="hero-cta"><Cta className="h-14 w-full text-base" /></StickyStart>
    </div>
  );
}
