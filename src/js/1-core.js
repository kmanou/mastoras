/* Έγγραφα & Πελάτες · v3 · MakeTech */
const APP = { name: 'Μάστορας', sub: 'Έγγραφα & Πελάτες', version: '3.0.0', site: 'maketech.eu', repo: 'github.com/kmanou/mastoras', author: 'Κωνσταντίνος Μανούσης' };
/* Required attribution (GPL-3.0 §7(b), see ADDITIONAL-TERMS.md): keep this text visible in the footer and in Settings → About. Logos are optional. */
const ATTRIBUTION = `${APP.name} · αρχική δημιουργία: ${APP.author} / MakeTech (${APP.site})`;

/* ------------------------------------------------------------------ constants */
const TYPES = {
  offer:    { label: 'ΠΡΟΣΦΟΡΑ',     title: 'Προσφορά',     prefix: 'ΠΡΦ-', dir: 'Προσφορές' },
  proforma: { label: 'ΠΡΟΤΙΜΟΛΟΓΙΟ', title: 'Προτιμολόγιο', prefix: 'ΠΡ-',  dir: 'Προτιμολόγια' },
  contract: { label: 'ΣΥΜΒΟΛΑΙΟ ΣΥΝΤΗΡΗΣΗΣ', title: 'Συμβόλαιο', prefix: 'ΣΣ-', dir: 'Συμβόλαια' },
};
const SALES = ['offer', 'proforma'];
const DIRS = { clients: 'Πελάτες', settings: 'Ρυθμίσεις', backup: 'Αντίγραφα', contract: 'Συμβόλαια' };
const SETTINGS_FILE = 'ρυθμίσεις.json';
const KINDS = ['Τοίχου', 'Καναλάτο', 'Κασέτα', 'Δαπέδου / Οροφής', 'Ντουλάπα', 'Πολυδιαιρούμενο', 'Άλλο'];
const BRANDS = ['Inventor', 'Daikin', 'Mitsubishi Electric', 'Mitsubishi Heavy', 'LG', 'Samsung', 'Toshiba', 'Fujitsu', 'Gree', 'Midea', 'Panasonic', 'Hitachi', 'Carrier', 'Toyotomi', 'Sharp', 'Haier', 'Olimpia Splendid', 'Hisense', 'Kaisai', 'Bosch', 'Aux', 'TCL', 'Electrolux'];
const DUR_UNITS = ['εργάσιμες ημέρες', 'ημέρες', 'εβδομάδες', 'μήνες'];
const PAY_METHODS = ['Τραπεζική κατάθεση', 'Μετρητά', 'Κάρτα', 'Επιταγή', 'Άλλο'];
const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
const MONTHS_GEN = ['Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'];
const VISIT_MONTHS = { 1: [3], 2: [3, 9], 3: [2, 6, 10], 4: [0, 3, 6, 9], 6: [0, 2, 4, 6, 8, 10], 12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const PAYMENTS = ['Εφάπαξ με την υπογραφή του συμβολαίου', 'Ανά επίσκεψη, με την ολοκλήρωσή της', 'Σε δύο ισόποσες δόσεις (υπογραφή και 2η επίσκεψη)'];
const CONTRACT_DEFAULTS = { months: 12, visits: 2, mode: 'visit', amount: 45, payment: PAYMENTS[0] };
const mkChecklist = rows => rows.map(([g, t], i) => ({ id: 'k' + (i + 1), g, t, on: true }));
const CHECKLISTS = {
  hvac: mkChecklist([
    ['Εσωτερική μονάδα', 'Καθαρισμός και απολύμανση φίλτρων αέρα'], ['Εσωτερική μονάδα', 'Καθαρισμός στοιχείου (εναλλάκτη) με ειδικό καθαριστικό'], ['Εσωτερική μονάδα', 'Καθαρισμός λεκάνης και αποχέτευσης συμπυκνωμάτων'], ['Εσωτερική μονάδα', 'Έλεγχος και καθαρισμός ανεμιστήρα (τουρμπίνας)'],
    ['Καναλάτα / κασέτες', 'Καθαρισμός φίλτρων και στομίων'], ['Καναλάτα / κασέτες', 'Οπτικός έλεγχος αεραγωγών και μονώσεών τους'],
    ['Εξωτερική μονάδα', 'Καθαρισμός στοιχείου συμπυκνωτή'], ['Εξωτερική μονάδα', 'Έλεγχος ανεμιστήρα εξωτερικής μονάδας'], ['Εξωτερική μονάδα', 'Έλεγχος βάσεων στήριξης και αντικραδασμικών'],
    ['Ψυκτικό κύκλωμα', 'Μέτρηση πιέσεων λειτουργίας'], ['Ψυκτικό κύκλωμα', 'Έλεγχος για διαρροές ψυκτικού υγρού'], ['Ψυκτικό κύκλωμα', 'Μέτρηση θερμοκρασιών προσαγωγής / επιστροφής'],
    ['Ηλεκτρολογικός έλεγχος', 'Σύσφιξη ηλεκτρικών επαφών και κλεμμών'], ['Ηλεκτρολογικός έλεγχος', 'Μέτρηση κατανάλωσης ρεύματος συμπιεστή'],
    ['Οπτικός έλεγχος', 'Μονώσεις σωληνώσεων'], ['Οπτικός έλεγχος', 'Καλωδιώσεις και συνδέσεις'], ['Οπτικός έλεγχος', 'Κελύφη μονάδων'], ['Οπτικός έλεγχος', 'Λειτουργία τηλεχειριστηρίου / θερμοστάτη']]),
  general: mkChecklist([
    ['Έλεγχος', 'Οπτικός έλεγχος εξοπλισμού'], ['Έλεγχος', 'Έλεγχος καλής λειτουργίας'], ['Έλεγχος', 'Έλεγχος ηλεκτρικών συνδέσεων'], ['Έλεγχος', 'Μετρήσεις λειτουργίας'],
    ['Συντήρηση', 'Καθαρισμός'], ['Συντήρηση', 'Ρυθμίσεις και λίπανση όπου απαιτείται'],
    ['Αναφορά', 'Καταγραφή παρατηρήσεων και ενημέρωση πελάτη']]),
};
const EXCLUSIONS = {
  hvac: ['Ανταλλακτικά και υλικά (π.χ. πλακέτες, κινητήρες, πυκνωτές).', 'Συμπλήρωση ή αναγόμωση ψυκτικού υγρού.', 'Αποκατάσταση βλαβών από κακή χρήση, διακυμάνσεις ρεύματος ή εξωτερικά αίτια.', 'Εργασίες που απαιτούν ανυψωτικό μηχάνημα ή ικρίωμα.', 'Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.'],
  general: ['Ανταλλακτικά και υλικά.', 'Αποκατάσταση βλαβών από κακή χρήση ή εξωτερικά αίτια.', 'Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.'],
};
const PALETTES = {
  navy:     { label: 'Μπλε',     dark: '#0A2647', accent: '#1C6DD0', light: '#5CC8F5' },
  petrol:   { label: 'Πετρόλ',   dark: '#0B3C49', accent: '#0E7C86', light: '#7FD6C8' },
  graphite: { label: 'Γραφίτης', dark: '#1E2633', accent: '#2F6BFF', light: '#22D3EE' },
  forest:   { label: 'Πράσινο',  dark: '#123524', accent: '#1F7A4C', light: '#6FD6A1' },
  burgundy: { label: 'Μπορντό',  dark: '#4A1426', accent: '#9B2242', light: '#F0B64F' },
  charcoal: { label: 'Ανθρακί',  dark: '#1F1F23', accent: '#C2410C', light: '#FB923C' },
};

/* ------------------------------------------------------------------ utils */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const eur = (x, sym = true) => (isFinite(x) ? x : 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (sym ? ' €' : '');
const num = s => { s = String(s ?? '').replace(/[€\s%]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const v = parseFloat(s); return isFinite(v) ? v : 0; };
const isoOf = d => { const z = new Date(d); z.setHours(12, 0, 0, 0); return z.getFullYear() + '-' + String(z.getMonth() + 1).padStart(2, '0') + '-' + String(z.getDate()).padStart(2, '0'); };
const todayISO = () => isoOf(new Date());
const fmtDate = iso => { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const ymOf = iso => String(iso || '').slice(0, 7);
const ymLabel = k => MONTHS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
const slug = s => String(s || '').trim().replace(/[\\/:*?"<>|#%]+/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40);
const textOf = el => el.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
const fmtIban = v => { const c = String(v).replace(/\s+/g, '').toUpperCase(); return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(c) ? c.replace(/(.{4})/g, '$1 ').trim() : String(v).trim(); };
const stripMeta = ({ file, dir, ...r }) => r;
const durUnit = (n, u) => num(n) === 1 ? ({ 'εργάσιμες ημέρες': 'εργάσιμη ημέρα', 'ημέρες': 'ημέρα', 'εβδομάδες': 'εβδομάδα', 'μήνες': 'μήνας' }[u] || u) : u;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function download(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
let toastT; function toast(t) { let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3000); }

/* ------------------------------------------------------------------ business type */
const isHvac = () => (DB.settings?.biz || 'hvac') === 'hvac';
const EQ = () => isHvac()
  ? { one: 'Μηχάνημα', many: 'Μηχανήματα', a: 'μηχάνημα', as: 'μηχανήματα', icon: '❄', abbr: 'μηχ.', none: 'Δεν υπάρχουν καταχωρημένα μηχανήματα.' }
  : { one: 'Εξοπλισμός', many: 'Εξοπλισμός', a: 'τεμάχιο εξοπλισμού', as: 'τεμάχια εξοπλισμού', icon: '⚙', abbr: 'τεμ.', none: 'Δεν υπάρχει καταχωρημένος εξοπλισμός.' };
const pricingLabels = () => isHvac()
  ? { visit: 'Ανά μηχάνημα ανά επίσκεψη', year: 'Ανά μηχάνημα ανά έτος', total: 'Συνολικό ποσό' }
  : { visit: 'Ανά τεμάχιο ανά επίσκεψη', year: 'Ανά τεμάχιο ανά έτος', total: 'Συνολικό ποσό' };

/* ------------------------------------------------------------------ folder access */
let root = null, dirCache = {};
const IDB_NAME = 'mastoras', IDB_LEGACY = 'diamantaras-app'; // the legacy name keeps folders chosen with versions before 3.0
let idbName = IDB_NAME;
const IDB = () => new Promise((res, rej) => { const r = indexedDB.open(idbName, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbGet(k) { const db = await IDB(); return new Promise(res => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(null); }); }
async function idbSet(k, v) { const db = await IDB(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
async function sub(name) { return dirCache[name] || (dirCache[name] = await root.getDirectoryHandle(name, { create: true })); }
async function writeRaw(d, f, data) { const dh = await sub(d); const fh = await dh.getFileHandle(f, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); }
const writeJSON = (d, f, obj) => writeRaw(d, f, JSON.stringify(obj, null, 2));
async function readBlob(d, f) { try { return await (await (await sub(d)).getFileHandle(f)).getFile(); } catch (e) { return null; } }
async function delFile(d, f) { if (!d || !f) return; try { await (await sub(d)).removeEntry(f); } catch (e) { } }
async function readAll(d) {
  const out = [], dh = await sub(d);
  for await (const [name, h] of dh.entries()) {
    if (h.kind !== 'file' || !name.toLowerCase().endsWith('.json')) continue;
    try { out.push({ name, data: JSON.parse(await (await h.getFile()).text()) }); } catch (e) { console.warn('Αρχείο που δεν διαβάζεται:', d + '/' + name); }
  }
  return out;
}

/* write queue + debounced saves */
let chain = Promise.resolve(), pending = 0, lastSaved = null;
const timers = {};
function q(fn) { pending++; setStatus(); chain = chain.then(fn).then(() => { pending--; lastSaved = new Date(); setStatus(); }, e => { pending--; console.error(e); setStatus('Σφάλμα αποθήκευσης: ' + (e.message || e)); }); return chain; }
function later(key, fn, ms = 700) { if (timers[key]) clearTimeout(timers[key].t); timers[key] = { fn, t: setTimeout(() => { delete timers[key]; q(fn); }, ms) }; setStatus(); }
function cancelLater(key) { if (timers[key]) { clearTimeout(timers[key].t); delete timers[key]; setStatus(); } }
function flushAll() { for (const k of Object.keys(timers)) { clearTimeout(timers[k].t); const fn = timers[k].fn; delete timers[k]; q(fn); } return chain; }
addEventListener('beforeunload', e => { if (Object.keys(timers).length || pending) { flushAll(); e.preventDefault(); e.returnValue = ''; } });
function setStatus(err) {
  const el = $('#status'); if (!el) return;
  const busy = pending || Object.keys(timers).length;
  el.className = 'status' + (err ? ' err' : busy ? ' saving' : '');
  el.innerHTML = '<i></i><span>' + esc(err || (busy ? 'Αποθήκευση…' : lastSaved ? 'Αποθηκεύτηκε ' + lastSaved.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : 'Φάκελος: ' + (root?.name || ''))) + '</span>';
  el.title = 'Τα δεδομένα αποθηκεύονται στον φάκελο «' + (root?.name || '') + '»';
}

/* ------------------------------------------------------------------ data */
const DB = { settings: null, clients: [], docs: [], dupes: 0 };
const FRESH_ISS = { name: '', father: '', act: '', addr: '', afm: '', doy: '', tel: '', email: '' };
function defaultBrand(S) {
  const nm = S.iss?.name || '';
  // settings from versions before 3.0 had no brand: "Surname Firstname" becomes "F. Surname"
  const w = nm.trim().split(/\s+/);
  if (!S.brand && (S.version || 1) < 3 && w.length === 2) return { name: w[0], prefix: w[1][0].toLocaleUpperCase('el') + '.', tagline: S.iss?.act || '', mark: (S.biz || 'hvac') === 'hvac' ? 'snow' : 'initials' };
  return { name: nm, prefix: '', tagline: S.iss?.act || '', mark: (S.biz || 'hvac') === 'hvac' ? 'snow' : 'initials' };
}
function normSettings(s) {
  s = s || {};
  const out = Object.assign({ lastBackup: '' }, s, { version: 3 });
  out.iss = Object.assign(clone(FRESH_ISS), s.iss || {});
  out.defaults = Object.assign({ vat: 24, adv: 80, days: 30, durU: 'εργάσιμες ημέρες', warrantyMonths: 24 }, s.defaults || {});
  out.numbering = Object.assign({ offer: {}, proforma: {}, contract: {} }, s.numbering || {});
  out.biz = s.biz || 'hvac';
  out.checklist = Array.isArray(s.checklist) && s.checklist.length ? s.checklist : clone(CHECKLISTS[out.biz]);
  out.exclusions = Array.isArray(s.exclusions) ? s.exclusions : clone(EXCLUSIONS[out.biz]);
  out.contract = Object.assign(clone(CONTRACT_DEFAULTS), s.contract || {});
  out.accounts = Array.isArray(s.accounts) ? s.accounts : [];
  out.catalog = Array.isArray(s.catalog) ? s.catalog : [];
  out.setupDone = s.setupDone ?? !!(s.iss && s.iss.name);
  out.brand = Object.assign({ logo: '', logoMode: 'normal', logoText: false, palette: 'navy', custom: { dark: '#0A2647', accent: '#1C6DD0', light: '#5CC8F5' }, credit: true }, defaultBrand({ ...out, version: s.version, brand: s.brand }), s.brand || {});
  return out;
}
function normDoc(d) {
  const df = DB.settings.defaults;
  d.id = d.id || uid(); d.type = TYPES[d.type] ? d.type : 'proforma';
  d.cl = Object.assign({ name: '', act: '', addr: '', afm: '', doy: '', gemi: '', tel: '', email: '' }, d.cl || {});
  d.items = Array.isArray(d.items) && d.items.length ? d.items : [blankItem()];
  d.extra = Array.isArray(d.extra) ? d.extra.filter(t => !/^\s*Χρόνος ολοκλήρωσης:?\s*$/.test(t)) : [];
  for (const k of ['vat', 'adv', 'days']) if (d[k] == null || d[k] === '') d[k] = df[k];
  if (!d.durU) d.durU = df.durU; if (d.dur == null) d.dur = '';
  d.date = d.date || todayISO();
  d.payments = Array.isArray(d.payments) ? d.payments : [];
  if (d.type === 'offer' && d.issued && !d.status) d.status = 'sent';
  d.created = d.created || new Date().toISOString(); d.updated = d.updated || d.created;
  return d;
}
function normClient(c) {
  c.id = c.id || uid();
  for (const k of ['name', 'act', 'addr', 'afm', 'doy', 'gemi', 'tel', 'email', 'notes']) c[k] = c[k] ?? '';
  c.machines = Array.isArray(c.machines) ? c.machines : [];
  c.created = c.created || new Date().toISOString();
  return c;
}
const blankItem = () => ({ t: '', s: '', q: 1, u: 'τεμ.', p: '' });

function docFileName(d) { const s = slug(d.cl.name) || 'χωρίς-πελάτη'; return d.issued ? `${d.no}_${s}.json` : `${d.demo ? 'ΔΕΙΓΜΑ_' : ''}Πρόχειρο_${s}_${d.id}.json`; }
function clientFileName(c) { return `${c.demo ? 'ΔΕΙΓΜΑ_' : ''}${slug(c.name) || 'πελάτης'}_${c.afm ? c.afm : c.id}.json`; }
const meaningful = d => d.issued || (d.type === 'contract' ? !!(d.clientId || d.cl.name.trim()) : (d.cl.name.trim() || d.items.some(i => (i.t || '').trim() || num(i.p))));

async function saveDoc(d) {
  const dirn = TYPES[d.type].dir, name = docFileName(d);
  d.updated = new Date().toISOString();
  await writeJSON(dirn, name, stripMeta(d));
  if (d.file && (d.file !== name || d.dir !== dirn)) await delFile(d.dir, d.file);
  d.file = name; d.dir = dirn;
  await backupIfNeeded();
}
async function saveClient(c) {
  const name = clientFileName(c);
  c.updated = new Date().toISOString();
  await writeJSON(DIRS.clients, name, stripMeta(c));
  if (c.file && c.file !== name) await delFile(DIRS.clients, c.file);
  c.file = name; c.dir = DIRS.clients;
  await backupIfNeeded();
}
const saveSettingsNow = () => { DB.settings.updated = new Date().toISOString(); return writeJSON(DIRS.settings, SETTINGS_FILE, DB.settings); };
function persistDoc(d, now) { if (!d.file && !meaningful(d)) return; const fn = () => saveDoc(d); if (now) { cancelLater('d' + d.id); return q(fn); } later('d' + d.id, fn); }
function persistClient(c, now) { if (!c.name.trim()) return; if (!DB.clients.includes(c)) DB.clients.push(c); const fn = () => saveClient(c); if (now) { cancelLater('c' + c.id); return q(fn); } later('c' + c.id, fn); }
function persistSettings() { later('settings', saveSettingsNow); }

/* backups (the logo travels inside the bundle as a data URL) */
let LOGO_URL = '', LOGO_DATA = '';
const makeBundle = () => ({ app: 'mastoras', version: 3, created: new Date().toISOString(), settings: DB.settings, logo: DB.settings.brand.logo && LOGO_DATA ? { name: DB.settings.brand.logo, data: LOGO_DATA } : null, clients: DB.clients.map(stripMeta), docs: DB.docs.filter(d => d.file).map(stripMeta) });
async function clearDir(name) { const dh = await sub(name), names = []; for await (const [n, h] of dh.entries()) if (h.kind === 'file' && n.toLowerCase().endsWith('.json')) names.push(n); for (const n of names) await dh.removeEntry(n); }
async function restoreFlow(b, name) {
  if (!b || !b.settings || !Array.isArray(b.clients) || !Array.isArray(b.docs)) return toast('Το αρχείο δεν είναι αντίγραφο της εφαρμογής');
  const cnt = t => b.docs.filter(d => d.type === t).length;
  const ok = await confirmBox('Επαναφορά δεδομένων', `Θα αντικατασταθούν όλα τα τρέχοντα δεδομένα με το αντίγραφο <b>${esc(name)}</b> (${fmtDate((b.created || '').slice(0, 10)) || 'χωρίς ημερομηνία'}):<br>${b.clients.length} πελάτες · ${cnt('offer')} προσφορές · ${cnt('proforma')} προτιμολόγια · ${cnt('contract')} συμβόλαια.<br><br>Πριν την επαναφορά κρατιέται αυτόματα αντίγραφο της τρέχουσας κατάστασης.`, 'Επαναφορά', 'blue');
  if (!ok) return;
  await flushAll();
  const stamp = todayISO() + '_' + new Date().toTimeString().slice(0, 5).replace(':', '');
  await writeJSON(DIRS.backup, `πριν-την-επαναφορά-${stamp}.json`, makeBundle());
  for (const dn of [DIRS.clients, ...Object.values(TYPES).map(t => t.dir)]) await clearDir(dn);
  DB.settings = normSettings(b.settings);
  if (b.logo?.data && b.logo?.name) { const blob = await (await fetch(b.logo.data)).blob(); await writeRaw(DIRS.settings, b.logo.name, blob); }
  await saveSettingsNow();
  DB.clients = b.clients.map(c => normClient(c)); for (const c of DB.clients) await saveClient(c);
  DB.docs = b.docs.map(d => { d = normDoc(d); if (d.type === 'contract') normContract(d); return d; }); for (const d of DB.docs) await saveDoc(d);
  toast('Η επαναφορά ολοκληρώθηκε'); start();
}
async function backupIfNeeded(force) {
  const t = todayISO();
  if (!force && DB.settings.lastBackup === t) return;
  DB.settings.lastBackup = t;
  await writeJSON(DIRS.backup, force ? `αντίγραφο-${t}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.json` : `αντίγραφο-${t}.json`, makeBundle());
  await saveSettingsNow();
  const dh = await sub(DIRS.backup), names = [];
  for await (const [n, h] of dh.entries()) if (h.kind === 'file' && n.startsWith('αντίγραφο-')) names.push(n);
  names.sort(); while (names.length > 90) await dh.removeEntry(names.shift());
}

/* loading, with cleanup of sync duplicates (e.g. "file (1).json" made by Google Drive) */
async function quarantine(dir, name, data) {
  const bd = await sub(DIRS.backup), qd = await bd.getDirectoryHandle('διπλότυπα', { create: true });
  const fh = await qd.getFileHandle(`${todayISO()}_${dir}_${name}`, { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(data, null, 2)); await w.close();
  await delFile(dir, name); DB.dupes++;
}
async function dedupe(list, dir) {
  const by = new Map();
  for (const x of list) { const id = x.data?.id || x.name; if (!by.has(id)) by.set(id, []); by.get(id).push(x); }
  const keep = [];
  for (const g of by.values()) {
    g.sort((a, b) => String(b.data.updated || '').localeCompare(String(a.data.updated || '')) || a.name.length - b.name.length);
    keep.push(g[0]);
    for (const o of g.slice(1)) await quarantine(dir, o.name, o.data);
  }
  return keep;
}
async function loadAll() {
  dirCache = {}; DB.dupes = 0;
  const s = await readAll(DIRS.settings);
  const cands = s.filter(x => /^ρυθμίσεις.*\.json$/i.test(x.name)).sort((a, b) => (b.name === SETTINGS_FILE) - (a.name === SETTINGS_FILE) || String(b.data.updated || '').localeCompare(String(a.data.updated || '')));
  const sf = cands.find(x => x.name === SETTINGS_FILE) && cands.length > 1
    ? cands.slice().sort((a, b) => String(b.data.updated || '').localeCompare(String(a.data.updated || '')))[0] : cands[0];
  for (const o of cands) if (o !== sf) await quarantine(DIRS.settings, o.name, o.data);
  DB.settings = sf ? normSettings(sf.data) : null;
  if (sf && sf.name !== SETTINGS_FILE) { await saveSettingsNow(); await delFile(DIRS.settings, sf.name); }
  const keep = DB.settings; DB.settings = keep || normSettings(null);
  DB.clients = (await dedupe(await readAll(DIRS.clients), DIRS.clients)).map(x => Object.assign(normClient(x.data), { file: x.name, dir: DIRS.clients }));
  DB.docs = [];
  for (const t in TYPES) for (const x of await dedupe(await readAll(TYPES[t].dir), TYPES[t].dir)) { x.data.type = t; const d = Object.assign(normDoc(x.data), { file: x.name, dir: TYPES[t].dir }); if (t === 'contract') normContract(d); DB.docs.push(d); }
  DB.settings = keep;
  await sub(DIRS.contract); await sub(DIRS.backup);
  await loadLogo();
}
async function loadLogo() {
  if (LOGO_URL) URL.revokeObjectURL(LOGO_URL); LOGO_URL = ''; LOGO_DATA = '';
  const name = DB.settings?.brand?.logo; if (!name) return;
  const blob = await readBlob(DIRS.settings, name); if (!blob) { DB.settings.brand.logo = ''; return; }
  LOGO_URL = URL.createObjectURL(blob);
  LOGO_DATA = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(blob); });
}

/* ------------------------------------------------------------------ numbering: taken only when a document is issued */
function lastIssued(type, y = new Date().getFullYear()) {
  const re = new RegExp('^' + TYPES[type].prefix + y + '-(\\d+)$');
  let n = num(DB.settings.numbering[type]?.[y]) || 0;
  for (const d of DB.docs) if (d.type === type && d.issued) { const m = String(d.no).match(re); if (m) n = Math.max(n, +m[1]); }
  return n;
}
function nextNo(type, demo) {
  if (demo) { const n = DB.docs.filter(d => d.type === type && d.issued && /ΔΕΙΓΜΑ-/.test(d.no)).length; return TYPES[type].prefix + 'ΔΕΙΓΜΑ-' + String(n + 1).padStart(2, '0'); }
  const y = new Date().getFullYear(); return TYPES[type].prefix + y + '-' + String(lastIssued(type, y) + 1).padStart(3, '0');
}
const isDemoDoc = d => !!(d.demo || (d.clientId && DB.clients.find(c => c.id === d.clientId)?.demo));

/* ------------------------------------------------------------------ amounts (discount and VAT per line) */
const clampPct = v => Math.min(100, Math.max(0, num(v)));
const lineGross = it => num(it.q) * num(it.p);
const lineNet = it => lineGross(it) * (1 - clampPct(it.disc) / 100);
const lineRate = (d, it) => (it.vat === '' || it.vat == null) ? num(d.vat) : num(it.vat);
function totals(d) {
  if (d.type === 'contract') return contractTotals(d);
  let gross = 0, net = 0; const base = {};
  for (const it of d.items) { const g = lineGross(it), n = lineNet(it); gross += g; net += n; const r = lineRate(d, it); base[r] = (base[r] || 0) + n; }
  const vatBy = Object.keys(base).map(Number).sort((a, b) => b - a).filter(r => base[r] || Object.keys(base).length === 1).map(r => ({ r, v: Math.round(base[r] * r) / 100 }));
  const vatv = vatBy.reduce((a, x) => a + x.v, 0), tot = Math.round((net + vatv) * 100) / 100, advv = Math.round(tot * num(d.adv)) / 100;
  return { gross, disc: gross - net, net, vatBy, vatv, tot, advv, bal: tot - advv };
}
const validUntil = d => addDays(d.date, parseInt(d.days) || 0);
const paidOf = d => (d.payments || []).reduce((a, p) => a + num(p.amount), 0);
const balanceOf = d => Math.round((totals(d).tot - paidOf(d)) * 100) / 100;
const childrenOf = d => DB.docs.filter(x => x.from?.id === d.id);
const payable = d => d.issued && !d.cancelled && (d.type !== 'offer' || d.status === 'accepted');

/* states shown as chips */
function payState(d) {
  const tot = totals(d).tot, p = paidOf(d);
  if (tot > 0 && p >= tot - 0.005) return { k: 'paid', l: 'Εξοφλήθηκε', c: 'ok' };
  if (p > 0) return { k: 'partial', l: 'Μερική πληρωμή', c: 'warn' };
  return { k: 'unpaid', l: 'Ανεξόφλητο', c: 'unpaid' };
}
function docState(d) {
  if (!d.issued) return { k: 'draft', l: 'Πρόχειρο', c: 'draft' };
  if (d.cancelled) return { k: 'cancelled', l: 'Ακυρώθηκε', c: 'bad' };
  if (d.type === 'offer') {
    if (d.status === 'accepted') return { k: 'accepted', l: 'Αποδεκτή', c: 'ok' };
    if (d.status === 'rejected') return { k: 'rejected', l: 'Απορρίφθηκε', c: 'bad' };
    if (validUntil(d) < todayISO()) return { k: 'expired', l: 'Έληξε χωρίς απάντηση', c: 'warn' };
    return { k: 'sent', l: 'Σε αναμονή', c: 'info' };
  }
  if (d.type === 'contract') return contractState(d);
  return payState(d);
}
const chipOf = s => `<span class="chip ${s.c}">${esc(s.l)}</span>`;

/* ------------------------------------------------------------------ equipment */
function parseMachine(t) {
  t = String(t || ''); const low = t.toLowerCase();
  const m = t.match(/(\d{1,2}[.\s]?\d{3})\s*btu/i);
  const brand = BRANDS.find(b => low.includes(b.toLowerCase())) || '';
  const kind = /καναλ/i.test(t) ? 'Καναλάτο' : /κασέτ/i.test(t) ? 'Κασέτα' : /δαπέδ|οροφ/i.test(t) ? 'Δαπέδου / Οροφής' : /ντουλ/i.test(t) ? 'Ντουλάπα' : /πολυδιαιρ|multi/i.test(t) ? 'Πολυδιαιρούμενο' : /τοίχ|τοιχ/i.test(t) ? 'Τοίχου' : '';
  return { btu: m ? m[1].replace(/[.\s]/g, '') : '', brand, kind };
}
const machineLabel = m => [m.brand, m.kind, m.btu ? (+m.btu).toLocaleString('el-GR') + ' BTU' : '', m.model].filter(Boolean).join(' · ');
function warrantyChip(m) {
  if (!m.warrantyEnd) return '<span class="chip">—</span>';
  const left = daysBetween(todayISO(), m.warrantyEnd);
  if (left < 0) return `<span class="chip bad">Έληξε ${fmtDate(m.warrantyEnd)}</span>`;
  if (left <= 60) return `<span class="chip warn">Λήγει ${fmtDate(m.warrantyEnd)}</span>`;
  return `<span class="chip ok">Έως ${fmtDate(m.warrantyEnd)}</span>`;
}

/* AFM: required, 9 digits, valid check digit, unique in the client book */
const afmClean = a => String(a || '').replace(/\s/g, '');
function afmChecksum(a) { let s = 0; for (let i = 0; i < 8; i++) s += +a[i] * 2 ** (8 - i); return (s % 11) % 10 === +a[8]; }
function afmFormat(afm) {
  const a = afmClean(afm);
  if (!a) return 'Το ΑΦΜ είναι υποχρεωτικό.';
  if (!/^\d{9}$/.test(a)) return 'Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.';
  if (!afmChecksum(a)) return 'Το ΑΦΜ δεν είναι έγκυρο (δεν ταιριάζει το ψηφίο ελέγχου). Ελέγξτε μήπως υπάρχει τυπογραφικό λάθος.';
  return '';
}
function afmProblem(afm, selfId) {
  const f = afmFormat(afm); if (f) return { msg: f };
  const a = afmClean(afm), o = DB.clients.find(x => x.id !== selfId && afmClean(x.afm) === a);
  if (o) return { msg: `Υπάρχει ήδη πελάτης με ΑΦΜ ${a}: «${o.name}».`, dup: o };
  return null;
}

/* client book */
const pickCl = c => ({ name: c.name, act: c.act, addr: c.addr, afm: c.afm, doy: c.doy, gemi: c.gemi, tel: c.tel, email: c.email });
function findClientFor(d) {
  if (d.clientId) { const c = DB.clients.find(x => x.id === d.clientId); if (c) return c; }
  const afm = afmClean(d.cl.afm);
  if (afm) { const c = DB.clients.find(x => afmClean(x.afm) === afm); if (c) return c; }
  const nm = d.cl.name.trim().toLowerCase();
  return nm ? DB.clients.find(x => x.name.trim().toLowerCase() === nm) : null;
}
function upsertClient(d) {
  let c = findClientFor(d);
  if (!c) { c = normClient({ demo: !!d.demo || undefined }); DB.clients.push(c); }
  for (const k of ['name', 'act', 'addr', 'afm', 'doy', 'gemi', 'tel', 'email']) if ((d.cl[k] || '').trim()) c[k] = d.cl[k].trim();
  d.clientId = c.id;
  return c;
}
function pushMachines(d, c) {
  if (c.machines.some(m => m.source?.docId === d.id)) return 0;
  let n = 0; const wm = num(DB.settings.defaults.warrantyMonths) || 0;
  d.items.forEach((it, row) => {
    if (!it.m?.on) return;
    const count = Math.max(1, Math.round(num(it.q)) || 1);
    for (let i = 0; i < count; i++) {
      c.machines.push({ id: uid(), brand: it.m.brand || '', kind: it.m.kind || '', btu: it.m.btu || '', model: it.m.model || '', serial: '', location: '',
        installed: d.date, warrantyEnd: wm ? addMonths(d.date, wm) : '', source: { docId: d.id, docNo: d.no, row } });
      n++;
    }
  });
  return n;
}

/* ------------------------------------------------------------------ modal helpers */
function modal({ title, body, actions, wide, onOpen }) {
  return new Promise(resolve => {
    const mb = document.createElement('div'); mb.className = 'mb';
    mb.innerHTML = `<div class="md" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'width:min(760px,100%)' : ''}"><header>${esc(title)}</header><div class="body">${body}</div><footer></footer></div>`;
    const ft = $('footer', mb);
    const close = v => { mb.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    actions.forEach(a => {
      if (a === '|') { const s = document.createElement('span'); s.className = 'sp'; ft.appendChild(s); return; }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
      if (a.disabled) b.disabled = true;
      b.onclick = async () => { if (a.validate && !(await a.validate(mb))) return; close(a.value); };
      ft.appendChild(b);
    });
    mb.addEventListener('mousedown', e => { if (e.target === mb) close(null); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(mb);
    onOpen && onOpen(mb, close);
    const first = $('input:not([type=checkbox]),select,textarea', mb); first ? first.focus() : $('footer .btn:last-child', mb)?.focus();
  });
}
const confirmBox = (title, text, label = 'Διαγραφή', cls = 'danger') => modal({ title, body: `<p>${text}</p>`, actions: [{ label: 'Πίσω', value: false }, { label, value: true, cls }] });

async function machineForm(m, { allowDelete } = {}) {
  m = Object.assign({ brand: '', kind: '', btu: '', model: '', serial: '', location: '', installed: '', warrantyEnd: '' }, m || {});
  const hv = isHvac();
  const body = `<div class="form">
    <div class="f"><label for="m-brand">${hv ? 'Μάρκα' : 'Κατασκευαστής'}</label><input id="m-brand" ${hv ? 'list="brands"' : ''} value="${esc(m.brand)}">${hv ? `<datalist id="brands">${BRANDS.map(b => `<option value="${esc(b)}">`).join('')}</datalist>` : ''}</div>
    <div class="f"><label for="m-kind">${hv ? 'Τύπος' : 'Περιγραφή / τύπος'}</label>${hv ? `<select id="m-kind"><option value=""></option>${KINDS.map(k => `<option ${k === m.kind ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : `<input id="m-kind" value="${esc(m.kind)}" placeholder="π.χ. λέβητας, αντλία, πίνακας">`}</div>
    ${hv ? `<div class="f"><label for="m-btu">BTU</label><input id="m-btu" inputmode="numeric" value="${esc(m.btu)}" placeholder="π.χ. 12000"></div>` : ''}
    <div class="f"><label for="m-location">Θέση</label><input id="m-location" value="${esc(m.location)}" placeholder="π.χ. σαλόνι"></div>
    <div class="f"><label for="m-model">Μοντέλο</label><input id="m-model" value="${esc(m.model)}"></div>
    <div class="f"><label for="m-serial">Σειριακός αριθμός</label><input id="m-serial" value="${esc(m.serial)}"></div>
    <div class="f"><label for="m-installed">Ημ. εγκατάστασης</label><input id="m-installed" type="date" value="${esc(m.installed)}"></div>
    <div class="f"><label for="m-warranty">Λήξη εγγύησης</label><input id="m-warranty" type="date" value="${esc(m.warrantyEnd)}"></div>
  </div>`;
  let vals = null;
  const grab = mb => { const v = id => ($('#' + id, mb)?.value || '').trim(); vals = { brand: v('m-brand'), kind: v('m-kind'), btu: v('m-btu').replace(/\D/g, ''), location: v('m-location'), model: v('m-model'), serial: v('m-serial'), installed: v('m-installed'), warrantyEnd: v('m-warranty') }; return true; };
  const res = await modal({ title: allowDelete ? EQ().one : (hv ? 'Νέο μηχάνημα' : 'Νέος εξοπλισμός'), body,
    actions: [...(allowDelete ? [{ label: 'Διαγραφή', value: 'delete', cls: 'danger' }, '|'] : []), { label: 'Άκυρο', value: null }, { label: 'Αποθήκευση', value: 'save', cls: 'blue', validate: grab }],
    onOpen: mb => { const ins = $('#m-installed', mb), w = $('#m-warranty', mb); ins.onchange = () => { const wm = num(DB.settings.defaults.warrantyMonths); if (ins.value && !w.value && wm) w.value = addMonths(ins.value, wm); }; } });
  if (res !== 'save') return res;
  return Object.assign(m, vals);
}
function clientPicker() {
  return new Promise(resolve => {
    const list = q => DB.clients.filter(c => !q || [c.name, c.afm, c.tel, c.email].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'el'));
    let chosen = null;
    modal({ title: 'Επιλογή πελάτη', body: `<input class="inp" id="pk-q" placeholder="Αναζήτηση με όνομα, ΑΦΜ ή τηλέφωνο" aria-label="Αναζήτηση πελάτη"><div class="pick" id="pk"></div>`,
      actions: [{ label: 'Άκυρο', value: null }],
      onOpen: (mb, close) => {
        const draw = () => { const items = list($('#pk-q', mb).value); $('#pk', mb).innerHTML = items.length ? items.map(c => `<button type="button" data-id="${c.id}"><b>${esc(c.name)}</b><span class="mut"> · ΑΦΜ ${esc(c.afm || '—')}${c.tel ? ' · ' + esc(c.tel) : ''}</span>${c.demo ? ' <span class="chip demo">ΔΕΙΓΜΑ</span>' : ''}</button>`).join('') : '<div class="empty">Δεν βρέθηκε πελάτης. Γράψτε τα στοιχεία του κατευθείαν στο έγγραφο και θα καταχωρηθεί με την έκδοση.</div>';
          $$('#pk button', mb).forEach(b => b.onclick = () => { chosen = DB.clients.find(c => c.id === b.dataset.id); close(null); }); };
        $('#pk-q', mb).oninput = draw; draw();
      } }).then(() => resolve(chosen));
  });
}
