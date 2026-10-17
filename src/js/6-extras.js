/* ================================================================== receivables: what each client owes and for how long */
const AGE = [[0, 30, '0–30'], [31, 60, '31–60'], [61, 90, '61–90'], [91, 1e9, '90+']];
function debtRows() {
  const T = todayISO(), by = new Map();
  for (const d of DB.docs.filter(owing)) {
    const key = d.clientId || 'n:' + d.cl.name, age = Math.max(0, daysBetween(d.issuedAt || d.date, T)), bal = Math.max(0, balanceOf(d));
    if (!by.has(key)) by.set(key, { c: DB.clients.find(x => x.id === d.clientId) || null, name: d.cl.name, docs: [], b: [0, 0, 0, 0], tot: 0, oldest: 0 });
    const r = by.get(key); r.docs.push({ d, age, bal }); r.tot += bal; r.oldest = Math.max(r.oldest, age);
    r.b[AGE.findIndex(([a, z]) => age >= a && age <= z)] += bal;
  }
  return [...by.values()].sort((a, b) => b.oldest - a.oldest || b.tot - a.tot);
}
function viewDebts() {
  const f = filt.debts, all = debtRows();
  const sumB = i => all.reduce((a, r) => a + r.b[i], 0), total = all.reduce((a, r) => a + r.tot, 0);
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Οφειλές πελατών', 'Client receivables')}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Αναζήτηση πελάτη', 'Search client')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση πελάτη', 'Search client')}">
    <button class="btn sm" type="button" id="b-csv">⇩ CSV</button></div>
    <div class="tiles" style="margin-bottom:16px">
      <div class="tile static"><span>${tr('Σύνολο οφειλών', 'Total owed')}</span><b class="num">${eur(total)}</b><small>${plural(all.length, tr('πελάτης', 'client'), tr('πελάτες', 'clients'))}</small></div>
      ${AGE.map(([, , l], i) => `<div class="tile static ${i >= 2 && sumB(i) > 0 ? 'hot' : ''}"><span>${l} ${tr('ημέρες', 'days')}</span><b class="num">${eur(sumB(i))}</b><small>${total ? Math.round(sumB(i) / total * 100) : 0}%</small></div>`).join('')}
    </div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Πελάτης', 'Client')}</th><th class="r">${tr('Έγγραφα', 'Documents')}</th>${AGE.map(([, , l]) => `<th class="r">${l}</th>`).join('')}<th class="r">${tr('Σύνολο', 'Total')}</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
    <p class="note vnote">${tr('Ηλικία = ημέρες από την έκδοση του εγγράφου. Μετρούν τα εκδομένα προτιμολόγια και συμβόλαια με υπόλοιπο (όχι οι προσφορές ούτε τα ακυρωμένα). Πατήστε σε έναν πελάτη για τα έγγραφά του.', 'Age = days since the document was issued. Issued proforma invoices and agreements with a balance count (not quotations or cancelled documents). Click a client to see their documents.')}</p></div>`;
  const open = new Set();
  const draw = () => {
    const ql = f.q.toLowerCase(), rows = all.filter(r => !ql || r.name.toLowerCase().includes(ql));
    $('#rows').innerHTML = rows.length ? rows.map((r, i) => `<tr class="click" data-i="${i}" tabindex="0"><td><b>${esc(r.name)}</b>${r.c?.demo ? demoChip(r.c) : ''}<span class="sub">${tr('παλαιότερο', 'oldest')}: ${plural(r.oldest, tr('ημέρα', 'day'), tr('ημέρες', 'days'))}</span></td><td class="r num">${r.docs.length}</td>${r.b.map((v, k) => `<td class="r num ${v > 0 && k >= 2 ? 'hot' : ''}">${v > 0.005 ? eur(v) : '<span class="mut">—</span>'}</td>`).join('')}<td class="r num"><b>${eur(r.tot)}</b></td><td class="r acts">${r.c ? `<button class="btn sm" type="button" data-rem="${i}">${tr('Υπενθύμιση', 'Reminder')}</button>` : ''}</td></tr>
      ${open.has(i) ? r.docs.map(x => `<tr class="click sub2" data-doc="${x.d.id}"><td colspan="2"><span class="chip ${x.d.type}">${ttl(x.d.type)}</span> <b>${esc(x.d.no)}</b> <span class="mut">· ${fmtDate(x.d.issuedAt || x.d.date)}</span></td><td colspan="4" class="mut">${plural(x.age, tr('ημέρα', 'day'), tr('ημέρες', 'days'))} · ${tr('σύνολο', 'total')} ${eur(totals(x.d).tot)} · ${tr('πληρώθηκαν', 'paid')} ${eur(paidOf(x.d))}</td><td class="r num">${eur(x.bal)}</td><td></td></tr>`).join('') : ''}`).join('')
      + (rows.length > 1 ? `<tr class="tot"><td><b>${tr('Σύνολο', 'Total')}</b></td><td class="r num">${rows.reduce((a, r) => a + r.docs.length, 0)}</td>${AGE.map((_, k) => `<td class="r num"><b>${eur(rows.reduce((a, r) => a + r.b[k], 0))}</b></td>`).join('')}<td class="r num"><b>${eur(rows.reduce((a, r) => a + r.tot, 0))}</b></td><td></td></tr>` : '')
      : `<tr><td colspan="8"><div class="empty"><b>${tr('Δεν υπάρχουν οφειλές', 'Nothing is owed')}</b>${tr('Όλα τα εκδομένα προτιμολόγια και συμβόλαια είναι εξοφλημένα.', 'All issued proforma invoices and agreements are paid.')}</div></td></tr>`;
    $$('#rows tr[data-i]').forEach(r => r.onclick = e => { if (e.target.closest('button')) return; const i = +r.dataset.i; open.has(i) ? open.delete(i) : open.add(i); draw(); });
    $$('#rows tr[data-doc]').forEach(r => r.onclick = () => go('doc', r.dataset.doc));
    $$('[data-rem]').forEach(b => b.onclick = e => { e.stopPropagation(); statementDialog(rows[+b.dataset.rem].c); });
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $('#b-csv').onclick = exportDebtsCSV;
  draw();
}
function exportDebtsCSV() {
  csv(`${tr('οφειλές', 'receivables')}_${todayISO()}.csv`, [tr('Πελάτης', 'Client'), tr('ΑΦΜ', 'Tax no.'), tr('Έγγραφο', 'Document'), tr('Ημερομηνία', 'Date'), tr('Ημέρες', 'Days'), tr('Σύνολο', 'Total'), tr('Πληρωμές', 'Payments'), tr('Υπόλοιπο', 'Balance')],
    debtRows().flatMap(r => r.docs.map(x => [r.name, x.d.cl.afm, x.d.no, fmtDate(x.d.issuedAt || x.d.date), String(x.age), totals(x.d).tot, paidOf(x.d), x.bal])));
}
/* a friendly payment reminder listing the open documents, in the client's language */
function statementDialog(c) {
  const saved = DL; DL = langForClient(c);
  const S = DB.settings, iss = issFor(S.iss), B = brandFor(S.brand), docs = DB.docs.filter(d => d.clientId === c.id && owing(d)).sort((a, b) => a.date.localeCompare(b.date));
  const tot = docs.reduce((a, d) => a + balanceOf(d), 0), accts = S.accounts.filter(a => a.iban);
  const lines = [dt('Καλησπέρα σας,', 'Dear Sir or Madam,'), '', dt('σας υπενθυμίζουμε φιλικά ότι εκκρεμεί η εξόφληση των παρακάτω:', 'this is a friendly reminder that the following remain unpaid:'), '',
    ...docs.map(d => `• ${dttl(d.type)} ${d.no} (${ddate(d.issuedAt || d.date)}): ${dt('υπόλοιπο', 'balance')} ${deur(balanceOf(d))}`), '', `${dt('Σύνολο', 'Total')}: ${deur(tot)}`];
  if (accts.length) { lines.push('', dt('Στοιχεία πληρωμής:', 'Payment details:')); accts.forEach(a => lines.push(`${a.bank}: ${a.iban}`)); lines.push(dt('Αιτιολογία: ο αριθμός του εγγράφου.', 'Reference: the document number.')); }
  lines.push('', dt('Αν έχετε ήδη πληρώσει, παρακαλούμε αγνοήστε το μήνυμα. Ευχαριστούμε!', 'If you have already paid, please ignore this message. Thank you!'), '', dt('Με εκτίμηση,', 'Kind regards,'), iss.name, ...[iss.tel, iss.email].filter(Boolean));
  const subject = dt(`Υπενθύμιση εξόφλησης · ${B.name || iss.name}`, `Payment reminder · ${B.name || iss.name}`);
  DL = saved;
  mailModal(tr('Υπενθύμιση οφειλής', 'Payment reminder'), c.email, subject, lines.join('\n'));
}

/* ================================================================== document templates */
async function saveTemplate(d) {
  const name = await promptBox(tr('Αποθήκευση ως πρότυπο', 'Save as a template'), tr('Όνομα προτύπου', 'Template name'), d.items.find(i => i.t)?.t || '', tr('Αποθήκευση', 'Save'));
  if (!name) return;
  const S = DB.settings, ex = S.templates.find(t => t.name.trim().toLowerCase() === name.toLowerCase());
  const tpl = { id: ex?.id || uid(), name, type: d.type, lang: d.lang, items: clone(d.items).map(i => { if (i.m) i.m = { ...i.m, auto: false }; return i; }), extra: clone(d.extra.filter(x => x.trim())), dur: d.dur, durU: d.durU };
  if (ex) Object.assign(ex, tpl); else S.templates.push(tpl);
  persistSettings(); toast(ex ? tr('Το πρότυπο ενημερώθηκε', 'The template was updated') : tr('Αποθηκεύτηκε ως πρότυπο', 'Saved as a template'));
}
function templatePicker(title) {
  return new Promise(resolve => {
    const L = DB.settings.templates; let chosen = null;
    if (!L.length) { modal({ title: tr('Πρότυπα', 'Templates'), body: tr('<p>Δεν υπάρχουν πρότυπα.</p><p class="note">Φτιάξτε ένα έγγραφο με τις γραμμές που θέλετε και πατήστε Επιλογές → «Αποθήκευση ως πρότυπο».</p>', '<p>There are no templates yet.</p><p class="note">Make a document with the lines you want and press Options → “Save as a template”.</p>'), actions: [{ label: tr('Κλείσιμο', 'Close'), value: null }] }).then(() => resolve(null)); return; }
    modal({ title: title || tr('Επιλογή προτύπου', 'Choose a template'), body: `<div class="pick" id="tp">${L.map(t => `<button type="button" data-id="${t.id}"><b>${esc(t.name)}</b><span class="mut"> · ${plural(t.items.length, tr('γραμμή', 'line'), tr('γραμμές', 'lines'))}${t.lang === 'en' ? ' · EN' : ''} · ${eur(totals({ ...t, type: 'offer', vat: DB.settings.defaults.vat, adv: 0 }).net)} ${tr('χωρίς ΦΠΑ', 'excl. VAT')}</span></button>`).join('')}</div>`,
      actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }],
      onOpen: (mb, close) => $$('#tp button', mb).forEach(b => b.onclick = () => { chosen = L.find(t => t.id === b.dataset.id); close(null); }) }).then(() => resolve(chosen));
  });
}
async function insertTemplate(d) {
  const t = await templatePicker(); if (!t) return;
  const items = clone(t.items), last = d.items[d.items.length - 1];
  if (d.items.length === 1 && last && !last.t && !num(last.p) && !last.s) d.items = items; else d.items.push(...items);
  for (const x of t.extra || []) if (!d.extra.includes(x)) d.extra.push(x);
  if (t.dur && !num(d.dur)) { d.dur = t.dur; d.durU = t.durU || d.durU; }
  persistDoc(d, true); viewDoc(d.id); toast(tr(`Προστέθηκαν ${items.length} γραμμές από «${t.name}»`, `${items.length} lines added from “${t.name}”`));
}
async function newFromTemplate() {
  const t = await templatePicker(tr('Νέο έγγραφο από πρότυπο', 'New document from a template')); if (!t) return;
  openNewDoc(SALES.includes(t.type) ? t.type : 'offer', { items: clone(t.items), extra: clone(t.extra || []), lang: t.lang || DB.settings.docLang, dur: t.dur || '', durU: t.durU || DB.settings.defaults.durU });
}
function templatesEditor(el, S) {
  const draw = () => {
    el.innerHTML = S.templates.length ? `<div class="tablewrap"><table class="list"><tbody>${S.templates.map((t, i) => `<tr><td><input class="inp" data-tn="${i}" value="${esc(t.name)}" aria-label="${tr('Όνομα', 'Name')}"></td><td class="mut nw">${plural(t.items.length, tr('γραμμή', 'line'), tr('γραμμές', 'lines'))} · ${ttl(SALES.includes(t.type) ? t.type : 'offer')}${t.lang === 'en' ? ' · EN' : ''}</td><td class="r"><button class="btn sm danger" type="button" data-tdel="${i}" aria-label="${tr('Διαγραφή', 'Delete')}">×</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="note" style="margin:0">${tr('Δεν υπάρχουν ακόμα πρότυπα.', 'No templates yet.')}</p>`;
    $$('[data-tn]', el).forEach(i => i.oninput = () => { S.templates[+i.dataset.tn].name = i.value; persistSettings(); });
    $$('[data-tdel]', el).forEach(b => b.onclick = async () => { if (!(await confirmBox(tr('Διαγραφή προτύπου', 'Delete template'), tr(`Να διαγραφεί το πρότυπο «${esc(S.templates[+b.dataset.tdel].name)}»;`, `Delete the template “${esc(S.templates[+b.dataset.tdel].name)}”?`)))) return; S.templates.splice(+b.dataset.tdel, 1); persistSettings(); draw(); });
  };
  draw();
}

