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
const STORICO_ETICHETTE = { mp: [], sm: [], pf: [] };
const PF_ART_OPTIONS = [];
let TRACE_INFO_NODES = [];
let TRACE_INFO_INDEX = new Map();
const ENTITY_INFO_CACHE = new Map();

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
    STORICO_ETICHETTE.mp = lotti;
    lotti.forEach((lotto) => cacheEntityInfo('MP', lotto.codice_lotto, entityInfoFromRecord('MP', lotto)));
    document.getElementById('mp-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.materiali?.descrizione || '')}</td><td>${l.ddt_data ? new Date(l.ddt_data).toLocaleDateString('it-IT') : '—'}</td><td>${fmt(l.giacenza)} ${esc(l.unita_misura)}</td><td>${statoPill(l.stato)}</td><td>${esc(l.ddt_numero || '—')}</td><td><div class="history-actions">${entityInfoButton('MP', l.codice_lotto)}<button class="btn btn-primary btn-sm" aria-label="Rivedi etichetta ${esc(l.codice_lotto)}" onclick="rivediEtichetta('mp','${esc(l.id)}')"><i class="ti ti-eye"></i></button><button class="btn btn-danger btn-sm" aria-label="Elimina lotto ${esc(l.codice_lotto)}" onclick="eliminaLottoStorico('mp','${esc(l.id)}',this)"><i class="ti ti-trash"></i></button></div></td></tr>`
    ).join('') || '<tr><td colspan="7"><div class="empty"><p>Nessun ricevimento</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}

function chiudiLabel(selector) {
    document.querySelector(selector).classList.remove("show");
}

