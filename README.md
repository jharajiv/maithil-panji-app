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
- `/build` — the app: **chat interviewer (left) · live tree (right, Madhubani / Classic / Modern)**. The divider between them can be dragged (or moved with the arrow keys), double-clicked to reset, and the chat can be folded away with the little arrow so the tree gets the whole screen; the choice is remembered on the device (`PaneDivider.tsx`). The "matching trees" teaser now lives on the home page under *Coming soon*.
- `/privacy` — plain-language privacy page with a Hindi summary. Set `NEXT_PUBLIC_CONTACT_EMAIL` to show a contact address on it.
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
- **Personal QR code on every printout:** for a tree saved online, the footer QR opens `/view/<tree>?v=<key>`, a read-only page (zoom, search, tap for details). The key is derived from the tree id and `AUTH_SECRET` (no extra database column), phone numbers and notes are removed from what visitors get.
- **Two kinds of view link** (`src/lib/view.ts`): *protected* (default, also used for the QR code) shows living relatives by first name only, without birth date, village, photo or husband note; *full* shows everything but phone numbers and notes, and only the owner can pick it, in Share → *Show your tree to others*. The kind is part of the key, so a visitor cannot edit a link to get more. Someone with no status recorded is treated as living unless born 100+ years ago. Keys printed before this change keep working as *full* links.
- **Sharing on social media** (`SocialShare.tsx`): WhatsApp, Facebook, X, copy link and the phone's own share sheet. Pasting the link shows a 1200×630 preview picture (`/api/trees/<id>/og?v=<key>`) with the family name, number of people and generations and the gotra/mool — never a living person's name. Set `NEXT_PUBLIC_SITE_URL` to the real address once the domain is live, so preview pictures point there. A shared link cannot yet be switched off on its own: deleting the online copy stops all of them. A tree that is only on one device gets the home-page QR and a hint to save it online.

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
    build/        BuildApp, ChatPane, LiveTree, PaneDivider, SocialShare, PersonEditSheet, SaveSheet, widgets (date, phone, mool search, Devanagari keyboard, place search)
    tree/         TreeView, ExportSheet, tree-templates.css
    ui/ landing/
  data/seed/      gotras.json, mools.json, villages.json
  lib/            family.ts (model + reducer + changeRelation) · interview.ts (planner, fixed steps) · list-turn.ts (step answers) · turn.ts (router) · agent.ts (LLM loop) · basic.ts (fallback)
                  lookup.ts (fuzzy search) · tree-filter.ts · chart.ts · pdf.ts · motifs.ts · translit.ts
scripts/          build-seed.py; tests (run with `npx tsx`): _agent.test.ts, _steps.test.ts (step-by-step interview, replies to any earlier message, relationship repair), _tester.test.ts, _view.test.ts (view-link kinds, living-relative protection, renew/stop), _sample.test.ts (the Darbhanga sample tree), _basic.test.mts, _panji.test.mts, _merge.test.ts, _sim.ts; _api.test.ts (needs a running dev server); _mockpg.mjs (fake Supabase)
supabase/         schema.sql
```

## Before a public launch
- Add a spend cap on the Anthropic key and a shared rate limiter (Upstash/Redis) — the in-memory limits are per serverless instance.
- Photos → Supabase Storage; the matching/merge database (right-hand panel, can now be built on `persons`).

## Going live on your own domain, with a staging site
1. **Domain.** Vercel → your project → Settings → Domains → *Add*, then create the DNS records Vercel shows at your domain registrar. Wait until Vercel shows a green tick.
2. **Tell the app its address.** In Vercel → Settings → Environment Variables set `NEXT_PUBLIC_SITE_URL=https://paag.org.in` and `NEXT_PUBLIC_CONTACT_EMAIL` (for example `hello@paag.org.in`), then redeploy. The sitemap, search-engine tags, emails and preview pictures use these. Preview pictures for shared links and the privacy page use these.
3. **Email that reaches everyone.** Resend → Domains → *Add domain* → add the DNS records it shows → *Verify*. Then set `EMAIL_FROM="Maithil Panji <login@paag.org.in>"` and redeploy. After that the tester list (`TEST_LOGIN_*`) is no longer needed.
4. **Donations.** Set `NEXT_PUBLIC_DONATE_UPI_ID` / `NEXT_PUBLIC_DONATE_CARD_URL` and redeploy (see above).
5. **Staging.** Create a Git branch called `staging`. Vercel builds every non-production branch as a *Preview*. Under Settings → Domains add `staging.your-domain.com` and assign it to the `staging` branch. Under Environment Variables, give the *Preview* environment its own values — above all a **separate Supabase project** (so test families never mix with real ones), a different `AUTH_SECRET`, and no donation variables. Working routine: commit to `staging` in GitHub Desktop → push → try it on the staging address → merge `staging` into `main` to release.

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


