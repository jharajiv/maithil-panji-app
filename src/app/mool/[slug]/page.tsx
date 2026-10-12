import type { Metadata } from "next";
import { withSocial } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Explain, RefShell, StartCta, Note } from "@/components/refs/RefShell";
import { breadcrumbLd, ldJson } from "@/lib/jsonld";
import { gotraById, moolBySlug, moolPages } from "@/lib/refpages";
import { ORG_NAME, siteUrl } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => moolPages().map((m) => ({ slug: m.slug }));

type Props = { params: Promise<{ slug: string }> };

const gotrasOf = (m: { gotraIds: string[] }) => m.gotraIds.map(gotraById).filter((g): g is NonNullable<typeof g> => !!g);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = moolBySlug((await params).slug);
  if (!m) return {};
  const gs = gotrasOf(m).map((g) => g.name).join(", ");
  return withSocial({
    title: `${m.name} (${m.dev}) mool — Maithil Panji | ${ORG_NAME}`,
    description: `${m.name} (${m.dev}) is a mool (मूल) in the Maithil Panji reference list${gs ? `, recorded under the ${gs} gotra` : ""}. Read more and build your Maithil family tree for free.`,
    alternates: { canonical: `/mool/${m.slug}` },
  }, `/mool/${m.slug}`);
}

export default async function MoolPage({ params }: Props) {
  const m = moolBySlug((await params).slug);
  if (!m) notFound();
  const gs = gotrasOf(m);
  const same = new Map<string, ReturnType<typeof moolPages>[number]>();
  for (const x of moolPages()) if (x.id !== m.id && x.gotraIds.some((id) => m.gotraIds.includes(id))) same.set(x.id, x);
  const related = [...same.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 24);
  const ld = [ldJson(breadcrumbLd(siteUrl(), [{ name: ORG_NAME, path: "/" }, { name: "Mools", path: "/mool" }, { name: m.name, path: `/mool/${m.slug}` }]))];
  return (
    <RefShell back={{ href: "/mool", label: "All mools" }} ld={ld}>
      <h1 className="font-display mt-4 text-3xl font-bold text-indigo sm:text-4xl">{m.name} mool <span lang="hi" className="text-2xl text-indigo/80">· {m.dev} मूल</span></h1>
      {m.also.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Also written: {m.also.join(", ")}</p>}
      <p className="mt-3 leading-relaxed text-foreground/85">
        {m.name} ({m.dev}) is a mool in the Panji reference list.{" "}
        {gs.length > 0 ? <>It is recorded under the {gs.map((g, i) => <span key={g.id}>{i > 0 ? " and " : ""}<Link href={`/gotra/${g.slug}`} className="font-medium text-primary underline underline-offset-2">{g.name} ({g.dev})</Link></span>)} gotra{gs.length > 1 ? "s" : ""}.</> : "The list does not yet record a gotra for it."}
      </p>
      <Explain id="mool-what" />
      {related.length > 0 && (
        <section className="mt-8" aria-labelledby="rel">
          <h2 id="rel" className="font-display text-xl font-semibold text-indigo">Other mools of the same gotra <span lang="hi" className="text-base font-medium text-muted-foreground">· उसी गोत्र के अन्य मूल</span></h2>
          <ul className="mt-3 flex flex-wrap gap-2">{related.map((x) => <li key={x.id}><Link href={`/mool/${x.slug}`} className="inline-block rounded-full border bg-card px-3.5 py-1.5 text-[15px] hover:bg-secondary/60">{x.name} <span lang="hi" className="text-muted-foreground">{x.dev}</span></Link></li>)}</ul>
        </section>
      )}
      <StartCta what={`Is ${m.name} your mool?`} />
      <Note />
    </RefShell>
  );
}
