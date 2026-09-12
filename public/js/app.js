// ============================================================
// TrackPack · client app.js
// ============================================================
const USER = window.__USER__;
const PILL = { MP: 'pill-verde', SM: 'pill-viola', PF: 'pill-amber' };
const STATO_PILL = {
  Ok: 'pill-verde', Riserva: 'pill-amber', Soglia: 'pill-amber', Esaurito: 'pill-grigio',
  Disponibile: 'pill-verde', 'In uso': 'pill-viola',
  'In corso': 'pill-verde', Attesa: 'pill-amber', Completato: 'pill-viola', Pronto: 'pill-verde', Spedito: 'pill-grigio',
  Consegnato: 'pill-verde', 'In transito': 'pill-viola', Annullato: 'pill-rosso',
  Attivo: 'pill-verde', Sospeso: 'pill-amber', Bozza: 'pill-grigio',
};

// ---- fetch helper ----
async function api(url, opts = {}) {
  const r = await fetch('/api' + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore');
  return data;
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pill(txt, cls) { return `<span class="pill ${cls || 'pill-grigio'}">${esc(txt)}</span>`; }
function statoPill(s) { return pill(s, STATO_PILL[s]); }
function fmt(n) { return Number(n || 0).toLocaleString('it-IT'); }
function today() { return new Date().toISOString().slice(0, 10); }

// ---- Toast ----
function showToast(msg, type = 'ok') {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,.15);border:1.5px solid;transition:opacity .25s;';
    document.body.appendChild(t);
  }
  const ok = type === 'ok';
  t.style.background = ok ? 'var(--verdel)' : 'var(--rossol)';
  t.style.borderColor = ok ? 'var(--verdeld)' : '#f7c1c1';
  t.style.color = ok ? 'var(--violad)' : 'var(--rosso)';
  t.innerHTML = `<i class="ti ti-${ok ? 'circle-check' : 'alert-triangle'}"></i>${esc(msg)}`;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.opacity = '0'), 3200);
}

function loading(on, msg = 'Salvataggio…') {
  document.getElementById('loading-msg').textContent = msg;
  document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none';
}

// ---- Navigazione ----
const LOADERS = {
  dash: loadDashboard, mp: loadMP, sm: loadSM, pf: loadPF,
  mag: () => loadMag('mp'), sped: loadSped, ana: loadAna, traccia: () => {}, utenti: loadUtenti,
};
function goPage(id, title) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('on');
  document.getElementById('ni-' + id)?.classList.add('active');
  document.getElementById('page-title').textContent = title;
  if (LOADERS[id]) LOADERS[id]();
}

async function doLogout() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const d = await api('/dashboard');
    document.getElementById('kpi-mp').textContent = d.kpi.mp;
    document.getElementById('kpi-sm').textContent = d.kpi.sm;
    document.getElementById('kpi-pf').textContent = d.kpi.pf;
    document.getElementById('kpi-soglia').textContent = d.kpi.sottoSoglia;

    if (d.sottoSoglia.length) {
      const txt = d.sottoSoglia.map((s) => `${s.descrizione} (${fmt(s.giacenza)} ${s.um})`).join(', ');
      document.getElementById('alert-soglia-txt').innerHTML = `<strong>${d.sottoSoglia.length} lotti sotto soglia:</strong> ${esc(txt)}. Considera il riordino.`;
      document.getElementById('alert-soglia').style.display = 'flex';
    } else {
      document.getElementById('alert-soglia').style.display = 'none';
    }

    document.getElementById('dash-movimenti').innerHTML = d.movimenti.length
      ? d.movimenti.map((m) => `<div class="mov-item">${pill(m.tipo, PILL[m.tipo])}<div style="flex:1;min-width:0;"><div class="mono">${esc(m.codice)}</div><div style="font-size:12px;color:var(--grigio)">${esc(m.desc)}</div></div><span style="font-size:12px;color:var(--grigio);">${new Date(m.ts).toLocaleDateString('it-IT')}</span></div>`).join('')
      : '<div class="empty"><i class="ti ti-inbox"></i><p>Nessun movimento</p></div>';

    document.getElementById('dash-ordini').innerHTML = d.ordiniPF.length
      ? d.ordiniPF.map((o) => `<tr><td class="mono">${esc(o.codice)}</td><td>${esc(o.articolo)}</td><td>${fmt(o.qty)} ${esc(o.um)}</td><td>${statoPill(o.stato)}</td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><p>Nessun ordine</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}

// ============================================================
// RICEVIMENTO MP
// ============================================================
async function loadMP() {
  try {
    const [forn, mat, lotti] = await Promise.all([api('/fornitori'), api('/materiali?tipo=MP'), api('/lotti-mp')]);
    fillSelect('mp-fornitore', forn.map((f) => ({ v: f.id, t: f.ragione_sociale })), true);
    fillSelect('mp-materiale', mat.map((m) => ({ v: m.id, t: `${m.codice} · ${m.descrizione}` })));
    if (!document.getElementById('mp-data').value) document.getElementById('mp-data').value = today();
    document.getElementById('mp-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.materiali?.descrizione || '')}</td><td>${l.ddt_data ? new Date(l.ddt_data).toLocaleDateString('it-IT') : '—'}</td><td>${fmt(l.giacenza)} ${esc(l.unita_misura)}</td><td>${statoPill(l.stato)}</td></tr>`
    ).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun ricevimento</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}

