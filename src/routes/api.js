const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');
const { requireAdmin } = require('../middleware/auth');
const { generaLottoMP, generaLottoSM, generaLottoPF, generaDDT } = require('../lotto');

const router = express.Router();

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: e.message || 'Errore server' });
});

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard', wrap(async (req, res) => {
  const [{ count: mpCount }, { count: smCount }, { count: pfCount }] = await Promise.all([
    supabase.from('lotti_mp').select('*', { count: 'exact', head: true }),
    supabase.from('lotti_sm').select('*', { count: 'exact', head: true }).neq('stato', 'Esaurito'),
    supabase.from('lotti_pf').select('*', { count: 'exact', head: true }).in('stato', ['In corso', 'Attesa']),
  ]);

  // Lotti MP sotto soglia
  const { data: mpAll } = await supabase
    .from('lotti_mp')
    .select('codice_lotto,giacenza,unita_misura,materiali(codice,descrizione,soglia_minima)');
  const sottoSoglia = (mpAll || []).filter(
    (l) => l.materiali && l.materiali.soglia_minima > 0 && Number(l.giacenza) <= Number(l.materiali.soglia_minima)
  );

  // Ordini PF attivi
  const { data: ordiniPF } = await supabase
    .from('lotti_pf')
    .select('codice_lotto,quantita,unita_misura,stato,articoli_pf(codice,descrizione)')
    .order('creato_il', { ascending: false })
    .limit(10);

  // Ultimi movimenti (unione semplice)
  const { data: ultMp } = await supabase.from('lotti_mp').select('codice_lotto,creato_il,materiali(descrizione)').order('creato_il', { ascending: false }).limit(3);
  const { data: ultSm } = await supabase.from('lotti_sm').select('codice_lotto,creato_il,materiali(descrizione)').order('creato_il', { ascending: false }).limit(3);
  const { data: ultPf } = await supabase.from('lotti_pf').select('codice_lotto,creato_il,articoli_pf(descrizione)').order('creato_il', { ascending: false }).limit(3);

  const movimenti = [
    ...(ultMp || []).map((r) => ({ tipo: 'MP', codice: r.codice_lotto, desc: r.materiali?.descrizione || '', ts: r.creato_il })),
    ...(ultSm || []).map((r) => ({ tipo: 'SM', codice: r.codice_lotto, desc: r.materiali?.descrizione || '', ts: r.creato_il })),
    ...(ultPf || []).map((r) => ({ tipo: 'PF', codice: r.codice_lotto, desc: r.articoli_pf?.descrizione || '', ts: r.creato_il })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6);

  res.json({
    kpi: {
      mp: mpCount || 0,
      sm: smCount || 0,
      pf: pfCount || 0,
      sottoSoglia: sottoSoglia.length,
    },
    sottoSoglia: sottoSoglia.map((l) => ({
      codice: l.materiali?.codice, descrizione: l.materiali?.descrizione,
      giacenza: l.giacenza, um: l.unita_misura,
    })),
    ordiniPF: (ordiniPF || []).map((o) => ({
      codice: o.codice_lotto,
      articolo: o.articoli_pf ? `${o.articoli_pf.descrizione}` : '',
      qty: o.quantita, um: o.unita_misura, stato: o.stato,
    })),
    movimenti,
  });
}));

// ============================================================
// FORNITORI / MATERIALI / ARTICOLI (anagrafiche)
// ============================================================
router.get('/fornitori', wrap(async (req, res) => {
  const { data, error } = await supabase.from('fornitori').select('*').order('ragione_sociale');
  if (error) throw error;
  res.json(data);
}));

router.post('/fornitori', requireAdmin, wrap(async (req, res) => {
  const { ragione_sociale, piva, stato } = req.body;
  if (!ragione_sociale) return res.status(400).json({ error: 'Ragione sociale obbligatoria' });
  const { data, error } = await supabase.from('fornitori')
    .insert({ ragione_sociale, piva, stato: stato || 'Attivo' }).select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/fornitori/:id', requireAdmin, wrap(async (req, res) => {
  const { ragione_sociale, piva, stato } = req.body || {};
  if (!ragione_sociale || !String(ragione_sociale).trim()) {
    return res.status(400).json({ error: 'Ragione sociale obbligatoria' });
  }

  const payload = {
    ragione_sociale: String(ragione_sociale).trim(),
    piva: piva && String(piva).trim() ? String(piva).trim() : null,
    stato: stato || 'Attivo',
  };

  const { data, error } = await supabase.from('fornitori').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/fornitori/:id', requireAdmin, wrap(async (req, res) => {
  const { error } = await supabase.from('fornitori').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/clienti', wrap(async (req, res) => {
  const { data, error } = await supabase.from('clienti').select('*').order('ragione_sociale');
  if (error) throw error;
  res.json(data);
}));

