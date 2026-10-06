-- Maithil Panji — database. Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again (it only adds what is missing).
-- Only the server (service-role key) reads or writes these tables; the browser never talks to Supabase directly.

-- 1. WORKING COPY — one row per shared family tree
create table if not exists public.trees (
  id          text primary key,
  family      jsonb       not null,                 -- the whole family draft (people, relations, photos as small data URLs, WhatsApp numbers)
  rev         integer     not null default 1,       -- bumped on every save; used to detect simultaneous edits
  members     jsonb       not null default '[]',    -- owner + invited helpers: name, role, SHA-256 hash of their private link token
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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
alter table public.trees       enable row level security;
alter table public.persons     enable row level security;
alter table public.relations   enable row level security;
alter table public.consents    enable row level security;
alter table public.custom_refs enable row level security;
