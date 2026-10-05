# Maithil Panji — Family Tree (v1, Day 1: frontend + sample data)

Mobile-first web app for capturing Maithil family trees with Panji-native fields (gotra, mool, moolgrama, pravara).
Design & build brief: see the Word document in the parent folder.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · family-chart · d3 · html2canvas + jsPDF · Sanscript

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Screens
- `/` landing — hero, template gallery, how it works
- `/intake` — one-question-per-screen flow (26–29 steps), Devanagari auto-transliteration, gotra → mool → moolgrama autocomplete
- `/tree` — tree view: Classic / Mithila Madhubani / Modern Minimal tabs, tap a person for details, **Download PDF** (full tree or paternal lineage; A3 landscape or A4 portrait)

## Structure
```
src/
  app/                      routes (page.tsx, intake/, tree/)
  components/
    ui/                     shadcn-style primitives (button, sheet, segmented)
    tree/                   TreeView, PersonSheet, ExportSheet, tree-templates.css
    intake/                 IntakeFlow, Field components, steps.ts (question config)
    landing/                Motif / PatternBand
  data/
    sample-persons.ts       17 FICTIONAL people (4 generations, both sides)
    panji-reference.ts      ILLUSTRATIVE gotra/mool/moolgrama seed lists
  lib/
    types.ts                Person / Relationship schema (brief's data model)
    tree-filter.ts          scope = full | paternal (graph traversal) + family-chart conversion
    chart.ts                family-chart mount + per-template cards + Madhubani D3 overlay
    pdf.ts                  off-screen render → html2canvas → jsPDF (+ QR footer)
    motifs.ts               original Madhubani-style SVG motifs (placeholders)
    translit.ts             Roman → Devanagari (Sanscript + small heuristics)
public/templates/           landing-page template previews (generated from the real renderer)
```

## Day 1 limits (by design)
No auth, database, photo upload or merge logic. Intake answers are not persisted or fed into the tree yet —
the tree always shows the sample family. Edit/Add/Merge/Delete buttons are present but disabled.

## Deploy (Vercel)
Import the repo in Vercel (framework preset: Next.js, no env vars needed), or run `npx vercel` in this folder.
Optional: `NEXT_PUBLIC_WA_COMMUNITY_URL` enables the "Join on WhatsApp" button.