/* ================================================================== calendar (.ics): planned visits and due checks */
function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 74) return line;
  const out = []; let cur0 = '', n = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > 73) { out.push(cur0); cur0 = ' '; n = 1; } cur0 += ch; n += b; }
  out.push(cur0); return out.join('\r\n');
}
function exportICS(only) {
  const T = todayISO(), ym = T.slice(0, 7), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), ev = [];
  const day = iso => iso.replace(/-/g, '');
  const add = (uid0, date, summary, desc, loc) => { const end = addDays(date, 1); ev.push(['BEGIN:VEVENT', `UID:${uid0}@mastoras`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(date)}`, `DTEND;VALUE=DATE:${day(end)}`, `SUMMARY:${icsText(summary)}`, desc ? `DESCRIPTION:${icsText(desc)}` : '', loc ? `LOCATION:${icsText(loc)}` : '', 'TRANSP:TRANSPARENT', 'END:VEVENT'].filter(Boolean)); };
  const cons = only || DB.docs.filter(d => d.type === 'contract' && d.issued && !d.cancelled && ['active', 'soon', 'upcoming'].includes(contractState(d).k));
  for (const d of cons) for (const v of visitsOf(d).filter(x => !x.done && !x.extra)) {
    const date = v.ym < ym ? T : v.ym === ym ? T : v.ym + '-01';
    add(`${d.id}-${v.n}`, date, `${tr('Συντήρηση', 'Maintenance')} · ${d.cl.name} (${d.no} · ${v.n}/${v.of})`,
      [d.cl.addr, d.cl.tel, contractMachines(d).map(m => '• ' + (machineLabel(m) || EQ().one) + (m.location ? ' — ' + m.location : '')).join('\n'), tr('Προγραμματισμένος μήνας: ', 'Planned month: ') + ymLabel(v.ym)].filter(Boolean).join('\n'), d.cl.addr);
  }
  if (!only) for (const r of regRows().filter(r => r.next)) add(`reg-${r.m.id}-${r.next}`, r.next < T ? T : r.next, `${regWhat()} · ${r.c.name}`, [machineLabel(r.m), r.m.location, r.c.addr, r.c.tel].filter(Boolean).join('\n'), r.c.addr);
  if (!ev.length) return toast(tr('Δεν υπάρχουν προγραμματισμένες επισκέψεις ή έλεγχοι', 'There are no planned visits or checks'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MakeTech//Mastoras//EL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(DB.settings.brand.name || appName())}`, ...ev.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
  download(`${tr('επισκέψεις', 'visits')}_${only?.length === 1 ? (only[0].no || 'συμβόλαιο') + '_' : ''}${T}.ics`, ics, 'text/calendar;charset=utf-8');
  toast(tr(`${ev.length} γεγονότα στο αρχείο .ics · ανοίξτε το για εισαγωγή στο ημερολόγιο`, `${ev.length} events in the .ics file · open it to import into your calendar`));
}

/* ================================================================== catalogue tools: price change, CSV import/export */
function catalogBulkPrice(redraw) {
  const C = DB.settings.catalog; if (!C.length) return toast(tr('Ο κατάλογος είναι άδειος', 'The catalogue is empty'));
  let v = null;
  modal({ title: tr('Αλλαγή τιμών καταλόγου', 'Change catalogue prices'), body: `<div class="form"><div class="f"><label for="bp-pct">${tr('Ποσοστό % (π.χ. 5 ή -3)', 'Percentage % (e.g. 5 or -3)')}</label><input id="bp-pct" inputmode="decimal" placeholder="5"></div>
      <div class="f"><label for="bp-rnd">${tr('Στρογγυλοποίηση', 'Rounding')}</label><select id="bp-rnd"><option value="0.01">0,01 €</option><option value="0.1">0,10 €</option><option value="0.5" selected>0,50 €</option><option value="1">1 €</option><option value="5">5 €</option></select></div></div>
      <p class="note" style="margin-top:12px">${tr(`Αλλάζουν οι τιμές και των ${C.length} ειδών του καταλόγου. Τα έγγραφα που έχουν ήδη φτιαχτεί δεν αλλάζουν.`, `The prices of all ${C.length} catalogue items change. Documents already made do not change.`)}</p><div id="bp-pv" class="cbreak" style="margin-top:10px"></div>`,
    actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }, { label: tr('Εφαρμογή', 'Apply'), value: 'ok', cls: 'blue', validate: mb => { v = { pct: num($('#bp-pct', mb).value), rnd: +$('#bp-rnd', mb).value }; if (!v.pct) { toast(tr('Γράψτε ποσοστό', 'Enter a percentage')); return false; } return true; } }],
    onOpen: mb => { const pv = () => { const pct = num($('#bp-pct', mb).value), rnd = +$('#bp-rnd', mb).value, x = C[0]; $('#bp-pv', mb).innerHTML = pct ? `${tr('Παράδειγμα', 'Example')}: ${esc(x.t)} · ${eur(num(x.p))} → <b>${eur(roundTo(num(x.p) * (1 + pct / 100), rnd))}</b>` : ''; }; $('#bp-pct', mb).oninput = pv; $('#bp-rnd', mb).onchange = pv; } })
    .then(r => { if (r !== 'ok') return; for (const x of C) x.p = roundTo(num(x.p) * (1 + v.pct / 100), v.rnd); persistSettings(); redraw && redraw(); toast(tr(`Άλλαξαν ${C.length} τιμές κατά ${decStr(v.pct)}%`, `${C.length} prices changed by ${decStr(v.pct)}%`)); });
}
const roundTo = (x, step) => Math.max(0, Math.round(Math.round(x / step) * step * 100) / 100);
function exportCatalogCSV() {
  const C = DB.settings.catalog; if (!C.length) return toast(tr('Ο κατάλογος είναι άδειος', 'The catalogue is empty'));
  csv(`${tr('κατάλογος', 'catalogue')}_${todayISO()}.csv`, [tr('Περιγραφή', 'Description'), tr('Λεπτομέρειες', 'Details'), tr('Περιγραφή EN', 'Description EN'), tr('Λεπτομέρειες EN', 'Details EN'), tr('Μονάδα', 'Unit'), tr('Τιμή', 'Price'), tr('ΦΠΑ', 'VAT')],
    C.map(x => [x.t, x.s || '', x.te || '', x.se || '', x.u, num(x.p), x.vat === '' || x.vat == null ? '' : String(x.vat)]));
}
function parseCSV(text) {
  text = text.replace(/^\ufeff/, '');
  const first = text.split(/\r?\n/)[0] || '', sep = [';', '\t', ','].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q0 = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q0) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q0 = false; } else cell += ch; continue; }
    if (ch === '"') q0 = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
