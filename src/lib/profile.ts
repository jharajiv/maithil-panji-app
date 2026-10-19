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
  /** work, study and interests (all optional; shown to the owner of a tree you connect with, like occupation) */
  employer?: string;
  education?: string;
  languages?: string;
  /** keys from HOBBIES, or short words the person typed */
  hobbies?: string[];
  /** a small photo of the person (a data address); shown to a connecting owner only with share_contact */
  photo?: string;
  /** allow the owner of a tree you connect with to see your mobile, email and street address */
  share_contact?: boolean;
  /** email reminders about family birthdays (switched on by the person; see lib/reminders.ts) */
  reminders?: { birthdays: boolean; lead: "week" | "day" };
  /** SERVER ONLY, never taken from a browser: when reminders were switched on (the person's consent), and which reminders were already sent */
  _remind_on?: string;
  _sent?: string[];
}

/** the hobby buttons on the profile page (English; Hindi next to it on the page) */
export const HOBBIES: { key: string; en: string; hi: string }[] = [
  { key: "reading", en: "Reading", hi: "पढ़ना" }, { key: "music", en: "Music", hi: "संगीत" }, { key: "bhajan", en: "Bhajan and kirtan", hi: "भजन-कीर्तन" },
  { key: "cooking", en: "Cooking", hi: "खाना बनाना" }, { key: "travel", en: "Travel", hi: "यात्रा" }, { key: "gardening", en: "Gardening", hi: "बागवानी" },
  { key: "farming", en: "Farming", hi: "खेती" }, { key: "cricket", en: "Cricket and sports", hi: "क्रिकेट और खेल" }, { key: "yoga", en: "Yoga and walking", hi: "योग और सैर" },
  { key: "writing", en: "Writing", hi: "लेखन" }, { key: "madhubani", en: "Madhubani painting", hi: "मधुबनी चित्रकला" }, { key: "history", en: "History and genealogy", hi: "इतिहास और वंशावली" },
  { key: "teaching", en: "Teaching", hi: "पढ़ाना" }, { key: "photography", en: "Photography", hi: "फ़ोटोग्राफ़ी" },
];
export const MAX_PROFILE_PHOTO = 70_000;

const LIMITS: Record<"pravar" | "native_village" | "native_district" | "native_state" | "current_city" | "current_address" | "occupation" | "about" | "employer" | "education" | "languages", number> = {
  pravar: 120, native_village: 80, native_district: 80, native_state: 60, current_city: 80, current_address: 200, occupation: 80, about: 400, employer: 80, education: 120, languages: 120,
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
  if (Array.isArray(src.hobbies)) {
    const list = src.hobbies.filter((h): h is string => typeof h === "string").map((h) => h.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30)).filter(Boolean);
    const uniq = [...new Set(list)].slice(0, 10);
    if (uniq.length) out.hobbies = uniq;
  }
  if (typeof src.photo === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src.photo) && src.photo.length <= MAX_PROFILE_PHOTO) out.photo = src.photo;
  if (src.share_contact === true) out.share_contact = true;
  const rm = src.reminders as { birthdays?: unknown; lead?: unknown } | undefined;
  if (rm && typeof rm === "object") out.reminders = { birthdays: rm.birthdays === true, lead: rm.lead === "day" ? "day" : "week" };
  return out;
}

export const hobbyLabel = (k: string) => HOBBIES.find((h) => h.key === k)?.en ?? k;
export const nativePlace = (p: Profile) => [p.native_village, p.native_district, p.native_state].filter(Boolean).join(", ");

/** what the owner of another tree sees (pass `share` to include mobile, email and address) */
export function profileForOwner(name: string, phone: string | undefined, email: string, p: Profile | undefined, share = !!p?.share_contact) {
  const pr = p ?? {};
  return {
    name,
    pravar: pr.pravar, native_place: nativePlace(pr) || undefined, current_city: pr.current_city, marital_status: pr.marital_status, occupation: pr.occupation, about: pr.about,
    employer: pr.employer, education: pr.education, languages: pr.languages, hobbies: pr.hobbies?.map(hobbyLabel).join(", ") || undefined,
    ...(share ? { phone, email, address: pr.current_address, photo: pr.photo } : {}),
  };
}

/** 0–100: how much of the profile is filled in (drives the "complete your profile" nudge) */
export function completeness(p: Profile | undefined, hasPhone: boolean): number {
  const pr = p ?? {};
  const have = [pr.pravar, pr.native_village || pr.native_district, pr.current_city, pr.marital_status, pr.occupation, hasPhone].filter(Boolean).length;
  return Math.round((have / 6) * 100);
}
