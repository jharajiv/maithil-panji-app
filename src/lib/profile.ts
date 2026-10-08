/**
 * A person's profile: the few facts that make them recognisable inside the community.
 * Gotra and mool come from their family tree, so they are not typed again here.
 *  - "community" fields (pravar, native place, current city, marital status, occupation, about) are what the owner of a
 *    family tree you connect with can see;
 *  - contact details (mobile, email, street address) are shown to such an owner only when `share_contact` is on.
 * Nothing here is public, and nothing is searchable by other people yet.
 */
export const MARITAL = ["single", "married", "widowed", "divorced", "other"] as const;
export type Marital = (typeof MARITAL)[number];

export interface Profile {
  /** the pravar: the lineage of rishis recited with the gotra, e.g. "Bharadwaj, Angiras, Barhaspatya" */
  pravar?: string;
  native_village?: string;
  native_district?: string;
  native_state?: string;
  current_city?: string;
  /** street address — contact-level, shown only with share_contact */
  current_address?: string;
  marital_status?: Marital;
  occupation?: string;
  about?: string;
  /** allow the owner of a tree you connect with to see your mobile, email and street address */
  share_contact?: boolean;
}

const LIMITS: Record<Exclude<keyof Profile, "marital_status" | "share_contact">, number> = {
  pravar: 120, native_village: 80, native_district: 80, native_state: 60, current_city: 80, current_address: 200, occupation: 80, about: 400,
};

/** anything a browser sends → a clean Profile (unknown keys dropped, text trimmed, empty values removed) */
export function cleanProfile(input: unknown): Profile {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Profile = {};
  for (const [k, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    const v = src[k];
    if (typeof v !== "string") continue;
    const t = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
    if (t) out[k] = t;
  }
  if (typeof src.marital_status === "string" && (MARITAL as readonly string[]).includes(src.marital_status)) out.marital_status = src.marital_status as Marital;
  if (src.share_contact === true) out.share_contact = true;
  return out;
}

export const nativePlace = (p: Profile) => [p.native_village, p.native_district, p.native_state].filter(Boolean).join(", ");

/** what the owner of another tree sees (pass `share` to include mobile, email and address) */
export function profileForOwner(name: string, phone: string | undefined, email: string, p: Profile | undefined, share = !!p?.share_contact) {
  const pr = p ?? {};
  return {
    name,
    pravar: pr.pravar, native_place: nativePlace(pr) || undefined, current_city: pr.current_city, marital_status: pr.marital_status, occupation: pr.occupation, about: pr.about,
    ...(share ? { phone, email, address: pr.current_address } : {}),
  };
}

/** 0–100: how much of the profile is filled in (drives the "complete your profile" nudge) */
export function completeness(p: Profile | undefined, hasPhone: boolean): number {
  const pr = p ?? {};
  const have = [pr.pravar, pr.native_village || pr.native_district, pr.current_city, pr.marital_status, pr.occupation, hasPhone].filter(Boolean).length;
  return Math.round((have / 6) * 100);
}
