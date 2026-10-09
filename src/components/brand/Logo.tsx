/**
 * The PAAG Foundation mark and logo — one source for the whole site (header, footer, sign-in, preview pictures, printed trees).
 * The mark is drawn in the Mithila (Madhubani) manner: the paag (the cap worn as a mark of honour; PAAG sounds like paag) is the frame —
 * a dome on a decorated red band — and a tree of life grows inside it. Every flower is a person (a node) and the dotted lines between
 * them are the links: a family tree and a graph in one picture. The word पाग is set in Mithilakshar (Tirhuta script).
 * Everything is drawn with plain lines and shapes (no font needed), so it looks the same on every phone and printer.
 * Files for other uses are in /public/brand (made by scripts/build-brand.tsx).
 *
 * Detail levels: "full" (dotted halo, leaves, links, fish — for big uses), "icon" (the everyday size) and "tiny" (favicon).
 */
import type { ReactElement } from "react";
import { PAAG_TIRHUTA, PAAG_TIRHUTA_H, PAAG_TIRHUTA_W } from "./mithilakshar";

export const BRAND = { indigo: "#1f2a5c", ochre: "#d99a2b", terracotta: "#c4452a", cream: "#fbf0d2", green: "#2f7a4d" } as const;
const { indigo: IND, ochre: OCH, terracotta: TER, cream: CRM, green: GRN } = BRAND;

type Detail = "full" | "icon" | "tiny";

/* the Mithila paag in a 400-unit drawing: a dome on a decorated band */
const DOME = "M64 232 C56 112 132 42 200 42 C268 42 344 112 336 232 Z";
const BAND = "M44 226 H356 Q366 226 366 236 L363 280 Q362 290 352 290 H48 Q38 290 37 280 L34 236 Q34 226 44 226 Z";

const flower = (k: string, cx: number, cy: number, r: number, petals = 8, fill: string = OCH, sw = 1.6) => [
  ...Array.from({ length: petals }, (_, i) => (
    <ellipse key={`${k}p${i}`} cx={cx} cy={+(cy - r * 0.62).toFixed(2)} rx={+(r * 0.34).toFixed(2)} ry={+(r * 0.55).toFixed(2)} fill={fill} stroke={IND} strokeWidth={sw} transform={`rotate(${(i * 360) / petals} ${cx} ${cy})`} />
  )),
  <circle key={`${k}c`} cx={cx} cy={cy} r={+(r * 0.42).toFixed(2)} fill={TER} stroke={IND} strokeWidth={sw} />,
  <circle key={`${k}d`} cx={cx} cy={cy} r={+(r * 0.14).toFixed(2)} fill={CRM} />,
];

const leaf = (k: string, x: number, y: number, ang: number, L = 15, W = 5.5) => (
  <g key={k} transform={`translate(${x} ${y}) rotate(${ang})`}>
    <path d={`M0 0 C${L * 0.3} ${-W} ${L * 0.7} ${-W} ${L} 0 C${L * 0.7} ${W} ${L * 0.3} ${W} 0 0Z`} fill={GRN} stroke={IND} strokeWidth={1.4} />
    <path d={`M2 0 H${L * 0.8}`} stroke={CRM} strokeWidth={1} />
  </g>
);

const fish = (k: string, x: number, flip?: boolean) => (
  <g key={k} transform={`translate(${x} 328) scale(${flip ? -1 : 1} 1)`}>
    <path d="M0 0 L-17 -13 Q-11 0 -17 13 Z" fill={TER} stroke={IND} strokeWidth={2} strokeLinejoin="round" />
    <path d="M0 0 C18 -19 46 -19 64 0 C46 19 18 19 0 0Z" fill={OCH} stroke={IND} strokeWidth={2.4} />
    <path d="M14 -9 Q22 0 14 9 M24 -12 Q32 0 24 12 M34 -11 Q42 0 34 11" fill="none" stroke={IND} strokeWidth={1.5} />
    <circle cx={54} cy={-3} r={3.2} fill={CRM} stroke={IND} strokeWidth={1.4} />
    <circle cx={54.6} cy={-3} r={1.3} fill={IND} />
    <path d="M22 -12 Q34 -24 44 -12" fill={TER} stroke={IND} strokeWidth={1.6} />
  </g>
);

