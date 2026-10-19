-- Babelish app state on Neon (Lakebase Postgres).
-- progress + spaced-repetition vocabulary, synced from the app through the
-- `api` Neon Function. user_id = Managed Auth JWT `sub` claim (Better Auth
-- user id). Authorization is enforced in the Function from the JWT; rows are
-- never addressed by a client-supplied id.

create table if not exists public.app_state (
  user_id    text primary key,
  progress   jsonb not null default '{}'::jsonb,
  vocab      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);
