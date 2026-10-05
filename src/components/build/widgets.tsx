"use client";
/**
 * Form widgets used by the person editor and the save sheet:
 * Devanagari on-screen keyboard, date picker (calendar or year only), phone with country,
 * searchable gotra/mool lists with "Other", and place search (OpenStreetMap / Photon).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, Check, ChevronDown, Keyboard, Loader2, MapPin, Search, X } from "lucide-react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, validatePhoneNumberLength, getExampleNumber, type CountryCode } from "libphonenumber-js/min";
import examples from "libphonenumber-js/examples.mobile.json";
import { cn } from "@/lib/utils";
import type { PanjiRef } from "@/lib/family";
import { allGotras, allMools, classify, plainRoman, searchGotras, searchMools } from "@/lib/lookup";
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

/* ───────────────────────── date: year, or pick from a calendar ───────────────────────── */

const todayIso = () => new Date().toISOString().slice(0, 10);

export function DateField({ value, onChange, label, helper }: { value: string; onChange: (v: string) => void; label: string; helper?: string }) {
  const id = useId();
  const isFull = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return (
    <div>
      <Label htmlFor={id} helper={helper ?? "Type just the year, or pick a full date from the calendar."}>{label}</Label>
      <div className="relative">
        <input id={id} className={cn(inputCls, "pr-14")} inputMode="numeric" autoComplete="off" placeholder="Year, e.g. 1958" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))} />
        {/* the native date input sits invisibly on top of the button, so a tap opens the system calendar on every device */}
        <span className="pointer-events-none absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg bg-secondary text-primary">
          <Calendar className="size-5" />
        </span>
        <input type="date" aria-label={`${label}: open calendar`} min="1700-01-01" max={todayIso()} value={isFull ? value : ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute right-1.5 top-1.5 size-9 cursor-pointer opacity-0" />
      </div>
      {value && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) && value.length >= 4 && <p className="mt-1 text-xs text-terracotta">Use a year like 1958, or YYYY-MM-DD.</p>}
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
  const names = useMemo(() => {
    const dn = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    const all = getCountries().map((c) => ({ c, name: dn?.of(c) ?? c, code: getCountryCallingCode(c) }));
    const pref = PREFERRED.map((c) => all.find((x) => x.c === c)!).filter(Boolean);
    const rest = all.filter((x) => !PREFERRED.includes(x.c)).sort((a, b) => a.name.localeCompare(b.name));
    return { pref, rest };
  }, []);
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

/* ───────────────────────── place search (OpenStreetMap via Photon): village, district, state only ───────────────────────── */

interface PhotonFeature { properties: { name?: string; district?: string; county?: string; state?: string; country?: string; countrycode?: string; osm_value?: string } }

/** "Village, District, State" — never a street address. Outside India: "City, Country". */
export function placeLabel(p: PhotonFeature["properties"], india: boolean) {
  const parts = india ? [p.name, p.district || p.county, p.state] : [p.name, p.state, p.country];
  const out: string[] = [];
  for (const x of parts) if (x && !out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  return out.join(", ");
}

export function PlaceField({ value, onChange, helper, label }: { value: string; onChange: (v: string) => void; helper?: string; label?: string }) {
  const id = useId();
  const [india, setIndia] = useState(true);
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const text = q.trim();
    if (!open || text.length < 3) { setRemote([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true); setFailed(false);
      try {
        const u = new URL("https://photon.komoot.io/api/");
        u.searchParams.set("q", text); u.searchParams.set("limit", "10"); u.searchParams.set("lang", "en"); u.searchParams.set("osm_tag", "place");
        if (india) { u.searchParams.set("bbox", "68.1,6.5,97.5,35.7"); u.searchParams.set("lat", "25.9"); u.searchParams.set("lon", "85.6"); u.searchParams.set("location_bias_scale", "0.3"); }
        const res = await fetch(u, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { features: PhotonFeature[] };
        const seen = new Set<string>();
        const out = json.features
          .filter((f) => !india || f.properties.countrycode === "IN")
          .map((f) => placeLabel(f.properties, india))
          .filter((s) => s && !seen.has(s) && seen.add(s));
        setRemote(out.slice(0, 6));
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setFailed(true); setRemote([]); }
      } finally { setBusy(false); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open, india]);

  const choose = (s: string) => { onChange(s); setQ(s); setOpen(false); };
  useEffect(() => { if (open && (remote.length || failed)) listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [open, remote, failed]);
  return (
    <div>
      <Label htmlFor={id} helper={helper ?? (india ? "Village, district and state — no street address needed." : "City and country.")}>{label ?? "Village or city"}</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" />
        <input id={id} className={cn(inputCls, "pl-11")} value={q} autoComplete="off" placeholder={india ? "Start typing the village name" : "City, country"}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }} />
        {busy && <Loader2 className="absolute right-3.5 top-3.5 size-5 animate-spin text-muted-foreground" />}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{india ? "Searching places in India" : "Searching worldwide"}</span>
        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setIndia((v) => !v)}>
          {india ? "Outside India?" : "Back to India"}
        </button>
      </div>
      {open && (remote.length > 0 || failed || q.trim().length >= 3) && (
        <ul ref={listRef} className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border bg-card" role="listbox">
          {remote.map((s) => <li key={s}><button type="button" onClick={() => choose(s)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-secondary">{s}</button></li>)}
          {failed && <li className="px-4 py-2.5 text-xs text-muted-foreground">Place search isn’t reachable right now — type it as “Village, District, State”.</li>}
          <li><button type="button" onClick={() => choose(q.trim())} className="block w-full border-t px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-secondary">Use “{q.trim()}” as typed</button></li>
        </ul>
      )}
    </div>
  );
}
