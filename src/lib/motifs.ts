/**
 * Original, simple Madhubani-inspired SVG motifs (Day 1 placeholders).
 * Colours are explicit attributes (not CSS) so html2canvas can rasterise them for the PDF.
 * Swap for commissioned artwork later (see brief: ₹15–25k Mithila artist set).
 */
export const INK = "#1f2a5c"; // indigo
export const RED = "#a63a1d";
export const OCHRE = "#d99a2b";
export const GREEN = "#3f6b3a";
export const CREAM = "#fbf0d2";
export const WASH = "#f3e2b3";

const wrap = (inner: string, size?: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${
    size ? ` width="${size}" height="${size}"` : ""
  } fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;

export function sun(size?: number) {
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const a1 = a - 0.14;
    const a2 = a + 0.14;
    const pt = (ang: number, r: number) =>
      `${(50 + Math.cos(ang) * r).toFixed(1)} ${(50 + Math.sin(ang) * r).toFixed(1)}`;
    rays += `<path d="M${pt(a1, 24)} L${pt(a, 46)} L${pt(a2, 24)}" fill="${i % 2 ? RED : OCHRE}"/>`;
  }
  return wrap(
    `${rays}<circle cx="50" cy="50" r="22" fill="${OCHRE}"/><circle cx="50" cy="50" r="15" fill="${CREAM}"/><circle cx="50" cy="50" r="6" fill="${RED}"/>`,
    size,
  );
}

export function lotus(size?: number) {
  const petal = (rot: number, fill: string) =>
    `<g transform="rotate(${rot} 50 78)"><path d="M50 78 C38 60 38 36 50 16 C62 36 62 60 50 78Z" fill="${fill}"/><path d="M50 70 C45 58 45 40 50 28 C55 40 55 58 50 70Z" fill="${CREAM}"/></g>`;
  return wrap(
    `${petal(-62, OCHRE)}${petal(62, OCHRE)}${petal(-32, RED)}${petal(32, RED)}${petal(0, GREEN)}` +
      `<path d="M14 84 Q26 76 38 84 T62 84 T86 84" /><path d="M20 92 Q32 85 44 92 T68 92 T90 92" />`,
    size,
  );
}

export function fish(size?: number) {
  let scales = "";
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      scales += `<path d="M${38 + c * 9 + (r % 2) * 4} ${42 + r * 8} q4 4 0 8" stroke-width="1.4"/>`;
  return wrap(
    `<path d="M80 50 L96 32 Q91 50 96 68 Z" fill="${RED}"/>` +
      `<path d="M10 50 C28 22 66 22 82 50 C66 78 28 78 10 50Z" fill="${OCHRE}"/>` +
      `<path d="M38 30 Q50 14 62 30" fill="${GREEN}"/><path d="M40 70 Q50 84 60 70" fill="${GREEN}"/>` +
      scales +
      `<circle cx="25" cy="48" r="5" fill="${CREAM}"/><circle cx="25" cy="48" r="2" fill="${INK}"/>`,
    size,
  );
}

export function parrot(size?: number) {
  return wrap(
    `<path d="M62 62 Q80 80 92 94" stroke-width="6" stroke="${RED}"/>` +
      `<path d="M58 66 Q70 88 78 98" stroke-width="5" stroke="${GREEN}"/>` +
      `<ellipse cx="50" cy="56" rx="17" ry="27" transform="rotate(-18 50 56)" fill="${GREEN}"/>` +
      `<path d="M44 48 C58 50 66 66 60 82 C48 76 40 62 44 48Z" fill="${RED}"/>` +
      `<path d="M47 56 C54 58 58 66 55 74" stroke-width="1.4"/>` +
      `<circle cx="42" cy="26" r="12" fill="${GREEN}"/>` +
      `<path d="M34 22 Q24 26 28 38 Q36 34 38 28Z" fill="${RED}"/>` +
      `<circle cx="44" cy="23" r="3.4" fill="${CREAM}"/><circle cx="44" cy="23" r="1.4" fill="${INK}"/>` +
      `<path d="M10 90 Q40 80 70 90" stroke-width="2.4"/>`,
    size,
  );
}

export const MOTIFS = { sun, lotus, fish, parrot };

/** Small leaf drawn along branches (used by the D3 overlay). */
export const LEAF_PATH = "M0 0 C4 -5 10 -5 14 0 C10 5 4 5 0 0Z";

/** Frame pattern tile (triangles + dots) as an inline <pattern> for the Madhubani border band. */
export function framePatternDefs(id: string) {
  return `<defs><pattern id="${id}" width="22" height="16" patternUnits="userSpaceOnUse">
    <path d="M0 16 L11 2 L22 16Z" fill="${RED}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="11" cy="11" r="1.8" fill="${CREAM}"/></pattern></defs>`;
}
