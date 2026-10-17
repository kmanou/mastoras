/* ================================================================== languages
   Two independent languages:
   - UIL: the language of the application (menus, forms, messages) → tr(el, en)
   - DL:  the language of the document being shown or printed      → dt(el, en)
   A Greek interface can issue an English quotation and vice versa. */
let UIL = 'el', DL = 'el';
const LANGS = { el: 'Ελληνικά', en: 'English' };
const tr = (el, en) => (UIL === 'en' && en != null && en !== '') ? en : el;
const dt = (el, en) => (DL === 'en' && en != null && en !== '') ? en : el;
const pick2 = a => Array.isArray(a) ? tr(a[0], a[1]) : a;      // [el, en] pairs for the interface
const dpick2 = a => Array.isArray(a) ? dt(a[0], a[1]) : a;     // [el, en] pairs for documents
const docLang = d => (d && d.lang === 'en') ? 'en' : 'el';
const useDocLang = d => (DL = docLang(d));
function setUiLang(l) { UIL = l === 'en' ? 'en' : 'el'; document.documentElement.lang = UIL; }
function urlLang() { const l = new URLSearchParams(location.search).get('lang'); return l === 'en' || l === 'el' ? l : ''; }

/* months */
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_EN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* document formatting (Greek: 1.234,56 € · 17.10.2026 — English: €1,234.56 · 17 Oct 2026) */
function money(x, sym, lang) {
  x = isFinite(x) ? x : 0;
  if (lang !== 'en') return x.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (sym ? ' €' : '');
  return (x < 0 ? '-' : '') + (sym ? '€' : '') + Math.abs(x).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const deur = (x, sym = true) => money(x, sym, DL);
const ddate = iso => {
  if (DL !== 'en') return fmtDate(iso);
  if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); if (isNaN(d)) return '';
  return d.getDate() + ' ' + MONTHS_EN3[d.getMonth()] + ' ' + d.getFullYear();
};
const dym = k => k ? (DL === 'en' ? MONTHS_EN[+k.slice(5, 7) - 1] : MONTHS[+k.slice(5, 7) - 1]) + ' ' + k.slice(0, 4) : '';
const dpct = v => DL === 'en' ? String(v) : String(v).replace('.', ',');
const dqty = v => DL === 'en' ? String(v) : String(v).replace('.', ',');

/* fixed vocabularies that are stored in Greek and shown translated on English documents */
const UNIT_EN = { 'τεμ.': 'pcs', 'τεμ': 'pcs', 'τεμάχια': 'pcs', 'ώρες': 'hours', 'ώρα': 'hour', 'κατ’ αποκοπή': 'lump sum', "κατ' αποκοπή": 'lump sum', 'μ.': 'm', 'μ': 'm', 'μέτρα': 'm', 'τ.μ.': 'm²', 'μ²': 'm²', 'κιλά': 'kg', 'λίτρα': 'litres', 'σετ': 'set', 'ημέρες': 'days', 'ημέρα': 'day', 'επισκέψεις': 'visits', 'επίσκεψη': 'visit', 'μήνες': 'months', 'μήνας': 'month', 'άτομα': 'persons', 'σημεία': 'points', 'γραμμές': 'lines', 'άδειες': 'licences' };
const dunit = u => DL === 'en' ? (UNIT_EN[String(u || '').trim()] || u) : u;
const DUR_EN = { 'εργάσιμες ημέρες': ['working day', 'working days'], 'ημέρες': ['day', 'days'], 'εβδομάδες': ['week', 'weeks'], 'μήνες': ['month', 'months'] };
const durUnitUI = u => UIL === 'en' ? (DUR_EN[u]?.[1] || u) : u;
const PAYMENTS_EN = ['In full on signing the agreement', 'Per visit, on completion', 'In two equal instalments (on signing and at the 2nd visit)'];
const dpayment = p => { if (DL !== 'en') return p; const i = PAYMENTS.indexOf(p); return i >= 0 ? PAYMENTS_EN[i] : p; };
const PAY_METHODS_EN = { 'Τραπεζική κατάθεση': 'Bank transfer', 'Μετρητά': 'Cash', 'Κάρτα': 'Card', 'Επιταγή': 'Cheque', 'Άλλο': 'Other' };
const payMethodUI = m => UIL === 'en' ? (PAY_METHODS_EN[m] || m) : m;

/* Greek → Latin (ELOT 743, simplified) for names and addresses on English documents when no English text is given */
const TRL = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' };
function translit(s) {
  s = String(s || ''); if (!/[\u0370-\u03ff\u1f00-\u1fff]/.test(s)) return s;
  const plain = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const s0 = i, ch = plain[i], lo = ch.toLowerCase(), nx = (plain[i + 1] || '').toLowerCase(), up = ch !== lo;
    let r;
    if ((lo === 'α' || lo === 'ε') && nx === 'υ') { const after = (plain[i + 2] || '').toLowerCase(); r = (lo === 'α' ? 'a' : 'e') + (/[θκξπσςτφχψ]|^$/.test(after) ? 'f' : 'v'); i++; }
    else if (lo === 'ο' && nx === 'υ') { r = 'ou'; i++; }
    else if (lo === 'μ' && nx === 'π' && (i === 0 || /\s/.test(plain[i - 1]))) { r = 'b'; i++; }
    else if (lo === 'ν' && nx === 'τ' && (i === 0 || /\s/.test(plain[i - 1]))) { r = 'd'; i++; }
    else if (lo === 'γ' && /[γκξχ]/.test(nx)) r = 'n';
    else r = TRL[lo] ?? ch;
    if (up) { const isUp = c => c && c !== c.toLowerCase(); r = isUp(plain[s0 + 1]) || (isUp(plain[s0 - 1]) && !/\s/.test(plain[s0 - 1])) ? r.toUpperCase() : r[0].toUpperCase() + r.slice(1); }
    out += r;
  }
  return out;
}
/* an issuer as it should appear on a document in the current document language */
function issFor(iss) {
  if (DL !== 'en' || !iss) return iss;
  const e = iss.en || {}; return { ...iss, name: e.name || translit(iss.name), father: e.father || translit(iss.father), act: e.act || iss.act, addr: e.addr || translit(iss.addr), doy: translit(iss.doy) };
}
const brandFor = B => DL === 'en' ? { ...B, name: B.nameEn || B.name, tagline: B.taglineEn || B.tagline, prefix: B.nameEn ? (B.prefixEn ?? '') : B.prefix } : B;