## v8.2 notes

- **Sample tree** (`/sample`, button on the home page): a read-only example built from the public Darbhanga Raj line (`src/data/darbhanga-sample.ts`). It says plainly that it is a sample and not an official or actual family tree, credits rajputs.net and Wikipedia, and shows living descendants by first name only. Edit the people in that one file.
- **Chat help**: a hint at the top ("the better your answers, the better your tree"); where to find your gotra; a Google search link for your mool (only the gotra is put in the link, never a name); "Ask a relative on WhatsApp" and "Answer later" for each question; a "Still to fill in" row for anything skipped. All in `src/lib/help.ts` and `ChatPane.tsx`.
- **Stop sharing / make a new link** (owner, in the Share sheet): stops or replaces every view-only link and printed QR code without deleting the tree. It is kept on the owner's member record in the existing `members` column — **no database change is needed**. API: `POST /api/trees/[id]/view-link {action: stop | start | renew}`.
- The development file store now writes atomically.
- **Usage counts** (B-23): anonymous counts (name + time only) in a new `events` table. **One step for you:** run the last block of `supabase/schema.sql` (section 6) in the Supabase SQL editor. Until then nothing breaks — counting just does nothing. To read the numbers, open the `events_daily` view in the Supabase table editor. Counted: sample_opened, tree_started, tree_saved, pdf_downloaded (our "finished"), share_clicked, view_opened. Vercel Web Analytics is free on Hobby but only counts page views; custom events need Pro, so it is not used.
- **Portraits for the sample tree**: add only photos that are public domain or openly licensed. Drop a small JPG into `public/sample/portraits/` and add a line to `PORTRAITS` in `src/data/darbhanga-sample.ts` with the credit. None are added yet.
- In Hindi the product word for a family tree is **वंशावली**.


## v9 notes

- **Connect trees through married women** (B-08, B-09). In the app's right-hand "Matching family trees" pane (on a phone: the "Families" tab):
  - It is **off until the owner switches it on** (that pane, or Share → "Connect with other families"). A tree can look for matches only when it takes part itself.
  - A married woman (a wife, or a daughter whose husband is noted) is compared with those in other participating trees by first name (spelling-tolerant), year of birth, gotra, mool and the husband's name. A match needs a name plus enough other evidence (`src/lib/connect.ts`).
  - The owner or a helper looks at a **preview** of the other tree (her, her husband, parents, brothers, sisters, children; living people by first name only), then confirms. Nothing is linked before that. Links are written on both women; linked women show "Also in …" in their edit sheet. Either side can remove the link.
  - A helper's link adds a note for the owner ("Recent changes by others"); the other tree's owner gets a note too. Notes live in the owner's member record (`members` column) — **no database change**. Links live in the tree itself; a normal save cannot add or remove them (only the server does), so nobody can forge a link.
  - How it finds candidates: `findWomen` looks up women with the same first letters in the `persons` table, then compares in the app. Fine for thousands of trees; if the community grows to many tens of thousands, add a stored name key to `persons`.
  - API: `POST /api/trees/[id]/settings`, `GET …/matches`, `GET …/preview`, `POST/DELETE …/links`. Tests: `scripts/_connect.test.ts`, `scripts/_connect_api.test.ts`.
- **Suggest a correction** (B-25). Anyone viewing a tree through a view-only link sees "Something wrong? Suggest a correction" on a person's card (what is wrong, what it should be, optional note and name). The owner and helpers see a **Corrections** button with a count; they can **Apply** (name, dates, village — one tap), mark done after fixing by hand (gotra, mool, relationship, other), or dismiss. Nothing changes by itself. Rate limited (12 an hour per device), at most 100 waiting per tree, web links refused. **One step for you:** run section 7 of `supabase/schema.sql` in the Supabase SQL editor (the `suggestions` table). Sections 6 and 7 are both safe to run again.
- **Questions in Hindi** (B-21). A language switch (English | हिन्दी) at the top of the chat. Hindi questions are built from the same facts as the English ones (`src/lib/hi.ts`); the app's short replies are translated; the AI interviewer is told to write in Hindi; quick-reply buttons show Hindi but send the English words the app already understands; typed Hindi answers (नहीं, कोई भाई नहीं, अविवाहित, छोड़ें, पुरुष, महिला…) are understood. The rest of the screen (buttons, menus) is still English. **Please have a native Hindi speaker read `src/lib/hi.ts` once.** Maithili is not included yet — it needs a native reviewer.
- Two new anonymous counts: `correction_suggested`, `woman_linked`.
- Privacy page: sections on suggested corrections and on connecting families.


