/* ================================================================== maintenance contracts */
const contractEnd = d => d.start ? addDays(addMonths(d.start, parseInt(d.months) || 12), -1) : '';
const contractYears = d => (parseInt(d.months) || 12) / 12;
const ymAdd = (ym, n) => { const x = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 15); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
function contractMachines(d) {
  if (d.issued && Array.isArray(d.machinesSnap)) return d.machinesSnap;
  const c = DB.clients.find(x => x.id === d.clientId);
  return c ? c.machines.filter(m => d.machineIds.includes(m.id)) : [];
}
function contractTotals(d) {
  const n = contractMachines(d).length, v = parseInt(d.visits) || 0, yrs = contractYears(d), a = num(d.amount);
  const net = d.mode === 'total' ? a : d.mode === 'year' ? a * n * yrs : a * n * v * yrs;
  const vatv = Math.round(net * num(d.vat)) / 100, tot = Math.round((net + vatv) * 100) / 100;
  const visitsAll = Math.max(1, Math.round(v * yrs));
  return { gross: net, disc: 0, net, vatBy: [{ r: num(d.vat), v: vatv }], vatv, tot, perVisit: tot / visitsAll, perYear: tot / yrs, n, v, visitsAll, advv: 0, bal: 0 };
}
function contractState(d) {
  if (!d.issued) return { k: 'draft', l: 'Πρόχειρο', c: 'draft' };
  if (d.cancelled) return { k: 'cancelled', l: 'Ακυρώθηκε', c: 'bad' };
  const t = todayISO(), end = contractEnd(d);
  if (d.start > t) return { k: 'upcoming', l: 'Ξεκινά ' + fmtDate(d.start), c: 'info' };
  if (end < t) return { k: 'expired', l: 'Έληξε ' + fmtDate(end), c: 'bad' };
  const left = daysBetween(t, end);
  return left <= 60 ? { k: 'soon', l: `Λήγει σε ${left} ημ.`, c: 'warn' } : { k: 'active', l: 'Ενεργό', c: 'ok' };
}
const contractStatus = d => chipOf(contractState(d));
function normContract(d) {
  const cd = DB.settings.contract;
  d.machineIds = Array.isArray(d.machineIds) ? d.machineIds : [];
  d.checks = Array.isArray(d.checks) ? d.checks : DB.settings.checklist.filter(k => k.on).map(k => k.id);
  d.excl = Array.isArray(d.excl) ? d.excl : clone(DB.settings.exclusions);
  d.vmonths = Array.isArray(d.vmonths) ? d.vmonths : clone(VISIT_MONTHS[cd.visits] || []);
  d.visitLog = Array.isArray(d.visitLog) ? d.visitLog : [];
  for (const k of ['months', 'visits', 'mode', 'amount', 'payment']) if (d[k] == null || d[k] === '') d[k] = cd[k];
  if (d.vat == null || d.vat === '') d.vat = DB.settings.defaults.vat;
  d.start = d.start || todayISO();
  return d;
}
function newContract(c, from) {
  const d = normDoc({ id: uid(), type: 'contract', issued: false, date: todayISO(), clientId: c ? c.id : '', cl: c ? pickCl(c) : {} });
  Object.assign(d, from ? clone(from) : {}, { id: d.id, type: 'contract', issued: false, no: '', issuedAt: '', date: todayISO(), dateManual: false, machinesSnap: undefined, checksSnap: undefined, visitLog: [], payments: [], cancelled: undefined, created: new Date().toISOString() });
  delete d.file; delete d.dir; delete d.iss; delete d.accounts;
  if (c?.demo) d.demo = true;
  normContract(d);
  if (c && !(from && from.machineIds)) d.machineIds = c.machines.map(m => m.id);
  DB.docs.push(d); return d;
}
const contractCopy = (d, extra) => Object.assign({ clientId: d.clientId, cl: d.cl, machineIds: d.issued ? (d.machinesSnap || []).map(m => m.id) : d.machineIds, checks: d.checks, excl: d.excl, extra: d.extra, months: d.months, visits: d.visits, vmonths: d.vmonths, mode: d.mode, amount: d.amount, payment: d.payment, vat: d.vat, demo: d.demo }, extra || {});
function openContract(c, from) { const d = newContract(c, from); go('doc', d.id); }
async function newContractFlow() {
  if (!DB.clients.length) { toast(`Δημιουργήστε πρώτα τον πελάτη και ${isHvac() ? 'τα μηχανήματά' : 'τον εξοπλισμό'} του`); return go('client', 'new'); }
  const c = await clientPicker(); if (c) openContract(c);
}