function chiudiLabel(selector) {
    document.querySelector(selector).classList.remove("show");
}

function salvaLabel(selector = "#label-mp") {
    const labelEl = document.querySelector(selector);
    const target = labelEl?.querySelector('.barcode-mp') || labelEl;
    if (!target) return;

    html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 3,
        ignoreElements: (el) => el.classList.contains("close-label") || el.classList.contains("save-label")
    }).then(canvas => {
        const link = document.createElement("a");
        const fileName = target.querySelector('.footer-mp span')?.textContent?.replace(/\D/g, '') || 'label';
        link.download = `lotto-${fileName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

function generateEtichetta(r, date, selector = "#label-mp", type = "MP", options = {}) {
  const params = new URLSearchParams({
    date,
    quantity: r.quantita,
    unit: r.unita_misura,
    lot: r.codice_lotto,
    type,
    foodContactSymbol: options.foodContactSymbol ? 'true' : 'false',
    foodContact20Pap: options.foodContact20Pap ? 'true' : 'false',
    foodContact21Pap: options.foodContact21Pap ? 'true' : 'false',
    foodContact22Pap: options.foodContact22Pap ? 'true' : 'false',
    foodContact81: options.foodContact81 ? 'true' : 'false',
    foodContact4Ldpe: options.foodContact4Ldpe ? 'true' : 'false',
    foodContactText: options.foodContactText ? 'true' : 'false',
    foodContactMunicipality: options.foodContactMunicipality ? 'true' : 'false',
  });
  fetch(`/barcode/generate?${params}`)
        .then(res => res.json())
        .then(data => {
            const labelEl = document.querySelector(selector);
            labelEl.innerHTML = data.data;

            const labelBox = labelEl.querySelector('.barcode-mp');
            if (labelBox) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-label';
                saveBtn.setAttribute('aria-label', 'Salva immagine');
                saveBtn.innerHTML = '<i class="ti ti-download"></i>';
                saveBtn.onclick = () => salvaLabel(selector);

                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-label';
                closeBtn.setAttribute('aria-label', 'Chiudi');
                closeBtn.textContent = '×';
                closeBtn.onclick = () => chiudiLabel(selector);

                labelBox.append(saveBtn, closeBtn);
            }

            labelEl.classList.add("show");
            console.log(data);
            console.log(data.label);
        });
}

async function salvaMP(btn) {

  const materiale_id = val('mp-materiale');
  const ddt = val('mp-ddt'), qty = val('mp-qty');
  if (!materiale_id) return showToast('Seleziona il materiale', 'err');
  if (!ddt || !qty) return showToast('DDT e quantità obbligatori', 'err');
  loading(true, 'Registrazione ricevimento…');
  try {
    const r = await api('/lotti-mp', { method: 'POST', body: {
      fornitore_id: val('mp-fornitore') || null, materiale_id,
      ddt_numero: ddt, ddt_data: val('mp-data'),
      quantita: qty, unita_misura: val('mp-um'), n_pedane: val('mp-ped'), note: val('mp-note'),
    }});
    showToast(`Ricevimento registrato! Lotto ${r.codice_lotto}`);
    ['mp-ddt', 'mp-qty', 'mp-note'].forEach((id) => (document.getElementById(id).value = ''));      
    loadMP();
    generateEtichetta(r, r.ddt_data, '#label-mp', 'MP', {
      foodContactSymbol: document.getElementById('mp-food-contact-symbol').checked,
      foodContactText: document.getElementById('mp-food-contact-text').checked,
    });
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// LAVORAZIONE SM
// ============================================================
let smTipo = 'int';
let smConsumi = [];
let smLotAddMode = 'manual';
function setSMTipo(t) {
  smTipo = t;
  document.getElementById('sm-int').classList.toggle('on', t === 'int');
  document.getElementById('sm-ext').classList.toggle('on', t === 'ext');
  document.getElementById('sm-ext-box').style.display = t === 'ext' ? 'block' : 'none';
}
function smLotAddTab(mode, btn) {
  smLotAddMode = mode;
  document.querySelectorAll('#sm-lot-add-tabs .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.getElementById('sm-mp-manual').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('sm-mp-scanner').style.display = mode === 'scanner' ? 'block' : 'none';
}

async function loadSM() {
  try {
    const [forn, smMat, mpLotti, lotti] = await Promise.all([api('/fornitori'), api('/materiali?tipo=SM'), api('/lotti-mp'), api('/lotti-sm')]);
    fillSelect('sm-fornitore', forn.map((f) => ({ v: f.id, t: f.ragione_sociale })), true, '— nessuno —');
    fillSelect('sm-tipo', smMat.map((m) => ({ v: m.id, t: `${m.codice} · ${m.descrizione}` })));
    window.__mpLotti = mpLotti;
    fillSelect('sm-mp-sel', mpLotti.filter((l) => l.giacenza > 0).map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto MP…');
    if (!document.getElementById('sm-data').value) document.getElementById('sm-data').value = today();
    smConsumi = []; renderSMConsumi();
    document.getElementById('sm-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.materiali?.descrizione || '')}</td><td>${pill(l.lavorazione === 'esterna' ? 'Est.' : 'Int.', 'pill-grigio')}</td><td>${fmt(l.giacenza)} ${esc(l.unita_misura)}</td><td>${statoPill(l.stato)}</td></tr>`
    ).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessuna lavorazione</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}