## v10 notes

- **My profile** (new, at `/app/profile`; link on the dashboard). Name, mobile, pravar, native village (village → district → state), city, address, marital status, occupation, a short note. Gotra and mool are read from the person's tree, not typed again. Visibility: the owner of a tree you **connect with** sees pravar, native place, city, marital status, occupation and the note; **mobile, email and address** are given only because you tick "share" for that one request. Nothing is public or searchable. Stored as one JSON column on `accounts`. **One step for you:** run section 8 of `supabase/schema.sql` (adds `accounts.profile` and an index). API: `GET/PUT /api/me/profile`.
- **Similar family trees** (B-10), in the same right-hand pane (phone: "Families"), above the married-women matches. Same opt-in switch as before.
  1. **Filter**: only trees whose root person has the **same gotra and the same mool** (by seed id, otherwise by spelling) are looked at — `findTreesBySameStock`.
  2. **Score** (`src/lib/similar.ts`): people are paired one-to-one by first name (spelling-tolerant), surname, year of birth, village and father's name; a pair counts from a score of 0.7. The percentage is the share of the smaller tree (at least 5 people) found in the other. A tree is listed only with **3 or more people in common and 30% or more**; at most 10 are shown, best first, labelled very likely (70%+) / likely (50%+) / possible.
  3. **Preview**: oldest recorded ancestors, most common villages, and the people who appear in both. Living people by first name only. Only a tree that currently looks similar can be previewed.
  4. **Connect**: the owner sends a request with a short message. The sender must agree to share their name, profile, mobile and email with that one owner. The other owner can **accept** (agreeing to share theirs back) or **decline** (the same family cannot be asked again for 30 days). After accepting, each sees the other's card with a WhatsApp button. Requests live in the owner's `members` record — no new table.
  5. **Merging**: not automatic. The two owners talk; if they agree it is one family, one invites the other as a helper (Share) and they combine the branches in one tree. A guided "combine two trees" tool is a separate backlog item (B-28).
  - API: `GET /api/trees/[id]/similar` (`?tree=` for the preview), `GET/POST/PATCH /api/trees/[id]/requests`. Tests: `scripts/_similar.test.ts`, `scripts/_similar_api.test.ts` (dev server, accounts on).
- **Sign in with Google** (B-27). A "Continue with Google" button above the email box; the emailed code stays as the alternative. Google gives us a confirmed email and a name only. A returning person goes straight in (same email = same account); a new person ticks the agreement and may add a mobile number (optional here), then the account is created. **Your steps:** in Google Cloud console create a project → OAuth consent screen (External; publish) → Credentials → OAuth client ID → Web application → add the redirect URI `https://<address>/api/auth/google/callback` for the vercel.app address and, later, the final domain → set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and redeploy. Until set, the button is hidden and nothing else changes. Test: `scripts/_google.test.ts` (uses a stand-in Google).
- **Admin connections view** (B-11, first stage) at `/admin`, only for the emails in `ADMIN_EMAILS`. Find people by name, gotra, mool, village, gender and birth years; pick two and see the chain of relationships between them across all trees ("3rd connection"); see who is within 3 steps of someone; see how many separate groups of trees exist. Links between trees (the same woman) cost nothing, so only real relationships are counted. The graph is built in memory from the trees (cached a minute) — ordinary Postgres is enough at this size; a graph database is worth it only at millions of people. Names, years and places only — no numbers or notes. `src/lib/graph.ts`; test `scripts/_graph.test.ts`, `scripts/_admin_api.test.ts`.
- New anonymous counts: `tree_connect_requested`, `tree_connect_accepted`, `google_signin`. Privacy page updated (profile, Google, finding other families).

## v11 notes

Three parts, each independent so any one can be taken out.

