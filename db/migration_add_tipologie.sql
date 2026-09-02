-- Crea la tabella dei codici tipologie, gestita manualmente su Supabase.
-- L'applicazione la espone esclusivamente in lettura.

create table if not exists public.tipologie (
  tipologia text not null,
  codice    text not null
);