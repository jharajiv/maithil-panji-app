-- PAAG Foundation — database. Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again (it only adds what is missing).
-- Only the server (service-role key) reads or writes these tables; the browser never talks to Supabase directly.

-- 1. WORKING COPY — one row per shared family tree
create table if not exists public.trees (
  id          text primary key,
  family      jsonb       not null,                 -- the whole family draft (people, relations, photos as small data URLs, WhatsApp numbers)
  rev         integer     not null default 1,       -- bumped on every save; used to detect simultaneous edits
  members     jsonb       not null default '[]',    -- owner + helpers: name, role, and either an account (account_id, email, status invited|joined; invited people also carry a hashed single-use invitation secret and the phone number the owner typed) or a hashed private-link token (older trees)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1b. ACCOUNTS — an email address proven with a one-time code (no passwords) — and the browsers signed in to them
create table if not exists public.accounts (
  id              text primary key,
  email           text,                               -- lower-case; the sign-in identity
  phone           text,                               -- E.164, collected at sign-up for WhatsApp invitations; NOT verified
  name            text not null,
  consent_version text,
  created_at      timestamptz not null default now()
);
-- older versions of this file identified accounts by phone: make that column optional and add the email column
alter table public.accounts add column if not exists email text;
alter table public.accounts alter column phone drop not null;
alter table public.accounts drop constraint if exists accounts_phone_key;
create unique index if not exists accounts_email_idx on public.accounts (email);

-- pending one-time sign-in codes (only a hash is kept; each lasts 10 minutes)
create table if not exists public.login_codes (
  email      text primary key,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0
);
create table if not exists public.sessions (
  token_hash text primary key,                         -- SHA-256 of the cookie value; the cookie itself is never stored
  account_id text not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_account_idx on public.sessions (account_id);

-- trees now also carry a title + head-count (for the "My trees" list) and members may be tied to accounts / invited by phone
alter table public.trees add column if not exists title        text;
alter table public.trees add column if not exists people_count integer;
create index if not exists trees_members_idx on public.trees using gin (members jsonb_path_ops);
update public.trees set people_count = jsonb_array_length(family->'persons') where people_count is null;

-- 2. QUERYABLE COPY — rebuilt from trees.family on every save (no photos, no phone numbers)
create table if not exists public.persons (
  tree_id        text    not null references public.trees(id) on delete cascade,
  person_id      text    not null,                  -- id inside that tree ("p1", "p2", …)
  name_roman     text    not null,
  name_dev       text,
  gender         text,
  birth          text,                              -- "1958" or "1958-03-14"
  birth_year     integer,
  status         text,                              -- living | deceased
  death          text,
  place          text,                              -- "Village, District, State"
  village        text,
  district       text,
  state          text,
  gotra_id       text,                              -- id in the Panji dataset (null when typed by a user)
  gotra          text,
  gotra_dev      text,
  gotra_custom   boolean not null default false,
  mool_id        text,
  mool           text,
  mool_dev       text,
  mool_custom    boolean not null default false,
  father_id      text,                              -- person_id of the father in the same tree
  mother_id      text,
  is_me          boolean not null default false,    -- the person who started the tree
  is_placeholder boolean not null default false,    -- "name not known"
  has_photo      boolean not null default false,
  notes          text,
  primary key (tree_id, person_id)
);
create index if not exists persons_mool_idx   on public.persons (mool);
create index if not exists persons_gotra_idx  on public.persons (gotra);
create index if not exists persons_place_idx  on public.persons (state, district, village);
create index if not exists persons_name_idx   on public.persons (lower(name_roman));

create table if not exists public.relations (
  tree_id  text not null references public.trees(id) on delete cascade,
  type     text not null check (type in ('parent_of', 'spouse_of')),   -- a is parent of b / a is spouse of b
  a        text not null,
  b        text not null,
  primary key (tree_id, type, a, b)
);

-- 3. CONSENT LOG — when an owner agreed to online storage + sharing (kept after a tree is deleted; holds no personal data)
create table if not exists public.consents (
  id         bigint generated always as identity primary key,
  tree_id    text not null,
  member_id  text not null,
  kind       text not null,
  version    text not null,
  given_at   timestamptz not null default now()
);

-- 4. gotras / mools typed by users that are not in the Panji dataset yet — for the Panji team to review
create table if not exists public.custom_refs (
  kind     text not null check (kind in ('gotra', 'mool')),
  key      text not null,
  roman    text not null,
  dev      text,
  status   text not null default 'new',             -- new | approved | rejected  ('rejected' stops it being suggested to other users)
  seen_at  timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.custom_refs add column if not exists status text not null default 'new';

-- 5. HANDY VIEW — each person with their father's name and how many trees contain the same mool
create or replace view public.persons_overview as
select p.tree_id, p.person_id, p.name_roman, p.gender, p.birth_year, p.status, p.village, p.district, p.state,
       p.gotra, p.mool, p.is_me,
       f.name_roman as father_name,
       (select count(distinct x.tree_id) from public.persons x where x.mool is not null and lower(x.mool) = lower(p.mool)) as trees_with_same_mool
from public.persons p
left join public.persons f on f.tree_id = p.tree_id and f.person_id = p.father_id;

-- Row-level security ON with no policies = nobody but the service role can touch the data.
alter table public.accounts    enable row level security;
alter table public.login_codes enable row level security;
alter table public.sessions    enable row level security;
alter table public.trees       enable row level security;
alter table public.persons     enable row level security;
alter table public.relations   enable row level security;
alter table public.consents    enable row level security;
alter table public.custom_refs enable row level security;

-- 6. USAGE COUNTS — anonymous: only a name and a time (see src/lib/events.ts). Safe to run again.
create table if not exists public.events (
  id   bigint generated always as identity primary key,
  name text        not null,      -- sample_opened | tree_started | tree_saved | pdf_downloaded | share_clicked | view_opened | correction_suggested | woman_linked
  at   timestamptz not null default now()
);
create index if not exists events_name_at_idx on public.events (name, at);
alter table public.events enable row level security;

-- per day and name: open this view in the Supabase table editor to see the numbers
create or replace view public.events_daily as
select date_trunc('day', at)::date as day, name, count(*) as times
from public.events
group by 1, 2
order by 1 desc, 2;

-- 7. CORRECTIONS suggested by people who view a tree (the "Suggest a correction" button on view-only pages).
--    The owner and helpers see them in an inbox and can apply or dismiss each one. Safe to run again.
create table if not exists public.suggestions (
  id         text primary key,
  tree_id    text not null references public.trees(id) on delete cascade,
  person_id  text not null,                -- id inside that tree ("p3")
  field      text not null,                -- name | birth | death | place | gotra | mool | relation | other
  value      text not null,                -- what the viewer says it should be
  note       text,                         -- optional explanation
  from_name  text,                         -- optional: who suggested it
  created_at timestamptz not null default now(),
  status     text not null default 'new' check (status in ('new', 'applied', 'dismissed'))
);
create index if not exists suggestions_tree_idx on public.suggestions (tree_id, status);
alter table public.suggestions enable row level security;

-- 8. PROFILE — the extra facts a person adds about themselves (pravar, native village, city, marital status…) in "My profile".
--    Kept as one JSON column on the account. Safe to run again.
alter table public.accounts add column if not exists profile jsonb;
-- Similar-tree matching (same gotra + mool) reads the flat people table, so these two make it fast:
create index if not exists persons_is_me_idx on public.persons (gotra, mool) where is_me;

-- 9. NEWSLETTER — people who asked for occasional updates (double opt-in: "pending" until they open the link in the confirmation email).
--    Only the email, language and dates are kept. Safe to run again.
create table if not exists public.newsletter (
  email           text primary key,
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  lang            text not null default 'en' check (lang in ('en', 'hi')),
  source          text not null default 'site',     -- where the form was: footer | home | dashboard …
  created_at      timestamptz not null default now(),
  last_sent_at    timestamptz,                        -- last confirmation email (limits repeats)
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);
create index if not exists newsletter_status_idx on public.newsletter (status, lang);
alter table public.newsletter enable row level security;
