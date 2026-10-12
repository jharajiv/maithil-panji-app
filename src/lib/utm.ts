/**
 * Links people share carry a small "where did this come from" label, so Google Analytics can show which share button
 * brings visitors (utm_source = whatsapp, facebook, x, copy, native; utm_medium = share or invite). The label says nothing about the person.
 */
export function withUtm(url: string, source: string, medium = "share", campaign = "tree"): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) { u.searchParams.set("utm_source", source); u.searchParams.set("utm_medium", medium); u.searchParams.set("utm_campaign", campaign); }
    return u.toString();
  } catch { return url; }
}
