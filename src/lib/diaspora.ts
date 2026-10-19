/**
 * "Where we are today": the living people of a tree, grouped by the city, district, state or country they live in.
 * Pure functions — the same numbers feed the map on screen and the picture that can be shared.
 * A spot is never more exact than a city or a district; a shared picture shows counts only, never a name.
 */
import type { DFamily } from "./family";
import { locate, type GeoLevel } from "./geo-points";
import { isLiving } from "./living";

export interface SpotPerson { id: string; name: string; first: string; initials: string; place?: string }
export interface Spot { key: string; label: string; lat: number; lon: number; level: GeoLevel; count: number; people: SpotPerson[] }
export interface Diaspora {
  spots: Spot[];
  /** living people in the tree (named, not placeholders) */
  living: number;
  /** living people placed on the map */
  placed: number;
  /** living people with no place written */
  noPlace: SpotPerson[];
  /** living people whose place we could not find on the map (the words they were written with) */
  unknown: SpotPerson[];
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export function diasporaOf(f: DFamily): Diaspora {
  const spots = new Map<string, Spot>();
  const noPlace: SpotPerson[] = [], unknown: SpotPerson[] = [];
  let living = 0, placed = 0;
  for (const p of f.persons) {
    if (p.placeholder || !p.name_roman?.trim() || !isLiving(p)) continue;
    living++;
    const person: SpotPerson = { id: p.id, name: p.name_roman.trim(), first: p.name_roman.trim().split(/\s+/)[0]!, initials: initials(p.name_roman.trim()), place: p.place };
    if (!p.place?.trim()) { noPlace.push(person); continue; }
    const hit = locate(p.place);
    if (!hit) { unknown.push(person); continue; }
    placed++;
    const s = spots.get(hit.key) ?? { key: hit.key, label: hit.label, lat: hit.lat, lon: hit.lon, level: hit.level, count: 0, people: [] };
    s.count++; s.people.push(person); spots.set(hit.key, s);
  }
  return { spots: [...spots.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)), living, placed, noPlace, unknown };
}

/* ───────── drawing ───────── */
export const MAP_W = 1000, MAP_H = 500;
export const project = (lat: number, lon: number) => ({ x: ((lon + 180) * MAP_W) / 360, y: ((90 - lat) * MAP_H) / 180 });
export interface View { x: number; y: number; w: number; h: number }
export const WORLD_VIEW: View = { x: 0, y: 0, w: MAP_W, h: MAP_H };

/** the part of the world map to show: everything that was placed, with some room round it, always twice as wide as high */
export function fitView(spots: Pick<Spot, "lat" | "lon">[]): View {
  if (!spots.length) return WORLD_VIEW;
  const pts = spots.map((s) => project(s.lat, s.lon));
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  const pad = 40;
  let w = Math.max(maxX - minX + pad * 2, (maxY - minY + pad * 2) * 2, 110);
  w = Math.min(w, MAP_W);
  const h = w / 2;
  const x = Math.min(Math.max((minX + maxX) / 2 - w / 2, 0), MAP_W - w);
  const y = Math.min(Math.max((minY + maxY) / 2 - h / 2, 0), MAP_H - h);
  return { x, y, w, h };
}
export const INDIA_VIEW: View = fitView([{ lat: 36, lon: 66 }, { lat: 6, lon: 98 }]);

export function zoomView(v: View, factor: number): View {
  const w = Math.min(MAP_W, Math.max(60, v.w * factor)), h = w / 2;
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  return { x: Math.min(Math.max(cx - w / 2, 0), MAP_W - w), y: Math.min(Math.max(cy - h / 2, 0), MAP_H - h), w, h };
}

/** a marker's size in pixels grows slowly with the number of people */
export const markerSize = (count: number) => Math.round(20 + Math.min(18, Math.sqrt(count) * 6));
