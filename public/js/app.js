// ── TOAST ─────────────────────────────────────────────────────────────────
let _toastTimer
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast')
  if (!el) return
  el.className = `show t-${type}`
  el.innerHTML = `<i class="ti ti-${type==='ok'?'circle-check':type==='warn'?'alert-triangle':'x'}"></i>${msg}`
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500)
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open') }
function closeModal(id) { document.getElementById(id)?.classList.remove('open') }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open')
})

// ── TABS ──────────────────────────────────────────────────────────────────
function switchTab(group, key) {
  document.querySelectorAll(`[data-tab-group="${group}"]`).forEach(el => {
    el.classList.toggle('on', el.dataset.tab === key)
  })
  document.querySelectorAll(`[data-tab-panel="${group}"]`).forEach(el => {
    el.style.display = el.dataset.panel === key ? '' : 'none'
  })
}

// ── TIPO LAVORAZIONE SM ───────────────────────────────────────────────────
function setSMTipo(t) {
  document.getElementById('sm-int')?.classList.toggle('on', t === 'int')
  document.getElementById('sm-ext')?.classList.toggle('on', t === 'ext')
  const fields = document.getElementById('sm-ext-fields')
  if (fields) fields.style.display = t === 'ext' ? 'block' : 'none'
  const inp = document.getElementById('sm-tipo-val')
  if (inp) inp.value = t
}

// ── AGGIUNGI MODALITÀ SCAN MP ─────────────────────────────────────────────
function setAddMPMode(m) {
  document.getElementById('add-mp-manual')?.style && (document.getElementById('add-mp-manual').style.display = m === 'm' ? '' : 'none')
  document.getElementById('add-mp-scan')?.style   && (document.getElementById('add-mp-scan').style.display   = m === 's' ? '' : 'none')
  document.querySelector('[data-scan="m"]')?.classList.toggle('on', m === 'm')
  document.querySelector('[data-scan="s"]')?.classList.toggle('on', m === 's')
}

// ── LOTTO PREVIEW (aggiorna in tempo reale) ───────────────────────────────
function _ds() {
  const d = new Date()
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0')
}

function updateLottoMP() {
  const mat = document.getElementById('r-mat')?.value || 'MAT'
  const qty = document.getElementById('r-qty')?.value || '0'
  const um  = document.getElementById('r-um')?.value  || 'kg'
  const ddt = document.getElementById('r-ddt')?.value || '—'
  const ped = document.getElementById('r-ped')?.value || '1'
  const el  = document.getElementById('lotto-mp-preview')
  if (el) {
    el.querySelector('.lotto-code').textContent = `LT-${_ds()}-${mat}-NNN`
    el.querySelector('.lotto-meta').textContent = `DDT ${ddt} · ${qty} ${um} · ${ped} pedane`
  }
}

function updateLottoSM() {
  const tipo = document.getElementById('s-tipo')?.value || 'TIPO'
  const qty  = document.getElementById('s-qty')?.value  || '0'
  const um   = document.getElementById('s-um')?.value   || 'pz'
  const el   = document.getElementById('lotto-sm-preview')
  if (el) {
    el.querySelector('.lotto-code').textContent = `SM-${_ds()}-${tipo}-NNN`
    el.querySelector('.lotto-meta').textContent = `${parseInt(qty).toLocaleString('it-IT')} ${um}`
  }
}

function updateLottoPF() {
  const art = document.getElementById('p-art')?.value || 'ART'
  const qty = document.getElementById('p-qty')?.value || '0'
  const el  = document.getElementById('lotto-pf-preview')
  if (el) {
    el.querySelector('.lotto-code').textContent = `PF-${_ds()}-${art}-NNN`
    el.querySelector('.lotto-meta').textContent = `${parseInt(qty).toLocaleString('it-IT')} pz`
  }
}

// ── LOTTI COLLEGATI (righe dinamiche MP/SM) ───────────────────────────────
function addLottoRow(containerId, tipo, codice, descr, unita) {
  const wrap = document.getElementById(containerId)
  if (!wrap) return
  const id = Date.now()
  const cls = tipo === 'MP' ? 'pill-verde' : 'pill-viola'
  const html = `
    <div class="mprow" id="row-${id}">
      <span class="pill ${cls}" style="flex-shrink:0;font-size:10px;">${tipo}</span>
      <div class="mprow-info">
        <div class="mprow-code">${codice}</div>
        <div class="mprow-sub">${descr}</div>
      </div>
      <input type="hidden" name="lotti_${tipo.toLowerCase()}[]" value="${codice}">
      <input type="number" name="qty_${tipo.toLowerCase()}[]" value="0" min="0" class="mprow-qty"/>
      <span style="font-size:12px;color:var(--grigio);flex-shrink:0;">${unita}</span>
      <button type="button" class="rm-btn" onclick="document.getElementById('row-${id}').remove()">×</button>
    </div>`
  wrap.insertAdjacentHTML('beforeend', html)
}

// ── CODICI RICICLO ────────────────────────────────────────────────────────
const RICICLO_LABELS = {
  pap:'PAP 21', ldpe:'LDPE 4', pet:'PET 1', pp:'PP 5',
  alu:'ALU', gl:'GL 70', c6:'C/PAP 6', fe:'FE 40'
}
let selRiciclo = new Set()

