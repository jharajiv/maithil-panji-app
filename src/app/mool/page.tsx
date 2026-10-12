import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import Link from "next/link";
import { Explain, RefShell, StartCta, Note } from "@/components/refs/RefShell";
import { breadcrumbLd, ldJson } from "@/lib/jsonld";
import { gotraById, moolPages } from "@/lib/refpages";
import { ORG_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = withSocial({
  title: `Maithil mools (मूल) — the mools of the Panji list | ${ORG_NAME}`,
  description: "The mools (मूल) recorded in the Maithil Panji reference list, in English and Devanagari, with the gotra each belongs to — Sarisaba, Sodarapura, Khandabala and more.",
  alternates: { canonical: "/mool" },
}, "/mool");

export default function MoolIndex() {
  const list = [...moolPages()].sort((a, b) => a.name.localeCompare(b.name));
  const ld = [ldJson(breadcrumbLd(siteUrl(), [{ name: ORG_NAME, path: "/" }, { name: "Mools", path: "/mool" }]))];
  return (
    <RefShell back={{ href: "/", label: `${ORG_NAME} home` }} ld={ld}>
      <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">Maithil mools <span lang="hi" className="text-2xl text-indigo/80">· मैथिल मूल</span></h1>
      <p className="mt-2 leading-relaxed text-foreground/85">The {list.length} mools recorded in the Panji reference list, with the gotra of each. Tap one to read more.</p>
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((m) => (
          <li key={m.id}><Link href={`/mool/${m.slug}`} className="block rounded-xl border bg-card px-3.5 py-2.5 hover:bg-secondary/60"><span className="block font-medium text-indigo">{m.name} <span lang="hi" className="font-normal text-muted-foreground">{m.dev}</span></span><span className="block text-xs text-muted-foreground">{m.gotraIds.map((id) => gotraById(id)?.name).filter(Boolean).join(", ")}</span></Link></li>
        ))}
      </ul>
      <p className="mt-4 text-sm"><Link href="/gotra" className="font-medium text-primary underline underline-offset-2">See all gotras (गोत्र)</Link></p>
      <Explain id="mool-what" />
      <StartCta what="Know your mool?" />
      <Note />
    </RefShell>
  );
}