/* branches of the tree of life: left side (the right side is the mirror), tip positions and flower sizes */
const BRANCHES = [
  { d: "M200 214 C176 214 160 206 146 192", x: 146, y: 192, r: 11 },
  { d: "M200 178 C172 176 142 166 118 150", x: 118, y: 150, r: 12 },
  { d: "M200 140 C176 138 140 128 122 108", x: 122, y: 108, r: 11 },
  { d: "M200 104 C186 100 172 92 162 76", x: 162, y: 76, r: 10 },
] as const;
const LEAVES = [[186, 213, -150], [170, 208, -62], [180, 177, -150], [150, 170, -58], [140, 160, -130], [186, 139, -150], [160, 134, -58], [146, 125, -125], [190, 103, -150], [176, 92, -65]] as const;

/** the drawing in 400-unit space: plain elements (not components) so the preview-picture renderer can use it too */
function art(detail: Detail) {
  const full = detail === "full", tiny = detail === "tiny";
  const o: ReactElement[] = [];
  const dbl = (k: string, d: string, fill: string, w: number) => {
    o.push(<path key={`${k}a`} d={d} fill={fill} stroke={IND} strokeWidth={w} strokeLinejoin="round" />);
    if (!tiny) o.push(<path key={`${k}b`} d={d} fill="none" stroke={CRM} strokeWidth={Math.max(2.2, w * 0.28)} strokeLinejoin="round" />);
  };
  if (full) o.push(<path key="halo" d={DOME} transform="translate(200 232) scale(1.13 1.1) translate(-200 -232)" fill="none" stroke={OCH} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="0.1 10" />);
  dbl("dome", DOME, CRM, tiny ? 14 : 10);
  // stem
  o.push(<path key="stem" d="M200 230 V62" stroke={IND} strokeWidth={tiny ? 14 : 9} strokeLinecap="round" />);
  if (!tiny) o.push(<path key="stemi" d="M200 230 V66" stroke={CRM} strokeWidth={2.4} />);
  if (tiny) {
    for (const [x, y, r] of [[142, 176, 24], [258, 176, 24], [200, 92, 30]] as const) {
      o.push(<line key={`t${x}`} x1={200} y1={y + 30} x2={x} y2={y} stroke={IND} strokeWidth={12} strokeLinecap="round" />);
      o.push(<circle key={`tc${x}`} cx={x} cy={y} r={r} fill={OCH} stroke={IND} strokeWidth={9} />);
    }
  } else {
    for (const [i, b] of BRANCHES.entries()) {
      o.push(<path key={`bl${i}`} d={b.d} fill="none" stroke={IND} strokeWidth={4.6} strokeLinecap="round" />);
      o.push(<path key={`br${i}`} d={b.d} transform="translate(400 0) scale(-1 1)" fill="none" stroke={IND} strokeWidth={4.6} strokeLinecap="round" />);
    }
    if (full) {
      for (const [i, [x, y, a]] of LEAVES.entries()) { o.push(leaf(`ll${i}`, x, y, a)); o.push(leaf(`lr${i}`, 400 - x, y, 180 - a)); }
      for (const [i, b] of BRANCHES.entries()) o.push(<path key={`lk${i}`} d={`M${b.x + 13} ${b.y} H${400 - b.x - 13}`} stroke={TER} strokeWidth={2.2} strokeDasharray="0.1 6" strokeLinecap="round" />);
    }
    for (const [i, b] of BRANCHES.entries()) { o.push(...flower(`fl${i}`, b.x, b.y, b.r + (full ? 0 : 3))); o.push(...flower(`fr${i}`, 400 - b.x, b.y, b.r + (full ? 0 : 3))); }
    o.push(...flower("top", 200, 62, full ? 15 : 18, 10));
  }
  // the band
  dbl("band", BAND, TER, tiny ? 14 : 10);
  if (!tiny) {
    if (full) o.push(<path key="bd" d="M52 258 H348" stroke={CRM} strokeWidth={1.6} strokeDasharray="1 5" strokeLinecap="round" />);
    for (let i = 0; i < 13; i++) {
      const x = 62 + i * 23;
      o.push(<path key={`dm${i}`} d={`M${x} 244 l7 6 l-7 6 l-7 -6Z`} fill={OCH} stroke={IND} strokeWidth={1.3} />);
      if (full && i % 2 === 0) o.push(<path key={`dn${i}`} d={`M${x} 262 l7 6 l-7 6 l-7 -6Z`} fill={CRM} stroke={IND} strokeWidth={1.3} />);
    }
  }
  if (full) { o.push(fish("fl", 66)); o.push(fish("fr", 334, true)); }
  return o;
}

