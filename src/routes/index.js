const express = require('express')
const router  = express.Router()
const sb      = require('../supabase')

// ─── helpers ───────────────────────────────────────────────────────────────
function render(res, page, data = {}) {
  res.render('layout', { ...data, body: require('fs').readFileSync(
    require('path').join(__dirname, '../../views/pages', page + '.ejs'), 'utf8'
  )})
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}

async function nextProg(table, prefix) {
  const { count } = await sb.from(table).select('*', { count: 'exact', head: true })
    .like('codice', `${prefix}%`)
  return String((count || 0) + 1).padStart(3, '0')
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const [mp, sm, pf, sped] = await Promise.all([
    sb.from('lotti_mp').select('*', { count: 'exact', head: true }),
    sb.from('lotti_sm').select('*', { count: 'exact', head: true }).in('stato', ['disponibile','in_uso']),
    sb.from('lotti_pf').select('*', { count: 'exact', head: true }).in('stato', ['in_corso','attesa']),
    sb.from('ddt').select('*', { count: 'exact', head: true })
  ])
  const { data: movMP } = await sb.from('lotti_mp').select('codice,materiale_descrizione,created_at').order('created_at', { ascending: false }).limit(4)
  const { data: movSM } = await sb.from('lotti_sm').select('codice,tipo_descrizione,created_at').order('created_at', { ascending: false }).limit(2)
  const { data: movPF } = await sb.from('lotti_pf').select('codice,articolo_descrizione,created_at').order('created_at', { ascending: false }).limit(2)
  const { data: ordini } = await sb.from('lotti_pf').select('codice,articolo_descrizione,quantita,stato').in('stato',['in_corso','attesa']).limit(10)

  const movimenti = [
    ...(movMP||[]).map(r => ({ codice: r.codice, tipo: 'MP', descr: r.materiale_descrizione, ora: new Date(r.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}) })),
    ...(movSM||[]).map(r => ({ codice: r.codice, tipo: 'SM', descr: r.tipo_descrizione,      ora: new Date(r.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}) })),
    ...(movPF||[]).map(r => ({ codice: r.codice, tipo: 'PF', descr: r.articolo_descrizione,  ora: new Date(r.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}) })),
  ].sort((a,b) => b.ora.localeCompare(a.ora)).slice(0,8)

  res.render('layout', {
    title: 'Dashboard',
    kpi: { mp: mp.count||0, sm: sm.count||0, pf: pf.count||0, sped: sped.count||0 },
    movimenti, ordini: ordini||[],
    body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/dashboard.ejs'),'utf8')
  })
})