- **PAAG Foundation branding and the new domain.** One file, `src/lib/site.ts`, holds the names (Maithil Panji, PAAG Foundation, "Panji Ancestry & Graph", paag.org.in). Used by: the home page (eyebrow line, new "More than a tree" section, revised "Coming soon"), a new **/about** page (what PAAG is, what we promise; it makes no claim about legal registration — add that once it is true), the footer on home / about / privacy, page titles and search-engine tags (Open Graph, Twitter card, Organization data), the preview picture of shared links, the sign-in email, the PDF footer, the donation defaults ("PAAG Foundation"), the privacy page ("Who we are", updated date), plus `robots.txt` and `sitemap.xml` (private pages — /app, /admin, /view, /join, /api — are kept out of search engines). To revert: restore these files from the v10 zip; nothing else depends on them except `siteUrl()`.
- **My connections** (B-29), `/app/connections`, and a card on the dashboard. For a signed-in owner whose tree is switched on for finding: other families you are related to through linked daughters and wives, nearest first ("2nd connection"), and the chain of people to any of them ("You → wife → same woman → father → son"). Only trees that also chose to take part are used; living people by first name only; people who have passed away with full name and year. Needs no new table. `src/lib/graph.ts` (`otherFamilies`, `seenAs`), `src/lib/graph-cache.ts`, `GET /api/me/connections`. Tests: `_graph.test.ts`, `_connections_api.test.ts`.
- **Combine two trees** (B-28), under "Connected families" in the right-hand pane. Only after both owners have connected (accepted request).
  1. The owner of the **giving** tree offers it and ticks an agreement that everyone in it, living people included, may be copied.
  2. The owner of the **receiving** tree sees a preview: people who look the same in both (each can be unticked; at least 3 must remain), the new people that would be added, the blanks that would be filled, differences (**yours always stays**), people not connected to anyone shared (left out), and relations skipped because they would break the tree (a second father, a person becoming their own ancestor). Nothing happens until "Combine now".
  3. The giving tree is never changed. The WhatsApp numbers, "this is me" mark and links to other trees are not copied. An unknown father ("name not known") gives way to a real one.
  4. **Undo** (receiving owner): removes the people and relations it added, brings back replaced placeholders, and blanks the details it filled — only if nobody changed them since. A small record of the change is kept on the owner's member record (no new table; never sent to the browser).
  - `src/lib/combine.ts` (pure), `POST/GET /api/trees/[id]/combine`, `src/components/build/CombinePanel.tsx`. Tests: `_combine.test.ts`, `_combine_api.test.ts` (dev server, accounts on). New anonymous count: `tree_combined`. To remove the feature: delete `CombinePanel` and its line in `SimilarTrees.tsx` — the rest keeps working.
- Not built, on purpose: **B-30 premium plans** (waiting for your decision). Hindi wording of the new screens still needs a native speaker's review; the combine and connections screens are English only for now.

## v11.3 notes

- **New PAAG logo**, in the Mithila (Madhubani) manner: the paag is the frame (a dome on a red band) and a tree of life grows inside it; every flower is a person, the dotted lines are the links. The word is written in **Mithilakshar** (पाग, Tirhuta script, outlines from Noto Sans Tirhuta, OFL) beside "PAAG FOUNDATION". Please have a Mithilakshar reader confirm the spelling. One drawing in `src/components/brand/Logo.tsx` (`PaagMark`, `PaagBadge`, `PaagLogo`; three levels of detail), outlines in `src/components/brand/mithilakshar.ts`. Files in `public/brand`: regenerate with `npx tsx scripts/build-brand.tsx` then `python3 scripts/build-brand-png.py`. The logo is now smaller and quieter everywhere (about 36 px high in headers).
- **Home page rebuilt** to be calm and structured: top bar, a hero with a real tree picture, "How it works", "Styles", "Connecting families", then one closing call to action. The same section rhythm (small label, heading, one line) throughout. Hindi added (वंशावली; a Hindi line in the hero and the closing band). Larger body text and darker secondary text. The "Coming soon" section is gone; the next steps are one line of text.
- **Template pictures** on the home page are now real, readable captures of the sample tree (`public/templates`, regenerated). The old ones were too small to read.
- **Builder, first screen**: the Families panel starts folded, and Share / Families stay out of the header until there is someone in the tree.
- **One name everywhere: PAAG Foundation** (`SITE_NAME` / `ORG_NAME` in `src/lib/site.ts`). Headers (home, sign-in, dashboard, builder, view-only pages, admin), browser tab titles, share-preview pictures and their text, the WhatsApp messages (invite, ask-a-relative in English and Hindi, similar trees, share), the sign-in email, the printed charts (footer line, PDF properties, file names now start with `PAAG-`) and the Excel list. "Maithil" stays as a description ("Maithil family trees"), and the chat assistant keeps its own name, Panji Sahayak. Browser-storage keys and the package name keep the old internal name on purpose, so nobody loses their saved work.
- **Village suggestions now fill the district and state, like Google Maps.** Google often lists a village with only "India" after it ("Behta, India"). The server (`/api/places`) now looks up the full address of such a place (Place Details), remembers it for a few hours so the same village is not paid for twice, and for a search of several words ("behta benipatti madhubani") also uses Text Search, which finds the one village that fits all the words. Choosing it fills village, district and state (and the list shows the block, e.g. "Benipatti block"). Several villages with one name (Behta in Madhubani and Behta in Darbhanga) are all kept: the lists with and without Google's place-type filter are joined by place id, and each village's own district, state and block is looked up, so they can be told apart. **Google's address levels are checked against Bihar's real list.** For a village in Madhubani, Google can put "Darbhanga" (the division) above "Madhubani" (the district). `districtOf` in `src/lib/places.ts` knows Bihar's nine divisions and 38 districts, never takes a division as the district, and shows the smaller place (e.g. Benipatti) as an "area" line. Outside Bihar it takes the first name that is not a division. A village in India found while "Outside India" is on switches the form to India. Old text such as "Behta, India" no longer puts "India" in the district box. Needs Places API (New) with Place Details and Text Search enabled on the same key; both are billed calls, used only when needed. Test: `npx tsx scripts/_places.test.ts`, `scripts/_parseplace.test.ts`.
- No database change.

