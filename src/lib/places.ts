/**
 * Place suggestions through Google Places (Autocomplete, "new" API). Pure helpers: the request we send and how an answer becomes
 * "Village, District, State". The key is read on the server only (GOOGLE_PLACES_API_KEY) and is never sent to the browser.
 */
/** a = village / town, b = district (or region abroad), c = state (or country abroad); n = the block / tehsil it sits in (only shown in the list); in = it is in India */
export interface PlaceHit { a: string; b: string; c: string; n?: string; in?: boolean }

export const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

export const norm = (x: string) => x.toLowerCase().replace(/\s+(district|zila|division)$/, "").trim();
export const stateMatch = (x: string) => INDIAN_STATES.find((s) => norm(s) === norm(x) || (norm(x) === "orissa" && s === "Odisha") || (norm(x) === "nct of delhi" && s === "Delhi"));

export interface Prediction {
  placeId?: string;
  types?: string[];
  structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
}

/** only real places, not shops and offices */
const BUSINESS = /^(establishment|point_of_interest|store|food|lodging|health|finance)$/;
export const isPlace = (p: Prediction) => !(p.types ?? []).some((t) => BUSINESS.test(t));

/** one prediction → village / district / state (India) or place / region / country (elsewhere). Google writes "Kothiya" + "Madhubani, Bihar, India". */
export function toHit(p: Prediction, india: boolean): PlaceHit | null {
  const main = p.structuredFormat?.mainText?.text?.trim();
  if (!main) return null;
  const sec = (p.structuredFormat?.secondaryText?.text ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const country = sec[sec.length - 1] ?? "";
  const inIndia = /^india$/i.test(country);
  if (!india && !inIndia) return { a: main, b: sec.length > 2 ? sec.slice(0, -1).join(", ") : sec.length === 2 ? sec[0]! : "", c: country || sec[0] || "", in: false };
  if (india && country && !inIndia) return null; // India mode: a place in another country is not offered
  const rest = inIndia ? sec.slice(0, -1) : sec;
  const st = rest.length ? stateMatch(rest[rest.length - 1]!) : undefined;
  if (st) return { a: main, b: rest.slice(0, -1).map((x) => x.replace(/\s+district$/i, "")).slice(-1)[0] ?? "", c: st, in: true };
  if (stateMatch(main)) return null; // the state itself
  return { a: main, b: rest[0]?.replace(/\s+district$/i, "") ?? "", c: "", in: true };
}

/** the address parts Google gives for a place (Place Details / Text Search) */
export interface AddrPart { longText?: string; shortText?: string; types?: string[] }
export interface GooglePlace { id?: string; displayName?: { text?: string }; types?: string[]; addressComponents?: AddrPart[] }
const part = (parts: AddrPart[] | undefined, t: string) => parts?.find((x) => x.types?.includes(t))?.longText?.trim() || undefined;
const bare = (x?: string) => x?.replace(/\s+(district|zila|tehsil|block)$/i, "").trim() ?? "";
const isDivision = (x: string) => /\b(division|range|region)\b/i.test(x);

/**
 * Bihar's divisions and the districts in each. Google's address levels are not reliable here: for a village in Madhubani it can put
 * "Darbhanga" (the division) one level above "Madhubani" (the district). Knowing the real hierarchy lets us tell them apart.
 */
export const BIHAR_DIVISIONS: Record<string, string[]> = {
  Patna: ["Patna", "Nalanda", "Bhojpur", "Buxar", "Rohtas", "Kaimur"],
  Magadh: ["Gaya", "Aurangabad", "Nawada", "Jehanabad", "Arwal"],
  Saran: ["Saran", "Siwan", "Gopalganj"],
  Tirhut: ["Muzaffarpur", "East Champaran", "West Champaran", "Sitamarhi", "Sheohar", "Vaishali"],
  Darbhanga: ["Darbhanga", "Madhubani", "Samastipur"],
  Kosi: ["Saharsa", "Madhepura", "Supaul"],
  Purnia: ["Purnia", "Araria", "Kishanganj", "Katihar"],
  Bhagalpur: ["Bhagalpur", "Banka"],
  Munger: ["Munger", "Begusarai", "Khagaria", "Jamui", "Lakhisarai", "Sheikhpura"],
};
export const BIHAR_DISTRICTS = Object.values(BIHAR_DIVISIONS).flat().sort();
const divisionOf = (district: string) => Object.entries(BIHAR_DIVISIONS).find(([, ds]) => ds.some((d) => norm(d) === norm(district)))?.[0];
const knownDistrict = (x: string) => BIHAR_DISTRICTS.find((d) => norm(d) === norm(x));

/**
 * The district, and a smaller area (block / town) if there is one, out of the names Google gave at its address levels 2, 3 and 4.
 * Divisions are never the district. In Bihar the real list of districts decides; elsewhere the first name that is not a division.
 */
export function districtOf(state: string, levels: string[]): { district: string; area?: string } {
  const names = levels.map(bare).filter((x) => x && !isDivision(x));
  if (!names.length) return { district: "" };
  if (norm(state) === "bihar") {
    const known = names.map(knownDistrict).filter((x): x is string => !!x);
    // a "district" that is really the division of another listed district (Darbhanga above Madhubani) is dropped
    const real = known.filter((k) => !known.some((j) => norm(j) !== norm(k) && norm(divisionOf(j) ?? "") === norm(k)));
    const district = real[0] ?? known[0];
    if (district) {
      const div = divisionOf(district);
      const area = names.find((x) => norm(x) !== norm(district) && norm(x) !== norm(div ?? "") && !knownDistrict(x));
      return { district, ...(area ? { area } : {}) };
    }
  }
  return { district: names[0]!, ...(names[1] ? { area: names[1] } : {}) };
}

/** a full place (with its address parts) → a hit. India: village, district, state and the area; elsewhere: place, region, country. */
export function hitFromPlace(pl: GooglePlace, india: boolean): PlaceHit | null {
  const a = pl.displayName?.text?.trim();
  if (!a || !isPlace({ types: pl.types })) return null;
  const country = part(pl.addressComponents, "country");
  const state = part(pl.addressComponents, "administrative_area_level_1");
  const inIndia = /^india$/i.test(country ?? "");
  if (india && country && !inIndia) return null;
  if (!inIndia) return { a, b: state && norm(state) !== norm(a) ? state : "", c: country ?? "", in: false };
  if (stateMatch(a)) return null;
  const st = state ? stateMatch(state) ?? state : "";
  const { district, area } = districtOf(st, ["administrative_area_level_2", "administrative_area_level_3", "administrative_area_level_4", "sublocality_level_1"].map((t) => part(pl.addressComponents, t) ?? ""));
  return { a, b: district, c: st, ...(area && norm(area) !== norm(a) ? { n: area } : {}), in: true };
}

/** the body we send to Google */
export function requestBody(input: string, india: boolean, typed: boolean) {
  return {
    input,
    languageCode: "en",
    ...(india ? {
      includedRegionCodes: ["in"],
      // lean towards Bihar (the people of this site), without excluding the rest of India
      locationBias: { rectangle: { low: { latitude: 24.2, longitude: 83.3 }, high: { latitude: 27.6, longitude: 88.4 } } },
    } : {}),
    ...(typed ? { includedPrimaryTypes: ["locality", "sublocality", "neighborhood", "administrative_area_level_3", "administrative_area_level_2"] } : {}),
  };
}

/** the body for a text search ("behta benipatti madhubani" finds the one village that fits all the words) */
export function searchBody(text: string, india: boolean) {
  return {
    textQuery: text, languageCode: "en", pageSize: 6,
    ...(india ? { regionCode: "IN", locationBias: { rectangle: { low: { latitude: 24.2, longitude: 83.3 }, high: { latitude: 27.6, longitude: 88.4 } } } } : {}),
  };
}

/** the answer of an autocomplete call, as hits together with Google's place id (so the district can be looked up when it is missing) */
export function rawHits(json: unknown, india: boolean): { id?: string; hit: PlaceHit }[] {
  const list = (json as { suggestions?: { placePrediction?: Prediction }[] } | null)?.suggestions ?? [];
  const out: { id?: string; hit: PlaceHit }[] = [];
  for (const s of list) {
    const p = s.placePrediction;
    if (!p || !isPlace(p)) continue;
    const h = toHit(p, india);
    if (h) out.push({ id: p.placeId, hit: h });
  }
  return out;
}

const keyOf = (h: PlaceHit) => `${h.a}|${h.b}|${h.c}|${h.n ?? ""}`.toLowerCase();
/** drop repeats and cap the list */
export function tidy(hits: PlaceHit[], max = 6): PlaceHit[] {
  const seen = new Set<string>(), out: PlaceHit[] = [];
  for (const h of hits) { const k = keyOf(h); if (!seen.has(k)) { seen.add(k); out.push(h); } }
  return out.slice(0, max);
}

export function hitsFrom(json: unknown, india: boolean, max = 6): PlaceHit[] {
  return tidy(rawHits(json, india).map((x) => x.hit), max);
}