// ─── RICEVIMENTO MP ─────────────────────────────────────────────────────────
router.get('/mp', async (req, res) => {
  const { data: fornitori } = await sb.from('fornitori').select('id,ragione_sociale').eq('stato','attivo').order('ragione_sociale')
  const { data: materiali } = await sb.from('materiali').select('codice,descrizione,unita_misura').eq('tipo','MP').order('codice')
  const { data: storico }   = await sb.from('lotti_mp').select('codice,materiale_descrizione,ddt_numero,ddt_data,quantita,unita_misura,n_pedane,stato').order('created_at',{ascending:false}).limit(30)
  res.render('layout', { title: 'Ricevimento MP', fornitori, materiali, storico: storico||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/mp.ejs'),'utf8') })
})

router.post('/mp', async (req, res) => {
  const { fornitore_id, materiale_codice, materiale_descrizione, ddt_numero, ddt_data, quantita, unita_misura, n_pedane, note } = req.body
  const ds     = today()
  const prog   = await nextProg('lotti_mp', `LT-${ds}-${materiale_codice}-`)
  const codice = `LT-${ds}-${materiale_codice}-${prog}`
  const { error } = await sb.from('lotti_mp').insert({
    codice, fornitore_id: fornitore_id||null, materiale_codice,
    materiale_descrizione, ddt_numero, ddt_data,
    quantita: parseFloat(quantita), unita_misura,
    n_pedane: parseInt(n_pedane)||1, giacenza: parseFloat(quantita),
    note, stato: 'ok'
  })
  if (error) return res.redirect('/mp?err=1')
  res.redirect('/mp?ok=1&lotto='+codice)
})

// ─── LAVORAZIONE SM ─────────────────────────────────────────────────────────
router.get('/sm', async (req, res) => {
  const { data: tipi }  = await sb.from('materiali').select('codice,descrizione,unita_misura').eq('tipo','SM').order('codice')
  const { data: fornitori } = await sb.from('fornitori').select('id,ragione_sociale').eq('stato','attivo')
  const { data: lottiMP } = await sb.from('lotti_mp').select('codice,materiale_descrizione,giacenza,unita_misura').gt('giacenza',0).order('codice')
  const { data: storico } = await sb.from('lotti_sm').select('codice,tipo_descrizione,quantita,unita_misura,tipo_lavorazione,data_lavorazione,stato').order('created_at',{ascending:false}).limit(30)
  res.render('layout', { title: 'Lavorazione SM', tipi, fornitori, lottiMP: lottiMP||[], storico: storico||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/sm.ejs'),'utf8') })
})

router.post('/sm', async (req, res) => {
  const { tipo_codice, tipo_descrizione, quantita, unita_misura, data_lavorazione, tipo_lavorazione,
          fornitore_sm_id, ddt_numero, ddt_data, note,
          lotti_mp, qty_mp } = req.body
  const ds     = today()
  const prog   = await nextProg('lotti_sm', `SM-${ds}-${tipo_codice}-`)
  const codice = `SM-${ds}-${tipo_codice}-${prog}`

  const { data: newSM, error } = await sb.from('lotti_sm').insert({
    codice, tipo_codice, tipo_descrizione, quantita: parseFloat(quantita),
    unita_misura, data_lavorazione, tipo_lavorazione,
    fornitore_sm_id: fornitore_sm_id||null,
    ddt_numero: ddt_numero||null, ddt_data: ddt_data||null,
    giacenza: parseFloat(quantita), note, stato: 'disponibile'
  }).select().single()

  if (error || !newSM) return res.redirect('/sm?err=1')

  // collega lotti MP
  const mpArr  = Array.isArray(lotti_mp) ? lotti_mp : (lotti_mp ? [lotti_mp] : [])
  const qtyArr = Array.isArray(qty_mp)   ? qty_mp   : (qty_mp   ? [qty_mp]   : [])
  for (let i = 0; i < mpArr.length; i++) {
    await sb.from('sm_input_mp').insert({ lotto_sm_id: newSM.id, lotto_mp_codice: mpArr[i], quantita_usata: parseFloat(qtyArr[i])||0 })
    const q = parseFloat(qtyArr[i])||0
    if (q > 0) {
      const { data: mp } = await sb.from('lotti_mp').select('giacenza').eq('codice', mpArr[i]).single()
      if (mp) await sb.from('lotti_mp').update({ giacenza: Math.max(0, mp.giacenza - q) }).eq('codice', mpArr[i])
    }
  }
  res.redirect('/sm?ok=1&lotto='+codice)
})

// ─── PRODUZIONE PF ──────────────────────────────────────────────────────────
router.get('/pf', async (req, res) => {
  const { data: articoli } = await sb.from('articoli').select('codice,descrizione,gtin14').eq('stato','attivo').order('codice')
  const { data: lottiMP }  = await sb.from('lotti_mp').select('codice,materiale_descrizione,giacenza,unita_misura').gt('giacenza',0).order('codice')
  const { data: lottiSM }  = await sb.from('lotti_sm').select('codice,tipo_descrizione,giacenza,unita_misura').in('stato',['disponibile','in_uso']).gt('giacenza',0).order('codice')
  const { data: storico }  = await sb.from('lotti_pf').select('codice,articolo_descrizione,quantita,stato').order('created_at',{ascending:false}).limit(30)
  res.render('layout', { title: 'Produzione PF', articoli, lottiMP: lottiMP||[], lottiSM: lottiSM||[], storico: storico||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/pf.ejs'),'utf8') })
})

router.post('/pf', async (req, res) => {
  const { articolo_codice, articolo_descrizione, quantita, linea, riciclo_codici, idoneo_alimenti,
          lotti_mp, qty_mp, lotti_sm, qty_sm } = req.body
  const ds     = today()
  const clean  = articolo_codice.replace(/-/g,'')
  const prog   = await nextProg('lotti_pf', `PF-${ds}-${clean}-`)
  const codice = `PF-${ds}-${clean}-${prog}`

  const { data: newPF, error } = await sb.from('lotti_pf').insert({
    codice, articolo_codice, articolo_descrizione,
    quantita: parseFloat(quantita), unita_misura: 'pz',
    linea, riciclo_codici: riciclo_codici||'',
    idoneo_alimenti: idoneo_alimenti === 'on',
    giacenza: parseFloat(quantita), stato: 'in_corso'
  }).select().single()

  if (error || !newPF) return res.redirect('/pf?err=1')

  const mpArr  = Array.isArray(lotti_mp) ? lotti_mp : (lotti_mp ? [lotti_mp] : [])
  const mpQty  = Array.isArray(qty_mp)   ? qty_mp   : (qty_mp   ? [qty_mp]   : [])
  const smArr  = Array.isArray(lotti_sm) ? lotti_sm : (lotti_sm ? [lotti_sm] : [])
  const smQty  = Array.isArray(qty_sm)   ? qty_sm   : (qty_sm   ? [qty_sm]   : [])

  for (let i = 0; i < mpArr.length; i++) {
    await sb.from('pf_input_mp').insert({ lotto_pf_id: newPF.id, lotto_mp_codice: mpArr[i], quantita_usata: parseFloat(mpQty[i])||0 })
  }
  for (let i = 0; i < smArr.length; i++) {
    await sb.from('pf_input_sm').insert({ lotto_pf_id: newPF.id, lotto_sm_codice: smArr[i], quantita_usata: parseFloat(smQty[i])||0 })
    const { data: sm } = await sb.from('lotti_sm').select('giacenza').eq('codice', smArr[i]).single()
    if (sm && parseFloat(smQty[i]) > 0) {
      await sb.from('lotti_sm').update({ giacenza: Math.max(0, sm.giacenza - parseFloat(smQty[i])), stato: 'in_uso' }).eq('codice', smArr[i])
    }
  }
  res.redirect('/pf?ok=1&lotto='+codice)
})

// ─── MAGAZZINO ──────────────────────────────────────────────────────────────
router.get('/magazzino', async (req, res) => {
  const { data: mp } = await sb.from('lotti_mp').select('*').order('created_at',{ascending:false}).limit(100)
  const { data: sm } = await sb.from('lotti_sm').select('*').order('created_at',{ascending:false}).limit(100)
  const { data: pf } = await sb.from('lotti_pf').select('*').order('created_at',{ascending:false}).limit(100)
  res.render('layout', { title: 'Magazzino', mp: mp||[], sm: sm||[], pf: pf||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/magazzino.ejs'),'utf8') })
})

// ─── SPEDIZIONI ─────────────────────────────────────────────────────────────
router.get('/spedizioni', async (req, res) => {
  const { data: lottiPF } = await sb.from('lotti_pf').select('codice,articolo_descrizione,giacenza').gt('giacenza',0).order('codice')
  const { data: storico } = await sb.from('ddt').select('numero,cliente,data_spedizione,stato,created_at').order('created_at',{ascending:false}).limit(30)
  res.render('layout', { title: 'Spedizioni / DDT', lottiPF: lottiPF||[], storico: storico||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/spedizioni.ejs'),'utf8') })
})

router.post('/spedizioni', async (req, res) => {
  const { cliente, data_spedizione, vettore, note, lotti_pf, qty_pf } = req.body
  const anno  = new Date().getFullYear()
  const { count } = await sb.from('ddt').select('*',{count:'exact',head:true}).like('numero',`DDT-${anno}-%`)
  const numero = `DDT-${anno}-${String((count||0)+1).padStart(4,'0')}`

  const { data: newDDT, error } = await sb.from('ddt').insert({
    numero, cliente, data_spedizione, vettore: vettore||'', note, stato: 'in_transito'
  }).select().single()

  if (error || !newDDT) return res.redirect('/spedizioni?err=1')

  const pfArr  = Array.isArray(lotti_pf) ? lotti_pf : (lotti_pf ? [lotti_pf] : [])
  const qtyArr = Array.isArray(qty_pf)   ? qty_pf   : (qty_pf   ? [qty_pf]   : [])
  for (let i = 0; i < pfArr.length; i++) {
    await sb.from('ddt_righe').insert({ ddt_id: newDDT.id, lotto_pf_codice: pfArr[i], quantita: parseFloat(qtyArr[i])||0 })
    const { data: pf } = await sb.from('lotti_pf').select('giacenza').eq('codice', pfArr[i]).single()
    if (pf) await sb.from('lotti_pf').update({ giacenza: Math.max(0, pf.giacenza - parseFloat(qtyArr[i])||0) }).eq('codice', pfArr[i])
  }
  res.redirect('/spedizioni?ok=1&ddt='+numero)
})

// ─── ANAGRAFICHE ────────────────────────────────────────────────────────────
router.get('/anagrafiche', async (req, res) => {
  const [{ data: fornitori }, { data: materiali }, { data: articoli }] = await Promise.all([
    sb.from('fornitori').select('*').order('ragione_sociale'),
    sb.from('materiali').select('*').order('codice'),
    sb.from('articoli').select('*').order('codice')
  ])
  res.render('layout', { title: 'Anagrafiche', fornitori: fornitori||[], materiali: materiali||[], articoli: articoli||[], body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/anagrafiche.ejs'),'utf8') })
})

router.post('/anagrafiche/fornitori', async (req, res) => {
  await sb.from('fornitori').insert(req.body)
  res.redirect('/anagrafiche?tab=fornitori&ok=1')
})
router.post('/anagrafiche/materiali', async (req, res) => {
  await sb.from('materiali').insert(req.body)
  res.redirect('/anagrafiche?tab=materiali&ok=1')
})
router.post('/anagrafiche/articoli', async (req, res) => {
  await sb.from('articoli').insert(req.body)
  res.redirect('/anagrafiche?tab=articoli&ok=1')
})

// ─── RINTRACCIABILITÀ ───────────────────────────────────────────────────────
router.get('/traccia', (req, res) => {
  res.render('layout', { title: 'Rintracciabilità', body: require('fs').readFileSync(require('path').join(__dirname,'../../views/pages/traccia.ejs'),'utf8') })
})

// ─── API TRACCIA (fetch dal client) ────────────────────────────────────────
router.get('/api/traccia/:codice', async (req, res) => {
  const codice = req.params.codice

  let lotti_mp = [], lotti_sm = [], spedizioni = [], catena = []

  // prova MP
  const { data: mp } = await sb.from('lotti_mp').select('*').eq('codice', codice).single()
  if (mp) {
    lotti_mp = [{ ...mp, fornitore: mp.fornitore_id }]
    catena.push({ codice: mp.codice, tipo: 'MP', bg: 'var(--su-verdel)', tx: 'var(--su-violad)', bd: 'var(--su-verdeld)' })
    const { data: smLinks } = await sb.from('sm_input_mp').select('lotto_sm_id').eq('lotto_mp_codice', codice)
    for (const lnk of smLinks||[]) {
      const { data: sm } = await sb.from('lotti_sm').select('*').eq('id', lnk.lotto_sm_id).single()
      if (sm && !lotti_sm.find(x => x.codice === sm.codice)) {
        lotti_sm.push(sm)
        catena.push({ codice: sm.codice, tipo: 'SM', bg: 'var(--su-violal)', tx: 'var(--su-viola)', bd: '#c5bfee' })
      }
    }
  }

  // prova SM
  const { data: sm } = await sb.from('lotti_sm').select('*').eq('codice', codice).single()
  if (sm) {
    if (!lotti_sm.find(x => x.codice === sm.codice)) lotti_sm.push(sm)
    if (!catena.find(x => x.codice === sm.codice)) catena.push({ codice: sm.codice, tipo: 'SM', bg: 'var(--su-violal)', tx: 'var(--su-viola)', bd: '#c5bfee' })
  }

  // prova PF
  const { data: pf } = await sb.from('lotti_pf').select('*').eq('codice', codice).single()
  if (pf) {
    catena.push({ codice: pf.codice, tipo: 'PF', bg: 'var(--amberl)', tx: 'var(--amber)', bd: '#fac775' })
    const { data: mpLinks } = await sb.from('pf_input_mp').select('lotto_mp_codice').eq('lotto_pf_id', pf.id)
    for (const lnk of mpLinks||[]) {
      const { data: m } = await sb.from('lotti_mp').select('*').eq('codice', lnk.lotto_mp_codice).single()
      if (m && !lotti_mp.find(x => x.codice === m.codice)) lotti_mp.push(m)
    }
    const { data: smLinks2 } = await sb.from('pf_input_sm').select('lotto_sm_codice').eq('lotto_pf_id', pf.id)
    for (const lnk of smLinks2||[]) {
      const { data: s } = await sb.from('lotti_sm').select('*').eq('codice', lnk.lotto_sm_codice).single()
      if (s && !lotti_sm.find(x => x.codice === s.codice)) lotti_sm.push(s)
    }
  }

  // spedizioni
  const lottiPFCodici = pf ? [pf.codice] : []
  if (lottiPFCodici.length) {
    const { data: righe } = await sb.from('ddt_righe').select('ddt_id,lotto_pf_codice,quantita').in('lotto_pf_codice', lottiPFCodici)
    for (const r of righe||[]) {
      const { data: ddt } = await sb.from('ddt').select('numero,cliente,data_spedizione,stato').eq('id', r.ddt_id).single()
      if (ddt) {
        spedizioni.push({ ...ddt, lotto_pf: r.lotto_pf_codice, ddt_numero: ddt.numero })
        if (!catena.find(x => x.codice === ddt.numero)) catena.push({ codice: ddt.numero, tipo: 'DDT', bg: 'var(--su-verdel)', tx: 'var(--su-violad)', bd: 'var(--su-verdeld)' })
      }
    }
  }

  if (!mp && !sm && !pf) return res.status(404).json({ error: `Nessun lotto trovato con codice "${codice}"` })

  res.json({ codice_cercato: codice, catena, lotti_mp, lotti_sm, spedizioni })
})

module.exports = router
