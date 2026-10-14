alter table public.lotti_pf
  add column if not exists confezione numeric not null default 0,
  add column if not exists unita_misura_confezione text not null default 'kg';
