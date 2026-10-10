-- Aggiunge la tracciabilità dei lotti SM utilizzati in una lavorazione SM.

create table if not exists public.sm_consumi_sm (
  id                  uuid primary key default gen_random_uuid(),
  lotto_sm_id         uuid references public.lotti_sm(id) on delete cascade,
  lotto_sm_origine_id uuid references public.lotti_sm(id),
  quantita            numeric not null default 0,
  unita_misura        text
);

create index if not exists idx_sm_consumi_sm_lotto
  on public.sm_consumi_sm(lotto_sm_id);
create index if not exists idx_sm_consumi_sm_origine
  on public.sm_consumi_sm(lotto_sm_origine_id);
