import Sanscript from "@indic-transliteration/sanscript";

/**
 * Roman → Devanagari for names, client-side (no API call).
 * Sanscript defaults + two tiny heuristics so common Maithil names look right:
 *   word-final "a" → ā  (Jha → झा, Rekha → रेखा)
 *   word-final "i" → ī  (Devi → देवी, Savitri → सावित्री-ish)
 * and the trailing virama is dropped (Rohan → रोहन). The result is always user-editable.
 */
export function romanToDevanagari(roman: string): string {
  return roman
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      let x = w.toLowerCase().replace(/[^a-z]/g, "");
      if (!x) return "";
      if (/[^a]a$/.test(x)) x += "a"; // jha → jhaa
      else if (/[^i]i$/.test(x)) x += "i"; // devi → devii
      return Sanscript.t(x, "itrans", "devanagari").replace(/्$/, "");
    })
    .filter(Boolean)
    .join(" ");
}
