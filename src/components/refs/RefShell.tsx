import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PaagLogo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { FAQ } from "@/lib/faq";
import { ORG_NAME } from "@/lib/site";

export const faqText = (id: string) => FAQ.find((f) => f.id === id);

/** the frame shared by the gotra and mool pages */
export function RefShell({ back, children, ld }: { back: { href: string; label: string }; children: React.ReactNode; ld?: string[] }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {back.label}</Link>
        <Link href="/" aria-label={ORG_NAME} className="mt-5 block w-fit"><PaagLogo height={34} /></Link>
        {children}
      </div>
      <SiteFooter />
      {ld?.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: j }} />)}
    </div>
  );
}

export function Explain({ id }: { id: "gotra-what" | "mool-what" }) {
  const f = faqText(id);
  if (!f) return null;
  return (
    <section className="mt-8 rounded-xl border bg-card p-4">
      <h2 className="font-display text-lg font-semibold text-indigo">{f.q.en} <span lang="hi" className="text-base font-medium text-muted-foreground">· {f.q.hi}</span></h2>
      <p className="mt-2 leading-relaxed text-foreground/85">{f.a.en}</p>
      <p lang="hi" className="mt-2 leading-relaxed text-foreground/85">{f.a.hi}</p>
      <p className="mt-2 text-sm"><Link href="/faq" className="font-medium text-primary underline underline-offset-2">More questions and answers</Link> · <Link href="/hi/faq" lang="hi" className="font-medium text-primary underline underline-offset-2">हिन्दी में पढ़िए</Link></p>
    </section>
  );
}

export function StartCta({ what }: { what: string }) {
  return (
    <section className="mt-8 rounded-xl bg-secondary/60 p-4">
      <p className="leading-relaxed text-foreground/85">{what} Build your Maithil family tree for free — answer simple questions in English, Hindi or Hinglish, and print it or share it on WhatsApp.</p>
      <p lang="hi" className="mt-1 leading-relaxed text-foreground/85">अपनी मैथिल वंशावली मुफ़्त बनाइए — सरल प्रश्नों के उत्तर हिन्दी, English या Hinglish में दीजिए।</p>
      <Link href="/build" className="mt-3 inline-block rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">Start my family tree · वंशावली बनाइए</Link>
    </section>
  );
}

export const Note = () => (
  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">These names come from the Panji reference list that {ORG_NAME} uses. Spellings differ between families and panjikars, and a family’s own tradition and its elders come first. If you see a gap or a different spelling, please tell us.</p>
);