/* visits: planned from the contract, logged when done */
function plannedVisits(d) {
  if (!d.start) return [];
  const total = contractTotals(d).visitsAll, endYm = contractEnd(d).slice(0, 7), out = [];
  let ym = d.start.slice(0, 7);
  if (d.vmonths.length) while (ym <= endYm && out.length < total) { if (d.vmonths.includes(+ym.slice(5, 7) - 1)) out.push(ym); ym = ymAdd(ym, 1); }
  if (out.length < total) { out.length = 0; const step = (parseInt(d.months) || 12) / total; for (let i = 0; i < total; i++) out.push(ymAdd(d.start.slice(0, 7), Math.round(i * step))); }
  return out.map((ym, i) => ({ ym, n: i + 1, of: total }));
}
function visitsOf(d) {
  const plan = plannedVisits(d), logs = (d.visitLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const out = plan.map((p, i) => ({ ...p, doc: d, log: logs[i] || null, done: !!logs[i] }));
  logs.slice(plan.length).forEach((l, i) => out.push({ ym: l.date.slice(0, 7), n: plan.length + i + 1, of: plan.length, doc: d, log: l, done: true, extra: true }));
  return out;
}
const visitPlan = () => DB.docs.filter(d => d.type === 'contract' && d.issued && !d.cancelled && ['active', 'soon'].includes(contractState(d).k)).flatMap(visitsOf);
function visitChip(v) {
  const ym = todayISO().slice(0, 7);
  if (v.done) return `<span class="chip ok">Έγινε ${fmtDate(v.log.date)}</span>`;
  if (v.ym < ym) return '<span class="chip bad">Καθυστερεί</span>';
  if (v.ym === ym) return '<span class="chip warn">Αυτόν τον μήνα</span>';
  return '<span class="chip">Προγραμματισμένη</span>';
}
const nextVisit = d => visitsOf(d).find(v => !v.done);

function viewContracts() {
  const f = filt.contracts;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>Συμβόλαια συντήρησης</h2>
    <input class="search" id="q" type="search" placeholder="Αναζήτηση πελάτη ή αριθμού" value="${esc(f.q)}" aria-label="Αναζήτηση συμβολαίων">
    <button class="btn blue" type="button" id="b-nk">+ Συμβόλαιο</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg">${[['all', 'Όλα'], ['active', 'Ενεργά'], ['visits', 'Επισκέψεις μήνα'], ['soon', 'Λήγουν'], ['expired', 'Ληγμένα'], ['draft', 'Πρόχειρα'], ['cancelled', 'Ακυρωμένα']].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>Αριθμός</th><th>Πελάτης</th><th>Περίοδος</th><th class="r">${EQ().many}</th><th>Επόμενη επίσκεψη</th><th class="r">Σύνολο</th><th>Κατάσταση</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const ym = todayISO().slice(0, 7);
  const match = d => { const s = contractState(d).k; return f.t === 'all' || s === f.t || (f.t === 'active' && ['soon', 'upcoming'].includes(s)) || (f.t === 'visits' && ['active', 'soon'].includes(s) && visitsOf(d).some(v => !v.done && v.ym <= ym)); };
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = DB.docs.filter(d => d.type === 'contract' && match(d) && (!ql || [d.no, d.cl.name, d.cl.afm].join(' ').toLowerCase().includes(ql))).sort((a, b) => (contractEnd(a) || '').localeCompare(contractEnd(b) || ''));
    $('#rows').innerHTML = rows.length ? rows.map(d => { const t = totals(d), nv = d.issued && !d.cancelled ? nextVisit(d) : null;
      return `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}" tabindex="0"><td><b>${d.issued ? esc(d.no) : '<span class="mut">—</span>'}</b>${demoChip(d)}</td><td>${esc(d.cl.name) || '<span class="mut">χωρίς πελάτη</span>'}</td>
      <td class="num">${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</td><td class="r num">${t.n}</td><td>${nv ? `${ymLabel(nv.ym)} ${nv.ym <= ym ? visitChip(nv) : ''}` : '<span class="mut">—</span>'}</td><td class="r num"><b>${eur(t.tot)}</b></td><td>${contractStatus(d)}</td>${rowActions(d)}</tr>`; }).join('')
      : `<tr><td colspan="8"><div class="empty"><b>${DB.docs.some(d => d.type === 'contract') ? 'Κανένα συμβόλαιο με αυτά τα φίλτρα' : 'Δεν υπάρχουν ακόμα συμβόλαια'}</b>Πατήστε «+ Συμβόλαιο» ή ανοίξτε την καρτέλα ενός πελάτη.</div></td></tr>`;
    $$('#rows tr.click').forEach(tr => { tr.onclick = () => go('doc', tr.dataset.id); tr.onkeydown = e => { if (e.key === 'Enter') go('doc', tr.dataset.id); }; });
    bindRowActions(draw);
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $$('.seg button').forEach(b => b.onclick = () => { f.t = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#b-nk').onclick = newContractFlow;
  draw();
}

function visitsCard(d) {
  if (!d.issued || d.cancelled) return '';
  const V = visitsOf(d);
  return `<div class="statuscard so card"><div class="sc-row"><b>Επισκέψεις</b><span class="mut">${V.filter(v => v.done).length} από ${V.filter(v => !v.extra).length} έγιναν</span><span class="sp"></span><button class="btn sm blue" type="button" id="v-new">+ Καταγραφή επίσκεψης</button></div>
    <table class="list pays"><tbody>${V.map((v, i) => `<tr><td><b>${v.extra ? 'Έκτακτη' : `${v.n}η`}</b></td><td>${ymLabel(v.ym)}</td><td>${visitChip(v)}</td><td class="mut">${esc(v.log?.notes?.slice(0, 60) || '')}</td>
      <td class="r acts">${v.done ? `<button class="btn sm" type="button" data-vsheet="${v.log.id}">Δελτίο</button><button class="btn sm ghost" type="button" data-vedit="${v.log.id}" aria-label="Επεξεργασία">✎</button>` : `<button class="btn sm" type="button" data-vblank="${v.n}" title="Για συμπλήρωση με το χέρι">Κενό δελτίο</button><button class="btn sm blue" type="button" data-vlog="${v.n}">Έγινε</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindVisitsCard(d) {
  if ($('#v-new')) $('#v-new').onclick = () => visitDialog(d);
  $$('[data-vlog]').forEach(b => b.onclick = () => visitDialog(d));
  $$('[data-vedit]').forEach(b => b.onclick = () => visitDialog(d, d.visitLog.find(l => l.id === b.dataset.vedit)));
  $$('[data-vsheet]').forEach(b => b.onclick = () => go('visit', { id: d.id, vid: b.dataset.vsheet }));
  $$('[data-vblank]').forEach(b => b.onclick = () => go('visit', { id: d.id, vid: 'blank', n: +b.dataset.vblank }));
}
const VSTATES = [['ok', 'Εντάξει'], ['note', 'Με παρατήρηση'], ['fix', 'Χρειάζεται επισκευή']];
async function visitDialog(d, log) {
  const M = contractMachines(d), K = d.checksSnap || [], isNew = !log;
  log = log ? clone(log) : { id: uid(), date: todayISO(), tech: d.iss?.name || DB.settings.iss.name, machines: M.map(m => ({ id: m.id, st: 'ok', note: '' })), checks: K.map((_, i) => i), notes: '' };
  const mrow = (m, i) => { const r = log.machines.find(x => x.id === m.id) || { st: 'ok', note: '' }; return `<tr><td><b>${esc(machineLabel(m) || EQ().one)}</b><span class="sub">${esc(m.location || '')}</span></td><td><select data-vm="${m.id}" aria-label="Κατάσταση">${VSTATES.map(([k, l]) => `<option value="${k}" ${r.st === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><input class="inp" data-vn="${m.id}" value="${esc(r.note)}" placeholder="παρατήρηση" aria-label="Παρατήρηση"></td></tr>`; };
  let vals = null;
  const r = await modal({ title: isNew ? 'Καταγραφή επίσκεψης' : 'Επίσκεψη ' + fmtDate(log.date), wide: true,
    body: `<div class="form"><div class="f"><label for="vd-date">Ημερομηνία</label><input type="date" id="vd-date" value="${esc(log.date)}"></div><div class="f"><label for="vd-tech">Τεχνικός</label><input id="vd-tech" value="${esc(log.tech)}"></div></div>
      <div class="sub-h">${EQ().many}</div><div class="tablewrap"><table class="list vtab"><tbody>${M.map(mrow).join('') || `<tr><td class="mut">${EQ().none}</td></tr>`}</tbody></table></div>
      <div class="sub-h">Εργασίες που έγιναν</div><div class="vchecks">${K.map((k, i) => `<label class="chk"><input type="checkbox" data-vk="${i}" ${log.checks.includes(i) ? 'checked' : ''}> ${esc(k.t)}</label>`).join('')}</div>
      <div class="f" style="margin-top:12px"><label for="vd-notes">Σημειώσεις / προτάσεις προς τον πελάτη</label><textarea id="vd-notes">${esc(log.notes)}</textarea></div>`,
    actions: [...(isNew ? [] : [{ label: 'Διαγραφή', value: 'del', cls: 'danger' }]), '|', { label: 'Άκυρο', value: null }, { label: 'Αποθήκευση & δελτίο', value: 'sheet', validate: mb => grab(mb) }, { label: 'Αποθήκευση', value: 'save', cls: 'blue', validate: mb => grab(mb) }] });
  function grab(mb) { vals = { date: $('#vd-date', mb).value || todayISO(), tech: $('#vd-tech', mb).value.trim(), notes: $('#vd-notes', mb).value.trim(), machines: M.map(m => ({ id: m.id, st: $(`[data-vm="${m.id}"]`, mb).value, note: $(`[data-vn="${m.id}"]`, mb).value.trim() })), checks: $$('[data-vk]', mb).filter(c => c.checked).map(c => +c.dataset.vk) }; return true; }
  if (r === 'del') { if (await confirmBox('Διαγραφή επίσκεψης', 'Να διαγραφεί η καταγραφή της επίσκεψης;')) { d.visitLog = d.visitLog.filter(l => l.id !== log.id); persistDoc(d, true); viewContract(d); } return; }
  if (!vals || !['save', 'sheet'].includes(r)) return;
  Object.assign(log, vals);
  const i = d.visitLog.findIndex(l => l.id === log.id); if (i >= 0) d.visitLog[i] = log; else d.visitLog.push(log);
  persistDoc(d, true);
  if (r === 'sheet') go('visit', { id: d.id, vid: log.id }); else { viewContract(d); toast('Η επίσκεψη καταγράφηκε'); }
}
function viewVisit(arg) {
  const d = DB.docs.find(x => x.id === arg?.id); if (!d) return go('contracts');
  const blank = arg.vid === 'blank', log = blank ? null : d.visitLog.find(l => l.id === arg.vid); if (!blank && !log) return go('doc', d.id);
  const S = DB.settings, iss = d.iss || S.iss, M = contractMachines(d), K = d.checksSnap || [];
  const V = visitsOf(d), v = blank ? V.find(x => x.n === arg.n) : V.find(x => x.log?.id === log.id);
  const no = `${d.no} / ${v?.extra ? 'Ε' : v?.n || ''}`, groups = [...new Set(K.map(k => k.g))];
  const st = id => log?.machines.find(x => x.id === id);
  $('#view').innerHTML = `<div class="subbar so"><button class="btn ghost sm" type="button" id="bk">← ${esc(d.no)}</button>
      <div class="dt"><span class="chip contract">Δελτίο επίσκεψης</span><span>${esc(no)}</span>${blank ? '<span class="chip">κενό για συμπλήρωση</span>' : ''}</div><span class="sp"></span>
      ${blank ? '' : '<button class="btn" type="button" id="b-ved">Επεξεργασία</button>'}<button class="btn blue" type="button" id="b-pdf">PDF / Εκτύπωση</button></div>
    <div class="wrap"><div class="page visit" id="page">
    <aside><div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">Τεχνικός</div>${issuerBlock(iss)}</div>
      <div class="blk"><div class="lbl">Συμβόλαιο</div><span class="strong">${esc(d.no)}</span><br>${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}<br>${d.visits} επισκέψεις / έτος</div>
      <div class="totalbox"><div class="lbl">Επίσκεψη</div><div class="big num">${v ? (v.extra ? 'Έκτακτη' : `${v.n} / ${v.of}`) : '—'}</div><div class="split"><span>Μήνας</span><b>${v ? ymLabel(v.ym) : '—'}</b></div></div>
      ${S.brand.credit ? creditHTML() : ''}</aside>
    <main>
      <div class="hA"><div><div class="eb eb-s">ΔΕΛΤΙΟ ΕΠΙΣΚΕΨΗΣ</div><div class="hA-no">${esc(no)}</div></div>
        <div class="hA-r"><div><span class="t">ΗΜΕΡΟΜΗΝΙΑ</span>${blank ? '<span class="fill">……/……/…………</span>' : fmtDate(log.date)}</div><div><span class="t">ΤΕΧΝΙΚΟΣ</span>${blank ? '<span class="fill">………………………</span>' : esc(log.tech)}</div></div></div>
      <div class="lbl">Πελάτης</div><div class="to"><div class="nm2">${esc(d.cl.name)}</div><div class="ln">${esc(d.cl.addr)}</div><div class="ln mut">${[esc(d.cl.tel), esc(d.cl.email)].filter(Boolean).join(' · ')}</div></div>
      <section class="cs"><div class="lbl">${EQ().many}</div><table class="mtab"><thead><tr><th style="width:7mm">#</th><th>${upper(EQ().one)}</th><th style="width:34mm">ΚΑΤΑΣΤΑΣΗ</th><th style="width:48mm">ΠΑΡΑΤΗΡΗΣΗ</th></tr></thead><tbody>
        ${M.map((m, i) => { const s = st(m.id); return `<tr><td class="n">${String(i + 1).padStart(2, '0')}</td><td><b>${esc(machineLabel(m) || EQ().one)}</b>${m.location || m.serial ? `<span class="u">${esc([m.location, m.serial && 'S/N ' + m.serial].filter(Boolean).join(' · '))}</span>` : ''}</td>
          <td>${blank ? VSTATES.map(([, l]) => `<span class="box"></span>${l}`).join('<br>') : `<span class="vst ${s?.st || 'ok'}">${esc((VSTATES.find(x => x[0] === (s?.st || 'ok')) || VSTATES[0])[1])}</span>`}</td><td>${blank ? '' : esc(s?.note || '')}</td></tr>`; }).join('')}</tbody></table></section>
      <section class="cs"><div class="lbl">Εργασίες</div><div class="kgroups vk">${groups.map(g => `<div class="kg"><b>${esc(g)}</b><ul>${K.map((k, i) => k.g === g ? `<li class="${!blank && !log.checks.includes(i) ? 'no' : ''}"><span class="box">${!blank && log.checks.includes(i) ? '✓' : ''}</span><span>${esc(k.t)}</span></li>` : '').join('')}</ul></div>`).join('')}</div></section>
      <section class="cs"><div class="lbl">Σημειώσεις / προτάσεις</div>${blank ? '<div class="lines"></div>' : `<p style="white-space:pre-line">${esc(log.notes) || '—'}</p>`}</section>
      <div class="terms" style="padding-top:6mm"><div class="sign"><div>Ο τεχνικός</div><div>Ο πελάτης · υπογραφή</div></div></div>
    </main></div></div>`;
  $('#bk').onclick = () => go('doc', d.id);
  if ($('#b-ved')) $('#b-ved').onclick = () => visitDialog(d, log);
  $('#b-pdf').onclick = () => doPrint(false, `Δελτίο_${(d.no || '').replace(/\//g, '-')}_${v?.n || ''}_${slug(d.cl.name)}`);
  afterFonts(() => { fitLogo(); fitPages(); });
}

function viewContract(d) {
  cur = d; normContract(d);
  if (!d.file && d.clientId) persistDoc(d, true);
  if (!d.issued && !d.dateManual) d.date = todayISO();
  const S = DB.settings, c = DB.clients.find(x => x.id === d.clientId), E = EQ();
  const iss = d.issued && d.iss ? d.iss : S.iss;
  const accts = (d.issued && d.accounts ? d.accounts : S.accounts).filter(a => a.bank || a.iban);
  const lock = d.issued;
  const checklist = d.issued && d.checksSnap ? d.checksSnap.map((t, i) => ({ id: 's' + i, g: t.g, t: t.t, on: true })) : S.checklist;
  const groups = [...new Set(checklist.map(k => k.g))];
  const allM = d.issued ? (d.machinesSnap || []) : (c ? c.machines : []);
  const PR = pricingLabels();
  $('#view').innerHTML = `<div class="subbar so">
      <button class="btn ghost sm" type="button" id="bk">← Συμβόλαια</button>
      <div class="dt"><span class="chip contract">Συμβόλαιο</span><span id="st-no">${d.issued ? esc(d.no) : 'Πρόχειρο'}</span>${d.issued ? contractStatus(d) : ''}${demoChip(d)}${relChips(d)}</div>
      <span class="sp"></span>
      <div class="dd"><button class="btn" type="button" id="b-opt" aria-haspopup="menu">Επιλογές ⋯</button>
        <div class="menu" id="m-opt" hidden>
          ${d.issued && !d.cancelled ? '<button type="button" id="o-ren">Ανανέωση (νέο συμβόλαιο από τη λήξη)</button>' : ''}
          <button type="button" id="o-dup">Αντίγραφο ως νέο πρόχειρο</button>
          <button type="button" id="o-mail">Κείμενο για email</button>
          ${c ? '<button type="button" id="o-cl">Καρτέλα πελάτη</button>' : ''}
          ${d.issued ? '' : '<button type="button" id="o-draft">Πρόχειρη εκτύπωση (χωρίς αριθμό)</button>'}
          ${d.issued ? '<hr><button type="button" id="o-hard" style="color:var(--bad)">Οριστική διαγραφή αρχείου…</button>' : ''}</div></div>
      ${d.issued ? (d.cancelled ? '' : '<button class="btn danger" type="button" id="b-cancel">Ακύρωση</button>') : '<button class="btn danger" type="button" id="b-del">Διαγραφή</button><button class="btn" type="button" id="b-save">Αποθήκευση</button>'}
      <button class="btn blue" type="button" id="b-pdf">${d.issued ? 'PDF / Εκτύπωση' : 'Έκδοση & PDF'}</button>
    </div>
    <div class="wrap">${statusCard(d)}${visitsCard(d)}
    ${lock ? '' : `<div class="cset so card">
      <div class="cset-h"><b>Στοιχεία συμβολαίου</b><span class="mut">Επιλέξτε επισκέψεις, διάρκεια και κόστος. Στο έγγραφο από κάτω τσεκάρετε ${E.as} και εργασίες.</span></div>
      <div class="cgrid">
        <div class="f"><label for="k-start">Έναρξη</label><input id="k-start" type="date" value="${esc(d.start)}"></div>
        <div class="f"><label for="k-months">Διάρκεια (μήνες)</label><select id="k-months">${[6, 12, 24, 36].map(m => `<option ${+d.months === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="f"><label for="k-visits">Επισκέψεις / έτος</label><select id="k-visits">${[1, 2, 3, 4, 6, 12].map(v => `<option ${+d.visits === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="f"><label for="k-vat">ΦΠΑ %</label><input id="k-vat" type="number" min="0" max="100" value="${esc(d.vat)}"></div>
        <div class="f wide2"><label>Ενδεικτικοί μήνες επισκέψεων</label><div class="mchips" id="k-vm">${MONTHS_GEN.map((m, i) => `<button type="button" data-m="${i}" class="${d.vmonths.includes(i) ? 'on' : ''}" aria-pressed="${d.vmonths.includes(i)}">${m}</button>`).join('')}</div></div>
        <div class="f wide2"><label for="k-mode">Τρόπος χρέωσης</label><select id="k-mode">${Object.entries(PR).map(([k, l]) => `<option value="${k}" ${d.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="f"><label for="k-amount">Ποσό (€, χωρίς ΦΠΑ)</label><input id="k-amount" inputmode="decimal" value="${esc(String(d.amount).replace('.', ','))}"></div>
        <div class="f wide3"><label for="k-pay">Πληρωμή</label><input id="k-pay" list="k-pays" value="${esc(d.payment)}"><datalist id="k-pays">${PAYMENTS.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      </div><div class="cbreak mut" id="k-break"></div>
      ${allM.length ? '' : `<div class="warnbox" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${E.none} Προσθέστε για να εκδοθεί το συμβόλαιο.<button class="btn sm blue" type="button" id="b-addm2">+ ${E.one}</button></div>`}</div>`}
    <div class="page contract" id="page">
    <aside>
      <div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">Ανάδοχος</div>${issuerBlock(iss)}</div>
      <div class="blk"><div class="lbl">Πληρωμή</div>
        ${accts.map(a => `<div class="acct"><span class="k">${esc(a.bank)}</span><br><span class="iban">${esc(a.iban)}</span></div>`).join('')}
        <span class="k">Αιτιολογία:</span> <span data-out="no"></span></div>
      <div class="totalbox"><div class="lbl">Κόστος με ΦΠΑ</div><div class="big num" data-out="tot"></div>
        <div class="split"><span>Ανά επίσκεψη</span><b class="num" data-out="perVisit"></b></div>
        <div class="split"><span>Επισκέψεις</span><b class="num" data-out="visitsAll"></b></div></div>
      ${S.brand.credit ? creditHTML() : ''}
    </aside>
    <main>
      <div class="hA"><div><div class="eb eb-s">ΣΥΜΒΟΛΑΙΟ ΣΥΝΤΗΡΗΣΗΣ</div><div class="hA-no"><span data-out="no"></span>${d.issued ? '' : '<span class="prov" title="Ο αριθμός οριστικοποιείται με την έκδοση">ΠΡΟΣΩΡΙΝΟΣ</span>'}</div></div>
        <div class="hA-r"><div><span class="t">ΗΜΕΡΟΜΗΝΙΑ</span>${lock ? '<span data-out="date"></span>' : `<label class="dp" title="Επιλογή ημερομηνίας"><span data-out="date"></span><input type="date" id="e-date" aria-label="Ημερομηνία"></label>`}</div>
        <div><span class="t">ΙΣΧΥΣ</span><span data-out="period"></span></div></div></div>
      <div class="lbl">Πελάτης ${lock ? '' : `<button class="linkbtn so ${c ? 'ok' : ''}" type="button" id="b-pick">${c ? '✓ Από το πελατολόγιο · αλλαγή' : 'Επιλογή από πελατολόγιο'}</button>`}</div>
      <div class="to"><div class="nm2">${esc(d.cl.name) || '<span class="mut">— επιλέξτε πελάτη —</span>'}</div>
        <div class="ln">${d.cl.act ? `<span class="mut">${esc(d.cl.act)}</span>` : ''}</div>
        <div class="ln">${esc(d.cl.addr)}</div>
        <div class="ln">${[d.cl.afm && 'ΑΦΜ ' + esc(d.cl.afm), d.cl.doy && 'ΔΟΥ ' + esc(d.cl.doy)].filter(Boolean).join(' · ')}</div>
        <div class="ln mut">${[esc(d.cl.tel), esc(d.cl.email)].filter(Boolean).join(' · ')}</div></div>
      <section class="cs"><div class="lbl">1 · Εξοπλισμός που καλύπτεται ${lock || !c ? '' : `<button class="linkbtn so" type="button" id="b-addm">+ Νέο ${E.a} στον πελάτη</button>`}</div>
        ${allM.length ? `<table class="mtab"><thead><tr><th style="width:7mm">#</th><th>${upper(E.one)}</th><th style="width:30mm">ΘΕΣΗ</th><th style="width:30mm">ΣΕΙΡΙΑΚΟΣ</th></tr></thead><tbody>
          ${allM.map(m => { const on = lock || d.machineIds.includes(m.id); return `<tr class="${on ? '' : 'off'}"><td class="n"><span class="nn"></span>${lock ? '' : `<input type="checkbox" class="so ck" data-mid="${m.id}" ${on ? 'checked' : ''} aria-label="Συμπερίληψη">`}</td><td>${lock ? `<b>${esc(machineLabel(m) || E.one)}</b>` : `<button class="medit" type="button" data-medit="${m.id}" title="Επεξεργασία"><b>${esc(machineLabel(m) || E.one)}</b><span class="so"> ✎</span></button>`}</td><td>${esc(m.location) || '—'}</td><td>${esc(m.serial) || '—'}</td></tr>`; }).join('')}</tbody></table>`
          : `<p class="mut">${E.none}</p>`}</section>
      <section class="cs"><div class="lbl">2 · Πρόγραμμα συντήρησης</div><p data-out="sched"></p></section>
      <section class="cs"><div class="lbl">3 · Εργασίες σε κάθε επίσκεψη</div><div class="kgroups">
        ${groups.map(g => `<div class="kg"><b>${esc(g)}</b><ul>${checklist.filter(k => k.g === g).map(k => { const on = lock || d.checks.includes(k.id); return `<li class="${on ? '' : 'off'}">${lock ? '' : `<input type="checkbox" class="so ck" data-kid="${k.id}" ${on ? 'checked' : ''} aria-label="${esc(k.t)}">`}<span>${esc(k.t)}</span></li>`; }).join('')}</ul></div>`).join('')}</div></section>
      <section class="cs"><div class="lbl">4 · Κόστος</div>
        <div class="cost"><div><span data-out="calcline"></span><span class="num" data-out="net"></span></div><div><span>ΦΠΑ <span data-out="vatp"></span>%</span><span class="num" data-out="vatv"></span></div><div class="g"><span>Σύνολο</span><span class="num" data-out="tot"></span></div></div>
        <p class="pay">Πληρωμή: <b data-out="payment"></b></p></section>
      <section class="cs"><div class="lbl">5 · Δεν περιλαμβάνονται</div><ul class="excl" id="excl"></ul>${lock ? '' : '<button class="addrow so" id="b-excl" type="button">+ Προσθήκη</button>'}</section>
      <section class="cs terms"><div class="lbl">6 · Όροι</div><ol id="terms">
        <li>Το συμβόλαιο ισχύει από <b data-out="startD"></b> έως <b data-out="endD"></b>.</li>
        <li>Οι επισκέψεις πραγματοποιούνται κατόπιν συνεννόησης, ενδεικτικά τους μήνες που αναφέρονται στο πρόγραμμα.</li>
        <li>Μετά από κάθε επίσκεψη ο πελάτης ενημερώνεται για την κατάσταση του εξοπλισμού. Τυχόν επισκευές εκτελούνται μόνο με τη σύμφωνη γνώμη του και χρεώνονται χωριστά.</li>
        <li>Οι τιμές είναι χωρίς ΦΠΑ· ο ΦΠΑ <span data-out="vatp"></span>% υπολογίζεται επί του ποσού.</li>
        <li>Το συμβόλαιο μπορεί να ανανεωθεί με νέα συμφωνία πριν από τη λήξη του.</li></ol>
        ${lock ? '' : '<button class="addrow so" id="b-term" type="button">+ Προσθήκη όρου</button>'}
        <div class="sign"><div>Ο ανάδοχος</div><div>Ο πελάτης · υπογραφή / σφραγίδα</div></div></section>
    </main></div></div>`;
  setWM(d);
  $('#bk').onclick = () => go('contracts');
  const mo = $('#m-opt'); $('#b-opt').onclick = e => { e.stopPropagation(); mo.hidden = !mo.hidden; };
  if ($('#o-ren')) $('#o-ren').onclick = () => { persistDoc(d, true); const nc = newContract(c, contractCopy(d, { start: addDays(contractEnd(d), 1), from: { id: d.id, type: 'contract', no: d.no } })); go('doc', nc.id); toast('Δημιουργήθηκε πρόχειρο ανανέωσης'); };
  $('#o-dup').onclick = () => { persistDoc(d, true); const nc = newContract(c, contractCopy(d)); go('doc', nc.id); toast('Δημιουργήθηκε αντίγραφο ως νέο πρόχειρο'); };
  $('#o-mail').onclick = () => emailDialog(d);
  if ($('#o-cl')) $('#o-cl').onclick = () => go('client', c.id);
  if ($('#o-hard')) $('#o-hard').onclick = async () => { if (await hardDelete(d)) go('contracts'); };
  if ($('#b-del')) $('#b-del').onclick = async () => { if (await deleteDoc(d)) go('contracts'); };
  if ($('#b-cancel')) $('#b-cancel').onclick = () => cancelDoc(d);
  if ($('#b-save')) $('#b-save').onclick = () => saveNow(d);
  if ($('#o-draft')) $('#o-draft').onclick = () => { mo.hidden = true; doPrint(true); };
  $('#b-pdf').onclick = () => d.issued ? doPrint(false) : issueContract(d);
  bindStatusCard(d); bindVisitsCard(d);
  const drawExcl = () => {
    const ul = $('#excl'); ul.innerHTML = '';
    d.excl.forEach((t, i) => { const li = document.createElement('li'); if (lock) li.textContent = t; else { const sp = document.createElement('span'); sp.contentEditable = 'true'; sp.dataset.ph = 'περιγραφή'; sp.textContent = t;
      sp.oninput = () => { d.excl[i] = textOf(sp); persistDoc(d); }; sp.onblur = () => { if (!d.excl[i]?.trim()) { d.excl.splice(i, 1); drawExcl(); persistDoc(d); } }; li.appendChild(sp); } ul.appendChild(li); });
  };
  drawExcl(); renderTerms(d);
  if (!lock) {
    $('#b-excl').onclick = () => { d.excl.push(''); drawExcl(); $$('#excl [contenteditable]').pop().focus(); };
    $('#b-term').onclick = () => { d.extra.push(''); renderTerms(d); $$('#terms li.x span').pop().focus(); };
    const touch = () => { calcContract(); persistDoc(d); };
    const de = $('#e-date'); de.value = d.date; de.onchange = () => { if (de.value) { d.date = de.value; d.dateManual = true; touch(); } }; de.onclick = () => { try { de.showPicker(); } catch (e) { } };
    $('#k-start').onchange = e => { if (e.target.value) { d.start = e.target.value; touch(); } };
    $('#k-months').onchange = e => { d.months = +e.target.value; touch(); };
    $('#k-visits').onchange = e => { d.visits = +e.target.value; d.vmonths = clone(VISIT_MONTHS[d.visits] || []); $$('#k-vm button').forEach(b => { const on = d.vmonths.includes(+b.dataset.m); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); touch(); };
    $$('#k-vm button').forEach(b => b.onclick = () => { const m = +b.dataset.m; d.vmonths = d.vmonths.includes(m) ? d.vmonths.filter(x => x !== m) : [...d.vmonths, m].sort((a, b) => a - b); b.classList.toggle('on'); b.setAttribute('aria-pressed', d.vmonths.includes(m)); touch(); });
    $('#k-vat').oninput = e => { d.vat = e.target.value; touch(); };
    $('#k-mode').onchange = e => { d.mode = e.target.value; touch(); };
    $('#k-amount').oninput = e => { d.amount = num(e.target.value); touch(); };
    $('#k-pay').oninput = e => { d.payment = e.target.value; touch(); };
    $$('.ck[data-mid]').forEach(cb => cb.onchange = () => { const id = cb.dataset.mid; d.machineIds = cb.checked ? [...new Set([...d.machineIds, id])] : d.machineIds.filter(x => x !== id); cb.closest('tr').classList.toggle('off', !cb.checked); touch(); });
    $$('.ck[data-kid]').forEach(cb => cb.onchange = () => { const id = cb.dataset.kid; d.checks = cb.checked ? [...new Set([...d.checks, id])] : d.checks.filter(x => x !== id); cb.closest('li').classList.toggle('off', !cb.checked); touch(); });
    if ($('#b-pick')) $('#b-pick').onclick = async () => { const nc = await clientPicker(); if (!nc) return; d.clientId = nc.id; d.cl = pickCl(nc); d.machineIds = nc.machines.map(m => m.id); if (nc.demo) d.demo = true; persistDoc(d, true); viewContract(d); };
    $$('[data-medit]').forEach(bt => bt.onclick = async () => { const m = c.machines.find(x => x.id === bt.dataset.medit); if (!m) return; const r = await machineForm(clone(m)); if (r && typeof r === 'object') { Object.assign(m, r); persistClient(c, true); persistDoc(d); viewContract(d); } });
    if ($('#b-addm2')) $('#b-addm2').onclick = () => $('#b-addm') ? $('#b-addm').click() : null;
    if ($('#b-addm')) $('#b-addm').onclick = async () => { const m = await machineForm({ id: uid() }); if (m && typeof m === 'object') { c.machines.push(m); d.machineIds.push(m.id); persistClient(c, true); persistDoc(d, true); viewContract(d); } };
  }
  calcContract();
  afterFonts(fitLogo);
}
function fitPages() {
  const p = $('#page'); if (!p) return;
  p.style.minHeight = '297mm';
  requestAnimationFrame(() => { const so = $$('.page .so,.page .addrow', p).reduce((a, b) => a + b.offsetHeight, 0); const pages = Math.max(1, Math.ceil((p.scrollHeight - so * .6) / 1122.5 - 0.02)); p.style.minHeight = (pages * 297) + 'mm'; });
}
function calcContract() {
  const d = cur; if (!d) return;
  const t = contractTotals(d), yrs = contractYears(d), E = EQ();
  const vm = d.vmonths.map(i => MONTHS[i]);
  const yr = yrs !== 1 ? ' × ' + String(yrs).replace('.', ',') + ' έτη' : '';
  const per = d.mode === 'total' ? 'Συνολικό ποσό συμβολαίου' : d.mode === 'year' ? `${t.n} ${E.abbr} × ${eur(num(d.amount))} / έτος${yr}` : `${t.n} ${E.abbr} × ${t.v} επισκ./έτος × ${eur(num(d.amount))}${yr}`;
  const out = { no: d.issued ? d.no : nextNo('contract', isDemoDoc(d)), date: fmtDate(d.date), period: `${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}`, startD: fmtDate(d.start), endD: fmtDate(contractEnd(d)),
    sched: `${t.v} ${t.v === 1 ? 'επίσκεψη' : 'επισκέψεις'} ανά έτος${vm.length ? ', ενδεικτικά ' + (vm.length > 1 ? vm.slice(0, -1).join(', ') + ' και ' + vm.slice(-1) : vm[0]) : ''}. Διάρκεια ${d.months} μήνες, συνολικά ${t.visitsAll} ${t.visitsAll === 1 ? 'επίσκεψη' : 'επισκέψεις'} για ${plural(t.n, E.a, E.as)}.`,
    calcline: per, net: eur(t.net), vatv: eur(t.vatv), vatp: d.vat, tot: eur(t.tot), perVisit: eur(t.perVisit), visitsAll: String(t.visitsAll), payment: d.payment || '—' };
  $$('[data-out]').forEach(el => el.textContent = out[el.dataset.out] ?? '');
  $$('.mtab tbody tr:not(.off) .nn').forEach((el, i) => el.textContent = String(i + 1).padStart(2, '0'));
  $$('.mtab tbody tr.off .nn').forEach(el => el.textContent = '');
  fitPages();
  if ($('#k-break')) $('#k-break').innerHTML = t.n ? `Υπολογισμός: ${esc(per)} = <b>${eur(t.net)}</b> + ΦΠΑ = <b>${eur(t.tot)}</b> · ανά επίσκεψη ${eur(t.perVisit)}` : `<span style="color:var(--warn)">Επιλέξτε τουλάχιστον ένα ${E.a} στο έγγραφο.</span>`;
}
async function issueContract(d) {
  const t = contractTotals(d), missing = !d.clientId ? 'Επιλέξτε πελάτη από το πελατολόγιο.' : !t.n ? `Επιλέξτε τουλάχιστον ένα ${EQ().a}.` : !d.checks.length ? 'Επιλέξτε τουλάχιστον μία εργασία συντήρησης.' : '';
  const demo = isDemoDoc(d), no = nextNo('contract', demo);
  const r = await modal({ title: 'Έκδοση συμβολαίου', body: missing ? `<p>${missing}</p>` :
      `<p>Το συμβόλαιο θα πάρει τον αριθμό <b style="color:var(--navy)">${no}</b> και θα αποθηκευτεί οριστικά στον φάκελο Συμβόλαια.</p>
       <ul style="margin:10px 0 0 18px"><li>Πελάτης: <b>${esc(d.cl.name)}</b></li><li>${plural(t.n, EQ().a, EQ().as)} · ${d.visits} επισκέψεις/έτος · ${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</li><li>Σύνολο με ΦΠΑ: <b>${eur(t.tot)}</b></li></ul>
       ${demo ? '<p class="warnbox">Δεδομένα επίδειξης: παίρνει αριθμό ΔΕΙΓΜΑ.</p>' : ''}
       <p class="mut" style="margin-top:12px;font-size:13px">Μετά την έκδοση τα στοιχεία κλειδώνουν. Για αλλαγές φτιάχνετε αντίγραφο ή ανανέωση.</p>`,
    actions: [{ label: 'Πρόχειρη εκτύπωση', value: 'draft' }, '|', { label: 'Άκυρο', value: null }, ...(missing && !t.n && d.clientId ? [{ label: '+ ' + EQ().one, value: 'addm', cls: 'blue' }] : []), ...(missing ? [] : [{ label: 'Έκδοση & PDF', value: 'issue', cls: 'blue' }])] });
  if (r === 'draft') return doPrint(true);
  if (r === 'addm') return $('#b-addm')?.click();
  if (r !== 'issue') return;
  issueContractNow(d, no);
  persistDoc(d, true); await chain;
  viewContract(d); toast(`Εκδόθηκε ${d.no}`);
  setTimeout(() => doPrint(false), 300);
}
function issueContractNow(d, no) {
  const c = DB.clients.find(x => x.id === d.clientId);
  d.no = no; d.issued = true; d.issuedAt = d.issuedAt || todayISO(); if (isDemoDoc(d)) d.demo = true;
  d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban));
  d.machinesSnap = clone(contractMachines({ ...d, issued: false }));
  d.checksSnap = DB.settings.checklist.filter(k => d.checks.includes(k.id)).map(k => ({ g: k.g, t: k.t }));
  if (c) d.cl = pickCl(c);
}

/* ================================================================== settings */
function viewSettings() {
  const S = DB.settings, y = new Date().getFullYear();
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>Ρυθμίσεις</h2></div><div class="grid2"><div class="stack">
    <div class="card section"><h3>Στοιχεία επιχείρησης</h3><p class="note">Εμφανίζονται στην πλαϊνή στήλη κάθε εγγράφου. Τα εκδομένα έγγραφα κρατούν τα στοιχεία που είχαν τότε.</p><div id="st-iss"></div>
      <div class="sub-h">Είδος επιχείρησης</div><div id="st-biz"></div></div>
    <div class="card section"><h3>Εμφάνιση εγγράφων</h3><div id="st-brand"></div><div class="sub-h">Προεπισκόπηση</div><div id="st-pv"></div></div>
    <div class="card section"><h3>Τραπεζικοί λογαριασμοί</h3><div id="st-acc"></div></div>
    <div class="card section"><h3>Κατάλογος εργασιών & ειδών <span class="chip">${S.catalog.length}</span></h3><p class="note">Γραμμές που χρησιμοποιείτε συχνά. Στο έγγραφο: «+ Από κατάλογο».</p><div id="st-cat"></div></div>
  </div><div class="stack">
    <div class="card section"><h3>Αντίγραφα ασφαλείας</h3>
      <p class="note">Φάκελος δεδομένων: <b style="color:var(--navy)">${esc(root?.name || '')}</b>. Αυτόματο αντίγραφο γίνεται κάθε μέρα με αλλαγές (τελευταίο: ${S.lastBackup ? fmtDate(S.lastBackup) : '—'}).</p>
      <div class="kpis" style="margin-bottom:12px"><button class="btn blue" type="button" id="b-bk">Αντίγραφο τώρα</button><button class="btn" type="button" id="b-dl">Λήψη αντιγράφου σε αρχείο</button>
        <label class="btn" for="f-rs">Επαναφορά από αρχείο…</label><input type="file" id="f-rs" accept=".json,application/json" hidden></div>
      <div id="bklist"><p class="note" style="margin:0">Φόρτωση αντιγράφων…</p></div></div>
    <div class="card section"><h3>Δεδομένα επίδειξης</h3>${hasDemo() ? `<p class="note">Υπάρχουν φορτωμένα δεδομένα επίδειξης (${DB.clients.filter(c => c.demo).length} πελάτες, ${DB.docs.filter(isDemoDoc).length} έγγραφα).</p><button class="btn danger" type="button" id="b-rmd">Αφαίρεση δεδομένων επίδειξης</button>`
      : `<p class="note">Παραδείγματα πελατών, προσφορών, πληρωμών και συμβολαίων για να δείτε πώς δουλεύει. Σημαδεύονται «ΔΕΙΓΜΑ» και αφαιρούνται με ένα κουμπί.</p><button class="btn" type="button" id="b-ld">Φόρτωση δεδομένων επίδειξης</button>`}</div>
    <div class="card section"><h3>Εξαγωγή για Excel</h3><div class="kpis"><button class="btn" type="button" id="x-docs">Έγγραφα</button><button class="btn" type="button" id="x-cl">Πελάτες</button><button class="btn" type="button" id="x-pay">Πληρωμές</button></div></div>
    <div class="card section"><h3>Φάκελος & εισαγωγή</h3>
      <div class="kpis"><button class="btn" type="button" id="b-cf">Αλλαγή φακέλου</button>
      <label class="btn" for="f-imp">Εισαγωγή παλιού εγγράφου</label><input type="file" id="f-imp" accept=".json,application/json" hidden></div></div>
    <div class="card section"><h3>Προεπιλογές νέων εγγράφων</h3><div class="form">
      <div class="f"><label for="d-vat">ΦΠΑ %</label><input id="d-vat" data-df="vat" type="number" min="0" max="100" value="${esc(S.defaults.vat)}"></div>
      <div class="f"><label for="d-adv">Προκαταβολή %</label><input id="d-adv" data-df="adv" type="number" min="0" max="100" value="${esc(S.defaults.adv)}"></div>
      <div class="f"><label for="d-days">Ισχύς (ημέρες)</label><input id="d-days" data-df="days" type="number" min="1" value="${esc(S.defaults.days)}"></div>
      <div class="f"><label for="d-wm">Εγγύηση ${isHvac() ? 'μηχανημάτων' : 'εξοπλισμού'} (μήνες)</label><input id="d-wm" data-df="warrantyMonths" type="number" min="0" value="${esc(S.defaults.warrantyMonths)}"></div>
      <div class="f"><label for="d-du">Μονάδα χρόνου ολοκλήρωσης</label><select id="d-du" data-df="durU">${DUR_UNITS.map(u => `<option ${u === S.defaults.durU ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div></div>
    <div class="card section"><h3>Αρίθμηση ${y}</h3><p class="note">Ο αριθμός δίνεται μόνο με την έκδοση και υπολογίζεται από τα εκδομένα έγγραφα του φακέλου. Αν έχετε εκδώσει έγγραφα εκτός εφαρμογής, ορίστε από ποιον αριθμό να συνεχίσει.</p>
      <div class="form">${Object.entries(TYPES).map(([t, T]) => `<div class="f"><label for="n-${t}">${T.title}: συνέχεια μετά το</label><input id="n-${t}" data-nt="${t}" type="number" min="0" value="${esc(S.numbering[t]?.[y] || 0)}"><div class="mut" style="font-size:12.5px;margin-top:6px">Επόμενος: <b id="nx-${t}" style="color:var(--navy)">${nextNo(t)}</b></div></div>`).join('')}</div></div>
    <div class="card section"><h3>Σχετικά</h3><p class="note" style="margin:0">${mtCredit()} <b>${esc(APP.name)}</b> · ${esc(APP.sub)} · έκδοση ${APP.version}<br>${esc(ATTRIBUTION)}<br>Ελεύθερο λογισμικό με άδεια GNU GPL-3.0 · κώδικας: <a href="https://${APP.repo}" target="_blank" rel="noopener">${esc(APP.repo)}</a><br>Παρέχεται χωρίς καμία εγγύηση. Δεν εκδίδει φορολογικά παραστατικά.</p></div>
  </div></div>${contractSettingsCard()}</div>`;
  const pv = () => { $('#st-pv').innerHTML = previewHTML(S); afterFonts(fitLogo); const bm = $('.brandmini'); if (bm) bm.innerHTML = brandInline(S.brand, true); };
  issuerForm($('#st-iss'), S, () => { persistSettings(); pv(); });
  bizPicker($('#st-biz'), S, async () => {
    persistSettings();
    if (await confirmBox('Είδος επιχείρησης', 'Να αντικατασταθούν και οι προεπιλεγμένες εργασίες συντήρησης και εξαιρέσεις με αυτές του νέου είδους; (Τα υπάρχοντα συμβόλαια δεν αλλάζουν.)', 'Αντικατάσταση', 'blue')) { S.checklist = clone(CHECKLISTS[S.biz]); S.exclusions = clone(EXCLUSIONS[S.biz]); persistSettings(); }
    viewSettings(); $('#view').insertAdjacentHTML('beforeend', appFoot());
  });
  brandEditor($('#st-brand'), S, () => { pv(); cacheBrand(); });
  accountsEditor($('#st-acc'), S, () => { persistSettings(); pv(); });
  catalogEditor($('#st-cat'), S);
  pv();
  bindContractSettings();
  $$('[data-df]').forEach(i => i.oninput = i.onchange = () => { S.defaults[i.dataset.df] = i.tagName === 'SELECT' ? i.value : num(i.value); persistSettings(); });
  $$('[data-nt]').forEach(i => i.oninput = () => { const t = i.dataset.nt; S.numbering[t] = S.numbering[t] || {}; S.numbering[t][y] = Math.max(0, parseInt(i.value) || 0); persistSettings(); $('#nx-' + t).textContent = nextNo(t); });
  $('#b-bk').onclick = async () => { await flushAll(); await q(() => backupIfNeeded(true)); toast('Δημιουργήθηκε αντίγραφο στον φάκελο Αντίγραφα'); drawBackups(); };
  $('#b-dl').onclick = async () => { await flushAll(); download(`${slug(S.brand.name || 'Έγγραφα') || 'Έγγραφα'}_αντίγραφο_${todayISO()}.json`, JSON.stringify(makeBundle(), null, 2), 'application/json'); toast('Το αντίγραφο αποθηκεύτηκε στις Λήψεις'); };
  $('#f-rs').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { let b; try { b = JSON.parse(r.result); } catch (err) { b = null; } e.target.value = ''; restoreFlow(b, f.name); }; r.readAsText(f); };
  const drawBackups = async () => {
    const dh = await sub(DIRS.backup), list = [];
    for await (const [n, h] of dh.entries()) if (h.kind === 'file' && n.endsWith('.json')) list.push(n);
    list.sort().reverse();
    $('#bklist').innerHTML = list.length ? `<div class="tablewrap"><table class="list"><tbody>${list.slice(0, 12).map(n => `<tr><td>${esc(n.replace('.json', ''))}</td><td class="r"><button class="btn sm" type="button" data-rs="${esc(n)}">Επαναφορά</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note" style="margin:0">Δεν υπάρχουν ακόμα αντίγραφα.</p>';
    $$('[data-rs]').forEach(bt => bt.onclick = async () => { let b = null; try { b = JSON.parse(await (await (await dh.getFileHandle(bt.dataset.rs)).getFile()).text()); } catch (err) { } restoreFlow(b, bt.dataset.rs); });
  };
  drawBackups();
  if ($('#b-ld')) $('#b-ld').onclick = loadDemo;
  if ($('#b-rmd')) $('#b-rmd').onclick = removeDemo;
  $('#x-docs').onclick = () => exportDocsCSV(); $('#x-cl').onclick = exportClientsCSV; $('#x-pay').onclick = exportPaymentsCSV;
  $('#b-cf').onclick = pickFolder;
  $('#f-imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const o = JSON.parse(r.result); if (!o.items || !o.cl) throw 0; const d = newDoc(o.type === 'offer' ? 'offer' : 'proforma', { cl: o.cl, items: o.items, extra: o.extra, vat: o.vat, adv: o.adv, days: o.days, dur: o.dur, durU: o.durU });
      toast('Εισήχθη ως πρόχειρο'); go('doc', d.id); } catch (err) { toast('Το αρχείο δεν είναι έγγραφο της εφαρμογής'); } e.target.value = ''; };
    r.readAsText(f);
  };
}
function catalogEditor(el, S) {
  const draw = () => {
    el.innerHTML = (S.catalog.length ? `<div class="cat-h"><span>Περιγραφή</span><span>Μονάδα</span><span>Τιμή €</span><span>ΦΠΑ %</span><span></span></div>` : '')
      + S.catalog.map((x, i) => `<div class="cat-r"><input class="inp" data-ci="${i}" data-cf="t" value="${esc(x.t)}" aria-label="Περιγραφή"><input class="inp" data-ci="${i}" data-cf="u" value="${esc(x.u)}" aria-label="Μονάδα"><input class="inp" data-ci="${i}" data-cf="p" inputmode="decimal" value="${esc(String(x.p).replace('.', ','))}" aria-label="Τιμή"><input class="inp" data-ci="${i}" data-cf="vat" inputmode="numeric" value="${esc(x.vat ?? '')}" placeholder="—" aria-label="ΦΠΑ"><button class="btn sm danger" type="button" data-cdel="${i}" aria-label="Αφαίρεση">×</button></div>`).join('')
      + `<button class="btn sm" type="button" id="b-cadd" style="margin-top:8px">+ Είδος</button>`;
    $$('[data-ci]', el).forEach(i => i.oninput = () => { const x = S.catalog[+i.dataset.ci], f = i.dataset.cf; x[f] = f === 'p' ? num(i.value) : f === 'vat' ? (i.value.trim() === '' ? '' : clampPct(i.value)) : i.value; persistSettings(); });
    $$('[data-cdel]', el).forEach(b => b.onclick = () => { S.catalog.splice(+b.dataset.cdel, 1); persistSettings(); draw(); });
    $('#b-cadd', el).onclick = () => { S.catalog.push({ id: uid(), t: '', s: '', u: 'τεμ.', p: 0, vat: '' }); draw(); $$('[data-cf=t]', el).pop().focus(); };
  };
  draw();
}
function contractSettingsCard() {
  const S = DB.settings, groups = [...new Set(S.checklist.map(k => k.g))];
  return `<div class="card section" style="margin-top:16px"><h3>Συμβόλαια συντήρησης</h3>
    <p class="note">Οι εργασίες με τσεκ μπαίνουν προεπιλεγμένες σε κάθε νέο συμβόλαιο. Σε κάθε συμβόλαιο μπορείτε να τις αλλάξετε.</p>
    <div class="form" style="margin-bottom:16px">
      <div class="f"><label for="cd-visits">Επισκέψεις / έτος</label><select id="cd-visits" data-cd="visits">${[1, 2, 3, 4, 6, 12].map(v => `<option ${+S.contract.visits === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-months">Διάρκεια (μήνες)</label><select id="cd-months" data-cd="months">${[6, 12, 24, 36].map(v => `<option ${+S.contract.months === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-mode">Τρόπος χρέωσης</label><select id="cd-mode" data-cd="mode">${Object.entries(pricingLabels()).map(([k, l]) => `<option value="${k}" ${S.contract.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-amount">Ποσό (€, χωρίς ΦΠΑ)</label><input id="cd-amount" data-cd="amount" inputmode="decimal" value="${esc(String(S.contract.amount).replace('.', ','))}"></div>
      <div class="f wide"><label for="cd-pay">Πληρωμή</label><input id="cd-pay" data-cd="payment" list="cd-pays" value="${esc(S.contract.payment)}"><datalist id="cd-pays">${PAYMENTS.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div></div>
    <div class="kset">${groups.map(g => `<div class="kset-g"><div class="kset-h"><b>${esc(g)}</b><button class="btn sm ghost" type="button" data-addk="${esc(g)}">+ εργασία</button></div>
      ${S.checklist.filter(k => k.g === g).map(k => `<div class="kset-r"><input type="checkbox" data-kon="${k.id}" ${k.on ? 'checked' : ''} aria-label="Προεπιλογή"><input class="inp" data-kt="${k.id}" value="${esc(k.t)}"><button class="btn sm danger" type="button" data-kdel="${k.id}" aria-label="Αφαίρεση">×</button></div>`).join('')}</div>`).join('')}
      <div class="kset-r" style="margin-top:6px"><input class="inp" id="newg" placeholder="Νέα κατηγορία"><button class="btn sm" type="button" id="b-newg">+ Κατηγορία</button></div></div>
    <h3 style="margin-top:18px">Δεν περιλαμβάνονται (προεπιλογή)</h3>
    <div id="exs">${S.exclusions.map((t, i) => `<div class="kset-r"><input class="inp" data-ex="${i}" value="${esc(t)}"><button class="btn sm danger" type="button" data-exdel="${i}" aria-label="Αφαίρεση">×</button></div>`).join('')}</div>
    <button class="btn sm" type="button" id="b-addex" style="margin-top:8px">+ Εξαίρεση</button></div>`;
}
function bindContractSettings() {
  const S = DB.settings, redraw = () => { const y = scrollY; viewSettings(); $('#view').insertAdjacentHTML('beforeend', appFoot()); scrollTo(0, y); };
  $$('[data-cd]').forEach(i => i.oninput = i.onchange = () => { const k = i.dataset.cd; S.contract[k] = ['visits', 'months'].includes(k) ? +i.value : k === 'amount' ? num(i.value) : i.value; persistSettings(); });
  $$('[data-kon]').forEach(i => i.onchange = () => { S.checklist.find(k => k.id === i.dataset.kon).on = i.checked; persistSettings(); });
  $$('[data-kt]').forEach(i => i.oninput = () => { S.checklist.find(k => k.id === i.dataset.kt).t = i.value; persistSettings(); });
  $$('[data-kdel]').forEach(b => b.onclick = () => { S.checklist = S.checklist.filter(k => k.id !== b.dataset.kdel); persistSettings(); redraw(); });
  $$('[data-addk]').forEach(b => b.onclick = () => { const k = { id: 'k' + uid(), g: b.dataset.addk, t: '', on: true }; const last = S.checklist.map(x => x.g).lastIndexOf(k.g); S.checklist.splice(last + 1, 0, k); persistSettings(); redraw(); $(`[data-kt="${k.id}"]`).focus(); });
  $('#b-newg').onclick = () => { const g = $('#newg').value.trim(); if (!g) return; const k = { id: 'k' + uid(), g, t: '', on: true }; S.checklist.push(k); persistSettings(); redraw(); $(`[data-kt="${k.id}"]`).focus(); };
  $$('[data-ex]').forEach(i => i.oninput = () => { S.exclusions[+i.dataset.ex] = i.value; persistSettings(); });
  $$('[data-exdel]').forEach(b => b.onclick = () => { S.exclusions.splice(+b.dataset.exdel, 1); persistSettings(); redraw(); });
  $('#b-addex').onclick = () => { S.exclusions.push(''); persistSettings(); redraw(); $$('[data-ex]').pop().focus(); };
}

/* ================================================================== demo data (dates relative to today, removable) */
const mkAfm = s => { const a = String(s).padStart(8, '0').slice(0, 8); let t = 0; for (let i = 0; i < 8; i++) t += +a[i] * 2 ** (8 - i); return a + ((t % 11) % 10); };
async function loadDemo() {
  if (hasDemo()) return toast('Τα δεδομένα επίδειξης είναι ήδη φορτωμένα');
  const hv = isHvac(), T = todayISO(), ago = n => addDays(T, -n);
  const C = [
    { name: 'Καφέ Αρμονία ΟΕ', act: 'Καφετέρια', addr: 'Λεωφ. Βουλιαγμένης 210, 172 36 Δάφνη', afm: mkAfm(80123456), doy: 'Αγ. Δημητρίου', tel: '210 970 1122', email: 'info@armonia-demo.gr' },
    { name: 'Οδοντιατρείο Δρ. Μ. Νικολάου', act: 'Οδοντίατρος', addr: 'Ελ. Βενιζέλου 54, 163 45 Ηλιούπολη', afm: mkAfm(12345678), doy: 'Ηλιούπολης', tel: '210 994 3301', email: 'iatreio@demo.gr' },
    { name: 'Ελένη Παπαδάκη', act: '', addr: 'Ναξίου 12, 173 43 Άγιος Δημήτριος', afm: mkAfm(23456789), doy: 'Αγ. Δημητρίου', tel: '694 455 6677', email: 'eleni.p@demo.gr' },
    { name: 'Λογιστικό Γραφείο Σταθόπουλος ΙΚΕ', act: 'Λογιστικές υπηρεσίες', addr: 'Αγ. Σοφίας 8, 171 22 Νέα Σμύρνη', afm: mkAfm(80987654), doy: 'Νέας Σμύρνης', tel: '210 931 5500', email: 'office@stath-demo.gr' },
  ].map(c => normClient({ ...c, demo: true, notes: '' }));
  const M = hv ? [[{ brand: 'Daikin', kind: 'Τοίχου', btu: '12000', location: 'Σάλα' }, { brand: 'Daikin', kind: 'Τοίχου', btu: '12000', location: 'Σάλα πίσω' }, { brand: 'Mitsubishi Electric', kind: 'Κασέτα', btu: '24000', location: 'Μπαρ' }],
      [{ brand: 'LG', kind: 'Τοίχου', btu: '9000', location: 'Ιατρείο 1' }, { brand: 'LG', kind: 'Τοίχου', btu: '9000', location: 'Ιατρείο 2' }, { brand: 'Toshiba', kind: 'Τοίχου', btu: '18000', location: 'Αναμονή' }], [], []]
    : [[{ brand: 'Bosch', kind: 'Λέβητας αερίου', location: 'Λεβητοστάσιο' }, { brand: 'Grundfos', kind: 'Κυκλοφορητής', location: 'Λεβητοστάσιο' }], [{ brand: 'Siemens', kind: 'Ηλεκτρικός πίνακας', location: 'Είσοδος' }, { brand: '', kind: 'Γεννήτρια', location: 'Υπόγειο' }], [], []];
  C.forEach((c, i) => c.machines = M[i].map(m => ({ id: uid(), brand: '', kind: '', btu: '', model: '', serial: '', location: '', installed: ago(400 + i * 60), warrantyEnd: addMonths(ago(400 + i * 60), 24), ...m })));
  DB.clients.push(...C);
  const L = hv ? {
    unit: (n, b) => ({ t: `Κλιματιστικό τοίχου ${b} ${n.toLocaleString('el-GR')} BTU Inverter`, s: 'Προμήθεια μηχανήματος, ενεργειακή κλάση A++', q: 1, u: 'τεμ.', p: n > 10000 ? 690 : 540 }),
    inst: { t: 'Εργασίες εγκατάστασης', s: 'Σωληνώσεις έως 3 μ., βάσεις, ηλεκτρολογική σύνδεση, κενό και δοκιμή', q: 1, u: 'κατ’ αποκοπή', p: 220 },
    serv: { t: 'Καθαρισμός και απολύμανση κλιματιστικού', s: '', q: 3, u: 'τεμ.', p: 45 }, gas: { t: 'Συμπλήρωση ψυκτικού υγρού R32', s: '', q: 1, u: 'κατ’ αποκοπή', p: 80 },
  } : {
    unit: () => ({ t: 'Προμήθεια και τοποθέτηση θερμοσίφωνα 80 λίτρων', s: 'Με βάνα ασφαλείας και σύνδεση', q: 1, u: 'τεμ.', p: 420 }),
    inst: { t: 'Εργασία τεχνικού', s: 'Ανά ώρα, με μετακίνηση', q: 3, u: 'ώρες', p: 35 },
    serv: { t: 'Ετήσιος έλεγχος εγκατάστασης', s: 'Έλεγχος, καθαρισμός, μετρήσεις', q: 1, u: 'κατ’ αποκοπή', p: 90 }, gas: { t: 'Ανταλλακτικά', s: '', q: 1, u: 'κατ’ αποκοπή', p: 65 },
  };
  const mk = (type, c, items, o = {}) => { const d = newDoc(type, { clientId: c.id, cl: pickCl(c), items: clone(items), demo: true }); Object.assign(d, o); return d; };
  const issue = (d, daysAgo) => { d.date = ago(daysAgo); d.dateManual = true; d.no = nextNo(d.type, true); d.issued = true; d.issuedAt = d.date; d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban)); if (d.type === 'offer') d.status = 'sent'; return d; };
  const pay = (d, daysAgo, amt, note, m = 'Τραπεζική κατάθεση') => d.payments.push({ id: uid(), date: ago(daysAgo), amount: Math.round(amt * 100) / 100, method: m, note });
  // 1: accepted offer → paid proforma (equipment goes to the client)
  const o1 = issue(mk('offer', C[2], [{ ...L.unit(12000, hv ? 'Inventor' : ''), q: 2, m: hv ? { on: true, auto: true, brand: 'Inventor', kind: 'Τοίχου', btu: '12000', model: '' } : { on: true, brand: '', kind: 'Θερμοσίφωνας', model: '' } }, L.inst]), 48);
  o1.status = 'accepted'; o1.statusAt = ago(44);
  const p1 = issue(mk('proforma', C[2], o1.items, { from: { id: o1.id, type: 'offer', no: o1.no } }), 44);
  pay(p1, 44, totals(p1).advv, 'Προκαταβολή'); pay(p1, 30, totals(p1).tot - totals(p1).advv, 'Εξόφληση');
  pushMachines(p1, C[2]); C[2].machines.forEach(m => { if (m.source?.docId === p1.id) m.source.docNo = p1.no; });
  // 2: pending offer, 3: expired offer, 4: rejected offer
  issue(mk('offer', C[3], [{ ...L.unit(18000, hv ? 'Mitsubishi Electric' : ''), q: 3 }, { ...L.inst, q: 3 }], { adv: 50 }), 4);
  issue(mk('offer', C[0], [L.serv, L.gas, { t: 'Αντικατάσταση τηλεχειριστηρίου', s: '', q: 1, u: 'τεμ.', p: 35, disc: 10 }], { days: 15 }), 40);
  const o4 = issue(mk('offer', C[1], [{ ...L.unit(9000, hv ? 'LG' : ''), q: 1 }, L.inst]), 25); o4.status = 'rejected'; o4.statusAt = ago(20);
  // 5: proforma with only the advance paid, older than 30 days
  const p5 = issue(mk('proforma', C[0], [{ ...L.serv, q: 3 }, L.gas, { t: 'Υλικά (σωλήνες αποχέτευσης, μονωτικά)', s: '', q: 1, u: 'κατ’ αποκοπή', p: 48, vat: 24 }]), 38);
  pay(p5, 37, totals(p5).advv, 'Προκαταβολή', 'Μετρητά');
  // 6: a draft proforma
  mk('proforma', C[1], [{ ...L.serv, q: 3 }]);
  // 7–8: maintenance contracts, one mid-year with a visit done, one about to expire
  const k1 = newContract(C[0]); Object.assign(k1, { start: addMonths(T, -7).slice(0, 8) + '01', visits: 2, vmonths: [((new Date().getMonth() + 5) % 12), new Date().getMonth()].sort((a, b) => a - b), amount: hv ? 40 : 60, demo: true });
  issueContractNow(k1, nextNo('contract', true)); k1.date = k1.start; k1.issuedAt = k1.start;
  const pv = plannedVisits(k1)[0];
  k1.visitLog.push({ id: uid(), date: pv ? pv.ym + '-12' : ago(150), tech: DB.settings.iss.name, machines: k1.machinesSnap.map((m, i) => ({ id: m.id, st: i === 2 ? 'note' : 'ok', note: i === 2 ? 'Φθορά στη μόνωση σωλήνα, προτείνεται αντικατάσταση' : '' })), checks: k1.checksSnap.map((_, i) => i), notes: 'Όλα σε καλή λειτουργία. Προτείνεται αλλαγή μόνωσης στη μονάδα του μπαρ.' });
  pay(k1, 200, totals(k1).tot, 'Εφάπαξ');
  const k2 = newContract(C[1]); Object.assign(k2, { start: addDays(addMonths(T, -12), 35), visits: 1, vmonths: [3], mode: 'year', amount: hv ? 55 : 80, demo: true });
  issueContractNow(k2, nextNo('contract', true)); k2.date = k2.start; k2.issuedAt = k2.start;
  pay(k2, daysBetween(k2.start, T) - 3, totals(k2).tot, 'Εφάπαξ');
  k2.visitLog.push({ id: uid(), date: (plannedVisits(k2)[0]?.ym || ymOf(addDays(k2.start, 40))) + '-10', tech: DB.settings.iss.name, machines: k2.machinesSnap.map(m => ({ id: m.id, st: 'ok', note: '' })), checks: k2.checksSnap.map((_, i) => i), notes: '' });
  // catalog examples (only if the catalog is empty)
  if (!DB.settings.catalog.length) { DB.settings.catalog.push(...[L.serv, L.gas, L.inst].map(x => ({ id: uid(), t: x.t, s: x.s, u: x.u, p: x.p, vat: '', demo: true }))); persistSettings(); }
  for (const c of C) q(() => saveClient(c));
  for (const d of DB.docs.filter(x => x.demo)) q(() => saveDoc(d));
  await chain;
  shell(); go('home'); toast('Φορτώθηκαν δεδομένα επίδειξης · αφαιρούνται από την μπάρα πάνω');
}
async function removeDemo() {
  const docs = DB.docs.filter(isDemoDoc), cl = DB.clients.filter(c => c.demo);
  if (!(await confirmBox('Αφαίρεση δεδομένων επίδειξης', `Θα διαγραφούν ${cl.length} πελάτες επίδειξης και ${docs.length} έγγραφα επίδειξης. Τα δικά σας δεδομένα δεν αγγίζονται.`, 'Αφαίρεση'))) return;
  await flushAll();
  for (const d of docs) { cancelLater('d' + d.id); if (d.file) await q(() => delFile(d.dir, d.file)); }
  for (const c of cl) { cancelLater('c' + c.id); if (c.file) await q(() => delFile(DIRS.clients, c.file)); }
  DB.docs = DB.docs.filter(d => !docs.includes(d)); DB.clients = DB.clients.filter(c => !c.demo);
  const before = DB.settings.catalog.length; DB.settings.catalog = DB.settings.catalog.filter(x => !x.demo); if (before !== DB.settings.catalog.length) persistSettings();
  await chain; cur = null; view = { name: 'home' };
  go('home'); toast('Τα δεδομένα επίδειξης αφαιρέθηκαν');
}

boot();
