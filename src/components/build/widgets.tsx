"use client";
import { INDIAN_STATES, norm, stateMatch, type PlaceHit } from "@/lib/places";
import { MONTHS } from "@/lib/dates";
/**
 * Form widgets used by the person editor and the save sheet:
 * Devanagari on-screen keyboard, date picker (calendar or year only), phone with country,
 * searchable gotra/mool lists with "Other", and place search (OpenStreetMap / Photon).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Keyboard, Loader2, MapPin, Search, X } from "lucide-react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, validatePhoneNumberLength, getExampleNumber, type CountryCode } from "libphonenumber-js/min";
import examples from "libphonenumber-js/examples.mobile.json";
import { cn } from "@/lib/utils";
import type { PanjiRef } from "@/lib/family";
import { allGotras, allMools, classify, fold, plainRoman, searchGotras, searchMools } from "@/lib/lookup";
import { lev } from "@/lib/connect";
import { romanToDevanagari } from "@/lib/translit";

export const inputCls =
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20 placeholder:text-muted-foreground/60";

export function Label({ htmlFor, children, helper }: { htmlFor?: string; children: React.ReactNode; helper?: string }) {
  return (
    <div className="mb-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground/80">{children}</label>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

/* ───────────────────────── Devanagari on-screen keyboard ───────────────────────── */

const ROWS: string[][] = [
  ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ"],
  ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "ँ"],
  ["क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ"],
  ["ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न"],
  ["प", "फ", "ब", "भ", "म", "य", "र", "ल", "व"],
  ["श", "ष", "स", "ह", "क्ष", "त्र", "ज्ञ", "ड़", "ढ़", "्"],
];

function DevKeyboard({ onKey, onBackspace }: { onKey: (k: string) => void; onBackspace: () => void }) {
  return (
    <div className="mt-2 rounded-xl border bg-secondary/50 p-2" role="group" aria-label="Devanagari keyboard" lang="hi">
      {ROWS.map((row, i) => (
        <div key={i} className="mb-1 flex flex-wrap justify-center gap-1">
          {row.map((k) => (
            <button
              key={k} type="button" tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onKey(k)}
              className="h-10 min-w-9 rounded-lg border bg-card px-2 text-lg active:bg-primary/10"
            >{k}</button>
          ))}
        </div>
      ))}
      <div className="flex gap-1">
        <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onKey(" ")} className="h-10 flex-1 rounded-lg border bg-card text-sm text-muted-foreground">space</button>
        <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onBackspace} className="h-10 w-20 rounded-lg border bg-card text-sm">⌫</button>
      </div>
    </div>
  );
}

/** Devanagari text input with an optional on-screen keyboard (phones already have a Hindi keyboard; desktops often don’t). */
export function DevInput({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [kb, setKb] = useState(false);
  const insert = (k: string) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length, e = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, s) + k + value.slice(e));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + k.length, s + k.length); });
  };
  const back = () => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length, e = el?.selectionEnd ?? value.length;
    if (s !== e) { onChange(value.slice(0, s) + value.slice(e)); return; }
    if (s === 0) return;
    const chars = [...value.slice(0, s)];
    chars.pop();
    const head = chars.join("");
    onChange(head + value.slice(s));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(head.length, head.length); });
  };
  return (
    <div>
      <div className="relative">
        <input ref={ref} className={cn(inputCls, "pr-12")} value={value} lang="hi" placeholder={placeholder ?? "देवनागरी"} aria-label={ariaLabel}
          autoComplete="off" onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-label={kb ? "Hide Devanagari keyboard" : "Show Devanagari keyboard"} aria-pressed={kb}
          onClick={() => setKb((v) => !v)}
          className={cn("absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary", kb && "bg-secondary text-primary")}>
          <Keyboard className="size-5" />
        </button>
      </div>
      {kb && <DevKeyboard onKey={insert} onBackspace={back} />}
    </div>
  );
}

