import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PaagLogo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { FAQ, FAQ_GROUPS, type FaqLang } from "@/lib/faq";
import { ORG_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Questions and answers — ${ORG_NAME}`,
  description: "Gotra, mool, and how a Maithil family is recorded in the Panji way: which gotra a married woman writes, what a mool is, and how to use the app. English and हिन्दी.",
  alternates: { canonical: "/faq" },
};

/** a page of ready-made answers; the chat gives the same answers (src/lib/faq.ts), in English or Hindi: /faq?lang=hi */
export default async function FaqPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang: FaqLang = (await searchParams).lang === "hi" ? "hi" : "en";
  const hi = lang === "hi";
  const ld = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q[lang], acceptedAnswer: { "@type": "Answer", text: f.a[lang] } })),
  };
  const tab = (l: FaqLang, label: string) => (
    <Link href={l === "hi" ? "/faq?lang=hi" : "/faq"} replace scroll={false} aria-current={lang === l ? "true" : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium ${lang === l ? "border-indigo bg-indigo text-cream" : "bg-card text-foreground/80 hover:bg-secondary"}`}>{label}</Link>
  );
  return (
    <div className="min-h-dvh bg-background" lang={lang}>
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> {ORG_NAME}</Link>
        <PaagLogo height={34} className="mt-5" />
        <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">{hi ? "प्रश्न और उत्तर" : "Questions and answers"}</h1>
        <p className="mt-2 leading-relaxed text-foreground/80">{hi ? "गोत्र, मूल और पंजी के अनुसार परिवार दर्ज करने के बारे में आम सवाल। यही उत्तर चैट सहायक भी देता है — आप वहाँ भी पूछ सकते हैं।" : "Common questions about gotra, mool and recording a family the Panji way. The chat assistant gives the same answers — you can ask it there too."}</p>
        <div className="mt-4 flex gap-2" role="group" aria-label="Language">{tab("en", "English")}{tab("hi", "हिन्दी")}</div>

        {FAQ_GROUPS.map((g) => (
          <section key={g.id} aria-labelledby={`g-${g.id}`} className="mt-9">
            <h2 id={`g-${g.id}`} className="font-display text-xl font-semibold text-indigo">{g.title[lang]}</h2>
            <div className="mt-3 space-y-2">
              {FAQ.filter((f) => f.group === g.id).map((f) => (
                <details key={f.id} id={f.id} className="group rounded-xl border bg-card open:shadow-sm">
                  <summary className="cursor-pointer list-none px-4 py-3.5 text-base font-medium leading-snug text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="mr-2 inline-block text-terracotta transition-transform group-open:rotate-90" aria-hidden="true">▸</span>{f.q[lang]}
                  </summary>
                  <p className="px-4 pb-4 pl-10 leading-relaxed text-foreground/85">{f.a[lang]}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-9 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed text-foreground/80">
          {hi ? "इन उत्तरों में कुछ कमी या ग़लती लगे, या आपके कुल की रीति अलग हो, तो हमें बताइए। परिवार की अपनी परंपरा और आपके बड़ों का मार्गदर्शन सबसे ऊपर है।" : "If something here looks wrong, or your family’s custom is different, please tell us. Your family’s own tradition and your elders’ guidance always come first."}
        </p>
        <Link href="/build" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">{hi ? "अपनी वंशावली बनाइए" : "Build your family tree"}</Link>
      </div>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </div>
  );
}