function addSMConsumoById(id) {
  if (!id) return;
  if (smConsumi.find((c) => c.lotto_mp_id === id)) return showToast('Lotto già aggiunto', 'err');
  const lotto = (window.__mpLotti || []).find((l) => l.id === id);
  if (!lotto) return showToast('Lotto MP non trovato', 'err');
  if (Number(lotto.giacenza) <= 0) return showToast('Lotto MP senza giacenza disponibile', 'err');
  smConsumi.push({ lotto_mp_id: id, codice: lotto.codice_lotto, desc: lotto.materiali?.descrizione, disp: lotto.giacenza, um: lotto.unita_misura, quantita: 0 });
  renderSMConsumi();
}
function addSMConsumo() {
  const id = val('sm-mp-sel');
  if (!id) return showToast('Seleziona un lotto MP', 'err');
  addSMConsumoById(id);
}
function parseSMBarcodeValue(raw) {
  const v = String(raw || '').trim();
  if (!v) return {};
  return {
    gtin: v.substring(2, 16),
    productionDate: v.substring(18, 26),
    expiryDate: v.substring(28, 36),
    quantity: Number(v.substring(38) || 0),
  };
}
function addSMConsumoByScan() {
  const scan = val('sm-mp-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const parsed = parseSMBarcodeValue(scan);
  if (!parsed.productionDate) return showToast('Codice barcode non riconosciuto', 'err');
  const targetDate = parsed.productionDate;
  const targetQty = parsed.quantity || 0;
  const lotto = (window.__mpLotti || []).find((l) => {
    const lotDate = String(l.codice_lotto || '').match(/LT-(\d{8})-/)?.[1];
    const ddtDate = l.ddt_data ? new Date(l.ddt_data).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const qtyOk = !targetQty || Number(l.quantita) === targetQty || Number(l.giacenza) === targetQty;
    return qtyOk && (lotDate === targetDate || ddtDate === targetDate);
  });
  if (!lotto) return showToast('Nessun lotto MP trovato per il codice scannerizzato', 'err');
  addSMConsumoById(lotto.id);
  document.getElementById('sm-mp-scan').value = '';
}
function setQuantitaDisponibile(collection, index, value, render) {
  const riga = collection[index];
  const quantita = Number(value);
  if (!riga) return;
  if (!Number.isFinite(quantita) || quantita < 0 || quantita > Number(riga.disp)) {
    showToast(`La quantità non può superare la disponibilità (${fmt(riga.disp)} ${riga.um})`, 'err');
    riga.quantita = Math.min(Math.max(Number.isFinite(quantita) ? quantita : 0, 0), Number(riga.disp));
  } else {
    riga.quantita = quantita;
  }
  render();
}
function renderSMConsumi() {
  document.getElementById('sm-mp-rows').innerHTML = smConsumi.map((c, i) =>
    `<div class="mp-row">${pill('MP', 'pill-verde')}<div style="flex:1;min-width:120px;"><div class="mono">${esc(c.codice)}</div><div style="font-size:11px;color:var(--grigio);">${esc(c.desc || '')} · ${fmt(c.disp)} ${esc(c.um)} disp.</div></div><input class="fi" type="number" min="0" max="${c.disp}" value="${c.quantita}" onchange="setQuantitaDisponibile(smConsumi,${i},this.value,renderSMConsumi)" style="width:80px;text-align:right;padding:8px 10px;"><span style="font-size:12px;color:var(--grigio);">${esc(c.um)}</span><button style="background:none;border:none;color:var(--grigio);font-size:20px;cursor:pointer;" onclick="smConsumi.splice(${i},1);renderSMConsumi()">×</button></div>`
  ).join('');
}

async function salvaSM(btn) {
  const tipo = val('sm-tipo'), qty = val('sm-qty');
  if (!tipo) return showToast('Seleziona il tipo di semilavorato', 'err');
  loading(true, 'Registrazione SM…');
  try {
    const r = await api('/lotti-sm', { method: 'POST', body: {
      tipo_semilavorato: tipo, lavorazione: smTipo === 'ext' ? 'esterna' : 'interna',
      fornitore_sm_id: smTipo === 'ext' ? (val('sm-fornitore') || null) : null,
      ddt_numero: val('sm-ddt'), ddt_data: val('sm-ddt-data'),
      quantita: qty, unita_misura: val('sm-um'), data_lavorazione: val('sm-data'), note: val('sm-note'),
      consumi: smConsumi.map((c) => ({ lotto_mp_id: c.lotto_mp_id, quantita: c.quantita, unita_misura: c.um })),
    }});
    generateEtichetta(r, r.data_lavorazione, '#label-sm', 'SM', {
      foodContactSymbol: document.getElementById('sm-food-contact-symbol').checked,
      foodContactText: document.getElementById('sm-food-contact-text').checked,
    });
    showToast(`Lavorazione SM registrata! Lotto ${r.codice_lotto}`);
    ['sm-note'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('sm-qty').value = 0;
    document.getElementById('sm-tipo').value = '';
    loadSM();
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// PRODUZIONE PF
// ============================================================
let pfConsumiMP = [], pfConsumiSM = [];
let pfLotAddModes = { mp: 'manual', sm: 'manual' };
function pfLotAddTab(type, mode, btn) {
  pfLotAddModes[type] = mode;
  document.querySelectorAll(`#pf-${type}-add-tabs .tab-btn`).forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.getElementById(`pf-${type}-manual`).style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById(`pf-${type}-scanner`).style.display = mode === 'scanner' ? 'block' : 'none';
}
function findLotByBarcode(lotti, raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const parsed = parseSMBarcodeValue(v);
  if (!parsed.productionDate) return null;
  const targetDate = parsed.productionDate;
  const targetQty = parsed.quantity || 0;
  return (lotti || []).find((l) => {
    const lotDate = String(l.codice_lotto || '').match(/(?:LT|SM|PF)-(\d{8})-/)?.[1];
    const ddtDate = l.ddt_data ? new Date(l.ddt_data).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const qtyOk = !targetQty || Number(l.quantita) === targetQty || Number(l.giacenza) === targetQty;
    return qtyOk && (lotDate === targetDate || ddtDate === targetDate);
  }) || null;
}
async function loadPF() {
  try {
    const [art, mpLotti, smLotti, lotti] = await Promise.all([api('/articoli'), api('/lotti-mp'), api('/lotti-sm'), api('/lotti-pf')]);
    fillSelect('pf-art', art.map((a) => ({ v: a.id, t: `${a.codice} · ${a.descrizione}` })));
    window.__mpLotti = mpLotti; window.__smLotti = smLotti;
    fillSelect('pf-mp-sel', mpLotti.map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto MP…');
    fillSelect('pf-sm-sel', smLotti.filter((l) => l.giacenza > 0).map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto SM…');
    if (!document.getElementById('pf-data').value) document.getElementById('pf-data').value = today();
    pfConsumiMP = []; pfConsumiSM = []; renderPFConsumi();
    document.getElementById('pf-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.articoli_pf?.descrizione || '')}</td><td>${fmt(l.quantita)}</td><td>${statoPill(l.stato)}</td></tr>`
    ).join('') || '<tr><td colspan="4"><div class="empty"><p>Nessun ordine</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}
function addPFConsumoMPById(id) {
  if (!id) return;
  if (pfConsumiMP.find((c) => c.lotto_mp_id === id)) return showToast('Lotto già aggiunto', 'err');
  const l = (window.__mpLotti || []).find((x) => x.id === id);
  if (!l) return showToast('Lotto MP non trovato', 'err');
  pfConsumiMP.push({ lotto_mp_id: id, codice: l.codice_lotto, desc: l.materiali?.descrizione, disp: l.giacenza, um: l.unita_misura, quantita: 0 });
  renderPFConsumi();
}
function addPFConsumoMP() {
  const id = val('pf-mp-sel'); if (!id) return showToast('Seleziona un lotto MP', 'err');
  addPFConsumoMPById(id);
}
function addPFConsumoMPByScan() {
  const scan = val('pf-mp-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const lotto = findLotByBarcode(window.__mpLotti, scan);
  if (!lotto) return showToast('Nessun lotto MP trovato per il codice scannerizzato', 'err');
  addPFConsumoMPById(lotto.id);
  document.getElementById('pf-mp-scan').value = '';
}
function addPFConsumoSMById(id) {
  if (!id) return;
  if (pfConsumiSM.find((c) => c.lotto_sm_id === id)) return showToast('Lotto già aggiunto', 'err');
  const l = (window.__smLotti || []).find((x) => x.id === id);
  if (!l) return showToast('Lotto SM non trovato', 'err');
  pfConsumiSM.push({ lotto_sm_id: id, codice: l.codice_lotto, desc: l.materiali?.descrizione || '', disp: l.giacenza, um: l.unita_misura, quantita: 0 });
  renderPFConsumi();
}
function addPFConsumoSM() {
  const id = val('pf-sm-sel'); if (!id) return showToast('Seleziona un lotto SM', 'err');
  addPFConsumoSMById(id);
}
function addPFConsumoSMByScan() {
  const scan = val('pf-sm-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const lotto = findLotByBarcode(window.__smLotti, scan);
  if (!lotto) return showToast('Nessun lotto SM trovato per il codice scannerizzato', 'err');
  addPFConsumoSMById(lotto.id);
  document.getElementById('pf-sm-scan').value = '';
}
function renderPFConsumi() {
  document.getElementById('pf-mp-rows').innerHTML = pfConsumiMP.map((c, i) =>
    `<div class="mp-row">${pill('MP', 'pill-verde')}<div style="flex:1;min-width:120px;"><div class="mono">${esc(c.codice)}</div><div style="font-size:11px;color:var(--grigio);">${esc(c.desc || '')} · ${fmt(c.disp)} ${esc(c.um)} disp.</div></div><input class="fi" type="number" min="0" max="${c.disp}" value="${c.quantita}" onchange="setQuantitaDisponibile(pfConsumiMP,${i},this.value,renderPFConsumi)" style="width:80px;text-align:right;padding:8px 10px;"><span style="font-size:12px;color:var(--grigio);">${esc(c.um)}</span><button style="background:none;border:none;color:var(--grigio);font-size:20px;cursor:pointer;" onclick="pfConsumiMP.splice(${i},1);renderPFConsumi()">×</button></div>`
  ).join('');
  document.getElementById('pf-sm-rows').innerHTML = pfConsumiSM.map((c, i) =>
    `<div class="mp-row">${pill('SM', 'pill-viola')}<div style="flex:1;min-width:120px;"><div class="mono">${esc(c.codice)}</div><div style="font-size:11px;color:var(--grigio);">${esc(c.desc || '')} · ${fmt(c.disp)} ${esc(c.um)} disp.</div></div><input class="fi" type="number" min="0" max="${c.disp}" value="${c.quantita}" onchange="setQuantitaDisponibile(pfConsumiSM,${i},this.value,renderPFConsumi)" style="width:80px;text-align:right;padding:8px 10px;"><span style="font-size:12px;color:var(--grigio);">${esc(c.um)}</span><button style="background:none;border:none;color:var(--grigio);font-size:20px;cursor:pointer;" onclick="pfConsumiSM.splice(${i},1);renderPFConsumi()">×</button></div>`
  ).join('');
}
async function salvaPF(btn) {
  const art = val('pf-art'), qty = val('pf-qty');
  const um = val('pf-um');
  if (!art) return showToast('Seleziona un articolo', 'err');
  if (!qty || qty <= 0) return showToast('Inserisci la quantità', 'err');
  loading(true, 'Avvio produzione…');
  try {
    const r = await api('/lotti-pf', { method: 'POST', body: {
      articolo_id: art, quantita: qty, unita_misura: um, data_produzione: val('pf-data'),
      consumi_mp: pfConsumiMP.map((c) => ({ lotto_mp_id: c.lotto_mp_id, quantita: c.quantita, unita_misura: c.um })),
      consumi_sm: pfConsumiSM.map((c) => ({ lotto_sm_id: c.lotto_sm_id, quantita: c.quantita, unita_misura: c.um })),
    }});
    generateEtichetta(r, r.data_produzione, '#label-pf', 'PF', {
      foodContactSymbol: document.getElementById('pf-food-contact-symbol').checked,
      foodContact20Pap: document.getElementById('pf-food-contact-20-pap').checked,
      foodContact21Pap: document.getElementById('pf-food-contact-21-pap').checked,
      foodContact22Pap: document.getElementById('pf-food-contact-22-pap').checked,
      foodContact81: document.getElementById('pf-food-contact-81').checked,
      foodContact4Ldpe: document.getElementById('pf-food-contact-4-ldpe').checked,
      foodContactText: document.getElementById('pf-food-contact-text').checked,
      foodContactMunicipality: document.getElementById('pf-food-contact-municipality').checked,
    });
    showToast(`Ordine PF avviato! Lotto ${r.codice_lotto}`);
    document.getElementById('pf-qty').value = 0;
    loadPF();
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// MAGAZZINO
// ============================================================
function magTab(t, btn) {
  document.querySelectorAll('#page-mag .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  loadMag(t);
}
async function loadMag(tipo) {
  try {
    const rows = await api('/magazzino/' + tipo);
    document.getElementById('mag-body').innerHTML = rows.length
      ? rows.map((r) => `<tr><td class="mono">${esc(r.codice)}</td><td>${esc(r.desc || '')}</td><td>${fmt(r.giacenza)} ${esc(r.um)}</td><td>${statoPill(r.stato)}</td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><i class="ti ti-package"></i><p>Magazzino vuoto</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}

// ============================================================
// SPEDIZIONI
// ============================================================
let spedRighe = [];
let spedLotAddMode = 'manual';
function spedLotAddTab(mode, btn) {
  spedLotAddMode = mode;
  document.querySelectorAll('#sped-pf-add-tabs .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.getElementById('sped-pf-manual').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('sped-pf-scanner').style.display = mode === 'scanner' ? 'block' : 'none';
}
async function loadSped() {
  try {
    const [pfLotti, clienti, storico] = await Promise.all([api('/lotti-pf'), api('/clienti'), api('/spedizioni')]);
    window.__pfLotti = pfLotti;
    fillSelect('sped-cliente', clienti.map((c) => ({ v: c.ragione_sociale, t: c.ragione_sociale })), true, '— seleziona cliente —');
    const spedibili = pfLotti.filter((l) => l.giacenza > 0 && l.stato !== 'Spedito');
    fillSelect('sped-pf-sel', spedibili.map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.articoli_pf?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto PF…');
    if (!document.getElementById('sped-data').value) document.getElementById('sped-data').value = today();
    spedRighe = []; renderSpedRighe();
    document.getElementById('sped-storico').innerHTML = storico.map((s) =>
      `<tr><td class="mono">${esc(s.ddt_numero)}</td><td>${esc(s.cliente)}</td><td>${s.data_spedizione ? new Date(s.data_spedizione).toLocaleDateString('it-IT') : '—'}</td><td>${statoPill(s.stato)}</td></tr>`
    ).join('') || '<tr><td colspan="4"><div class="empty"><p>Nessuna spedizione</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}
function addSpedRigaById(id) {
  if (!id) return;
  if (spedRighe.find((r) => r.lotto_pf_id === id)) return showToast('Lotto già aggiunto', 'err');
  const l = (window.__pfLotti || []).find((x) => x.id === id);
  if (!l) return showToast('Lotto PF non trovato', 'err');
  spedRighe.push({ lotto_pf_id: id, codice: l.codice_lotto, desc: l.articoli_pf?.descrizione, disp: l.giacenza, um: l.unita_misura, quantita: l.giacenza });
  renderSpedRighe();
}
function addSpedRiga() {
  const id = val('sped-pf-sel'); if (!id) return showToast('Seleziona un lotto PF', 'err');
  addSpedRigaById(id);
}
function addSpedRigaByScan() {
  const scan = val('sped-pf-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const lotto = findLotByBarcode(window.__pfLotti, scan);
  if (!lotto) return showToast('Nessun lotto PF trovato per il codice scannerizzato', 'err');
  addSpedRigaById(lotto.id);
  document.getElementById('sped-pf-scan').value = '';
}
function renderSpedRighe() {
  document.getElementById('sped-pf-rows').innerHTML = spedRighe.map((r, i) =>
    `<div class="mp-row">${pill('PF', 'pill-amber')}<div style="flex:1;min-width:120px;"><div class="mono">${esc(r.codice)}</div><div style="font-size:11px;color:var(--grigio);">${esc(r.desc || '')} · ${fmt(r.disp)} ${esc(r.um)} disp.</div></div><input class="fi" type="number" min="0" max="${r.disp}" value="${r.quantita}" onchange="setQuantitaDisponibile(spedRighe,${i},this.value,renderSpedRighe)" style="width:80px;text-align:right;padding:8px 10px;"><span style="font-size:12px;color:var(--grigio);">${esc(r.um)}</span><button style="background:none;border:none;color:var(--grigio);font-size:20px;cursor:pointer;" onclick="spedRighe.splice(${i},1);renderSpedRighe()">×</button></div>`
  ).join('');
}
async function salvaSped(btn) {
  const cliente = val('sped-cliente');
  if (!cliente) return showToast('Inserisci il cliente', 'err');
  if (!spedRighe.length) return showToast('Aggiungi almeno un lotto PF', 'err');
  loading(true, 'Generazione DDT…');
  try {
    const r = await api('/spedizioni', { method: 'POST', body: {
      cliente, data_spedizione: val('sped-data'), vettore: val('sped-vettore'), note: val('sped-note'),
      righe: spedRighe.map((x) => ({ lotto_pf_id: x.lotto_pf_id, quantita: x.quantita, unita_misura: x.um })),
    }});
    showToast(`Spedizione confermata! ${r.ddt_numero} generato.`);
    ['sped-cliente', 'sped-vettore', 'sped-note'].forEach((id) => (document.getElementById(id).value = ''));
    loadSped();
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// ANAGRAFICHE
// ============================================================
function anaTab(t, btn) {
  ['f', 'c', 'm', 'a', 't'].forEach((k) => (document.getElementById('ana-' + k).style.display = k === t ? '' : 'none'));
  document.querySelectorAll('#page-ana .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
}
let materialiAnagrafica = [];
let articoliAnagrafica = [];
function suggestNextMaterialCode(materiali) {
  const input = document.getElementById('am-cod-num');
  if (!input || input.value.trim() && input.value !== input.dataset.suggestedCode) return;
  const tipo = val('am-tipo');
  const usedCodes = materiali
    .filter((materiale) => materiale.tipo === tipo)
    .map((materiale) => Number.parseInt(materiale.codice_numerico, 10))
    .filter((codice) => Number.isInteger(codice) && codice >= 0);
  const nextCode = (usedCodes.length ? Math.max(...usedCodes) + 1 : 1).toString().padStart(4, '0');
  input.value = nextCode;
  input.dataset.suggestedCode = nextCode;
}
function updateMaterialCodeSuggestion() {
  suggestNextMaterialCode(materialiAnagrafica);
}
function suggestNextArticleCode(articoli) {
  const input = document.getElementById('aa-cod-num');
  if (!input || input.value.trim() && input.value !== input.dataset.suggestedCode) return;
  const usedCodes = articoli
    .map((articolo) => Number.parseInt(articolo.codice_numerico, 10))
    .filter((codice) => Number.isInteger(codice) && codice >= 0);
  const nextCode = (usedCodes.length ? Math.max(...usedCodes) + 1 : 1).toString().padStart(4, '0');
  input.value = nextCode;
  input.dataset.suggestedCode = nextCode;
}
async function loadAna() {
  try {
    const [forn, clienti, mat, art, tipologie] = await Promise.all([api('/fornitori'), api('/clienti'), api('/materiali'), api('/articoli'), api('/tipologie')]);
    materialiAnagrafica = mat;
    articoliAnagrafica = art;
    suggestNextMaterialCode(materialiAnagrafica);
    suggestNextArticleCode(articoliAnagrafica);
    document.getElementById('ana-f-body').innerHTML = forn.map((f) =>
      `<tr><td>${esc(f.ragione_sociale)}</td><td class="mono">${esc(f.piva || '—')}</td><td>${statoPill(f.stato)}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty"><p>Nessun fornitore</p></div></td></tr>';
    document.getElementById('ana-c-body').innerHTML = clienti.map((c) =>
      `<tr><td>${esc(c.ragione_sociale)}</td><td class="mono">${esc(c.partita_iva || '—')}</td><td class="mono">${esc(c.email || '—')}</td><td>${statoPill(c.stato)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty"><p>Nessun cliente</p></div></td></tr>';
    document.getElementById('ana-m-body').innerHTML = mat.map((m) =>
      `<tr><td class="mono">${esc(m.codice)}</td><td class="mono">${esc(m.codice_numerico)}</td><td>${esc(m.descrizione)}</td><td>${pill(m.tipo, m.tipo === 'MP' ? 'pill-verde' : 'pill-viola')}</td><td>${esc(m.unita_misura)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun materiale</p></div></td></tr>';
    document.getElementById('ana-a-body').innerHTML = art.map((a) =>
      `<tr><td class="mono">${esc(a.codice)}</td><td class="mono">${esc(a.codice_numerico)}</td><td>${esc(a.descrizione)}</td><td class="mono">${esc(a.gtin14 || '—')}</td><td>${statoPill(a.stato)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun articolo</p></div></td></tr>';
    const tipologiaColumns = Object.keys(tipologie[0] || {});
    document.getElementById('ana-t-head').innerHTML = tipologiaColumns.length
      ? `<tr>${tipologiaColumns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr>`
      : '';
    document.getElementById('ana-t-body').innerHTML = tipologie.length
      ? tipologie.map((tipologia) => `<tr>${tipologiaColumns.map((column) => `<td>${esc(tipologia[column] ?? '—')}</td>`).join('')}</tr>`).join('')
      : '<tr><td><div class="empty"><p>Nessuna tipologia</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}
async function addFornitore(btn) {
  const ragione_sociale = val('af-nome');
  if (!ragione_sociale) return showToast('Ragione sociale obbligatoria', 'err');
  try {
    await api('/fornitori', { method: 'POST', body: { ragione_sociale, piva: val('af-piva'), stato: val('af-stato') } });
    showToast('Fornitore aggiunto');
    ['af-nome', 'af-piva'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}
async function addCliente(btn) {
  const ragione_sociale = val('ac-nome');
  if (!ragione_sociale) return showToast('Ragione sociale obbligatoria', 'err');
  try {
    await api('/clienti', { method: 'POST', body: {
      ragione_sociale,
      partita_iva: val('ac-piva'),
      email: val('ac-email'),
      telefono: val('ac-tel'),
      stato: val('ac-stato')
    } });
    showToast('Cliente aggiunto');
    ['ac-nome', 'ac-piva', 'ac-email', 'ac-tel'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}
async function addMateriale(btn) {
  const codice = val('am-cod').trim(), codice_numerico = val('am-cod-num').trim(), descrizione = val('am-desc');
  if (!codice || !descrizione) return showToast('Codice e descrizione obbligatori', 'err');
  if (!/^[A-Za-z0-9]{4}$/.test(codice)) return showToast('Il codice deve contenere 4 caratteri alfanumerici', 'err');
  if (!/^[0-9]{4}$/.test(codice_numerico)) return showToast('Il codice numerico deve contenere 4 cifre', 'err');
  try {
    await api('/materiali', { method: 'POST', body: { codice, codice_numerico, descrizione, tipo: val('am-tipo'), unita_misura: val('am-um'), soglia_minima: val('am-soglia') } });
    showToast('Materiale aggiunto');
    ['am-cod', 'am-cod-num', 'am-desc'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}
async function addArticolo(btn) {
  const codice = val('aa-cod').trim(), codice_numerico = val('aa-cod-num').trim(), descrizione = val('aa-desc');
  if (!codice || !descrizione) return showToast('Codice e descrizione obbligatori', 'err');
  if (!/^[A-Za-z0-9]{4}$/.test(codice)) return showToast('Il codice deve contenere 4 caratteri alfanumerici', 'err');
  if (!/^[0-9]{4}$/.test(codice_numerico)) return showToast('Il codice numerico deve contenere 4 cifre', 'err');
  try {
    await api('/articoli', { method: 'POST', body: { codice, codice_numerico, descrizione, gtin14: val('aa-gtin'), stato: val('aa-stato') } });
    showToast('Articolo aggiunto');
    ['aa-cod', 'aa-cod-num', 'aa-desc', 'aa-gtin'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

// ============================================================
// RINTRACCIABILITÀ
// ============================================================
async function doTrace() {
  const v = val('trace-in').trim();
  if (!v) return showToast('Inserisci un codice lotto', 'err');
  loading(true, 'Ricostruzione catena…');
  try {
    const c = await api('/traccia/' + encodeURIComponent(v));
    document.getElementById('trace-title').textContent = v;
    const chain = [];
    if (c.mp.length) chain.push({ t: 'MP', c: c.mp[0].codice, bg: 'var(--verdel)', tx: 'var(--violad)', bd: 'var(--verdeld)' });
    if (c.sm.length) chain.push({ t: 'SM', c: c.sm[0].codice, bg: 'var(--violal)', tx: 'var(--viola)', bd: '#c5bfee' });
    if (c.pf.length) chain.push({ t: 'PF', c: c.pf[0].codice, bg: 'var(--amberl)', tx: 'var(--amber)', bd: '#fac775' });
    if (c.ddt.length) chain.push({ t: 'DDT', c: c.ddt[0].ddt, bg: 'var(--verdel)', tx: 'var(--violad)', bd: 'var(--verdeld)' });
    document.getElementById('trace-chain').innerHTML = chain.map((n, i) =>
      (i > 0 ? '<span style="color:#ccc;font-size:18px;">→</span>' : '') +
      `<div style="font-size:11px;font-weight:700;padding:7px 12px;border-radius:20px;border:1.5px solid ${n.bd};background:${n.bg};color:${n.tx};font-family:'SF Mono',monospace;"><span style="opacity:.6;font-size:10px;margin-right:4px;">${n.t}</span>${esc(n.c)}</div>`
    ).join('') || '<span style="color:var(--grigio);font-size:13px;">Nessuna catena trovata per questo codice.</span>';

    document.getElementById('trace-mp').innerHTML = c.mp.map((r) => `<tr><td class="mono">${esc(r.codice)}</td><td>${esc(r.materiale || '')}</td><td>${esc(r.fornitore || '')}</td></tr>`).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';
    document.getElementById('trace-sm').innerHTML = c.sm.map((r) => `<tr><td class="mono">${esc(r.codice)}</td><td>${esc(r.tipo || '')}</td><td>${pill(r.lav === 'esterna' ? 'Est.' : 'Int.', 'pill-grigio')}</td></tr>`).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';
    document.getElementById('trace-pf').innerHTML = c.pf.map((r) => {
      const ddt = c.ddt[0] || {};
      return `<tr><td class="mono">${esc(r.codice)}</td><td class="mono">${esc(ddt.ddt || '—')}</td><td>${esc(ddt.cliente || '—')}</td></tr>`;
    }).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';

    document.getElementById('trace-res').style.display = 'block';
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// GESTIONE UTENTI
// ============================================================
async function loadUtenti() {
  try {
    const utenti = await api('/utenti');
    document.getElementById('utenti-body').innerHTML = utenti.map((u) => {
      const isMe = u.id === USER.id;
      const ruoloPill = u.ruolo === 'admin'
        ? '<span class="pill pill-viola"><i class="ti ti-shield" style="font-size:10px;"></i> admin</span>'
        : '<span class="pill pill-verde"><i class="ti ti-user" style="font-size:10px;"></i> operatore</span>';
      const statoP = u.attivo ? statoPill('Attivo') : pill('Disabilitato', 'pill-grigio');
      let azioni = '<span style="font-size:11px;color:#bbb;font-style:italic;">tu</span>';
      if (!isMe) {
        azioni = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button class="act-btn" onclick="toggleUtente('${u.id}',${!u.attivo})"><i class="ti ti-user-${u.attivo ? 'off' : 'check'}"></i>${u.attivo ? 'Disabilita' : 'Riabilita'}</button>
          <button class="act-btn" onclick="resetPw('${u.id}')"><i class="ti ti-key"></i></button>
          <button class="act-btn danger" onclick="delUtente('${u.id}','${esc(u.username)}')"><i class="ti ti-trash"></i></button>
        </div>`;
      }
      return `<tr><td class="mono">${esc(u.username)}</td><td>${esc(u.nome)}</td><td>${ruoloPill}</td><td>${statoP}</td><td>${azioni}</td></tr>`;
    }).join('');
  } catch (e) { showToast(e.message, 'err'); }
}
async function addUtente(btn) {
  const username = val('nu-user'), password = val('nu-pw');
  if (!username || !password) return showToast('Username e password obbligatori', 'err');
  if (password.length < 6) return showToast('Password minimo 6 caratteri', 'err');
  try {
    await api('/utenti', { method: 'POST', body: { username, nome: val('nu-nome'), ruolo: val('nu-ruolo'), password } });
    showToast('Utente creato');
    ['nu-user', 'nu-nome', 'nu-pw'].forEach((id) => (document.getElementById(id).value = ''));
    loadUtenti();
  } catch (e) { showToast(e.message, 'err'); }
}
async function toggleUtente(id, attivo) {
  try { await api(`/utenti/${id}/stato`, { method: 'PATCH', body: { attivo } }); showToast('Stato aggiornato'); loadUtenti(); }
  catch (e) { showToast(e.message, 'err'); }
}
async function resetPw(id) {
  const pw = prompt('Nuova password (min 6 caratteri):');
  if (!pw) return;
  try { await api(`/utenti/${id}/password`, { method: 'PATCH', body: { password: pw } }); showToast('Password aggiornata'); }
  catch (e) { showToast(e.message, 'err'); }
}
async function delUtente(id, username) {
  if (!confirm(`Eliminare l'utente "${username}"?`)) return;
  try { await api(`/utenti/${id}`, { method: 'DELETE' }); showToast('Utente eliminato'); loadUtenti(); }
  catch (e) { showToast(e.message, 'err'); }
}

// ============================================================
// Helpers UI
// ============================================================
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function fillSelect(id, options, allowEmpty = false, emptyLabel = '— seleziona —') {
  const el = document.getElementById(id); if (!el) return;
  let html = allowEmpty || el.id.includes('-sel') ? `<option value="">${emptyLabel}</option>` : '';
  html += options.map((o) => `<option value="${o.v}">${esc(o.t)}</option>`).join('');
  el.innerHTML = html;
}

// Avvio
goPage('dash', 'Dashboard');