/** Roman name that auto-fills the Devanagari one (editable, with on-screen keyboard). */
export function NameField({ label, roman, dev, devTouched, onChange }: {
  label: string; roman: string; dev: string; devTouched: boolean;
  onChange: (v: { roman: string; dev: string; devTouched: boolean }) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input id={id} className={inputCls} value={roman} lang="en" autoComplete="off" autoCapitalize="words" placeholder="Name in English letters"
        onChange={(e) => onChange({ roman: e.target.value, dev: devTouched ? dev : romanToDevanagari(e.target.value), devTouched })} />
      <div className="mt-2">
        <DevInput value={dev} ariaLabel={`${label} in Devanagari`} onChange={(v) => onChange({ roman, dev: v, devTouched: true })} />
        <p className="mt-1 text-xs text-muted-foreground">Devanagari fills in automatically. Tap the keyboard icon to correct it.</p>
      </div>
    </div>
  );
}

/* ───────────────────────── date: day, month, year (year alone is fine) ───────────────────────── */

const SEG = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

/**
 * Day, month and year, in that order, filled in ANY order (people often know the year first, or the day first).
 * The tree stores a partial ISO date, so the parts are kept here until the year is complete.
 */
export function DateField({ value, onChange, label, helper }: { value: string; onChange: (v: string) => void; label: string; helper?: string }) {
  const id = useId();
  const parse = (v: string) => { const m = SEG.exec(v ?? ""); return { y: m?.[1] ?? "", mo: m?.[2] ?? "", d: m?.[3] ?? "" }; };
  const [parts, setParts] = useState(() => parse(value));
  const { y, mo, d } = parts;
  const yearOk = y.length === 4;
  const compose = (p: { y: string; mo: string; d: string }) => {
    if (p.y.length < 4) return "";
    if (!p.mo) return p.y;
    return p.d ? `${p.y}-${p.mo}-${p.d}` : `${p.y}-${p.mo}`;
  };
  // a different person (or an outside edit) arrived: show its date; our own changes already match, so nothing moves
  useEffect(() => { setParts((cur) => (compose(cur) === (value ?? "") ? cur : parse(value ?? ""))); }, [value]);
  const update = (next: Partial<typeof parts>) => {
    const p = { ...parts, ...next };
    if (p.d && p.mo) {
      const max = p.y.length === 4 ? new Date(+p.y, +p.mo, 0).getDate() : new Date(2000, +p.mo, 0).getDate(); // 2000: a leap year, so 29 Feb is allowed until the year says otherwise
      if (+p.d > max) p.d = String(max).padStart(2, "0");
    }
    setParts(p);
    onChange(compose(p));
  };
  const dayCount = mo ? new Date(yearOk ? +y : 2000, +mo, 0).getDate() : 31;
  const thisYear = new Date().getFullYear();
  const bad = yearOk && (+y < 1700 || +y > thisYear);
  const sel = cn(inputCls, "appearance-none pr-7");
  return (
    <div role="group" aria-labelledby={`${id}-l`}>
      <Label htmlFor={`${id}-d`} helper={helper ?? "Day, month and year — fill in what you know, in any order. The year alone is fine."}><span id={`${id}-l`}>{label}</span></Label>
      <div className="grid grid-cols-[4.75rem_1fr_5.5rem] gap-2">
        <div className="relative">
          <select id={`${id}-d`} aria-label={`${label}: day`} className={sel} value={d} onChange={(e) => update({ d: e.target.value })}>
            <option value="">Day</option>
            {Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, "0")).map((x) => <option key={x} value={x}>{+x}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-3.5 size-4 text-muted-foreground" />
        </div>
        <div className="relative">
          <select aria-label={`${label}: month`} className={sel} value={mo} onChange={(e) => update({ mo: e.target.value })}>
            <option value="">Month</option>
            {MONTHS.map((n, i) => <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-3.5 size-4 text-muted-foreground" />
        </div>
        <input id={`${id}-y`} aria-label={`${label}: year`} className={inputCls} inputMode="numeric" autoComplete="off" placeholder="Year" maxLength={4} value={y}
          onChange={(e) => update({ y: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
      </div>
      {bad && <p className="mt-1 text-xs text-terracotta">Please enter a year between 1700 and {thisYear}.</p>}
      {!yearOk && (mo || d || y) && !bad && <p className="mt-1 text-xs text-muted-foreground">Add the 4-digit year to save this date.</p>}
      {yearOk && d && !mo && <p className="mt-1 text-xs text-muted-foreground">Choose the month too to keep the day.</p>}
    </div>
  );
}

/* ───────────────────────── phone: country + number ───────────────────────── */

const PREFERRED: CountryCode[] = ["IN", "NP", "US", "GB", "AE", "CA", "AU", "CH", "DE", "SG", "SA", "QA", "KW", "OM", "BH", "MY", "NZ"];

export interface PhoneValue { country: CountryCode; national: string }
export const phoneState = (v: PhoneValue) => {
  const digits = v.national.replace(/\D/g, "");
  if (!digits) return { valid: false, e164: "", error: "" };
  const parsed = parsePhoneNumberFromString(digits, v.country);
  const len = validatePhoneNumberLength(digits, v.country);
  const ex = getExampleNumber(v.country, examples)?.nationalNumber.length;
  const error = len === "TOO_SHORT" ? `Too short${ex ? ` — numbers here have ${ex} digits` : ""}` : len === "TOO_LONG" ? `Too long${ex ? ` — numbers here have ${ex} digits` : ""}` : len ? "Check the number" : parsed && !parsed.isValid() ? "That number doesn’t look right for this country" : "";
  return { valid: !!parsed?.isValid(), e164: parsed?.number ?? "", error };
};

export function PhoneField({ value, onChange }: { value: PhoneValue; onChange: (v: PhoneValue) => void }) {
  const id = useId();
  // country names depend on the browser's language data, so they are filled in after mount (keeps server and browser HTML identical)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const names = useMemo(() => {
    const dn = mounted && typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    const all = getCountries().map((c) => ({ c, name: dn?.of(c) ?? c, code: getCountryCallingCode(c) }));
    const pref = PREFERRED.map((c) => all.find((x) => x.c === c)!).filter(Boolean);
    const rest = all.filter((x) => !PREFERRED.includes(x.c)).sort((a, b) => a.name.localeCompare(b.name));
    return { pref, rest };
  }, [mounted]);
  const st = phoneState(value);
  const maxLen = Math.min(15, (getExampleNumber(value.country, examples)?.nationalNumber.length ?? 12) + 2);
  return (
    <div>
      <Label htmlFor={id}>Mobile number</Label>
      <div className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-2">
        <div className="relative">
          <select aria-label="Country" className={cn(inputCls, "appearance-none pr-8")} value={value.country}
            onChange={(e) => onChange({ country: e.target.value as CountryCode, national: value.national })}>
            <optgroup label="Common">
              {names.pref.map((x) => <option key={x.c} value={x.c}>{x.name} (+{x.code})</option>)}
            </optgroup>
            <optgroup label="All countries">
              {names.rest.map((x) => <option key={x.c} value={x.c}>{x.name} (+{x.code})</option>)}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 size-4 text-muted-foreground" />
        </div>
        <input id={id} className={inputCls} inputMode="tel" autoComplete="tel-national" placeholder="Mobile number" value={value.national}
          onChange={(e) => onChange({ country: value.country, national: e.target.value.replace(/[^\d\s-]/g, "").slice(0, maxLen + 4) })} />
      </div>
      <p className={cn("mt-1 text-xs", st.error ? "text-terracotta" : "text-muted-foreground")}>
        {st.error || (st.valid ? "Looks good." : `Country code +${getCountryCallingCode(value.country)} is added automatically.`)}
      </p>
    </div>
  );
}

/* ───────────────────────── searchable Panji lists, with "Other" ───────────────────────── */

type Kind = "gotra" | "mool";
const KIND_LABEL: Record<Kind, string> = { gotra: "gotra", mool: "mool" };

interface Row { id: string; dev: string; roman: string; note?: string; score?: number; extra?: boolean }

export function SearchSelect({ kind, value, onChange, gotraId, placeholder }: {
  kind: Kind; value?: PanjiRef; onChange: (v?: PanjiRef) => void; gotraId?: string; placeholder?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rows: Row[] = useMemo(() => {
    const note = (extra?: boolean, mine?: boolean) => (extra ? "added by a user" : mine ? "your gotra" : undefined);
    if (!q.trim()) {
      if (kind === "gotra") return allGotras().map((g) => ({ id: g.id, dev: g.dev, roman: plainRoman(g.roman), note: note(g.extra), extra: g.extra }));
      const all = allMools().map((m) => ({ id: m.id, dev: m.dev, roman: plainRoman(m.roman), note: note(m.extra, !!gotraId && m.gotras.includes(gotraId)), extra: m.extra, mine: !!gotraId && m.gotras.includes(gotraId) }));
      return all.sort((a, b) => Number(b.mine) - Number(a.mine) || a.roman.localeCompare(b.roman));
    }
    if (kind === "gotra") return searchGotras(q, 20).map((h) => ({ id: h.item.id, dev: h.item.dev, roman: plainRoman(h.item.roman), note: note(h.item.extra), extra: h.item.extra, score: h.score }));
    return searchMools(q, { gotraId, limit: 25 }).map((h) => ({ id: h.item.id, dev: h.item.dev, roman: plainRoman(h.item.roman), note: note(h.item.extra, !!gotraId && h.item.gotras.includes(gotraId)), extra: h.item.extra, score: h.score }));
  }, [q, kind, gotraId]);
  const top = q.trim() ? classify(rows.map((r) => ({ item: r, score: r.score ?? 0 }))) : null;

  const pick = (r: Row) => { onChange({ id: r.id, roman: r.roman, dev: r.dev }); setOpen(false); setQ(""); };
  const [similar, setSimilar] = useState(false);
  useEffect(() => setSimilar(false), [q]);
  const addCustom = (force = false) => {
    const roman = q.trim();
    if (!roman) return;
    if (!force && rows[0] && (rows[0].score ?? 0) >= 0.7 && (rows[0].score ?? 0) < 0.95) { setSimilar(true); return; }
    onChange({ roman, dev: /[ऀ-ॿ]/.test(roman) ? roman : romanToDevanagari(roman), custom: true });
    setOpen(false); setQ("");
  };

  useEffect(() => { if (open) listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [open]);

  if (value && !open) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{value.dev && <span lang="hi">{value.dev}</span>}{value.dev && " · "}{value.roman}</div>
          {value.custom && <div className="text-xs text-terracotta">New entry — our team will review it</div>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-secondary">Change</button>
          <button type="button" aria-label={`Clear ${KIND_LABEL[kind]}`} onClick={() => onChange(undefined)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
        <input id={id} className={cn(inputCls, "pl-11")} placeholder={placeholder ?? `Search ${KIND_LABEL[kind]} — English or देवनागरी`} value={q} autoComplete="off"
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      </div>
      {open && (
        <div ref={listRef} className="mt-1.5 overflow-hidden rounded-xl border bg-card">
          {top?.status === "likely" && rows[0] && (
            <button type="button" onClick={() => pick(rows[0]!)} className="flex w-full items-center gap-2 border-b bg-primary/5 px-4 py-3 text-left text-sm">
              <Check className="size-4 text-primary" /> Did you mean <strong lang="hi">{rows[0].dev}</strong> ({rows[0].roman})?
            </button>
          )}
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(r)} className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left hover:bg-secondary">
                  <span><span lang="hi" className="text-base font-medium">{r.dev}</span> <span className="text-sm text-muted-foreground">· {r.roman}</span></span>
                  {r.note && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-primary">{r.note}</span>}
                </button>
              </li>
            ))}
            {!rows.length && <li className="px-4 py-3 text-sm text-muted-foreground">No match in our list.</li>}
          </ul>
          {similar && rows[0] && (
            <div className="space-y-2 border-t bg-amber-50 px-4 py-3 text-sm">
              <p>“{q.trim()}” looks close to <strong lang="hi">{rows[0].dev}</strong> ({rows[0].roman}). Is it the same?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => pick(rows[0]!)} className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground">Yes, use {rows[0].roman}</button>
                <button type="button" onClick={() => addCustom(true)} className="rounded-lg border bg-card px-3 py-2 font-medium">No, add mine as new</button>
              </div>
            </div>
          )}
          <button type="button" disabled={!q.trim()} onClick={() => addCustom()}
            className="w-full border-t px-4 py-3 text-left text-sm font-medium text-primary hover:bg-secondary disabled:text-muted-foreground disabled:hover:bg-transparent">
            {q.trim() ? <>Other: add “{q.trim()}” as my {KIND_LABEL[kind]}</> : <>Not listed? Type it above, then tap “Other”.</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── place: village, district, state (suggestions from OpenStreetMap / Photon; typing always works) ───────────────────────── */

interface PhotonFeature { properties: { name?: string; district?: string; county?: string; state?: string; country?: string; countrycode?: string; osm_value?: string } }

export { INDIAN_STATES };
export const BIHAR_DISTRICTS = ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"];


/** "Village, District, State" — never a street address. Outside India: "City, Country". */
export function placeLabel(p: PhotonFeature["properties"], india: boolean) {
  const parts = india ? [p.name, p.district || p.county, p.state] : [p.name, p.state, p.country];
  const out: string[] = [];
  for (const x of parts) if (x && !out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  return out.join(", ");
}

/** does the map's place name really look like what was typed? (the map service also returns places that merely lie nearby or are better known, e.g. "Madhubani" for the village "Kothiya") */
export function resembles(found: string, typed: string) {
  const x = fold(found), y = fold(typed);
  if (!x || !y) return false;
  if (x === y || x.startsWith(y) || y.startsWith(x)) return true;
  return y.length >= 4 && lev(x.slice(0, y.length + 1), y) <= Math.max(1, Math.floor(y.length / 4));
}

export function parsePlace(value: string) {
  const parts = value.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return { india: true, a: "", b: "", c: "" };
  const saidIndia = parts.length > 1 && /^india$/i.test(parts[parts.length - 1]!);
  if (saidIndia) parts.pop();                                                                 // "Behta, India" is in India, "India" is not a district
  const lastState = parts.length > 1 ? stateMatch(parts[parts.length - 1]!) : undefined;
  if (parts.length === 1) return { india: true, a: parts[0]!, b: "", c: "" };
  if (parts.length >= 3 && lastState) return { india: true, a: parts[0]!, b: parts.slice(1, -1).join(", "), c: lastState };
  if (parts.length === 2 && lastState) return { india: true, a: parts[0]!, b: "", c: lastState };
  if (saidIndia) return { india: true, a: parts[0]!, b: parts.slice(1).join(", "), c: "" };
  if (parts.length === 2) return { india: false, a: parts[0]!, b: "", c: parts[1]! };       // "Zurich, Switzerland"
  return { india: false, a: parts[0]!, b: parts.slice(1, -1).join(", "), c: parts[parts.length - 1]! }; // "Opfikon, Zurich, Switzerland"
}

/** does the server have a Google Places key? (asked once; "off" is remembered so no further calls are made) */
let googleState: "unknown" | "on" | "off" = "unknown";

export function PlaceField({ value, onChange, helper, label }: { value: string; onChange: (v: string) => void; helper?: string; label?: string }) {
  const id = useId();
  const [f, setF] = useState(() => parsePlace(value));
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PlaceHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [google, setGoogle] = useState(false);
  const { india, a, b, c } = f;
  const compose = (x: typeof f) => (x.a.trim() || x.b.trim() ? [x.a, x.b, x.c].map((p) => p.trim()).filter(Boolean).join(", ") : "");
  // another person's place arrived: show it; our own edits already match, so nothing moves
  useEffect(() => { setF((cur) => (compose(cur) === (value ?? "").trim() ? cur : parsePlace(value ?? ""))); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (next: Partial<typeof f>) => { const x = { ...f, ...next }; setF(x); onChange(compose(x)); };
  const pick = (h: PlaceHit) => { const x = { india: h.in ?? india, a: h.a, b: h.b, c: h.c }; setF(x); onChange(compose(x)); setOpen(false); };

  // suggestions while typing the village: Photon looks things up by name, so we add the district/state when they are known
  useEffect(() => {
    const text = a.trim();
    if (!open || text.length < 3) { setRemote([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true); setFailed(false);
      const ask = async (q: string, tagged: boolean) => {
        const u = new URL("https://photon.komoot.io/api/");
        u.searchParams.set("q", q); u.searchParams.set("limit", "12"); u.searchParams.set("lang", "en");
        if (tagged) u.searchParams.set("osm_tag", "place");
        if (india) { u.searchParams.set("bbox", "68.1,6.5,97.5,35.7"); u.searchParams.set("lat", "26.1"); u.searchParams.set("lon", "86.0"); u.searchParams.set("location_bias_scale", "0.4"); }
        const res = await fetch(u, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { features: PhotonFeature[] };
        const seen = new Set<string>();
        const out: PlaceHit[] = [];
        for (const ft of json.features) {
          const p = ft.properties;
          if (india && p.countrycode !== "IN") continue;
          const here = india || p.countrycode === "IN"; // a place in India found while "Outside India" is on is still offered, as an Indian place
          const hit: PlaceHit = here ? { a: p.name ?? "", b: (p.district || p.county || "").replace(/\s+district$/i, ""), c: stateMatch(p.state ?? "") ?? p.state ?? "", in: true } : { a: p.name ?? "", b: "", c: p.country ?? "", in: false };
          const key = `${hit.a}|${hit.b}|${hit.c}`.toLowerCase();
          if (hit.a && !seen.has(key)) { seen.add(key); out.push(hit); }
        }
        return out;
      };
      try {
        const extra = india ? [b, c].filter(Boolean).join(" ") : c;
        // Google Places (through our server, which holds the key) when it is switched on; otherwise the free OpenStreetMap service below
        if (googleState !== "off") {
          try {
            const g = await fetch(`/api/places?${new URLSearchParams({ q: extra ? `${text} ${extra}` : text, in: india ? "1" : "0" })}`, { signal: ctl.signal, cache: "no-store" });
            const gj = (await g.json()) as { provider?: string; hits?: PlaceHit[] };
            if (gj.provider === "off") googleState = "off";
            else if (gj.provider === "google") {
              googleState = "on";
              const want = (h: PlaceHit) => (b && norm(h.b) === norm(b) ? 2 : 0) + (c && norm(h.c) === norm(c) ? 1 : 0);
              setRemote([...(gj.hits ?? [])].sort((x, y) => want(y) - want(x)).slice(0, 6)); setGoogle(true);
              return;
            }
          } catch (e) { if ((e as Error).name === "AbortError") return; }
        }
        setGoogle(false);
        let out = await ask(extra ? `${text} ${extra}` : text, true);
        if (!out.length) out = await ask(extra ? `${text} ${extra}` : `${text}${india ? " Bihar" : ""}`, false); // not tagged as a "place" in the map data: look more widely
        if (!out.length && extra) out = await ask(text, false);
        // prefer the district/state the reader already chose
        const want = (h: PlaceHit) => (b && norm(h.b) === norm(b) ? 2 : 0) + (c && norm(h.c) === norm(c) ? 1 : 0);
        setRemote(out.filter((h) => resembles(h.a, text)).sort((x, y) => want(y) - want(x)).slice(0, 6));
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setFailed(true); setRemote([]); }
      } finally { setBusy(false); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [a, b, c, open, india]);

  const districtList = india && (!c || norm(c) === "bihar") ? BIHAR_DISTRICTS : [];
  return (
    <div>
      <Label htmlFor={`${id}-a`} helper={helper ?? (india ? "Village or town, district and state — no street address needed." : "City and country — no street address needed.")}>{label ?? (india ? "Village or town" : "City")}</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
        <input id={`${id}-a`} className={cn(inputCls, "pl-11")} value={a} autoComplete="off" placeholder={india ? "Village or town, e.g. Behta" : "City"}
          onFocus={() => setOpen(true)} onChange={(e) => { update({ a: e.target.value }); setOpen(true); }} />
        {busy && <Loader2 className="absolute right-3.5 top-3.5 size-5 animate-spin text-muted-foreground" />}
      </div>
      {open && (remote.length > 0 || failed || (!busy && a.trim().length >= 3)) && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border bg-card" role="listbox" aria-label="Suggested places">
          {remote.map((h) => (
            <li key={`${h.a}|${h.b}|${h.c}|${h.n ?? ""}`}><button type="button" onClick={() => pick(h)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-secondary">
              <span className="font-medium">{h.a}</span><span className="text-muted-foreground">{[h.b, h.c].filter(Boolean).map((x) => `, ${x}`).join("")}</span>
              {h.n && <span className="block text-xs text-muted-foreground/80">{h.n} block</span>}
            </button></li>
          ))}
          {google && remote.length > 0 && <li className="px-4 pt-1 text-right text-[10px] text-muted-foreground">Powered by Google</li>}
          {failed && <li className="px-4 py-2.5 text-xs text-muted-foreground">Place suggestions aren’t reachable right now — please fill in the district and state below.</li>}
          {/* a small village is often not on the map: the name as typed always stays, and only district and state are filled in below */}
          {!busy && a.trim().length >= 3 && (
            <li><button type="button" onClick={() => setOpen(false)} className="block w-full border-t px-4 py-2.5 text-left text-sm hover:bg-secondary">
              <span className="font-medium">Keep “{a.trim()}”</span><span className="text-muted-foreground"> as the village{india ? " — then choose the district and state below" : ""}</span>
            </button></li>
          )}
        </ul>
      )}
      {india ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-b`} className="text-xs font-medium text-foreground/70">District</label>
            <input id={`${id}-b`} className={inputCls} value={b} autoComplete="off" list={districtList.length ? `${id}-dl` : undefined} placeholder="e.g. Madhubani"
              onFocus={() => setOpen(false)} onChange={(e) => update({ b: e.target.value })} />
            {districtList.length > 0 && <datalist id={`${id}-dl`}>{districtList.map((d) => <option key={d} value={d} />)}</datalist>}
          </div>
          <div>
            <label htmlFor={`${id}-c`} className="text-xs font-medium text-foreground/70">State</label>
            <div className="relative">
              <select id={`${id}-c`} className={cn(inputCls, "appearance-none pr-8")} value={c} onChange={(e) => update({ c: e.target.value })} onFocus={() => setOpen(false)}>
                <option value="">Choose state</option>
                {INDIAN_STATES.map((x) => <option key={x} value={x}>{x}</option>)}
                {c && !INDIAN_STATES.includes(c) && <option value={c}>{c}</option>}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3.5 size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <label htmlFor={`${id}-c`} className="text-xs font-medium text-foreground/70">Country</label>
          <input id={`${id}-c`} className={inputCls} value={c} autoComplete="off" placeholder="e.g. Switzerland" onFocus={() => setOpen(false)} onChange={(e) => update({ c: e.target.value })} />
        </div>
      )}
      <div className="mt-1 flex justify-end text-xs">
        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => { const x = india ? { india: false, a, b: "", c: "" } : { india: true, a, b: "", c: "" }; setF(x); onChange(compose(x)); setRemote([]); }}>
          {india ? "Outside India?" : "Back to India"}
        </button>
      </div>
    </div>
  );
}
