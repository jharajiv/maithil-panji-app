-- Maithil Panji — shared trees. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Only the server (service-role key) reads or writes these tables; the browser never talks to Supabase directly.

create table if not exists public.trees (
  id          text primary key,
  family      jsonb       not null,                 -- the whole family draft (people, relations, photos as small data URLs)
  rev         integer     not null default 1,       -- bumped on every save; used to detect simultaneous edits
  members     jsonb       not null default '[]',    -- owner + invited helpers: name, role, SHA-256 hash of their private link token
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- gotras / mools typed by users that are not in the Panji dataset yet (for the Panji team to review)
create table if not exists public.custom_refs (
  kind     text not null check (kind in ('gotra', 'mool')),
  key      text not null,
  roman    text not null,
  dev      text,
  seen_at  timestamptz not null default now(),
  primary key (kind, key)
);

-- Row-level security ON with no policies = nobody but the service role can touch the data.
alter table public.trees       enable row level security;
alter table public.custom_refs enable row level security;
