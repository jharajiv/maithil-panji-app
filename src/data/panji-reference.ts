/**
 * ILLUSTRATIVE seed lists for autocomplete (Day 1 only).
 * Replace with panji_seed_gotras_mools.jsonl + the 263-village moolgrama list
 * once the real seed files are wired in (Day 2).
 */
export const GOTRAS = [
  "Kashyap", "Bharadwaj", "Shandilya", "Vatsa", "Savarna", "Parashar", "Kaushik",
  "Gautam", "Katyayan", "Kaundinya", "Alamban", "Garg", "Bhargav", "Upamanyu", "Maudgalya",
];

const SHARED_MOOLS = [
  "Sodarpur", "Pali", "Bahera", "Khandbala", "Majhaura", "Jajiwar", "Karmaha", "Bhaur",
];

/** Placeholder: every gotra offers the shared illustrative list. */
export const MOOLS_BY_GOTRA: Record<string, string[]> = Object.fromEntries(
  GOTRAS.map((g) => [g, SHARED_MOOLS]),
);

export const MOOLGRAMAS = [
  "Karion", "Tarauni", "Rahika", "Sijauli", "Laukahi", "Bhaur", "Ujan", "Sarisab", "Pandaul",
  "Sakhwar", "Madhepur", "Bhadwar", "Jajiwar", "Khandbala", "Pali", "Bahera", "Majhaura",
  "Sodarpur", "Tisaut", "Narar", "Hariharpur", "Basopatti", "Sakri", "Jarail",
];
