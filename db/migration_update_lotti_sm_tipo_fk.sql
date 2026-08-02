-- ============================================================
-- Migration: lotti_sm.tipo_semilavorato -> FK su materiali(id)
-- Esegue su un DB già esistente.
-- ============================================================

BEGIN;

-- 1) Aggiungi una colonna temporanea UUID con FK
ALTER TABLE public.lotti_sm
  ADD COLUMN IF NOT EXISTS tipo_semilavorato_new uuid
  REFERENCES public.materiali(id);

-- 2) Backfill: mappa i vecchi valori testuali ai materiali SM
--    condescrizione equivalente (es. 'Fustellato grezzo' -> materiale SM)
UPDATE public.lotti_sm AS sm
SET tipo_semilavorato_new = m.id
FROM public.materiali AS m
WHERE m.tipo = 'SM'
  AND lower(trim(m.descrizione)) = lower(trim(sm.tipo_semilavorato));

-- 3) Verifica / eventuale audit dei record non migrati
--    (se trovi valori non associati, correggili in materiale prima di proseguire)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lotti_sm sm
    LEFT JOIN public.materiali m
      ON m.id = sm.tipo_semilavorato_new
    WHERE sm.tipo_semilavorato IS NOT NULL
      AND m.id IS NULL
  ) THEN
    RAISE NOTICE 'Ci sono record lotti_sm con tipo_semilavorato non mappati a materiali SM. Verifica manualmente i dati.';
  END IF;
END $$;

-- 4) Rimuovi la vecchia colonna text
ALTER TABLE public.lotti_sm
  DROP COLUMN IF EXISTS tipo_semilavorato;

-- 5) Rinomina la nuova colonna in modo da mantenere lo stesso nome
ALTER TABLE public.lotti_sm
  RENAME COLUMN tipo_semilavorato_new TO tipo_semilavorato;

COMMIT;
