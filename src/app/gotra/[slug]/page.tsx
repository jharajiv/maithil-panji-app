import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Explain, RefShell, StartCta, Note } from "@/components/refs/RefShell";
import { breadcrumbLd, ldJson } from "@/lib/jsonld";
import { gotraBySlug, gotraPages, moolById } from "@/lib/refpages";
import { ORG_NAME, siteUrl } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => gotraPages().map((g) => ({ slug: g.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = gotraBySlug((await params).slug);
  if (!g) return {};
  return withSocial({
    title: `${g.name} (${g.dev}) gotra — Maithil Panji | ${ORG_NAME}`,
    description: `${g.name} (${g.dev}) is one of the gotras in the Maithil Panji reference list. See its ${g.moolIds.length} mools (मूल) and build your Maithil family tree for free.`,
    alternates: { canonical: `/gotra/${g.slug}` },
  }, `/gotra/${g.slug}`);
}

export default async function GotraPage({ params }: Props) {
  const g = gotraBySlug((await params).slug);
  if (!g) notFound();
  const all = gotraPages();
  const i = all.findIndex((x) => x.id === g.id);
  const prev = all[(i + all.length - 1) % all.length]!, next = all[(i + 1) % all.length]!;
  const mools = g.moolIds.map(moolById).filter((m): m is NonNullable<typeof m> => !!m).sort((a, b) => a.name.localeCompare(b.name));
  const ld = [ldJson(breadcrumbLd(siteUrl(), [{ name: ORG_NAME, path: "/" }, { name: "Gotras", path: "/gotra" }, { name: g.name, path: `/gotra/${g.slug}` }]))];
  return (
    <RefShell back={{ href: "/gotra", label: "All gotras" }} ld={ld}>
      <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">{g.name} gotra <span lang="hi" className="text-2xl text-indigo/80">· {g.dev} गोत्र</span></h1>
      {g.also.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Also written: {g.also.join(", ")}</p>}
      <p className="mt-3 leading-relaxed text-foreground/85">{g.name} ({g.dev}) is one of the {all.length} gotras in the Panji reference list. {mools.length > 0 ? `The list records ${mools.length} mool${mools.length === 1 ? "" : "s"} under it.` : "The list does not yet record mools under it."}</p>
      {mools.length > 0 && (
        <section className="mt-6" aria-labelledby="mools">
          <h2 id="mools" className="font-display text-xl font-semibold text-indigo">Mools of the {g.name} gotra <span lang="hi" className="text-base font-medium text-muted-foreground">· {g.dev} गोत्र के मूल</span></h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {mools.map((m) => <li key={m.id}><Link href={`/mool/${m.slug}`} className="inline-block rounded-full border bg-card px-3.5 py-1.5 text-[15px] hover:bg-secondary/60">{m.name} <span lang="hi" className="text-muted-foreground">{m.dev}</span></Link></li>)}
          </ul>
        </section>
      )}
      <Explain id="gotra-what" />
      <StartCta what={`Do you belong to the ${g.name} gotra?`} />
      <Note />
      <nav aria-label="Other gotras" className="mt-6 flex justify-between text-sm"><Link href={`/gotra/${prev.slug}`} className="text-primary underline underline-offset-2">← {prev.name}</Link><Link href={`/gotra/${next.slug}`} className="text-primary underline underline-offset-2">{next.name} →</Link></nav>
    </RefShell>
  );
}