function stampaLabel(selector = "#label-mp") {
    const labelEl = document.querySelector(selector);
    const target = labelEl?.querySelector('.barcode-mp') || labelEl;
    if (!target) {
        console.error("Etichetta non trovata:", selector);
        return;
    }

    // Dimensioni foglio (verticale)
    const LABEL_W = "60mm";
    const LABEL_H = "110mm";

    // 1. Apro la finestra SUBITO, dentro il click (evita il blocco popup)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Il browser ha bloccato la finestra di stampa. Consenti i popup per questo sito.");
        return;
    }
    printWindow.document.write('<p style="font-family:sans-serif">Preparazione etichetta…</p>');

    // 2. Genero l'immagine dell'etichetta
    html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        ignoreElements: (el) =>
            el.classList.contains("close-label") ||
            el.classList.contains("save-label") ||
            el.classList.contains("print-label"),
        onclone: (document) => {
            document.querySelectorAll(".close-label, .save-label, .print-label")
                .forEach((button) => button.remove());
        }
    }).then(canvas => {

        // 3. Ruoto l'immagine di 90° per adattarla al foglio verticale
        const rotated = document.createElement("canvas");
        rotated.width = canvas.height;
        rotated.height = canvas.width;
        const ctx = rotated.getContext("2d");
        ctx.translate(rotated.width / 2, rotated.height / 2);
        ctx.rotate(Math.PI / 2);   // senso orario; usa -Math.PI / 2 per antiorario
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

        const dataUrl = rotated.toDataURL("image/png");

        // 4. Scrivo la pagina di stampa
        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Stampa etichetta</title>
                <style>
                    @page {
                        size: ${LABEL_W} ${LABEL_H};
                        margin: 0;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: ${LABEL_W};
                        height: ${LABEL_H};
                        overflow: hidden;
                    }
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    img {
                        display: block;
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                    }
                </style>
            </head>
            <body>
                <img id="label-image">
            </body>
            </html>
        `);
        printWindow.document.close();

        // 5. Stampo quando l'immagine è caricata
        const img = printWindow.document.getElementById("label-image");
        img.onload = () => {
            printWindow.focus();
            printWindow.onafterprint = () => printWindow.close();
            printWindow.print();
        };
        img.src = dataUrl;

    }).catch(err => {
        console.error("Errore html2canvas:", err);
        printWindow.close();
        alert("Errore nella generazione dell'etichetta: " + err.message);
    });
}


function salvaLabel(selector = "#label-mp") {
    const labelEl = document.querySelector(selector);
    const target = labelEl?.querySelector('.barcode-mp') || labelEl;
    if (!target) return;

    html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 3,
        ignoreElements: (el) =>
            el.classList.contains("close-label") ||
            el.classList.contains("save-label") ||
            el.classList.contains("print-label"),
        onclone: (document) => {
            document.querySelectorAll(".close-label, .save-label, .print-label")
                .forEach((button) => button.remove());
        }
    }).then(canvas => {
        const link = document.createElement("a");
        const fileName = target.querySelector('.footer-mp span')?.textContent?.replace(/\D/g, '') || 'label';
        link.download = `lotto-${fileName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

async function generateEtichetta(r, date, selector = "#label-mp", type = "MP", options = {}) {
  const params = new URLSearchParams({
    date,
    quantity: r.quantita,
    unit: r.unita_misura,
    confezione: r.confezione ?? 0,
    unita_misura_confezione: r.unita_misura_confezione || 'pz',
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
  try {
    const response = await fetch(`/barcode/generate?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Errore nella generazione dell’etichetta');
    const labelEl = document.querySelector(selector);
    if (!labelEl) throw new Error('Area etichetta non trovata');
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

      const printBtn = document.createElement('button');
      printBtn.className = 'print-label';
      printBtn.setAttribute('aria-label', 'Stampa');
      printBtn.innerHTML = '<i class="ti ti-printer"></i>';
      printBtn.onclick = () => stampaLabel(selector);

      labelBox.append(saveBtn, printBtn, closeBtn);
    }

    labelEl.classList.add('show');
  } catch (e) {
    showToast(`Errore nella generazione dell’etichetta: ${e.message}`, 'err');
  }
}

function rivediEtichetta(tipo, id) {
  const l = STORICO_ETICHETTE[tipo]?.find((lotto) => lotto.id === id);
  if (!l) return showToast('Lotto non trovato nello storico', 'err');
  const date = tipo === 'mp' ? l.ddt_data : tipo === 'sm' ? l.data_lavorazione : l.data_produzione;
  const lotDate = String(l.codice_lotto || '').match(/^[A-Z]+-(\d{4})(\d{2})(\d{2})-/);
  const labelDate = date || (lotDate ? `${lotDate[1]}-${lotDate[2]}-${lotDate[3]}` : null);
  const labelType = tipo.toUpperCase();
  const selector = `#label-${tipo}`;
  generateEtichetta(l, labelDate, selector, labelType, l.label_options || {});
}

async function salvaMP(btn) {

  const materiale_id = val('mp-materiale');
  const ddt = val('mp-ddt'), qty = val('mp-qty');
  if (!materiale_id) return showToast('Seleziona il materiale', 'err');
  if (!ddt || !qty) return showToast('DDT e quantità obbligatori', 'err');
  const labelOptions = {
    foodContactSymbol: document.getElementById('mp-food-contact-symbol').checked,
    foodContactText: document.getElementById('mp-food-contact-text').checked,
  };
  loading(true, 'Registrazione ricevimento…');
  try {
    const r = await api('/lotti-mp', { method: 'POST', body: {
      fornitore_id: val('mp-fornitore') || null, materiale_id,
      ddt_numero: ddt, ddt_data: val('mp-data'),
      quantita: qty, unita_misura: val('mp-um'), n_pedane: val('mp-ped'), note: val('mp-note'),
      label_options: labelOptions,
    }});
    showToast(`Ricevimento registrato! Lotto ${r.codice_lotto}`);
    ['mp-ddt', 'mp-qty', 'mp-note'].forEach((id) => (document.getElementById(id).value = ''));      
    loadMP();
    generateEtichetta(r, r.ddt_data, '#label-mp', 'MP', labelOptions);
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

// ============================================================
// LAVORAZIONE SM
// ============================================================
let smTipo = 'int';
let smConsumi = [];
let smConsumiSM = [];
let smLotAddMode = 'manual';
let smSourceAddMode = 'manual';
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
function smSourceTab(mode, btn) {
  smSourceAddMode = mode;
  document.querySelectorAll('#sm-sm-add-tabs .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.getElementById('sm-sm-manual').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('sm-sm-scanner').style.display = mode === 'scanner' ? 'block' : 'none';
}

async function loadSM() {
  try {
    const [forn, mpLotti, lotti] = await Promise.all([api('/fornitori'), api('/lotti-mp'), api('/lotti-sm')]);
    fillSelect('sm-fornitore', forn.map((f) => ({ v: f.id, t: f.ragione_sociale })), true, '— nessuno —');
    window.__mpLotti = mpLotti;
    window.__smLotti = lotti;
    fillSelect('sm-mp-sel', mpLotti.filter((l) => l.giacenza > 0).map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto MP…');
    fillSelect('sm-sm-sel', lotti.filter((l) => l.giacenza > 0).map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto SM…');
    if (!document.getElementById('sm-data').value) document.getElementById('sm-data').value = today();
    smConsumi = []; smConsumiSM = []; renderSMConsumi(); renderSMConsumiSM();
    STORICO_ETICHETTE.sm = lotti;
    lotti.forEach((lotto) => cacheEntityInfo('SM', lotto.codice_lotto, entityInfoFromRecord('SM', lotto)));
    document.getElementById('sm-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.materiali?.descrizione || '')}</td><td>${pill(l.lavorazione === 'esterna' ? 'Est.' : 'Int.', 'pill-grigio')}</td><td>${fmt(l.giacenza)} ${esc(l.unita_misura)}</td><td>${statoPill(l.stato)}</td><td><div class="history-actions">${entityInfoButton('SM', l.codice_lotto)}<button class="btn btn-primary btn-sm" aria-label="Rivedi etichetta ${esc(l.codice_lotto)}" onclick="rivediEtichetta('sm','${esc(l.id)}')"><i class="ti ti-eye"></i></button><button class="btn btn-danger btn-sm" aria-label="Elimina lotto ${esc(l.codice_lotto)}" onclick="eliminaLottoStorico('sm','${esc(l.id)}',this)"><i class="ti ti-trash"></i></button></div></td></tr>`
    ).join('') || '<tr><td colspan="6"><div class="empty"><p>Nessuna lavorazione</p></div></td></tr>';
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
function addSMConsumoSMById(id) {
  if (!id) return;
  if (smConsumiSM.find((c) => c.lotto_sm_origine_id === id)) return showToast('Lotto già aggiunto', 'err');
  const lotto = (window.__smLotti || []).find((l) => l.id === id);
  if (!lotto) return showToast('Lotto SM non trovato', 'err');
  if (Number(lotto.giacenza) <= 0) return showToast('Lotto SM senza giacenza disponibile', 'err');
  smConsumiSM.push({ lotto_sm_origine_id: id, codice: lotto.codice_lotto, desc: lotto.materiali?.descrizione, disp: lotto.giacenza, um: lotto.unita_misura, quantita: 0 });
  renderSMConsumiSM();
}
function addSMConsumoSM() {
  const id = val('sm-sm-sel');
  if (!id) return showToast('Seleziona un lotto SM', 'err');
  addSMConsumoSMById(id);
}
function addSMConsumoSMByScan() {
  const scan = val('sm-sm-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const lotto = findLotByBarcode(window.__smLotti, scan);
  if (!lotto) return showToast('Nessun lotto SM trovato per il codice scannerizzato', 'err');
  addSMConsumoSMById(lotto.id);
  document.getElementById('sm-sm-scan').value = '';
}
function parseSMBarcodeValue(raw) {
  const v = String(raw || '').trim();
  if (!v || v.substring(16, 18) !== '10' || v.substring(26, 28) !== '17' || v.substring(36, 38) !== '37') return {};
  const productCode = v.substring(18, 26);
  const lotDate = v.substring(28, 36);
  const quantity = Number(v.substring(38));
  if (!/^\d{8}$/.test(productCode) || !/^\d{8}$/.test(lotDate) || !Number.isFinite(quantity)) return {};
  return {
    gtin: v.substring(2, 16),
    productCode,
    lotDate,
    quantity,
  };
}
function addSMConsumoByScan() {
  const scan = val('sm-mp-scan');
  if (!scan) return showToast('Scannerizza o incolla un codice barcode', 'err');
  const parsed = parseSMBarcodeValue(scan);
  if (!parsed.productCode) return showToast('Codice barcode non riconosciuto', 'err');
  const targetDate = parsed.lotDate;
  const targetQty = parsed.quantity;
  const targetMaterialCode = parsed.productCode.substring(1);
  const lotto = (window.__mpLotti || []).find((l) => {
    const materialCode = String(l.materiali?.codice_numerico || '').padStart(7, '0');
    const lotDate = String(l.codice_lotto || '').match(/MP-(\d{8})-/)?.[1];
    const ddtDate = l.ddt_data ? new Date(l.ddt_data).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const qtyOk = Number(l.quantita) === targetQty || Number(l.giacenza) === targetQty;
    return materialCode === targetMaterialCode && qtyOk && (lotDate === targetDate || ddtDate === targetDate);
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
function renderSMConsumiSM() {
  document.getElementById('sm-sm-rows').innerHTML = smConsumiSM.map((c, i) =>
    `<div class="mp-row">${pill('SM', 'pill-viola')}<div style="flex:1;min-width:120px;"><div class="mono">${esc(c.codice)}</div><div style="font-size:11px;color:var(--grigio);">${esc(c.desc || '')} · ${fmt(c.disp)} ${esc(c.um)} disp.</div></div><input class="fi" type="number" min="0" max="${c.disp}" value="${c.quantita}" onchange="setQuantitaDisponibile(smConsumiSM,${i},this.value,renderSMConsumiSM)" style="width:80px;text-align:right;padding:8px 10px;"><span style="font-size:12px;color:var(--grigio);">${esc(c.um)}</span><button style="background:none;border:none;color:var(--grigio);font-size:20px;cursor:pointer;" onclick="smConsumiSM.splice(${i},1);renderSMConsumiSM()">×</button></div>`
  ).join('');
}

function getNextMaterialCodeNumber(materiali, tipo = 'MP') {
  const usedCodes = (materiali || [])
    .filter((materiale) => String(materiale.tipo || 'MP').toUpperCase() === String(tipo).toUpperCase())
    .map((materiale) => Number.parseInt(materiale.codice_numerico, 10))
    .filter((codice) => Number.isInteger(codice) && codice >= 0);
  return (usedCodes.length ? Math.max(...usedCodes) + 1 : 1).toString().padStart(7, '0');
}

async function createSMMaterialFromForm() {
  const codice = val('sm-tipo').trim().replace(/\s+/g, '').toUpperCase();
  if (!codice) throw new Error('Inserisci il tipo di semilavorato');
  if (!/^[A-Za-z0-9]+$/.test(codice)) throw new Error('Il tipo semilavorato può contenere solo caratteri alfanumerici');

  const materiali = await api('/materiali');
  const existing = materiali.find((materiale) => String(materiale.codice).toUpperCase() === codice && String(materiale.tipo || 'MP').toUpperCase() === 'SM');
  if (existing) {
    materialiAnagrafica = materiali;
    return existing.id;
  }

  const materiale = await api('/materiali', {
    method: 'POST',
    body: {
      codice,
      codice_numerico: getNextMaterialCodeNumber(materiali, 'SM'),
      descrizione: codice,
      tipo: 'SM',
      unita_misura: val('sm-um') || 'kg',
      soglia_minima: 0,
    }
  });

  materialiAnagrafica = [...materiali, materiale];
  return materiale.id;
}

async function salvaSM(btn) {
  const tipo = val('sm-tipo').trim();
  const qty = val('sm-qty');
  if (qty <= 0) return showToast('Quantita prodotta non puo essere zero', 'err');
  if (!tipo) return showToast('Inserisci il tipo di semilavorato', 'err');
  const labelOptions = {
    foodContactSymbol: document.getElementById('sm-food-contact-symbol').checked,
    foodContactText: document.getElementById('sm-food-contact-text').checked,
  };
  loading(true, 'Registrazione SM…');
  try {
    const tipoSemilavorato = await createSMMaterialFromForm();
    const r = await api('/lotti-sm', { method: 'POST', body: {
      tipo_semilavorato: tipoSemilavorato, lavorazione: smTipo === 'ext' ? 'esterna' : 'interna',
      fornitore_sm_id: smTipo === 'ext' ? (val('sm-fornitore') || null) : null,
      ddt_numero: val('sm-ddt'), ddt_data: val('sm-ddt-data'),
      quantita: qty, unita_misura: val('sm-um'), data_lavorazione: val('sm-data'), note: val('sm-note'),
      consumi_mp: smConsumi.map((c) => ({ lotto_mp_id: c.lotto_mp_id, quantita: c.quantita, unita_misura: c.um })),
      consumi_sm: smConsumiSM.map((c) => ({ lotto_sm_origine_id: c.lotto_sm_origine_id, quantita: c.quantita, unita_misura: c.um })),
      label_options: labelOptions,
    }});
    generateEtichetta(r, r.data_lavorazione, '#label-sm', 'SM', labelOptions);
    showToast(`Lavorazione SM registrata! Lotto ${r.codice_lotto}`);
    ['sm-note'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('sm-qty').value = 0;
    document.getElementById('sm-tipo').value = '';
    smConsumi = []; smConsumiSM = []; renderSMConsumi(); renderSMConsumiSM();
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
  if (!parsed.lotDate) return null;
  const targetDate = parsed.lotDate;
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
    PF_ART_OPTIONS.splice(0, PF_ART_OPTIONS.length, ...Array.from(document.getElementById('pf-art').options, (option) => option.cloneNode(true)));
    filterPFArticles(val('pf-art-search'));
    window.__mpLotti = mpLotti; window.__smLotti = smLotti;
    fillSelect('pf-mp-sel', mpLotti.map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto MP…');
    fillSelect('pf-sm-sel', smLotti.filter((l) => l.giacenza > 0).map((l) => ({ v: l.id, t: `${l.codice_lotto} · ${l.materiali?.descrizione || ''} · ${fmt(l.giacenza)} ${l.unita_misura}` })), false, 'Aggiungi lotto SM…');
    if (!document.getElementById('pf-data').value) document.getElementById('pf-data').value = today();
    pfConsumiMP = []; pfConsumiSM = []; renderPFConsumi();
    STORICO_ETICHETTE.pf = lotti;
    lotti.forEach((lotto) => cacheEntityInfo('PF', lotto.codice_lotto, entityInfoFromRecord('PF', lotto)));
    document.getElementById('pf-storico').innerHTML = lotti.map((l) =>
      `<tr><td class="mono">${esc(l.codice_lotto)}</td><td>${esc(l.articoli_pf?.descrizione || '')}</td><td>${fmt(l.quantita)}</td><td>${statoPill(l.stato)}</td><td><div class="history-actions">${entityInfoButton('PF', l.codice_lotto)}<button class="btn btn-primary btn-sm" aria-label="Rivedi etichetta ${esc(l.codice_lotto)}" onclick="rivediEtichetta('pf','${esc(l.id)}')"><i class="ti ti-eye"></i></button><button class="btn btn-danger btn-sm" aria-label="Elimina lotto ${esc(l.codice_lotto)}" onclick="eliminaLottoStorico('pf','${esc(l.id)}',this)"><i class="ti ti-trash"></i></button></div></td></tr>`
    ).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun ordine</p></div></td></tr>';
  } catch (e) { showToast(e.message, 'err'); }
}
function filterPFArticles(query) {
  const select = document.getElementById('pf-art');
  if (!select) return;
  const selectedValue = select.value;
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('it');
  const matches = PF_ART_OPTIONS.filter((option) => option.textContent.toLocaleLowerCase('it').includes(normalizedQuery));
  select.replaceChildren(...matches.map((option) => option.cloneNode(true)));
  if (!matches.length) {
    const noResults = new Option('Nessun articolo trovato', '');
    noResults.disabled = true;
    select.add(noResults);
    return;
  }
  select.value = matches.some((option) => option.value === selectedValue) ? selectedValue : matches[0].value;
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
  const confezione = val('pf-cfz');
  const unita_misura_confezione = val('pf-cfz-um');
  if (!art) return showToast('Seleziona un articolo', 'err');
  if (!qty || qty <= 0) return showToast('Inserisci la quantità', 'err');
  if (confezione === '' || Number(confezione) < 0) return showToast('Inserisci una confezione valida', 'err');
  const labelOptions = {
    foodContactSymbol: document.getElementById('pf-food-contact-symbol').checked,
    foodContact20Pap: document.getElementById('pf-food-contact-20-pap').checked,
    foodContact21Pap: document.getElementById('pf-food-contact-21-pap').checked,
    foodContact22Pap: document.getElementById('pf-food-contact-22-pap').checked,
    foodContact81: document.getElementById('pf-food-contact-81').checked,
    foodContact4Ldpe: document.getElementById('pf-food-contact-4-ldpe').checked,
    foodContactText: document.getElementById('pf-food-contact-text').checked,
    foodContactMunicipality: document.getElementById('pf-food-contact-municipality').checked,
  };
  loading(true, 'Avvio produzione…');
  try {
    const r = await api('/lotti-pf', { method: 'POST', body: {
      articolo_id: art, quantita: qty, unita_misura: um,
      confezione, unita_misura_confezione, data_produzione: val('pf-data'),
      consumi_mp: pfConsumiMP.map((c) => ({ lotto_mp_id: c.lotto_mp_id, quantita: c.quantita, unita_misura: c.um })),
      consumi_sm: pfConsumiSM.map((c) => ({ lotto_sm_id: c.lotto_sm_id, quantita: c.quantita, unita_misura: c.um })),
      label_options: labelOptions,
    }});
    generateEtichetta(r, r.data_produzione, '#label-pf', 'PF', labelOptions);
    showToast(`Ordine PF avviato! Lotto ${r.codice_lotto}`);
    document.getElementById('pf-qty').value = 0;
    document.getElementById('pf-cfz').value = 0;
    loadPF();
  } catch (e) { showToast(e.message, 'err'); }
  finally { loading(false); }
}

const MAG_STATE = { tipo: 'mp', rows: [] };

function applyMagFilter() {
  const q = (document.getElementById('mag-search')?.value || '').trim().toLowerCase();
  const rows = MAG_STATE.rows.filter((r) => {
    if (!q) return true;
    const haystack = [r.codice, r.desc, r.stato, r.um].join(' ').toLowerCase();
    return haystack.includes(q);
  });
  renderMagRows(MAG_STATE.tipo, rows);
}

function renderMagRows(tipo, rows) {
  document.getElementById('mag-body').innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td class="mono">${esc(r.codice)}</td>
        <td>${esc(r.desc || '')}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <input class="fi" type="number" min="0" value="${Number(r.giacenza) || 0}" style="width:92px;text-align:right;" data-mag-id="${esc(r.id)}" data-mag-tipo="${esc(tipo)}">
            <span>${esc(r.um)}</span>
          </div>
        </td>
        <td>${statoPill(r.stato)}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${entityInfoButton(tipo.toUpperCase(), r.codice)}
            <button class="btn btn-verde" style="padding:6px 10px;font-size:12px;" onclick="salvaMagazzino('${esc(tipo)}','${esc(r.id)}', this.closest('tr'))"><i class="ti ti-device-floppy"></i></button>
            <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="eliminaMagazzino('${esc(tipo)}','${esc(r.id)}')"><i class="ti ti-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5"><div class="empty"><i class="ti ti-package"></i><p>Magazzino vuoto</p></div></td></tr>';
}

function magTab(t, btn) {
  document.querySelectorAll('#page-mag .tab-btn').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  loadMag(t);
}

async function loadMag(tipo) {
  try {
    MAG_STATE.tipo = tipo;
    MAG_STATE.rows = await api('/magazzino/' + tipo);
    MAG_STATE.rows.forEach((lotto) => cacheEntityInfo(tipo.toUpperCase(), lotto.codice, null, true));
    applyMagFilter();
  } catch (e) { showToast(e.message, 'err'); }
}

async function eliminaLottoStorico(tipo, id, button) {
  const codice = button.closest('tr')?.querySelector('.mono')?.textContent || 'selezionato';
  if (!confirm(`Eliminare definitivamente il lotto "${codice}"? Questa operazione non può essere annullata.`)) return;
  try {
    await api(`/lotti-${tipo}/${id}/record`, { method: 'DELETE' });
    showToast('Lotto eliminato');
    const tbody = button.closest('tr')?.parentElement;
    button.closest('tr')?.remove();
    if (tbody && !tbody.querySelector('tr')) {
      const emptyRows = {
        mp: '<tr><td colspan="7"><div class="empty"><p>Nessun ricevimento</p></div></td></tr>',
        sm: '<tr><td colspan="6"><div class="empty"><p>Nessuna lavorazione</p></div></td></tr>',
        pf: '<tr><td colspan="5"><div class="empty"><p>Nessun ordine</p></div></td></tr>',
      };
      tbody.innerHTML = emptyRows[tipo];
    }
  } catch (e) { showToast(e.message, 'err'); }
}

async function salvaMagazzino(tipo, id, rowEl) {
  const input = rowEl?.querySelector('input[data-mag-id]');
  if (!input) return showToast('Riga non trovata', 'err');
  const giacenza = Number(input.value);
  if (!Number.isFinite(giacenza) || giacenza < 0) return showToast('Quantità non valida', 'err');
  try {
    await api('/lotti-' + tipo + '/' + id, {
      method: 'PATCH',
      body: { giacenza, quantita: giacenza }
    });
    showToast('Giacenza aggiornata');
    await loadMag(tipo);
  } catch (e) { showToast(e.message, 'err'); }
}

async function eliminaMagazzino(tipo, id) {
  if (!confirm('Eliminare questo lotto dal magazzino?')) return;
  try {
    await api('/lotti-' + tipo + '/' + id, { method: 'DELETE' });
    showToast('Lotto eliminato');
    await loadMag(tipo);
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
    storico.forEach((spedizione) => cacheEntityInfo(
      'DDT',
      spedizione.ddt_numero,
      entityInfoFromRecord('DDT', spedizione),
      true
    ));
    document.getElementById('sped-storico').innerHTML = storico.map((s) =>
      `<tr><td class="mono">${esc(s.ddt_numero)}</td><td>${esc(s.cliente)}</td><td>${s.data_spedizione ? new Date(s.data_spedizione).toLocaleDateString('it-IT') : '—'}</td><td>${statoPill(s.stato)}</td><td>${entityInfoButton('DDT', s.ddt_numero)}</td></tr>`
    ).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessuna spedizione</p></div></td></tr>';
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
  const nextCode = getNextMaterialCodeNumber(materiali, 'MP');
  input.value = nextCode;
  input.dataset.suggestedCode = nextCode;
}
// function updateMaterialCodeSuggestion() {
//   suggestNextMaterialCode(materialiAnagrafica);
// }
function suggestNextArticleCode(articoli) {
  const input = document.getElementById('aa-cod-num');
  if (!input || input.value.trim() && input.value !== input.dataset.suggestedCode) return;
  const usedCodes = articoli
    .map((articolo) => Number.parseInt(articolo.codice_numerico, 10))
    .filter((codice) => Number.isInteger(codice) && codice >= 0);
  const nextCode = (usedCodes.length ? Math.max(...usedCodes) + 1 : 1).toString().padStart(7, '0');
  input.value = nextCode;
  input.dataset.suggestedCode = nextCode;
}
function anaActions(editFn, deleteFn, id, current, label) {
  const safeId = String(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeLabel = String(label ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeCurrent = JSON.stringify(current).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
    <button class="act-btn" type="button" onclick='window.${editFn}("${safeId}", ${safeCurrent});'><i class="ti ti-pencil"></i></button>
    <button class="act-btn danger" type="button" onclick='window.${deleteFn}("${safeId}", "${safeLabel}");'><i class="ti ti-trash"></i></button>
  </div>`;
}

let anaEditResolve = null;
let anaEditReturnFocus = null;
function openAnaEditModal(title, fields) {
  const modal = document.getElementById('ana-edit-modal');
  const form = document.getElementById('ana-edit-form');
  const container = document.getElementById('ana-edit-fields');
  document.getElementById('ana-edit-title').textContent = title;
  container.replaceChildren();

  fields.forEach((field) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'fr';
    const label = document.createElement('label');
    label.className = 'fl';
    label.htmlFor = `ana-edit-${field.key}`;
    label.textContent = field.label;
    const control = field.options ? document.createElement('select') : document.createElement('input');
    control.className = 'fi';
    control.id = `ana-edit-${field.key}`;
    control.name = field.key;
    if (field.options) {
      field.options.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        control.appendChild(optionElement);
      });
    } else {
      control.type = field.type || 'text';
      if (field.type === 'number') control.step = 'any';
      if (field.type === 'email') control.autocomplete = 'email';
    }
    control.value = String(field.value ?? '');
    control.required = Boolean(field.required);
    wrapper.append(label, control);
    container.appendChild(wrapper);
  });

  anaEditReturnFocus = document.activeElement;
  modal.classList.add('show');
  container.querySelector('input, select')?.focus();

  return new Promise((resolve) => {
    anaEditResolve = resolve;
    form.onsubmit = (event) => {
      event.preventDefault();
      const values = Object.fromEntries(fields.map((field) => {
        const control = form.elements.namedItem(field.key);
        return [field.key, field.type === 'number' ? Number(control.value) : control.value.trim()];
      }));
      closeAnaEditModal(values);
    };
  });
}

function closeAnaEditModal(values = null) {
  const modal = document.getElementById('ana-edit-modal');
  if (!modal.classList.contains('show')) return;
  modal.classList.remove('show');
  const resolve = anaEditResolve;
  anaEditResolve = null;
  if (anaEditReturnFocus?.isConnected) anaEditReturnFocus.focus();
  anaEditReturnFocus = null;
  if (resolve) resolve(values);
}

async function editFornitore(id, current) {
  const values = await openAnaEditModal('Modifica fornitore', [
    { key: 'ragione_sociale', label: 'Ragione sociale', value: current.ragione_sociale, required: true },
    { key: 'piva', label: 'P.IVA', value: current.piva },
    { key: 'stato', label: 'Stato', value: current.stato || 'Attivo', options: ['Attivo', 'Sospeso'] },
  ]);
  if (!values) return;
  try {
    await api(`/fornitori/${id}`, { method: 'PATCH', body: {
      ragione_sociale: values.ragione_sociale,
      piva: values.piva,
      stato: values.stato || 'Attivo'
    } });
    showToast('Fornitore aggiornato');
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

async function delFornitore(id, ragione_sociale) {
  if (!confirm(`Eliminare il fornitore "${ragione_sociale}"?`)) return;
  try { await api(`/fornitori/${id}`, { method: 'DELETE' }); showToast('Fornitore eliminato'); loadAna(); }
  catch (e) { showToast(e.message, 'err'); }
}

async function editCliente(id, current) {
  const values = await openAnaEditModal('Modifica cliente', [
    { key: 'ragione_sociale', label: 'Ragione sociale', value: current.ragione_sociale, required: true },
    { key: 'partita_iva', label: 'P.IVA', value: current.partita_iva },
    { key: 'email', label: 'Email', value: current.email, type: 'email' },
    { key: 'telefono', label: 'Telefono', value: current.telefono, type: 'tel' },
    { key: 'stato', label: 'Stato', value: current.stato || 'Attivo', options: ['Attivo', 'Sospeso'] },
  ]);
  if (!values) return;
  try {
    await api(`/clienti/${id}`, { method: 'PATCH', body: {
      ragione_sociale: values.ragione_sociale,
      partita_iva: values.partita_iva,
      email: values.email,
      telefono: values.telefono,
      stato: values.stato || 'Attivo'
    } });
    showToast('Cliente aggiornato');
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

async function delCliente(id, ragione_sociale) {
  if (!confirm(`Eliminare il cliente "${ragione_sociale}"?`)) return;
  try { await api(`/clienti/${id}`, { method: 'DELETE' }); showToast('Cliente eliminato'); loadAna(); }
  catch (e) { showToast(e.message, 'err'); }
}

async function editMateriale(id, current) {
  const values = await openAnaEditModal('Modifica materiale', [
    { key: 'codice', label: 'Codice', value: current.codice, required: true },
    { key: 'codice_numerico', label: 'Codice numerico (7 cifre)', value: current.codice_numerico, required: true },
    { key: 'descrizione', label: 'Descrizione', value: current.descrizione, required: true },
    { key: 'tipo', label: 'Tipo', value: current.tipo || 'MP', options: ['MP', 'SM'] },
    { key: 'unita_misura', label: 'Unità di misura', value: current.unita_misura || 'kg' },
    { key: 'soglia_minima', label: 'Soglia minima', value: current.soglia_minima ?? 0, type: 'number' },
  ]);
  if (!values) return;
  try {
    await api(`/materiali/${id}`, { method: 'PATCH', body: {
      codice: values.codice,
      codice_numerico: values.codice_numerico,
      descrizione: values.descrizione,
      tipo: values.tipo.toUpperCase(),
      unita_misura: values.unita_misura,
      soglia_minima: values.soglia_minima
    } });
    showToast('Materiale aggiornato');
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

async function delMateriale(id, codice) {
  if (!confirm(`Eliminare il materiale "${codice}"?`)) return;
  try { await api(`/materiali/${id}`, { method: 'DELETE' }); showToast('Materiale eliminato'); loadAna(); }
  catch (e) {
    msg = e.message || '';
    if (msg.includes('foreign key constraint')) msg = 'Impossibile eliminare il materiale perché è collegato a lotti o ordini.'; 
    showToast(msg, 'err'); }
}

async function editArticolo(id, current) {
  const values = await openAnaEditModal('Modifica articolo', [
    { key: 'codice', label: 'Codice articolo', value: current.codice, required: true },
    { key: 'codice_numerico', label: 'Codice numerico (7 cifre)', value: current.codice_numerico, required: true },
    { key: 'descrizione', label: 'Descrizione', value: current.descrizione, required: true },
    { key: 'stato', label: 'Stato', value: current.stato || 'Attivo', options: ['Attivo', 'Bozza'] },
  ]);
  if (!values) return;
  try {
    await api(`/articoli/${id}`, { method: 'PATCH', body: {
      codice: values.codice,
      codice_numerico: values.codice_numerico,
      descrizione: values.descrizione,
      stato: values.stato || 'Attivo'
    } });
    showToast('Articolo aggiornato');
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

async function delArticolo(id, codice) {
  if (!confirm(`Eliminare l'articolo "${codice}"?`)) return;
  try { await api(`/articoli/${id}`, { method: 'DELETE' }); showToast('Articolo eliminato'); loadAna(); }
  catch (e) { 
    msg = e.message || '';
    if (msg.includes('foreign key constraint')) msg = 'Impossibile eliminare l\'articolo perché è collegato a lotti o ordini.';
    showToast(msg, 'err'); }
}

async function loadAna() {
  try {
    const [forn, clienti, mat, art, tipologie] = await Promise.all([api('/fornitori'), api('/clienti'), api('/materiali'), api('/articoli'), api('/tipologie')]);
    materialiAnagrafica = mat;
    articoliAnagrafica = art;
    suggestNextMaterialCode(materialiAnagrafica);
    suggestNextArticleCode(articoliAnagrafica);
    document.getElementById('ana-f-body').innerHTML = forn.map((f) =>
      `<tr><td>${esc(f.ragione_sociale)}</td><td class="mono">${esc(f.piva || '—')}</td><td>${statoPill(f.stato)}</td><td>${anaActions('editFornitore', 'delFornitore', f.id, f, f.ragione_sociale)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty"><p>Nessun fornitore</p></div></td></tr>';
    document.getElementById('ana-c-body').innerHTML = clienti.map((c) =>
      `<tr><td>${esc(c.ragione_sociale)}</td><td class="mono">${esc(c.partita_iva || '—')}</td><td class="mono">${esc(c.email || '—')}</td><td>${statoPill(c.stato)}</td><td>${anaActions('editCliente', 'delCliente', c.id, c, c.ragione_sociale)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun cliente</p></div></td></tr>';
    document.getElementById('ana-m-body').innerHTML = mat.map((m) =>
      `<tr><td class="mono">${esc(m.codice)}</td><td class="mono">${esc(m.codice_numerico)}</td><td>${esc(m.descrizione)}</td><td>${pill(m.tipo, m.tipo === 'MP' ? 'pill-verde' : 'pill-viola')}</td><td>${esc(m.unita_misura)}</td><td>${anaActions('editMateriale', 'delMateriale', m.id, m, m.codice)}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty"><p>Nessun materiale</p></div></td></tr>';
    document.getElementById('ana-a-body').innerHTML = art.map((a) =>
      `<tr><td class="mono">${esc(a.codice)}</td><td class="mono">${esc(a.codice_numerico)}</td><td>${esc(a.descrizione)}</td><td>${statoPill(a.stato)}</td><td>${anaActions('editArticolo', 'delArticolo', a.id, a, a.codice)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><p>Nessun articolo</p></div></td></tr>';
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
  if (!/^[A-Za-z0-9/\\]+$/.test(codice)) return showToast('Il codice deve contenere solo caratteri alfanumerici', 'err');
  if (!/^[0-9]{7}$/.test(codice_numerico)) return showToast('Il codice numerico deve contenere 7 cifre', 'err');
  try {
    await api('/materiali', { method: 'POST', body: { codice, codice_numerico, descrizione, tipo: "MP", unita_misura: "kg", soglia_minima: 0 } });
    showToast('Materiale aggiunto');
    ['am-cod', 'am-cod-num', 'am-desc'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}
async function addArticolo(btn) {
  const codice = val('aa-cod').trim(), codice_numerico = val('aa-cod-num').trim(), descrizione = val('aa-desc');
  if (!codice || !descrizione) return showToast('Codice e descrizione obbligatori', 'err');
  if (!/^[A-Za-z0-9]+$/.test(codice)) return showToast('Il codice deve contenere solo caratteri alfanumerici', 'err');
  if (!/^[0-9]{7}$/.test(codice_numerico)) return showToast('Il codice numerico deve contenere 7 cifre', 'err');
  try {
    await api('/articoli', { method: 'POST', body: { codice, codice_numerico, descrizione, stato: 'Attivo' } });
    showToast('Articolo aggiunto');
    ['aa-cod', 'aa-cod-num', 'aa-desc'].forEach((id) => (document.getElementById(id).value = ''));
    loadAna();
  } catch (e) { showToast(e.message, 'err'); }
}

// ============================================================
// Tracciabilità
// ============================================================
function traceInfoButton(tipo, codice) {
  const index = TRACE_INFO_INDEX.get(`${tipo}:${codice}`);
  if (index === undefined) return '';
  return `<button class="btn btn-sm trace-info-btn" type="button" aria-label="Informazioni ${esc(tipo)} ${esc(codice)}" title="Mostra informazioni" onclick="showTraceInfo(${index},this)"><i class="ti ti-info-circle"></i></button>`;
}

function entityInfoButton(tipo, codice) {
  return `<button class="btn btn-sm trace-info-btn" type="button" aria-label="Informazioni ${esc(tipo)} ${esc(codice)}" title="Mostra informazioni" onclick="showStoredEntityInfo('${esc(tipo)}','${esc(codice)}',this)"><i class="ti ti-info-circle"></i></button>`;
}

function entityInfoFromRecord(tipo, record) {
  if (tipo === 'MP') {
    return {
      'Codice materiale': record.materiali?.codice,
      Materiale: record.materiali?.descrizione,
      Fornitore: record.fornitori?.ragione_sociale,
      'DDT fornitore': record.ddt_numero,
      'Data DDT': record.ddt_data,
      Quantità: record.quantita,
      'Unità di misura': record.unita_misura,
      Giacenza: record.giacenza,
      Pedane: record.n_pedane,
      Stato: record.stato,
      Note: record.note,
      'Creato il': record.creato_il,
    };
  }
  if (tipo === 'SM') {
    return {
      'Codice materiale': record.materiali?.codice,
      'Tipo semilavorato': record.materiali?.descrizione,
      Lavorazione: record.lavorazione,
      Fornitore: record.fornitori?.ragione_sociale,
      'DDT fornitore': record.ddt_numero,
      'Data DDT': record.ddt_data,
      Quantità: record.quantita,
      'Unità di misura': record.unita_misura,
      Giacenza: record.giacenza,
      'Data lavorazione': record.data_lavorazione,
      Stato: record.stato,
      Note: record.note,
      'Creato il': record.creato_il,
    };
  }
  if (tipo === 'PF') {
    return {
      Articolo: record.articoli_pf?.descrizione,
      'Codice articolo': record.articoli_pf?.codice,
      Quantità: record.quantita,
      'Unità di misura': record.unita_misura,
      Confezione: record.confezione,
      'Unità di misura confezione': record.unita_misura_confezione,
      Giacenza: record.giacenza,
      'Data produzione': record.data_produzione,
      Stato: record.stato,
      Note: record.note,
      'Creato il': record.creato_il,
    };
  }
  return {
    Cliente: record.cliente,
    'Data spedizione': record.data_spedizione,
    Vettore: record.vettore,
    Stato: record.stato,
    Note: record.note,
    'Creato il': record.creato_il,
  };
}

function cacheEntityInfo(tipo, codice, dettagli, fetchOnClick = false) {
  ENTITY_INFO_CACHE.set(`${tipo}:${codice}`, { dettagli, fetchOnClick });
}

function renderEntityInfo(tipo, codice, dettagli, trigger) {
  const modal = document.getElementById('trace-info-modal');
  const content = document.getElementById('trace-info-content');
  document.getElementById('trace-info-title').textContent = `${tipo} · ${codice}`;
  content.replaceChildren();

  Object.entries(dettagli || {}).forEach(([label, value]) => {
    if (value === null || value === undefined || value === '') return;
    const row = document.createElement('div');
    row.className = 'trace-info-row';
    const name = document.createElement('dt');
    name.textContent = label;
    const detail = document.createElement('dd');
    if (['Quantità', 'Giacenza', 'Pedane'].includes(label) && Number.isFinite(Number(value))) {
      detail.textContent = Number(value).toLocaleString('it-IT');
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
      const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
      detail.textContent = Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString('it-IT', value.length === 10 ? { dateStyle: 'short' } : {});
    } else {
      detail.textContent = String(value);
    }
    row.append(name, detail);
    content.appendChild(row);
  });

  if (!content.children.length) {
    const empty = document.createElement('p');
    empty.className = 'trace-info-empty';
    empty.textContent = 'Non sono disponibili altre informazioni.';
    content.appendChild(empty);
  }

  modal.classList.add('show');
  modal.querySelector('.trace-info-close').focus();
  modal._returnFocus = trigger;
}

function showTraceInfo(index, trigger) {
  const node = TRACE_INFO_NODES[index];
  if (!node) return showToast('Informazioni entità non disponibili', 'err');
  renderEntityInfo(node.tipo, node.codice, node.dettagli, trigger);
}

async function showStoredEntityInfo(tipo, codice, trigger) {
  const key = `${tipo}:${codice}`;
  let cached = ENTITY_INFO_CACHE.get(key);
  if (!cached || cached.fetchOnClick) {
    renderEntityInfo(tipo, codice, { Caricamento: 'Recupero informazioni…' }, trigger);
    try {
      const result = await api(`/info/${encodeURIComponent(tipo)}/${encodeURIComponent(codice)}`);
      cached = { dettagli: result.dettagli, fetchOnClick: false };
      ENTITY_INFO_CACHE.set(key, cached);
    } catch (e) {
      renderEntityInfo(tipo, codice, { Errore: e.message }, trigger);
      showToast(e.message, 'err');
      return;
    }
  }
  renderEntityInfo(tipo, codice, cached.dettagli, trigger);
}

function closeTraceInfo() {
  const modal = document.getElementById('trace-info-modal');
  if (!modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (modal._returnFocus?.isConnected) modal._returnFocus.focus();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAnaEditModal();
    closeTraceInfo();
  }
});

function setTraceView(view, button) {
  const tableView = view === 'table';
  document.getElementById('trace-table-view').style.display = tableView ? 'block' : 'none';
  document.getElementById('trace-graph-view').style.display = tableView ? 'none' : 'block';
  document.querySelectorAll('.trace-view-switch button').forEach((toggle) => {
    const selected = toggle === button;
    toggle.classList.toggle('on', selected);
    toggle.setAttribute('aria-pressed', String(selected));
  });
}

function renderTraceGraph(trace, rootCode) {
  const container = document.getElementById('trace-graph');
  container.replaceChildren();

  const nodes = new Map((trace.nodi || []).map((node) => [`${node.tipo}:${node.codice}`, node]));
  const edges = (trace.passaggi || []).map((passaggio) => {
    const componente = passaggio.a.tipo === 'DDT' ? passaggio.da : passaggio.a;
    const prodotto = passaggio.a.tipo === 'DDT' ? passaggio.a : passaggio.da;
    const from = `${componente.tipo}:${componente.codice}`;
    const to = `${prodotto.tipo}:${prodotto.codice}`;
    if (!nodes.has(from)) nodes.set(from, componente);
    if (!nodes.has(to)) nodes.set(to, prodotto);
    return { from, to, quantita: passaggio.quantita, unita_misura: passaggio.unita_misura };
  });

  const nodeList = [...nodes.values()];
  const ranks = new Map(nodeList.map((node) => [`${node.tipo}:${node.codice}`, 0]));
  for (let pass = 0; pass < nodeList.length; pass += 1) {
    let changed = false;
    edges.forEach((edge) => {
      const nextRank = ranks.get(edge.from) + 1;
      if (ranks.get(edge.to) < nextRank) {
        ranks.set(edge.to, nextRank);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const typeOrder = { MP: 0, SM: 1, PF: 2, DDT: 3 };
  const layers = new Map();
  nodeList.forEach((node) => {
    const rank = ranks.get(`${node.tipo}:${node.codice}`);
    if (!layers.has(rank)) layers.set(rank, []);
    layers.get(rank).push(node);
  });

  const nodeWidth = 232;
  const nodeHeight = 82;
  const layerGap = 92;
  const rowGap = 38;
  const orderedLayers = [...layers.entries()].sort(([a], [b]) => a - b);
  let maxRows = 1;
  orderedLayers.forEach(([, layerNodes]) => {
    layerNodes.sort((a, b) => (typeOrder[a.tipo] ?? 9) - (typeOrder[b.tipo] ?? 9) || a.codice.localeCompare(b.codice));
    maxRows = Math.max(maxRows, layerNodes.length);
  });
  const maxRank = Math.max(0, ...ranks.values());
  const width = Math.max(700, (maxRank + 1) * (nodeWidth + layerGap) + 24);
  const height = Math.max(220, maxRows * (nodeHeight + rowGap) + 36);
  const positions = new Map();
  orderedLayers.forEach(([rank, layerNodes]) => {
    layerNodes.forEach((node, index) => {
      positions.set(`${node.tipo}:${node.codice}`, {
        x: 20 + rank * (nodeWidth + layerGap),
        y: 18 + index * (nodeHeight + rowGap),
      });
    });
  });

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Grafo della catena di tracciabilità per ${rootCode}`);
  const title = document.createElementNS(ns, 'title');
  title.textContent = `Catena di tracciabilità · ${rootCode}`;
  svg.appendChild(title);

  const defs = document.createElementNS(ns, 'defs');
  const marker = document.createElementNS(ns, 'marker');
  marker.setAttribute('id', 'trace-arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS(ns, 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', '#8b8791');
  marker.appendChild(arrow);
  defs.appendChild(marker);
  svg.appendChild(defs);

  edges.forEach((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return;
    const x1 = from.x + nodeWidth;
    const y1 = from.y + nodeHeight / 2;
    const x2 = to.x;
    const y2 = to.y + nodeHeight / 2;
    const middle = (x1 + x2) / 2;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#aaa6ad');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('marker-end', 'url(#trace-arrow)');
    svg.appendChild(path);

    const label = `${fmt(edge.quantita)} ${edge.unita_misura || ''}`.trim();
    const labelText = document.createElementNS(ns, 'text');
    labelText.setAttribute('x', middle);
    labelText.setAttribute('y', (y1 + y2) / 2 - 7);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('class', 'trace-edge-label');
    labelText.textContent = label;
    svg.appendChild(labelText);
  });

  const colors = {
    MP: ['#eef4e0', '#584a99'],
    SM: ['#f0eefb', '#6b5bb5'],
    PF: ['#faeeda', '#633806'],
    DDT: ['#fcebeb', '#791f1f'],
  };
  nodeList.forEach((node) => {
    const key = `${node.tipo}:${node.codice}`;
    const position = positions.get(key);
    const [fill, color] = colors[node.tipo] || ['#f7f6f2', '#5f5e5a'];
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', `trace-node${node.codice === rootCode ? ' trace-node-root' : ''}`);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', position.x);
    rect.setAttribute('y', position.y);
    rect.setAttribute('width', nodeWidth);
    rect.setAttribute('height', nodeHeight);
    rect.setAttribute('rx', '10');
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', color);
    group.appendChild(rect);

    const typeLabel = document.createElementNS(ns, 'text');
    typeLabel.setAttribute('x', position.x + 12);
    typeLabel.setAttribute('y', position.y + 21);
    typeLabel.setAttribute('class', 'trace-node-type');
    typeLabel.setAttribute('fill', color);
    typeLabel.textContent = node.tipo;
    group.appendChild(typeLabel);

    const codeLabel = document.createElementNS(ns, 'text');
    codeLabel.setAttribute('x', position.x + 12);
    codeLabel.setAttribute('y', position.y + 43);
    codeLabel.setAttribute('class', 'trace-node-code');
    codeLabel.textContent = node.codice;
    group.appendChild(codeLabel);

    const description = node.descrizione || node.meta?.fornitore || node.meta?.lavorazione || '';
    if (description) {
      const descriptionLabel = document.createElementNS(ns, 'text');
      descriptionLabel.setAttribute('x', position.x + 12);
      descriptionLabel.setAttribute('y', position.y + 64);
      descriptionLabel.setAttribute('class', 'trace-node-description');
      descriptionLabel.textContent = description.length > 30 ? `${description.slice(0, 27)}…` : description;
      group.appendChild(descriptionLabel);
    }

    const nodeTitle = document.createElementNS(ns, 'title');
    nodeTitle.textContent = [node.tipo, node.codice, description].filter(Boolean).join(' · ');
    group.appendChild(nodeTitle);

    const info = document.createElementNS(ns, 'g');
    info.setAttribute('class', 'trace-node-info');
    info.setAttribute('role', 'button');
    info.setAttribute('tabindex', '0');
    info.setAttribute('aria-label', `Informazioni ${node.tipo} ${node.codice}`);
    const infoCircle = document.createElementNS(ns, 'circle');
    infoCircle.setAttribute('cx', position.x + nodeWidth - 19);
    infoCircle.setAttribute('cy', position.y + 19);
    infoCircle.setAttribute('r', '11');
    info.appendChild(infoCircle);
    const infoText = document.createElementNS(ns, 'text');
    infoText.setAttribute('x', position.x + nodeWidth - 19);
    infoText.setAttribute('y', position.y + 23);
    infoText.textContent = 'i';
    info.appendChild(infoText);
    const nodeIndex = TRACE_INFO_INDEX.get(key);
    info.addEventListener('click', () => showTraceInfo(nodeIndex, info));
    info.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showTraceInfo(nodeIndex, info);
      }
    });
    group.appendChild(info);
    svg.appendChild(group);
  });

  if (!nodeList.length) {
    const empty = document.createElement('p');
    empty.className = 'trace-graph-empty';
    empty.textContent = 'Nessun elemento disponibile per il grafo.';
    container.appendChild(empty);
    return;
  }
  container.appendChild(svg);
}

async function doTrace() {
  const v = val('trace-in').trim();
  if (!v) return showToast('Inserisci un codice lotto', 'err');
  loading(true, 'Ricostruzione catena…');
  try {
    const c = await api('/traccia/' + encodeURIComponent(v));
    TRACE_INFO_NODES = c.nodi || [];
    TRACE_INFO_INDEX = new Map(TRACE_INFO_NODES.map((node, index) => [`${node.tipo}:${node.codice}`, index]));
    document.getElementById('trace-title').textContent = v;
    document.getElementById('trace-chain').innerHTML = c.passaggi.map((r) =>
      `<tr><td><span class="pill ${r.da.tipo === 'MP' ? 'pill-verde' : r.da.tipo === 'SM' ? 'pill-viola' : 'pill-grigio'}">${esc(r.da.tipo)}</span> <span class="mono">${esc(r.da.codice)}</span> ${traceInfoButton(r.da.tipo, r.da.codice)}${r.da.descrizione ? `<div style="font-size:11px;color:var(--grigio);">${esc(r.da.descrizione)}</div>` : ''}</td><td><span class="pill ${r.a.tipo === 'PF' ? 'pill-grigio' : 'pill-viola'}">${esc(r.a.tipo)}</span> <span class="mono">${esc(r.a.codice)}</span> ${traceInfoButton(r.a.tipo, r.a.codice)}${r.a.descrizione ? `<div style="font-size:11px;color:var(--grigio);">${esc(r.a.descrizione)}</div>` : ''}</td><td>${fmt(r.quantita)} ${esc(r.unita_misura || '')}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="color:#bbb;">Nessun collegamento trovato per questo lotto.</td></tr>';

    document.getElementById('trace-mp').innerHTML = c.mp.map((r) => `<tr><td class="mono">${esc(r.codice)} ${traceInfoButton('MP', r.codice)}</td><td>${esc(r.materiale || '')}</td><td>${esc(r.fornitore || '')}</td></tr>`).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';
    document.getElementById('trace-sm').innerHTML = c.sm.map((r) => `<tr><td class="mono">${esc(r.codice)} ${traceInfoButton('SM', r.codice)}</td><td>${esc(r.tipo || '')}</td><td>${pill(r.lav === 'esterna' ? 'Est.' : 'Int.', 'pill-grigio')}</td></tr>`).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';
    document.getElementById('trace-pf').innerHTML = c.pf.map((r) => {
      const destinazioni = c.passaggi.filter((passaggio) => passaggio.da.tipo === 'PF'
        && passaggio.da.codice === r.codice && passaggio.a.tipo === 'DDT');
      if (!destinazioni.length) return `<tr><td class="mono">${esc(r.codice)} ${traceInfoButton('PF', r.codice)}</td><td class="mono">—</td><td>—</td></tr>`;
      return destinazioni.map((passaggio) =>
        `<tr><td class="mono">${esc(r.codice)} ${traceInfoButton('PF', r.codice)}</td><td class="mono">${esc(passaggio.a.codice)} ${traceInfoButton('DDT', passaggio.a.codice)}</td><td>${esc(passaggio.a.descrizione || '—')}</td></tr>`
      ).join('');
    }).join('') || '<tr><td colspan="3" style="color:#bbb;">—</td></tr>';

    renderTraceGraph(c, v);
    setTraceView('table', document.querySelector('.trace-view-switch button'));
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
