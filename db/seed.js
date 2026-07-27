// ============================================================
// TrackPack · Seed database
// Popola utenti demo + anagrafiche + lotti di esempio.
// Esegui DOPO aver creato lo schema (db/schema.sql) su Supabase.
//   npm run init-db
// ============================================================
const bcrypt = require('bcryptjs');
const supabase = require('../src/supabase');

async function upsertUtenti() {
  const utenti = [
    { username: 'admin',      nome: 'Amministratore', ruolo: 'admin',     pw: 'admin2026' },
    { username: 'operatore1', nome: 'Mario Rossi',    ruolo: 'operatore', pw: 'pass123' },
    { username: 'operatore2', nome: 'Lucia Verde',    ruolo: 'operatore', pw: 'pass123', attivo: false },
  ];
  for (const u of utenti) {
    const password_hash = await bcrypt.hash(u.pw, 10);
    const { error } = await supabase.from('utenti').upsert({
      username: u.username,
      nome: u.nome,
      ruolo: u.ruolo,
      password_hash,
      attivo: u.attivo !== false,
    }, { onConflict: 'username' });
    if (error) console.error('  utente', u.username, error.message);
    else console.log('  ✓ utente', u.username, `(${u.pw})`);
  }
}

async function upsertFornitori() {
  const rows = [
    { ragione_sociale: 'Cartiera Rossi S.r.l.',  piva: 'IT04521830756', stato: 'Attivo' },
    { ragione_sociale: 'ColorPrint S.r.l.',       piva: 'IT03847120651', stato: 'Attivo' },
    { ragione_sociale: 'Imballaggi Sud S.p.A.',   piva: 'IT07234890723', stato: 'Attivo' },
    { ragione_sociale: 'AdhesivePro S.r.l.',      piva: 'IT05129340812', stato: 'Sospeso' },
  ];
  const { error } = await supabase.from('fornitori').insert(rows);
  if (error && !error.message.includes('duplicate')) console.error('  fornitori', error.message);
  else console.log('  ✓ fornitori');
}

async function upsertMateriali() {
  const rows = [
    { codice: 'CAR', descrizione: 'Cartone 3 onde B/C',       tipo: 'MP', unita_misura: 'kg', soglia_minima: 50 },
    { codice: 'INC', descrizione: 'Inchiostro base acqua',    tipo: 'MP', unita_misura: 'kg', soglia_minima: 40 },
    { codice: 'COL', descrizione: 'Colla vinilica',           tipo: 'MP', unita_misura: 'kg', soglia_minima: 25 },
    { codice: 'SCT', descrizione: 'Fustellato grezzo',        tipo: 'SM', unita_misura: 'pz' },
    { codice: 'BOB', descrizione: 'Bobina stampata',          tipo: 'SM', unita_misura: 'mt' },
  ];
  for (const r of rows) {
    const { error } = await supabase.from('materiali').upsert(r, { onConflict: 'codice' });
    if (error) console.error('  materiale', r.codice, error.message);
  }
  console.log('  ✓ materiali');
}

async function upsertArticoli() {
  const rows = [
    { codice: 'SC-001', descrizione: 'Scatola 300×200×150mm', gtin14: '09788423400123', stato: 'Attivo' },
    { codice: 'SC-002', descrizione: 'Scatola 400×300×200mm', gtin14: '09788423400130', stato: 'Attivo' },
    { codice: 'IM-010', descrizione: 'Imb. food grade 1L',    gtin14: '09788423400147', stato: 'Attivo' },
  ];
  for (const r of rows) {
    const { error } = await supabase.from('articoli_pf').upsert(r, { onConflict: 'codice' });
    if (error) console.error('  articolo', r.codice, error.message);
  }
  console.log('  ✓ articoli PF');
}