/** crop of the drawing for each level of detail */
const VIEW: Record<Detail, [number, number, number, number]> = { full: [30, 14, 340, 346], icon: [30, 36, 340, 262], tiny: [30, 30, 340, 270] };

/** the paag with its tree of life, no background. `size` is the height in pixels. */
export function PaagMark({ size = 40, simple, detail, className, title = "PAAG Foundation" }: { size?: number; simple?: boolean; detail?: Detail; className?: string; title?: string }) {
  const lvl: Detail = detail ?? (simple ? "tiny" : size >= 220 ? "full" : "icon");
  const [x, y, w, h] = VIEW[lvl];
  return (
    <svg width={+((size * w) / h).toFixed(1)} height={size} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={title} className={className}>
      {art(lvl)}
    </svg>
  );
}

/** square badge on cream — the favicon, the app icon, the little picture on printed trees */
export function PaagBadge({ size = 64, tiny, className, title = "PAAG Foundation" }: { size?: number; tiny?: boolean; className?: string; title?: string }) {
  const lvl: Detail = tiny ? "tiny" : "icon";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} className={className}>
      <rect width="100" height="100" rx="20" fill={CRM} />
      <rect x="1.5" y="1.5" width="97" height="97" rx="18.5" fill="none" stroke={IND} strokeWidth="3" />
      <svg x="10" y="14" width="80" height="72" viewBox={`${VIEW[lvl][0]} ${VIEW[lvl][1]} ${VIEW[lvl][2]} ${VIEW[lvl][3]}`} preserveAspectRatio="xMidYMid meet">{art(lvl)}</svg>
    </svg>
  );
}

const MARK_ASPECT = VIEW.icon[2] / VIEW.icon[3];
const WORD_H = 34, WORD_S = WORD_H / PAAG_TIRHUTA_H;
const WORD_W = PAAG_TIRHUTA_W * WORD_S;

/** the lockup: the mark, the word पाग in Mithilakshar, and "PAAG FOUNDATION" under it.
 *  `onDark`: cream letters for an indigo background. Give it a height, e.g. h-10. `foundation={false}` leaves out the small line of letters. */
export function PaagLogo({ height = 40, onDark, className, foundation = true }: { height?: number; onDark?: boolean; className?: string; foundation?: boolean }) {
  const ink = onDark ? CRM : IND, sub = onDark ? OCH : TER;
  const markW = 64 * MARK_ASPECT, tx = markW + 12;
  const width = tx + Math.max(WORD_W, foundation ? 128 : 0) + 4;
  const [x, y, w, h] = VIEW.icon;
  const top = foundation ? 5 : (64 - WORD_H) / 2;
  return (
    <svg height={height} width={+((height * width) / 64).toFixed(1)} viewBox={`0 0 ${+width.toFixed(1)} 64`} role="img" aria-label="PAAG Foundation — Panji Ancestry & Graph" className={className}>
      <svg x="0" y="0" width={+markW.toFixed(1)} height="64" viewBox={`${x} ${y} ${w} ${h}`}>{art("icon")}</svg>
      <path d={PAAG_TIRHUTA} transform={`translate(${+tx.toFixed(1)} ${+(top + WORD_H).toFixed(1)}) scale(${+WORD_S.toFixed(4)})`} fill={ink} stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
      {foundation && <text x={+(tx + 1).toFixed(1)} y="58" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9.4" letterSpacing="2.7" fill={sub} fontWeight="700">PAAG FOUNDATION</text>}
    </svg>
  );
}
