"use client";
import { useMemo, useState } from "react";
import { Check, Replace } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { distinctValues, type BulkChange, type BulkField, type BulkResult } from "@/lib/bulk";
import { plainRoman, searchGotras, searchMools } from "@/lib/lookup";
import { me, type DFamily } from "@/lib/family";
import type { Lang } from "@/lib/hi";
import { inputCls } from "./widgets";

const T = {
  title: { en: "Fix a spelling everywhere", hi: "गलत वर्तनी सब जगह ठीक करें" },
  intro: { en: "Typed a gotra, mool or village wrongly? Choose it below and correct it for everyone at once.", hi: "गोत्र, मूल या गाँव का नाम गलत लिखा गया? नीचे चुनिए और सबके लिए एक साथ सुधार दीजिए।" },
  gotra: { en: "Gotra", hi: "गोत्र" }, mool: { en: "Mool", hi: "मूल" }, place: { en: "Place", hi: "गाँव / शहर" },
  pick: { en: "Tap the one to correct", hi: "जिसे सुधारना है उस पर टैप कीजिए" },
  none: { en: "Nothing is filled in yet.", hi: "अभी कुछ भरा नहीं है।" },
  to: { en: "Correct spelling", hi: "सही वर्तनी" },
  people: { en: "people", hi: "लोग" },
  go: { en: "Correct it for everyone", hi: "सबके लिए सुधारें" },
  line: { en: "Set it for the whole family line instead", hi: "इसके बजाय पूरी पितृ-रेखा के लिए यही रखें" },
  lineHelp: { en: "Everyone on the father’s side gets this; wives and the mother’s side are left as they are.", hi: "पिता की ओर के सभी लोगों में यही लिखा जाएगा; पत्नियों और ननिहाल को नहीं बदला जाएगा।" },
  undo: { en: "You can undo this from the chat.", hi: "आप इसे चैट से वापस ले सकते हैं।" },
} as const;

/** a small screen to correct one wrong spelling in every person at once (no AI; the same rules as typing "change gotra X to Y" in the chat) */
export function BulkFixSheet({ open, onClose, family, lang, onApply }: { open: boolean; onClose: () => void; family: DFamily; lang: Lang; onApply: (ch: BulkChange) => BulkResult }) {
  const t = (k: keyof typeof T) => T[k][lang];
  const [field, setField] = useState<BulkField>("gotra");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [done, setDone] = useState<BulkResult | null>(null);
  const values = useMemo(() => distinctValues(family, field), [family, field]);
  const gotraId = me(family)?.gotra?.id;
  const sugg = useMemo(() => {
    const q = to.trim();
    if (q.length < 2 || field === "place") return [];
    const hits = field === "gotra" ? searchGotras(q) : searchMools(q, { gotraId });
    return hits.slice(0, 4).map((h) => plainRoman(h.item.roman));
  }, [to, field, gotraId]);
  const pickField = (f: BulkField) => { setField(f); setFrom(""); setTo(""); setDone(null); };
  const count = values.find((v) => v.value === from)?.count ?? 0;
  const apply = (whole: boolean) => { const r = onApply(whole ? { field, to } : { field, from, to }); setDone(r); if (r.count) { setFrom(""); setTo(""); } };

  return (
    <Sheet open={open} onClose={onClose} title={t("title")} className="md:w-[28rem]">
      <div className="space-y-4 p-4 text-[16px]">
        <p className="text-muted-foreground">{t("intro")}</p>
        <div role="radiogroup" className="flex overflow-hidden rounded-full border text-sm font-medium">
          {(["gotra", "mool", "place"] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={field === f} onClick={() => pickField(f)} className={`min-h-11 flex-1 px-3 ${field === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{t(f)}</button>
          ))}
        </div>
        {values.length === 0 ? <p className="rounded-xl bg-secondary p-3 text-sm">{t("none")}</p> : (
          <div>
            <p className="mb-2 text-sm font-medium">{t("pick")}</p>
            <div className="flex flex-wrap gap-2">
              {values.map((v) => (
                <button key={v.value} type="button" aria-pressed={from === v.value} onClick={() => { setFrom(v.value); setDone(null); }} className={`min-h-11 rounded-full border px-4 text-[15px] ${from === v.value ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{v.value} <span className="opacity-70">· {v.count}</span></button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="bulk-to" className="mb-1 block text-sm font-medium">{t("to")}</label>
          <input id="bulk-to" className={inputCls} value={to} maxLength={80} onChange={(e) => { setTo(e.target.value); setDone(null); }} autoComplete="off" />
          {sugg.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{sugg.map((s) => <button key={s} type="button" onClick={() => setTo(s)} className="min-h-10 rounded-full border bg-card px-3 text-sm">{s}</button>)}</div>}
        </div>
        <Button className="w-full" size="lg" disabled={!from || !to.trim()} onClick={() => apply(false)}><Replace /> {t("go")}{from && count ? ` (${count} ${t("people")})` : ""}</Button>
        {field !== "place" && (
          <div className="rounded-xl border p-3">
            <Button variant="outline" className="w-full" disabled={!to.trim()} onClick={() => apply(true)}>{t("line")}</Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("lineHelp")}</p>
          </div>
        )}
        {done && (
          <div role="status" className={`rounded-xl p-3 text-sm ${done.count ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            {done.count ? <Check className="mr-1 inline size-4" /> : null}{done.message}{done.count ? ` ${t("undo")}` : ""}
          </div>
        )}
      </div>
    </Sheet>
  );
}
