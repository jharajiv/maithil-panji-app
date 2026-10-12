/** structured data for search engines and AI assistants; "<" is escaped so the text can never close the script tag */
export const ldJson = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

export const breadcrumbLd = (base: string, items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}${it.path}` })),
});