function toggleRiciclo(code) {
  const el = document.getElementById('ric-'+code)
  if (!el) return
  selRiciclo.has(code) ? (selRiciclo.delete(code), el.classList.remove('sel'))
                       : (selRiciclo.add(code),    el.classList.add('sel'))
  document.getElementById('riciclo-val').value = [...selRiciclo].join(',')
  aggiornaLabelPF()
}

function aggiornaLabelPF() {
  const hasFork    = document.getElementById('chk-fork')?.checked
  const showIcons  = hasFork || selRiciclo.size > 0
  const iconsArea  = document.getElementById('pf-icons-area')
  const legalArea  = document.getElementById('pf-legal')
  const forkIcon   = document.getElementById('icon-fork-wrap')
  const legalIdon  = document.getElementById('legal-idoneo')
  const preview    = document.getElementById('riciclo-preview')

  if (iconsArea)  iconsArea.style.display  = showIcons ? 'flex' : 'none'
  if (legalArea)  legalArea.style.display  = showIcons ? 'block': 'none'
  if (forkIcon)   forkIcon.style.display   = hasFork   ? 'flex' : 'none'
  if (legalIdon)  legalIdon.style.display  = hasFork   ? 'inline':'none'
  if (preview) {
    preview.innerHTML = [...selRiciclo].map(code => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
          <path d="M15 3L21 13H17.5V19H12.5V13H9Z" fill="#333" opacity=".9"/>
          <path d="M7 19C7 24 10.5 27 15 27C19.5 27 23 24 23 19" fill="none" stroke="#333" stroke-width="1.8"/>
          <path d="M4.5 17L7.5 21L10.5 17" fill="none" stroke="#333" stroke-width="1.8"/>
        </svg>
        <span style="font-size:9px;font-weight:700;font-family:Arial">${RICICLO_LABELS[code]}</span>
      </div>`).join('')
  }
}

// ── RINTRACCIABILITÀ (fetch API) ──────────────────────────────────────────
async function doTrace() {
  const codice = document.getElementById('trace-input')?.value.trim()
  if (!codice) return

  const resEl = document.getElementById('trace-result')
  resEl && (resEl.style.display = 'none')

  try {
    const res  = await fetch(`/api/traccia/${encodeURIComponent(codice)}`)
    const data = await res.json()
    if (!res.ok) { toast(data.error || 'Lotto non trovato', 'err'); return }
    renderTrace(data)
    resEl && (resEl.style.display = 'block')
  } catch(e) {
    toast('Errore di rete', 'err')
  }
}

function renderTrace(data) {
  // catena
  const chain = document.getElementById('trace-chain')
  if (chain) {
    chain.innerHTML = data.catena.map((n, i) =>
      (i > 0 ? '<span class="chain-arrow">→</span>' : '') +
      `<div class="chain-node" style="background:${n.bg};color:${n.tx};border-color:${n.bd}">
        <span style="opacity:.6;font-size:10px;margin-right:4px;">${n.tipo}</span>${n.codice}
      </div>`
    ).join('')
  }
  // MP
  const mp = document.getElementById('trace-mp-body')
  if (mp) mp.innerHTML = data.lotti_mp.length
    ? data.lotti_mp.map(r => `<tr>
        <td class="mono">${r.codice}</td>
        <td class="mono">${r.ddt_numero||'—'}</td>
        <td>${r.materiale_descrizione}</td>
        <td>${r.fornitore||'—'}</td>
        <td>${r.ddt_data||'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#bbb;font-style:italic;padding:12px;">Nessuna MP trovata</td></tr>'
  // SM
  const sm = document.getElementById('trace-sm-body')
  if (sm) sm.innerHTML = data.lotti_sm.length
    ? data.lotti_sm.map(r => `<tr>
        <td class="mono">${r.codice}</td>
        <td class="mono">${r.ddt_numero||'—'}</td>
        <td>${r.tipo_descrizione}</td>
        <td><span class="pill ${r.tipo_lavorazione==='interna'?'pill-grigio':'pill-verde'}">${r.tipo_lavorazione||'—'}</span></td>
        <td>${r.data_lavorazione||'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#bbb;font-style:italic;padding:12px;">Nessun SM trovato</td></tr>'
  // Destinazioni
  const dst = document.getElementById('trace-dst-body')
  if (dst) dst.innerHTML = data.spedizioni.length
    ? data.spedizioni.map(r => `<tr>
        <td class="mono">${r.lotto_pf}</td>
        <td class="mono">${r.ddt_numero}</td>
        <td>${r.cliente}</td>
        <td>${r.data_spedizione||'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#bbb;font-style:italic;padding:12px;">Nessuna destinazione</td></tr>'

  // titolo
  const t = document.getElementById('trace-title')
  if (t) t.textContent = data.codice_cercato
}

// ── FETCH helper ──────────────────────────────────────────────────────────
async function apiPost(url, body) {
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

// ── INLINE "AGGIUNGI" per select con opzione __new__ ─────────────────────
function handleNewOption(selectEl, inlineId) {
  if (selectEl.value === '__new__') {
    selectEl.value = ''
    document.getElementById(inlineId)?.style && (document.getElementById(inlineId).style.display = 'block')
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // active nav
  const path = location.pathname
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path)
  })
  // fade alerts
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => el.style.opacity = '0', 3000)
    setTimeout(() => el.remove(), 3500)
  })
})
