import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import Link from "next/link";
import { Explain, RefShell, StartCta, Note } from "@/components/refs/RefShell";
import { breadcrumbLd, ldJson } from "@/lib/jsonld";
import { gotraPages } from "@/lib/refpages";
import { ORG_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = withSocial({
  title: `Maithil gotras (गोत्र) — the 20 gotras of the Panji list | ${ORG_NAME}`,
  description: "The gotras recorded in the Maithil Panji reference list, in English and Devanagari — Shandilya, Vatsa, Kashyap, Savarna, Parashar, Bharadwaj and more — with the mools (मूल) of each.",
  alternates: { canonical: "/gotra" },
}, "/gotra");

export default function GotraIndex() {
  const list = gotraPages();
  const ld = [
    ldJson(breadcrumbLd(siteUrl(), [{ name: ORG_NAME, path: "/" }, { name: "Gotras", path: "/gotra" }])),
    ldJson({ "@context": "https://schema.org", "@type": "ItemList", name: "Maithil gotras", itemListElement: list.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: `${g.name} (${g.dev})`, url: `${siteUrl()}/gotra/${g.slug}` })) }),
  ];
  return (
    <RefShell back={{ href: "/", label: `${ORG_NAME} home` }} ld={ld}>
      <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">Maithil gotras <span lang="hi" className="text-2xl text-indigo/80">· मैथिल गोत्र</span></h1>
      <p className="mt-2 leading-relaxed text-foreground/85">The {list.length} gotras recorded in the Panji reference list. Tap one to see its mools.</p>
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((g) => (
          <li key={g.id}><Link href={`/gotra/${g.slug}`} className="block rounded-xl border bg-card px-4 py-3 hover:bg-secondary/60"><span className="block font-medium text-indigo">{g.name}</span><span lang="hi" className="block text-sm text-muted-foreground">{g.dev} · {g.moolIds.length}</span></Link></li>
        ))}
      </ul>
      <p className="mt-4 text-sm"><Link href="/mool" className="font-medium text-primary underline underline-offset-2">See all mools (मूल)</Link></p>
      <Explain id="gotra-what" />
      <StartCta what="Know your gotra?" />
      <Note />
    </RefShell>
  );
}
