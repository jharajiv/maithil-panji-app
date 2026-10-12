/**
 * Public reference pages: one page per gotra and per mool of the Panji list (src/data/seed). Only the reference lists are used here —
 * nothing from anyone's tree. Names use the usual English spelling people search for; the list's own scholarly spelling is shown as "also written".
 */
import { GOTRAS, MOOLS, plainRoman } from "./lookup";
import { FRIENDLY } from "./chips";

export const slugOf = (s: string) => plainRoman(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface GotraPage { id: string; slug: string; name: string; dev: string; also: string[]; moolIds: string[] }
export interface MoolPage { id: string; slug: string; name: string; dev: string; also: string[]; gotraIds: string[] }

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

export const gotraPages = (): GotraPage[] => GOTRAS.filter((g) => !g.extra).map((g) => {
  const name = FRIENDLY[g.id] ?? plainRoman(g.roman);
  return { id: g.id, slug: slugOf(name), name, dev: g.dev, also: uniq([plainRoman(g.roman), g.roman]).filter((x) => x.toLowerCase() !== name.toLowerCase()), moolIds: MOOLS.filter((m) => !m.extra && m.gotras.includes(g.id)).map((m) => m.id) };
});

export const moolPages = (): MoolPage[] => {
  const used = new Set<string>();
  return MOOLS.filter((m) => !m.extra).map((m) => {
    const name = plainRoman(m.roman);
    let slug = slugOf(name) || m.id; if (used.has(slug)) slug = `${slug}-${m.id.replace(/\W+/g, "")}`; used.add(slug);
    return { id: m.id, slug, name, dev: m.dev, also: uniq([m.roman, ...m.aka]).filter((x) => x.toLowerCase() !== name.toLowerCase()), gotraIds: m.gotras };
  });
};

export const gotraBySlug = (slug: string) => gotraPages().find((g) => g.slug === slug);
export const moolBySlug = (slug: string) => moolPages().find((m) => m.slug === slug);
export const gotraById = (id: string) => gotraPages().find((g) => g.id === id);
export const moolById = (id: string) => moolPages().find((m) => m.id === id);
