-- Bonus photo checks earned by watching rewarded ads (free plan only; written by the identify function)
create table if not exists public.ad_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ad_rewards_user_idx on public.ad_rewards (user_id, created_at desc);
alter table public.ad_rewards enable row level security;
create policy "ad_rewards: read own" on public.ad_rewards for select using (auth.uid() = user_id);
grant select on public.ad_rewards to authenticated;