async function importCatalogCSV(file, done) {
  const rows = parseCSV(await file.text()); if (!rows.length) return toast(tr('Το αρχείο είναι άδειο', 'The file is empty'));
  const key = h => fold(h).replace(/[€%()]/g, '').replace(/\s+/g, ' ').trim();
  const MAP = { 'περιγραφη': 't', 'description': 't', 'ειδος': 't', 'item': 't', 'λεπτομερειες': 's', 'details': 's', 'περιγραφη en': 'te', 'description en': 'te', 'en': 'te', 'λεπτομερειες en': 'se', 'details en': 'se', 'μοναδα': 'u', 'μ.μ.': 'u', 'unit': 'u', 'τιμη': 'p', 'price': 'p', 'φπα': 'vat', 'vat': 'vat' };
  let cols = rows[0].map(h => MAP[key(h)] || ''), body = rows.slice(1);
  if (!cols.includes('t')) { cols = ['t', 'u', 'p', 'vat']; body = rows; } // no header: description; unit; price; VAT
  const C = DB.settings.catalog; let added = 0, updated = 0; const items = [];
  for (const r of body) {
    const x = {}; cols.forEach((k, i) => { if (k) x[k] = (r[i] || '').trim(); });
    if (!x.t) continue;
    items.push({ t: x.t, s: x.s || '', te: x.te || '', se: x.se || '', u: x.u || 'τεμ.', p: num(x.p), vat: x.vat === undefined || x.vat === '' ? '' : clampPct(x.vat) });
  }
  if (!items.length) return toast(tr('Δεν βρέθηκαν είδη. Η πρώτη γραμμή πρέπει να έχει επικεφαλίδες (Περιγραφή, Μονάδα, Τιμή, ΦΠΑ).', 'No items found. The first row should have headings (Description, Unit, Price, VAT).'));
  for (const it of items) { if (C.find(c => c.t.trim().toLowerCase() === it.t.toLowerCase())) updated++; else added++; }
  if (!(await confirmBox(tr('Εισαγωγή καταλόγου', 'Import catalogue'), tr(`Από το αρχείο <b>${esc(file.name)}</b>: ${added} νέα είδη και ${updated} ενημερώσεις υπαρχόντων (με την ίδια περιγραφή).`, `From the file <b>${esc(file.name)}</b>: ${added} new items and ${updated} updates of existing ones (same description).`), tr('Εισαγωγή', 'Import'), 'blue'))) return;
  for (const it of items) { const ex = C.find(c => c.t.trim().toLowerCase() === it.t.toLowerCase()); if (ex) Object.assign(ex, Object.fromEntries(Object.entries(it).filter(([k, v]) => v !== '' || k === 'vat'))); else C.push({ id: uid(), ...it }); }
  persistSettings(); toast(tr(`Ο κατάλογος ενημερώθηκε: +${added}, ${updated} ενημερώσεις`, `Catalogue updated: +${added}, ${updated} updates`)); done && done();
}

