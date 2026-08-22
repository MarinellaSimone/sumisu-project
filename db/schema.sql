-- ============================================================
-- TrackPack · Schema database (PostgreSQL / Supabase)
-- Gestionale tracciabilità packaging — Sumisu S.r.l. / Dulcibana
-- ============================================================
-- Esegui questo file nell'SQL Editor di Supabase (una volta sola).
-- Poi lancia `npm run init-db` per popolare utenti e dati demo.
-- ============================================================

-- Estensione per UUID
create extension if not exists "pgcrypto";

-- ---------- UTENTI ----------
create table if not exists utenti (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  nome        text not null,
  ruolo       text not null default 'operatore' check (ruolo in ('admin','operatore')),
  password_hash text not null,
  attivo      boolean not null default true,
  creato_il   timestamptz not null default now()
);

-- ---------- FORNITORI ----------
create table if not exists fornitori (
  id           uuid primary key default gen_random_uuid(),
  ragione_sociale text not null,
  piva         text,
  stato        text not null default 'Attivo' check (stato in ('Attivo','Sospeso')),
  creato_il    timestamptz not null default now()
);

-- ---------- CLIENTI ----------
create table if not exists clienti (
  id               uuid primary key default gen_random_uuid(),
  ragione_sociale  text not null,
  partita_iva      text,
  email            text,
  telefono         text,
  stato            text not null default 'Attivo' check (stato in ('Attivo','Sospeso')),
  creato_il        timestamptz not null default now()
);

-- ---------- MATERIALI (MP / SM) ----------
create table if not exists materiali (
  id          uuid primary key default gen_random_uuid(),
  codice      text unique not null,          -- es. CAR, INC, SCT, BOB
  descrizione text not null,
  tipo        text not null check (tipo in ('MP','SM')),
  unita_misura text not null default 'kg',   -- kg, pz, mq, mt
  soglia_minima numeric default 0,
  creato_il   timestamptz not null default now()
);

-- ---------- ARTICOLI PF ----------
create table if not exists articoli_pf (
  id          uuid primary key default gen_random_uuid(),
  codice      text unique not null,          -- es. SC-001
  descrizione text not null,
  gtin14      text,
  stato       text not null default 'Attivo' check (stato in ('Attivo','Bozza')),
  creato_il   timestamptz not null default now()
);

-- ---------- LOTTI MP (ricevimenti materie prime) ----------
create table if not exists lotti_mp (
  id            uuid primary key default gen_random_uuid(),
  codice_lotto  text unique not null,        -- LT-AAAAMMGG-MAT-NNN
  fornitore_id  uuid references fornitori(id),
  materiale_id  uuid references materiali(id),
  ddt_numero    text,
  ddt_data      date,
  quantita      numeric not null default 0,
  unita_misura  text not null default 'kg',
  giacenza      numeric not null default 0,  -- residuo disponibile
  n_pedane      int default 0,
  note          text,
  stato         text not null default 'Ok' check (stato in ('Ok','Riserva','Soglia','Esaurito')),
  creato_da     uuid references utenti(id),
  creato_il     timestamptz not null default now()
);

-- ---------- LOTTI SM (semilavorati) ----------
create table if not exists lotti_sm (
  id            uuid primary key default gen_random_uuid(),
  codice_lotto  text unique not null,        -- SM-AAAAMMGG-TIPO-NNN
  tipo_semilavorato uuid references materiali(id),
  lavorazione   text not null default 'interna' check (lavorazione in ('interna','esterna')),
  fornitore_sm_id uuid references fornitori(id),
  ddt_numero    text,
  ddt_data      date,
  quantita      numeric not null default 0,
  unita_misura  text not null default 'pz',
  giacenza      numeric not null default 0,
  data_lavorazione date,
  note          text,
  stato         text not null default 'Disponibile' check (stato in ('Disponibile','In uso','Esaurito')),
  creato_da     uuid references utenti(id),
  creato_il     timestamptz not null default now()
);

-- Consumo MP dentro una lavorazione SM (tracciabilità a monte)
create table if not exists sm_consumi_mp (
  id          uuid primary key default gen_random_uuid(),
  lotto_sm_id uuid references lotti_sm(id) on delete cascade,
  lotto_mp_id uuid references lotti_mp(id),
  quantita    numeric not null default 0,
  unita_misura text
);

-- ---------- LOTTI PF (prodotti finiti) ----------
create table if not exists lotti_pf (
  id            uuid primary key default gen_random_uuid(),
  codice_lotto  text unique not null,        -- PF-AAAAMMGG-ART-NNN
  articolo_id   uuid references articoli_pf(id),
  quantita      numeric not null default 0,
  unita_misura  text not null default 'pz',
  giacenza      numeric not null default 0,
  stato         text not null default 'In corso' check (stato in ('In corso','Attesa','Completato','Pronto','Spedito')),
  note          text,
  creato_da     uuid references utenti(id),
  creato_il     timestamptz not null default now()
);

-- Collegamento lotti PF <- MP (tracciabilità)
create table if not exists pf_consumi_mp (
  id          uuid primary key default gen_random_uuid(),
  lotto_pf_id uuid references lotti_pf(id) on delete cascade,
  lotto_mp_id uuid references lotti_mp(id),
  quantita    numeric not null default 0,
  unita_misura text
);

-- Collegamento lotti PF <- SM (tracciabilità)
create table if not exists pf_consumi_sm (
  id          uuid primary key default gen_random_uuid(),
  lotto_pf_id uuid references lotti_pf(id) on delete cascade,
  lotto_sm_id uuid references lotti_sm(id),
  quantita    numeric not null default 0,
  unita_misura text
);

-- ---------- SPEDIZIONI PF ----------
create table if not exists spedizioni (
  id            uuid primary key default gen_random_uuid(),
  ddt_numero    text unique not null,        -- DDT-AAAA-NNNN
  cliente       text not null,
  data_spedizione date,
  vettore       text,
  note          text,
  stato         text not null default 'In transito' check (stato in ('In transito','Consegnato','Annullato')),
  creato_da     uuid references utenti(id),
  creato_il     timestamptz not null default now()
);

-- Righe spedizione (lotti PF spediti)
create table if not exists spedizioni_righe (
  id            uuid primary key default gen_random_uuid(),
  spedizione_id uuid references spedizioni(id) on delete cascade,
  lotto_pf_id   uuid references lotti_pf(id),
  quantita      numeric not null default 0,
  unita_misura  text default 'pz'
);

-- ---------- Indici utili ----------
create index if not exists idx_lotti_mp_codice on lotti_mp(codice_lotto);
create index if not exists idx_lotti_sm_codice on lotti_sm(codice_lotto);
create index if not exists idx_lotti_pf_codice on lotti_pf(codice_lotto);
create index if not exists idx_spedizioni_ddt on spedizioni(ddt_numero);
