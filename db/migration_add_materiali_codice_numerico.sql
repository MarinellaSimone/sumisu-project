-- Aggiunge il codice numerico obbligatorio e i vincoli dei codici materiali.
-- Eseguire sulle installazioni gia esistenti prima di usare la nuova form.

alter table materiali add column if not exists codice_numerico text;

-- Valori stabili per i materiali demo/esistenti con il vecchio codice a 3 caratteri.
update materiali
set codice = case codice
  when 'CAR' then 'CART'
  when 'INC' then 'INCH'
  when 'COL' then 'COLL'
  when 'SCT' then 'FUST'
  when 'BOB' then 'BOBI'
  else codice
end
where codice in ('CAR', 'INC', 'COL', 'SCT', 'BOB');

update materiali
set codice_numerico = lpad(numerazione.row_number::text, 4, '0')
from (
  select id, row_number() over (order by creato_il, id) as row_number
  from materiali
  where codice_numerico is null
) numerazione
where materiali.id = numerazione.id;

alter table materiali alter column codice_numerico set not null;

alter table materiali drop constraint if exists materiali_codice_check;
alter table materiali add constraint materiali_codice_check
  check (codice ~ '^[A-Za-z0-9]{4}$');

alter table materiali drop constraint if exists materiali_codice_numerico_check;
alter table materiali add constraint materiali_codice_numerico_check
  check (codice_numerico ~ '^[0-9]{4}$');