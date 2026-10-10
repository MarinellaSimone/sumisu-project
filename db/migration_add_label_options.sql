alter table public.lotti_mp
  add column if not exists label_options jsonb not null default '{}'::jsonb;

alter table public.lotti_sm
  add column if not exists label_options jsonb not null default '{}'::jsonb;

alter table public.lotti_pf
  add column if not exists label_options jsonb not null default '{}'::jsonb;