router.post('/clienti', requireAdmin, wrap(async (req, res) => {
  const { ragione_sociale, partita_iva, email, telefono, stato } = req.body;
  if (!ragione_sociale) return res.status(400).json({ error: 'Ragione sociale obbligatoria' });
  const { data, error } = await supabase.from('clienti')
    .insert({ ragione_sociale, partita_iva, email, telefono, stato: stato || 'Attivo' }).select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/clienti/:id', requireAdmin, wrap(async (req, res) => {
  const { ragione_sociale, partita_iva, email, telefono, stato } = req.body || {};
  if (!ragione_sociale || !String(ragione_sociale).trim()) {
    return res.status(400).json({ error: 'Ragione sociale obbligatoria' });
  }

  const payload = {
    ragione_sociale: String(ragione_sociale).trim(),
    partita_iva: partita_iva && String(partita_iva).trim() ? String(partita_iva).trim() : null,
    email: email && String(email).trim() ? String(email).trim() : null,
    telefono: telefono && String(telefono).trim() ? String(telefono).trim() : null,
    stato: stato || 'Attivo',
  };

  const { data, error } = await supabase.from('clienti').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/clienti/:id', requireAdmin, wrap(async (req, res) => {
  const { error } = await supabase.from('clienti').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/materiali', wrap(async (req, res) => {
  const q = supabase.from('materiali').select('*').order('codice');
  const { data, error } = req.query.tipo ? await q.eq('tipo', req.query.tipo) : await q;
  if (error) throw error;
  res.json(data);
}));

router.get('/tipologie', wrap(async (req, res) => {
  const { data, error } = await supabase.from('tipologie').select('tipologia,codice').order('tipologia').order('codice');
  if (error) throw error;
  res.json(data);
}));

router.post('/materiali', requireAdmin, wrap(async (req, res) => {
  const { codice, codice_numerico, descrizione, tipo, unita_misura, soglia_minima } = req.body;
  if (!codice || !descrizione) return res.status(400).json({ error: 'Codice e descrizione obbligatori' });
  if (!/^[A-Za-z0-9/\\]+$/.test(String(codice || ''))) return res.status(400).json({ error: 'Il codice deve contenere solo caratteri alfanumerici' });
  if (!/^[0-9]{7}$/.test(String(codice_numerico || ''))) return res.status(400).json({ error: 'Il codice numerico deve contenere 7 cifre' });

  const normalizedCode = String(codice).trim().toUpperCase();
  const { data: existing } = await supabase.from('materiali').select('*').ilike('codice', normalizedCode).maybeSingle();
  if (existing) return res.json(existing);

  const { data, error } = await supabase.from('materiali')
    .insert({ codice: normalizedCode, codice_numerico, descrizione, tipo: tipo || 'MP', unita_misura: unita_misura || 'kg', soglia_minima: soglia_minima || 0 })
    .select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/materiali/:id', requireAdmin, wrap(async (req, res) => {
  const { codice, codice_numerico, descrizione, tipo, unita_misura, soglia_minima } = req.body || {};
  if (!codice || !descrizione) return res.status(400).json({ error: 'Codice e descrizione obbligatori' });
  if (!/^[A-Za-z0-9]+$/.test(String(codice || ''))) return res.status(400).json({ error: 'Il codice deve contenere solo caratteri alfanumerici' });
  if (!/^[0-9]{7}$/.test(String(codice_numerico || ''))) return res.status(400).json({ error: 'Il codice numerico deve contenere 7 cifre' });

  const payload = {
    codice: String(codice).trim().toUpperCase(),
    codice_numerico: String(codice_numerico).trim(),
    descrizione: String(descrizione).trim(),
    tipo: String(tipo || 'MP').trim().toUpperCase(),
    unita_misura: String(unita_misura || 'kg').trim(),
    soglia_minima: Number(soglia_minima) || 0,
  };

  const { data, error } = await supabase.from('materiali').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/materiali/:id', requireAdmin, wrap(async (req, res) => {
  const { error } = await supabase.from('materiali').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/articoli', wrap(async (req, res) => {
  const { data, error } = await supabase.from('articoli_pf').select('*').order('codice');
  if (error) throw error;
  res.json(data);
}));