async function seedLotti() {
  // Prendo id fornitori / materiali / articoli per collegare i lotti
  const { data: forn } = await supabase.from('fornitori').select('id,ragione_sociale');
  const { data: mat }  = await supabase.from('materiali').select('id,codice');
  const { data: art }  = await supabase.from('articoli_pf').select('id,codice');
  const fById = (n) => (forn || []).find(f => f.ragione_sociale.startsWith(n))?.id;
  const mById = (c) => (mat || []).find(m => m.codice === c)?.id;
  const aById = (c) => (art || []).find(a => a.codice === c)?.id;

  const mpRows = [
    { codice_lotto: 'LT-20260707-CAR-001', fornitore_id: fById('Cartiera'), materiale_id: mById('CAR'), ddt_numero: '2026/0445', ddt_data: '2026-07-07', quantita: 400, giacenza: 400, unita_misura: 'kg', n_pedane: 4, stato: 'Ok' },
    { codice_lotto: 'LT-20260706-INC-002', fornitore_id: fById('ColorPrint'), materiale_id: mById('INC'), ddt_numero: '2026/0432', ddt_data: '2026-07-06', quantita: 33, giacenza: 33, unita_misura: 'kg', n_pedane: 1, stato: 'Ok' },
    { codice_lotto: 'LT-20260705-COL-001', fornitore_id: fById('AdhesivePro'), materiale_id: mById('COL'), ddt_numero: '2026/0410', ddt_data: '2026-07-05', quantita: 18, giacenza: 18, unita_misura: 'kg', n_pedane: 1, stato: 'Soglia' },
  ];
  for (const r of mpRows) {
    const { error } = await supabase.from('lotti_mp').upsert(r, { onConflict: 'codice_lotto' });
    if (error) console.error('  lotto MP', r.codice_lotto, error.message);
  }

  const smRows = [
    { codice_lotto: 'SM-20260707-SCT-001', tipo_semilavorato: 'Fustellato grezzo', lavorazione: 'interna', quantita: 3000, giacenza: 3000, unita_misura: 'pz', data_lavorazione: '2026-07-07', stato: 'Disponibile' },
    { codice_lotto: 'SM-20260706-BOB-002', tipo_semilavorato: 'Bobina stampata', lavorazione: 'esterna', fornitore_sm_id: fById('ColorPrint'), quantita: 800, giacenza: 800, unita_misura: 'mt', data_lavorazione: '2026-07-06', stato: 'In uso' },
  ];
  for (const r of smRows) {
    const { error } = await supabase.from('lotti_sm').upsert(r, { onConflict: 'codice_lotto' });
    if (error) console.error('  lotto SM', r.codice_lotto, error.message);
  }

  const pfRows = [
    { codice_lotto: 'PF-20260707-SC001-001', articolo_id: aById('SC-001'), quantita: 5000, giacenza: 5000, unita_misura: 'pz', stato: 'In corso' },
    { codice_lotto: 'PF-20260707-IM010-002', articolo_id: aById('IM-010'), quantita: 12000, giacenza: 12000, unita_misura: 'pz', stato: 'Attesa' },
    { codice_lotto: 'PF-20260706-SC002-005', articolo_id: aById('SC-002'), quantita: 3200, giacenza: 3200, unita_misura: 'pz', stato: 'Completato' },
  ];
  for (const r of pfRows) {
    const { error } = await supabase.from('lotti_pf').upsert(r, { onConflict: 'codice_lotto' });
    if (error) console.error('  lotto PF', r.codice_lotto, error.message);
  }
  console.log('  ✓ lotti MP / SM / PF');

  const spRows = [
    { ddt_numero: 'DDT-2026-0088', cliente: 'Alimentari Rossi S.r.l.', data_spedizione: '2026-07-06', vettore: 'BRT', stato: 'Consegnato' },
    { ddt_numero: 'DDT-2026-0087', cliente: 'GDO Sud',                 data_spedizione: '2026-07-05', vettore: 'GLS', stato: 'Consegnato' },
    { ddt_numero: 'DDT-2026-0086', cliente: 'Coop Puglia',             data_spedizione: '2026-07-04', vettore: 'BRT', stato: 'In transito' },
  ];
  for (const r of spRows) {
    const { error } = await supabase.from('spedizioni').upsert(r, { onConflict: 'ddt_numero' });
    if (error) console.error('  spedizione', r.ddt_numero, error.message);
  }
  console.log('  ✓ spedizioni');
}

(async () => {
  console.log('\n[TrackPack] Seed database in corso...\n');
  await upsertUtenti();
  await upsertFornitori();
  await upsertMateriali();
  await upsertArticoli();
  await seedLotti();
  console.log('\n[TrackPack] Seed completato.\n');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
