# Maithil Panji — Family Tree

Mobile-first web app for capturing Maithil family trees with Panji-native fields (gotra, mool, pravara).
Design & build brief: see the Word document in the parent folder.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · family-chart · d3 · html2canvas + jsPDF · Sanscript

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Screens
- `/` landing — hero, template gallery, how it works
- `/build` — the app: **chat interviewer (left) · live tree (middle, Madhubani / Classic / Modern) · matching-trees placeholder (right)**.
  On phones these are bottom tabs. Tap any person in the tree to edit details, add a photo or remove them. **PDF** exports the paternal lineage or full tree (A3 / A4).
- `/tree` — read-only sample family (fictional) used for template previews
- `/intake` — redirects to `/build`

## How the chat works
- A deterministic planner (`src/lib/interview.ts`) decides the next question, **looking backwards first**: you → father → his father → their fathers … until the person says "I don't know". Then every group of relatives is its own **fixed step**, labelled "Step n of 5": **1 brothers → 2 sisters → 3 the brothers' wives → 4 the sisters' husbands → 5 the brothers' sons and daughters**, first for you, then the same for each ancestor (four steps for the older generations). A reply to the "brothers" question can only ever create brothers, and so on — the role of everyone added comes from the question, never from the AI's guess (`listOps` in `interview.ts`, `list-turn.ts`). Your own wife, sons and daughters follow, then the sons' households.
- **Sisters' husbands** are not tree nodes: the answer ("Rajesh Jha, Darbhanga") is kept as one short note on her card (`married_to`), shown on the card as "m. …" and editable in her edit sheet.
- **Reply, WhatsApp-style**: on ANY message in the chat — swipe it to the right (phone), tap the ↩ next to it, right-click or press-and-hold — the original is quoted above your answer and inside the sent bubble. For the step questions (brothers, sisters, wives, children…) the reply either **adds to** or **replaces** that group (replacing also removes people hung under them); for the opening questions (your name, birth, place, a father's or mother's name, a parent's details) it corrects just that one answer (`correction.ts`). Gotra and mool open the edit sheet instead. The same works from the tree: right-click or press-and-hold a person's box → "Add his sons / his sisters / his wife / her husband…" continues the chat about that person. **Undo my last answer** steps back one answer. The AI never rebuilds the tree from a correction; unclear replies change nothing.
- **Wrong relationship?** In a person's edit sheet (or the tree menu): "X is really the [brother/sister/wife/husband/son/daughter/father/mother] of [person]" (`changeRelation` in `family.ts`).
- **Panji convention:** a daughter or sister is recorded by name only — her husband, children and in-laws are never asked or saved (she is the link to her husband's family's own chart). The server refuses such entries even if the AI proposes them. Children are drawn from the line between father and mother, never from the father's box alone (`normalizeCouples` in `family.ts` links a child to both parents). Gotra/mool are inherited from the father; parents of married women are never asked; husband and wife are both shown. Places are only *village, district, state* (never a street address).
- For the fixed steps the LLM (`list-turn.ts`, one `record_answer` tool) only **reads the names** out of the reply (English/Hindi/Hinglish) — the app asks the question in fixed wording and decides who each person is. For the first questions (name, gender, gotra, mool, the father chain) the LLM (`src/lib/agent.ts`, Anthropic tool-use) parses the answer, checks gotra/mool against the seed lists, saves via `update_family`, and phrases the next question. The server validates every operation; the same reducer (`applyOps` in `src/lib/family.ts`) runs on server and client.
- **Unfamiliar mool/gotra:** a close match → "Did you mean X?" (the user confirms); nothing close → saved as a *new entry* (`custom: true`) and collected in the `custom_refs` table for the Panji team to review. Collected entries are overlaid on the search lists, tagged "added by a user" (`registerExtras` in `lookup.ts`, `GET /api/refs`).
- Scope lock: system prompt + tool design; off-topic messages get one polite sentence and the interview resumes. Input is capped (700 chars, 10 history messages) and rate-limited per IP.
- No `ANTHROPIC_API_KEY`, or an AI error → automatic **Simple mode** (rule-based parser, `src/lib/basic.ts`, with the same confirm-or-add behaviour).

## Large families (40 households, 5 generations, 200+ people)
- One creator and many helpers (see Accounts below) — everyone's additions are merged.
- The live tree opens at "me" and can be zoomed (buttons, pinch, wheel), dragged, fitted to the screen, searched by name and shown full screen. The reader's zoom position survives edits.
- **Download PDF** offers three sizes: *One page* (small families), *Several A3 / A4 sheets* (readable size, with an overview page and a joining guide) and *Large poster* (one very large page for a print shop; zoomable on screen). Trees over 40 people default to the poster. Big charts are cut into tiles so phones do not run out of memory; each tile only draws what it shows (`src/lib/pdf.ts`, `onlyThe`). A 228-person test family exports in about 20 seconds in all three styles.
- **Edit freely** (`FreeformEditor.tsx`): a free-form board — tap to make a box, drag boxes, join any two boxes with a connector (parent→child, or the other way round; spouse links too). Each box has the usual details. Positions are not saved; they are laid out again on opening.
- Dates are three free-order boxes (day / month / year); places are village (with suggestions from OpenStreetMap/Photon when reachable), district (Bihar list) and state, always typeable by hand.
- Tab icon: `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`.

## Start without an account, save later, contribute at download
- The home button goes straight to `/build`. Nothing asks for sign-up first. After 5 people a gentle **Save your tree** card appears (`SavePrompt.tsx`; "Not now" hides it until 10 more people are added). "Save my tree" signs in with an email code and `/app?import=1` moves the tree from this device into the new account.
- **Download PDF → contribution step** (`DonateStep.tsx`, `lib/donate.ts`): suggested amounts by country (India ₹51/101/251/501 via UPI link or QR; US $5/11/21; Switzerland CHF 10/20/50; euro countries, UK, UAE, Australia, Canada have their own). Country comes from Vercel's `x-vercel-ip-country` header (`/api/geo`), else the browser's time zone and language. **Skip** is always there; someone who has contributed is not asked again for 45 days. Set `NEXT_PUBLIC_DONATE_UPI_ID` and/or `NEXT_PUBLIC_DONATE_CARD_URL` in Vercel; with neither set the step is not shown.
- **Personal QR code on every printout:** for a tree saved online, the footer QR opens `/view/<tree>?v=<key>`, a read-only page (zoom, search, tap for details). The key is derived from the tree id and `AUTH_SECRET` (no extra database column), phone numbers and notes are removed from what visitors get. A tree that is only on one device gets the home-page QR and a hint to save it online.

## Editing the tree directly
Tap anyone: edit name (+ Devanagari with on-screen keyboard), gender, birth (year or calendar), living/passed away (hidden for yourself), village/district/state, gotra, mool, photo (shown on the tree cards in all three styles). **Add a relative** adds a wife/husband, son, daughter, brother, sister, father or mother in place; **Remove this person** deletes a node. A married-in woman gets no parents/siblings options (Panji convention).

## Sharing and WhatsApp invitations
- **Share** (header) → the owner saves the tree online (consent checkbox) and gets a private link. No passwords: every person holds a private link ("capability URL"); only a SHA-256 hash of each link token is stored.
- **Invite a family member**: pick a person (or type a name), enter their WhatsApp number → an editor link is created and a `wa.me` button opens WhatsApp with a ready message. Their number is saved on their card only so it can be reused for invitations. The owner can remove anyone's access in the same sheet.
- Helpers see the same tree (the chat is replaced by a short welcome) and edit it directly. Saves are optimistic: if two people save at once the server answers 409 and the browser three-way-merges (`src/lib/merge.ts`) and retries; browsers also poll every 15 s.
- Storage: Supabase over REST (`src/lib/store.ts`, tables in `supabase/schema.sql`). In development without Supabase a JSON file in `.data/` is used. In production without Supabase sharing is simply switched off.
- **Delete my online copy** (owner, in the Share sheet) removes the tree, its people/relations rows and all links; the device copy stays.
- Photos are stored inside the tree JSON as ≤320 px JPEG data URLs (fine for tens of photos). Move them to Supabase Storage when trees grow.

## The database (for later use)
Every save writes the tree to Supabase twice: the working copy in `trees.family` (JSON, includes photos and WhatsApp numbers) and a **queryable copy** rebuilt each time in `persons` (name, gender, birth year, village/district/state, gotra, mool, father/mother ids, flags) and `relations`, with no photos or phone numbers. `consents` logs when an owner agreed to storage/sharing (kept after deletion, holds no personal data). `persons_overview` is a ready view. Examples (Supabase → SQL Editor):
```sql
select mool, count(*) from persons where mool is not null group by 1 order by 2 desc;       -- mools by frequency
select state, district, village, count(*) from persons where village is not null group by 1,2,3 order by 4 desc;
select * from custom_refs where status = 'new';                                              -- names users added that are not in the 135/20 dataset
update custom_refs set status = 'rejected' where kind = 'mool' and key = 'some-key';         -- stop suggesting it to other users
```
Review flow for new mools/gotras: look at `custom_refs` in Supabase's Table Editor, then add the approved ones to `src/data/seed/*.json` (via `scripts/build-seed.py`). Tables have RLS on with no policies: only the server's service-role key can read them.

## Reference data
`scripts/build-seed.py` converts the Panji CSVs (gotras, mools, villages) to `src/data/seed/*.json` (20 gotras, 135 mools — from a single panjikar, so new names are expected — and 459 villages, now unused except as reference). Fuzzy phonetic matching in `src/lib/lookup.ts` lets "sarisab", "सरिसब" and "Sarisaba" all match.
Place search uses OpenStreetMap **Photon** (public demo server — fine for testing; self-host or use a paid geocoder before launch).

## Structure
```
src/
  app/            routes: page.tsx, build/, tree/, api/chat/
  components/
    build/        BuildApp, ChatPane, LiveTree, MatchesPane, PersonEditSheet, SaveSheet, widgets (date, phone, mool search, Devanagari keyboard, place search)
    tree/         TreeView, ExportSheet, tree-templates.css
    ui/ landing/
  data/seed/      gotras.json, mools.json, villages.json
  lib/            family.ts (model + reducer + changeRelation) · interview.ts (planner, fixed steps) · list-turn.ts (step answers) · turn.ts (router) · agent.ts (LLM loop) · basic.ts (fallback)
                  lookup.ts (fuzzy search) · tree-filter.ts · chart.ts · pdf.ts · motifs.ts · translit.ts
scripts/          build-seed.py; tests (run with `npx tsx`): _agent.test.ts, _steps.test.ts (step-by-step interview, replies to any earlier message, relationship repair), _tester.test.ts, _basic.test.mts, _panji.test.mts, _merge.test.ts, _sim.ts; _api.test.ts (needs a running dev server); _mockpg.mjs (fake Supabase)
supabase/         schema.sql
```

## Before a public launch
- Add a spend cap on the Anthropic key and a shared rate limiter (Upstash/Redis) — the in-memory limits are per serverless instance.
- Photos → Supabase Storage; the matching/merge database (right-hand panel, can now be built on `persons`).

## Deploy (Vercel)
Import the repo (framework preset: Next.js). Add the environment variables from `.env.example` (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), run `supabase/schema.sql` in Supabase (re-run it after every update — it only adds what is missing), and redeploy.


## Accounts, invitations and collaboration (Day 3)

- `/` landing → `/login` (email + one-time code, no passwords) → `/app` (my trees, shared with me) → `/app/tree/<id>` (chat + live tree).
- New accounts give a name, a mobile number (needed for WhatsApp invitations — **not verified**) and agree to the community terms.
- A tree belongs to an account. The owner invites a relative with name + mobile number; the app opens WhatsApp with a ready message containing `/join/<tree>?i=<secret>`.
  The message goes from the owner's own WhatsApp, so it is trusted. The secret works **once**: the person opens the link, signs in with their email and joins as a helper.
  Inviting the same number again issues a new link and cancels the old one. Helpers can edit and can leave; only the owner can invite, remove people or delete the tree.
  Anyone can also start a different family tree of their own from the dashboard.
- One-time codes are emailed through Resend (`RESEND_API_KEY`, `EMAIL_FROM`, sender domain verified in Resend). In development a fixed test code (123456) is used. In production without Resend, accounts are off and `/build` keeps working on the device only.
- Older private-link trees (`/build?t=…&k=…`) keep working; when a signed-in person opens one it is moved into their account.
- Tests: `scripts/_accounts.test.ts` (sign-up, invite, single-use link, leave/remove, sign-out, delete), `scripts/_api.test.ts` (legacy links; start the server with `AUTH_OFF=1`), `scripts/_dates.test.ts`, `scripts/_basic.test.mts`.
- **Tester list** (approved friends sign in without an email, e.g. while your sender domain is not verified): set `TEST_LOGIN_EMAILS` (comma-separated) and `TEST_LOGIN_CODE` (8–10 digits) in Vercel and redeploy; give each person the code yourself. Everyone else still gets the emailed code. The sign-in screen tells a tester to type the access code instead of waiting for an email.
