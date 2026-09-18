-- Official draw results and settlement foundation.
-- Results are immutable once published; settlement functions are the only
-- server-side path that may move tickets from pending to winning/losing.
create table if not exists public.draw_results (
  id uuid primary key default gen_random_uuid(),
  game_id text not null check (game_id in ('pmu','loto','foot')),
  draw_date date not null,
  draw_name text,
  result jsonb not null,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_draw_results_published
  on public.draw_results(game_id, draw_date)
  where status = 'published';

create index if not exists idx_draw_results_game_date
  on public.draw_results(game_id, draw_date);

alter table public.draw_results enable row level security;

revoke insert, update, delete on public.draw_results from authenticated, anon;

drop policy if exists "draw_results_public_read_published" on public.draw_results;
create policy "draw_results_public_read_published"
  on public.draw_results
  for select
  to anon, authenticated
  using (status = 'published');

comment on table public.draw_results is
  'Official game results. Drafts are admin-only through server functions; published results drive automatic ticket settlement.';
