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
  if (!/^[A-Za-z0-9]{4}$/.test(codice)) return res.status(400).json({ error: 'Il codice deve contenere 4 caratteri alfanumerici' });
  if (!/^[0-9]{4}$/.test(codice_numerico || '')) return res.status(400).json({ error: 'Il codice numerico deve contenere 4 cifre' });
  const { data, error } = await supabase.from('materiali')
    .insert({ codice: codice.toUpperCase(), codice_numerico, descrizione, tipo: tipo || 'MP', unita_misura: unita_misura || 'kg', soglia_minima: soglia_minima || 0 })
    .select().single();
  if (error) throw error;
  res.json(data);
}));

router.get('/articoli', wrap(async (req, res) => {
  const { data, error } = await supabase.from('articoli_pf').select('*').order('codice');
  if (error) throw error;
  res.json(data);
}));

router.post('/articoli', requireAdmin, wrap(async (req, res) => {
  const { codice, codice_numerico, descrizione, gtin14, stato } = req.body;
  if (!codice || !descrizione) return res.status(400).json({ error: 'Codice e descrizione obbligatori' });
  if (!/^[A-Za-z0-9]{4}$/.test(codice)) return res.status(400).json({ error: 'Il codice deve contenere 4 caratteri alfanumerici' });
  if (!/^[0-9]{4}$/.test(codice_numerico || '')) return res.status(400).json({ error: 'Il codice numerico deve contenere 4 cifre' });
  const { data, error } = await supabase.from('articoli_pf')
    .insert({ codice: codice.toUpperCase(), codice_numerico, descrizione, gtin14, stato: stato || 'Attivo' }).select().single();
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// RICEVIMENTO MP
// ============================================================
router.get('/lotti-mp', wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('lotti_mp')
    .select('*,fornitori(ragione_sociale),materiali(codice,descrizione)')
    .order('creato_il', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

router.post('/lotti-mp', wrap(async (req, res) => {
  const { fornitore_id, materiale_id, ddt_numero, ddt_data, quantita, unita_misura, n_pedane, note } = req.body;

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
          quantita, unita_misura, data_lavorazione, note, consumi } = req.body;
  await verificaDisponibilita('lotti_mp', consumi, 'lotto_mp_id'); //TODO: verificare perche ci sono gli id "mp" e non "sm" nei consumi

  const { data: materiale } = await supabase.from('materiali').select('codice').eq('id', tipo_semilavorato).maybeSingle();
  const sigla = (materiale?.codice || 'SM').replace(/[^A-Za-z]/g, '').slice(0, 4);
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
    creato_da: req.session.user.id,
  }).select().single();
  if (error) throw error;

  // Registra consumi MP e scala giacenze
  if (Array.isArray(consumi)) {
    for (const c of consumi) {
      if (!c.lotto_mp_id) continue;
      await supabase.from('sm_consumi_mp').insert({
        lotto_sm_id: lotto.id, lotto_mp_id: c.lotto_mp_id,
        quantita: Number(c.quantita) || 0, unita_misura: c.unita_misura,
      });
      await scalaGiacenza('lotti_mp', c.lotto_mp_id, Number(c.quantita) || 0);
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
  const { articolo_id, quantita, unita_misura, data_produzione, note, consumi_mp, consumi_sm } = req.body;
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
  if (tipo === 'mp') {
    const { data } = await supabase.from('lotti_mp')
      .select('codice_lotto,giacenza,unita_misura,stato,materiali(descrizione)').order('creato_il', { ascending: false });
    return res.json((data || []).map((r) => ({ codice: r.codice_lotto, desc: r.materiali?.descrizione, giacenza: r.giacenza, um: r.unita_misura, stato: r.stato })));
  }
  if (tipo === 'sm') {
    const { data } = await supabase.from('lotti_sm')
      .select('codice_lotto,giacenza,unita_misura,stato,materiali(descrizione)').order('creato_il', { ascending: false });
    return res.json((data || []).map((r) => ({ codice: r.codice_lotto, desc: r.materiali?.descrizione, giacenza: r.giacenza, um: r.unita_misura, stato: r.stato })));
  }
  if (tipo === 'pf') {
    const { data } = await supabase.from('lotti_pf')
      .select('codice_lotto,giacenza,unita_misura,stato,articoli_pf(descrizione)').order('creato_il', { ascending: false });
    return res.json((data || []).map((r) => ({ codice: r.codice_lotto, desc: r.articoli_pf?.descrizione, giacenza: r.giacenza, um: r.unita_misura, stato: r.stato })));
  }
  res.status(400).json({ error: 'Tipo non valido' });
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
// RINTRACCIABILITÀ (solo admin)
// ============================================================
router.get('/traccia/:codice', requireAdmin, wrap(async (req, res) => {
  const codice = req.params.codice.trim();
  const catena = { query: codice, mp: [], sm: [], pf: [], ddt: [] };

  // Individua il tipo dal prefisso
  const findMP = async (id) => (await supabase.from('lotti_mp').select('*,fornitori(ragione_sociale),materiali(descrizione)').eq('id', id).maybeSingle()).data;
  const findSM = async (id) => (await supabase.from('lotti_sm').select('*,materiali(codice,descrizione)').eq('id', id).maybeSingle()).data;
  const findPF = async (id) => (await supabase.from('lotti_pf').select('*,articoli_pf(descrizione)').eq('id', id).maybeSingle()).data;

  async function espandiPF(pf) {
    if (!pf) return;
    catena.pf.push({ codice: pf.codice_lotto, articolo: pf.articoli_pf?.descrizione, data: pf.creato_il });
    // MP diretti
    const { data: cmp } = await supabase.from('pf_consumi_mp').select('lotto_mp_id').eq('lotto_pf_id', pf.id);
    for (const c of (cmp || [])) { const mp = await findMP(c.lotto_mp_id); if (mp) catena.mp.push(mpRow(mp)); }
    // SM -> loro MP
    const { data: csm } = await supabase.from('pf_consumi_sm').select('lotto_sm_id').eq('lotto_pf_id', pf.id);
    for (const c of (csm || [])) { const sm = await findSM(c.lotto_sm_id); if (sm) await espandiSM(sm); }
    // DDT
    const { data: righe } = await supabase.from('spedizioni_righe').select('spedizione_id').eq('lotto_pf_id', pf.id);
    for (const r of (righe || [])) {
      const { data: sp } = await supabase.from('spedizioni').select('*').eq('id', r.spedizione_id).maybeSingle();
      if (sp) catena.ddt.push({ ddt: sp.ddt_numero, cliente: sp.cliente, data: sp.data_spedizione });
    }
  }
  async function espandiSM(sm) {
    catena.sm.push({ codice: sm.codice_lotto, tipo: sm.materiali?.descrizione || '', lav: sm.lavorazione, data: sm.creato_il });
    const { data: cmp } = await supabase.from('sm_consumi_mp').select('lotto_mp_id').eq('lotto_sm_id', sm.id);
    for (const c of (cmp || [])) { const mp = await findMP(c.lotto_mp_id); if (mp) catena.mp.push(mpRow(mp)); }
  }
  const mpRow = (mp) => ({ codice: mp.codice_lotto, ddt: mp.ddt_numero, materiale: mp.materiali?.descrizione, fornitore: mp.fornitori?.ragione_sociale, data: mp.ddt_data });

  if (codice.startsWith('PF-')) {
    const { data } = await supabase.from('lotti_pf').select('*,articoli_pf(descrizione)').eq('codice_lotto', codice).maybeSingle();
    await espandiPF(data);
  } else if (codice.startsWith('SM-')) {
    const { data } = await supabase.from('lotti_sm').select('*,materiali(codice,descrizione)').eq('codice_lotto', codice).maybeSingle();
    if (data) await espandiSM(data);
  } else {
    // MP: trova a valle SM e PF che lo usano
    const { data: mp } = await supabase.from('lotti_mp').select('*,fornitori(ragione_sociale),materiali(descrizione)').eq('codice_lotto', codice).maybeSingle();
    if (mp) {
      catena.mp.push(mpRow(mp));
      const { data: usedSm } = await supabase.from('sm_consumi_mp').select('lotto_sm_id').eq('lotto_mp_id', mp.id);
      for (const u of (usedSm || [])) { const sm = await findSM(u.lotto_sm_id); if (sm) catena.sm.push({ codice: sm.codice_lotto, tipo: sm.materiali?.descrizione || '', lav: sm.lavorazione, data: sm.creato_il }); }
      const { data: usedPf } = await supabase.from('pf_consumi_mp').select('lotto_pf_id').eq('lotto_mp_id', mp.id);
      for (const u of (usedPf || [])) { const pf = await findPF(u.lotto_pf_id); if (pf) catena.pf.push({ codice: pf.codice_lotto, articolo: pf.articoli_pf?.descrizione, data: pf.creato_il }); }
    }
  }

  // dedup
  const uniq = (arr, k) => Array.from(new Map(arr.map((x) => [x[k], x])).values());
  catena.mp = uniq(catena.mp, 'codice');
  catena.sm = uniq(catena.sm, 'codice');
  catena.pf = uniq(catena.pf, 'codice');
  catena.ddt = uniq(catena.ddt, 'ddt');

  res.json(catena);
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
  const { data: r } = await supabase.from(tabella).select('giacenza,quantita').eq('id', id).maybeSingle();
  if (!r) return;
  if (!Number.isFinite(qty) || qty < 0 || qty > Number(r.giacenza)) {
    throw new Error('La quantità richiesta supera la disponibilità del lotto');
  }
  const nuova = Math.max(0, Number(r.giacenza) - qty);
  const update = { giacenza: nuova };
  if (nuova <= 0) update.stato = tabella === 'lotti_mp' ? 'Esaurito' : 'Esaurito';
  await supabase.from(tabella).update(update).eq('id', id);
}



module.exports = router;
