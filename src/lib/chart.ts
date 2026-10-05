import type { Chart } from "family-chart";
import { toChartData, type ScopedData } from "./tree-filter";
import type { TemplateId } from "./types";
import { CREAM, INK, LEAF_PATH, MOTIFS, OCHRE, RED, framePatternDefs } from "./motifs";

export interface MountOptions {
  rootId: string;
  onSelect?: (personId: string) => void;
  /** ms; 0 for export renders */
  transition?: number;
  /** px padding around the chart area so the tree never touches the frame: [vertical, horizontal] or one value */
  inset?: number | [number, number];
  /** print render (affects text clipping so html2canvas output stays crisp) */
  exporting?: boolean;
}

export interface MountedTree {
  chart: Chart;
  frame: HTMLElement;
  fit: () => void;
  centreOn: (id: string) => void;
  /** resolves once links/leaf overlay have settled */
  settled: () => Promise<void>;
  destroy: () => void;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

const LINK_STYLE: Record<TemplateId, { stroke: string; width: number }> = {
  classic: { stroke: "#b9a98c", width: 1.6 },
  minimal: { stroke: "#111111", width: 1 },
  madhubani: { stroke: INK, width: 2.4 },
};


/** Badge as inline SVG so html2canvas renders its text exactly where the browser does. */
function badgeSvg(label: "YOU" | "SPOUSE", tpl: TemplateId) {
  const w = label === "YOU" ? 34 : 52;
  const pal: Record<TemplateId, { fill: string; stroke: string; text: string }> = {
    classic: label === "YOU" ? { fill: "#c2693f", stroke: "none", text: "#ffffff" } : { fill: "#efe5d0", stroke: "none", text: "#7a6a4c" },
    minimal: { fill: "#ffffff", stroke: "#111111", text: "#111111" },
    madhubani: label === "YOU" ? { fill: RED, stroke: INK, text: CREAM } : { fill: INK, stroke: INK, text: CREAM },
  };
  const c = pal[tpl];
  const font = tpl === "madhubani" ? "Georgia, 'Times New Roman', serif" : "Helvetica, Arial, sans-serif";
  return `<div class="pj-badge" style="width:${w}px;height:14px"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="14" viewBox="0 0 ${w} 14">
    <rect x=".5" y=".5" width="${w - 1}" height="13" rx="6.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>
    <text x="${w / 2}" y="9.8" text-anchor="middle" font-family="${font}" font-size="8.5" font-weight="700" letter-spacing=".7" fill="${c.text}">${label}</text></svg></div>`;
}

let uid = 0;

function cardInner(
  d: { data: { id: string; data: Record<string, unknown> } },
  tpl: TemplateId,
  rootId: string,
  idp: string,
) {
  const x = d.data.data as Record<string, string | boolean>;
  const gender = x.gender === "F" ? "female" : "male";
  const role = String(x.role || "");
  const isRoot = d.data.id === rootId;
  const name = String(x["first name"] ?? "");
  const origin = [x.gotra, x.mool].filter(Boolean).join(" · ");
  const panji = origin ? (role === "spouse" ? `from ${origin}` : origin) : "";
  const badge: "YOU" | "SPOUSE" | "" = isRoot ? "YOU" : role === "spouse" ? "SPOUSE" : "";
  let avatar = "";
  if (tpl === "classic") avatar = `<div class="pj-avatar">${esc(initials(name))}</div>`;
  if (tpl === "madhubani") avatar = `<div class="pj-avatar">${gender === "female" ? MOTIFS.lotus(40) : MOTIFS.sun(40)}</div>`;
  const frame =
    tpl === "madhubani"
      ? `<svg class="pj-cardframe" viewBox="0 0 164 104" xmlns="http://www.w3.org/2000/svg" fill="none">
          <rect x="1.5" y="1.5" width="161" height="101" rx="5" fill="${CREAM}" stroke="${INK}" stroke-width="2"/>
          <rect x="6" y="6" width="152" height="92" rx="3" stroke="${isRoot ? RED : OCHRE}" stroke-width="${isRoot ? 2.6 : 1.6}" class="pj-glow"/>
          <circle cx="3" cy="3" r="2" fill="${RED}"/><circle cx="161" cy="3" r="2" fill="${RED}"/>
          <circle cx="3" cy="101" r="2" fill="${RED}"/><circle cx="161" cy="101" r="2" fill="${RED}"/>
        </svg>`
      : "";
  void idp;
  return `<div class="card-inner pj-card pj-${gender} ${isRoot ? "pj-root" : ""} ${role ? "pj-" + role : ""}">
      ${frame}${avatar}
      ${badge ? badgeSvg(badge, tpl) : ""}
      <div class="pj-name" title="${esc(name)}">${esc(name)}</div>
      ${x.devanagari ? `<div class="pj-deva">${esc(x.devanagari)}</div>` : ""}
      ${x.years ? `<div class="pj-years">${esc(x.years)}</div>` : ""}
      ${panji ? `<div class="pj-panji">${esc(panji)}</div>` : ""}
    </div>`;
}

function decoration(tpl: TemplateId, idp: string) {
  if (tpl !== "madhubani") return "";
  // Double-rule border, triangle/dot pattern bands top & bottom, four corner motifs.
  const strip = (pos: string, pid: string) =>
    `<div style="position:absolute;left:16px;right:16px;${pos};height:16px;"><svg width="100%" height="16" xmlns="http://www.w3.org/2000/svg">${framePatternDefs(pid)}<rect width="100%" height="16" fill="url(#${pid})"/></svg></div>`;
  const corner = (m: string, css: string) =>
    `<div style="position:absolute;${css}width:68px;height:68px;">${m}</div>`;
  return `
    <div style="position:absolute;inset:3px;border:3px solid ${INK};"></div>
    <div style="position:absolute;inset:9px;border:1.2px solid ${INK};"></div>
    ${strip("top:14px", idp + "t")}${strip("bottom:14px", idp + "b")}
    ${corner(MOTIFS.fish(), "left:14px;top:34px;")}
    ${corner(MOTIFS.parrot(), "right:14px;top:34px;")}
    ${corner(MOTIFS.lotus(), "left:14px;bottom:34px;")}
    ${corner(MOTIFS.sun(), "right:14px;bottom:34px;")}`;
}

export async function mountTree(
  host: HTMLElement,
  scoped: ScopedData,
  tpl: TemplateId,
  opts: MountOptions,
): Promise<MountedTree> {
  const f3 = await import("family-chart");
  const d3 = await import("d3");
  const idp = `pj${++uid}`;

  host.innerHTML = "";
  const frame = document.createElement("div");
  frame.className = `pj-frame tpl-${tpl}${opts.exporting ? " pj-export" : ""}`;
  const chartEl = document.createElement("div");
  chartEl.className = "pj-chart f3";
  const inset = opts.inset ?? (tpl === "madhubani" ? [78, 18] : [16, 12]);
  const [iv, ih] = Array.isArray(inset) ? inset : [inset, inset];
  chartEl.style.inset = `${iv}px ${ih}px`;
  frame.appendChild(chartEl);
  if (tpl === "madhubani") {
    const deco = document.createElement("div");
    deco.className = "pj-deco";
    deco.innerHTML = decoration(tpl, idp);
    frame.appendChild(deco);
  }
  host.appendChild(frame);

  const chart = f3.createChart(chartEl, toChartData(scoped));
  const transition = opts.transition ?? 400;

  chart
    .setTransitionTime(transition)
    .setCardXSpacing(190)
    .setCardYSpacing(168)
    .setSingleParentEmptyCard(false)
    .setShowSiblingsOfMain(scoped.roles === undefined);

  const card = chart.setCardHtml();
  card
    .setCardInnerHtmlCreator((d) => cardInner(d as never, tpl, opts.rootId, idp))
    .setOnCardClick((_e: MouseEvent, d: { data: { id: string } }) => opts.onSelect?.(d.data.id));

  const style = LINK_STYLE[tpl];
  let leafTimer: ReturnType<typeof setTimeout> | undefined;
  const decorateLinks = () => {
    const svg = chartEl.querySelector("svg.main_svg");
    if (!svg) return;
    const sel = d3.select(svg);
    // Inline attributes (not CSS) so html2canvas can rasterise the SVG for the PDF.
    sel.selectAll<SVGPathElement, unknown>("path.link")
      .attr("stroke", style.stroke)
      .attr("stroke-width", style.width)
      .attr("stroke-linecap", "round")
      .attr("fill", "none");
    sel.select(".pj-leaves").remove();
    if (tpl !== "madhubani") return;
    const linksView = svg.querySelector(".links_view");
    if (!linksView?.parentNode) return;
    const leaves = d3.select(linksView.parentNode as SVGGElement).append("g").attr("class", "pj-leaves");
    sel.selectAll<SVGPathElement, unknown>("path.link").each((_d, i, nodes) => {
      const path = nodes[i]!;
      let len = 0;
      try { len = path.getTotalLength(); } catch { return; }
      if (!len || len < 40) return;
      const count = Math.max(1, Math.floor(len / 70));
      for (let i = 1; i <= count; i++) {
        const l = (len * i) / (count + 1);
        const p = path.getPointAtLength(l);
        const q = path.getPointAtLength(Math.min(len, l + 2));
        const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
        const side = i % 2 ? -1 : 1;
        leaves.append("path")
          .attr("d", LEAF_PATH)
          .attr("transform", `translate(${p.x},${p.y}) rotate(${ang + side * 38}) scale(${side === -1 ? 1 : 0.85})`)
          .attr("fill", i % 3 === 0 ? RED : "#3f6b3a")
          .attr("stroke", INK)
          .attr("stroke-width", 0.8);
      }
    });
  };
  chart.setAfterUpdate(() => {
    decorateLinks();
    clearTimeout(leafTimer);
    leafTimer = setTimeout(decorateLinks, transition + 60);
  });

  chart.updateMainId(scoped.main_id);
  chart.updateTree({ initial: true, tree_position: "fit" });

  const settled = () => new Promise<void>((r) => setTimeout(r, transition + 150));
  return {
    chart,
    frame,
    fit: () => chart.updateTree({ tree_position: "fit" }),
    centreOn: (id) => {
      chart.updateMainId(id);
      chart.updateTree({ tree_position: "main_to_middle" });
    },
    settled,
    destroy: () => {
      clearTimeout(leafTimer);
      host.innerHTML = "";
    },
  };
}