## v11.2 notes

- **A woman connects two family trees.** A wife (your mother, a grandmother…) is now looked for as a daughter in her father's tree even when her father's name is entered in your tree; the father's name strengthens the match. The Families screen and her edit card explain the route. Her own family's chart is drawn by her family's tree; the link shows it.
- **Bridge**: once a woman is linked, "Open her family's tree" (Families pane and her edit card) opens the other family's tree read-only, centred on her. Living relatives show by first name only. Who may cross, and how much they see, becomes an owner setting later (B-38).
- **Google Places** for village / town suggestions (anywhere in the world, biased to Bihar). Set `GOOGLE_PLACES_API_KEY` in Vercel (Places API (New); restrict the key and set a quota). Without the key the free OpenStreetMap service is used, as before. "Powered by Google" is shown beside Google results.
- Her father's name is optional for the connection; it only makes the match more certain.
- **PAAG logo**: the Mithila paag (the cap worn as a mark of honour; PAAG sounds like *paag*) with a fan of ancestry rising from its band. One drawing in `src/components/brand/Logo.tsx` is used on the home page, footer, sign-in, dashboard, About/Privacy, builder, shared-link previews, favicon and the corner of every printed PDF. Logo files (SVG + PNG, light and dark) are in `public/brand`; regenerate them with `npx tsx scripts/build-brand.tsx` then `python3 scripts/build-brand-png.py`.
- Fixes: the profile page no longer jumps to the top while typing; the folded right-hand panel is now labelled "Families" (it said "Coming soon"), with a Families button in the header and an "Open Families" button on a wife's card.
- No database change (same `supabase/schema.sql`).

## v11.1 notes

- **PDF: "Whole family chart"** (new, and the default in the builder). The old "Full family tree" drew only your own line (ancestors and descendants), so an uncle's family never appeared. The new option centres on the oldest ancestor on the father's side, so every uncle, aunt and cousin with spouses is drawn. "Full family tree" is now called **My own line**. The size line shows how many people are really drawn ("9 people drawn; 2 are not drawn…"). People who belong to other families' charts (a wife's parents) are listed on an extra last page. Code: `apexOf`, `outsideChart` in `src/lib/tree-filter.ts`.
- **Poster paper sizes.** In "Large poster" you can choose one big page of any size (as before) or a standard **A2 / A1 / A0** sheet for a print shop; the screen shows how wide the names will print on each ("cards about 28 mm wide") and warns when they would be too small. The tree is rendered at about 170 dpi for the chosen sheet. `paperFit` in `src/lib/pdf.ts`.
- **Excel list of everyone** (button under Download PDF, `src/lib/csv-export.ts`): every person with born/died, village, gotra, mool, father, mother, spouse and notes — a complete offline copy whichever chart you print.
- **Village names are kept.** The map service used to suggest "Madhubani, Madhubani, Bihar" for a small village like Kothiya, and picking it replaced the village. Now only suggestions that look like what was typed are shown, and the first/last choice is always **Keep "Kothiya" as the village** (you then choose district and state). `resembles` in `src/components/build/widgets.tsx`; test `scripts/_place.test.ts`.
- **Sample tree portraits**: Lakshmeshwar, Rameshwar and Kameshwar Singh (in `public/sample/portraits/`, listed in `PORTRAITS` with their credits). Please check each image's licence on Wikimedia Commons before a public launch; the Kameshwar picture is cropped from a book cover. To remove one, delete its line in `PORTRAITS`.
- Tests: `_export.test.ts`, `_place.test.ts`.
