import { FAQ } from "./faq";
import { gotraPages, moolPages } from "./refpages";
import { ORG_LONG, ORG_NAME, SITE_DOMAIN, TAGLINE, siteUrl } from "./site";

/**
 * Plain-text summaries for AI assistants (the /llms.txt convention): a short guide with links, and one longer file with the questions and answers
 * in full. They are built from the same lists as the web pages, so they never drift. Nothing from anyone's tree is ever included.
 */
const WHAT = `${ORG_NAME} (${ORG_LONG}, ${SITE_DOMAIN}) is a free community project that helps Maithil families (Mithila, Bihar and beyond) record their family tree (वंशावली) in the Panji Prabandh tradition, with gotra, mool and pravara kept as part of the record. A family answers simple questions in English or Hindi on a phone and gets a tree it can print, share as a view-only page, and build together with relatives. Family data is never sold. Living relatives appear by first name only on shared pages. It is not an official record and not a substitute for a Panjikar.`;

export function llmsTxt(): string {
  const b = siteUrl();
  return `# ${ORG_NAME}

> ${TAGLINE} ${WHAT}

## Main pages
- [Home — build a free Maithil family tree](${b}/): start the interview-style tree builder
- [About ${ORG_NAME}](${b}/about): who runs it and why
- [Questions and answers (English)](${b}/faq): gotra, mool, the Panji way, using the app, privacy
- [प्रश्न और उत्तर (हिन्दी)](${b}/hi/faq): the same answers in Hindi
- [Sample family tree](${b}/sample): what a finished tree looks like (a sample only, not an official record)
- [Privacy](${b}/privacy): what is kept, who can see it, how to delete it

## Reference lists
- [Maithil gotras](${b}/gotra): ${gotraPages().length} gotras of the Panji list, in English and Devanagari, each with its mools
- [Maithil mools (मूल)](${b}/mool): ${moolPages().length} mools, each linked to its gotra

## Optional
- [Everything above in one text file](${b}/llms-full.txt)
`;
}

export function llmsFullTxt(): string {
  const b = siteUrl();
  const gs = gotraPages();
  const ms = moolPages();
  const faq = FAQ.map((f) => `### ${f.q.en}\n${f.a.en}\n\n### ${f.q.hi}\n${f.a.hi}`).join("\n\n");
  const gl = gs.map((g) => `- ${g.name} (${g.dev}): ${b}/gotra/${g.slug} — mools: ${g.moolIds.map((id) => ms.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || "none listed"}`).join("\n");
  return `# ${ORG_NAME} — full text

${WHAT}

Address: ${b}
Start a tree: ${b}/build
Note for readers: the gotra and mool lists below come from the Panji reference list used by the site and are being reviewed by elders; a family's own tradition and its Panjikar always come first.

## Questions and answers

${faq}

## Gotras of the Panji reference list

${gl}

## Mools of the Panji reference list

${ms.map((m) => `- ${m.name} (${m.dev}): ${b}/mool/${m.slug}`).join("\n")}
`;
}
