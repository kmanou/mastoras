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
  if (!d.issued) return { k: 'draft', l: tr('Πρόχειρο', 'Draft'), c: 'draft' };
  if (d.cancelled) return { k: 'cancelled', l: tr('Ακυρώθηκε', 'Cancelled'), c: 'bad' };
  const t = todayISO(), end = contractEnd(d);
  if (d.start > t) return { k: 'upcoming', l: tr('Ξεκινά ', 'Starts ') + fmtDate(d.start), c: 'info' };
  if (end < t) return { k: 'expired', l: tr('Έληξε ', 'Ended ') + fmtDate(end), c: 'bad' };
  const left = daysBetween(t, end);
  return left <= 60 ? { k: 'soon', l: tr(`Λήγει σε ${left} ημ.`, `Ends in ${left} days`), c: 'warn' } : { k: 'active', l: tr('Ενεργό', 'Active'), c: 'ok' };
}
const contractStatus = d => chipOf(contractState(d));
const exclFor = lang => clone(lang === 'en' ? DB.settings.exclusionsEn : DB.settings.exclusions);
function normContract(d) {
  const cd = DB.settings.contract;
  d.machineIds = Array.isArray(d.machineIds) ? d.machineIds : [];
  d.checks = Array.isArray(d.checks) ? d.checks : DB.settings.checklist.filter(k => k.on).map(k => k.id);
  d.excl = Array.isArray(d.excl) ? d.excl : exclFor(d.lang);
  d.vmonths = Array.isArray(d.vmonths) ? d.vmonths : clone(VISIT_MONTHS[cd.visits] || []);
  d.visitLog = Array.isArray(d.visitLog) ? d.visitLog : [];
  for (const k of ['months', 'visits', 'mode', 'amount', 'payment']) if (d[k] == null || d[k] === '') d[k] = cd[k];
  if (d.hours == null || d.hours === '') d.hours = PROF().hours ? num(cd.hours) : 0;
  if (d.vat == null || d.vat === '') d.vat = DB.settings.defaults.vat;
  d.start = d.start || todayISO();
  return d;
}
function newContract(c, from) {
  const lang = from?.lang || langForClient(c);
  const d = normDoc({ id: uid(), type: 'contract', issued: false, date: todayISO(), clientId: c ? c.id : '', cl: c ? pickCl(c) : {}, lang });
  Object.assign(d, from ? clone(from) : {}, { id: d.id, type: 'contract', issued: false, no: '', issuedAt: '', date: todayISO(), dateManual: false, machinesSnap: undefined, checksSnap: undefined, visitLog: [], payments: [], cancelled: undefined, created: new Date().toISOString(), lang });
  delete d.file; delete d.dir; delete d.iss; delete d.accounts;
  if (c?.demo) d.demo = true;
  normContract(d);
  if (c && !(from && from.machineIds)) d.machineIds = c.machines.map(m => m.id);
  DB.docs.push(d); return d;
}
const contractCopy = (d, extra) => Object.assign({ clientId: d.clientId, cl: d.cl, machineIds: d.issued ? (d.machinesSnap || []).map(m => m.id) : d.machineIds, checks: d.checks, excl: d.excl, extra: d.extra, months: d.months, visits: d.visits, vmonths: d.vmonths, mode: d.mode, amount: d.amount, payment: d.payment, vat: d.vat, hours: d.hours, demo: d.demo, lang: d.lang }, extra || {});
function openContract(c, from) { const d = newContract(c, from); go('doc', d.id); }
async function newContractFlow() {
  if (!DB.clients.length) { toast(tr(`Δημιουργήστε πρώτα τον πελάτη και ${EQ().as}`, `Create the client and their ${EQ().as} first`)); return go('client', 'new'); }
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
const hoursUsed = d => (d.visitLog || []).reduce((a, l) => a + num(l.hours), 0);
function visitChip(v) {
  const ym = todayISO().slice(0, 7);
  if (v.done) return `<span class="chip ok">${tr('Έγινε', 'Done')} ${fmtDate(v.log.date)}</span>`;
  if (v.ym < ym) return `<span class="chip bad">${tr('Καθυστερεί', 'Overdue')}</span>`;
  if (v.ym === ym) return `<span class="chip warn">${tr('Αυτόν τον μήνα', 'This month')}</span>`;
  return `<span class="chip">${tr('Προγραμματισμένη', 'Scheduled')}</span>`;
}
const nextVisit = d => visitsOf(d).find(v => !v.done);

function viewContracts() {
  const f = filt.contracts;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Συμβόλαια συντήρησης', 'Maintenance agreements')}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Αναζήτηση πελάτη ή αριθμού', 'Search client or number')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση συμβολαίων', 'Search agreements')}">
    <button class="btn sm" type="button" id="b-ics" title="${tr('Οι επισκέψεις και οι έλεγχοι στο ημερολόγιό σας (Google, Outlook)', 'Visits and checks in your calendar (Google, Outlook)')}">⇩ ${tr('Ημερολόγιο', 'Calendar')} .ics</button>
    <button class="btn blue" type="button" id="b-nk">+ ${ttl('contract')}</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg">${[['all', tr('Όλα', 'All')], ['active', tr('Ενεργά', 'Active')], ['visits', tr('Επισκέψεις μήνα', 'Visits this month')], ['soon', tr('Λήγουν', 'Ending')], ['expired', tr('Ληγμένα', 'Ended')], ['draft', tr('Πρόχειρα', 'Drafts')], ['cancelled', tr('Ακυρωμένα', 'Cancelled')]].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Αριθμός', 'Number')}</th><th>${tr('Πελάτης', 'Client')}</th><th>${tr('Περίοδος', 'Period')}</th><th class="r">${EQ().many}</th><th>${tr('Επόμενη επίσκεψη', 'Next visit')}</th><th class="r">${tr('Σύνολο', 'Total')}</th><th>${tr('Κατάσταση', 'Status')}</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const ym = todayISO().slice(0, 7);
  const match = d => { const s = contractState(d).k; return f.t === 'all' || s === f.t || (f.t === 'active' && ['soon', 'upcoming'].includes(s)) || (f.t === 'visits' && ['active', 'soon'].includes(s) && visitsOf(d).some(v => !v.done && v.ym <= ym)); };
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = DB.docs.filter(d => d.type === 'contract' && match(d) && (!ql || [d.no, d.cl.name, d.cl.afm].join(' ').toLowerCase().includes(ql))).sort((a, b) => (contractEnd(a) || '').localeCompare(contractEnd(b) || ''));
    $('#rows').innerHTML = rows.length ? rows.map(d => { const t = totals(d), nv = d.issued && !d.cancelled ? nextVisit(d) : null;
      return `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}" tabindex="0"><td><b>${d.issued ? esc(d.no) : '<span class="mut">—</span>'}</b>${langChip(d)}${demoChip(d)}</td><td>${esc(d.cl.name) || `<span class="mut">${tr('χωρίς πελάτη', 'no client')}</span>`}</td>
      <td class="num">${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</td><td class="r num">${t.n}</td><td>${nv ? `${ymLabel(nv.ym)} ${nv.ym <= ym ? visitChip(nv) : ''}` : '<span class="mut">—</span>'}</td><td class="r num"><b>${eur(t.tot)}</b></td><td>${contractStatus(d)}</td>${rowActions(d)}</tr>`; }).join('')
      : `<tr><td colspan="8"><div class="empty"><b>${DB.docs.some(d => d.type === 'contract') ? tr('Κανένα συμβόλαιο με αυτά τα φίλτρα', 'No agreements match these filters') : tr('Δεν υπάρχουν ακόμα συμβόλαια', 'No agreements yet')}</b>${tr('Πατήστε «+ Συμβόλαιο» ή ανοίξτε την καρτέλα ενός πελάτη.', 'Press “+ Agreement” or open a client.')}</div></td></tr>`;
    $$('#rows tr.click').forEach(r => { r.onclick = () => go('doc', r.dataset.id); r.onkeydown = e => { if (e.key === 'Enter') go('doc', r.dataset.id); }; });
    bindRowActions(draw);
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $$('.seg button').forEach(b => b.onclick = () => { f.t = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#b-nk').onclick = newContractFlow;
  $('#b-ics').onclick = () => exportICS();
  draw();
}

function visitsCard(d) {
  if (!d.issued || d.cancelled) return '';
  const V = visitsOf(d), hrs = num(d.hours);
  return `<div class="statuscard so card"><div class="sc-row"><b>${tr('Επισκέψεις', 'Visits')}</b><span class="mut">${tr(`${V.filter(v => v.done).length} από ${V.filter(v => !v.extra).length} έγιναν`, `${V.filter(v => v.done).length} of ${V.filter(v => !v.extra).length} done`)}</span>${hrs ? `<span class="chip ${hoursUsed(d) > hrs * contractYears(d) ? 'bad' : 'info'}">${tr('Ώρες', 'Hours')} ${decStr(hoursUsed(d))} / ${decStr(hrs * contractYears(d))}</span>` : ''}<span class="sp"></span><button class="btn sm" type="button" id="v-ics" title="${tr('Οι επισκέψεις στο ημερολόγιο', 'The visits in your calendar')}">⇩ .ics</button><button class="btn sm blue" type="button" id="v-new">+ ${tr('Καταγραφή επίσκεψης', 'Log a visit')}</button></div>
    <table class="list pays"><tbody>${V.map(v => `<tr><td><b>${v.extra ? tr('Έκτακτη', 'Extra') : tr(`${v.n}η`, `#${v.n}`)}</b></td><td>${ymLabel(v.ym)}</td><td>${visitChip(v)}</td><td class="mut">${esc(v.log?.notes?.slice(0, 60) || '')}${v.log?.hours ? ` · ${decStr(v.log.hours)} ${tr('ώρ.', 'h')}` : ''}</td>
      <td class="r acts">${v.done ? `<button class="btn sm" type="button" data-vsheet="${v.log.id}">${tr('Δελτίο', 'Report')}</button><button class="btn sm ghost" type="button" data-vedit="${v.log.id}" aria-label="${tr('Επεξεργασία', 'Edit')}">✎</button>` : `<button class="btn sm" type="button" data-vblank="${v.n}" title="${tr('Για συμπλήρωση με το χέρι', 'To fill in by hand')}">${tr('Κενό δελτίο', 'Blank report')}</button><button class="btn sm blue" type="button" data-vlog="${v.n}">${tr('Έγινε', 'Done')}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
function bindVisitsCard(d) {
  if ($('#v-new')) $('#v-new').onclick = () => visitDialog(d);
  if ($('#v-ics')) $('#v-ics').onclick = () => exportICS([d]);
  $$('[data-vlog]').forEach(b => b.onclick = () => visitDialog(d));
  $$('[data-vedit]').forEach(b => b.onclick = () => visitDialog(d, d.visitLog.find(l => l.id === b.dataset.vedit)));
  $$('[data-vsheet]').forEach(b => b.onclick = () => go('visit', { id: d.id, vid: b.dataset.vsheet }));
  $$('[data-vblank]').forEach(b => b.onclick = () => go('visit', { id: d.id, vid: 'blank', n: +b.dataset.vblank }));
}
const VSTATES = [['ok', ['Εντάξει', 'OK']], ['note', ['Με παρατήρηση', 'With remark']], ['fix', ['Χρειάζεται επισκευή', 'Needs repair']]];
async function visitDialog(d, log) {
  const M = contractMachines(d), K = d.checksSnap || [], isNew = !log, P = PROF();
  log = log ? clone(log) : { id: uid(), date: todayISO(), tech: d.iss?.name || DB.settings.iss.name, machines: M.map(m => ({ id: m.id, st: 'ok', note: '', ms: {} })), checks: K.map((_, i) => i), notes: '', hours: '' };
  const mrow = m => { const r = log.machines.find(x => x.id === m.id) || { st: 'ok', note: '' }; return `<tr><td><b>${esc(machineLabel(m) || EQ().one)}</b><span class="sub">${esc(m.location || '')}</span></td><td><select data-vm="${m.id}" aria-label="${tr('Κατάσταση', 'Condition')}">${VSTATES.map(([k, l]) => `<option value="${k}" ${r.st === k ? 'selected' : ''}>${pick2(l)}</option>`).join('')}</select></td><td><input class="inp" data-vn="${m.id}" value="${esc(r.note)}" placeholder="${tr('παρατήρηση', 'remark')}" aria-label="${tr('Παρατήρηση', 'Remark')}"></td></tr>${hasMeas(m) ? `<tr class="msr"><td colspan="3">${measInputs(r.ms, m.id)}</td></tr>` : ''}`; };
  let vals = null;
  const r = await modal({ title: isNew ? tr('Καταγραφή επίσκεψης', 'Log a visit') : tr('Επίσκεψη ', 'Visit ') + fmtDate(log.date), wide: true,
    body: `<div class="form"><div class="f"><label for="vd-date">${tr('Ημερομηνία', 'Date')}</label><input type="date" id="vd-date" value="${esc(log.date)}"></div><div class="f"><label for="vd-tech">${tr('Τεχνικός', 'Technician')}</label><input id="vd-tech" value="${esc(log.tech)}"></div>${P.hours || num(d.hours) ? `<div class="f"><label for="vd-hours">${tr('Χρόνος εργασίας (ώρες)', 'Time spent (hours)')}</label><input id="vd-hours" inputmode="decimal" value="${esc(log.hours ? decStr(log.hours) : '')}" placeholder="${tr('π.χ. 1,5', 'e.g. 1.5')}"></div>` : ''}</div>
      <div class="sub-h">${EQ().many}${measList().length ? ` · ${tr('μετρήσεις', 'measurements')}` : ''}</div><div class="tablewrap"><table class="list vtab"><tbody>${M.map(mrow).join('') || `<tr><td class="mut">${EQ().none}</td></tr>`}</tbody></table></div>
      <div class="sub-h">${tr('Εργασίες που έγιναν', 'Work done')}</div><div class="vchecks">${K.map((k, i) => `<label class="chk"><input type="checkbox" data-vk="${i}" ${log.checks.includes(i) ? 'checked' : ''}> ${esc(k.t)}</label>`).join('')}</div>
      <div class="f" style="margin-top:12px"><label for="vd-notes">${tr('Σημειώσεις / προτάσεις προς τον πελάτη', 'Notes / recommendations to the client')}</label><textarea id="vd-notes">${esc(log.notes)}</textarea></div>`,
    actions: [...(isNew ? [] : [{ label: tr('Διαγραφή', 'Delete'), value: 'del', cls: 'danger' }]), '|', { label: tr('Άκυρο', 'Cancel'), value: null }, { label: tr('Αποθήκευση & δελτίο', 'Save & report'), value: 'sheet', validate: mb => grab(mb) }, { label: tr('Αποθήκευση', 'Save'), value: 'save', cls: 'blue', validate: mb => grab(mb) }] });
  function grab(mb) { vals = { date: $('#vd-date', mb).value || todayISO(), tech: $('#vd-tech', mb).value.trim(), notes: $('#vd-notes', mb).value.trim(), hours: $('#vd-hours', mb) ? ($('#vd-hours', mb).value.trim() === '' ? '' : num($('#vd-hours', mb).value)) : (log.hours || ''),
    machines: M.map(m => ({ id: m.id, st: $(`[data-vm="${m.id}"]`, mb).value, note: $(`[data-vn="${m.id}"]`, mb).value.trim(), ...(hasMeas(m) ? { ms: measGrab(mb, m.id) } : {}) })), checks: $$('[data-vk]', mb).filter(c => c.checked).map(c => +c.dataset.vk) }; return true; }
  if (r === 'del') { if (await confirmBox(tr('Διαγραφή επίσκεψης', 'Delete visit'), tr('Να διαγραφεί η καταγραφή της επίσκεψης;', 'Delete this visit record?'))) { d.visitLog = d.visitLog.filter(l => l.id !== log.id); persistDoc(d, true); viewContract(d); } return; }
  if (!vals || !['save', 'sheet'].includes(r)) return;
  Object.assign(log, vals);
  const i = d.visitLog.findIndex(l => l.id === log.id); if (i >= 0) d.visitLog[i] = log; else d.visitLog.push(log);
  persistDoc(d, true);
  if (r === 'sheet') go('visit', { id: d.id, vid: log.id }); else { viewContract(d); toast(tr('Η επίσκεψη καταγράφηκε', 'The visit was logged')); }
}
function viewVisit(arg) {
  const d = DB.docs.find(x => x.id === arg?.id); if (!d) return go('contracts');
  const blank = arg.vid === 'blank', log = blank ? null : d.visitLog.find(l => l.id === arg.vid); if (!blank && !log) return go('doc', d.id);
  useDocLang(d);
  const S = DB.settings, iss = d.iss || S.iss, M = contractMachines(d), K = d.checksSnap || [], E = DEQ();
  const V = visitsOf(d), v = blank ? V.find(x => x.n === arg.n) : V.find(x => x.log?.id === log.id);
  const no = `${d.no} / ${v?.extra ? dt('Ε', 'X') : v?.n || ''}`, groups = [...new Set(K.map(k => k.g))];
  const st = id => log?.machines.find(x => x.id === id);
  /* blank report: a row with spaces to fill in · filled report: the values inside the unit cell */
  const measRow = m => blank && hasMeas(m) ? `<tr class="msr"><td></td><td colspan="3"><span class="mlbl">${dt('Μετρήσεις', 'Measurements')}:</span> ${measList().map(f => `<span class="mfill">${esc(dpick2(f.short || f.l))}${f.u ? ' (' + f.u + ')' : ''} <i></i></span>`).join('')}</td></tr>` : '';
  const measCell = m => { if (blank || !hasMeas(m)) return ''; const t = measText(st(m.id)?.ms, true); return t ? `<span class="u mtxt"><span class="mlbl">${dt('Μετρήσεις', 'Measurements')}:</span> ${esc(t)}</span>` : ''; };
  $('#view').innerHTML = `<div class="subbar so"><button class="btn ghost sm" type="button" id="bk">← ${esc(d.no)}</button>
      <div class="dt"><span class="chip contract">${tr('Δελτίο επίσκεψης', 'Visit report')}</span><span>${esc(no)}</span>${blank ? `<span class="chip">${tr('κενό για συμπλήρωση', 'blank, to fill in')}</span>` : ''}${langChip(d)}</div><span class="sp"></span>
      ${blank ? '' : `<button class="btn" type="button" id="b-ved">${tr('Επεξεργασία', 'Edit')}</button>`}<button class="btn blue" type="button" id="b-pdf">${tr('PDF / Εκτύπωση', 'PDF / Print')}</button></div>
    <div class="wrap"><div class="page visit" id="page" lang="${DL}">
    <aside><div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">${dt('Τεχνικός', 'Technician')}</div>${issuerBlock(iss)}</div>
      <div class="blk"><div class="lbl">${dt('Συμβόλαιο', 'Agreement')}</div><span class="strong">${esc(d.no)}</span><br>${ddate(d.start)} – ${ddate(contractEnd(d))}<br>${dt(`${d.visits} επισκέψεις / έτος`, `${d.visits} visits / year`)}</div>
      <div class="totalbox"><div class="lbl">${dt('Επίσκεψη', 'Visit')}</div><div class="big num">${v ? (v.extra ? dt('Έκτακτη', 'Extra') : `${v.n} / ${v.of}`) : '—'}</div><div class="split"><span>${dt('Μήνας', 'Month')}</span><b>${v ? dym(v.ym) : '—'}</b></div>${!blank && log.hours ? `<div class="split"><span>${dt('Χρόνος', 'Time')}</span><b>${dpct(log.hours)} ${dt('ώρ.', 'h')}</b></div>` : ''}</div>
      ${S.brand.credit ? creditHTML() : ''}</aside>
    <main>
      <div class="hA"><div><div class="eb eb-s">${dt('ΔΕΛΤΙΟ ΕΠΙΣΚΕΨΗΣ', 'VISIT REPORT')}</div><div class="hA-no">${esc(no)}</div></div>
        <div class="hA-r"><div><span class="t">${dt('ΗΜΕΡΟΜΗΝΙΑ', 'DATE')}</span>${blank ? '<span class="fill">……/……/…………</span>' : ddate(log.date)}</div><div><span class="t">${dt('ΤΕΧΝΙΚΟΣ', 'TECHNICIAN')}</span>${blank ? '<span class="fill">………………………</span>' : esc(log.tech)}</div></div></div>
      <div class="lbl">${dt('Πελάτης', 'Client')}</div><div class="to"><div class="nm2">${esc(d.cl.name)}</div><div class="ln">${esc(d.cl.addr)}</div><div class="ln mut">${[esc(d.cl.tel), esc(d.cl.email)].filter(Boolean).join(' · ')}</div></div>
      <section class="cs"><div class="lbl">${E.many}</div><table class="mtab"><thead><tr><th style="width:7mm">#</th><th>${upper(E.one)}</th><th style="width:34mm">${dt('ΚΑΤΑΣΤΑΣΗ', 'CONDITION')}</th><th style="width:48mm">${dt('ΠΑΡΑΤΗΡΗΣΗ', 'REMARK')}</th></tr></thead><tbody>
        ${M.map((m, i) => { const s = st(m.id); return `<tr><td class="n">${String(i + 1).padStart(2, '0')}</td><td><b>${esc(machineLabel(m, true) || E.one)}</b>${m.location || m.serial ? `<span class="u">${esc([m.location, m.serial && 'S/N ' + m.serial].filter(Boolean).join(' · '))}</span>` : ''}${measCell(m)}</td>
          <td>${blank ? VSTATES.map(([, l]) => `<span class="box"></span>${dpick2(l)}`).join('<br>') : `<span class="vst ${s?.st || 'ok'}">${esc(dpick2((VSTATES.find(x => x[0] === (s?.st || 'ok')) || VSTATES[0])[1]))}</span>`}</td><td>${blank ? '' : esc(s?.note || '')}</td></tr>${measRow(m)}`; }).join('')}</tbody></table></section>
      <section class="cs"><div class="lbl">${dt('Εργασίες', 'Work')}</div><div class="kgroups vk">${groups.map(g => `<div class="kg"><b>${esc(g)}</b><ul>${K.map((k, i) => k.g === g ? `<li class="${!blank && !log.checks.includes(i) ? 'no' : ''}"><span class="box">${!blank && log.checks.includes(i) ? '✓' : ''}</span><span>${esc(k.t)}</span></li>` : '').join('')}</ul></div>`).join('')}</div></section>
      <section class="cs"><div class="lbl">${dt('Σημειώσεις / προτάσεις', 'Notes / recommendations')}</div>${blank ? '<div class="lines"></div>' : `<p style="white-space:pre-line">${esc(log.notes) || '—'}</p>`}</section>
      <div class="terms" style="padding-top:6mm"><div class="sign"><div>${dt('Ο τεχνικός', 'Technician')}</div><div>${dt('Ο πελάτης · υπογραφή', 'Client · signature')}</div></div></div>
    </main></div></div>`;
  $('#bk').onclick = () => go('doc', d.id);
  if ($('#b-ved')) $('#b-ved').onclick = () => visitDialog(d, log);
  $('#b-pdf').onclick = () => doPrint(false, `${dt('Δελτίο', 'Visit')}_${(d.no || '').replace(/\//g, '-')}_${v?.n || ''}_${slug(d.cl.name)}`);
  afterFonts(() => { fitLogo(); fitPages(); });
}

function viewContract(d) {
  cur = d; normContract(d); useDocLang(d);
  if (!d.file && d.clientId) persistDoc(d, true);
  if (!d.issued && !d.dateManual) d.date = todayISO();
  const S = DB.settings, c = DB.clients.find(x => x.id === d.clientId), E = EQ(), DE = DEQ();
  const iss = d.issued && d.iss ? d.iss : S.iss;
  const accts = (d.issued && d.accounts ? d.accounts : S.accounts).filter(a => a.bank || a.iban);
  const lock = d.issued;
  const checklist = d.issued && d.checksSnap ? d.checksSnap.map((t, i) => ({ id: 's' + i, g: t.g, t: t.t, on: true })) : S.checklist.map(k => ({ ...k, g: checkGroup(k, true), t: checkText(k, true) }));
  const groups = [...new Set(checklist.map(k => k.g))];
  const allM = d.issued ? (d.machinesSnap || []) : (c ? c.machines : []);
  const PR = pricingLabels();
  $('#view').innerHTML = `<div class="subbar so">
      <button class="btn ghost sm" type="button" id="bk">← ${tr('Συμβόλαια', 'Agreements')}</button>
      <div class="dt"><span class="chip contract">${ttl('contract')}</span><span id="st-no">${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</span>${d.issued ? contractStatus(d) : ''}${demoChip(d)}${relChips(d)}</div>
      ${langToggle(d, lock)}
      <span class="sp"></span>
      <div class="dd"><button class="btn" type="button" id="b-opt" aria-haspopup="menu">${tr('Επιλογές', 'Options')} ⋯</button>
        <div class="menu" id="m-opt" hidden>
          ${d.issued && !d.cancelled ? `<button type="button" id="o-ren">${tr('Ανανέωση (νέο συμβόλαιο από τη λήξη)', 'Renew (new agreement from the end date)')}</button>` : ''}
          <button type="button" id="o-dup">${tr('Αντίγραφο ως νέο πρόχειρο', 'Copy as a new draft')}</button>
          <button type="button" id="o-mail">${tr('Κείμενο για email', 'Email text')}</button>
          ${c ? `<button type="button" id="o-cl">${tr('Καρτέλα πελάτη', 'Client page')}</button>` : ''}
          ${d.issued ? '' : `<button type="button" id="o-draft">${tr('Πρόχειρη εκτύπωση (χωρίς αριθμό)', 'Draft print (no number)')}</button>`}
          ${d.issued ? `<hr><button type="button" id="o-hard" style="color:var(--bad)">${tr('Οριστική διαγραφή αρχείου…', 'Delete file permanently…')}</button>` : ''}</div></div>
      ${d.issued ? (d.cancelled ? '' : `<button class="btn danger" type="button" id="b-cancel">${tr('Ακύρωση', 'Cancel')}</button>`) : `<button class="btn danger" type="button" id="b-del">${tr('Διαγραφή', 'Delete')}</button><button class="btn" type="button" id="b-save">${tr('Αποθήκευση', 'Save')}</button>`}
      <button class="btn blue" type="button" id="b-pdf">${d.issued ? tr('PDF / Εκτύπωση', 'PDF / Print') : tr('Έκδοση & PDF', 'Issue & PDF')}</button>
    </div>
    <div class="wrap">${statusCard(d)}${visitsCard(d)}
    ${lock ? '' : `<div class="cset so card">
      <div class="cset-h"><b>${tr('Στοιχεία συμβολαίου', 'Agreement details')}</b><span class="mut">${tr(`Επιλέξτε επισκέψεις, διάρκεια και κόστος. Στο έγγραφο από κάτω τσεκάρετε ${E.as} και εργασίες.`, `Choose visits, duration and cost. On the document below, tick the ${E.as} and tasks.`)}</span></div>
      <div class="cgrid">
        <div class="f"><label for="k-start">${tr('Έναρξη', 'Start')}</label><input id="k-start" type="date" value="${esc(d.start)}"></div>
        <div class="f"><label for="k-months">${tr('Διάρκεια (μήνες)', 'Duration (months)')}</label><select id="k-months">${[6, 12, 24, 36].map(m => `<option ${+d.months === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="f"><label for="k-visits">${tr('Επισκέψεις / έτος', 'Visits / year')}</label><select id="k-visits">${[1, 2, 3, 4, 6, 12].map(v => `<option ${+d.visits === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="f"><label for="k-vat">${tr('ΦΠΑ %', 'VAT %')}</label><input id="k-vat" type="number" min="0" max="100" value="${esc(d.vat)}"></div>
        <div class="f wide2"><label>${tr('Ενδεικτικοί μήνες επισκέψεων', 'Planned visit months')}</label><div class="mchips" id="k-vm">${months3UI().map((m, i) => `<button type="button" data-m="${i}" class="${d.vmonths.includes(i) ? 'on' : ''}" aria-pressed="${d.vmonths.includes(i)}">${m}</button>`).join('')}</div></div>
        <div class="f wide2"><label for="k-mode">${tr('Τρόπος χρέωσης', 'Pricing')}</label><select id="k-mode">${Object.entries(PR).map(([k, l]) => `<option value="${k}" ${d.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="f"><label for="k-amount">${tr('Ποσό (€, χωρίς ΦΠΑ)', 'Amount (€, excl. VAT)')}</label><input id="k-amount" inputmode="decimal" value="${esc(decStr(d.amount))}"></div>
        ${PROF().hours ? `<div class="f"><label for="k-hours">${tr('Ώρες υποστήριξης / έτος', 'Support hours / year')}</label><input id="k-hours" inputmode="decimal" value="${esc(d.hours ? decStr(d.hours) : '')}" placeholder="0"></div>` : ''}
        <div class="f ${PROF().hours ? 'wide2' : 'wide3'}"><label for="k-pay">${tr('Πληρωμή', 'Payment')}</label><input id="k-pay" list="k-pays" value="${esc(dpayment(d.payment))}"><datalist id="k-pays">${(d.lang === 'en' ? PAYMENTS_EN : PAYMENTS).map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      </div><div class="cbreak mut" id="k-break"></div>
      ${allM.length ? '' : `<div class="warnbox" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${E.none} ${tr('Προσθέστε για να εκδοθεί το συμβόλαιο.', 'Add some to issue the agreement.')}<button class="btn sm blue" type="button" id="b-addm2">+ ${E.one}</button></div>`}</div>`}
    <div class="page contract" id="page" lang="${DL}">
    <aside>
      <div class="logo">${lockup(S.brand)}</div>
      <div class="blk"><div class="lbl">${dt('Ανάδοχος', 'Contractor')}</div>${issuerBlock(iss)}</div>
      <div class="blk"><div class="lbl">${dt('Πληρωμή', 'Payment')}</div>
        ${accts.map(a => `<div class="acct"><span class="k">${esc(a.bank)}</span><br><span class="iban">${esc(a.iban)}</span></div>`).join('')}
        <span class="k">${dt('Αιτιολογία:', 'Reference:')}</span> <span data-out="no"></span></div>
      <div class="totalbox"><div class="lbl">${dt('Κόστος με ΦΠΑ', 'Cost incl. VAT')}</div><div class="big num" data-out="tot"></div>
        <div class="split"><span>${dt('Ανά επίσκεψη', 'Per visit')}</span><b class="num" data-out="perVisit"></b></div>
        <div class="split"><span>${dt('Επισκέψεις', 'Visits')}</span><b class="num" data-out="visitsAll"></b></div></div>
      ${S.brand.credit ? creditHTML() : ''}
    </aside>
    <main>
      <div class="hA"><div><div class="eb eb-s">${dlabel('contract')}</div><div class="hA-no"><span data-out="no"></span>${d.issued ? '' : `<span class="prov" title="${tr('Ο αριθμός οριστικοποιείται με την έκδοση', 'The number is final when issued')}">${dt('ΠΡΟΣΩΡΙΝΟΣ', 'PROVISIONAL')}</span>`}</div></div>
        <div class="hA-r"><div><span class="t">${dt('ΗΜΕΡΟΜΗΝΙΑ', 'DATE')}</span>${lock ? '<span data-out="date"></span>' : `<label class="dp" title="${tr('Επιλογή ημερομηνίας', 'Pick a date')}"><span data-out="date"></span><input type="date" id="e-date" aria-label="${tr('Ημερομηνία', 'Date')}"></label>`}</div>
        <div><span class="t">${dt('ΙΣΧΥΣ', 'TERM')}</span><span data-out="period"></span></div></div></div>
      <div class="lbl">${dt('Πελάτης', 'Client')} ${lock ? '' : `<button class="linkbtn so ${c ? 'ok' : ''}" type="button" id="b-pick">${c ? tr('✓ Από το πελατολόγιο · αλλαγή', '✓ From the client book · change') : tr('Επιλογή από πελατολόγιο', 'Choose from client book')}</button>`}</div>
      <div class="to"><div class="nm2">${esc(d.cl.name) || `<span class="mut">— ${tr('επιλέξτε πελάτη', 'choose a client')} —</span>`}</div>
        <div class="ln">${d.cl.act ? `<span class="mut">${esc(d.cl.act)}</span>` : ''}</div>
        <div class="ln">${esc(d.cl.addr)}</div>
        <div class="ln">${[d.cl.afm && dt('ΑΦΜ ', 'VAT no. ') + esc(d.cl.afm), d.cl.doy && dt('ΔΟΥ ', 'Tax office ') + esc(d.cl.doy)].filter(Boolean).join(' · ')}</div>
        <div class="ln mut">${[esc(d.cl.tel), esc(d.cl.email)].filter(Boolean).join(' · ')}</div></div>
      <section class="cs"><div class="lbl">1 · ${dt('Εξοπλισμός που καλύπτεται', 'Equipment covered')} ${lock || !c ? '' : `<button class="linkbtn so" type="button" id="b-addm">+ ${tr('Νέα καταχώριση στον πελάτη', 'New entry for the client')}</button>`}</div>
        ${allM.length ? `<table class="mtab"><thead><tr><th style="width:7mm">#</th><th>${upper(DE.one)}</th><th style="width:30mm">${dt('ΘΕΣΗ', 'LOCATION')}</th><th style="width:30mm">${dt('ΣΕΙΡΙΑΚΟΣ', 'SERIAL NO.')}</th></tr></thead><tbody>
          ${allM.map(m => { const on = lock || d.machineIds.includes(m.id); return `<tr class="${on ? '' : 'off'}"><td class="n"><span class="nn"></span>${lock ? '' : `<input type="checkbox" class="so ck" data-mid="${m.id}" ${on ? 'checked' : ''} aria-label="${tr('Συμπερίληψη', 'Include')}">`}</td><td>${lock ? `<b>${esc(machineLabel(m, true) || DE.one)}</b>` : `<button class="medit" type="button" data-medit="${m.id}" title="${tr('Επεξεργασία', 'Edit')}"><b>${esc(machineLabel(m, true) || DE.one)}</b><span class="so"> ✎</span></button>`}</td><td>${esc(m.location) || '—'}</td><td>${esc(m.serial) || '—'}</td></tr>`; }).join('')}</tbody></table>`
          : `<p class="mut">${DE.none}</p>`}</section>
      <section class="cs"><div class="lbl">2 · ${dt('Πρόγραμμα συντήρησης', 'Maintenance schedule')}</div><p data-out="sched"></p></section>
      <section class="cs"><div class="lbl">3 · ${dt('Εργασίες σε κάθε επίσκεψη', 'Work on each visit')}</div><div class="kgroups">
        ${groups.map(g => `<div class="kg"><b>${esc(g)}</b><ul>${checklist.filter(k => k.g === g).map(k => { const on = lock || d.checks.includes(k.id); return `<li class="${on ? '' : 'off'}">${lock ? '' : `<input type="checkbox" class="so ck" data-kid="${k.id}" ${on ? 'checked' : ''} aria-label="${esc(k.t)}">`}<span>${esc(k.t)}</span></li>`; }).join('')}</ul></div>`).join('')}</div></section>
      <section class="cs"><div class="lbl">4 · ${dt('Κόστος', 'Cost')}</div>
        <div class="cost"><div><span data-out="calcline"></span><span class="num" data-out="net"></span></div><div><span>${dt('ΦΠΑ', 'VAT')} <span data-out="vatp"></span>%</span><span class="num" data-out="vatv"></span></div><div class="g"><span>${dt('Σύνολο', 'Total')}</span><span class="num" data-out="tot"></span></div></div>
        <p class="pay">${dt('Πληρωμή', 'Payment')}: <b data-out="payment"></b></p></section>
      <section class="cs"><div class="lbl">5 · ${dt('Δεν περιλαμβάνονται', 'Not included')}</div><ul class="excl" id="excl"></ul>${lock ? '' : `<button class="addrow so" id="b-excl" type="button">+ ${tr('Προσθήκη', 'Add')}</button>`}</section>
      <section class="cs terms"><div class="lbl">6 · ${dt('Όροι', 'Terms')}</div><ol id="terms">
        <li data-out="termPeriod"></li>
        <li>${dt('Οι επισκέψεις πραγματοποιούνται κατόπιν συνεννόησης, ενδεικτικά τους μήνες που αναφέρονται στο πρόγραμμα.', 'Visits are arranged by appointment, indicatively in the months given in the schedule.')}</li>
        <li>${dt('Μετά από κάθε επίσκεψη ο πελάτης ενημερώνεται για την κατάσταση του εξοπλισμού. Τυχόν επισκευές εκτελούνται μόνο με τη σύμφωνη γνώμη του και χρεώνονται χωριστά.', 'After each visit the client is informed of the condition of the equipment. Any repairs are carried out only with the client\'s consent and are charged separately.')}</li>
        <li data-out="termVat"></li>
        <li id="t-hours" data-out="termHours"></li>
        <li>${dt('Το συμβόλαιο μπορεί να ανανεωθεί με νέα συμφωνία πριν από τη λήξη του.', 'The agreement may be renewed by new agreement before it ends.')}</li></ol>
        ${lock ? '' : `<button class="addrow so" id="b-term" type="button">+ ${tr('Προσθήκη όρου', 'Add term')}</button>`}
        <div class="sign"><div>${dt('Ο ανάδοχος', 'The contractor')}</div><div>${dt('Ο πελάτης · υπογραφή / σφραγίδα', 'The client · signature / stamp')}</div></div></section>
    </main></div></div>`;
  setWM(d);
  $('#bk').onclick = () => go('contracts');
  bindLangToggle(d, () => viewContract(d));
  const mo = $('#m-opt'); $('#b-opt').onclick = e => { e.stopPropagation(); mo.hidden = !mo.hidden; };
  if ($('#o-ren')) $('#o-ren').onclick = () => { persistDoc(d, true); const nc = newContract(c, contractCopy(d, { start: addDays(contractEnd(d), 1), from: { id: d.id, type: 'contract', no: d.no } })); go('doc', nc.id); toast(tr('Δημιουργήθηκε πρόχειρο ανανέωσης', 'A renewal draft was created')); };
  $('#o-dup').onclick = () => { persistDoc(d, true); const nc = newContract(c, contractCopy(d)); go('doc', nc.id); toast(tr('Δημιουργήθηκε αντίγραφο ως νέο πρόχειρο', 'A copy was created as a new draft')); };
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
    d.excl.forEach((t, i) => { const li = document.createElement('li'); if (lock) li.textContent = t; else { const sp = document.createElement('span'); sp.contentEditable = 'true'; sp.dataset.ph = tr('περιγραφή', 'description'); sp.textContent = t;
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
    if ($('#k-hours')) $('#k-hours').oninput = e => { d.hours = num(e.target.value); touch(); };
    $('#k-pay').oninput = e => { const v = e.target.value, i = PAYMENTS_EN.indexOf(v); d.payment = i >= 0 ? PAYMENTS[i] : v; touch(); };
    $$('.ck[data-mid]').forEach(cb => cb.onchange = () => { const id = cb.dataset.mid; d.machineIds = cb.checked ? [...new Set([...d.machineIds, id])] : d.machineIds.filter(x => x !== id); cb.closest('tr').classList.toggle('off', !cb.checked); touch(); });
    $$('.ck[data-kid]').forEach(cb => cb.onchange = () => { const id = cb.dataset.kid; d.checks = cb.checked ? [...new Set([...d.checks, id])] : d.checks.filter(x => x !== id); cb.closest('li').classList.toggle('off', !cb.checked); touch(); });
    if ($('#b-pick')) $('#b-pick').onclick = async () => { const nc = await clientPicker(); if (!nc) return; d.clientId = nc.id; d.cl = pickCl(nc); d.machineIds = nc.machines.map(m => m.id); if (nc.demo) d.demo = true; if (nc.lang && nc.lang !== d.lang) switchDocLang(d, nc.lang, true); persistDoc(d, true); viewContract(d); };
    $$('[data-medit]').forEach(bt => bt.onclick = async () => { const m = c.machines.find(x => x.id === bt.dataset.medit); if (!m) return; const r = await machineForm(clone(m)); if (r && typeof r === 'object') { Object.assign(m, r); persistClient(c, true); persistDoc(d); viewContract(d); } });
    if ($('#b-addm2')) $('#b-addm2').onclick = () => $('#b-addm') ? $('#b-addm').click() : null;
    if ($('#b-addm')) $('#b-addm').onclick = async () => { const m = await machineForm({ id: uid(), log: [] }); if (m && typeof m === 'object') { c.machines.push(m); d.machineIds.push(m.id); persistClient(c, true); persistDoc(d, true); viewContract(d); } };
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
  useDocLang(d);
  const t = contractTotals(d), yrs = contractYears(d), E = DEQ();
  const vm = d.vmonths.map(i => DL === 'en' ? MONTHS_EN[i] : MONTHS[i]);
  const yr = yrs !== 1 ? ' × ' + dpct(yrs) + dt(' έτη', ' years') : '';
  const per = d.mode === 'total' ? dt('Συνολικό ποσό συμβολαίου', 'Total agreement amount') : d.mode === 'year' ? `${t.n} ${E.abbr} × ${deur(num(d.amount))} / ${dt('έτος', 'year')}${yr}` : `${t.n} ${E.abbr} × ${t.v} ${dt('επισκ./έτος', 'visits/year')} × ${deur(num(d.amount))}${yr}`;
  const and = dt(' και ', ' and '), list = vm.length > 1 ? vm.slice(0, -1).join(', ') + and + vm.slice(-1) : vm[0];
  const hrs = num(d.hours);
  const out = { no: d.issued ? d.no : nextNo('contract', isDemoDoc(d)), date: ddate(d.date), period: `${ddate(d.start)} – ${ddate(contractEnd(d))}`,
    sched: dt(`${t.v} ${t.v === 1 ? 'επίσκεψη' : 'επισκέψεις'} ανά έτος${vm.length ? ', ενδεικτικά ' + list : ''}. Διάρκεια ${d.months} μήνες, συνολικά ${t.visitsAll} ${t.visitsAll === 1 ? 'επίσκεψη' : 'επισκέψεις'} για ${plural(t.n, E.a, E.as)}.`,
      `${t.v} ${t.v === 1 ? 'visit' : 'visits'} per year${vm.length ? ', indicatively in ' + list : ''}. Term of ${d.months} months, ${t.visitsAll} ${t.visitsAll === 1 ? 'visit' : 'visits'} in total for ${plural(t.n, E.a, E.as)}.`),
    calcline: per, net: deur(t.net), vatv: deur(t.vatv), vatp: dpct(d.vat), tot: deur(t.tot), perVisit: deur(t.perVisit), visitsAll: String(t.visitsAll), payment: dpayment(d.payment) || '—',
    termPeriod: dt(`Το συμβόλαιο ισχύει από ${ddate(d.start)} έως ${ddate(contractEnd(d))}.`, `The agreement runs from ${ddate(d.start)} to ${ddate(contractEnd(d))}.`),
    termVat: dt(`Οι τιμές είναι χωρίς ΦΠΑ· ο ΦΠΑ ${dpct(d.vat)}% υπολογίζεται επί του ποσού.`, `Prices exclude VAT; VAT at ${dpct(d.vat)}% is calculated on the amount.`),
    termHours: hrs ? dt(`Περιλαμβάνονται έως ${dpct(hrs)} ώρες υποστήριξης ανά έτος (επισκέψεις και απομακρυσμένη υποστήριξη). Οι επιπλέον ώρες χρεώνονται χωριστά.`, `Up to ${dpct(hrs)} support hours per year are included (visits and remote support). Additional hours are charged separately.`) : '' };
  $$('[data-out]').forEach(el => el.textContent = out[el.dataset.out] ?? '');
  if ($('#t-hours')) $('#t-hours').hidden = !hrs;
  $$('.mtab tbody tr:not(.off) .nn').forEach((el, i) => el.textContent = String(i + 1).padStart(2, '0'));
  $$('.mtab tbody tr.off .nn').forEach(el => el.textContent = '');
  fitPages();
  if ($('#k-break')) $('#k-break').innerHTML = t.n ? `${tr('Υπολογισμός', 'Calculation')}: ${esc(per)} = <b>${eur(t.net)}</b> + ${tr('ΦΠΑ', 'VAT')} = <b>${eur(t.tot)}</b> · ${tr('ανά επίσκεψη', 'per visit')} ${eur(t.perVisit)}` : `<span style="color:var(--warn)">${tr(`Επιλέξτε τουλάχιστον ένα ${EQ().a} στο έγγραφο.`, `Tick at least one ${EQ().a} on the document.`)}</span>`;
}
async function issueContract(d) {
  const t = contractTotals(d), missing = !d.clientId ? tr('Επιλέξτε πελάτη από το πελατολόγιο.', 'Choose a client from the client book.') : !t.n ? tr(`Επιλέξτε τουλάχιστον ένα ${EQ().a}.`, `Tick at least one ${EQ().a}.`) : !d.checks.length ? tr('Επιλέξτε τουλάχιστον μία εργασία συντήρησης.', 'Tick at least one maintenance task.') : '';
  const demo = isDemoDoc(d), no = nextNo('contract', demo);
  const r = await modal({ title: tr('Έκδοση συμβολαίου', 'Issue agreement'), body: missing ? `<p>${missing}</p>` :
      `<p>${tr(`Το συμβόλαιο θα πάρει τον αριθμό <b style="color:var(--navy)">${no}</b> και θα αποθηκευτεί οριστικά στον φάκελο Συμβόλαια.`, `The agreement will get the number <b style="color:var(--navy)">${no}</b> and be saved in the folder Συμβόλαια.`)}</p>
       <ul style="margin:10px 0 0 18px"><li>${tr('Πελάτης', 'Client')}: <b>${esc(d.cl.name)}</b></li><li>${plural(t.n, EQ().a, EQ().as)} · ${d.visits} ${tr('επισκέψεις/έτος', 'visits/year')} · ${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</li><li>${tr('Σύνολο με ΦΠΑ', 'Total incl. VAT')}: <b>${eur(t.tot)}</b></li><li>${tr('Γλώσσα εγγράφου', 'Document language')}: <b>${LANGS[d.lang]}</b></li></ul>
       ${demo ? `<p class="warnbox">${tr('Δεδομένα επίδειξης: παίρνει αριθμό ΔΕΙΓΜΑ.', 'Demo data: it gets a DEMO number.')}</p>` : ''}
       <p class="mut" style="margin-top:12px;font-size:13px">${tr('Μετά την έκδοση τα στοιχεία κλειδώνουν. Για αλλαγές φτιάχνετε αντίγραφο ή ανανέωση.', 'After issuing, the details are locked. For changes, make a copy or a renewal.')}</p>`,
    actions: [{ label: tr('Πρόχειρη εκτύπωση', 'Draft print'), value: 'draft' }, '|', { label: tr('Άκυρο', 'Cancel'), value: null }, ...(missing && !t.n && d.clientId ? [{ label: '+ ' + EQ().one, value: 'addm', cls: 'blue' }] : []), ...(missing ? [] : [{ label: tr('Έκδοση & PDF', 'Issue & PDF'), value: 'issue', cls: 'blue' }])] });
  if (r === 'draft') return doPrint(true);
  if (r === 'addm') return $('#b-addm')?.click();
  if (r !== 'issue') return;
  issueContractNow(d, no);
  persistDoc(d, true); await chain;
  viewContract(d); toast(tr('Εκδόθηκε ', 'Issued ') + d.no);
  setTimeout(() => doPrint(false), 300);
}
function issueContractNow(d, no) {
  const c = DB.clients.find(x => x.id === d.clientId), saved = DL; useDocLang(d);
  d.no = no; d.issued = true; d.issuedAt = d.issuedAt || todayISO(); if (isDemoDoc(d)) d.demo = true;
  d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban));
  d.machinesSnap = clone(contractMachines({ ...d, issued: false }));
  d.checksSnap = DB.settings.checklist.filter(k => d.checks.includes(k.id)).map(k => ({ g: checkGroup(k, true), t: checkText(k, true) }));
  if (c) d.cl = pickCl(c);
  DL = saved;
}

/* ================================================================== settings */
function viewSettings() {
  const S = DB.settings, y = new Date().getFullYear(), P = PROF();
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Ρυθμίσεις', 'Settings')}</h2></div><div class="grid2"><div class="stack">
    <div class="card section"><h3>${tr('Στοιχεία επιχείρησης', 'Business details')}</h3><p class="note">${tr('Εμφανίζονται στην πλαϊνή στήλη κάθε εγγράφου. Τα εκδομένα έγγραφα κρατούν τα στοιχεία που είχαν τότε.', 'They appear on the sidebar of every document. Issued documents keep the details they had at the time.')}</p><div id="st-iss"></div>
      <div class="sub-h">${tr('Είδος επιχείρησης', 'Type of business')}</div><div id="st-biz"></div></div>
    <div class="card section" id="st-langcard"><h3>${tr('Γλώσσα & αγγλικά έγγραφα', 'Language & English documents')}</h3><div id="st-lang"></div>
      <div class="sub-h">${tr('Στοιχεία εκδότη στα αγγλικά (με λατινικούς χαρακτήρες)', 'Issuer details in English (Latin characters)')}</div>
      <div class="form">${[['name', tr('Επωνυμία', 'Business name'), 'e.g. Papadopoulos HVAC Services'], ['father', tr('Δεύτερη γραμμή', 'Second line'), ''], ['act', tr('Δραστηριότητα', 'Activity'), 'e.g. Air-conditioning & refrigeration'], ['addr', tr('Διεύθυνση', 'Address'), 'e.g. 12 Ermou St, 105 63 Athens, Greece']].map(([k, l, ph]) => `<div class="f ${k === 'addr' || k === 'name' ? 'wide' : ''}"><label for="se-${k}">${l}</label><input id="se-${k}" data-isse="${k}" value="${esc(S.iss.en[k])}" placeholder="${esc(ph)}"></div>`).join('')}
        <div class="f"><label for="se-bn">${tr('Όνομα στο λογότυπο (αγγλικά)', 'Name in the logo (English)')}</label><input id="se-bn" value="${esc(S.brand.nameEn)}" placeholder="${esc(S.brand.name)}"></div>
        <div class="f"><label for="se-bt">${tr('Υπότιτλος (αγγλικά)', 'Tagline (English)')}</label><input id="se-bt" value="${esc(S.brand.taglineEn)}" placeholder="${esc(S.brand.tagline)}"></div></div>
      <p class="note" style="margin-top:10px">${tr('Όσα μείνουν κενά τυπώνονται όπως στα ελληνικά. Οι εργασίες συντήρησης και οι εξαιρέσεις έχουν αγγλική στήλη στην κάρτα «Συμβόλαια συντήρησης», και τα είδη του καταλόγου στη στήλη EN.', 'Anything left empty is printed as in Greek. Maintenance tasks and exclusions have an English column in the “Maintenance agreements” card, and catalogue items in the EN column.')}</p></div>
    <div class="card section"><h3>${tr('Εμφάνιση εγγράφων', 'Document appearance')}</h3><div id="st-brand"></div><div class="sub-h">${tr('Προεπισκόπηση', 'Preview')}</div><div id="st-pv"></div></div>
    <div class="card section"><h3>${tr('Τραπεζικοί λογαριασμοί', 'Bank accounts')}</h3><div id="st-acc"></div></div>
    <div class="card section"><h3>${tr('Κατάλογος εργασιών & ειδών', 'Catalogue of work & items')} <span class="chip">${S.catalog.length}</span></h3><p class="note">${tr('Γραμμές που χρησιμοποιείτε συχνά. Στο έγγραφο: «+ Από κατάλογο». Η στήλη EN χρησιμοποιείται στα αγγλικά έγγραφα.', 'Lines you use often. In a document: “+ From catalogue”. The EN column is used on English documents.')}</p>
      <div class="kpis" style="margin-bottom:12px"><button class="btn sm" type="button" id="cat-pct">${tr('Αλλαγή τιμών %…', 'Change prices by %…')}</button><label class="btn sm" for="cat-imp">${tr('Εισαγωγή CSV…', 'Import CSV…')}</label><input type="file" id="cat-imp" accept=".csv,text/csv,.txt" hidden><button class="btn sm" type="button" id="cat-exp">⇩ ${tr('Εξαγωγή CSV', 'Export CSV')}</button></div><div id="st-cat"></div></div>
    <div class="card section"><h3>${tr('Πρότυπα εγγράφων', 'Document templates')} <span class="chip">${S.templates.length}</span></h3><p class="note">${tr('Έτοιμα πακέτα γραμμών (π.χ. «Εγκατάσταση 2 κλιματιστικών»). Δημιουργούνται από ένα έγγραφο: Επιλογές → «Αποθήκευση ως πρότυπο».', 'Ready-made sets of lines (e.g. “Install 2 A/C units”). Create one from a document: Options → “Save as a template”.')}</p><div id="st-tpl"></div></div>
  </div><div class="stack">
    <div class="card section"><h3>${tr('Αντίγραφα ασφαλείας', 'Backups')}</h3>
      <p class="note">${tr('Φάκελος δεδομένων', 'Data folder')}: <b style="color:var(--navy)">${esc(root?.name || '')}</b>. ${tr('Αυτόματο αντίγραφο γίνεται κάθε μέρα με αλλαγές', 'An automatic backup is made every day with changes')} (${tr('τελευταίο', 'last')}: ${S.lastBackup ? fmtDate(S.lastBackup) : '—'}).</p>
      <div class="kpis" style="margin-bottom:12px"><button class="btn blue" type="button" id="b-bk">${tr('Αντίγραφο τώρα', 'Back up now')}</button><button class="btn" type="button" id="b-dl">${tr('Λήψη αντιγράφου σε αρχείο', 'Download a backup file')}</button>
        <label class="btn" for="f-rs">${tr('Επαναφορά από αρχείο…', 'Restore from file…')}</label><input type="file" id="f-rs" accept=".json,application/json" hidden></div>
      <div id="bklist"><p class="note" style="margin:0">${tr('Φόρτωση αντιγράφων…', 'Loading backups…')}</p></div></div>
    <div class="card section"><h3>${tr('Δεδομένα επίδειξης', 'Demo data')}</h3>${hasDemo() ? `<p class="note">${tr(`Υπάρχουν φορτωμένα δεδομένα επίδειξης (${DB.clients.filter(c => c.demo).length} πελάτες, ${DB.docs.filter(isDemoDoc).length} έγγραφα).`, `Demo data is loaded (${DB.clients.filter(c => c.demo).length} clients, ${DB.docs.filter(isDemoDoc).length} documents).`)}</p><button class="btn danger" type="button" id="b-rmd">${tr('Αφαίρεση δεδομένων επίδειξης', 'Remove demo data')}</button>`
      : `<p class="note">${tr('Παραδείγματα πελατών, προσφορών, πληρωμών και συμβολαίων για να δείτε πώς δουλεύει. Σημαδεύονται «ΔΕΙΓΜΑ» και αφαιρούνται με ένα κουμπί.', 'Sample clients, quotations, payments and agreements to see how it works. They are marked DEMO and removed with one button.')}</p><button class="btn" type="button" id="b-ld">${tr('Φόρτωση δεδομένων επίδειξης', 'Load demo data')}</button>`}</div>
    <div class="card section"><h3>${tr('Εξαγωγή', 'Export')}</h3><div class="kpis"><button class="btn" type="button" id="x-docs">${tr('Έγγραφα', 'Documents')}</button><button class="btn" type="button" id="x-cl">${tr('Πελάτες', 'Clients')}</button><button class="btn" type="button" id="x-pay">${tr('Πληρωμές', 'Payments')}</button><button class="btn" type="button" id="x-debt">${tr('Οφειλές', 'Receivables')}</button>${P.register && P.register !== 'tickets' ? `<button class="btn" type="button" id="x-reg">${esc(pick2(P.regLabel))}</button>` : ''}<button class="btn" type="button" id="x-ics">${tr('Ημερολόγιο', 'Calendar')} .ics</button></div><p class="note" style="margin:10px 0 0">${tr('CSV για Excel. Το .ics ανοίγει σε Google Calendar, Outlook ή Apple Calendar με τις επισκέψεις και τους ελέγχους.', 'CSV for Excel. The .ics opens in Google Calendar, Outlook or Apple Calendar with the visits and checks.')}</p></div>
    <div class="card section"><h3>${tr('Φάκελος & εισαγωγή', 'Folder & import')}</h3>
      <div class="kpis"><button class="btn" type="button" id="b-cf">${tr('Αλλαγή φακέλου', 'Change folder')}</button>
      <label class="btn" for="f-imp">${tr('Εισαγωγή παλιού εγγράφου', 'Import an old document')}</label><input type="file" id="f-imp" accept=".json,application/json" hidden></div></div>
    <div class="card section"><h3>${tr('Προεπιλογές νέων εγγράφων', 'Defaults for new documents')}</h3><div class="form">
      <div class="f"><label for="d-vat">${tr('ΦΠΑ %', 'VAT %')}</label><input id="d-vat" data-df="vat" type="number" min="0" max="100" value="${esc(S.defaults.vat)}"></div>
      <div class="f"><label for="d-adv">${tr('Προκαταβολή %', 'Advance %')}</label><input id="d-adv" data-df="adv" type="number" min="0" max="100" value="${esc(S.defaults.adv)}"></div>
      <div class="f"><label for="d-days">${tr('Ισχύς (ημέρες)', 'Valid (days)')}</label><input id="d-days" data-df="days" type="number" min="1" value="${esc(S.defaults.days)}"></div>
      <div class="f"><label for="d-wm">${tr(`Εγγύηση (μήνες)`, `Warranty (months)`)}</label><input id="d-wm" data-df="warrantyMonths" type="number" min="0" value="${esc(S.defaults.warrantyMonths)}"></div>
      <div class="f"><label for="d-du">${tr('Μονάδα χρόνου ολοκλήρωσης', 'Completion time unit')}</label><select id="d-du" data-df="durU">${DUR_UNITS.map(u => `<option value="${u}" ${u === S.defaults.durU ? 'selected' : ''}>${durUnitUI(u)}</option>`).join('')}</select></div>
      ${P.register === 'combustion' ? `<div class="f"><label for="d-cm">${tr('Έλεγχος καύσης κάθε (μήνες)', 'Combustion check every (months)')}</label><input id="d-cm" type="number" min="1" value="${esc(S.regMonths.combustion)}"></div>` : ''}</div></div>
    ${P.register === 'tickets' ? `<div class="card section"><h3>${tr('Όροι δελτίου παραλαβής', 'Intake receipt terms')}</h3><p class="note">${tr('Τυπώνονται σε κάθε δελτίο παραλαβής συσκευής. Μία γραμμή ανά όρο.', 'Printed on every device intake receipt. One line per term.')}</p><div class="form"><div class="f wide"><label for="tt-el">Ελληνικά</label><textarea id="tt-el">${esc(S.ticketTerms.join('\n'))}</textarea></div><div class="f wide"><label for="tt-en">English</label><textarea id="tt-en">${esc(S.ticketTermsEn.join('\n'))}</textarea></div></div></div>` : ''}
    <div class="card section"><h3>${tr('Αρίθμηση', 'Numbering')} ${y}</h3><p class="note">${tr('Ο αριθμός δίνεται μόνο με την έκδοση και υπολογίζεται από τα εκδομένα έγγραφα του φακέλου. Αν έχετε εκδώσει έγγραφα εκτός εφαρμογής, ορίστε από ποιον αριθμό να συνεχίσει.', 'A number is given only on issue and is worked out from the issued documents in the folder. If you have issued documents outside the app, set the number to continue from.')}</p>
      <div class="form">${Object.entries(TYPES).filter(([t]) => t !== 'ticket' || P.register === 'tickets').map(([t]) => `<div class="f"><label for="n-${t}">${ttl(t)}: ${tr('συνέχεια μετά το', 'continue after')}</label><input id="n-${t}" data-nt="${t}" type="number" min="0" value="${esc(S.numbering[t]?.[y] || 0)}"><div class="mut" style="font-size:12.5px;margin-top:6px">${tr('Επόμενος', 'Next')}: <b id="nx-${t}" style="color:var(--navy)">${nextNo(t)}</b></div></div>`).join('')}</div></div>
    <div class="card section"><h3>${tr('Σχετικά', 'About')}</h3><p class="note" style="margin:0">${mtCredit()} <b>${esc(appName())}</b> · ${esc(appSub())} · ${tr('έκδοση', 'version')} ${APP.version}<br>${esc(ATTRIBUTION)}<br>${tr('Ελεύθερο λογισμικό με άδεια GNU GPL-3.0', 'Free software under the GNU GPL-3.0 licence')} · ${tr('κώδικας', 'source')}: <a href="https://${APP.repo}" target="_blank" rel="noopener">${esc(APP.repo)}</a><br>${tr('Παρέχεται χωρίς καμία εγγύηση. Δεν εκδίδει φορολογικά παραστατικά.', 'Provided without any warranty. It does not issue tax invoices.')}</p></div>
  </div></div>${contractSettingsCard()}</div>`;
  const pv = () => { $('#st-pv').innerHTML = previewHTML(S); afterFonts(fitLogo); const bm = $('.brandmini'); if (bm) bm.innerHTML = brandInline(S.brand, true); };
  const reshell = () => { const y0 = scrollY; shell(); go('settings'); scrollTo(0, y0); };
  issuerForm($('#st-iss'), S, () => { persistSettings(); pv(); });
  bizPicker($('#st-biz'), S, async () => {
    persistSettings();
    if (await confirmBox(tr('Είδος επιχείρησης', 'Type of business'), tr('Να αντικατασταθούν και οι προεπιλεγμένες εργασίες συντήρησης και εξαιρέσεις με αυτές του νέου είδους; (Τα υπάρχοντα συμβόλαια δεν αλλάζουν.)', 'Also replace the default maintenance tasks and exclusions with those of the new type? (Existing agreements do not change.)'), tr('Αντικατάσταση', 'Replace'), 'blue')) { S.checklist = checklistOf(S.biz); S.exclusions = exclusionsOf(S.biz, 'el'); S.exclusionsEn = exclusionsOf(S.biz, 'en'); persistSettings(); }
    reshell();
  });
  langPicker($('#st-lang'), S, k => { if (k === 'ui') reshell(); else pv(); });
  $$('[data-isse]').forEach(i => i.oninput = () => { S.iss.en[i.dataset.isse] = i.value; persistSettings(); pv(); });
  $('#se-bn').oninput = e => { S.brand.nameEn = e.target.value; persistSettings(); pv(); };
  $('#se-bt').oninput = e => { S.brand.taglineEn = e.target.value; persistSettings(); pv(); };
  brandEditor($('#st-brand'), S, () => { pv(); cacheBrand(); });
  accountsEditor($('#st-acc'), S, () => { persistSettings(); pv(); });
  catalogEditor($('#st-cat'), S);
  templatesEditor($('#st-tpl'), S);
  $('#cat-pct').onclick = () => catalogBulkPrice(() => catalogEditor($('#st-cat'), S));
  $('#cat-exp').onclick = exportCatalogCSV;
  $('#cat-imp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCatalogCSV(f, () => { viewSettings(); $('#view').insertAdjacentHTML('beforeend', appFoot()); }); };
  pv();
  bindContractSettings();
  $$('[data-df]').forEach(i => i.oninput = i.onchange = () => { S.defaults[i.dataset.df] = i.tagName === 'SELECT' ? i.value : num(i.value); persistSettings(); });
  if ($('#d-cm')) $('#d-cm').oninput = e => { S.regMonths.combustion = Math.max(1, parseInt(e.target.value) || 12); persistSettings(); };
  if ($('#tt-el')) { $('#tt-el').oninput = e => { S.ticketTerms = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); persistSettings(); }; $('#tt-en').oninput = e => { S.ticketTermsEn = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); persistSettings(); }; }
  $$('[data-nt]').forEach(i => i.oninput = () => { const t = i.dataset.nt; S.numbering[t] = S.numbering[t] || {}; S.numbering[t][y] = Math.max(0, parseInt(i.value) || 0); persistSettings(); $('#nx-' + t).textContent = nextNo(t); });
  $('#b-bk').onclick = async () => { await flushAll(); await q(() => backupIfNeeded(true)); toast(tr('Δημιουργήθηκε αντίγραφο στον φάκελο Αντίγραφα', 'A backup was created in the Αντίγραφα folder')); drawBackups(); };
  $('#b-dl').onclick = async () => { await flushAll(); download(`${slug(S.brand.name || 'Έγγραφα') || 'Έγγραφα'}_αντίγραφο_${todayISO()}.json`, JSON.stringify(makeBundle(), null, 2), 'application/json'); toast(tr('Το αντίγραφο αποθηκεύτηκε στις Λήψεις', 'The backup was saved to Downloads')); };
  $('#f-rs').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { let b; try { b = JSON.parse(r.result); } catch (err) { b = null; } e.target.value = ''; restoreFlow(b, f.name); }; r.readAsText(f); };
  const drawBackups = async () => {
    const dh = await sub(DIRS.backup), list = [];
    for await (const [n, h] of dh.entries()) if (h.kind === 'file' && n.endsWith('.json')) list.push(n);
    list.sort().reverse();
    $('#bklist').innerHTML = list.length ? `<div class="tablewrap"><table class="list"><tbody>${list.slice(0, 12).map(n => `<tr><td>${esc(n.replace('.json', ''))}</td><td class="r"><button class="btn sm" type="button" data-rs="${esc(n)}">${tr('Επαναφορά', 'Restore')}</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="note" style="margin:0">${tr('Δεν υπάρχουν ακόμα αντίγραφα.', 'No backups yet.')}</p>`;
    $$('[data-rs]').forEach(bt => bt.onclick = async () => { let b = null; try { b = JSON.parse(await (await (await dh.getFileHandle(bt.dataset.rs)).getFile()).text()); } catch (err) { } restoreFlow(b, bt.dataset.rs); });
  };
  drawBackups();
  if ($('#b-ld')) $('#b-ld').onclick = loadDemo;
  if ($('#b-rmd')) $('#b-rmd').onclick = removeDemo;
  $('#x-docs').onclick = () => exportDocsCSV(); $('#x-cl').onclick = exportClientsCSV; $('#x-pay').onclick = exportPaymentsCSV; $('#x-debt').onclick = exportDebtsCSV; $('#x-ics').onclick = () => exportICS();
  if ($('#x-reg')) $('#x-reg').onclick = exportRegisterCSV;
  $('#b-cf').onclick = pickFolder;
  $('#f-imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const o = JSON.parse(r.result); if (!o.items || !o.cl) throw 0; const d = newDoc(o.type === 'offer' ? 'offer' : 'proforma', { cl: o.cl, items: o.items, extra: o.extra, vat: o.vat, adv: o.adv, days: o.days, dur: o.dur, durU: o.durU, lang: o.lang });
      toast(tr('Εισήχθη ως πρόχειρο', 'Imported as a draft')); go('doc', d.id); } catch (err) { toast(tr('Το αρχείο δεν είναι έγγραφο της εφαρμογής', 'This file is not a document of the app')); } e.target.value = ''; };
    r.readAsText(f);
  };
}
function catalogEditor(el, S) {
  const draw = () => {
    el.innerHTML = (S.catalog.length ? `<div class="cat-h"><span>${tr('Περιγραφή', 'Description')}</span><span>EN</span><span>${tr('Μονάδα', 'Unit')}</span><span>${tr('Τιμή €', 'Price €')}</span><span>${tr('ΦΠΑ %', 'VAT %')}</span><span></span></div>` : '')
      + S.catalog.map((x, i) => `<div class="cat-r"><input class="inp" data-ci="${i}" data-cf="t" value="${esc(x.t)}" aria-label="${tr('Περιγραφή', 'Description')}"><input class="inp" data-ci="${i}" data-cf="te" value="${esc(x.te || '')}" placeholder="English" aria-label="${tr('Περιγραφή στα αγγλικά', 'Description in English')}"><input class="inp" data-ci="${i}" data-cf="u" value="${esc(x.u)}" aria-label="${tr('Μονάδα', 'Unit')}"><input class="inp" data-ci="${i}" data-cf="p" inputmode="decimal" value="${esc(decStr(x.p))}" aria-label="${tr('Τιμή', 'Price')}"><input class="inp" data-ci="${i}" data-cf="vat" inputmode="numeric" value="${esc(x.vat ?? '')}" placeholder="—" aria-label="${tr('ΦΠΑ', 'VAT')}"><button class="btn sm danger" type="button" data-cdel="${i}" aria-label="${tr('Αφαίρεση', 'Remove')}">×</button></div>`).join('')
      + `<button class="btn sm" type="button" id="b-cadd" style="margin-top:8px">+ ${tr('Είδος', 'Item')}</button>`;
    $$('[data-ci]', el).forEach(i => i.oninput = () => { const x = S.catalog[+i.dataset.ci], f = i.dataset.cf; x[f] = f === 'p' ? num(i.value) : f === 'vat' ? (i.value.trim() === '' ? '' : clampPct(i.value)) : i.value; persistSettings(); });
    $$('[data-cdel]', el).forEach(b => b.onclick = () => { S.catalog.splice(+b.dataset.cdel, 1); persistSettings(); draw(); });
    $('#b-cadd', el).onclick = () => { S.catalog.push({ id: uid(), t: '', s: '', te: '', se: '', u: 'τεμ.', p: 0, vat: '' }); draw(); $$('[data-cf=t]', el).pop().focus(); };
  };
  draw();
}
function contractSettingsCard() {
  const S = DB.settings, groups = [...new Set(S.checklist.map(k => k.g))];
  return `<div class="card section" style="margin-top:16px"><h3>${tr('Συμβόλαια συντήρησης', 'Maintenance agreements')}</h3>
    <p class="note">${tr('Οι εργασίες με τσεκ μπαίνουν προεπιλεγμένες σε κάθε νέο συμβόλαιο. Σε κάθε συμβόλαιο μπορείτε να τις αλλάξετε. Η δεύτερη στήλη είναι το κείμενο στα αγγλικά έγγραφα.', 'Ticked tasks are preselected in every new agreement and can be changed per agreement. The second column is the text on English documents.')}</p>
    <div class="form" style="margin-bottom:16px">
      <div class="f"><label for="cd-visits">${tr('Επισκέψεις / έτος', 'Visits / year')}</label><select id="cd-visits" data-cd="visits">${[1, 2, 3, 4, 6, 12].map(v => `<option ${+S.contract.visits === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-months">${tr('Διάρκεια (μήνες)', 'Duration (months)')}</label><select id="cd-months" data-cd="months">${[6, 12, 24, 36].map(v => `<option ${+S.contract.months === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-mode">${tr('Τρόπος χρέωσης', 'Pricing')}</label><select id="cd-mode" data-cd="mode">${Object.entries(pricingLabels()).map(([k, l]) => `<option value="${k}" ${S.contract.mode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="f"><label for="cd-amount">${tr('Ποσό (€, χωρίς ΦΠΑ)', 'Amount (€, excl. VAT)')}</label><input id="cd-amount" data-cd="amount" inputmode="decimal" value="${esc(decStr(S.contract.amount))}"></div>
      ${PROF().hours ? `<div class="f"><label for="cd-hours">${tr('Ώρες υποστήριξης / έτος', 'Support hours / year')}</label><input id="cd-hours" data-cd="hours" inputmode="decimal" value="${esc(S.contract.hours ? decStr(S.contract.hours) : '')}" placeholder="0"></div>` : ''}
      <div class="f wide"><label for="cd-pay">${tr('Πληρωμή', 'Payment')}</label><input id="cd-pay" data-cd="payment" list="cd-pays" value="${esc(S.contract.payment)}"><datalist id="cd-pays">${PAYMENTS.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div></div>
    <div class="kset">${groups.map(g => { const g0 = S.checklist.find(k => k.g === g); return `<div class="kset-g"><div class="kset-h"><b>${esc(g)}</b><input class="inp gen" data-kge="${esc(g)}" value="${esc(g0?.ge || '')}" placeholder="${tr('Κατηγορία στα αγγλικά', 'Group in English')}"><button class="btn sm ghost" type="button" data-addk="${esc(g)}">+ ${tr('εργασία', 'task')}</button></div>
      ${S.checklist.filter(k => k.g === g).map(k => `<div class="kset-r"><input type="checkbox" data-kon="${k.id}" ${k.on ? 'checked' : ''} aria-label="${tr('Προεπιλογή', 'Default')}"><input class="inp" data-kt="${k.id}" value="${esc(k.t)}"><input class="inp en" data-kte="${k.id}" value="${esc(k.te || '')}" placeholder="English"><button class="btn sm danger" type="button" data-kdel="${k.id}" aria-label="${tr('Αφαίρεση', 'Remove')}">×</button></div>`).join('')}</div>`; }).join('')}
      <div class="kset-r" style="margin-top:6px"><input class="inp" id="newg" placeholder="${tr('Νέα κατηγορία', 'New group')}"><button class="btn sm" type="button" id="b-newg">+ ${tr('Κατηγορία', 'Group')}</button></div></div>
    <h3 style="margin-top:18px">${tr('Δεν περιλαμβάνονται (προεπιλογή)', 'Not included (default)')}</h3>
    <div class="grid2x"><div><div class="sub-h" style="margin-top:0">Ελληνικά</div><div id="exs">${S.exclusions.map((t, i) => `<div class="kset-r"><input class="inp" data-ex="${i}" value="${esc(t)}"><button class="btn sm danger" type="button" data-exdel="${i}" aria-label="${tr('Αφαίρεση', 'Remove')}">×</button></div>`).join('')}</div>
    <button class="btn sm" type="button" id="b-addex" style="margin-top:8px">+ ${tr('Εξαίρεση', 'Exclusion')}</button></div>
    <div><div class="sub-h" style="margin-top:0">English</div><div id="exse">${S.exclusionsEn.map((t, i) => `<div class="kset-r"><input class="inp" data-exe="${i}" value="${esc(t)}"><button class="btn sm danger" type="button" data-exedel="${i}" aria-label="${tr('Αφαίρεση', 'Remove')}">×</button></div>`).join('')}</div>
    <button class="btn sm" type="button" id="b-addexe" style="margin-top:8px">+ ${tr('Εξαίρεση', 'Exclusion')}</button></div></div></div>`;
}
function bindContractSettings() {
  const S = DB.settings, redraw = () => { const y = scrollY; viewSettings(); $('#view').insertAdjacentHTML('beforeend', appFoot()); scrollTo(0, y); };
  $$('[data-cd]').forEach(i => i.oninput = i.onchange = () => { const k = i.dataset.cd; S.contract[k] = ['visits', 'months'].includes(k) ? +i.value : k === 'amount' || k === 'hours' ? num(i.value) : i.value; persistSettings(); });
  $$('[data-kon]').forEach(i => i.onchange = () => { S.checklist.find(k => k.id === i.dataset.kon).on = i.checked; persistSettings(); });
  $$('[data-kt]').forEach(i => i.oninput = () => { S.checklist.find(k => k.id === i.dataset.kt).t = i.value; persistSettings(); });
  $$('[data-kte]').forEach(i => i.oninput = () => { S.checklist.find(k => k.id === i.dataset.kte).te = i.value; persistSettings(); });
  $$('[data-kge]').forEach(i => i.oninput = () => { S.checklist.filter(k => k.g === i.dataset.kge).forEach(k => k.ge = i.value); persistSettings(); });
  $$('[data-kdel]').forEach(b => b.onclick = () => { S.checklist = S.checklist.filter(k => k.id !== b.dataset.kdel); persistSettings(); redraw(); });
  $$('[data-addk]').forEach(b => b.onclick = () => { const g0 = S.checklist.find(x => x.g === b.dataset.addk); const k = { id: 'k' + uid(), g: b.dataset.addk, ge: g0?.ge || '', t: '', te: '', on: true }; const last = S.checklist.map(x => x.g).lastIndexOf(k.g); S.checklist.splice(last + 1, 0, k); persistSettings(); redraw(); $(`[data-kt="${k.id}"]`).focus(); });
  $('#b-newg').onclick = () => { const g = $('#newg').value.trim(); if (!g) return; const k = { id: 'k' + uid(), g, ge: '', t: '', te: '', on: true }; S.checklist.push(k); persistSettings(); redraw(); $(`[data-kt="${k.id}"]`).focus(); };
  $$('[data-ex]').forEach(i => i.oninput = () => { S.exclusions[+i.dataset.ex] = i.value; persistSettings(); });
  $$('[data-exdel]').forEach(b => b.onclick = () => { S.exclusions.splice(+b.dataset.exdel, 1); persistSettings(); redraw(); });
  $('#b-addex').onclick = () => { S.exclusions.push(''); persistSettings(); redraw(); $$('[data-ex]').pop().focus(); };
  $$('[data-exe]').forEach(i => i.oninput = () => { S.exclusionsEn[+i.dataset.exe] = i.value; persistSettings(); });
  $$('[data-exedel]').forEach(b => b.onclick = () => { S.exclusionsEn.splice(+b.dataset.exedel, 1); persistSettings(); redraw(); });
  $('#b-addexe').onclick = () => { S.exclusionsEn.push(''); persistSettings(); redraw(); $$('[data-exe]').pop().focus(); };
}

/* ================================================================== demo data (dates relative to today, removable) */
const mkAfm = s => { const a = String(s).padStart(8, '0').slice(0, 8); let t = 0; for (let i = 0; i < 8; i++) t += +a[i] * 2 ** (8 - i); return a + ((t % 11) % 10); };
/* demo content per trade: equipment of clients 0 and 1, and the lines used in documents ([el, en] texts) */
function demoSet(biz, ago) {
  const L = (t, s, u, p, q = 1, x = {}) => ({ t, s, u, p, q, ...x });
  const sets = {
    hvac: {
      M: [[{ brand: 'Daikin', kind: 'Τοίχου', btu: '12000', ref: 'R32', charge: 0.9, location: 'Σάλα' }, { brand: 'Daikin', kind: 'Τοίχου', btu: '12000', ref: 'R32', charge: 0.9, location: 'Σάλα πίσω' }, { brand: 'Mitsubishi Electric', kind: 'Κασέτα', btu: '24000', ref: 'R410A', charge: 3.2, location: 'Μπαρ', log: [{ id: uid(), date: ago(340), ms: { leak: 'ok' }, note: '', tech: '' }] }],
        [{ brand: 'LG', kind: 'Τοίχου', btu: '9000', ref: 'R32', charge: 0.65, location: 'Ιατρείο 1' }, { brand: 'LG', kind: 'Τοίχου', btu: '9000', ref: 'R32', charge: 0.65, location: 'Ιατρείο 2' }, { brand: 'Toshiba', kind: 'Ντουλάπα', btu: '48000', ref: 'R410A', charge: 4.5, location: 'Αναμονή', log: [{ id: uid(), date: ago(350), ms: { leak: 'ok' }, note: '', tech: '' }] }]],
      unit: (n, b) => L([`Κλιματιστικό τοίχου ${b} ${n.toLocaleString('el-GR')} BTU Inverter`, `${b} ${n.toLocaleString('en-IE')} BTU inverter wall-mounted air conditioner`], ['Προμήθεια μηχανήματος, ενεργειακή κλάση A++', 'Supply of unit, energy class A++'], 'τεμ.', n > 10000 ? 690 : 540),
      unitM: (b, n) => ({ on: true, auto: true, brand: b, kind: 'Τοίχου', btu: String(n), ref: 'R32', model: '' }),
      brands: ['Inventor', 'Mitsubishi Electric', 'LG', 'Daikin'],
      inst: L(['Εργασίες εγκατάστασης', 'Installation work'], ['Σωληνώσεις έως 3 μ., βάσεις, ηλεκτρολογική σύνδεση, κενό και δοκιμή', 'Piping up to 3 m, brackets, electrical connection, vacuum and test'], 'κατ’ αποκοπή', 220),
      serv: L(['Καθαρισμός και απολύμανση κλιματιστικού', 'A/C cleaning and disinfection'], ['', ''], 'τεμ.', 45, 3), extra: L(['Συμπλήρωση ψυκτικού υγρού R32', 'R32 refrigerant top-up'], ['', ''], 'κατ’ αποκοπή', 80),
      small: L(['Αντικατάσταση τηλεχειριστηρίου', 'Remote control replacement'], ['', ''], 'τεμ.', 35, 1, { disc: 10 }),
      ms: (i) => i === 2 ? { leak: 'ok', add: '', rec: '' } : { leak: '', add: '', rec: '' },
    },
    plumb: {
      M: [[{ brand: 'Buderus', kind: 'Λέβητας πετρελαίου', kw: 35, fuel: 'oil', location: 'Λεβητοστάσιο' }, { brand: 'Grundfos', kind: 'Κυκλοφορητής', location: 'Λεβητοστάσιο' }, { brand: 'Ariston', kind: 'Θερμοσίφωνας', fuel: 'el', location: 'Κουζίνα' }],
        [{ brand: 'Vaillant', kind: 'Λέβητας συμπύκνωσης', kw: 24, fuel: 'gas', location: 'Βοηθητικός χώρος', log: [{ id: uid(), date: ago(345), ms: { co: 18, co2: 9.1, o2: 4.2, tf: 68, eff: 97.5 }, note: '', tech: '' }] }]],
      unit: () => L(['Προμήθεια και τοποθέτηση θερμοσίφωνα 80 λίτρων', 'Supply and installation of an 80-litre water heater'], ['Με βάνα ασφαλείας και σύνδεση', 'With safety valve and connection'], 'τεμ.', 420),
      unitM: () => ({ on: true, brand: 'Ariston', kind: 'Θερμοσίφωνας', fuel: 'el', model: '' }), brands: ['', '', '', ''],
      inst: L(['Εργασία υδραυλικού', 'Plumber labour'], ['Ανά ώρα, με μετακίνηση', 'Per hour, travel included'], 'ώρες', 35, 3),
      serv: L(['Ετήσιος καθαρισμός και ρύθμιση λέβητα-καυστήρα', 'Annual boiler and burner service'], ['Με μέτρηση καυσαερίων και φύλλο ελέγχου', 'With flue-gas analysis and check sheet'], 'κατ’ αποκοπή', 90),
      extra: L(['Μπεκ και φίλτρο καυστήρα', 'Burner nozzle and filter'], ['', ''], 'σετ', 28), small: L(['Αντικατάσταση βαλβίδας ασφαλείας', 'Safety valve replacement'], ['', ''], 'τεμ.', 30, 1, { disc: 10 }),
      ms: (i) => i === 0 ? { co: 42, co2: 12.4, o2: 4.1, tf: 185, eff: 92.6, smoke: 1 } : {},
    },
    elec: {
      M: [[{ brand: 'Hager', kind: 'Γενικός πίνακας', amps: 63, phase: '3', location: 'Είσοδος', ude: ago(900), nextInsp: addDays(todayISO(), 20) }, { brand: 'Schneider Electric', kind: 'Υποπίνακας', amps: 40, phase: '3', location: 'Κουζίνα' }],
        [{ brand: '', kind: 'Ηλεκτρική εγκατάσταση επαγγελματικού χώρου', amps: 40, phase: '1', location: 'Ιατρείο', ude: ago(2000), nextInsp: addDays(todayISO(), 200) }, { brand: 'Legrand', kind: 'Φωτισμός ασφαλείας', location: 'Διάδρομος' }]],
      unit: () => L(['Φορτιστής ηλεκτρικού οχήματος 7,4 kW', '7.4 kW EV charger'], ['Προμήθεια, τοποθέτηση και ρύθμιση', 'Supply, installation and set-up'], 'τεμ.', 780),
      unitM: () => ({ on: true, brand: 'Wallbox', kind: 'Φορτιστής ηλεκτρικού οχήματος', amps: 32, model: '' }), brands: ['', '', '', ''],
      inst: L(['Εργασία ηλεκτρολόγου', 'Electrician labour'], ['Ανά ώρα, με μετακίνηση', 'Per hour, travel included'], 'ώρες', 30, 4),
      serv: L(['Ετήσιος έλεγχος ηλεκτρικής εγκατάστασης', 'Annual electrical installation check'], ['Μετρήσεις γείωσης, μόνωσης και ρελέ διαρροής', 'Earth, insulation and RCD measurements'], 'κατ’ αποκοπή', 120),
      extra: L(['Ρελέ διαρροής 40A 30mA', 'RCD 40A 30mA'], ['', ''], 'τεμ.', 48), small: L(['Αντικατάσταση πρίζας σούκο', 'Socket outlet replacement'], ['', ''], 'τεμ.', 18, 2, { disc: 10 }),
      ms: (i) => i === 0 ? { earth: 4.2, rcdma: 24, rcdms: 28, ins: 250 } : {},
    },
    it: {
      M: [[{ brand: 'Dell', kind: 'Επιτραπέζιος υπολογιστής', os: 'Windows 11 Pro', host: 'TAMEIO-01', location: 'Ταμείο' }, { brand: 'Synology', kind: 'NAS', os: 'DSM 7.2', host: 'NAS', location: 'Γραφείο' }, { brand: 'MikroTik', kind: 'Router / firewall', os: 'RouterOS 7', location: 'Ράφι' }],
        [{ brand: 'HP', kind: 'Φορητός υπολογιστής', os: 'Windows 11 Pro', location: 'Ιατρείο' }, { brand: 'Brother', kind: 'Εκτυπωτής / πολυμηχάνημα', location: 'Γραμματεία' }]],
      unit: () => L(['Φορητός υπολογιστής 15,6" i5 16GB 512GB SSD', '15.6" laptop i5 16GB 512GB SSD'], ['Με εγκατάσταση και μεταφορά δεδομένων', 'With set-up and data transfer'], 'τεμ.', 780),
      unitM: () => ({ on: true, brand: 'Lenovo', kind: 'Φορητός υπολογιστής', os: 'Windows 11 Pro', model: 'ThinkPad E16' }), brands: ['', '', '', ''],
      inst: L(['Υπηρεσίες τεχνικού', 'Technician services'], ['Ανά ώρα', 'Per hour'], 'ώρες', 40, 3),
      serv: L(['Μηνιαία απομακρυσμένη υποστήριξη', 'Monthly remote support'], ['Παρακολούθηση, ενημερώσεις, αντίγραφα ασφαλείας', 'Monitoring, updates, backups'], 'μήνας', 60, 3),
      extra: L(['Δίσκος SSD 1TB', '1TB SSD drive'], ['', ''], 'τεμ.', 85), small: L(['Άδεια antivirus (1 έτος)', 'Antivirus licence (1 year)'], ['', ''], 'άδειες', 25, 3, { disc: 10 }),
      ms: (i) => i === 0 ? { upd: 'ok', bk: 'ok', disk: 'ok', av: 'ok' } : i === 1 ? { upd: 'warn', bk: 'ok', disk: 'warn', av: '' } : {},
    },
    general: {
      M: [[{ brand: 'Bosch', kind: 'Λέβητας αερίου', location: 'Λεβητοστάσιο' }, { brand: 'Grundfos', kind: 'Κυκλοφορητής', location: 'Λεβητοστάσιο' }], [{ brand: 'Siemens', kind: 'Ηλεκτρικός πίνακας', location: 'Είσοδος' }, { brand: '', kind: 'Γεννήτρια', location: 'Υπόγειο' }]],
      unit: () => L(['Προμήθεια και τοποθέτηση θερμοσίφωνα 80 λίτρων', 'Supply and installation of an 80-litre water heater'], ['Με βάνα ασφαλείας και σύνδεση', 'With safety valve and connection'], 'τεμ.', 420),
      unitM: () => ({ on: true, brand: '', kind: 'Θερμοσίφωνας', model: '' }), brands: ['', '', '', ''],
      inst: L(['Εργασία τεχνικού', 'Technician labour'], ['Ανά ώρα, με μετακίνηση', 'Per hour, travel included'], 'ώρες', 35, 3),
      serv: L(['Ετήσιος έλεγχος εγκατάστασης', 'Annual installation check'], ['Έλεγχος, καθαρισμός, μετρήσεις', 'Inspection, cleaning, measurements'], 'κατ’ αποκοπή', 90),
      extra: L(['Ανταλλακτικά', 'Spare parts'], ['', ''], 'κατ’ αποκοπή', 65), small: L(['Μικροϋλικά', 'Small materials'], ['', ''], 'κατ’ αποκοπή', 20, 1, { disc: 10 }),
      ms: () => ({}),
    },
  };
  return sets[biz] || sets.general;
}
async function loadDemo() {
  if (hasDemo()) return toast(tr('Τα δεδομένα επίδειξης είναι ήδη φορτωμένα', 'Demo data is already loaded'));
  const T = todayISO(), ago = n => addDays(T, -n), X = demoSet(DB.settings.biz, ago);
  const C = [
    { name: 'Καφέ Αρμονία ΟΕ', act: 'Καφετέρια', addr: 'Λεωφ. Βουλιαγμένης 210, 172 36 Δάφνη', afm: mkAfm(80123456), doy: 'Αγ. Δημητρίου', tel: '210 970 1122', email: 'info@armonia-demo.gr' },
    { name: 'Οδοντιατρείο Δρ. Μ. Νικολάου', act: 'Οδοντίατρος', addr: 'Ελ. Βενιζέλου 54, 163 45 Ηλιούπολη', afm: mkAfm(12345678), doy: 'Ηλιούπολης', tel: '210 994 3301', email: 'iatreio@demo.gr' },
    { name: 'Ελένη Παπαδάκη', act: '', addr: 'Ναξίου 12, 173 43 Άγιος Δημήτριος', afm: mkAfm(23456789), doy: 'Αγ. Δημητρίου', tel: '694 455 6677', email: 'eleni.p@demo.gr' },
    { name: 'Λογιστικό Γραφείο Σταθόπουλος ΙΚΕ', act: 'Λογιστικές υπηρεσίες', addr: 'Αγ. Σοφίας 8, 171 22 Νέα Σμύρνη', afm: mkAfm(80987654), doy: 'Νέας Σμύρνης', tel: '210 931 5500', email: 'office@stath-demo.gr' },
    { name: 'Aegean Blue Villas IKE', act: 'Holiday rentals', addr: 'Agios Prokopios, 843 00 Naxos', afm: mkAfm(80555123), doy: 'Νάξου', tel: '+30 22850 41234', email: 'manager@aegeanblue-demo.com', lang: 'en' },
  ].map(c => normClient({ ...c, demo: true, notes: '' }));
  C.forEach((c, i) => c.machines = (X.M[i] || []).map(m => ({ id: uid(), brand: '', kind: '', model: '', serial: '', location: '', installed: ago(400 + i * 60), warrantyEnd: addMonths(ago(400 + i * 60), 24), log: [], ...m })));
  DB.clients.push(...C);
  const line = (x, lang) => { const { t, s, ...r } = x; return { ...clone(r), t: t[lang === 'en' ? 1 : 0], s: s[lang === 'en' ? 1 : 0] }; };
  const mk = (type, c, items, o = {}) => { const lang = c.lang === 'en' ? 'en' : 'el'; const d = newDoc(type, { clientId: c.id, cl: pickCl(c), items: items.map(x => x.t && Array.isArray(x.t) ? line(x, lang) : clone(x)), demo: true, lang }); Object.assign(d, o); return d; };
  const issue = (d, daysAgo) => { d.date = ago(daysAgo); d.dateManual = true; d.no = nextNo(d.type, true); d.issued = true; d.issuedAt = d.date; d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban)); if (d.type === 'offer') d.status = 'sent'; return d; };
  const pay = (d, daysAgo, amt, note, m = 'Τραπεζική κατάθεση') => d.payments.push({ id: uid(), date: ago(daysAgo), amount: Math.round(amt * 100) / 100, method: m, note });
  // 1: accepted offer → paid proforma (equipment goes to the client)
  const o1 = issue(mk('offer', C[2], [{ ...X.unit(12000, X.brands[0]), q: 2, m: X.unitM(X.brands[0], 12000) }, X.inst]), 48);
  o1.status = 'accepted'; o1.statusAt = ago(44);
  const p1 = issue(mk('proforma', C[2], o1.items, { from: { id: o1.id, type: 'offer', no: o1.no } }), 44);
  pay(p1, 44, totals(p1).advv, tr('Προκαταβολή', 'Advance')); pay(p1, 30, totals(p1).tot - totals(p1).advv, tr('Εξόφληση', 'Final payment'));
  pushMachines(p1, C[2]); C[2].machines.forEach(m => { if (m.source?.docId === p1.id) m.source.docNo = p1.no; });
  // 2: pending offer (with an optional line), 3: expired offer, 4: rejected offer
  issue(mk('offer', C[3], [{ ...X.unit(18000, X.brands[1]), q: 3 }, { ...X.inst, q: 3 }, { ...X.serv, q: 3, opt: true }], { adv: 50 }), 4);
  issue(mk('offer', C[0], [X.serv, X.extra, X.small], { days: 15 }), 40);
  const o4 = issue(mk('offer', C[1], [{ ...X.unit(9000, X.brands[2]), q: 1 }, X.inst]), 25); o4.status = 'rejected'; o4.statusAt = ago(20);
  // 5: proforma with only the advance paid, older than 30 days
  const p5 = issue(mk('proforma', C[0], [{ ...X.serv, q: 3 }, X.extra, { t: ['Υλικά', 'Materials'], s: ['', ''], q: 1, u: 'κατ’ αποκοπή', p: 48, vat: 24 }]), 38);
  pay(p5, 37, totals(p5).advv, tr('Προκαταβολή', 'Advance'), 'Μετρητά');
  // 5b: an older unpaid proforma, to show ageing in receivables
  issue(mk('proforma', C[3], [X.serv, X.extra], { adv: 0 }), 75);
  // 6: a draft proforma, 7: an English quotation for a foreign client
  mk('proforma', C[1], [{ ...X.serv, q: 3 }]);
  issue(mk('offer', C[4], [{ ...X.unit(12000, X.brands[3]), q: 4 }, { ...X.inst, q: 4 }, X.serv], { adv: 40, days: 30 }), 6);
  // 8–9: maintenance contracts, one mid-year with a visit done, one about to expire
  const k1 = newContract(C[0]); Object.assign(k1, { start: addMonths(T, -7).slice(0, 8) + '01', visits: 2, vmonths: [((new Date().getMonth() + 5) % 12), new Date().getMonth()].sort((a, b) => a - b), amount: 40, demo: true, hours: PROF().hours ? 12 : 0 });
  issueContractNow(k1, nextNo('contract', true)); k1.date = k1.start; k1.issuedAt = k1.start;
  const pv = plannedVisits(k1)[0];
  k1.visitLog.push({ id: uid(), date: pv ? pv.ym + '-12' : ago(150), tech: DB.settings.iss.name, hours: PROF().hours ? 3 : '', machines: k1.machinesSnap.map((m, i) => ({ id: m.id, st: i === 2 ? 'note' : 'ok', note: i === 2 ? tr('Φθορά, προτείνεται αντικατάσταση', 'Wear, replacement advised') : '', ms: X.ms(i) })), checks: k1.checksSnap.map((_, i) => i), notes: tr('Όλα σε καλή λειτουργία. Προτείνεται αντικατάσταση στη μονάδα 3.', 'Everything working well. A replacement is advised on item 3.') });
  pay(k1, 200, totals(k1).tot, tr('Εφάπαξ', 'In full'));
  const k2 = newContract(C[1]); Object.assign(k2, { start: addDays(addMonths(T, -12), 35), visits: 1, vmonths: [3], mode: 'year', amount: 55, demo: true });
  issueContractNow(k2, nextNo('contract', true)); k2.date = k2.start; k2.issuedAt = k2.start;
  pay(k2, daysBetween(k2.start, T) - 3, totals(k2).tot, tr('Εφάπαξ', 'In full'));
  k2.visitLog.push({ id: uid(), date: (plannedVisits(k2)[0]?.ym || ymOf(addDays(k2.start, 40))) + '-10', tech: DB.settings.iss.name, machines: k2.machinesSnap.map(m => ({ id: m.id, st: 'ok', note: '', ms: {} })), checks: k2.checksSnap.map((_, i) => i), notes: '' });
  // 10–11: repairs (IT profile)
  if (PROF().register === 'tickets') {
    const t1 = newTicket(C[3], { dev: { kind: 'Φορητός υπολογιστής', brand: 'Asus', model: 'VivoBook 15', serial: 'N7NRKD012345' }, fault: tr('Δεν ανοίγει, η μπαταρία δεν φορτίζει', 'Does not power on, battery not charging'), acc: tr('Τροφοδοτικό', 'Charger'), cond: tr('Γρατζουνιές στο καπάκι', 'Scratches on the lid'), est: 90, demo: true });
    issueTicketNow(t1); t1.date = t1.issuedAt = ago(5); t1.status = 'work';
    const t2 = newTicket(C[2], { dev: { kind: 'Επιτραπέζιος υπολογιστής', brand: 'HP', model: 'ProDesk 400', serial: '' }, fault: tr('Πολύ αργός, θέλει καθάρισμα και SSD', 'Very slow, needs cleaning and an SSD'), acc: '', cond: '', est: 120, cost: 135, work: tr('Αντικατάσταση δίσκου με SSD 1TB, μεταφορά δεδομένων, καθαρισμός', 'Replaced the disk with a 1TB SSD, data transfer, cleaning'), demo: true });
    issueTicketNow(t2); t2.date = t2.issuedAt = ago(9); t2.status = 'ready'; t2.readyAt = ago(1);
  }
  // catalogue examples (only if the catalogue is empty)
  if (!DB.settings.catalog.length) { DB.settings.catalog.push(...[X.serv, X.extra, X.inst].map(x => ({ id: uid(), t: x.t[0], s: x.s[0], te: x.t[1], se: x.s[1], u: x.u, p: x.p, vat: '', demo: true }))); persistSettings(); }
  for (const c of C) q(() => saveClient(c));
  for (const d of DB.docs.filter(x => x.demo)) q(() => saveDoc(d));
  await chain;
  shell(); go('home'); toast(tr('Φορτώθηκαν δεδομένα επίδειξης · αφαιρούνται από την μπάρα πάνω', 'Demo data loaded · remove it from the bar at the top'));
}
async function removeDemo() {
  const docs = DB.docs.filter(isDemoDoc), cl = DB.clients.filter(c => c.demo);
  if (!(await confirmBox(tr('Αφαίρεση δεδομένων επίδειξης', 'Remove demo data'), tr(`Θα διαγραφούν ${cl.length} πελάτες επίδειξης και ${docs.length} έγγραφα επίδειξης. Τα δικά σας δεδομένα δεν αγγίζονται.`, `${cl.length} demo clients and ${docs.length} demo documents will be deleted. Your own data is not touched.`), tr('Αφαίρεση', 'Remove')))) return;
  await flushAll();
  for (const d of docs) { cancelLater('d' + d.id); if (d.file) await q(() => delFile(d.dir, d.file)); }
  for (const c of cl) { cancelLater('c' + c.id); if (c.file) await q(() => delFile(DIRS.clients, c.file)); }
  DB.docs = DB.docs.filter(d => !docs.includes(d)); DB.clients = DB.clients.filter(c => !c.demo);
  const before = DB.settings.catalog.length; DB.settings.catalog = DB.settings.catalog.filter(x => !x.demo); if (before !== DB.settings.catalog.length) persistSettings();
  await chain; cur = null; view = { name: 'home' };
  go('home'); toast(tr('Τα δεδομένα επίδειξης αφαιρέθηκαν', 'Demo data was removed'));
}
