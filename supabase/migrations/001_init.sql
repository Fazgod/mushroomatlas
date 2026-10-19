-- Mushroom Atlas – initial schema
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push`).

-- 1. Profiles (one per user), created automatically on sign-up
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','season','supporter')),
  plan_expires_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own name" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- plan / stripe columns are only changed by the server (service role), never by the client:
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Finds (photos with location)
create table if not exists public.finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  species_slug text,
  species_guess text,
  note text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  visibility text not null default 'approx' check (visibility in ('approx','exact','private')),
  photo_path text,
  observed_at timestamptz default now(),
  created_at timestamptz not null default now(),
  -- ~1 km grid used for public display
  approx_lat double precision generated always as (round(lat::numeric, 2)::double precision) stored,
  approx_lng double precision generated always as (round(lng::numeric, 2)::double precision) stored
);
create index if not exists finds_approx_idx on public.finds (approx_lat, approx_lng);
create index if not exists finds_user_idx on public.finds (user_id, created_at desc);
alter table public.finds enable row level security;
-- Owners see and manage their own rows (with exact coordinates)
create policy "finds: owner select" on public.finds for select using (auth.uid() = user_id);
create policy "finds: owner insert" on public.finds for insert with check (auth.uid() = user_id);
create policy "finds: owner update" on public.finds for update using (auth.uid() = user_id);
create policy "finds: owner delete" on public.finds for delete using (auth.uid() = user_id);

-- Public view: never exposes exact coordinates unless the owner chose 'exact'; hides private finds
create or replace view public.finds_public as
  select id, species_slug, species_guess, photo_path, observed_at,
         case when visibility = 'exact' then lat else approx_lat end as lat,
         case when visibility = 'exact' then lng else approx_lng end as lng,
         (visibility = 'exact') as is_exact
  from public.finds
  where visibility <> 'private';
grant select on public.finds_public to anon, authenticated;

-- 3. Photo storage: public read, users write only into their own folder
insert into storage.buckets (id, name, public) values ('finds', 'finds', true) on conflict (id) do nothing;
create policy "finds photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'finds' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "finds photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'finds' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Identification usage (quota per plan, written by the edge function)
create table if not exists public.id_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  top_latin text,
  top_probability real
);
create index if not exists id_usage_user_idx on public.id_usage (user_id, created_at desc);
alter table public.id_usage enable row level security;
create policy "id_usage: read own" on public.id_usage for select using (auth.uid() = user_id);
