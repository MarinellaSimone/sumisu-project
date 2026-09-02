-- Aggiunge il codice numerico obbligatorio e i vincoli dei codici articolo.
-- Eseguire sulle installazioni gia esistenti prima di usare la nuova form.

alter table articoli_pf add column if not exists codice_numerico text;

update articoli_pf
set codice = case codice
  when 'SC-001' then 'SC01'
  when 'SC-002' then 'SC02'
  when 'IM-010' then 'IM10'
  else codice
end
where codice in ('SC-001', 'SC-002', 'IM-010');

update articoli_pf
set codice_numerico = lpad(numerazione.row_number::text, 4, '0')
from (
  select id, row_number() over (order by creato_il, id) as row_number
  from articoli_pf
  where codice_numerico is null
) numerazione
where articoli_pf.id = numerazione.id;

alter table articoli_pf alter column codice_numerico set not null;

alter table articoli_pf drop constraint if exists articoli_pf_codice_check;
alter table articoli_pf add constraint articoli_pf_codice_check
  check (codice ~ '^[A-Za-z0-9]{4}$');

alter table articoli_pf drop constraint if exists articoli_pf_codice_numerico_check;
alter table articoli_pf add constraint articoli_pf_codice_numerico_check
  check (codice_numerico ~ '^[0-9]{4}$');