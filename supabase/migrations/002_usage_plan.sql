-- Record which plan each photo check was made under (for the free monthly budget)
alter table public.id_usage add column if not exists plan text not null default 'free';
create index if not exists id_usage_plan_month_idx on public.id_usage (plan, created_at);
