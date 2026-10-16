/* ================================================================== colours, brand, logo */
const hexRgb = h => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return h.length !== 6 || isNaN(n) ? [0, 0, 0] : [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
const upper = s => String(s || '').normalize('NFD').replace(/́/g, '').normalize('NFC').toLocaleUpperCase('el');

function themeOf(B) {
  const p = B?.palette === 'custom' ? (B.custom || {}) : (PALETTES[B?.palette] || PALETTES.navy);
  const t = { dark: isHex(p.dark) ? p.dark : PALETTES.navy.dark, accent: isHex(p.accent) ? p.accent : PALETTES.navy.accent, light: isHex(p.light) ? p.light : PALETTES.navy.light };
  // keep text readable: accent on white, light on the dark sidebar
  t.accentT = contrast(t.accent, '#FFFFFF') < 3.2 ? mix(t.accent, '#000000', .38) : t.accent;
  t.lightT = contrast(t.light, t.dark) < 3 ? mix(t.light, '#FFFFFF', .55) : t.light;
  return t;
}
function applyTheme(B) {
  const t = themeOf(B), r = document.documentElement.style;
  r.setProperty('--navy', t.dark); r.setProperty('--navy-2', mix(t.dark, '#FFFFFF', .12));
  r.setProperty('--blue', t.accentT); r.setProperty('--sky', t.lightT); r.setProperty('--ice', mix(t.lightT, '#FFFFFF', .55));
}

/* the snowflake mark (same geometry as the original logo) and an initials mark */
function markSVG(kind, ring, acc, text = '') {
  const P = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }, f = v => v.toFixed(2);
  const arc = (r, a1, a2, col, w) => { const [x1, y1] = P(50, 50, r, a1), [x2, y2] = P(50, 50, r, a2); const large = (((a2 - a1) % 360) + 360) % 360 > 180 ? 1 : 0; return `<path d="M${f(x1)},${f(y1)} A${r},${r} 0 ${large} 0 ${f(x2)},${f(y2)}" fill="none" stroke="${acc}" stroke-width="${w}" stroke-linecap="round"/>`; };
  const ringP = `<circle cx="50" cy="50" r="46" fill="none" stroke="${ring}" stroke-width="5"/>` + arc(46, -60, 30, acc, 5);
  if (kind === 'initials') {
    const t = esc(text || '·'), fs = text.length > 2 ? 28 : text.length === 2 ? 36 : 44;
    return `<svg class="mk" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ringP}<text x="50" y="50" dy=".36em" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="${fs}" letter-spacing="-1" fill="${ring}">${t}</text></svg>`;
  }
  const L = 30, sw = 5.2; let parts = '';
  for (let k = 0; k < 6; k++) {
    const a = 90 + 60 * k, [ex, ey] = P(50, 50, L, a);
    parts += `<line x1="50" y1="50" x2="${f(ex)}" y2="${f(ey)}"/>`;
    for (const [fr, bl] of [[.55, 11], [.8, 7.5]]) { const [px, py] = P(50, 50, L * fr, a); for (const sg of [-1, 1]) { const [bx, by] = P(px, py, bl, a + sg * 45); parts += `<line x1="${f(px)}" y1="${f(py)}" x2="${f(bx)}" y2="${f(by)}" stroke-width="${f(sw * .78)}"/>`; } }
    parts += `<circle cx="${f(ex)}" cy="${f(ey)}" r="2.6" fill="${ring}" stroke="none"/>`;
  }
  return `<svg class="mk" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ringP}<g stroke="${ring}" stroke-width="${sw}" stroke-linecap="round">${parts}</g><circle cx="50" cy="50" r="6.5" fill="${ring}"/><circle cx="50" cy="50" r="3.2" fill="${acc}"/></svg>`;
}
const LEGAL = /^(ε\.?ε\.?|ο\.?ε\.?|α\.?ε\.?|ι\.?κ\.?ε\.?|μ\.?ι\.?κ\.?ε\.?|ε\.?π\.?ε\.?|&|και|σια|κ\.?|του|της|των)$/i;
function initialsOf(name) {
  const w = upper(name).replace(/[«»"'.,()]/g, ' ').split(/\s+/).filter(x => x && !LEGAL.test(x));
  return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] || '').slice(0, 2)) || '·';
}
function brandMark(B, onDark) {
  if (B.mark === 'none') return '';
  const t = themeOf(B);
  return markSVG(B.mark === 'initials' ? 'initials' : 'snow', onDark ? '#FFFFFF' : t.dark, onDark ? t.lightT : t.light, initialsOf(B.name));
}
const wordsHTML = B => B.name ? `<div class="wd"><div class="nm">${B.prefix ? `<span class="ini">${esc(B.prefix)}</span>` : ''}${esc(upper(B.name))}</div>${B.tagline ? `<div class="tg">${esc(upper(B.tagline))}</div>` : ''}</div>` : '';
/* lockup for the dark sidebar of documents */
function lockup(B) {
  if (B.logo && LOGO_URL) return `<div class="lk lk-img"><span class="lk-plate ${esc(B.logoMode || 'plate')}"><img src="${LOGO_URL}" alt="${esc(B.name)}"></span>${B.logoText ? wordsHTML(B) : ''}</div>`;
  return `<div class="lk">${brandMark(B, true)}${wordsHTML(B)}</div>`;
}
/* small brand for the top bar and the start screens */
function brandInline(B, onDark) {
  const img = B.logo && LOGO_URL ? `<span class="bi-img ${onDark ? 'plate' : ''}"><img src="${LOGO_URL}" alt=""></span>` : brandMark(B, onDark);
  return `<span class="bi">${img}<span class="bi-t">${B.prefix ? `<span class="ini">${esc(B.prefix)}</span> ` : ''}${esc(upper(B.name || APP.name))}</span></span>`;
}
const MT_BADGE = `<svg class="mt-b" viewBox="-25.5 -27.5 151 155" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#FF6600" fill-rule="evenodd" d="M-24.500,-5.864 L-24.500,126.500 L88.903,126.500 L124.500,105.864 L124.500,-26.500 L11.097,-26.500Z M121.500,-23.500 L121.500,104.136 L88.097,123.500 L-21.500,123.500 L-21.500,-4.136 L11.903,-23.500Z"/><path fill="#1B365D" fill-rule="evenodd" d="M11.903,-23.500 L-21.500,-4.136 L-21.500,123.500 L88.097,123.500 L121.500,104.136 L121.500,-23.500Z"/><path fill="#FFFFFF" fill-rule="evenodd" d="M50.000,64.713 L40.964,49.894 L25.382,58.915 L46.577,93.674 L50.504,97.779 L49.605,98.639 L50.000,99.287 L91.000,32.047 L91.000,100.000 L109.000,89.569 L109.000,0.000 L89.459,0.000 L42.316,77.315 L73.876,25.556Z M10.541,0.000 L9.000,0.000 L-9.000,10.409 L-9.000,100.000 L9.000,100.000 L9.000,32.047 L11.322,35.856 L26.904,26.835Z"/><path fill="#FF6600" fill-rule="evenodd" d="M109.000,5.184 L109.515,4.885 L109.000,3.997Z M89.459,0.000 L82.062,0.000 L9.000,42.376 L9.000,63.184 L9.000,80.429 L27.720,100.000 L48.182,100.000 L50.504,97.779 L14.411,60.046 L73.876,25.556Z"/></svg>`;
const mtCredit = () => `<span class="mt">${MT_BADGE}Make<b>Tech</b></span>`;
const appMark = () => `<svg class="mk" viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="4" width="30" height="38" rx="5" fill="var(--navy)"/><rect x="12" y="12" width="18" height="3" rx="1.5" fill="var(--sky)"/><rect x="12" y="19" width="13" height="3" rx="1.5" fill="#fff" opacity=".75"/><rect x="12" y="26" width="16" height="3" rx="1.5" fill="#fff" opacity=".75"/><circle cx="36" cy="36" r="9" fill="var(--blue)"/><path d="M32 36.2l2.8 2.8 5-5.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* fit name and tagline to the sidebar width: shrink the name if needed, then spread the tagline under it */
function fitLogo() {
  $$('.page .lk .wd').forEach(w => {
    const nm = $('.nm', w), tg = $('.tg', w), side = w.closest('aside'); if (!nm) return;
    let max = 190; if (side) { const cs = getComputedStyle(side); max = side.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2; }
    nm.style.fontSize = ''; nm.style.whiteSpace = ''; nm.style.lineHeight = '';
    let fs = parseFloat(getComputedStyle(nm).fontSize);
    while (nm.offsetWidth > max && fs > 14) { fs -= .5; nm.style.fontSize = fs + 'px'; }
    if (nm.offsetWidth > max) { nm.style.whiteSpace = 'normal'; nm.style.lineHeight = '1.05'; nm.style.textAlign = 'center'; nm.style.maxWidth = max + 'px'; }
    if (!tg) return;
    tg.style.letterSpacing = '0px'; tg.style.marginRight = '0px'; tg.style.fontSize = '';
    let tfs = parseFloat(getComputedStyle(tg).fontSize);
    while (tg.offsetWidth > max && tfs > 5.5) { tfs -= .25; tg.style.fontSize = tfs + 'px'; }
    const n = tg.textContent.length, diff = Math.min(nm.offsetWidth, max) - tg.offsetWidth;
    if (diff > 0 && n > 1) { const ls = Math.min(diff / (n - 1), tfs * .9); tg.style.letterSpacing = ls + 'px'; tg.style.marginRight = -ls + 'px'; }
  });
  $$('.pvwrap').forEach(w => { const p = w.firstElementChild, s = w.clientWidth / p.offsetWidth; p.style.transform = `scale(${s})`; w.style.height = Math.ceil(p.offsetHeight * s) + 'px'; });
}
const afterFonts = fn => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(fn));

/* logo upload: checks + a recommendation for how it should sit on the dark sidebar */
const LOGO_GUIDE = `<b>Τι λογότυπο να ανεβάσετε</b><ul>
  <li><b>Μορφή:</b> PNG με διάφανο φόντο (ιδανικό) ή SVG. Δεκτά και JPG / WEBP.</li>
  <li><b>Μέγεθος:</b> τουλάχιστον 600 px πλάτος για οριζόντιο, ή 400×400 px για τετράγωνο. Έως 3 MB.</li>
  <li><b>Σχήμα:</b> οριζόντιο έως 4:1 ή τετράγωνο. Κόψτε τα κενά περιθώρια γύρω από το σήμα.</li>
  <li>Εμφανίζεται στη σκούρα πλαϊνή στήλη: σκούρα λογότυπα μπαίνουν σε λευκή βάση ή γίνονται λευκά αυτόματα.</li></ul>`;
async function analyzeLogo(file) {
  const out = { warn: [], mode: 'plate' };
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { out.err = 'Επιτρέπονται αρχεία PNG, JPG, WEBP ή SVG.'; return out; }
  if (file.size > 3e6) { out.err = 'Το αρχείο είναι μεγαλύτερο από 3 MB. Μικρύνετέ το πρώτα (π.χ. στα 1000 px πλάτος).'; return out; }
  const url = URL.createObjectURL(file);
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  if (!img) { URL.revokeObjectURL(url); out.err = 'Η εικόνα δεν διαβάζεται. Δοκιμάστε να την αποθηκεύσετε ξανά ως PNG.'; return out; }
  const svg = file.type.includes('svg'), w = img.naturalWidth || 400, h = img.naturalHeight || 200;
  Object.assign(out, { w, h, ratio: w / h, svg });
  const c = document.createElement('canvas'), k = Math.min(1, 160 / Math.max(w, h)); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  let px = null; try { px = x.getImageData(0, 0, c.width, c.height).data; } catch (e) { }
  if (px) {
    let n = 0, tr = 0, dk = 0, lt = 0, col = 0, R = 0, G = 0, B = 0;
    for (let i = 0; i < px.length; i += 4) {
      n++; if (px[i + 3] < 24) { tr++; continue; }
      const r = px[i], g = px[i + 1], b = px[i + 2], L = (.2126 * r + .7152 * g + .0722 * b) / 255;
      if (L < .35) dk++; else if (L > .9) lt++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 45 && L > .1 && L < .85) { col++; R += r; G += g; B += b; }
    }
    const op = Math.max(1, n - tr);
    Object.assign(out, { transparent: tr / n > .06, dark: dk / op, light: lt / op, colorful: col / op > .04 });
    if (col > op * .04) { out.color = rgbHex([R / col, G / col, B / col]); }
    out.mode = !out.transparent ? 'plate' : out.light > .55 ? 'normal' : !out.colorful ? 'white' : 'plate';
  }
  if (!svg && Math.max(w, h) < 300) out.warn.push(`Χαμηλή ανάλυση (${w}×${h} px): στο PDF μπορεί να φαίνεται θολό. Προτιμήστε τουλάχιστον 600 px πλάτος.`);
  else if (!svg && w < 600 && w / h > 1.6) out.warn.push(`Το πλάτος είναι ${w} px. Για καθαρό αποτέλεσμα στο PDF προτιμήστε από 600 px και πάνω.`);
  if (w / h > 4.5) out.warn.push('Πολύ μακρόστενο λογότυπο: θα φαίνεται μικρό. Αν υπάρχει εκδοχή με το σήμα πάνω από το όνομα, ταιριάζει καλύτερα.');
  if (w / h < .6) out.warn.push('Πολύ ψηλό λογότυπο: θα πιάνει πολύ χώρο. Κόψτε τα κενά περιθώρια πάνω και κάτω.');
  if (out.transparent === false) out.warn.push('Η εικόνα δεν έχει διάφανο φόντο, γι’ αυτό θα μπει σε λευκή βάση. Με PNG χωρίς φόντο το αποτέλεσμα είναι πιο καθαρό.');
  return out;
}
async function saveLogo(file) {
  const B = DB.settings.brand, ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[file.type] || 'png';
  const name = 'λογότυπο.' + ext;
  await q(() => writeRaw(DIRS.settings, name, file));
  if (B.logo && B.logo !== name) await q(() => delFile(DIRS.settings, B.logo));
  B.logo = name; await loadLogo(); persistSettings();
}
async function removeLogo() { const B = DB.settings.brand; if (B.logo) await q(() => delFile(DIRS.settings, B.logo)); B.logo = ''; await loadLogo(); persistSettings(); }
const cacheBrand = () => { if (!navigator.storage || new URLSearchParams(location.search).has('opfs')) return; const B = DB.settings.brand; idbSet('brand', { name: B.name, prefix: B.prefix, mark: B.mark, palette: B.palette, custom: B.custom }).catch(() => { }); };

/* ================================================================== start screens */
let GATE_BRAND = null, LOGO_COLOR = '';
function gateHead() {
  const B = GATE_BRAND;
  return B && B.name ? `<div class="lk-row">${markSVG(B.mark === 'initials' ? 'initials' : 'snow', themeOf(B).dark, themeOf(B).light, initialsOf(B.name))}<div><b>${B.prefix ? `<span>${esc(B.prefix)}</span> ` : ''}${esc(upper(B.name))}</b><small>${esc(upper(APP.name))}</small></div></div>`
    : `<div class="lk-row">${appMark()}<div><b>${esc(APP.name)}</b><small>${esc(upper(APP.sub))} · ΠΡΟΣΦΟΡΕΣ · ΣΥΜΒΟΛΑΙΑ</small></div></div>`;
}
const gateBox = inner => `<div class="gate"><div class="box">${gateHead()}${inner}</div><div class="gate-foot">${esc(ATTRIBUTION)} · v${APP.version} ${mtCredit()}</div></div>`;
function gate(kind, handle) {
  const app = $('#app');
  if (kind === 'unsupported') { app.innerHTML = gateBox(`<h1>Ανοίξτε το με Chrome ή Edge</h1><p>Η εφαρμογή αποθηκεύει έγγραφα και πελάτες απευθείας σε φάκελο του υπολογιστή σας. Αυτό το επιτρέπουν οι Google Chrome, Microsoft Edge, Brave και Opera σε υπολογιστή.</p><p>Κάντε δεξί κλικ στο αρχείο → «Άνοιγμα με» → Chrome ή Edge.</p>`); return; }
  if (kind === 'busy' || kind === 'taken') {
    app.innerHTML = gateBox(`<h1>${kind === 'busy' ? 'Η εφαρμογή είναι ήδη ανοιχτή' : 'Η εφαρμογή άνοιξε σε άλλο παράθυρο'}</h1><p>${kind === 'busy' ? 'Είναι ανοιχτή σε άλλη καρτέλα ή παράθυρο. Για να μη χαθούν αλλαγές, δουλεύετε σε ένα μόνο παράθυρο τη φορά.' : 'Για να μη χαθούν αλλαγές, αυτό το παράθυρο σταμάτησε. Οι αλλαγές σας έχουν αποθηκευτεί.'}</p>
      <div class="acts"><button class="btn blue" id="g-here" type="button">Συνέχεια σε αυτό το παράθυρο</button></div>`);
    $('#g-here').onclick = () => { BC?.postMessage('take'); setTimeout(start, 150); };
    return;
  }
  if (kind === 'reconnect') {
    app.innerHTML = gateBox(`<h1>Συνέχεια στον φάκελο «${esc(handle.name)}»</h1><p>Για λόγους ασφαλείας ο browser ζητά άδεια κάθε φορά που ανοίγει η εφαρμογή. Πατήστε «Συνέχεια» και μετά «Επεξεργασία αρχείων» ή «Να επιτρέπεται».</p>
      <div class="acts"><button class="btn blue" id="g-go" type="button">Συνέχεια</button><button class="btn ghost" id="g-other" type="button">Άλλος φάκελος</button></div>`);
    $('#g-go').onclick = async () => { try { if (await handle.requestPermission({ mode: 'readwrite' }) === 'granted') { root = handle; start(); } } catch (e) { toast('Δεν δόθηκε άδεια στον φάκελο'); } };
    $('#g-other').onclick = () => gate('welcome');
    return;
  }
  app.innerHTML = gateBox(`<h1>Επιλέξτε τον φάκελο δεδομένων</h1>
    <p>Όλα τα έγγραφα, οι πελάτες και οι ρυθμίσεις αποθηκεύονται ως αρχεία σε έναν φάκελο που διαλέγετε εσείς. Μέσα του δημιουργούνται οι υποφάκελοι Πελάτες, Προσφορές, Προτιμολόγια, Συμβόλαια, Ρυθμίσεις και Αντίγραφα. Τίποτα δεν αποθηκεύεται στον browser.</p>
    <div class="tip"><b>Προτείνεται:</b> ένας φάκελος μέσα στο Google Drive, OneDrive ή Dropbox του υπολογιστή. Έτσι όλα ανεβαίνουν αυτόματα στο cloud και μεταφέρονται με ένα απλό αντίγραφο του φακέλου.</div>
    <div class="acts"><button class="btn blue" id="g-pick" type="button">Επιλογή φακέλου</button></div>`);
  $('#g-pick').onclick = pickFolder;
}
async function pickFolder() {
  try { const h = await window.showDirectoryPicker({ id: 'documents-app', mode: 'readwrite' }); await flushAll(); await idbSet('root', h); root = h; start(); }
  catch (e) { if (e.name !== 'AbortError') toast('Ο φάκελος δεν άνοιξε: ' + e.message); }
}

/* one window at a time */
const BC = 'BroadcastChannel' in window ? new BroadcastChannel('documents-app') : null;
let ACTIVE = false;
if (BC) BC.onmessage = e => {
  if (e.data === 'ping' && ACTIVE) BC.postMessage('pong');
  if (e.data === 'take' && ACTIVE) { ACTIVE = false; flushAll(); gate('taken'); }
};
const otherWindow = () => new Promise(res => { if (!BC) return res(false); let got = false; const h = e => { if (e.data === 'pong') got = true; }; BC.addEventListener('message', h); BC.postMessage('ping'); setTimeout(() => { BC.removeEventListener('message', h); res(got); }, 300); });

async function start() {
  if (await otherWindow()) return gate('busy');
  ACTIVE = true;
  $('#app').innerHTML = gateBox('<p>Φόρτωση φακέλου…</p>');
  await loadAll();
  if (!DB.settings) { DB.settings = normSettings(null); await saveSettingsNow(); }
  applyTheme(DB.settings.brand); cacheBrand();
  if (!DB.settings.setupDone) return viewSetup();
  shell(); go('home');
  if (DB.dupes) toast(`Βρέθηκαν ${DB.dupes} διπλότυπα αρχεία συγχρονισμού · κρατήθηκε η νεότερη εκδοχή, τα άλλα μεταφέρθηκαν στα Αντίγραφα`);
}
async function boot() {
  const P = new URLSearchParams(location.search);
  if (P.has('opfs')) { // test mode: private browser storage instead of a real folder
    root = await navigator.storage.getDirectory();
    if (P.has('reset')) { const n = []; for await (const [k] of root.entries()) n.push(k); for (const k of n) await root.removeEntry(k, { recursive: true }); history.replaceState(null, '', location.pathname + '?opfs=1'); }
    return start();
  }
  if (!window.showDirectoryPicker) return gate('unsupported');
  try { GATE_BRAND = await idbGet('brand'); if (GATE_BRAND) applyTheme(GATE_BRAND); } catch (e) { }
  let h = null; try { h = await idbGet('root'); } catch (e) { }
  if (!h) try { idbName = IDB_LEGACY; h = await idbGet('root'); idbName = IDB_NAME; if (h) await idbSet('root', h); } catch (e) { idbName = IDB_NAME; }
  if (h) { try { if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') { root = h; return start(); } } catch (e) { } return gate('reconnect', h); }
  gate('welcome');
}

/* ================================================================== shell + routing */
let view = { name: 'home' }, cur = null;
const filt = { docs: { q: '', t: 'all' }, clients: { q: '' }, contracts: { q: '', t: 'all' } };
const VIEW_TITLES = { home: 'Αρχική', docs: 'Έγγραφα', clients: 'Πελάτες', client: 'Πελάτης', doc: 'Έγγραφο', contracts: 'Συμβόλαια', settings: 'Ρυθμίσεις', visit: 'Δελτίο επίσκεψης' };
function shell() {
  const B = DB.settings.brand;
  $('#app').innerHTML = `<header class="top so">
    <button class="brandmini" type="button" data-go="home" title="Αρχική">${brandInline(B, true)}</button>
    <nav class="tabs" aria-label="Ενότητες">${['home', 'docs', 'clients', 'contracts', 'settings'].map(k => `<button type="button" data-go="${k}">${VIEW_TITLES[k]}</button>`).join('')}</nav>
    <span class="sp"></span><div class="status" id="status" aria-live="polite"></div>
    <div class="dd"><button class="btn primary" id="b-new" type="button" aria-haspopup="menu">+ Νέο</button>
      <div class="menu" id="m-new" role="menu" hidden>
        <button type="button" data-new="offer"><span class="ic chip offer">Π</span>Προσφορά</button>
        <button type="button" data-new="proforma"><span class="ic chip proforma">Π</span>Προτιμολόγιο</button>
        <button type="button" data-new="contract"><span class="ic chip contract">Σ</span>Συμβόλαιο συντήρησης</button>
        <hr><button type="button" data-new="client"><span class="ic chip">+</span>Πελάτης</button>
      </div></div>
  </header><div id="demobar"></div><div id="view"></div>`;
  $$('[data-go]', $('.top')).forEach(b => b.onclick = () => go(b.dataset.go));
  const mn = $('#m-new');
  $('#b-new').onclick = e => { e.stopPropagation(); mn.hidden = !mn.hidden; };
  $$('[data-new]', mn).forEach(b => b.onclick = () => { mn.hidden = true; const t = b.dataset.new; if (t === 'client') go('client', 'new'); else if (t === 'contract') newContractFlow(); else openNewDoc(t); });
  setStatus(); drawDemoBar();
}
document.addEventListener('click', e => { $$('.menu').forEach(m => { if (!m.contains(e.target) && !m.parentElement.contains(e.target)) m.hidden = true; }); });
const hasDemo = () => DB.clients.some(c => c.demo) || DB.docs.some(d => d.demo);
function drawDemoBar() {
  const el = $('#demobar'); if (!el) return;
  el.innerHTML = hasDemo() ? `<div class="demobar so"><b>Δεδομένα επίδειξης</b><span>Οι πελάτες και τα έγγραφα με την ένδειξη ΔΕΙΓΜΑ είναι για δοκιμή και δεν επηρεάζουν την αρίθμηση.</span><button class="btn sm" type="button" id="b-rmdemo">Αφαίρεση δεδομένων επίδειξης</button></div>` : '';
  if ($('#b-rmdemo')) $('#b-rmdemo').onclick = removeDemo;
}
const appFoot = () => `<footer class="appfoot so">${mtCredit()} ${esc(ATTRIBUTION)} · v${APP.version}${root?.name ? ` · φάκελος «${esc(root.name)}»` : ''}</footer>`;
function go(name, arg) {
  if (view.name === 'doc' && cur) { if (!cur.file && !meaningful(cur)) DB.docs = DB.docs.filter(d => d !== cur); else persistDoc(cur, true); }
  view = { name, arg }; cur = null; document.body.classList.remove('print-draft');
  const isCon = (name === 'doc' && DB.docs.find(x => x.id === arg)?.type === 'contract') || name === 'visit';
  const tab = name === 'doc' ? (isCon ? 'contracts' : 'docs') : name === 'client' ? 'clients' : name === 'visit' ? 'contracts' : name;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
  ({ home: viewHome, docs: viewDocs, clients: viewClients, client: viewClient, doc: viewDoc, contracts: viewContracts, settings: viewSettings, visit: viewVisit })[name](arg);
  if ($('#view > .view')) $('#view').insertAdjacentHTML('beforeend', appFoot());
  document.title = (DB.settings.brand.name || APP.name) + ' · ' + VIEW_TITLES[name];
  drawDemoBar();
  scrollTo(0, 0);
}

/* ================================================================== shared editors (setup wizard + settings) */
const ISS_FIELDS = [['name', 'Επωνυμία / Ονοματεπώνυμο', 'req wide'], ['father', 'Πατρώνυμο ή δεύτερη γραμμή', ''], ['act', 'Δραστηριότητα', ''], ['addr', 'Διεύθυνση', 'wide'], ['afm', 'ΑΦΜ', ''], ['doy', 'ΔΟΥ', ''], ['tel', 'Τηλέφωνο', ''], ['email', 'Email', '']];
function issuerForm(el, S, onChange) {
  el.innerHTML = `<div class="form">${ISS_FIELDS.map(([k, l, c]) => `<div class="f ${c}"><label for="s-${k}">${l}</label><input id="s-${k}" data-iss="${k}" value="${esc(S.iss[k])}" ${k === 'afm' ? 'inputmode="numeric" maxlength="11"' : ''} ${k === 'father' ? 'placeholder="π.χ. του Νικολάου (προαιρετικό)"' : ''}></div>`).join('')}</div><div class="iss-err"></div>`;
  const chk = () => { const a = S.iss.afm.trim(), p = a ? afmFormat(a) : ''; $('#s-afm', el).classList.toggle('bad', !!p); $('.iss-err', el).innerHTML = p ? `<div class="warnbox">ΑΦΜ εκδότη: ${esc(p)}</div>` : ''; };
  $$('[data-iss]', el).forEach(i => i.oninput = () => {
    const k = i.dataset.iss, old = S.iss[k]; S.iss[k] = i.value;
    // the brand follows the business name / activity until it is edited by hand
    if (k === 'name' && (!S.brand.name || S.brand.name === old)) S.brand.name = i.value;
    if (k === 'act' && (!S.brand.tagline || S.brand.tagline === old)) S.brand.tagline = i.value;
    onChange && onChange(k);
  });
  $('#s-afm', el).onblur = chk; if (S.iss.afm) chk();
}
function bizPicker(el, S, onChange) {
  const opts = [['hvac', 'Ψύξη & κλιματισμός', 'Μηχανήματα με μάρκα και BTU, εγγυήσεις, συμβόλαια συντήρησης κλιματιστικών.'], ['general', 'Γενική επιχείρηση', 'Τεχνικές εργασίες, υπηρεσίες, εξοπλισμός πελατών, συμβόλαια συντήρησης.']];
  el.innerHTML = `<div class="biz">${opts.map(([k, t, s]) => `<button type="button" class="biz-o ${S.biz === k ? 'on' : ''}" data-biz="${k}" aria-pressed="${S.biz === k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>`;
  $$('[data-biz]', el).forEach(b => b.onclick = () => { if (S.biz === b.dataset.biz) return; S.biz = b.dataset.biz; $$('[data-biz]', el).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); onChange && onChange(); });
}
function ibanProblem(v) {
  const c = String(v || '').replace(/\s+/g, '').toUpperCase(); if (!c) return '';
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(c)) return 'Το IBAN δεν έχει σωστή μορφή.';
  if (c.startsWith('GR') && c.length !== 27) return 'Το ελληνικό IBAN έχει 27 χαρακτήρες.';
  const r = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55); let m = 0; for (const d of r) m = (m * 10 + +d) % 97;
  return m === 1 ? '' : 'Το IBAN δεν είναι έγκυρο (λάθος ψηφίο ελέγχου).';
}
function accountsEditor(el, S, onChange) {
  const draw = () => {
    el.innerHTML = (S.accounts.length ? '' : '<p class="note" style="margin:0 0 10px">Δεν υπάρχει λογαριασμός. Τα έγγραφα θα δείχνουν μόνο την αιτιολογία πληρωμής.</p>') + S.accounts.map((a, i) => `<div class="acc-r"><div class="f"><label for="a-b${i}">Τράπεζα</label><input id="a-b${i}" data-a="${i}" data-f="bank" value="${esc(a.bank)}" placeholder="π.χ. Alpha Bank"></div>
      <div class="f"><label for="a-i${i}">IBAN</label><input id="a-i${i}" data-a="${i}" data-f="iban" value="${esc(a.iban)}" placeholder="GR.."></div><button class="btn sm danger" type="button" data-rm="${i}" aria-label="Αφαίρεση λογαριασμού" title="Αφαίρεση">×</button><div class="acc-e" id="ae${i}"></div></div>`).join('')
      + `<button class="btn sm" type="button" id="b-acc">+ Λογαριασμός</button>`;
    const chk = i => { const p = ibanProblem(S.accounts[i]?.iban); $('#ae' + i, el).innerHTML = p ? `<span>${esc(p)}</span>` : ''; $('#a-i' + i, el).classList.toggle('bad', !!p); };
    $$('input', el).forEach(inp => { const i = +inp.dataset.a; inp.oninput = () => { S.accounts[i][inp.dataset.f] = inp.value; onChange && onChange(); }; if (inp.dataset.f === 'iban') { inp.onblur = () => { inp.value = S.accounts[i].iban = fmtIban(inp.value); chk(i); onChange && onChange(); }; if (inp.value) chk(i); } });
    $$('[data-rm]', el).forEach(b => b.onclick = () => { S.accounts.splice(+b.dataset.rm, 1); onChange && onChange(); draw(); });
    $('#b-acc', el).onclick = () => { S.accounts.push({ bank: '', iban: '' }); draw(); $$('input[data-f=bank]', el).pop().focus(); };
  };
  draw();
}
function brandEditor(el, S, onChange) {
  const B = S.brand;
  const draw = () => {
    const pal = Object.entries(PALETTES).map(([k, p]) => `<button type="button" class="sw ${B.palette === k ? 'on' : ''}" data-pal="${k}" title="${p.label}" aria-label="Χρώματα: ${p.label}" aria-pressed="${B.palette === k}"><i style="background:${p.dark}"></i><i style="background:${p.accent}"></i><i style="background:${p.light}"></i><span>${p.label}</span></button>`).join('')
      + `<button type="button" class="sw ${B.palette === 'custom' ? 'on' : ''}" data-pal="custom" aria-pressed="${B.palette === 'custom'}"><i style="background:${B.custom.dark}"></i><i style="background:${B.custom.accent}"></i><i style="background:${B.custom.light}"></i><span>Δικά σας</span></button>`;
    el.innerHTML = `<div class="form">
        <div class="f wide"><label for="b-name">Όνομα στο λογότυπο</label><input id="b-name" value="${esc(B.name)}" placeholder="π.χ. Παπαδόπουλος"></div>
        <div class="f"><label for="b-prefix">Πρόθεμα (προαιρετικό)</label><input id="b-prefix" value="${esc(B.prefix)}" maxlength="6" placeholder="π.χ. Γ."></div>
        <div class="f"><label for="b-tag">Υπότιτλος</label><input id="b-tag" value="${esc(B.tagline)}" placeholder="π.χ. Ηλεκτρολογικές εγκαταστάσεις"></div></div>
      <div class="sub-h">Σήμα</div>
      <div class="marks">${[['snow', 'Χιονονιφάδα', markSVG('snow', themeOf(B).dark, themeOf(B).light)], ['initials', 'Αρχικά', markSVG('initials', themeOf(B).dark, themeOf(B).light, initialsOf(B.name))], ['none', 'Μόνο κείμενο', '<span class="mk-none">Αα</span>']].map(([k, l, s]) => `<button type="button" class="mko ${!B.logo && B.mark === k ? 'on' : ''}" data-mark="${k}" aria-pressed="${!B.logo && B.mark === k}">${s}<span>${l}</span></button>`).join('')}
        <label class="mko up ${B.logo ? 'on' : ''}" for="b-file">${B.logo && LOGO_URL ? `<span class="bi-img plate"><img src="${LOGO_URL}" alt=""></span>` : '<span class="mk-none">⇪</span>'}<span>${B.logo ? 'Το λογότυπό σας' : 'Ανέβασμα λογότυπου'}</span></label><input type="file" id="b-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></div>
      <div id="b-logo-info"></div>
      ${B.logo ? `<div class="form" style="margin-top:10px"><div class="f"><label for="b-mode">Εμφάνιση στη σκούρα στήλη</label><select id="b-mode">${[['plate', 'Σε λευκή βάση'], ['white', 'Λευκό (μονόχρωμο)'], ['normal', 'Όπως είναι']].map(([k, l]) => `<option value="${k}" ${B.logoMode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="f" style="align-self:end"><label class="chk"><input type="checkbox" id="b-ltext" ${B.logoText ? 'checked' : ''}> Και το όνομα κάτω από το λογότυπο</label></div>
        <div class="f" style="align-self:end"><button class="btn sm danger" type="button" id="b-rmlogo">Αφαίρεση λογότυπου</button></div></div>` : ''}
      <details class="guide" ${B.logo ? '' : 'open'}><summary>Οδηγίες για το λογότυπο</summary>${LOGO_GUIDE}</details>
      <div class="sub-h">Χρώματα εγγράφων</div><div class="sws">${pal}</div>
      ${B.palette === 'custom' ? `<div class="form" style="margin-top:10px">${[['dark', 'Σκούρο (πλαϊνή στήλη)'], ['accent', 'Κύριο (τίτλοι)'], ['light', 'Ανοιχτό (λεπτομέρειες)']].map(([k, l]) => `<div class="f"><label for="b-c-${k}">${l}</label><input type="color" id="b-c-${k}" data-cc="${k}" value="${esc(B.custom[k])}"></div>`).join('')}</div>` : ''}
      ${LOGO_COLOR ? `<button class="btn sm" type="button" id="b-fromlogo" style="margin-top:10px">Χρώματα από το λογότυπο</button>` : ''}
      <label class="chk" style="margin-top:14px"><input type="checkbox" id="b-credit" ${B.credit ? 'checked' : ''}> Διακριτική υπογραφή «${esc(APP.name)} · MakeTech» στο κάτω μέρος των εγγράφων</label>`;
    const ch = (redraw) => { applyTheme(B); persistSettings(); onChange && onChange(); if (redraw) draw(); };
    $('#b-name', el).oninput = e => { B.name = e.target.value; ch(); $$('.mko[data-mark=initials] svg', el).forEach(s => s.outerHTML = markSVG('initials', themeOf(B).dark, themeOf(B).light, initialsOf(B.name))); };
    $('#b-prefix', el).oninput = e => { B.prefix = e.target.value; ch(); };
    $('#b-tag', el).oninput = e => { B.tagline = e.target.value; ch(); };
    $$('[data-mark]', el).forEach(b => b.onclick = async () => { B.mark = b.dataset.mark; if (B.logo) { if (!(await confirmBox('Χρήση σήματος', 'Να αφαιρεθεί το λογότυπο που ανεβάσατε και να μπει το σήμα;', 'Αφαίρεση λογότυπου'))) return; await removeLogo(); } ch(true); });
    $$('[data-pal]', el).forEach(b => b.onclick = () => { B.palette = b.dataset.pal; ch(true); });
    $$('[data-cc]', el).forEach(i => i.oninput = () => { B.custom[i.dataset.cc] = i.value; ch(); $$('.sw[data-pal=custom] i', el)[['dark', 'accent', 'light'].indexOf(i.dataset.cc)].style.background = i.value; });
    $('#b-credit', el).onchange = e => { B.credit = e.target.checked; ch(); };
    if ($('#b-mode', el)) $('#b-mode', el).onchange = e => { B.logoMode = e.target.value; ch(); };
    if ($('#b-ltext', el)) $('#b-ltext', el).onchange = e => { B.logoText = e.target.checked; ch(); };
    if ($('#b-rmlogo', el)) $('#b-rmlogo', el).onclick = async () => { await removeLogo(); LOGO_COLOR = ''; ch(true); };
    if ($('#b-fromlogo', el)) $('#b-fromlogo', el).onclick = () => { const a = LOGO_COLOR; B.custom = { dark: contrast(a, '#000') > 6 ? mix(a, '#000000', .72) : mix(a, '#000000', .45), accent: a, light: mix(a, '#FFFFFF', .55) }; B.palette = 'custom'; ch(true); };
    $('#b-file', el).onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const a = await analyzeLogo(f), info = $('#b-logo-info', el);
      if (a.err) { info.innerHTML = `<div class="errbox">${esc(a.err)}</div>`; return; }
      await saveLogo(f); B.logoMode = a.mode; LOGO_COLOR = a.color || '';
      ch(true);
      $('#b-logo-info', el).innerHTML = `<div class="${a.warn.length ? 'warnbox' : 'okbox'}"><b>Το λογότυπο ανέβηκε</b> (${a.svg ? 'SVG' : a.w + '×' + a.h + ' px'}). Προτεινόμενη εμφάνιση: ${{ plate: 'σε λευκή βάση', white: 'λευκό μονόχρωμο', normal: 'όπως είναι' }[a.mode]} — αλλάζει από κάτω.${a.warn.map(w => `<br>• ${esc(w)}`).join('')}</div>`;
    };
  };
  draw();
}
/* small live preview of the sidebar of a document */
function previewHTML(S) {
  const iss = S.iss, accts = S.accounts.filter(a => a.bank || a.iban);
  return `<div class="pvwrap"><div class="page pvpage"><aside>
      <div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">Εκδότης</div><span class="strong">${esc(iss.name) || '<span class="k">Επωνυμία</span>'}</span>${iss.father ? '<br>' + esc(iss.father) : ''}${iss.addr ? '<br>' + esc(iss.addr) : ''}${iss.afm ? `<br><span class="k">ΑΦΜ</span> ${esc(iss.afm)}` : ''}${iss.doy ? `<br><span class="k">ΔΟΥ</span> ${esc(iss.doy)}` : ''}${iss.tel ? `<br><span class="k">Τηλ.</span> ${esc(iss.tel)}` : ''}${iss.email ? '<br>' + esc(iss.email) : ''}</div>
      <div class="blk"><div class="lbl">Πληρωμή</div>${accts.map(a => `<div class="acct"><span class="k">${esc(a.bank)}</span><br><span class="iban">${esc(a.iban)}</span></div>`).join('') || '<span class="k">—</span>'}</div>
      <div class="totalbox"><div class="lbl">Σύνολο με ΦΠΑ</div><div class="big num">1.240,00 €</div></div>
      ${S.brand.credit ? creditHTML() : ''}</aside>
    <main><div class="hA"><div><div class="eb">ΠΡΟΣΦΟΡΑ</div><div class="hA-no">ΠΡΦ-${new Date().getFullYear()}-001</div></div></div><div class="lbl">Προς</div><div class="to"><span class="nm2">Πελάτης</span>Διεύθυνση πελάτη</div>
      <table><thead><tr><th style="width:7mm">#</th><th>ΠΕΡΙΓΡΑΦΗ</th><th class="r" style="width:22mm">ΣΥΝΟΛΟ</th></tr></thead><tbody><tr><td class="n">01</td><td><span class="it-t">Εργασία</span></td><td class="r b">1.000,00 €</td></tr></tbody></table></main></div></div>`;
}
const creditHTML = () => `<div class="credit">${MT_BADGE}<span>${esc(APP.name)} · Make<b>Tech</b></span></div>`;

/* ================================================================== first-run wizard */
function viewSetup() {
  const S = DB.settings; let step = 0; const steps = ['Επιχείρηση', 'Εμφάνιση', 'Πληρωμές', 'Έναρξη'];
  if (!S.brand.name) S.brand.name = S.iss.name;
  $('#app').innerHTML = `<div class="setup"><header class="setup-h">${appMark()}<div><b>${esc(APP.name)} · ${esc(APP.sub)}</b><span>Πρώτη ρύθμιση · ${mtCredit()}</span></div><ol class="steps" id="steps"></ol></header>
    <div class="setup-b"><div class="card section setup-f" id="sf"></div><div class="setup-pv"><div class="sub-h">Προεπισκόπηση εγγράφου</div><div id="pv"></div></div></div></div>`;
  const pv = () => { $('#pv').innerHTML = previewHTML(S); afterFonts(fitLogo); };
  const draw = () => {
    $('#steps').innerHTML = steps.map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><i>${i < step ? '✓' : i + 1}</i>${s}</li>`).join('');
    const f = $('#sf');
    const nav = `<div class="setup-nav">${step ? '<button class="btn" type="button" id="w-back">← Πίσω</button>' : ''}<span class="sp"></span><button class="btn blue" type="button" id="w-next">${step === steps.length - 1 ? 'Ολοκλήρωση' : 'Συνέχεια →'}</button></div>`;
    if (step === 0) {
      f.innerHTML = `<h3>Στοιχεία της επιχείρησης</h3><p class="note">Εμφανίζονται ως «Εκδότης» σε κάθε προσφορά, προτιμολόγιο και συμβόλαιο. Αλλάζουν όποτε θέλετε από τις Ρυθμίσεις.</p><div id="w-iss"></div>
        <div class="sub-h">Είδος επιχείρησης</div><div id="w-biz"></div>${nav}`;
      issuerForm($('#w-iss'), S, () => { persistSettings(); pv(); });
      bizPicker($('#w-biz'), S, () => { S.checklist = clone(CHECKLISTS[S.biz]); S.exclusions = clone(EXCLUSIONS[S.biz]); if (!S.brand.logo && S.brand.mark !== 'none') S.brand.mark = S.biz === 'hvac' ? 'snow' : 'initials'; persistSettings(); pv(); });
    } else if (step === 1) {
      f.innerHTML = `<h3>Λογότυπο και χρώματα</h3><p class="note">Ανεβάστε το λογότυπό σας ή χρησιμοποιήστε ένα έτοιμο σήμα με το όνομα. Τα χρώματα εφαρμόζονται στα έγγραφα και στην εφαρμογή.</p><div id="w-brand"></div>${nav}`;
      brandEditor($('#w-brand'), S, pv);
    } else if (step === 2) {
      f.innerHTML = `<h3>Τραπεζικοί λογαριασμοί</h3><p class="note">Τυπώνονται στα έγγραφα για την πληρωμή. Προσθέστε όσους θέλετε ή κανέναν.</p><div id="w-acc"></div>
        <div class="sub-h">Προεπιλογές νέων εγγράφων</div><div class="form">
        <div class="f"><label for="w-vat">ΦΠΑ %</label><input id="w-vat" type="number" min="0" max="100" value="${esc(S.defaults.vat)}"></div>
        <div class="f"><label for="w-adv">Προκαταβολή %</label><input id="w-adv" type="number" min="0" max="100" value="${esc(S.defaults.adv)}"></div>
        <div class="f"><label for="w-days">Ισχύς προσφοράς (ημέρες)</label><input id="w-days" type="number" min="1" value="${esc(S.defaults.days)}"></div></div>${nav}`;
      accountsEditor($('#w-acc'), S, () => { persistSettings(); pv(); });
      [['w-vat', 'vat'], ['w-adv', 'adv'], ['w-days', 'days']].forEach(([i, k]) => $('#' + i).oninput = e => { S.defaults[k] = num(e.target.value); persistSettings(); });
    } else {
      const empty = !DB.clients.length && !DB.docs.length;
      f.innerHTML = `<h3>Έτοιμοι</h3><p class="note">Ο φάκελος «${esc(root?.name || '')}» είναι έτοιμος. Μπορείτε να ξεκινήσετε κατευθείαν ή να δείτε πρώτα πώς δουλεύει με δεδομένα επίδειξης.</p>
        ${empty ? `<label class="demo-o"><input type="checkbox" id="w-demo"><span><b>Φόρτωση δεδομένων επίδειξης</b>4 πελάτες, προσφορές, προτιμολόγια με πληρωμές, συμβόλαιο με επισκέψεις. Είναι σημαδεμένα «ΔΕΙΓΜΑ», δεν επηρεάζουν την αρίθμηση και αφαιρούνται με ένα κουμπί.</span></label>` : ''}
        <div class="tip">Συμβουλή: κρατήστε τον φάκελο μέσα στο Google Drive ή OneDrive για αυτόματο αντίγραφο στο cloud. Επιπλέον, η εφαρμογή κρατά ημερήσια αντίγραφα στον υποφάκελο «Αντίγραφα».</div>${nav}`;
    }
    if ($('#w-back')) $('#w-back').onclick = () => { step--; draw(); };
    $('#w-next').onclick = async () => {
      if (step === 0) {
        if (!S.iss.name.trim()) { toast('Συμπληρώστε την επωνυμία'); $('#s-name').classList.add('bad'); return $('#s-name').focus(); }
        if (S.iss.afm.trim() && afmFormat(S.iss.afm)) { toast('Διορθώστε το ΑΦΜ ή αφήστε το κενό'); return $('#s-afm').focus(); }
        if (!S.brand.name) S.brand.name = S.iss.name;
      }
      if (step < steps.length - 1) { step++; draw(); scrollTo(0, 0); return; }
      const demo = $('#w-demo')?.checked;
      S.setupDone = true; cancelLater('settings'); await q(saveSettingsNow); cacheBrand();
      shell();
      if (demo) await loadDemo(); else go('home');
    };
    pv();
  };
  draw();
}
