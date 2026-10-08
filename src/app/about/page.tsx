import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { contactEmail, ORG_LONG, ORG_NAME, SITE_DOMAIN, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `About ${ORG_NAME} — ${SITE_NAME}`,
  description: `${ORG_NAME} (${ORG_LONG}) is the community initiative behind ${SITE_NAME}: helping Maithil families record their lineage in the Panji Prabandh tradition.`,
  alternates: { canonical: "/about" },
};

function H({ children }: { children: React.ReactNode }) { return <h2 className="font-display mt-9 text-xl font-semibold text-indigo">{children}</h2>; }
function P({ children }: { children: React.ReactNode }) { return <p className="mt-2 leading-relaxed text-foreground/85">{children}</p>; }

export default function About() {
  const mail = contactEmail();
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {SITE_NAME} home</Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">{SITE_DOMAIN}</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-indigo sm:text-4xl">{ORG_NAME}</h1>
        <p className="mt-1 text-lg text-foreground/80">PAAG stands for <strong>{ORG_LONG}</strong>.</p>

        <H>What we are doing</H>
        <P>For generations, Maithil families have kept their lineage in the <em>Panji Prabandh</em>, the genealogical records kept by the Panjikars of Mithila. These records are precious, and they are held in few hands, on paper, and at risk of being lost. {ORG_NAME} is a community initiative to help families keep their own lineage safe, and, step by step, to bring the Panji records into a form that can be preserved and searched.</P>

        <H>{SITE_NAME}: the first step</H>
        <P>{SITE_NAME} lets any family build its tree by answering simple questions on a phone, in English or Hindi. Gotra, mool and pravara are part of the record, not footnotes. The tree can be printed, shared as a view-only page, and built together with relatives.</P>

        <H>Ancestry and the graph</H>
        <P>A family tree is a small piece of a larger web. A daughter belongs to her father’s tree and to her husband’s; two cousins may each have recorded the same grandfather. When families choose to connect their trees, a graph forms, and with it the answer to a question many of us ask: <em>how are we related?</em> That is the “Graph” in PAAG.</P>

        <H>How we work</H>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-foreground/85">
          <li><strong>Your family’s data is yours.</strong> We do not sell it, advertise with it, or share it with marketers.</li>
          <li><strong>Consent first.</strong> Living relatives appear by first name only on shared pages. Connecting with other families is off until you switch it on, and nothing is merged or linked unless the owners agree.</li>
          <li><strong>Free for families.</strong> The service is meant to stay free to use. Voluntary contributions help keep it that way.</li>
          <li><strong>Records with respect.</strong> Where records come from public sources, we credit them. A sample tree is only a sample, never an official record.</li>
        </ul>

        <H>Take part</H>
        <P>Start your family tree, invite relatives to add their branches, and tell other Maithil families about it. If you are a Panjikar, a scholar, or a volunteer who can help read, transcribe or verify records, we would be glad to hear from you.{mail ? <> Write to <a className="underline" href={`mailto:${mail}`}>{mail}</a>.</> : null}</P>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/build" className="rounded-xl bg-terracotta px-5 py-3 font-semibold text-white hover:bg-terracotta/90">Start building your family tree</Link>
          <Link href="/privacy" className="rounded-xl border px-5 py-3 font-medium hover:bg-secondary">Read the privacy page</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