/* ================================================================== register view: F-gas, combustion checks, measurements · or repairs (IT) */
function viewRegister() {
  const P = PROF();
  if (P.register === 'tickets') return viewTickets();
  if (!P.register) return go('home');
  const f = filt.reg, T = todayISO();
  const head = { fgas: [tr('Ψυκτικό', 'Refrigerant'), 'kg', 't CO₂e', tr('Έλεγχος', 'Check every')], combustion: [tr('Καύσιμο', 'Fuel'), tr('Ισχύς', 'Output'), tr('Τελευταία μέτρηση', 'Last measurement'), ''], inspection: [tr('ΥΔΕ', 'Certificate'), tr('Παροχή', 'Supply'), tr('Τελευταίες μετρήσεις', 'Last measurements'), ''] }[P.register];
  const intro = { fgas: tr('Συχνότητα ελέγχου διαρροών κατά τον Κανονισμό (ΕΕ) 2024/573: από 5 t CO₂e κάθε 12 μήνες, από 50 t κάθε 6, από 500 t κάθε 3· με σύστημα ανίχνευσης διαρροών το διάστημα διπλασιάζεται. Ερμητικά σφραγισμένα κάτω από 10 t εξαιρούνται. Οι έλεγχοι καταγράφονται από τις επισκέψεις των συμβολαίων ή χειροκίνητα. Ενδεικτικό εργαλείο: ελέγξτε τα στοιχεία της πινακίδας και τις υποχρεώσεις σας.', 'Leak-check frequency under Regulation (EU) 2024/573: from 5 t CO₂e every 12 months, from 50 t every 6, from 500 t every 3; doubled with a leak detection system. Hermetically sealed units under 10 t are exempt. Checks are recorded from agreement visits or by hand. An indicative tool: check the nameplate data and your obligations.'),
    combustion: tr(`Οι μετρήσεις καυσαερίων καταγράφονται στις επισκέψεις των συμβολαίων ή χειροκίνητα. Επόμενος έλεγχος: ${DB.settings.regMonths.combustion} μήνες μετά την τελευταία μέτρηση (αλλάζει στις Ρυθμίσεις).`, `Flue-gas measurements are recorded on agreement visits or by hand. Next check: ${DB.settings.regMonths.combustion} months after the last measurement (change it in Settings).`),
    inspection: tr('Οι μετρήσεις γείωσης, ρελέ και μόνωσης καταγράφονται στις επισκέψεις ή χειροκίνητα. Η ημερομηνία επόμενου επανελέγχου ορίζεται στα στοιχεία κάθε εγκατάστασης.', 'Earth, RCD and insulation measurements are recorded on visits or by hand. The next re-inspection date is set on each installation.') }[P.register];
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${esc(pick2(P.regTitle))}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Πελάτης, μάρκα, θέση', 'Client, brand, location')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση', 'Search')}">
    <button class="btn sm" type="button" id="b-csv">⇩ CSV</button><button class="btn sm" type="button" id="b-ics">⇩ .ics</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg">${[['all', tr('Όλα', 'All')], ['due', tr('Σε 30 ημέρες', 'Due in 30 days')], ['over', tr('Εκπρόθεσμα', 'Overdue')], ...(P.register === 'fgas' ? [['need', tr('Με υποχρέωση ελέγχου', 'Subject to checks')]] : [])].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <p class="note regnote">${esc(intro)}</p>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Πελάτης', 'Client')}</th><th>${EQ().one}</th>${head.map((h, i) => h ? `<th class="${i > 0 && P.register === 'fgas' && i < 3 ? 'r' : ''}">${h}</th>` : '').join('')}<th>${tr('Επόμενος', 'Next')}</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const cells = r => {
    const m = r.m;
    if (P.register === 'fgas') return `<td>${esc(m.ref || '—')}</td><td class="r num">${m.charge ? decStr(m.charge) : '—'}</td><td class="r num">${r.f.co2 ? decStr(r.f.co2.toFixed(2)) : '—'}</td><td>${r.f.need ? `${r.f.freq} ${tr('μήνες', 'months')}${m.lds ? ' · LDS' : ''}` : `<span class="mut">${r.f.cls === 'nat' ? tr('εκτός F-gas', 'not F-gas') : m.hermetic && r.f.co2 < 10 ? tr('ερμητικό, εξαιρείται', 'hermetic, exempt') : tr('κάτω από το όριο', 'below threshold')}</span>`}${r.last ? `<span class="sub">${tr('τελευταίος', 'last')} ${fmtDate(r.last.date)}</span>` : ''}</td>`;
    if (P.register === 'combustion') { const fu = P.fields.find(x => x.k === 'fuel'), o = fu.opts.find(x => x[0] === m.fuel); return `<td>${o && m.fuel ? esc(pick2(o[1])) : '—'}</td><td>${m.kw ? decStr(m.kw) + ' kW' : '—'}</td><td>${r.last ? `${fmtDate(r.last.date)}<span class="sub">${esc(measText(r.last.ms))}</span>` : `<span class="mut">${tr('καμία', 'none')}</span>`}</td>`; }
    return `<td>${m.ude ? fmtDate(m.ude) : '—'}</td><td>${m.amps ? decStr(m.amps) + ' A' : '—'}${m.phase ? ` · ${m.phase === '3' ? '3~' : '1~'}` : ''}</td><td>${r.last ? `${fmtDate(r.last.date)}<span class="sub">${esc(measText(r.last.ms))}</span>` : `<span class="mut">${tr('καμία', 'none')}</span>`}</td>`;
  };
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = regRows().filter(r => (!ql || [r.c.name, r.m.brand, r.m.location, r.m.model, r.m.kind].join(' ').toLowerCase().includes(ql))
      && (f.t === 'all' || (f.t === 'due' && r.next && daysBetween(T, r.next) <= 30) || (f.t === 'over' && r.next && r.next < T) || (f.t === 'need' && r.f.need)))
      .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999') || a.c.name.localeCompare(b.c.name, 'el'));
    $('#rows').innerHTML = rows.length ? rows.map((r, i) => `<tr class="click" data-i="${i}" tabindex="0"><td><b>${esc(r.c.name)}</b>${demoChip(r.c)}</td><td>${esc(machineLabel(r.m) || EQ().one)}${r.m.location ? `<span class="sub">${esc(r.m.location)}</span>` : ''}</td>${cells(r)}<td>${dueChip(r.next)}</td><td class="r acts"><button class="btn sm" type="button" data-log="${i}">+ ${tr('Καταγραφή', 'Record')}</button></td></tr>`).join('')
      : `<tr><td colspan="8"><div class="empty"><b>${tr('Τίποτα για εμφάνιση', 'Nothing to show')}</b>${P.register === 'fgas' ? tr('Συμπληρώστε ψυκτικό μέσο και γόμωση στα μηχανήματα των πελατών για να εμφανιστούν εδώ.', 'Fill in the refrigerant and charge on client units for them to appear here.') : tr(`Καταχωρήστε ${EQ().as} στους πελάτες για να εμφανιστούν εδώ.`, `Register ${EQ().as} to clients for them to appear here.`)}</div></td></tr>`;
    $$('#rows tr.click').forEach(tr0 => tr0.onclick = e => { if (e.target.closest('button')) return; machineHistory(rows[+tr0.dataset.i].c, rows[+tr0.dataset.i].m, draw); });
    $$('[data-log]').forEach(b => b.onclick = e => { e.stopPropagation(); const r = rows[+b.dataset.log]; logDialog(r.c, r.m).then(ok => ok && draw()); });
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $$('.seg button').forEach(b => b.onclick = () => { f.t = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#b-csv').onclick = exportRegisterCSV;
  $('#b-ics').onclick = () => exportICS();
  draw();
}
async function logDialog(c, m) {
  let v = null;
  const r = await modal({ title: `${regWhat() || tr('Καταγραφή', 'Record')} · ${machineLabel(m) || EQ().one}`, wide: true,
    body: `<div class="form"><div class="f"><label for="lg-date">${tr('Ημερομηνία', 'Date')}</label><input type="date" id="lg-date" value="${todayISO()}"></div><div class="f"><label for="lg-tech">${tr('Τεχνικός', 'Technician')}</label><input id="lg-tech" value="${esc(DB.settings.iss.name)}"></div></div>
      <div class="sub-h">${tr('Μετρήσεις', 'Measurements')}</div>${measInputs({}, 'x')}
      <div class="f" style="margin-top:12px"><label for="lg-note">${tr('Σημείωση', 'Note')}</label><input id="lg-note"></div>`,
    actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }, { label: tr('Αποθήκευση', 'Save'), value: 'ok', cls: 'blue', validate: mb => { v = { id: uid(), date: $('#lg-date', mb).value || todayISO(), tech: $('#lg-tech', mb).value.trim(), ms: measGrab(mb, 'x'), note: $('#lg-note', mb).value.trim() }; if (!measFilled(v.ms) && !v.note) { toast(tr('Συμπληρώστε τουλάχιστον μία μέτρηση ή σημείωση', 'Fill in at least one measurement or a note')); return false; } return true; } }] });
  if (r !== 'ok') return false;
  m.log = m.log || []; m.log.push(v); persistClient(c, true); toast(tr('Καταγράφηκε', 'Recorded')); return true;
}
function machineHistory(c, m, redraw) {
  const ev = machineEvents(m);
  modal({ title: `${machineLabel(m) || EQ().one} · ${c.name}`, wide: true,
    body: `${ev.length ? `<div class="tablewrap"><table class="list"><thead><tr><th>${tr('Ημερομηνία', 'Date')}</th><th>${tr('Μετρήσεις', 'Measurements')}</th><th>${tr('Πηγή', 'Source')}</th><th></th></tr></thead><tbody>${ev.map(e => `<tr><td class="num">${fmtDate(e.date)}</td><td>${esc(measText(e.ms)) || '—'}${e.note ? `<span class="sub">${esc(e.note)}</span>` : ''}</td><td class="mut">${e.src === 'visit' ? `${tr('Επίσκεψη', 'Visit')} ${esc(e.no || '')}` : tr('Χειροκίνητα', 'By hand')}${e.tech ? ' · ' + esc(e.tech) : ''}</td><td class="r">${e.src === 'manual' ? `<button class="btn sm ghost" type="button" data-hdel="${e.id}" aria-label="${tr('Διαγραφή', 'Delete')}">×</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<p class="note" style="margin:0">${tr('Δεν υπάρχουν καταγραφές ακόμα.', 'No records yet.')}</p>`}`,
    actions: [{ label: tr('Καρτέλα πελάτη', 'Client page'), value: 'client' }, '|', { label: tr('Κλείσιμο', 'Close'), value: null }, { label: '+ ' + tr('Καταγραφή', 'Record'), value: 'log', cls: 'blue' }],
    onOpen: (mb, close) => $$('[data-hdel]', mb).forEach(b => b.onclick = () => { m.log = (m.log || []).filter(x => x.id !== b.dataset.hdel); persistClient(c, true); close('re'); }) })
    .then(async r => { if (r === 'client') go('client', c.id); else if (r === 'log') { if (await logDialog(c, m)) { redraw && redraw(); machineHistory(c, m, redraw); } } else if (r === 're') { redraw && redraw(); machineHistory(c, m, redraw); } });
}
function exportRegisterCSV() {
  const P = PROF(), rows = regRows();
  const mh = measList().map(f => pick2(f.l));
  csv(`${slug(pick2(P.regLabel)) || 'register'}_${todayISO()}.csv`,
    [tr('Πελάτης', 'Client'), tr('ΑΦΜ', 'Tax no.'), tr('Διεύθυνση', 'Address'), EQ().one, tr('Θέση', 'Location'), tr('Σειριακός', 'Serial'), ...P.fields.map(f => pick2(f.l)), tr('Τελευταίος έλεγχος', 'Last check'), ...mh, tr('Επόμενος', 'Next'), ...(P.register === 'fgas' ? ['t CO2e', tr('Συχνότητα (μήνες)', 'Frequency (months)')] : [])],
    rows.map(r => [r.c.name, r.c.afm, r.c.addr, machineLabel(r.m), r.m.location, r.m.serial, ...P.fields.map(f => f.type === 'bool' ? (r.m[f.k] ? tr('ναι', 'yes') : '') : f.type === 'date' ? fmtDate(r.m[f.k]) : String(r.m[f.k] ?? '')), r.last ? fmtDate(r.last.date) : '', ...measList().map(f => r.last ? measShow(f, r.last.ms?.[f.k]) : ''), fmtDate(r.next), ...(P.register === 'fgas' ? [r.f.co2, r.f.need ? String(r.f.freq) : ''] : [])]));
}

/* ================================================================== repairs (IT profile): device intake receipt */
const TICKET_ST = [['in', ['Παραλήφθηκε', 'Received'], 'info'], ['work', ['Σε επισκευή', 'In repair'], 'warn'], ['ready', ['Έτοιμη για παράδοση', 'Ready to collect'], 'ok'], ['out', ['Παραδόθηκε', 'Returned'], 'draft']];
function normTicket(d) {
  d.dev = Object.assign({ kind: '', brand: '', model: '', serial: '' }, d.dev || {});
  for (const k of ['fault', 'acc', 'cond', 'work', 'notes']) d[k] = d[k] ?? '';
  d.est = d.est ?? ''; d.cost = d.cost ?? ''; d.status = d.status || 'in';
  return d;
}
function ticketState(d) {
  if (!d.issued) return { k: 'draft', l: tr('Πρόχειρο', 'Draft'), c: 'draft' };
  if (d.cancelled) return { k: 'cancelled', l: tr('Ακυρώθηκε', 'Cancelled'), c: 'bad' };
  const s = TICKET_ST.find(x => x[0] === d.status) || TICKET_ST[0];
  return { k: s[0], l: pick2(s[1]), c: s[2] };
}
const ticketDevice = (d, doc) => [doc ? kindDoc(d.dev.kind) : kindUI(d.dev.kind), d.dev.brand, d.dev.model].filter(Boolean).join(' · ') || (doc ? dt('Συσκευή', 'Device') : tr('Συσκευή', 'Device'));
function newTicket(c, from = {}) {
  const d = normDoc({ id: uid(), type: 'ticket', issued: false, date: todayISO(), clientId: c ? c.id : '', cl: c ? pickCl(c) : {}, lang: langForClient(c), ...from });
  if (c?.demo) d.demo = true;
  DB.docs.push(d); return d;
}
function openTicket(c) { const d = newTicket(c); go('doc', d.id); }
async function newTicketFlow() {
  if (!DB.clients.length) { toast(tr('Δημιουργήστε πρώτα τον πελάτη', 'Create the client first')); return go('client', 'new'); }
  const c = await clientPicker(); if (c) openTicket(c);
}
function issueTicketNow(d) { d.no = nextNo('ticket', isDemoDoc(d)); d.issued = true; d.issuedAt = todayISO(); d.status = d.status || 'in'; d.iss = clone(DB.settings.iss); if (isDemoDoc(d)) d.demo = true; }
async function issueTicket(d) {
  const missing = !d.clientId ? tr('Επιλέξτε πελάτη.', 'Choose a client.') : !(d.dev.kind || d.dev.brand || d.dev.model) ? tr('Συμπληρώστε τη συσκευή.', 'Fill in the device.') : !d.fault.trim() ? tr('Γράψτε τη βλάβη που αναφέρει ο πελάτης.', 'Describe the fault reported by the client.') : '';
  const no = nextNo('ticket', isDemoDoc(d));
  const r = await modal({ title: tr('Δελτίο παραλαβής', 'Intake receipt'), body: missing ? `<div class="errbox">${esc(missing)}</div>` : `<p>${tr(`Το δελτίο θα πάρει τον αριθμό <b style="color:var(--navy)">${no}</b>. Τυπώστε δύο αντίτυπα: ένα για τον πελάτη και ένα που μένει με τη συσκευή.`, `The receipt will get the number <b style="color:var(--navy)">${no}</b>. Print two copies: one for the client and one that stays with the device.`)}</p>`,
    actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }, ...(missing ? [] : [{ label: tr('Έκδοση & PDF', 'Issue & PDF'), value: 'ok', cls: 'blue' }])] });
  if (r !== 'ok') return;
  issueTicketNow(d); persistDoc(d, true); await chain; viewTicket(d); toast(tr('Εκδόθηκε ', 'Issued ') + d.no); setTimeout(() => doPrint(false), 300);
}
function ticketToProforma(d) {
  const vat = num(DB.settings.defaults.vat), cost = num(d.cost) || num(d.est);
  persistDoc(d, true);
  const saved = DL; useDocLang(d);
  const it = { t: `${dt('Επισκευή', 'Repair')}: ${ticketDevice(d, true)}${d.dev.serial ? ' · S/N ' + d.dev.serial : ''}`, s: d.work || '', q: 1, u: 'τεμ.', p: Math.round(cost / (1 + vat / 100) * 100) / 100 };
  DL = saved;
  openNewDoc('proforma', { clientId: d.clientId, cl: d.cl, lang: d.lang, items: [it], adv: 0, demo: d.demo, from: { id: d.id, type: 'ticket', no: d.no } });
  toast(tr('Νέο πρόχειρο προτιμολόγιο από την επισκευή · το ποσό μετατράπηκε σε τιμή χωρίς ΦΠΑ', 'New draft proforma invoice from the repair · the amount was converted to a price excluding VAT'));
}
function viewTickets() {
  const f = filt.reg;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Επισκευές συσκευών', 'Device repairs')}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Πελάτης, συσκευή, αριθμός', 'Client, device, number')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση', 'Search')}">
    <button class="btn blue" type="button" id="b-nt">+ ${tr('Παραλαβή συσκευής', 'Receive a device')}</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg">${[['all', tr('Όλα', 'All')], ['open', tr('Σε εξέλιξη', 'Open')], ...TICKET_ST.map(([k, l]) => [k, pick2(l)]), ['draft', tr('Πρόχειρα', 'Drafts')]].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Αριθμός', 'Number')}</th><th>${tr('Πελάτης', 'Client')}</th><th>${tr('Συσκευή', 'Device')}</th><th>${tr('Παραλαβή', 'Received')}</th><th class="r">${tr('Κόστος', 'Cost')}</th><th>${tr('Κατάσταση', 'Status')}</th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = DB.docs.filter(d => d.type === 'ticket' && (!ql || [d.no, d.cl.name, ticketDevice(d), d.dev.serial].join(' ').toLowerCase().includes(ql))
      && (f.t === 'all' || (f.t === 'draft' ? !d.issued : f.t === 'open' ? d.issued && !d.cancelled && ['in', 'work', 'ready'].includes(d.status) : d.issued && !d.cancelled && d.status === f.t)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('#rows').innerHTML = rows.length ? rows.map(d => `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}" tabindex="0"><td><b>${d.issued ? esc(d.no) : '<span class="mut">—</span>'}</b>${demoChip(d)}</td><td>${esc(d.cl.name) || '—'}</td><td>${esc(ticketDevice(d))}<span class="sub">${esc(d.fault.slice(0, 60))}</span></td><td class="num">${fmtDate(d.date)}</td><td class="r num">${num(d.cost) ? `<b>${eur(num(d.cost))}</b>` : num(d.est) ? `<span class="mut">~${eur(num(d.est))}</span>` : '—'}</td><td>${chipOf(docState(d))}</td></tr>`).join('')
      : `<tr><td colspan="6"><div class="empty"><b>${tr('Δεν υπάρχουν επισκευές', 'No repairs')}</b>${tr('Πατήστε «+ Παραλαβή συσκευής» όταν σας φέρνουν μια συσκευή.', 'Press “+ Receive a device” when a device is brought in.')}</div></td></tr>`;
    $$('#rows tr.click').forEach(r => { r.onclick = () => go('doc', r.dataset.id); r.onkeydown = e => { if (e.key === 'Enter') go('doc', r.dataset.id); }; });
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $$('.seg button').forEach(b => b.onclick = () => { f.t = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#b-nt').onclick = newTicketFlow;
  draw();
}
function ticketPage(d) {
  useDocLang(d);
  const S = DB.settings, iss = d.issued && d.iss ? d.iss : S.iss, terms = d.lang === 'en' ? S.ticketTermsEn : S.ticketTerms, done = ['ready', 'out'].includes(d.status) && (d.work || num(d.cost));
  const row = (l, v) => v ? `<div class="tk-r"><span class="lbl">${l}</span><div>${esc(v).replace(/\n/g, '<br>')}</div></div>` : '';
  return `<aside><div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">${dt('Τεχνικός', 'Technician')}</div>${issuerBlock(iss)}</div>
      <div class="totalbox"><div class="lbl">${done && num(d.cost) ? dt('Κόστος με ΦΠΑ', 'Cost incl. VAT') : dt('Εκτίμηση κόστους', 'Estimated cost')}</div><div class="big num">${num(done ? d.cost : 0) ? deur(num(d.cost)) : num(d.est) ? deur(num(d.est)) : '—'}</div>
        <div class="split"><span>${dt('Κατάσταση', 'Status')}</span><b>${esc(dpick2((TICKET_ST.find(x => x[0] === d.status) || TICKET_ST[0])[1]))}</b></div></div>
      ${S.brand.credit ? creditHTML() : ''}</aside>
    <main><div class="hA"><div><div class="eb eb-s">${dlabel('ticket')}</div><div class="hA-no">${d.issued ? esc(d.no) : nextNo('ticket', isDemoDoc(d))}${d.issued ? '' : `<span class="prov">${dt('ΠΡΟΣΩΡΙΝΟΣ', 'PROVISIONAL')}</span>`}</div></div>
      <div class="hA-r"><div><span class="t">${dt('ΠΑΡΑΛΑΒΗ', 'RECEIVED')}</span>${ddate(d.date)}</div>${d.status === 'out' && d.outAt ? `<div><span class="t">${dt('ΠΑΡΑΔΟΣΗ', 'RETURNED')}</span>${ddate(d.outAt)}</div>` : ''}</div></div>
      <div class="lbl">${dt('Πελάτης', 'Client')}</div><div class="to"><div class="nm2">${esc(d.cl.name) || '—'}</div><div class="ln">${esc(d.cl.addr)}</div><div class="ln mut">${[esc(d.cl.tel), esc(d.cl.email)].filter(Boolean).join(' · ')}</div></div>
      <section class="cs"><div class="lbl">${dt('Συσκευή', 'Device')}</div><table class="mtab"><thead><tr><th>${dt('ΤΥΠΟΣ', 'TYPE')}</th><th>${dt('ΜΑΡΚΑ / ΜΟΝΤΕΛΟ', 'BRAND / MODEL')}</th><th style="width:40mm">${dt('ΣΕΙΡΙΑΚΟΣ', 'SERIAL NO.')}</th></tr></thead><tbody><tr><td><b>${esc(kindDoc(d.dev.kind)) || '—'}</b></td><td>${esc([d.dev.brand, d.dev.model].filter(Boolean).join(' ')) || '—'}</td><td>${esc(d.dev.serial) || '—'}</td></tr></tbody></table></section>
      <section class="cs tk">${row(dt('Βλάβη που αναφέρθηκε', 'Reported fault'), d.fault)}${row(dt('Παρελκόμενα που παραλήφθηκαν', 'Accessories received'), d.acc || dt('Κανένα', 'None'))}${row(dt('Εξωτερική κατάσταση', 'Visible condition'), d.cond)}${done ? row(dt('Εργασίες που έγιναν', 'Work carried out'), d.work) : ''}</section>
      <section class="cs terms"><div class="lbl">${dt('Όροι', 'Terms')}</div><ol>${terms.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
        <div class="sign"><div>${dt('Παρέλαβε (τεχνικός)', 'Received by (technician)')}</div><div>${d.status === 'out' ? dt('Παρέλαβε τη συσκευή ο πελάτης', 'Device collected by the client') : dt('Παρέδωσε (πελάτης)', 'Handed over by (client)')}</div></div>
        <div class="nofisc">${dt('Το παρόν δεν αποτελεί φορολογικό παραστατικό.', 'This document is not a tax invoice.')}</div></section></main>`;
}
function viewTicket(d) {
  cur = d; normTicket(d); useDocLang(d);
  const P = PROF(), lock = d.cancelled;
  const F = (id, l, v, ph = '', wide = '', area) => `<div class="f ${wide}"><label for="${id}">${l}</label>${area ? `<textarea id="${id}" placeholder="${esc(ph)}">${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}" placeholder="${esc(ph)}">`}</div>`;
  $('#view').innerHTML = `<div class="subbar so">
      <button class="btn ghost sm" type="button" id="bk">← ${tr('Επισκευές', 'Repairs')}</button>
      <div class="dt"><span class="chip ticket">${ttl('ticket')}</span><span>${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</span>${chipOf(docState(d))}${demoChip(d)}${relChips(d)}</div>
      ${langToggle(d, d.issued)}<span class="sp"></span>
      ${d.issued && !d.cancelled && (num(d.cost) || num(d.est)) ? `<button class="btn conv" type="button" id="b-tp">→ ${ttl('proforma')}</button>` : ''}
      ${d.issued ? (d.cancelled ? '' : `<button class="btn danger" type="button" id="b-cancel">${tr('Ακύρωση', 'Cancel')}</button>`) : `<button class="btn danger" type="button" id="b-del">${tr('Διαγραφή', 'Delete')}</button>`}
      <button class="btn blue" type="button" id="b-pdf">${d.issued ? tr('PDF / Εκτύπωση', 'PDF / Print') : tr('Έκδοση & PDF', 'Issue & PDF')}</button></div>
    <div class="wrap">${d.cancelled ? `<div class="statuscard so card"><div class="sc-cx"><b>${tr('Ακυρώθηκε', 'Cancelled')} ${fmtDate(d.cancelled.at)}</b>${d.cancelled.reason ? ' · ' + esc(d.cancelled.reason) : ''}</div></div>` : ''}
    ${d.issued && !d.cancelled ? `<div class="statuscard so card"><div class="sc-row"><b>${tr('Κατάσταση', 'Status')}</b><div class="seg" id="tk-st">${TICKET_ST.map(([k, l]) => `<button type="button" data-ts="${k}" class="${d.status === k ? 'on' : ''}">${pick2(l)}</button>`).join('')}</div>${d.status === 'ready' && d.cl.email ? `<button class="btn sm" type="button" id="tk-mail">${tr('Ειδοποίηση πελάτη (email)', 'Notify client (email)')}</button>` : ''}</div></div>` : ''}
    ${lock ? '' : `<div class="cset so card"><div class="cset-h"><b>${tr('Στοιχεία επισκευής', 'Repair details')}</b><span class="mut">${tr('Ό,τι γράφετε εδώ εμφανίζεται στο δελτίο από κάτω.', 'What you type here appears on the receipt below.')}</span></div>
      <div class="form">
        <div class="f"><label for="tk-kind">${tr('Τύπος συσκευής', 'Device type')}</label>${kindInput(P, d.dev.kind, 'tk-kind')}</div>
        ${F('tk-brand', tr('Μάρκα', 'Brand'), d.dev.brand)}${F('tk-model', tr('Μοντέλο', 'Model'), d.dev.model)}${F('tk-serial', tr('Σειριακός αριθμός', 'Serial number'), d.dev.serial)}
        ${F('tk-fault', tr('Βλάβη που αναφέρει ο πελάτης', 'Fault reported by the client'), d.fault, '', 'wide', true)}
        ${F('tk-acc', tr('Παρελκόμενα (τροφοδοτικό, τσάντα…)', 'Accessories (charger, bag…)'), d.acc)}${F('tk-cond', tr('Εξωτερική κατάσταση', 'Visible condition'), d.cond, tr('π.χ. γρατζουνιές', 'e.g. scratches'))}
        ${F('tk-est', tr('Εκτίμηση κόστους € (με ΦΠΑ)', 'Estimated cost € (incl. VAT)'), d.est === '' ? '' : decStr(d.est))}
        ${d.issued ? `${F('tk-work', tr('Εργασίες που έγιναν', 'Work carried out'), d.work, '', 'wide', true)}${F('tk-cost', tr('Τελικό κόστος € (με ΦΠΑ)', 'Final cost € (incl. VAT)'), d.cost === '' ? '' : decStr(d.cost))}` : ''}
        ${F('tk-notes', tr('Εσωτερικές σημειώσεις (δεν τυπώνονται)', 'Internal notes (not printed)'), d.notes, '', 'wide', true)}
      </div><p class="note" style="margin-top:10px">${esc(pick2(PROFILES.it.note))}</p></div>`}
    <div class="page ticketp" id="page" lang="${DL}">${ticketPage(d)}</div></div>`;
  setWM(d);
  const redrawPage = () => { $('#page').innerHTML = ticketPage(d); afterFonts(fitLogo); };
  $('#bk').onclick = () => go('reg');
  bindLangToggle(d, () => viewTicket(d));
  const bind = (id, fn) => { const el = $('#' + id); if (el) el.oninput = el.onchange = () => { fn(el.value); persistDoc(d); redrawPage(); }; };
  bind('tk-kind', v => d.dev.kind = v); bind('tk-brand', v => d.dev.brand = v); bind('tk-model', v => d.dev.model = v); bind('tk-serial', v => d.dev.serial = v);
  bind('tk-fault', v => d.fault = v); bind('tk-acc', v => d.acc = v); bind('tk-cond', v => d.cond = v); bind('tk-work', v => d.work = v); bind('tk-notes', v => d.notes = v);
  bind('tk-est', v => d.est = v.trim() === '' ? '' : num(v)); bind('tk-cost', v => d.cost = v.trim() === '' ? '' : num(v));
  $$('[data-ts]').forEach(b => b.onclick = () => { d.status = b.dataset.ts; if (d.status === 'ready') d.readyAt = todayISO(); if (d.status === 'out') d.outAt = todayISO(); persistDoc(d, true); viewTicket(d); });
  if ($('#tk-mail')) $('#tk-mail').onclick = () => { const saved = DL; useDocLang(d); const iss = issFor(DB.settings.iss);
    const body = [dt('Καλησπέρα σας,', 'Hello,'), '', dt(`η συσκευή σας (${ticketDevice(d, true)}) είναι έτοιμη για παραλαβή.`, `your device (${ticketDevice(d, true)}) is ready to collect.`), num(d.cost) ? `${dt('Κόστος', 'Cost')}: ${deur(num(d.cost))}` : '', `${dt('Αριθμός δελτίου', 'Receipt number')}: ${d.no}`, '', dt('Με εκτίμηση,', 'Kind regards,'), iss.name, iss.tel].filter(x => x !== '').join('\n');
    const subj = dt(`Η συσκευή σας είναι έτοιμη · ${d.no}`, `Your device is ready · ${d.no}`); DL = saved; mailModal(tr('Ειδοποίηση πελάτη', 'Notify client'), d.cl.email, subj, body); };
  if ($('#b-tp')) $('#b-tp').onclick = () => ticketToProforma(d);
  if ($('#b-del')) $('#b-del').onclick = async () => { if (await deleteDoc(d)) go('reg'); };
  if ($('#b-cancel')) $('#b-cancel').onclick = async () => { const r = await confirmBox(tr('Ακύρωση δελτίου', 'Cancel receipt'), tr(`Το ${esc(d.no)} θα μείνει με την ένδειξη ΑΚΥΡΩΘΗΚΕ.`, `${esc(d.no)} will remain marked CANCELLED.`), tr('Ακύρωση δελτίου', 'Cancel receipt')); if (!r) return; d.cancelled = { at: todayISO(), reason: '' }; persistDoc(d, true); viewTicket(d); };
  $('#b-pdf').onclick = () => d.issued ? doPrint(false, `${d.no}_${slug(d.cl.name)}`) : issueTicket(d);
  afterFonts(fitLogo);
}
