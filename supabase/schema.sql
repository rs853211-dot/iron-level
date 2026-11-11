-- Iron Level: cloud sync schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again (idempotent). Every row belongs to one user; Row Level Security makes
-- sure a signed-in user can read and write only their own rows, even though the publishable key is public.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint profiles_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint profiles_data_size check (pg_column_size(data) < 200000)
);

create table if not exists public.workouts (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  deleted    boolean not null default false,   -- tombstone, so a deletion reaches the other devices
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint workouts_id_format check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint workouts_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint workouts_data_size check (pg_column_size(data) < 100000)
);

create index if not exists workouts_user_updated_idx on public.workouts (user_id, updated_at);

-- The server clock decides updated_at, never the phone's clock.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists workouts_touch on public.workouts;
create trigger workouts_touch before insert or update on public.workouts
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Nobody without a login (the anon role) gets anything.
revoke all on public.profiles from anon;
revoke all on public.workouts from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