router.post('/articoli', requireAdmin, wrap(async (req, res) => {
  const { codice, codice_numerico, descrizione, gtin14, stato } = req.body;
  if (!codice || !descrizione) return res.status(400).json({ error: 'Codice e descrizione obbligatori' });
  if (!/^[A-Za-z0-9]+$/.test(String(codice || ''))) return res.status(400).json({ error: 'Il codice deve contenere solo caratteri alfanumerici' });
  if (!/^[0-9]{7}$/.test(String(codice_numerico || ''))) return res.status(400).json({ error: 'Il codice numerico deve contenere 7 cifre' });
  const { data, error } = await supabase.from('articoli_pf')
    .insert({ codice: codice.toUpperCase(), codice_numerico, descrizione, gtin14, stato: stato || 'Attivo' }).select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/articoli/:id', requireAdmin, wrap(async (req, res) => {
  const { codice, codice_numerico, descrizione, stato } = req.body || {};
  if (!codice || !descrizione) return res.status(400).json({ error: 'Codice e descrizione obbligatori' });
  if (!/^[A-Za-z0-9]+$/.test(String(codice || ''))) return res.status(400).json({ error: 'Il codice deve contenere solo caratteri alfanumerici' });
  if (!/^[0-9]{7}$/.test(String(codice_numerico || ''))) return res.status(400).json({ error: 'Il codice numerico deve contenere 7 cifre' });

  const payload = {
    codice: String(codice).trim().toUpperCase(),
    codice_numerico: String(codice_numerico).trim(),
    descrizione: String(descrizione).trim(),
    stato: stato || 'Attivo',
  };

  const { data, error } = await supabase.from('articoli_pf').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/articoli/:id', requireAdmin, wrap(async (req, res) => {
  const { error } = await supabase.from('articoli_pf').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ============================================================
// RICEVIMENTO MP
// ============================================================
router.get('/lotti-mp', wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('lotti_mp')
    .select('*,fornitori(ragione_sociale),materiali(codice,codice_numerico,descrizione)')
    .order('creato_il', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

router.post('/lotti-mp', wrap(async (req, res) => {
  const { fornitore_id, materiale_id, ddt_numero, ddt_data, quantita, unita_misura, n_pedane, note, label_options } = req.body;

  // sigla materiale per il codice lotto
  let sigla = 'GEN';
  if (materiale_id) {
    const { data: m } = await supabase.from('materiali').select('codice').eq('id', materiale_id).maybeSingle();
    if (m) sigla = m.codice;
  }
  const codice_lotto = await generaLottoMP(sigla, ddt_data);

  const { data, error } = await supabase.from('lotti_mp').insert({
    codice_lotto,
    fornitore_id: fornitore_id || null,
    materiale_id: materiale_id || null,
    ddt_numero, ddt_data: ddt_data || null,
    quantita: Number(quantita) || 0,
    giacenza: Number(quantita) || 0,
    unita_misura: unita_misura || 'kg',
    n_pedane: Number(n_pedane) || 0,
    note,
    label_options: label_options || {},
    creato_da: req.session.user.id,
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// LAVORAZIONE SM
// ============================================================
router.get('/lotti-sm', wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('lotti_sm')
    .select('*,fornitori(ragione_sociale),materiali(codice,descrizione)')
    .order('creato_il', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

router.post('/lotti-sm', wrap(async (req, res) => {
  const { tipo_semilavorato, lavorazione, fornitore_sm_id, ddt_numero, ddt_data,
          quantita, unita_misura, data_lavorazione, note, consumi, consumi_mp, consumi_sm, label_options } = req.body;
  const consumiMP = consumi_mp || consumi;
  await verificaDisponibilita('lotti_mp', consumiMP, 'lotto_mp_id');
  await verificaDisponibilita('lotti_sm', consumi_sm, 'lotto_sm_origine_id');

  const { data: materiale } = await supabase.from('materiali').select('codice').eq('id', tipo_semilavorato).maybeSingle();
  const sigla = String(materiale?.codice || 'SM').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codice_lotto = await generaLottoSM(sigla, data_lavorazione);

  const { data: lotto, error } = await supabase.from('lotti_sm').insert({
    codice_lotto,
    tipo_semilavorato: tipo_semilavorato || null,
    lavorazione: lavorazione === 'esterna' ? 'esterna' : 'interna',
    fornitore_sm_id: fornitore_sm_id || null,
    ddt_numero, ddt_data: ddt_data || null,
    quantita: Number(quantita) || 0,
    giacenza: Number(quantita) || 0,
    unita_misura: unita_misura || 'pz',
    data_lavorazione: data_lavorazione || null,
    note,
    label_options: label_options || {},
    creato_da: req.session.user.id,
  }).select().single();
  if (error) throw error;

  // Registra consumi MP e SM e scala le relative giacenze
  if (Array.isArray(consumiMP)) {
    for (const c of consumiMP) {
      if (!c.lotto_mp_id) continue;
      const { error: consumoError } = await supabase.from('sm_consumi_mp').insert({
        lotto_sm_id: lotto.id, lotto_mp_id: c.lotto_mp_id,
        quantita: Number(c.quantita) || 0, unita_misura: c.unita_misura,
      });
      if (consumoError) throw consumoError;
      await scalaGiacenza('lotti_mp', c.lotto_mp_id, Number(c.quantita) || 0);
    }
  }
  if (Array.isArray(consumi_sm)) {
    for (const c of consumi_sm) {
      if (!c.lotto_sm_origine_id) continue;
      const { error: consumoError } = await supabase.from('sm_consumi_sm').insert({
        lotto_sm_id: lotto.id, lotto_sm_origine_id: c.lotto_sm_origine_id,
        quantita: Number(c.quantita) || 0, unita_misura: c.unita_misura,
      });
      if (consumoError) throw consumoError;
      await scalaGiacenza('lotti_sm', c.lotto_sm_origine_id, Number(c.quantita) || 0);
    }
  }
  res.json(lotto);
}));

// ============================================================
// PRODUZIONE PF
// ============================================================
router.get('/lotti-pf', wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('lotti_pf')
    .select('*,articoli_pf(codice,descrizione)')
    .order('creato_il', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

router.post('/lotti-pf', wrap(async (req, res) => {
  const { articolo_id, quantita, unita_misura, data_produzione, note, consumi_mp, consumi_sm, label_options } = req.body;
  await verificaDisponibilita('lotti_mp', consumi_mp, 'lotto_mp_id');
  await verificaDisponibilita('lotti_sm', consumi_sm, 'lotto_sm_id');

  let sigla = 'PF';
  if (articolo_id) {
    const { data: a } = await supabase.from('articoli_pf').select('codice').eq('id', articolo_id).maybeSingle();
    if (a) sigla = a.codice;
  }
  const codice_lotto = await generaLottoPF(sigla, data_produzione);

  const { data: lotto, error } = await supabase.from('lotti_pf').insert({
    codice_lotto,
    articolo_id: articolo_id || null,
    quantita: Number(quantita) || 0,
    giacenza: Number(quantita) || 0,
    unita_misura: unita_misura || 'pz',
    data_produzione: data_produzione || null,
    note,
    label_options: label_options || {},
    stato: 'In corso',
    creato_da: req.session.user.id,
  }).select().single();
  if (error) throw error;

  if (Array.isArray(consumi_mp)) {
    for (const c of consumi_mp) {
      if (!c.lotto_mp_id) continue;
      await supabase.from('pf_consumi_mp').insert({
        lotto_pf_id: lotto.id, lotto_mp_id: c.lotto_mp_id,
        quantita: Number(c.quantita) || 0, unita_misura: c.unita_misura,
      });
      if (Number(c.quantita) > 0) await scalaGiacenza('lotti_mp', c.lotto_mp_id, Number(c.quantita));
    }
  }
  if (Array.isArray(consumi_sm)) {
    for (const c of consumi_sm) {
      if (!c.lotto_sm_id) continue;
      await supabase.from('pf_consumi_sm').insert({
        lotto_pf_id: lotto.id, lotto_sm_id: c.lotto_sm_id,
        quantita: Number(c.quantita) || 0, unita_misura: c.unita_misura,
      });
      if (Number(c.quantita) > 0) await scalaGiacenza('lotti_sm', c.lotto_sm_id, Number(c.quantita));
    }
  }
  res.json(lotto);
}));

// ============================================================
// MAGAZZINO (giacenze correnti)
// ============================================================
router.get('/magazzino/:tipo', wrap(async (req, res) => {
  const { tipo } = req.params;
  let query;
  if (tipo === 'mp') query = supabase.from('lotti_mp').select('id,codice_lotto,quantita,giacenza,unita_misura,stato,materiali(descrizione)').gt('giacenza', 0).order('creato_il', { ascending: false });
  else if (tipo === 'sm') query = supabase.from('lotti_sm').select('id,codice_lotto,quantita,giacenza,unita_misura,stato,materiali(descrizione)').gt('giacenza', 0).order('creato_il', { ascending: false });
  else if (tipo === 'pf') query = supabase.from('lotti_pf').select('id,codice_lotto,quantita,giacenza,unita_misura,stato,articoli_pf(descrizione)').gt('giacenza', 0).order('creato_il', { ascending: false });
  else return res.status(400).json({ error: 'Tipo non valido' });

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((r) => ({
    id: r.id,
    codice: r.codice_lotto,
    desc: tipo === 'pf' ? r.articoli_pf?.descrizione : r.materiali?.descrizione,
    quantita: r.quantita,
    giacenza: r.giacenza,
    um: r.unita_misura,
    stato: r.stato,
  }));

  return res.json(rows);
}));

router.patch('/lotti-mp/:id', wrap(async (req, res) => {
  const { giacenza, quantita, stato } = req.body || {};
  const update = {};
  if (giacenza !== undefined) update.giacenza = Math.max(0, Number(giacenza) || 0);
  if (quantita !== undefined) update.quantita = Math.max(0, Number(quantita) || 0);
  if (stato) update.stato = stato;
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nessun dato da aggiornare' });
  const { data, error } = await supabase.from('lotti_mp').update({
    ...update,
    stato: update.stato || calcolaStatoLotto('mp', update.giacenza ?? undefined),
  }).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/lotti-sm/:id', wrap(async (req, res) => {
  const { giacenza, quantita, stato } = req.body || {};
  const update = {};
  if (giacenza !== undefined) update.giacenza = Math.max(0, Number(giacenza) || 0);
  if (quantita !== undefined) update.quantita = Math.max(0, Number(quantita) || 0);
  if (stato) update.stato = stato;
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nessun dato da aggiornare' });
  const { data, error } = await supabase.from('lotti_sm').update({
    ...update,
    stato: update.stato || calcolaStatoLotto('sm', update.giacenza ?? undefined),
  }).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/lotti-pf/:id', wrap(async (req, res) => {
  const { giacenza, quantita, stato } = req.body || {};
  const update = {};
  if (giacenza !== undefined) update.giacenza = Math.max(0, Number(giacenza) || 0);
  if (quantita !== undefined) update.quantita = Math.max(0, Number(quantita) || 0);
  if (stato) update.stato = stato;
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nessun dato da aggiornare' });
  const { data, error } = await supabase.from('lotti_pf').update({
    ...update,
    stato: update.stato || calcolaStatoLotto('pf', update.giacenza ?? undefined),
  }).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

async function azzeraLotto(tabella, id) {
  const stato = tabella === 'lotti_mp' ? 'Esaurito' : tabella === 'lotti_sm' ? 'Esaurito' : 'Completato';
  const { error } = await supabase.from(tabella).update({ giacenza: 0, quantita: 0, stato }).eq('id', id);
  if (error) throw error;
}

router.delete('/lotti-mp/:id', wrap(async (req, res) => {
  await azzeraLotto('lotti_mp', req.params.id);
  res.json({ ok: true });
}));

router.delete('/lotti-sm/:id', wrap(async (req, res) => {
  await azzeraLotto('lotti_sm', req.params.id);
  res.json({ ok: true });
}));

router.delete('/lotti-pf/:id', wrap(async (req, res) => {
  await azzeraLotto('lotti_pf', req.params.id);
  res.json({ ok: true });
}));

async function eliminaLottoStorico(tabella, id, collegamenti, messaggio, res) {
  const verifiche = await Promise.all(collegamenti.map(({ tabella, colonna }) =>
    supabase.from(tabella).select('id', { count: 'exact', head: true }).eq(colonna, id)
  ));
  for (const { error } of verifiche) {
    if (error) throw error;
  }
  if (verifiche.some(({ count }) => count > 0)) {
    return res.status(409).json({ error: messaggio });
  }

  const { data, error } = await supabase.from(tabella).delete().eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Lotto non trovato' });
  res.json({ ok: true });
}

router.delete('/lotti-mp/:id/record', wrap(async (req, res) => {
  await eliminaLottoStorico('lotti_mp', req.params.id, [
    { tabella: 'sm_consumi_mp', colonna: 'lotto_mp_id' },
    { tabella: 'pf_consumi_mp', colonna: 'lotto_mp_id' },
  ], 'Il lotto MP è collegato a lavorazioni o ordini e non può essere eliminato.', res);
}));

router.delete('/lotti-sm/:id/record', wrap(async (req, res) => {
  await eliminaLottoStorico('lotti_sm', req.params.id, [
    { tabella: 'sm_consumi_mp', colonna: 'lotto_sm_id' },
    { tabella: 'sm_consumi_sm', colonna: 'lotto_sm_id' },
    { tabella: 'sm_consumi_sm', colonna: 'lotto_sm_origine_id' },
    { tabella: 'pf_consumi_sm', colonna: 'lotto_sm_id' },
  ], 'Il lotto SM è collegato a lavorazioni o ordini e non può essere eliminato.', res);
}));

router.delete('/lotti-pf/:id/record', wrap(async (req, res) => {
  await eliminaLottoStorico('lotti_pf', req.params.id, [
    { tabella: 'pf_consumi_mp', colonna: 'lotto_pf_id' },
    { tabella: 'pf_consumi_sm', colonna: 'lotto_pf_id' },
    { tabella: 'spedizioni_righe', colonna: 'lotto_pf_id' },
  ], 'Il lotto PF è collegato a consumi o spedizioni e non può essere eliminato.', res);
}));

// ============================================================
// SPEDIZIONI PF  (solo admin)
// ============================================================
router.get('/spedizioni', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await supabase.from('spedizioni').select('*').order('creato_il', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

router.post('/spedizioni', requireAdmin, wrap(async (req, res) => {
  const { cliente, data_spedizione, vettore, note, righe } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Cliente obbligatorio' });
  await verificaDisponibilita('lotti_pf', righe, 'lotto_pf_id');
  const ddt_numero = await generaDDT(data_spedizione);

  const { data: sped, error } = await supabase.from('spedizioni').insert({
    ddt_numero, cliente, data_spedizione: data_spedizione || null, vettore, note,
    stato: 'In transito', creato_da: req.session.user.id,
  }).select().single();
  if (error) throw error;

  if (Array.isArray(righe)) {
    for (const r of righe) {
      if (!r.lotto_pf_id) continue;
      await supabase.from('spedizioni_righe').insert({
        spedizione_id: sped.id, lotto_pf_id: r.lotto_pf_id,
        quantita: Number(r.quantita) || 0, unita_misura: r.unita_misura || 'pz',
      });
      if (Number(r.quantita) > 0) await scalaGiacenza('lotti_pf', r.lotto_pf_id, Number(r.quantita));
      await supabase.from('lotti_pf').update({ stato: 'Spedito' }).eq('id', r.lotto_pf_id);
    }
  }
  res.json(sped);
}));

// ============================================================
// TRACCIABILITÀ (solo admin)
// ============================================================

router.get('/traccia/:codice', requireAdmin, wrap(async (req, res) => {
  const codice = req.params.codice.trim();

  const tables = {
    MP: {
      table: 'lotti_mp',
      select: '*,fornitori(ragione_sociale),materiali(descrizione)',
    },
    SM: {
      table: 'lotti_sm',
      select: '*,materiali(codice,descrizione)',
    },
    PF: {
      table: 'lotti_pf',
      select: '*,articoli_pf(descrizione)',
    },
  };

  // Nodi e relazioni della catena.
  const legami = new Map();
  const visitati = new Set();
  const coda = [];

  async function caricaLotto(tipo, id) {
    const config = tables[tipo];
    if (!config) return null;

    const { data, error } = await supabase
      .from(config.table)
      .select(config.select)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function cercaPerCodice(tipo) {
    const config = tables[tipo];

    const { data, error } = await supabase
      .from(config.table)
      .select(config.select)
      .eq('codice_lotto', codice)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  function aggiungiLotto(tipo, lotto) {
    if (!lotto) return null;

    const key = `${tipo}:${lotto.id}`;

    if (!legami.has(key)) {
      const descrizione =
        lotto.materiali?.descrizione ||
        lotto.articoli_pf?.descrizione ||
        '';

      legami.set(key, {
        id: lotto.id,
        tipo,
        codice: lotto.codice_lotto,
        descrizione,
        record: lotto,
      });

      coda.push(key);
    }

    return key;
  }

  // Registra una relazione nella direzione:
  // lotto prodotto -> lotto componente utilizzato.
  async function aggiungiRelazione(
    tipoProdotto,
    idProdotto,
    tipoComponente,
    idComponente,
    quantita,
    unita_misura
  ) {
    const [prodotto, componente] = await Promise.all([
      caricaLotto(tipoProdotto, idProdotto),
      caricaLotto(tipoComponente, idComponente),
    ]);

    if (!prodotto || !componente) return;

    const prodottoKey = aggiungiLotto(tipoProdotto, prodotto);
    const componenteKey = aggiungiLotto(tipoComponente, componente);

    const edgeKey = `${prodottoKey}>${componenteKey}`;

    if (!legami.has(edgeKey)) {
      legami.set(edgeKey, {
        da: prodottoKey,
        a: componenteKey,
        quantita: Number(quantita) || 0,
        unita_misura: unita_misura || '',
      });
    }
  }

  async function leggiRighe(tabella, colonne, colonnaFiltro, id) {
    const { data, error } = await supabase
      .from(tabella)
      .select(colonne)
      .eq(colonnaFiltro, id);

    if (error) throw error;
    return data || [];
  }

  // Individua il lotto iniziale.
  const tipoRadice = codice.startsWith('PF-')
    ? 'PF'
    : codice.startsWith('SM-')
      ? 'SM'
      : 'MP';

  const radice = await cercaPerCodice(tipoRadice);

  if (!radice) {
    return res.status(404).json({ error: 'Lotto non trovato' });
  }

  const radiceKey = aggiungiLotto(tipoRadice, radice);

  // Conserva i DDT soltanto dei PF raggiunti nella catena.
  const ddtVisitati = new Set();

  while (coda.length) {
    const key = coda.shift();

    if (visitati.has(key)) continue;
    visitati.add(key);

    const nodo = legami.get(key);
    const lotto = nodo.record;

    // MP: materia prima, non ha componenti a monte.
    if (nodo.tipo === 'MP') continue;

    if (nodo.tipo === 'PF') {
      // Cerca soltanto i componenti utilizzati da questo PF.
      const [consumiMP, consumiSM, spedizioni] = await Promise.all([
        leggiRighe(
          'pf_consumi_mp',
          'lotto_mp_id,quantita,unita_misura',
          'lotto_pf_id',
          lotto.id
        ),
        leggiRighe(
          'pf_consumi_sm',
          'lotto_sm_id,quantita,unita_misura',
          'lotto_pf_id',
          lotto.id
        ),
        leggiRighe(
          'spedizioni_righe',
          'spedizione_id,quantita,unita_misura',
          'lotto_pf_id',
          lotto.id
        ),
      ]);

      // PF -> MP.
      for (const riga of consumiMP) {
        await aggiungiRelazione(
          'PF',
          lotto.id,
          'MP',
          riga.lotto_mp_id,
          riga.quantita,
          riga.unita_misura
        );
      }

      // PF -> SM.
      for (const riga of consumiSM) {
        await aggiungiRelazione(
          'PF',
          lotto.id,
          'SM',
          riga.lotto_sm_id,
          riga.quantita,
          riga.unita_misura
        );
      }

      // DDT associati esclusivamente ai PF raggiunti.
      for (const riga of spedizioni) {
        const { data: spedizione, error } = await supabase
          .from('spedizioni')
          .select('*')
          .eq('id', riga.spedizione_id)
          .maybeSingle();

        if (error) throw error;
        if (!spedizione) continue;

        const ddtKey = `DDT:${spedizione.id}`;

        if (!legami.has(ddtKey)) {
          legami.set(ddtKey, {
            id: spedizione.id,
            tipo: 'DDT',
            codice: spedizione.ddt_numero,
            descrizione: spedizione.cliente || '',
          });
        }

        const edgeKey = `${key}>${ddtKey}`;

        if (!legami.has(edgeKey)) {
          legami.set(edgeKey, {
            da: key,
            a: ddtKey,
            quantita: Number(riga.quantita) || 0,
            unita_misura: riga.unita_misura || '',
          });
        }

        ddtVisitati.add(ddtKey);
      }
    } else if (nodo.tipo === 'SM') {
      // Cerca soltanto i componenti utilizzati da questo SM.
      const [consumiMP, originiSM] = await Promise.all([
        leggiRighe(
          'sm_consumi_mp',
          'lotto_mp_id,quantita,unita_misura',
          'lotto_sm_id',
          lotto.id
        ),
        leggiRighe(
          'sm_consumi_sm',
          'lotto_sm_origine_id,quantita,unita_misura',
          'lotto_sm_id',
          lotto.id
        ),
      ]);

      // SM -> MP.
      for (const riga of consumiMP) {
        await aggiungiRelazione(
          'SM',
          lotto.id,
          'MP',
          riga.lotto_mp_id,
          riga.quantita,
          riga.unita_misura
        );
      }

      // SM -> SM di origine.
      for (const riga of originiSM) {
        await aggiungiRelazione(
          'SM',
          lotto.id,
          'SM',
          riga.lotto_sm_origine_id,
          riga.quantita,
          riga.unita_misura
        );
      }
    }
  }

  // Recupera esclusivamente i nodi, escludendo le relazioni.
  const nodiPerKey = new Map(
    [...legami.entries()].filter(([key]) => !key.includes('>'))
  );

  const nodi = [...nodiPerKey.values()].map((nodo) => ({
    id: nodo.id,
    tipo: nodo.tipo,
    codice: nodo.codice,
    descrizione: nodo.descrizione,
    meta: nodo.tipo === 'MP'
      ? {
          fornitore: nodo.record.fornitori?.ragione_sociale || '',
          ddt: nodo.record.ddt_numero || '',
        }
      : nodo.tipo === 'SM'
        ? { lavorazione: nodo.record.lavorazione }
        : nodo.tipo === 'PF'
          ? {
              articolo: nodo.record.articoli_pf?.descrizione || '',
            }
          : {},
  }));

  const ordine = { PF: 0, SM: 1, MP: 2, DDT: 3 };

  const passaggi = [...legami.values()]
    .filter((elemento) => elemento.da && elemento.a)
    .map((elemento) => {
      const da = nodiPerKey.get(elemento.da);
      const a = nodiPerKey.get(elemento.a);

      // Il DDT non è un lotto e viene gestito separatamente.
      const nodoA = da
        ? da
        : null;

      if (!nodoA) return null;

      const destinazione = a || legami.get(elemento.a);
      const origine = da;

      if (!destinazione || !origine) return null;

      return {
        da: {
          tipo: origine.tipo,
          codice: origine.codice,
          descrizione: origine.descrizione,
        },
        a: {
          tipo: destinazione.tipo,
          codice: destinazione.codice,
          descrizione: destinazione.descrizione,
        },
        quantita: elemento.quantita,
        unita_misura: elemento.unita_misura,
      };
    })
    .filter(Boolean)
    .sort((sinistra, destra) =>
      (ordine[sinistra.da.tipo] ?? 99) -
        (ordine[destra.da.tipo] ?? 99) ||
      (ordine[sinistra.a.tipo] ?? 99) -
        (ordine[destra.a.tipo] ?? 99) ||
      sinistra.da.codice.localeCompare(destra.da.codice)
    );

  const listaNodi = [...nodiPerKey.values()];

  res.json({
    query: codice,
    nodi,
    passaggi,
    mp: listaNodi
      .filter((nodo) => nodo.tipo === 'MP')
      .map((nodo) => ({
        codice: nodo.codice,
        materiale: nodo.record.materiali?.descrizione || '',
        fornitore: nodo.record.fornitori?.ragione_sociale || '',
      })),
    sm: listaNodi
      .filter((nodo) => nodo.tipo === 'SM')
      .map((nodo) => ({
        codice: nodo.codice,
        tipo: nodo.record.materiali?.descrizione || '',
        lav: nodo.record.lavorazione,
      })),
    pf: listaNodi
      .filter((nodo) => nodo.tipo === 'PF')
      .map((nodo) => ({
        codice: nodo.codice,
        articolo: nodo.record.articoli_pf?.descrizione || '',
      })),
    ddt: [...ddtVisitati]
      .map((ddtKey) => legami.get(ddtKey))
      .filter(Boolean)
      .map((nodo) => ({
        ddt: nodo.codice,
        cliente: nodo.descrizione,
      })),
  });
}));

// ============================================================
// GESTIONE UTENTI (solo admin)
// ============================================================
router.get('/utenti', requireAdmin, wrap(async (req, res) => {
  const { data, error } = await supabase.from('utenti')
    .select('id,username,nome,ruolo,attivo,creato_il').order('creato_il');
  if (error) throw error;
  res.json(data);
}));

router.post('/utenti', requireAdmin, wrap(async (req, res) => {
  const { username, nome, ruolo, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username e password obbligatori' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('utenti').insert({
    username: username.trim().toLowerCase(),
    nome: nome || username,
    ruolo: ruolo === 'admin' ? 'admin' : 'operatore',
    password_hash, attivo: true,
  }).select('id,username,nome,ruolo,attivo').single();
  if (error) {
    if (error.message.includes('duplicate')) return res.status(400).json({ error: 'Username già esistente' });
    throw error;
  }
  res.json(data);
}));

router.patch('/utenti/:id/stato', requireAdmin, wrap(async (req, res) => {
  const { attivo } = req.body;
  const { data, error } = await supabase.from('utenti').update({ attivo: !!attivo })
    .eq('id', req.params.id).select('id,attivo').single();
  if (error) throw error;
  res.json(data);
}));

router.patch('/utenti/:id/password', requireAdmin, wrap(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });
  const password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('utenti').update({ password_hash }).eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.delete('/utenti/:id', requireAdmin, wrap(async (req, res) => {
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Non puoi eliminare te stesso' });
  const { error } = await supabase.from('utenti').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ============================================================
// Helper: scala giacenza e aggiorna stato
// ============================================================
function calcolaStatoLotto(tipo, giacenza) {
  const g = Number(giacenza ?? 0);
  if (tipo === 'mp') return g <= 0 ? 'Esaurito' : 'Ok';
  if (tipo === 'sm') return g <= 0 ? 'Esaurito' : 'Disponibile';
  if (tipo === 'pf') return g <= 0 ? 'Completato' : 'In corso';
  return 'Ok';
}

async function verificaDisponibilita(tabella, righe, idCampo) {
  if (!Array.isArray(righe)) return;
  const richieste = new Map();
  for (const riga of righe) {
    if (!riga || !riga[idCampo]) continue;
    const qty = Number(riga.quantita);
    if (!Number.isFinite(qty) || qty < 0) throw new Error('La quantità deve essere un numero positivo');
    if (qty > 0) richieste.set(riga[idCampo], (richieste.get(riga[idCampo]) || 0) + qty);
  }
  if (!richieste.size) return;

  const { data, error } = await supabase.from(tabella).select('id,giacenza').in('id', [...richieste.keys()]);
  if (error) throw error;
  const disponibilita = new Map((data || []).map((riga) => [riga.id, Number(riga.giacenza) || 0]));
  for (const [id, richiesta] of richieste) {
    const disponibile = disponibilita.get(id);
    if (disponibile === undefined || richiesta > disponibile) {
      throw new Error('La quantità richiesta supera la disponibilità del lotto');
    }
  }
}

async function scalaGiacenza(tabella, id, qty) {
  const { data: r, error: selectError } = await supabase.from(tabella).select('giacenza,quantita').eq('id', id).maybeSingle();
  if (selectError) throw selectError;
  if (!r) return;
  if (!Number.isFinite(qty) || qty < 0 || qty > Number(r.giacenza)) {
    throw new Error('La quantità richiesta supera la disponibilità del lotto');
  }
  const nuova = Math.max(0, Number(r.giacenza) - qty);
  const update = { giacenza: nuova };
  if (nuova <= 0) update.stato = tabella === 'lotti_pf' ? 'Completato' : 'Esaurito';
  const { error: updateError } = await supabase.from(tabella).update(update).eq('id', id);
  if (updateError) throw updateError;
}



module.exports = router;
