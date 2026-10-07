import type { Metadata } from "next";
import { ViewClient } from "@/components/account/ViewClient";
import { getStore } from "@/lib/store";
import { viewMode, viewState } from "@/lib/view";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> };

/** the title and picture a chat app shows when this link is pasted — only for a valid link, and only the safe summary */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { v } = await searchParams;
  const base: Metadata = { title: "Family tree — Maithil Panji", robots: { index: false, follow: false } };
  let title = "A Maithil family tree";
  let count = 0;
  try {
    const row = await getStore()?.getTree(id);
    if (!row || !viewMode(id, v, viewState(row))) return base;
    title = (row.title ?? "Family tree").replace(/ family$/, " family tree"); count = row.family.persons.length;
  } catch { return base; }
  const description = `${count ? `${count} people. ` : ""}View this Maithil family tree on Maithil Panji — and build your own, free.`;
  const image = `/api/trees/${encodeURIComponent(id)}/og?v=${encodeURIComponent(v ?? "")}`;
  return {
    ...base, title: `${title} — Maithil Panji`, description,
    openGraph: { title, description, type: "website", siteName: "Maithil Panji", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ViewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { v } = await searchParams;
  return <ViewClient id={id} v={v ?? ""} />;
}
