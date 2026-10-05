"use client";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GOTRAS, MOOLGRAMAS, MOOLS_BY_GOTRA } from "@/data/panji-reference";
import { romanToDevanagari } from "@/lib/translit";
import type { Answers, FieldDef } from "./steps";

export const inputCls =
  "h-14 w-full rounded-xl border border-input bg-card px-4 text-lg outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20 placeholder:text-muted-foreground/60";

function Label({ htmlFor, children, helper }: { htmlFor?: string; children: React.ReactNode; helper?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground/80">{children}</label>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

/** Text input with a suggestion list drawn from the seed dataset (free text still allowed). */
export function Combobox({
  id, value, onChange, options, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const list = (q
    ? [...options.filter((o) => o.toLowerCase().startsWith(q)), ...options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q))]
    : options
  ).slice(0, 6);
  const exact = options.some((o) => o.toLowerCase() === q);
  return (
    <div className="relative">
      <input
        id={id}
        className={inputCls}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && list.length > 0 && !exact}
        aria-controls={`${id}-list`}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
      />
      {open && list.length > 0 && !exact && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-card py-1 shadow-lg">
          {list.map((o) => (
            <li key={o} role="option" aria-selected={false}>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-base hover:bg-secondary"
                onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Segment({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((o) => (
        <button
          key={o.v} type="button" role="radio" aria-checked={value === o.v}
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn("h-14 rounded-xl border text-lg font-medium transition-colors",
            value === o.v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-secondary")}
        >{o.l}</button>
      ))}
    </div>
  );
}

/** Renders one field. `ns` is the answer-key prefix, e.g. "father" or "kid.0". */
export function Field({
  def, ns, answers, set, autoFocus,
}: { def: FieldDef; ns: string; answers: Answers; set: (k: string, v: string) => void; autoFocus?: boolean }) {
  const uid = useId();
  const key = `${ns}.${def.key}`;
  const val = answers[key] ?? "";
  const first = useRef(autoFocus);

  if (def.showIf && (answers[`${ns}.${def.showIf.key}`] ?? "") !== def.showIf.equals) return null;

  if (def.kind === "name") {
    const devKey = `${key}_dev`;
    const touched = answers[`${key}_devTouched`] === "1";
    return (
      <div>
        <Label htmlFor={uid}>{def.label}</Label>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div>
            <input
              id={uid} className={inputCls} value={val} autoFocus={first.current} lang="en"
              placeholder="Roman — e.g. Rohan Jha" autoComplete="off" autoCapitalize="words"
              onChange={(e) => {
                set(key, e.target.value);
                if (!touched) set(devKey, romanToDevanagari(e.target.value));
              }}
            />
            <span className="mt-1 block text-xs text-muted-foreground">Roman{def.required ? " (required)" : ""}</span>
          </div>
          <div>
            <input
              className={cn(inputCls, "font-[inherit]")} value={answers[devKey] ?? ""} lang="hi" aria-label={`${def.label} in Devanagari`}
              placeholder="देवनागरी" autoComplete="off"
              onChange={(e) => { set(devKey, e.target.value); set(`${key}_devTouched`, "1"); }}
            />
            <span className="mt-1 block text-xs text-muted-foreground">Devanagari — auto, editable</span>
          </div>
        </div>
      </div>
    );
  }

  let control: React.ReactNode;
  switch (def.kind) {
    case "gotra":
      control = <Combobox id={uid} value={val} onChange={(v) => set(key, v)} options={GOTRAS} placeholder="Start typing…" />;
      break;
    case "mool": {
      const g = def.gotraKey ? answers[def.gotraKey] : "";
      const opts = (g && MOOLS_BY_GOTRA[g]) || Array.from(new Set(Object.values(MOOLS_BY_GOTRA).flat()));
      control = <Combobox id={uid} value={val} onChange={(v) => set(key, v)} options={opts} placeholder="Start typing…" />;
      break;
    }
    case "moolgrama":
      control = <Combobox id={uid} value={val} onChange={(v) => set(key, v)} options={MOOLGRAMAS} placeholder="Village name" />;
      break;
    case "pravara":
      control = <input id={uid} className={inputCls} value={val} onChange={(e) => set(key, e.target.value)} autoComplete="off" />;
      break;
    case "yesno":
      control = <Segment value={val} onChange={(v) => set(key, v)} options={[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }]} />;
      break;
    case "gender":
      control = <Segment value={val} onChange={(v) => set(key, v)} options={[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }]} />;
      break;
    case "number":
      control = (
        <input id={uid} className={inputCls} inputMode="numeric" pattern="[0-9]*" value={val} placeholder={def.placeholder}
          onChange={(e) => set(key, e.target.value.replace(/\D/g, "").slice(0, 2))} />
      );
      break;
    case "textarea":
      control = <textarea id={uid} className={cn(inputCls, "h-40 py-3")} value={val} placeholder={def.placeholder} onChange={(e) => set(key, e.target.value)} />;
      break;
    case "contact":
      control = <input id={uid} className={inputCls} value={val} placeholder={def.placeholder} inputMode="email" autoComplete="email" onChange={(e) => set(key, e.target.value)} autoFocus={first.current} />;
      break;
    case "date":
      control = <input id={uid} className={inputCls} value={val} placeholder={def.placeholder} inputMode="numeric" autoComplete="off" onChange={(e) => set(key, e.target.value.replace(/[^\d-]/g, "").slice(0, 10))} />;
      break;
    default:
      control = <input id={uid} className={inputCls} value={val} placeholder={def.placeholder} autoComplete="off" onChange={(e) => set(key, e.target.value)} autoFocus={first.current} />;
  }
  return (
    <div>
      <Label htmlFor={uid} helper={def.helper}>{def.label}{def.required ? "" : ""}</Label>
      {control}
    </div>
  );
}
