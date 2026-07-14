-- ============================================================
-- TrackPack · Schema Supabase
-- Esegui questo script nell'SQL Editor di Supabase
-- ============================================================

-- ── FORNITORI ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornitori (
  id               BIGSERIAL PRIMARY KEY,
  ragione_sociale  TEXT NOT NULL,
  piva             TEXT DEFAULT '',
  materiali        TEXT DEFAULT '',
  stato            TEXT DEFAULT 'attivo' CHECK (stato IN ('attivo','sospeso')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── MATERIALI (MP e SM) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiali (
  id             BIGSERIAL PRIMARY KEY,
  codice         TEXT NOT NULL UNIQUE,
  descrizione    TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('MP','SM')),
  unita_misura   TEXT DEFAULT 'kg',
  soglia_minima  NUMERIC DEFAULT 0,
  stato          TEXT DEFAULT 'attivo',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ARTICOLI PF ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articoli (
  id           BIGSERIAL PRIMARY KEY,
  codice       TEXT NOT NULL UNIQUE,
  descrizione  TEXT NOT NULL,
  gtin14       TEXT DEFAULT '',
  stato        TEXT DEFAULT 'attivo' CHECK (stato IN ('attivo','bozza','sospeso')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOTTI MP ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lotti_mp (
  id                     BIGSERIAL PRIMARY KEY,
  codice                 TEXT NOT NULL UNIQUE,
  fornitore_id           BIGINT REFERENCES fornitori(id) ON DELETE SET NULL,
  materiale_codice       TEXT NOT NULL,
  materiale_descrizione  TEXT DEFAULT '',
  ddt_numero             TEXT NOT NULL,
  ddt_data               DATE NOT NULL,
  quantita               NUMERIC NOT NULL,
  unita_misura           TEXT DEFAULT 'kg',
  n_pedane               INTEGER DEFAULT 1,
  giacenza               NUMERIC DEFAULT 0,
  note                   TEXT DEFAULT '',
  stato                  TEXT DEFAULT 'ok' CHECK (stato IN ('ok','riserva','in_uso','esaurito','soglia')),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOTTI SM ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lotti_sm (
  id                  BIGSERIAL PRIMARY KEY,
  codice              TEXT NOT NULL UNIQUE,
  tipo_codice         TEXT NOT NULL,
  tipo_descrizione    TEXT DEFAULT '',
  quantita            NUMERIC NOT NULL,
  unita_misura        TEXT DEFAULT 'pz',
  data_lavorazione    DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_lavorazione    TEXT DEFAULT 'interna' CHECK (tipo_lavorazione IN ('interna','esterna')),
  fornitore_sm_id     BIGINT REFERENCES fornitori(id) ON DELETE SET NULL,
  ddt_numero          TEXT,
  ddt_data            DATE,
  giacenza            NUMERIC DEFAULT 0,
  note                TEXT DEFAULT '',
  stato               TEXT DEFAULT 'disponibile'
                      CHECK (stato IN ('disponibile','in_uso','esaurito','attesa')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── SM ← MP (molti-a-molti) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sm_input_mp (
  id               BIGSERIAL PRIMARY KEY,
  lotto_sm_id      BIGINT NOT NULL REFERENCES lotti_sm(id) ON DELETE CASCADE,
  lotto_mp_codice  TEXT NOT NULL,
  quantita_usata   NUMERIC DEFAULT 0
);

-- ── LOTTI PF ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lotti_pf (
  id                    BIGSERIAL PRIMARY KEY,
  codice                TEXT NOT NULL UNIQUE,
  articolo_codice       TEXT NOT NULL,
  articolo_descrizione  TEXT DEFAULT '',
  quantita              NUMERIC NOT NULL,
  unita_misura          TEXT DEFAULT 'pz',
  linea                 TEXT DEFAULT 'Linea A',
  riciclo_codici        TEXT DEFAULT '',
  idoneo_alimenti       BOOLEAN DEFAULT FALSE,
  giacenza              NUMERIC DEFAULT 0,
  stato                 TEXT DEFAULT 'in_corso'
                        CHECK (stato IN ('in_corso','attesa','completato','annullato')),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PF ← MP (molti-a-molti) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pf_input_mp (
  id               BIGSERIAL PRIMARY KEY,
  lotto_pf_id      BIGINT NOT NULL REFERENCES lotti_pf(id) ON DELETE CASCADE,
  lotto_mp_codice  TEXT NOT NULL,
  quantita_usata   NUMERIC DEFAULT 0
);

-- ── PF ← SM (molti-a-molti) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pf_input_sm (
  id               BIGSERIAL PRIMARY KEY,
  lotto_pf_id      BIGINT NOT NULL REFERENCES lotti_pf(id) ON DELETE CASCADE,
  lotto_sm_codice  TEXT NOT NULL,
  quantita_usata   NUMERIC DEFAULT 0
);

-- ── DDT / SPEDIZIONI ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ddt (
  id               BIGSERIAL PRIMARY KEY,
  numero           TEXT NOT NULL UNIQUE,
  cliente          TEXT NOT NULL,
  data_spedizione  DATE,
  vettore          TEXT DEFAULT '',
  note             TEXT DEFAULT '',
  stato            TEXT DEFAULT 'in_transito'
                   CHECK (stato IN ('in_transito','consegnato','annullato')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── DDT RIGHE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ddt_righe (
  id               BIGSERIAL PRIMARY KEY,
  ddt_id           BIGINT NOT NULL REFERENCES ddt(id) ON DELETE CASCADE,
  lotto_pf_codice  TEXT NOT NULL,
  quantita         NUMERIC DEFAULT 0
);

-- ── INDICI ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lotti_mp_codice  ON lotti_mp(codice);
CREATE INDEX IF NOT EXISTS idx_lotti_sm_codice  ON lotti_sm(codice);
CREATE INDEX IF NOT EXISTS idx_lotti_pf_codice  ON lotti_pf(codice);
CREATE INDEX IF NOT EXISTS idx_sm_input_mp_sm   ON sm_input_mp(lotto_sm_id);
CREATE INDEX IF NOT EXISTS idx_pf_input_mp_pf   ON pf_input_mp(lotto_pf_id);
CREATE INDEX IF NOT EXISTS idx_pf_input_sm_pf   ON pf_input_sm(lotto_pf_id);
CREATE INDEX IF NOT EXISTS idx_ddt_righe_ddt    ON ddt_righe(ddt_id);

-- ── DATI DI ESEMPIO ──────────────────────────────────────────
INSERT INTO fornitori (ragione_sociale, piva, materiali, stato) VALUES
  ('Cartiera Rossi S.r.l.',    'IT04521830756', 'Cartone',          'attivo'),
  ('ColorPrint S.r.l.',         'IT03847120651', 'Inchiostri',       'attivo'),
  ('Imballaggi Sud S.p.A.',     'IT07234890723', 'Cartone, Film',    'attivo'),
  ('Terzista Lavorazioni Srl',  'IT08812340719', 'Semilavorati',     'attivo')
ON CONFLICT DO NOTHING;

INSERT INTO materiali (codice, descrizione, tipo, unita_misura, soglia_minima) VALUES
  ('CAR',  'Cartone ondulato 3 onde B/C', 'MP', 'kg',  100),
  ('CAR2', 'Cartone teso 2mm',            'MP', 'kg',  50),
  ('INC',  'Inchiostro base acqua',       'MP', 'kg',  10),
  ('COL',  'Colla vinilica',              'MP', 'kg',  20),
  ('SCT',  'Fustellato grezzo',           'SM', 'pz',  500),
  ('BOB',  'Bobina stampata',             'SM', 'mt',  100),
  ('PRE',  'Preformato incollato',        'SM', 'pz',  200)
ON CONFLICT DO NOTHING;

INSERT INTO articoli (codice, descrizione, gtin14, stato) VALUES
  ('SC-001', 'Scatola 300x200x150mm',    '09788423400123', 'attivo'),
  ('SC-002', 'Scatola 400x300x200mm',    '09788423400130', 'attivo'),
  ('IM-010', 'Imballaggio food grade 1L','09788423400147', 'attivo')
ON CONFLICT DO NOTHING;

-- ── RLS (Row Level Security) - disabilitata per uso locale ──
-- Per produzione abilitare RLS e aggiungere policy appropriate
-- ALTER TABLE fornitori ENABLE ROW LEVEL SECURITY;
-- ecc.
