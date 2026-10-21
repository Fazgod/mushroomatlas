-- Where each photo check came from: the user's plan, an ad unlock, or a bought check pack
alter table public.id_usage add column if not exists source text not null default 'plan';
create index if not exists id_usage_source_idx on public.id_usage (source, created_at);

-- Check packs (one-off purchases, written by the Stripe webhook). Credits don't expire.
create table if not exists public.check_packs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  checks int not null check (checks > 0),
  stripe_session text unique,
  created_at timestamptz not null default now()
);
create index if not exists check_packs_user_idx on public.check_packs (user_id);
alter table public.check_packs enable row level security;
create policy "check_packs: read own" on public.check_packs for select using (auth.uid() = user_id);
grant select on public.check_packs to authenticated;

-- Settings you can change in Supabase → Table Editor → app_settings (server-only, not readable by visitors)
create table if not exists public.app_settings (key text primary key, value text not null, note text);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value, note) values
  ('free_monthly_budget', '100', 'Max ad-unlocked photo checks per month for all free users together. Set each month to: last month''s ad income in € ÷ 0.05.')
on conflict (key) do nothing;
