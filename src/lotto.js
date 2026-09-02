const supabase = require('./supabase');

function oggiCompatto(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${g}`;
}

// Conta i lotti già creati oggi con lo stesso prefisso per il progressivo NNN
async function prossimoProgressivo(tabella, prefissoLike) {
  const { data, error } = await supabase
    .from(tabella)
    .select('codice_lotto')
    .like('codice_lotto', prefissoLike + '%');
  if (error) return 1;
  return (data ? data.length : 0) + 1;
}

// LT-AAAAMMGG-MAT-NNN
async function generaLottoMP(codiceMateriale, data) {
  const dt = oggiCompatto(data ? new Date(data) : new Date());
  const mat = (codiceMateriale || 'GEN').toUpperCase();
  const prefix = `LT-${dt}-${mat}-`;
  const n = await prossimoProgressivo('lotti_mp', prefix);
  return `${prefix}${String(n).padStart(3, '0')}`;
}

// SM-AAAAMMGG-TIPO-NNN
async function generaLottoSM(sigla, data) {
  const dt = oggiCompatto(data ? new Date(data) : new Date());
  const sg = (sigla || 'SM').toUpperCase().slice(0, 4);
  const prefix = `SM-${dt}-${sg}-`;
  const n = await prossimoProgressivo('lotti_sm', prefix);
  return `${prefix}${String(n).padStart(3, '0')}`;
}

// PF-AAAAMMGG-ART-NNN
async function generaLottoPF(codiceArticolo, data) {
  const dt = oggiCompatto(data ? new Date(data) : new Date());
  const art = (codiceArticolo || 'PF').toUpperCase().replace('-', '');
  const prefix = `PF-${dt}-${art}-`;
  const n = await prossimoProgressivo('lotti_pf', prefix);
  return `${prefix}${String(n).padStart(3, '0')}`;
}

// DDT-AAAA-NNNN progressivo annuale
async function generaDDT(data) {
  const anno = (data ? new Date(data) : new Date()).getFullYear();
  const prefix = `DDT-${anno}-`;
  const { data: rows } = await supabase
    .from('spedizioni')
    .select('ddt_numero')
    .like('ddt_numero', prefix + '%');
  const n = (rows ? rows.length : 0) + 86; // continua dalla numerazione demo
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

module.exports = { generaLottoMP, generaLottoSM, generaLottoPF, generaDDT, oggiCompatto };
