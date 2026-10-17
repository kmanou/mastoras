/* ================================================================== home */
function homeData() {
  const t = todayISO(), y = t.slice(0, 4), ym = t.slice(0, 7);
  const live = DB.docs.filter(d => d.issued && !d.cancelled);
  const unpaid = live.filter(owing);
  const waiting = live.filter(d => d.type === 'offer' && docState(d).k === 'sent');
  const expired = live.filter(d => d.type === 'offer' && docState(d).k === 'expired' && daysBetween(validUntil(d), t) <= 21);
  const expiring = live.filter(d => d.type === 'contract' && contractState(d).k === 'soon');
  const visits = visitPlan().filter(v => !v.done && v.ym <= ym);
  const received = DB.docs.filter(d => !d.cancelled).flatMap(d => d.payments || []).filter(p => String(p.date).startsWith(y)).reduce((a, p) => a + num(p.amount), 0);
  const tickets = live.filter(d => d.type === 'ticket' && ['in', 'work', 'ready'].includes(d.status));
  return { unpaid, waiting, expired, expiring, visits, received, y, reg: regDue(), tickets };
}
function viewHome() {
  const B = DB.settings.brand, H = homeData(), sum = (a, f) => a.reduce((s, d) => s + f(d), 0), T = todayISO(), ym = T.slice(0, 7);
  const att = [
    ...H.visits.map(v => ({ k: v.ym < ym ? 'bad' : 'warn', l: v.ym < ym ? tr('Καθυστερεί', 'Overdue') : tr('Αυτόν τον μήνα', 'This month'), t: `${tr('Επίσκεψη', 'Visit')} ${v.n}/${v.of} · ${v.doc.cl.name}`, s: `${ymLabel(v.ym)} · ${v.doc.no}`, go: ['doc', v.doc.id] })),
    ...H.reg.map(r => ({ k: r.next < T ? 'bad' : 'warn', l: r.next < T ? tr('Εκπρόθεσμος', 'Overdue') : tr('Έως ', 'By ') + fmtDate(r.next), t: `${regWhat()} · ${r.c.name}`, s: machineLabel(r.m) || EQ().one, go: ['reg'] })),
    ...H.waiting.filter(d => daysBetween(T, validUntil(d)) <= 7).map(d => ({ k: 'warn', l: tr('Λήγει σε ', 'Expires in ') + plural(Math.max(0, daysBetween(T, validUntil(d))), tr('ημέρα', 'day'), tr('ημέρες', 'days')), t: `${ttl('offer')} ${d.no} · ${d.cl.name}`, s: `${eur(totals(d).tot)} · ${tr('χωρίς απάντηση', 'no answer yet')}`, go: ['doc', d.id] })),
    ...H.expired.map(d => ({ k: 'warn', l: tr('Έληξε ', 'Expired ') + fmtDate(validUntil(d)), t: `${ttl('offer')} ${d.no} · ${d.cl.name}`, s: `${eur(totals(d).tot)} · ${tr('ρωτήστε τον πελάτη ή ανανεώστε', 'ask the client or renew it')}`, go: ['doc', d.id] })),
    ...H.expiring.map(d => ({ k: 'warn', l: tr('Λήγει ', 'Ends ') + fmtDate(contractEnd(d)), t: `${ttl('contract')} ${d.no} · ${d.cl.name}`, s: tr('Ώρα για ανανέωση', 'Time to renew'), go: ['doc', d.id] })),
    ...H.unpaid.filter(d => daysBetween(d.issuedAt || d.date, T) > 30).map(d => ({ k: 'bad', l: tr('Ανεξόφλητο > 30 ημ.', 'Unpaid > 30 days'), t: `${ttl(d.type)} ${d.no} · ${d.cl.name}`, s: `${tr('Υπόλοιπο', 'Balance')} ${eur(balanceOf(d))}`, go: ['doc', d.id] })),
    ...H.tickets.filter(d => d.status === 'ready').map(d => ({ k: 'ok', l: tr('Έτοιμη για παράδοση', 'Ready to collect'), t: `${ttl('ticket')} ${d.no} · ${d.cl.name}`, s: ticketDevice(d), go: ['doc', d.id] })),
  ];
  const recent = DB.docs.filter(d => d.file).sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 7);
  const empty = !DB.docs.length && !DB.clients.length;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${esc(B.name || DB.settings.iss.name || tr('Αρχική', 'Home'))}</h2>
      <button class="btn" type="button" data-q="client">+ ${tr('Πελάτης', 'Client')}</button><button class="btn" type="button" data-q="offer">+ ${ttl('offer')}</button><button class="btn blue" type="button" data-q="proforma">+ ${ttl('proforma')}</button></div>
    ${empty ? `<div class="card"><div class="empty"><b>${tr('Καλώς ήρθατε', 'Welcome')}</b>${tr('Ξεκινήστε με «+ Προσφορά» ή «+ Πελάτης».', 'Start with “+ Quotation” or “+ Client”.')}<br>${tr('Θέλετε πρώτα να δείτε πώς δουλεύει;', 'Want to see how it works first?')} <button class="btn sm" type="button" id="b-demo" style="margin-left:6px">${tr('Φόρτωση δεδομένων επίδειξης', 'Load demo data')}</button></div></div>` : `
    <div class="tiles">
      <button class="tile" type="button" data-tile="unpaid"><span>${tr('Ανεξόφλητα', 'Unpaid')}</span><b class="num">${eur(sum(H.unpaid, balanceOf))}</b><small>${plural(H.unpaid.length, tr('έγγραφο', 'document'), tr('έγγραφα', 'documents'))}</small></button>
      <button class="tile" type="button" data-tile="pending"><span>${tr('Προσφορές σε αναμονή', 'Quotations awaiting answer')}</span><b class="num">${H.waiting.length}</b><small>${eur(sum(H.waiting, d => totals(d).tot))}</small></button>
      <button class="tile" type="button" data-tile="visits"><span>${tr('Επισκέψεις συντήρησης', 'Maintenance visits')}</span><b class="num">${H.visits.length}</b><small>${tr('για αυτόν τον μήνα ή εκκρεμείς', 'this month or pending')}</small></button>
      ${PROF().register && PROF().register !== 'tickets' ? `<button class="tile" type="button" data-tile="reg"><span>${esc(pick2(PROF().regLabel))}</span><b class="num">${H.reg.length}</b><small>${tr('έλεγχοι εκπρόθεσμοι ή σε 30 ημέρες', 'checks overdue or due in 30 days')}</small></button>` : ''}
      ${PROF().register === 'tickets' ? `<button class="tile" type="button" data-tile="reg"><span>${tr('Συσκευές για επισκευή', 'Devices in for repair')}</span><b class="num">${H.tickets.length}</b><small>${plural(H.tickets.filter(d => d.status === 'ready').length, tr('έτοιμη', 'ready'), tr('έτοιμες', 'ready'))}</small></button>` : ''}
      <button class="tile" type="button" data-tile="soon"><span>${tr('Συμβόλαια που λήγουν', 'Agreements ending')}</span><b class="num">${H.expiring.length}</b><small>${tr('τις επόμενες 60 ημέρες', 'in the next 60 days')}</small></button>
      <div class="tile static"><span>${tr('Εισπράξεις', 'Received')} ${H.y}</span><b class="num">${eur(H.received)}</b><small>${tr('από καταχωρημένες πληρωμές', 'from recorded payments')}</small></div>
    </div>
    <div class="grid2" style="margin-top:16px"><div class="card section"><h3>${tr('Χρειάζονται προσοχή', 'Needs attention')} <span class="chip">${att.length}</span></h3>
        ${att.length ? `<div class="tablewrap"><table class="list"><tbody>${att.slice(0, 14).map((a, i) => `<tr class="click" data-att="${i}" tabindex="0"><td><b>${esc(a.t)}</b><span class="sub">${esc(a.s)}</span></td><td class="r"><span class="chip ${a.k}">${esc(a.l)}</span></td></tr>`).join('')}</tbody></table></div>` : `<p class="note" style="margin:0">${tr('Όλα είναι εντάξει. Δεν υπάρχει κάτι που εκκρεμεί.', 'All clear. Nothing is pending.')}</p>`}</div>
      <div class="card section"><h3>${tr('Πρόσφατα', 'Recent')}</h3>${recent.length ? `<div class="tablewrap"><table class="list"><tbody>${recent.map(d => `<tr class="click" data-id="${d.id}" tabindex="0"><td><span class="chip ${d.type}">${ttl(d.type)}</span></td><td class="nw"><b>${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</b><span class="sub">${esc(d.cl.name || '—')}</span></td><td class="r">${chipOf(docState(d))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note" style="margin:0">—</p>'}</div></div>`}</div>`;
  $$('[data-q]').forEach(b => b.onclick = () => b.dataset.q === 'client' ? go('client', 'new') : openNewDoc(b.dataset.q));
  if ($('#b-demo')) $('#b-demo').onclick = loadDemo;
  $$('[data-att]').forEach(tr0 => tr0.onclick = () => go(...att[+tr0.dataset.att].go));
  $$('tr[data-id]').forEach(tr0 => tr0.onclick = () => go('doc', tr0.dataset.id));
  $$('[data-tile]').forEach(b => b.onclick = () => { const k = b.dataset.tile; if (k === 'unpaid') go('debts'); else if (k === 'pending') { filt.docs.t = k; go('docs'); } else if (k === 'reg') go('reg'); else { filt.contracts.t = k === 'visits' ? 'visits' : 'soon'; go('contracts'); } });
}

/* ================================================================== documents list */
const demoChip = x => x.demo ? ` <span class="chip demo">${tr('ΔΕΙΓΜΑ', 'DEMO')}</span>` : '';
const langChip = d => d.lang === 'en' ? ' <span class="chip lang">EN</span>' : '';
function viewDocs() {
  const f = filt.docs;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Έγγραφα', 'Documents')}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Αναζήτηση πελάτη ή αριθμού', 'Search client or number')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση εγγράφων', 'Search documents')}">
    <button class="btn sm" type="button" id="b-csv" title="${tr('Λίστα για Excel', 'List for Excel')}">⇩ CSV</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg" role="tablist">${[['all', tr('Όλα', 'All')], ['offer', tr('Προσφορές', 'Quotations')], ['proforma', tr('Προτιμολόγια', 'Proformas')], ['pending', tr('Σε αναμονή', 'Awaiting')], ['expired', tr('Έληξαν', 'Expired')], ['unpaid', tr('Ανεξόφλητα', 'Unpaid')], ['draft', tr('Πρόχειρα', 'Drafts')], ['cancelled', tr('Ακυρωμένα', 'Cancelled')]].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Αριθμός', 'Number')}</th><th>${tr('Τύπος', 'Type')}</th><th>${tr('Πελάτης', 'Client')}</th><th>${tr('Ημερομηνία', 'Date')}</th><th class="r">${tr('Σύνολο', 'Total')}</th><th class="r">${tr('Υπόλοιπο', 'Balance')}</th><th>${tr('Κατάσταση', 'Status')}</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const match = d => {
    const s = docState(d).k;
    return f.t === 'all' ? true : f.t === 'draft' ? !d.issued : f.t === 'cancelled' ? !!d.cancelled : f.t === 'pending' ? (d.type === 'offer' && s === 'sent') : f.t === 'expired' ? (d.type === 'offer' && s === 'expired')
      : f.t === 'unpaid' ? owing(d) : d.type === f.t;
  };
  const rowsOf = () => { const ql = f.q.toLowerCase(); return DB.docs.filter(d => SALES.includes(d.type) && match(d) && (!ql || [d.no, d.cl.name, d.cl.afm].join(' ').toLowerCase().includes(ql)))
    .sort((a, b) => (b.issued ? b.date : b.updated).localeCompare(a.issued ? a.date : a.updated) || String(b.updated).localeCompare(String(a.updated))); };
  const draw = () => {
    const rows = rowsOf();
    $('#rows').innerHTML = rows.length ? rows.map(d => { const st = docState(d), bal = payable(d) && d.type !== 'offer' ? balanceOf(d) : null;
      return `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}" tabindex="0"><td><b>${d.issued ? esc(d.no) : '<span class="mut">—</span>'}</b></td><td><span class="chip ${d.type}">${ttl(d.type)}</span>${langChip(d)}${demoChip(d)}</td>
      <td>${d.cl.name ? esc(d.cl.name) : `<span class="mut">${tr('χωρίς πελάτη', 'no client')}</span>`}</td><td class="num">${fmtDate(d.date)}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td>
      <td class="r num">${bal == null ? '<span class="mut">—</span>' : bal > 0.005 ? eur(bal) : `<span class="mut">${eur(0)}</span>`}</td><td>${chipOf(st)}</td>${rowActions(d)}</tr>`; }).join('')
      : `<tr><td colspan="8"><div class="empty"><b>${DB.docs.some(d => SALES.includes(d.type)) ? tr('Κανένα έγγραφο με αυτά τα φίλτρα', 'No documents match these filters') : tr('Δεν υπάρχουν ακόμα έγγραφα', 'No documents yet')}</b>${tr('Πατήστε «+ Νέο» πάνω δεξιά για προσφορά ή προτιμολόγιο.', 'Press “+ New” at the top right for a quotation or proforma invoice.')}</div></td></tr>`;
    $$('#rows tr.click').forEach(r => { r.onclick = () => go('doc', r.dataset.id); r.onkeydown = e => { if (e.key === 'Enter') go('doc', r.dataset.id); }; });
    bindRowActions(draw);
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $$('.seg button').forEach(b => b.onclick = () => { f.t = b.dataset.t; $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#b-csv').onclick = () => exportDocsCSV(rowsOf());
  draw();
}

/* ================================================================== clients */
function viewClients() {
  const f = filt.clients, E = EQ();
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${tr('Πελάτες', 'Clients')}</h2>
    <input class="search" id="q" type="search" placeholder="${tr('Όνομα, ΑΦΜ, τηλέφωνο', 'Name, tax number, phone')}" value="${esc(f.q)}" aria-label="${tr('Αναζήτηση πελατών', 'Search clients')}">
    <button class="btn sm" type="button" id="b-csv" title="${tr('Λίστα για Excel', 'List for Excel')}">⇩ CSV</button><button class="btn blue" id="b-nc" type="button">+ ${tr('Νέος πελάτης', 'New client')}</button></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>${tr('Πελάτης', 'Client')}</th><th>${tr('ΑΦΜ', 'Tax no.')}</th><th>${tr('Τηλέφωνο', 'Phone')}</th><th class="r">${tr('Έγγραφα', 'Documents')}</th><th class="r">${E.many}</th><th class="r">${tr('Υπόλοιπο', 'Balance')}</th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = DB.clients.filter(c => !ql || [c.name, c.afm, c.tel, c.email].join(' ').toLowerCase().includes(ql)).sort((a, b) => a.name.localeCompare(b.name, 'el'));
    $('#rows').innerHTML = rows.length ? rows.map(c => { const bal = clientBalance(c); return `<tr class="click" data-id="${c.id}" tabindex="0"><td><b>${esc(c.name)}</b>${langChip(c)}${demoChip(c)}<span class="sub">${esc(c.act || c.addr)}</span></td><td class="num">${esc(c.afm)}</td><td class="num">${esc(c.tel)}</td>
      <td class="r num">${DB.docs.filter(d => d.clientId === c.id && d.file).length}</td><td class="r num">${c.machines.length}</td><td class="r num">${bal > 0.005 ? `<b>${eur(bal)}</b>` : '<span class="mut">—</span>'}</td></tr>`; }).join('')
      : `<tr><td colspan="6"><div class="empty"><b>${DB.clients.length ? tr('Δεν βρέθηκε πελάτης', 'No client found') : tr('Το πελατολόγιο είναι άδειο', 'The client book is empty')}</b>${tr('Οι πελάτες καταχωρούνται αυτόματα όταν εκδίδετε έγγραφο, ή με «+ Νέος πελάτης».', 'Clients are added automatically when you issue a document, or with “+ New client”.')}</div></td></tr>`;
    $$('#rows tr.click').forEach(r => { r.onclick = () => go('client', r.dataset.id); r.onkeydown = e => { if (e.key === 'Enter') go('client', r.dataset.id); }; });
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $('#b-nc').onclick = () => go('client', 'new');
  $('#b-csv').onclick = exportClientsCSV;
  draw();
}
const clientBalance = c => DB.docs.filter(d => d.clientId === c.id && owing(d)).reduce((a, d) => a + Math.max(0, balanceOf(d)), 0);

function viewClient(id) {
  const c = id === 'new' ? normClient({}) : DB.clients.find(x => x.id === id);
  if (!c) return go('clients');
  const E = EQ(), P = PROF();
  const F = [['name', tr('Επωνυμία / Ονοματεπώνυμο', 'Business / full name'), 'wide req'], ['act', tr('Δραστηριότητα', 'Activity'), ''], ['afm', tr('ΑΦΜ', 'Tax number (ΑΦΜ)'), 'req'], ['doy', tr('ΔΟΥ', 'Tax office (ΔΟΥ)'), ''], ['gemi', tr('ΓΕΜΗ', 'Company reg. (ΓΕΜΗ)'), ''], ['addr', tr('Διεύθυνση', 'Address'), ''], ['tel', tr('Τηλέφωνο', 'Phone'), ''], ['email', 'Email', '']];
  const bal = clientBalance(c);
  $('#view').innerHTML = `<div class="view"><button class="back" type="button" id="bk">← ${tr('Πελάτες', 'Clients')}</button>
    <div class="vh"><h2 id="cn">${esc(c.name) || tr('Νέος πελάτης', 'New client')}</h2>${demoChip(c)}${bal > 0.005 ? `<span class="chip unpaid">${tr('Υπόλοιπο', 'Balance')} ${eur(bal)}</span>` : ''}
      <button class="btn" type="button" id="b-no">+ ${ttl('offer')}</button><button class="btn blue" type="button" id="b-np">+ ${ttl('proforma')}</button>
      <div class="dd"><button class="btn ghost" type="button" id="b-more" aria-haspopup="menu" aria-label="${tr('Περισσότερα', 'More')}">⋯</button><div class="menu" hidden id="m-more">${bal > 0.005 ? `<button type="button" id="b-stmt">${tr('Υπενθύμιση οφειλής (email)', 'Payment reminder (email)')}</button>` : ''}${P.register === 'tickets' ? `<button type="button" id="b-tk">${tr('Παραλαβή συσκευής για επισκευή', 'Device in for repair')}</button>` : ''}<button type="button" id="b-delc" style="color:var(--bad)">${tr('Διαγραφή πελάτη', 'Delete client')}</button></div></div></div>
    <div class="grid2"><div class="stack">
      <div class="card section"><h3>${tr('Στοιχεία', 'Details')}</h3><div class="form">${F.map(([k, l, cls]) => `<div class="f ${cls.includes('wide') ? 'wide' : ''} ${cls.includes('req') ? 'req' : ''}"><label for="c-${k}">${l}</label><input id="c-${k}" data-k="${k}" value="${esc(c[k])}"></div>`).join('')}
        <div class="f"><label for="c-lang">${tr('Γλώσσα εγγράφων', 'Document language')}</label><select id="c-lang"><option value="">${tr('Προεπιλογή', 'Default')} (${LANGS[DB.settings.docLang]})</option><option value="el" ${c.lang === 'el' ? 'selected' : ''}>Ελληνικά</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select></div>
        <div class="f wide"><label for="c-notes">${tr('Σημειώσεις', 'Notes')}</label><textarea id="c-notes" data-k="notes">${esc(c.notes)}</textarea></div></div><div id="afmw"></div></div>
      <div class="card section"><h3>${E.many} <span class="chip" id="mcount">${c.machines.length}</span><span class="sp"></span><button class="btn sm" type="button" id="b-am">+ ${E.one}</button></h3>
        <p class="note">${tr(`${E.many} από τα προτιμολόγια μπαίνουν αυτόματα με την έκδοση (γραμμές σημαδεμένες ως ${E.a}). Προσθέστε και ό,τι έχει ήδη ο πελάτης.`, `${E.many} on proforma invoices are added automatically when issued (lines marked as ${E.a}). Add what the client already has, too.`)}</p>
        <div class="tablewrap"><table class="list" id="mt"></table></div></div>
    </div><div class="stack">
      <div class="card section"><h3>${tr('Έγγραφα', 'Documents')}</h3><div id="cdocs"></div></div>
      <div class="card section"><h3>${tr('Συμβόλαια συντήρησης', 'Maintenance agreements')}<span class="sp"></span><button class="btn sm" type="button" id="b-nk">+ ${ttl('contract')}</button></h3><div id="ccons"></div></div>
      ${P.register === 'tickets' ? `<div class="card section"><h3>${tr('Επισκευές', 'Repairs')}</h3><div id="ctk"></div></div>` : ''}
    </div></div></div>`;
  $('#bk').onclick = () => go('clients');
  const problem = () => !c.name.trim() ? { msg: tr('Η επωνυμία είναι υποχρεωτική.', 'The name is required.'), field: 'name' } : afmProblem(c.afm, c.id);
  const showProblem = force => {
    const p = problem(), box = $('#afmw');
    $('#c-afm').classList.toggle('bad', !!p && p.field !== 'name' && (force || c.afm.trim().length > 0));
    $('#c-name').classList.toggle('bad', !!p && p.field === 'name' && force);
    if (p && (force || c.afm.trim() || p.dup)) {
      box.innerHTML = `<div class="errbox">${esc(p.msg)} ${p.dup ? `<button class="btn sm" type="button" id="b-goo">${tr('Άνοιγμα πελάτη', 'Open client')}</button>` : ''}<br><span>${DB.clients.includes(c) ? tr('Οι αλλαγές δεν αποθηκεύονται μέχρι να διορθωθεί.', 'Changes are not saved until this is fixed.') : tr('Ο πελάτης δεν αποθηκεύεται μέχρι να διορθωθεί.', 'The client is not saved until this is fixed.')}</span></div>`;
      if (p.dup) $('#b-goo').onclick = () => go('client', p.dup.id);
    } else box.innerHTML = '';
    return !p;
  };
  const okToUse = () => { if (showProblem(true)) return true; toast(tr('Διορθώστε πρώτα τα στοιχεία του πελάτη', 'Correct the client details first')); $(problem().field === 'name' ? '#c-name' : '#c-afm').focus(); return false; };
  $$('[data-k]').forEach(inp => inp.oninput = () => {
    c[inp.dataset.k] = inp.dataset.k === 'afm' ? inp.value.replace(/[^\d\s]/g, '') : inp.value;
    if (inp.dataset.k === 'afm' && inp.value !== c.afm) inp.value = c.afm;
    if (inp.dataset.k === 'name') $('#cn').textContent = inp.value || tr('Νέος πελάτης', 'New client');
    if (showProblem(false)) persistClient(c); else cancelLater('c' + c.id);
  });
  $('#c-lang').onchange = e => { c.lang = e.target.value; if (showProblem(false)) persistClient(c); };
  $('#c-afm').onblur = () => showProblem(c.afm.trim().length > 0);
  $('#c-afm').setAttribute('inputmode', 'numeric'); $('#c-afm').setAttribute('maxlength', '11');
  const drawM = () => {
    const reg = P.register && P.register !== 'tickets';
    $('#mt').innerHTML = c.machines.length ? `<thead><tr><th>${E.one}</th><th>${tr('Θέση', 'Location')}</th><th>${tr('Εγκατάσταση', 'Installed')}</th><th>${reg ? esc(regWhat()) : tr('Εγγύηση', 'Warranty')}</th></tr></thead><tbody>${c.machines.map(m => { const r = reg ? regRow(c, m) : null; return `<tr class="click" data-id="${m.id}" tabindex="0"><td><b>${esc(machineLabel(m) || E.one)}</b>${m.serial ? `<span class="sub">S/N ${esc(m.serial)}</span>` : ''}${P.register === 'fgas' && m.ref ? `<span class="sub">${esc(m.ref)}${m.charge ? ' · ' + decStr(m.charge) + ' kg' : ''}</span>` : ''}</td><td>${esc(m.location) || '<span class="mut">—</span>'}</td><td class="num">${fmtDate(m.installed) || '—'}</td><td>${reg ? (r ? dueChip(r.next) : '<span class="chip">—</span>') : warrantyChip(m)}</td></tr>`; }).join('')}</tbody>`
      : `<tbody><tr><td><div class="empty" style="padding:22px">${E.none}</div></td></tr></tbody>`;
    $$('#mt tr.click').forEach(r => r.onclick = async () => { const m = c.machines.find(x => x.id === r.dataset.id); const res = await machineForm(clone(m), { allowDelete: true });
      if (res === 'delete') { if (await confirmBox(tr('Διαγραφή', 'Delete'), tr(`Να αφαιρεθεί από τον πελάτη: ${esc(machineLabel(m) || E.one)};`, `Remove from the client: ${esc(machineLabel(m) || E.one)}?`))) { c.machines = c.machines.filter(x => x !== m); persistClient(c, true); drawM(); } }
      else if (res && typeof res === 'object') { Object.assign(m, res); persistClient(c, true); drawM(); } });
    $('#mcount').textContent = c.machines.length;
  };
  $('#b-am').onclick = async () => { if (!okToUse()) return; const m = await machineForm({ id: uid(), log: [] }); if (m && typeof m === 'object') { c.machines.push(m); persistClient(c, true); drawM(); } };
  const docs = DB.docs.filter(d => d.clientId === c.id && SALES.includes(d.type)).sort((a, b) => b.date.localeCompare(a.date));
  $('#cdocs').innerHTML = docs.length ? `<div class="tablewrap"><table class="list"><tbody>${docs.map(d => `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}"><td><span class="chip ${d.type}">${ttl(d.type)}</span>${langChip(d)}</td><td><b>${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</b><span class="sub">${fmtDate(d.date)}</span></td><td>${chipOf(docState(d))}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="note" style="margin:0">${tr('Δεν υπάρχουν έγγραφα για αυτόν τον πελάτη.', 'No documents for this client.')}</p>`;
  $$('#cdocs tr.click').forEach(r => r.onclick = () => go('doc', r.dataset.id));
  const cons = DB.docs.filter(d => d.clientId === c.id && d.type === 'contract').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  $('#ccons').innerHTML = cons.length ? `<div class="tablewrap"><table class="list"><tbody>${cons.map(d => `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}"><td><b>${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</b><span class="sub">${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</span></td><td>${contractStatus(d)}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="note" style="margin:0">${c.machines.length ? tr('Δεν υπάρχει συμβόλαιο. Πατήστε «+ Συμβόλαιο».', 'No agreement yet. Press “+ Agreement”.') : tr(`Προσθέστε πρώτα ${E.as} του πελάτη και μετά φτιάξτε συμβόλαιο.`, `Add the client's ${E.as} first, then create an agreement.`)}</p>`;
  $$('#ccons tr.click').forEach(r => r.onclick = () => go('doc', r.dataset.id));
  if ($('#ctk')) { const tks = DB.docs.filter(d => d.clientId === c.id && d.type === 'ticket').sort((a, b) => b.date.localeCompare(a.date));
    $('#ctk').innerHTML = tks.length ? `<div class="tablewrap"><table class="list"><tbody>${tks.map(d => `<tr class="click" data-id="${d.id}"><td><b>${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</b><span class="sub">${esc(ticketDevice(d))}</span></td><td>${chipOf(docState(d))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="note" style="margin:0">—</p>`;
    $$('#ctk tr.click').forEach(r => r.onclick = () => go('doc', r.dataset.id)); }
  $('#b-nk').onclick = () => { if (!okToUse()) return; persistClient(c, true); openContract(c); };
  const fromClient = () => ({ clientId: c.id, cl: pickCl(c), lang: langForClient(c) });
  $('#b-no').onclick = () => { if (!okToUse()) return; persistClient(c, true); openNewDoc('offer', fromClient()); };
  $('#b-np').onclick = () => { if (!okToUse()) return; persistClient(c, true); openNewDoc('proforma', fromClient()); };
  $('#b-more').onclick = e => { e.stopPropagation(); $('#m-more').hidden = !$('#m-more').hidden; };
  if ($('#b-stmt')) $('#b-stmt').onclick = () => { $('#m-more').hidden = true; statementDialog(c); };
  if ($('#b-tk')) $('#b-tk').onclick = () => { $('#m-more').hidden = true; if (!okToUse()) return; persistClient(c, true); openTicket(c); };
  $('#b-delc').onclick = async () => {
    $('#m-more').hidden = true;
    const issued = DB.docs.filter(d => d.clientId === c.id && d.issued).length;
    if (!(await confirmBox(tr('Διαγραφή πελάτη', 'Delete client'), tr(`Να διαγραφεί ο πελάτης «${esc(c.name)}»;${issued ? ` Τα ${issued} εκδομένα έγγραφά του <b>δεν</b> διαγράφονται και κρατούν τα στοιχεία του.` : ''}`, `Delete the client “${esc(c.name)}”?${issued ? ` Their ${issued} issued documents are <b>not</b> deleted and keep the client details.` : ''}`)))) return;
    DB.clients = DB.clients.filter(x => x !== c); cancelLater('c' + c.id); if (c.file) q(() => delFile(DIRS.clients, c.file)); go('clients');
  };
  drawM();
  if (id === 'new') $('#c-name').focus(); else showProblem(false);
}

/* ================================================================== new documents */
function newDoc(type, from = {}) {
  const df = DB.settings.defaults;
  const cl = from.clientId ? DB.clients.find(c => c.id === from.clientId) : null;
  const d = normDoc(Object.assign({ id: uid(), type, issued: false, date: todayISO(), vat: df.vat, adv: df.adv, days: df.days, dur: '', durU: df.durU, lang: langForClient(cl) }, clone(from),
    { id: uid(), type, issued: false, no: '', issuedAt: '', status: undefined, cancelled: undefined, payments: [], date: todayISO(), dateManual: false, file: undefined, dir: undefined, created: new Date().toISOString(), updated: undefined }));
  delete d.iss; delete d.accounts;
  if (cl?.demo) d.demo = true;
  normDoc(d); DB.docs.push(d); return d;
}
function openNewDoc(type, from) { const d = newDoc(type, from); go('doc', d.id); }
const copyOf = d => ({ clientId: d.clientId, cl: d.cl, items: d.items, extra: d.extra, vat: d.vat, adv: d.adv, days: d.days, dur: d.dur, durU: d.durU, demo: d.demo, lang: d.lang });

/* ================================================================== sales document editor */
const UNLOCK = new Set();
function viewDoc(id) {
  const d = DB.docs.find(x => x.id === id); if (!d) return go('docs');
  if (d.type === 'contract') return viewContract(d);
  if (d.type === 'ticket') return viewTicket(d);
  cur = d; useDocLang(d);
  if (!d.issued && !d.dateManual) d.date = todayISO();
  const S = DB.settings, iss = issFor(d.issued && d.iss ? d.iss : S.iss);
  const accts = (d.issued && d.accounts ? d.accounts : S.accounts).filter(a => a.bank || a.iban);
  const lock = d.issued && !UNLOCK.has(d.id), ce = lock ? '' : 'contenteditable';
  $('#view').innerHTML = `<div class="subbar so">
      <button class="btn ghost sm" type="button" id="bk">← ${tr('Έγγραφα', 'Documents')}</button>
      <div class="dt"><span class="chip ${d.type}">${ttl(d.type)}</span><span id="st-no">${d.issued ? esc(d.no) : tr('Πρόχειρο', 'Draft')}</span>${d.issued ? chipOf(docState(d)) : ''}${demoChip(d)}${relChips(d)}</div>
      ${langToggle(d, lock)}
      <span class="sp"></span><span class="ovf" id="ovf" hidden>${tr('Ξεπερνά τη μία σελίδα A4', 'Longer than one A4 page')}</span>
      <div class="dd"><button class="btn" type="button" id="b-opt" aria-haspopup="menu">${tr('Επιλογές', 'Options')} ⋯</button>
        <div class="menu panel" id="m-opt" hidden>
          ${lock ? '' : `${d.issued ? '' : `<div class="f"><label for="o-type">${tr('Τύπος εγγράφου', 'Document type')}</label><select id="o-type">${SALES.map(k => `<option value="${k}" ${k === d.type ? 'selected' : ''}>${ttl(k)}</option>`).join('')}</select></div>`}
          <div class="row2"><div class="f"><label for="o-vat">${tr('ΦΠΑ %', 'VAT %')}</label><input id="o-vat" type="number" min="0" max="100" value="${esc(d.vat)}"></div>
          <div class="f"><label for="o-adv">${tr('Προκαταβολή %', 'Advance %')}</label><input id="o-adv" type="number" min="0" max="100" value="${esc(d.adv)}"></div></div>
          <div class="row2"><div class="f"><label for="o-days">${tr('Ισχύς ημέρες', 'Valid (days)')}</label><input id="o-days" type="number" min="0" value="${esc(d.days)}"></div>
          <div class="f"><label for="o-dur">${tr('Ολοκλήρωση', 'Completion')}</label><input id="o-dur" type="number" min="0" placeholder="–" value="${esc(d.dur)}"></div></div>
          <div class="f"><label for="o-durU">${tr('Μονάδα ολοκλήρωσης', 'Completion unit')}</label><select id="o-durU">${DUR_UNITS.map(u => `<option value="${u}" ${u === d.durU ? 'selected' : ''}>${durUnitUI(u)}</option>`).join('')}</select></div><hr>`}
          <button type="button" id="o-mail">${tr('Κείμενο για email', 'Email text')}</button>
          <button type="button" id="o-dup">${tr('Αντίγραφο ως νέο πρόχειρο', 'Copy as a new draft')}</button>
          <button type="button" id="o-dupc">${tr('Αντίγραφο για άλλον πελάτη…', 'Copy for another client…')}</button>
          <button type="button" id="o-tpl">${tr('Αποθήκευση ως πρότυπο…', 'Save as a template…')}</button>
          ${d.issued ? '' : `<button type="button" id="o-draft">${tr('Πρόχειρη εκτύπωση (χωρίς αριθμό)', 'Draft print (no number)')}</button>`}
          ${d.issued && lock && !d.cancelled ? `<button type="button" id="o-unlock">${tr('Διόρθωση εκδομένου…', 'Correct issued document…')}</button>` : ''}
          ${d.issued ? `<hr><button type="button" id="o-hard" style="color:var(--bad)">${tr('Οριστική διαγραφή αρχείου…', 'Delete file permanently…')}</button>` : ''}
        </div></div>
      ${d.cancelled ? '' : d.type === 'offer' ? `<button class="btn conv" type="button" id="b-conv" title="${tr('Νέο πρόχειρο προτιμολόγιο με τα στοιχεία της προσφοράς', 'New draft proforma invoice with the details of the quotation')}">→ ${ttl('proforma')}</button>` : `<button class="btn conv" type="button" id="b-tocon" title="${tr('Νέο πρόχειρο συμβόλαιο με τον πελάτη και τον εξοπλισμό του προτιμολογίου', 'New draft agreement with the client and the equipment of the proforma invoice')}">→ ${ttl('contract')}</button>`}
      ${d.issued ? (d.cancelled ? '' : `<button class="btn danger" type="button" id="b-cancel">${tr('Ακύρωση', 'Cancel')}</button>`) : `<button class="btn danger" type="button" id="b-del">${tr('Διαγραφή', 'Delete')}</button><button class="btn" type="button" id="b-save">${tr('Αποθήκευση', 'Save')}</button>`}
      <button class="btn blue" type="button" id="b-pdf">${d.issued ? tr('PDF / Εκτύπωση', 'PDF / Print') : tr('Έκδοση & PDF', 'Issue & PDF')}</button>
    </div>
    <div class="wrap">${statusCard(d)}<div class="page ${lock ? 'locked' : ''}" id="page" lang="${DL}">
    <aside>
      <div class="logo">${lockup(S.brand)}</div>
      <div class="blk" title="${d.issued ? tr('Στοιχεία κατά την έκδοση', 'Details at the time of issue') : tr('Αλλάζουν από τις Ρυθμίσεις', 'Change them in Settings')}"><div class="lbl">${dt('Εκδότης', 'Issued by')}</div>${issuerBlock(iss)}</div>
      <div class="blk" title="${d.issued ? tr('Στοιχεία κατά την έκδοση', 'Details at the time of issue') : tr('Αλλάζουν από τις Ρυθμίσεις', 'Change them in Settings')}"><div class="lbl">${dt('Πληρωμή', 'Payment')}</div>
        ${accts.map(a => `<div class="acct"><span class="k">${esc(a.bank)}</span><br><span class="iban">${esc(a.iban)}</span></div>`).join('')}
        <span class="k">${dt('Αιτιολογία:', 'Reference:')}</span> <span data-out="no"></span></div>
      <div class="totalbox"><div class="lbl">${dt('Σύνολο με ΦΠΑ', 'Total incl. VAT')}</div><div class="big num" data-out="tot"></div>
        <div class="split" data-adv><span>${dt('Προκαταβολή', 'Advance')} <span data-out="advp"></span>%</span><b class="num" data-out="advv"></b></div>
        <div class="split" data-adv><span>${dt('Εξόφληση', 'Balance')} <span data-out="balp"></span>%</span><b class="num" data-out="bal"></b></div></div>
      ${S.brand.credit ? creditHTML() : ''}
    </aside>
    <main>
      <div class="hA"><div><div class="eb">${dlabel(d.type)}</div><div class="hA-no"><span data-out="no"></span>${d.issued ? '' : `<span class="prov" title="${tr('Ο αριθμός οριστικοποιείται με την έκδοση', 'The number is final when issued')}">${dt('ΠΡΟΣΩΡΙΝΟΣ', 'PROVISIONAL')}</span>`}</div></div>
        <div class="hA-r"><div><span class="t">${dt('ΗΜΕΡΟΜΗΝΙΑ', 'DATE')}</span>${lock ? '<span data-out="date"></span>' : `<label class="dp" title="${tr('Επιλογή ημερομηνίας', 'Pick a date')}"><span data-out="date"></span><input type="date" id="e-date" aria-label="${tr('Ημερομηνία έκδοσης', 'Issue date')}"></label>`}</div>
        <div><span class="t">${dt('ΙΣΧΥΕΙ ΕΩΣ', 'VALID UNTIL')}</span>${lock ? '<span data-out="valid"></span>' : `<label class="dp" title="${tr('Επιλογή λήξης ισχύος', 'Pick the expiry date')}"><span data-out="valid"></span><input type="date" id="e-valid" aria-label="${tr('Ισχύει έως', 'Valid until')}"></label>`}</div></div></div>
      <div class="lbl">${dt('Προς', 'To')} ${lock ? '' : `<button class="linkbtn so ${d.clientId ? 'ok' : ''}" type="button" id="b-pick">${d.clientId ? tr('✓ Από το πελατολόγιο · αλλαγή', '✓ From the client book · change') : tr('Επιλογή από πελατολόγιο', 'Choose from client book')}</button>`}</div>
      <div class="to">
        <div class="nm2" ${ce} data-k="name" data-ph="${tr('Επωνυμία πελάτη', 'Client name')}"></div>
        <div class="ln"><span class="opt" data-o="act"><span class="mut" ${ce} data-k="act" data-ph="${tr('Δραστηριότητα', 'Activity')}"></span></span></div>
        <div class="ln"><span class="opt" data-o="addr"><span ${ce} data-k="addr" data-ph="${tr('Διεύθυνση', 'Address')}"></span></span></div>
        <div class="ln"><span class="opt" data-o="afm">${dt('ΑΦΜ', 'VAT no.')} <span ${ce} data-k="afm" data-ph="${tr('ΑΦΜ', 'Tax no.')}"></span></span><span class="opt" data-o="doy">${dt('ΔΟΥ', 'Tax office')} <span ${ce} data-k="doy" data-ph="${tr('ΔΟΥ', 'Tax office')}"></span></span><span class="opt" data-o="gemi">${dt('ΓΕΜΗ', 'GEMI')} <span ${ce} data-k="gemi" data-ph="ΓΕΜΗ"></span></span></div>
        <div class="ln mut"><span class="opt" data-o="tel"><span ${ce} data-k="tel" data-ph="${tr('τηλέφωνο', 'phone')}"></span></span><span class="opt" data-o="email"><span ${ce} data-k="email" data-ph="email"></span></span></div>
      </div>
      <table><thead><tr><th style="width:7mm">#</th><th>${dt('ΠΕΡΙΓΡΑΦΗ', 'DESCRIPTION')}</th><th class="c" style="width:15mm">${dt('ΠΟΣ.', 'QTY')}</th><th class="r" style="width:22mm">${dt('ΤΙΜΗ', 'PRICE')}</th><th class="r" style="width:23mm">${dt('ΣΥΝΟΛΟ', 'TOTAL')}</th></tr></thead><tbody id="items"></tbody></table>
      ${lock ? '' : `<div class="addrows so"><button class="addrow" id="b-add" type="button">+ ${tr('Προσθήκη γραμμής', 'Add line')}</button><button class="addrow" id="b-cat" type="button">+ ${tr('Από κατάλογο', 'From catalogue')}</button><button class="addrow" id="b-tpl" type="button">+ ${tr('Από πρότυπο', 'From template')}</button></div>`}
      <div class="sums" id="sums"></div>
      <div class="terms"><div class="lbl">${dt('Όροι', 'Terms')}</div><ol id="terms">
        <li data-out="vatterm"></li>
        <li data-adv data-out="advterm"></li>
        <li data-adv data-out="balterm"></li>
        <li data-out="validterm"></li>
        <li id="t-dur" data-out="durterm"></li>
        <li id="t-opt" data-out="optterm"></li></ol>
        ${lock ? '' : `<button class="addrow so" id="b-term" type="button">+ ${tr('Προσθήκη όρου', 'Add term')}</button>`}
        <div class="sign"><div>${dt('Για τον εκδότη', 'For the issuer')}</div><div>${dt('Αποδοχή πελάτη · υπογραφή / σφραγίδα', 'Client acceptance · signature / stamp')}</div></div>
        <div class="nofisc">${dt('Το παρόν δεν αποτελεί φορολογικό παραστατικό.', 'This document is not a tax invoice.')}</div></div>
    </main></div></div>`;
  setWM(d);
  const touch = () => { calc(); persistDoc(d); };
  $('#bk').onclick = () => go('docs');
  $$('.to [data-k]').forEach(el => { el.textContent = d.cl[el.dataset.k] || ''; if (!lock) el.oninput = () => { d.cl[el.dataset.k] = textOf(el); touch(); }; });
  bindLangToggle(d, () => viewDoc(d.id));
  if (!lock) {
    const de = $('#e-date'), ve = $('#e-valid');
    de.value = d.date;
    de.onchange = () => { if (de.value) { d.date = de.value; d.dateManual = true; touch(); } };
    ve.onchange = () => { if (!ve.value) return; const diff = daysBetween(d.date, ve.value); if (diff >= 0) { d.days = diff; if ($('#o-days')) $('#o-days').value = diff; touch(); } };
    [de, ve].forEach(i => i.onclick = () => { try { i.showPicker(); } catch (e) { } });
    $('#b-pick').onclick = async () => { const c = await clientPicker(); if (!c) return; d.clientId = c.id; d.cl = pickCl(c); if (c.demo) d.demo = true; if (c.lang && c.lang !== d.lang) switchDocLang(d, c.lang, true); persistDoc(d, true); viewDoc(d.id); };
    $('#b-add').onclick = () => { d.items.push(blankItem()); renderItems(d); touch(); $$('#items .it-t').pop().focus(); };
    $('#b-cat').onclick = async () => { const it = await catalogPicker(); if (!it) return; const last = d.items[d.items.length - 1]; const row = catalogRow(it, d);
      if (last && !last.t && !num(last.p) && !last.s) d.items[d.items.length - 1] = row; else d.items.push(row); renderItems(d); touch(); };
    $('#b-tpl').onclick = () => insertTemplate(d);
    $('#b-term').onclick = () => { d.extra.push(''); renderTerms(d); $$('#terms li.x span').pop().focus(); };
    [['o-vat', 'vat'], ['o-adv', 'adv'], ['o-days', 'days'], ['o-dur', 'dur']].forEach(([i, k]) => $('#' + i).oninput = e => { d[k] = e.target.value; touch(); renderItems(d); calc(); });
    $('#o-durU').onchange = e => { d.durU = e.target.value; touch(); };
    if ($('#o-type')) $('#o-type').onchange = e => { d.type = e.target.value; persistDoc(d, true); viewDoc(d.id); };
  }
  renderItems(d); renderTerms(d);
  const mo = $('#m-opt'); $('#b-opt').onclick = e => { e.stopPropagation(); mo.hidden = !mo.hidden; };
  mo.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') e.stopPropagation(); });
  if ($('#b-conv')) $('#b-conv').onclick = () => offerToProforma(d);
  if ($('#b-tocon')) $('#b-tocon').onclick = () => proformaToContract(d);
  $('#o-dup').onclick = () => { persistDoc(d, true); openNewDoc(d.type, copyOf(d)); toast(tr('Δημιουργήθηκε αντίγραφο ως νέο πρόχειρο', 'A copy was created as a new draft')); };
  $('#o-dupc').onclick = async () => { mo.hidden = true; const c = await clientPicker(tr('Αντίγραφο για τον πελάτη', 'Copy for the client')); if (!c) return; persistDoc(d, true);
    openNewDoc(d.type, { ...copyOf(d), clientId: c.id, cl: pickCl(c), lang: c.lang || d.lang, demo: c.demo || undefined }); toast(tr(`Νέο πρόχειρο για «${c.name}»`, `New draft for “${c.name}”`)); };
  $('#o-tpl').onclick = () => { mo.hidden = true; saveTemplate(d); };
  $('#o-mail').onclick = () => emailDialog(d);
  if ($('#o-unlock')) $('#o-unlock').onclick = async () => { if (await confirmBox(tr('Διόρθωση εκδομένου', 'Correct issued document'), tr(`Το ${esc(d.no)} έχει ήδη σταλεί; Αν ναι, προτιμήστε «Ακύρωση» και νέο έγγραφο, ώστε να συμφωνεί με αυτό που έχει ο πελάτης. Να ξεκλειδώσει για διόρθωση;`, `Has ${esc(d.no)} already been sent? If so, prefer “Cancel” and a new document, so it matches what the client has. Unlock it for correction?`), tr('Ξεκλείδωμα', 'Unlock'), 'blue')) { UNLOCK.add(d.id); viewDoc(d.id); } };
  if ($('#o-hard')) $('#o-hard').onclick = async () => { if (await hardDelete(d)) go('docs'); };
  if ($('#b-del')) $('#b-del').onclick = async () => { if (await deleteDoc(d)) go('docs'); };
  if ($('#b-cancel')) $('#b-cancel').onclick = () => cancelDoc(d);
  if ($('#b-save')) $('#b-save').onclick = () => saveNow(d);
  if ($('#o-draft')) $('#o-draft').onclick = () => { mo.hidden = true; doPrint(true); };
  $('#b-pdf').onclick = () => d.issued ? doPrint(false) : issueDialog(d);
  bindStatusCard(d);
  calc();
  afterFonts(fitLogo);
}
/* the issuer block, in the language of the document */
const issuerBlock = iss0 => { const iss = issFor(iss0); return `<span class="strong">${esc(iss.name)}</span>${iss.father ? '<br>' + esc(iss.father) : ''}${iss.addr ? '<br>' + esc(iss.addr) : ''}${iss.afm ? `<br><span class="k">${dt('ΑΦΜ', 'VAT no.')}</span> ${esc(iss.afm)}` : ''}${iss.doy ? `<br><span class="k">${dt('ΔΟΥ', 'Tax office')}</span> ${esc(iss.doy)}` : ''}${iss.tel ? `<br><span class="k">${dt('Τηλ.', 'Tel.')}</span> ${esc(iss.tel)}` : ''}${iss.email ? '<br>' + esc(iss.email) : ''}`; };
function setWM(d) {
  const p = $('#page'); if (!p) return;
  const w = d.cancelled ? dt('ΑΚΥΡΩΘΗΚΕ', 'CANCELLED') : (d.demo || isDemoDoc(d)) ? dt('ΔΕΙΓΜΑ', 'SAMPLE') : dt('ΠΡΟΧΕΙΡΟ', 'DRAFT');
  p.dataset.wm = w; p.classList.toggle('wm', !!(d.cancelled || d.demo || isDemoDoc(d))); p.classList.toggle('wm-bad', !!d.cancelled);
}

/* document language: a toggle on drafts, a chip on issued documents */
function langToggle(d, lock) {
  if (lock || d.issued) return d.lang === 'en' ? '<span class="chip lang">EN</span>' : '';
  return `<div class="seg langseg so" title="${tr('Γλώσσα εγγράφου', 'Document language')}">${['el', 'en'].map(l => `<button type="button" data-dl="${l}" class="${d.lang === l ? 'on' : ''}">${l === 'el' ? 'ΕΛ' : 'EN'}</button>`).join('')}</div>`;
}
function bindLangToggle(d, redraw) { $$('[data-dl]').forEach(b => b.onclick = () => { if (b.dataset.dl === d.lang) return; switchDocLang(d, b.dataset.dl); persistDoc(d, true); redraw(); }); }
/* swap catalogue lines, default exclusions and payment text to the other language */
function switchDocLang(d, lang, quiet) {
  const from = d.lang; d.lang = lang; let n = 0;
  for (const it of d.items || []) {
    const c = DB.settings.catalog.find(x => [x.t, x.te].filter(Boolean).some(t => t.trim().toLowerCase() === (it.t || '').trim().toLowerCase()));
    if (!c || !c.te) continue;
    const t = lang === 'en' ? c.te : c.t, s = lang === 'en' ? (c.se || c.s) : c.s;
    if (t !== it.t) { it.t = t; if (!it.s || it.s === c.s || it.s === c.se) it.s = s || ''; n++; }
  }
  if (d.type === 'contract') {
    const S = DB.settings, a = from === 'en' ? S.exclusionsEn : S.exclusions, b = lang === 'en' ? S.exclusionsEn : S.exclusions;
    if (JSON.stringify(d.excl) === JSON.stringify(a)) d.excl = clone(b);
  }
  if (!quiet && n) toast(tr(`Μεταφράστηκαν ${n} γραμμές από τον κατάλογο`, `${n} lines were translated from the catalogue`));
}

/* related documents: where it came from and what was made from it */
function relChips(d) {
  const out = [];
  if (d.from) { const src = DB.docs.find(x => x.id === d.from.id), T = TYPES[d.from.type] ? ttl(d.from.type) : ''; const label = src?.issued ? src.no : d.from.no || tr('πρόχειρο ', 'draft ') + T.toLowerCase();
    out.push(src ? `<button class="chip so-from" type="button" data-rel="${src.id}" title="${tr('Άνοιγμα', 'Open')}">${tr('από', 'from')} ${esc(label)} ↗</button>` : `<span class="chip">${tr('από', 'from')} ${esc(label)}</span>`); }
  for (const k of childrenOf(d)) out.push(`<button class="chip so-from" type="button" data-rel="${k.id}" title="${tr('Άνοιγμα', 'Open')}">→ ${esc(k.issued ? k.no : ttl(k.type) + tr(' (πρόχειρο)', ' (draft)'))} ↗</button>`);
  return out.join('');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rel]'); if (b) go('doc', b.dataset.rel); });

/* status card above the page: offer answer, payments, cancellation */
function statusCard(d) {
  if (!d.issued) return '';
  const st = docState(d);
  let h = '';
  if (d.cancelled) h += `<div class="sc-cx"><b>${tr('Ακυρώθηκε', 'Cancelled')} ${fmtDate(d.cancelled.at)}</b>${d.cancelled.reason ? ' · ' + esc(d.cancelled.reason) : ''}<span class="sp"></span><button class="btn sm" type="button" id="sc-uncx">${tr('Αναίρεση ακύρωσης', 'Undo cancellation')}</button></div>`;
  if (d.type === 'offer' && !d.cancelled) {
    h += `<div class="sc-row"><b>${tr('Απάντηση πελάτη', 'Client answer')}</b><div class="seg" id="sc-st">${[['sent', tr('Σε αναμονή', 'Awaiting')], ['accepted', tr('Αποδεκτή', 'Accepted')], ['rejected', tr('Απορρίφθηκε', 'Rejected')]].map(([k, l]) => `<button type="button" data-st="${k}" class="${(d.status || 'sent') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${st.k === 'expired' ? `<span class="chip warn">${tr('Η ισχύς έληξε', 'Validity ended')} ${fmtDate(validUntil(d))}</span><button class="btn sm" type="button" id="sc-renew">${tr('Νέα προσφορά με νέα ισχύ', 'New quotation with new validity')}</button>` : (d.status || 'sent') === 'sent' ? `<span class="mut">${tr('ισχύει έως', 'valid until')} ${fmtDate(validUntil(d))}</span>` : ''}
      ${d.status === 'accepted' && !childrenOf(d).some(k => k.type === 'proforma') ? `<button class="btn sm conv" type="button" id="sc-conv">→ ${tr('Δημιουργία προτιμολογίου', 'Create proforma invoice')}</button>` : ''}</div>`;
  }
  if (payable(d) && d.type !== 'offer' || (d.payments || []).length) h += paymentsBlock(d);
  return h ? `<div class="statuscard so card">${h}</div>` : '';
}
function paymentsBlock(d) {
  const t = totals(d).tot, paid = paidOf(d), bal = Math.round((t - paid) * 100) / 100, ps = payState(d);
  return `<div class="sc-row"><b>${tr('Πληρωμές', 'Payments')}</b>${chipOf(ps)}<span class="mut">${tr('Σύνολο', 'Total')} ${eur(t)} · ${tr('Εισπράχθηκαν', 'Received')} ${eur(paid)} · <b style="color:var(--navy)">${tr('Υπόλοιπο', 'Balance')} ${eur(Math.max(0, bal))}</b></span></div>
    ${(d.payments || []).length ? `<table class="list pays"><tbody>${d.payments.map(p => `<tr><td class="num">${fmtDate(p.date)}</td><td class="r num"><b>${eur(num(p.amount))}</b></td><td>${esc(payMethodUI(p.method))}</td><td class="mut">${esc(p.note || '')}</td><td class="r"><button class="btn sm ghost" type="button" data-rmpay="${p.id}" aria-label="${tr('Αφαίρεση πληρωμής', 'Remove payment')}">×</button></td></tr>`).join('')}</tbody></table>` : ''}
    ${d.cancelled ? '' : `<div class="payadd"><input type="date" id="pa-date" value="${todayISO()}" aria-label="${tr('Ημερομηνία πληρωμής', 'Payment date')}"><input class="inp" id="pa-amt" inputmode="decimal" value="${bal > 0 ? decStr(bal) : ''}" placeholder="${tr('Ποσό €', 'Amount €')}" aria-label="${tr('Ποσό', 'Amount')}"><select id="pa-m" aria-label="${tr('Τρόπος', 'Method')}">${PAY_METHODS.map(m => `<option value="${m}">${payMethodUI(m)}</option>`).join('')}</select><input class="inp" id="pa-note" placeholder="${tr('Σημείωση (προαιρετικά)', 'Note (optional)')}" aria-label="${tr('Σημείωση', 'Note')}">
      ${num(d.adv) && !paid && d.type !== 'contract' ? `<button class="btn sm" type="button" id="pa-adv">${tr('Προκαταβολή', 'Advance')} ${eur(totals(d).advv)}</button>` : ''}<button class="btn sm blue" type="button" id="pa-add">+ ${tr('Πληρωμή', 'Payment')}</button></div>`}`;
}
function bindStatusCard(d) {
  const redraw = () => (d.type === 'contract' ? viewContract(d) : viewDoc(d.id));
  $$('#sc-st [data-st]').forEach(b => b.onclick = () => { d.status = b.dataset.st; d.statusAt = todayISO(); persistDoc(d, true); redraw(); if (d.status === 'accepted') toast(tr('Η προσφορά σημειώθηκε ως αποδεκτή', 'The quotation was marked as accepted')); });
  if ($('#sc-conv')) $('#sc-conv').onclick = () => offerToProforma(d);
  if ($('#sc-renew')) $('#sc-renew').onclick = () => { persistDoc(d, true); openNewDoc('offer', { ...copyOf(d), from: { id: d.id, type: d.type, no: d.no } }); toast(tr('Νέο πρόχειρο με σημερινή ημερομηνία και νέα ισχύ', 'New draft with today\'s date and a new validity')); };
  if ($('#sc-uncx')) $('#sc-uncx').onclick = async () => { if (!(await confirmBox(tr('Αναίρεση ακύρωσης', 'Undo cancellation'), tr(`Το ${esc(d.no)} θα ξαναγίνει ενεργό.`, `${esc(d.no)} will become active again.`), tr('Αναίρεση', 'Undo'), 'blue'))) return; delete d.cancelled; persistDoc(d, true); redraw(); };
  $$('[data-rmpay]').forEach(b => b.onclick = async () => { if (!(await confirmBox(tr('Αφαίρεση πληρωμής', 'Remove payment'), tr('Να αφαιρεθεί η πληρωμή;', 'Remove this payment?'), tr('Αφαίρεση', 'Remove')))) return; d.payments = d.payments.filter(p => p.id !== b.dataset.rmpay); persistDoc(d, true); redraw(); });
  if ($('#pa-adv')) $('#pa-adv').onclick = () => { $('#pa-amt').value = decStr(totals(d).advv); $('#pa-note').value = tr('Προκαταβολή', 'Advance'); };
  if ($('#pa-add')) $('#pa-add').onclick = () => {
    const amt = Math.round(num($('#pa-amt').value) * 100) / 100; if (!(amt > 0)) { toast(tr('Γράψτε το ποσό', 'Enter the amount')); return $('#pa-amt').focus(); }
    d.payments.push({ id: uid(), date: $('#pa-date').value || todayISO(), amount: amt, method: $('#pa-m').value, note: $('#pa-note').value.trim() });
    d.payments.sort((a, b) => a.date.localeCompare(b.date)); persistDoc(d, true); redraw();
    toast(balanceOf(d) <= 0.005 ? tr('Εξοφλήθηκε', 'Paid in full') : tr('Καταχωρήθηκε πληρωμή · υπόλοιπο ', 'Payment recorded · balance ') + eur(balanceOf(d)));
  };
}

/* lines: discount, VAT and equipment per line */
function renderItems(d) {
  const tb = $('#items'); tb.innerHTML = '';
  const lock = d.issued && !UNLOCK.has(d.id), ce = lock ? '' : 'contenteditable', E = EQ();
  d.items.forEach((it, i) => {
    const tr0 = document.createElement('tr'); if (it.opt) tr0.className = 'optl';
    tr0.innerHTML = `<td class="n">${String(i + 1).padStart(2, '0')}${lock ? '' : `<button class="del so" type="button" title="${tr('Διαγραφή γραμμής', 'Delete line')}" aria-label="${tr('Διαγραφή γραμμής', 'Delete line')} ${i + 1}">×</button><button class="lopt so" type="button" title="${tr(`Έκπτωση, ΦΠΑ, ${E.a}, κατάλογος`, `Discount, VAT, ${E.a}, catalogue`)}" aria-label="${tr('Ρυθμίσεις γραμμής', 'Line settings')} ${i + 1}">⋯</button>`}</td>
      <td><span class="it-t" ${ce} data-f="t" data-ph="${tr('Περιγραφή', 'Description')}"></span><span class="it-s" ${ce} data-multi="1" data-f="s" data-ph="${tr('λεπτομέρειες (προαιρετικά, Enter για νέα γραμμή)', 'details (optional, Enter for a new line)')}"></span>${it.opt ? `<span class="optb">${dt('Προαιρετικό · δεν περιλαμβάνεται στο σύνολο', 'Optional · not included in the total')}</span>` : ''}<span class="mwrap"></span></td>
      <td class="c"><span ${ce} data-f="q" data-ph="1"></span><span class="u" ${ce} data-f="u" data-ph="${tr('μ.μ.', 'unit')}"></span></td>
      <td class="r num"><span ${ce} data-f="p" data-ph="${DL === 'en' ? '0.00' : '0,00'}"></span><span class="u" data-o="disc"></span></td><td class="r num b"><span data-o="line"></span><span class="u" data-o="lvat"></span></td>`;
    const chip = () => {
      const w = $('.mwrap', tr0), on = it.m?.on;
      if (lock && !on) { w.innerHTML = ''; return; }
      w.innerHTML = `<button type="button" class="mchip so ${on ? '' : 'off'}" title="${d.type === 'proforma' ? tr('Περνά στον πελάτη με την έκδοση', 'Added to the client when issued') : tr('Περνά στον πελάτη όταν εκδοθεί προτιμολόγιο', 'Added to the client when a proforma invoice is issued')}" ${lock ? 'disabled' : ''}>${on ? E.icon + ' ' + E.one + ': ' + esc(machineLabel(it.m) || tr('χωρίς στοιχεία', 'no details')) + (num(it.q) > 1 ? ' ×' + num(it.q) : '') : tr('+ σήμανση ως ', '+ mark as ') + E.a}</button>`;
      if (!lock) $('.mchip', w).onclick = () => lineDialog(d, it, 'eq');
    };
    tr0.querySelectorAll('[data-f]').forEach(el => {
      const f = el.dataset.f;
      el.textContent = f === 'p' ? (it.p === '' ? '' : deur(num(it.p))) : f === 'u' ? dunit(it.u ?? '') : f === 'q' ? dqty(it.q ?? '') : (it[f] ?? '');
      if (lock) return;
      el.oninput = () => {
        it[f] = textOf(el);
        if (f === 't' && isHvac() && (!it.m || it.m.auto)) { const p = parseMachine(it.t); it.m = p.btu ? { on: true, auto: true, ...p, model: '' } : null; chip(); }
        if (f === 'q') chip();
        calc(); persistDoc(d);
      };
      if (f === 'p') { el.onfocus = () => { el.textContent = it.p === '' ? '' : dqty(num(it.p)); }; el.onblur = () => { it.p = num(it.p); el.textContent = deur(it.p); calc(); persistDoc(d); }; }
      if (f === 'q') el.onblur = () => { it.q = num(it.q); el.textContent = dqty(it.q); chip(); calc(); persistDoc(d); };
    });
    if (!lock) {
      tr0.querySelector('.del').onclick = () => { d.items.splice(i, 1); if (!d.items.length) d.items.push(blankItem()); renderItems(d); calc(); persistDoc(d); };
      tr0.querySelector('.lopt').onclick = () => lineDialog(d, it);
    }
    tb.appendChild(tr0); chip();
  });
}
async function lineDialog(d, it, focus) {
  const P = PROF(), E = EQ(), p = parseMachine(it.t), m = it.m || {};
  const specF = P.fields.filter(f => f.k === P.spec || f.k === 'ref');
  let vals = null;
  const body = `<div class="form">
      <div class="f"><label for="li-disc">${tr('Έκπτωση %', 'Discount %')}</label><input id="li-disc" type="number" min="0" max="100" step="0.5" value="${esc(it.disc || '')}" placeholder="0"></div>
      <div class="f"><label for="li-vat">${tr('ΦΠΑ % της γραμμής', 'Line VAT %')}</label><input id="li-vat" type="number" min="0" max="100" value="${esc(it.vat ?? '')}" placeholder="${tr('όπως το έγγραφο', 'as the document')} (${esc(d.vat)}%)"></div>
      <div class="f wide" style="align-self:end"><label class="chk"><input type="checkbox" id="li-opt" ${it.opt ? 'checked' : ''}> ${tr('Προαιρετική γραμμή (φαίνεται στο έγγραφο αλλά δεν μετρά στο σύνολο)', 'Optional line (shown on the document but not counted in the total)')}</label></div></div>
    <div class="sub-h">${E.one}</div>
    <label class="chk" style="margin:0 0 10px"><input type="checkbox" id="li-on" ${m.on || (focus === 'eq' && !it.m) ? 'checked' : ''}> ${tr(`Η γραμμή είναι ${E.a} που θα καταχωρηθεί στον πελάτη`, `This line is ${/^[aeiou]/i.test(E.a) ? 'an' : 'a'} ${E.a} to be registered to the client`)}</label>
    <div class="form" id="li-eq"><div class="f"><label for="li-brand">${tr(isHvac() ? 'Μάρκα' : 'Κατασκευαστής', isHvac() ? 'Brand' : 'Manufacturer')}</label><input id="li-brand" list="li-brands" value="${esc(m.brand || p.brand || '')}">${brandList(P, 'li-brands')}</div>
      <div class="f"><label for="li-kind">${tr(P.kinds ? 'Τύπος' : 'Περιγραφή / τύπος', P.kinds ? 'Type' : 'Description / type')}</label>${kindInput(P, m.kind || p.kind || '', 'li-kind')}</div>
      ${specF.map(f => fieldInput(f, m[f.k] ?? p[f.k] ?? '', 'li-f-' + f.k)).join('')}<div class="f"><label for="li-model">${tr('Μοντέλο', 'Model')}</label><input id="li-model" value="${esc(m.model || '')}"></div></div>
    <label class="chk" style="margin-top:14px"><input type="checkbox" id="li-cat"> ${tr('Αποθήκευση της γραμμής στον κατάλογο (περιγραφή, μονάδα, τιμή, ΦΠΑ)', 'Save the line to the catalogue (description, unit, price, VAT)')}</label>`;
  const r = await modal({ title: tr('Γραμμή ', 'Line ') + (d.items.indexOf(it) + 1), body,
    actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }, { label: tr('Εφαρμογή', 'Apply'), value: 'ok', cls: 'blue', validate: mb => { const v = id => ($('#' + id, mb)?.value || '').trim();
      vals = { disc: v('li-disc'), vat: v('li-vat'), opt: $('#li-opt', mb).checked, on: $('#li-on', mb).checked, brand: v('li-brand'), kind: v('li-kind'), model: v('li-model'), cat: $('#li-cat', mb).checked, f: {} };
      for (const f of specF) vals.f[f.k] = fieldValue(f, $('#li-f-' + f.k, mb)); return true; } }],
    onOpen: mb => { const sync = () => $('#li-eq', mb).style.opacity = $('#li-on', mb).checked ? 1 : .45; $('#li-on', mb).onchange = sync; sync(); if (focus === 'eq') $('#li-brand', mb).focus(); } });
  if (r !== 'ok' || !vals) return;
  it.disc = vals.disc === '' ? '' : clampPct(vals.disc);
  it.vat = vals.vat === '' ? '' : clampPct(vals.vat);
  if (vals.opt) it.opt = true; else delete it.opt;
  it.m = vals.on ? { on: true, auto: false, brand: vals.brand, kind: vals.kind, model: vals.model, ...vals.f } : { on: false, auto: false };
  if (it.m.ref) it.m.ref = refKey(it.m.ref);
  if (vals.cat) {
    if (!it.t.trim()) toast(tr('Η γραμμή χρειάζεται περιγραφή για τον κατάλογο', 'The line needs a description for the catalogue'));
    else { const C = DB.settings.catalog, en = d.lang === 'en', key = it.t.trim().toLowerCase(), ex = C.find(x => (en ? (x.te || '') : x.t).trim().toLowerCase() === key);
      const base = { u: it.u || 'τεμ.', p: num(it.p), vat: it.vat ?? '' };
      if (ex) Object.assign(ex, base, en ? { te: it.t.trim(), se: it.s || '' } : { t: it.t.trim(), s: it.s || '' });
      else C.push({ id: uid(), t: en ? '' : it.t.trim(), s: en ? '' : it.s || '', te: en ? it.t.trim() : '', se: en ? it.s || '' : '', ...base, ...(en ? { t: it.t.trim() } : {}) });
      persistSettings(); toast(ex ? tr('Ενημερώθηκε στον κατάλογο', 'Updated in the catalogue') : tr('Αποθηκεύτηκε στον κατάλογο', 'Saved to the catalogue')); }
  }
  renderItems(d); calc(); persistDoc(d);
}
/* a catalogue entry as a document line, in the language of the document */
const catalogRow = (it, d) => ({ t: d.lang === 'en' ? (it.te || it.t) : it.t, s: d.lang === 'en' ? (it.se || it.s || '') : (it.s || ''), q: 1, u: it.u || 'τεμ.', p: num(it.p), vat: it.vat ?? '' });
function catalogPicker() {
  return new Promise(resolve => {
    const C = DB.settings.catalog; let chosen = null;
    if (!C.length) { modal({ title: tr('Κατάλογος', 'Catalogue'), body: tr('<p>Ο κατάλογος είναι άδειος.</p><p class="note">Για να προσθέσετε: στη γραμμή ενός εγγράφου πατήστε «⋯» και τσεκάρετε «Αποθήκευση στον κατάλογο», ή από Ρυθμίσεις → Κατάλογος (και εισαγωγή από CSV).</p>', '<p>The catalogue is empty.</p><p class="note">To add entries: on a document line press “⋯” and tick “Save to the catalogue”, or go to Settings → Catalogue (CSV import too).</p>'), actions: [{ label: tr('Κλείσιμο', 'Close'), value: null }] }).then(() => resolve(null)); return; }
    modal({ title: tr('Από τον κατάλογο', 'From the catalogue'), body: `<input class="inp" id="ct-q" placeholder="${tr('Αναζήτηση', 'Search')}" aria-label="${tr('Αναζήτηση στον κατάλογο', 'Search the catalogue')}"><div class="pick" id="ct"></div>`, actions: [{ label: tr('Άκυρο', 'Cancel'), value: null }],
      onOpen: (mb, close) => {
        const draw = () => { const ql = $('#ct-q', mb).value.toLowerCase(); const list = C.filter(x => !ql || [x.t, x.s, x.te, x.se].join(' ').toLowerCase().includes(ql)).sort((a, b) => a.t.localeCompare(b.t, 'el'));
          $('#ct', mb).innerHTML = list.map(x => `<button type="button" data-id="${x.id}"><b>${esc(DL === 'en' ? (x.te || x.t) : x.t)}</b>${DL !== 'en' && x.te && UIL === 'en' ? `<span class="mut"> · ${esc(x.te)}</span>` : ''}<span class="mut"> · ${eur(num(x.p))} / ${esc(x.u)}${x.vat !== '' && x.vat != null ? ' · ' + tr('ΦΠΑ', 'VAT') + ' ' + esc(x.vat) + '%' : ''}</span></button>`).join('') || `<div class="empty">${tr('Δεν βρέθηκε.', 'Nothing found.')}</div>`;
          $$('#ct button', mb).forEach(b => b.onclick = () => { chosen = C.find(x => x.id === b.dataset.id); close(null); }); };
        $('#ct-q', mb).oninput = draw; draw();
      } }).then(() => resolve(chosen));
  });
}
function renderTerms(d) {
  const ol = $('#terms'); ol.querySelectorAll('li.x').forEach(li => li.remove());
  const lock = d.issued && !UNLOCK.has(d.id);
  d.extra.forEach((t, i) => {
    const li = document.createElement('li'); li.className = 'x' + (t.trim() ? '' : ' empty');
    const sp = document.createElement('span'); sp.dataset.ph = tr('νέος όρος', 'new term'); sp.textContent = t; sp.style.minWidth = '40mm';
    if (!lock) { sp.contentEditable = 'true';
      sp.oninput = () => { d.extra[i] = textOf(sp); li.classList.toggle('empty', !d.extra[i].trim()); persistDoc(d); };
      sp.onblur = () => { if (!d.extra[i]?.trim()) { d.extra.splice(i, 1); renderTerms(d); persistDoc(d); } }; }
    li.appendChild(sp); ol.appendChild(li);
  });
}
function calc() {
  const d = cur; if (!d) return;
  if (d.type === 'contract') return calcContract();
  if (d.type === 'ticket') return;
  useDocLang(d);
  const t = totals(d), anyDisc = d.items.some(it => clampPct(it.disc) > 0), mixed = t.vatBy.length > 1 || d.items.some(it => it.vat !== '' && it.vat != null && num(it.vat) !== num(d.vat));
  $$('#items tr').forEach((r, i) => { const it = d.items[i]; if (!it) return; const dc = clampPct(it.disc);
    $('[data-o=line]', r).textContent = it.p === '' ? '' : deur(lineNet(it));
    $('[data-o=disc]', r).textContent = dc ? `${dt('έκπτωση', 'discount')} ${dpct(dc)}%` : '';
    $('[data-o=lvat]', r).textContent = mixed ? `${dt('ΦΠΑ', 'VAT')} ${dpct(lineRate(d, it))}%` : ''; });
  $('#sums').innerHTML = (anyDisc ? `<div><span>${dt('Αξία', 'Amount')}</span><span class="num">${deur(t.gross)}</span></div><div><span>${dt('Έκπτωση', 'Discount')}</span><span class="num">−${deur(t.disc)}</span></div>` : '')
    + `<div><span>${dt('Καθαρή αξία', 'Net amount')}</span><span class="num">${deur(t.net)}</span></div>` + t.vatBy.map(v => `<div><span>${dt('ΦΠΑ', 'VAT')} ${dpct(v.r)}%</span><span class="num">${deur(v.v)}</span></div>`).join('')
    + `<div class="g"><span>${dt('Σύνολο', 'Total')}</span><span class="num">${deur(t.tot)}</span></div>`;
  const vu = validUntil(d), adv = num(d.adv), balp = Math.round((100 - adv) * 100) / 100, offer = d.type === 'offer';
  const out = { tot: deur(t.tot), advv: deur(t.advv), bal: deur(t.bal), advp: dpct(d.adv), balp: dpct(balp),
    date: ddate(d.date), valid: ddate(vu), no: d.issued ? d.no : nextNo(d.type, isDemoDoc(d)),
    vatterm: mixed ? dt('Οι τιμές μονάδας είναι χωρίς ΦΠΑ· ο ΦΠΑ υπολογίζεται επί της καθαρής αξίας με τον συντελεστή που αναγράφεται σε κάθε γραμμή.', 'Unit prices exclude VAT; VAT is calculated on the net amount at the rate shown on each line.') : dt(`Οι τιμές μονάδας είναι χωρίς ΦΠΑ· ο ΦΠΑ ${dpct(d.vat)}% υπολογίζεται επί της καθαρής αξίας.`, `Unit prices exclude VAT; VAT at ${dpct(d.vat)}% is calculated on the net amount.`),
    advterm: offer ? dt(`Για την αποδοχή της προσφοράς απαιτείται προκαταβολή ${dpct(d.adv)}% της συνολικής αξίας.`, `Acceptance of this quotation requires an advance payment of ${dpct(d.adv)}% of the total amount.`) : dt(`Απαιτείται προκαταβολή ${dpct(d.adv)}% της συνολικής αξίας.`, `An advance payment of ${dpct(d.adv)}% of the total amount is required.`),
    balterm: dt(`Το υπόλοιπο ${dpct(balp)}% εξοφλείται με την παράδοση και ολοκλήρωση ${offer ? 'του έργου' : 'των εργασιών'}.`, `The remaining ${dpct(balp)}% is payable on delivery and completion of the ${offer ? 'project' : 'work'}.`),
    validterm: dt(`${offer ? 'Η προσφορά' : 'Το προτιμολόγιο'} ισχύει για ${d.days} ημέρες από την ημερομηνία έκδοσης.`, `This ${offer ? 'quotation' : 'proforma invoice'} is valid for ${d.days} days from the date of issue.`),
    durterm: num(d.dur) ? dt(`Χρόνος ολοκλήρωσης: ${d.dur} ${durUnit(d.dur, d.durU)} από ${adv ? 'την καταβολή της προκαταβολής' : 'την αποδοχή'}.`, `Completion time: ${d.dur} ${durUnit(d.dur, d.durU)} from ${adv ? 'receipt of the advance payment' : 'acceptance'}.`) : '',
    optterm: d.items.some(i => i.opt) ? dt('Οι προαιρετικές γραμμές δεν περιλαμβάνονται στο σύνολο και προστίθενται μόνο αν τις επιλέξει ο πελάτης.', 'Optional lines are not included in the total and are added only if the client chooses them.') : '' };
  $$('[data-out]').forEach(el => el.textContent = out[el.dataset.out] ?? '');
  $$('[data-adv]').forEach(el => el.hidden = !adv);
  $$('.to .opt').forEach(o => o.classList.toggle('empty', !String(d.cl[o.dataset.o] || '').trim()));
  $$('.to .ln').forEach(l => l.classList.toggle('empty', !$$('.opt:not(.empty)', l).length));
  $('#t-dur').hidden = !num(d.dur); $('#t-opt').hidden = !d.items.some(i => i.opt);
  if ($('#e-valid')) { $('#e-valid').value = vu; $('#e-valid').min = d.date; }
  requestAnimationFrame(() => { const p = $('#page'); if (!p) return; const extra = $$('.page .so,.page .addrow,.page .mwrap', p).reduce((a, b) => a + b.offsetHeight, 0); $('#ovf').hidden = p.scrollHeight - extra <= 1125; });
}

/* ================================================================== conversions */
function offerToProforma(d) {
  persistDoc(d, true);
  if (d.issued && (d.status || 'sent') === 'sent') { d.status = 'accepted'; d.statusAt = todayISO(); persistDoc(d, true); }
  openNewDoc('proforma', { ...copyOf(d), items: d.items.filter(i => !i.opt), from: { id: d.id, type: d.type, no: d.issued ? d.no : '' } });
  toast(tr('Νέο πρόχειρο προτιμολόγιο με τα στοιχεία της προσφοράς', 'New draft proforma invoice with the details of the quotation') + (d.issued ? tr(' · η προσφορά σημειώθηκε αποδεκτή', ' · the quotation was marked accepted') : '') + (d.items.some(i => i.opt) ? tr(' · οι προαιρετικές γραμμές παραλείφθηκαν', ' · optional lines were left out') : ''));
}
async function proformaToContract(d) {
  let c = d.clientId ? DB.clients.find(x => x.id === d.clientId) : null;
  let ap = afmProblem(d.cl.afm, c ? c.id : null);
  if (!c && ap?.dup && ap.dup.name.trim().toLowerCase() === d.cl.name.trim().toLowerCase()) { c = ap.dup; d.clientId = c.id; ap = null; }
  const problem = !d.cl.name.trim() ? tr('Συμπληρώστε πρώτα την επωνυμία του πελάτη στο «Προς».', 'First fill in the client name under “To”.') : ap ? ap.msg + (ap.dup ? tr(' Συνδέστε το έγγραφο με αυτόν τον πελάτη ή διορθώστε το ΑΦΜ.', ' Link the document to this client or correct the tax number.') : tr(' Διορθώστε το ΑΦΜ στο «Προς».', ' Correct the tax number under “To”.')) : '';
  if (problem) {
    const r = await modal({ title: tr('Μετατροπή σε συμβόλαιο', 'Convert to agreement'), body: `<p>${tr('Για το συμβόλαιο χρειάζεται πελάτης με έγκυρο ΑΦΜ.', 'An agreement needs a client with a valid tax number.')}</p><div class="errbox">${esc(problem)}</div>`,
      actions: [{ label: tr('Κλείσιμο', 'Close'), value: null }, ...(ap?.dup && d.cl.name.trim() ? [{ label: tr(`Σύνδεση με «${ap.dup.name}»`, `Link to “${ap.dup.name}”`), value: 'link', cls: 'blue' }] : [])] });
    if (r === 'link') { d.clientId = ap.dup.id; d.cl = pickCl(ap.dup); persistDoc(d, true); return proformaToContract(d); }
    return;
  }
  c = upsertClient(d);
  const added = pushMachines(d, c);
  persistDoc(d, true); q(() => saveClient(c)); await chain;
  const mids = c.machines.filter(m => m.source?.docId === d.id).map(m => m.id);
  const nc = newContract(c, { from: { id: d.id, type: d.type, no: d.issued ? d.no : '' }, vat: d.vat, demo: d.demo, lang: d.lang });
  nc.machineIds = mids.length ? mids : c.machines.map(m => m.id);
  go('doc', nc.id);
  toast(mids.length ? tr(`Νέο πρόχειρο συμβόλαιο με ${plural(mids.length, EQ().a, EQ().as)} από το προτιμολόγιο${added ? ' (καταχωρήθηκαν στον πελάτη)' : ''}`, `New draft agreement with ${plural(mids.length, EQ().a, EQ().as)} from the proforma invoice${added ? ' (registered to the client)' : ''}`) : tr(`Νέο πρόχειρο συμβόλαιο · επιλέξτε ή προσθέστε ${EQ().as}`, `New draft agreement · choose or add ${EQ().as}`));
}

/* ================================================================== explicit actions */
async function saveNow(d) { cancelLater('d' + d.id); await q(() => saveDoc(d)); toast(tr('Αποθηκεύτηκε στο ', 'Saved in ') + d.dir + ' / ' + d.file); }
async function deleteDoc(d) {
  if (d.issued) return false;
  if (!(await confirmBox(tr('Διαγραφή πρόχειρου', 'Delete draft'), tr('Να διαγραφεί το πρόχειρο;', 'Delete this draft?')))) return false;
  return removeDoc(d);
}
async function removeDoc(d) {
  DB.docs = DB.docs.filter(x => x !== d); cancelLater('d' + d.id);
  if (d.file) await q(() => delFile(d.dir, d.file));
  if (cur === d) cur = null;
  toast(tr('Διαγράφηκε', 'Deleted')); return true;
}
async function hardDelete(d) {
  let ok = false;
  await modal({ title: tr('Οριστική διαγραφή', 'Permanent deletion'), body: tr(`<p>Το <b>${esc(d.no)}</b> έχει εκδοθεί. Η σωστή πρακτική είναι η <b>ακύρωση</b>, ώστε να μένει ίχνος και να μη «χαθεί» αριθμός.</p><p>Αν πρόκειται για λάθος δοκιμή, γράψτε τον αριθμό για επιβεβαίωση:</p>`, `<p><b>${esc(d.no)}</b> has been issued. Good practice is to <b>cancel</b> it, so a trace remains and no number goes missing.</p><p>If it was a mistaken test, type the number to confirm:</p>`) + `<input class="inp" id="hd" placeholder="${esc(d.no)}" aria-label="${tr('Αριθμός εγγράφου', 'Document number')}">`,
    actions: [{ label: tr('Πίσω', 'Back'), value: null }, { label: tr('Οριστική διαγραφή', 'Delete permanently'), value: 'x', cls: 'danger', validate: mb => { ok = $('#hd', mb).value.trim() === d.no; if (!ok) toast(tr('Ο αριθμός δεν ταιριάζει', 'The number does not match')); return ok; } }] });
  return ok ? removeDoc(d) : false;
}
async function cancelDoc(d) {
  let reason = '';
  const r = await modal({ title: tr('Ακύρωση ', 'Cancel ') + esc(d.no), body: tr('<p>Το έγγραφο μένει στον φάκελο με την ένδειξη <b>ΑΚΥΡΩΘΗΚΕ</b> και δεν μετρά σε ανεξόφλητα και αναμονές. Ο αριθμός δεν ξαναδίνεται.</p>', '<p>The document stays in the folder marked <b>CANCELLED</b> and no longer counts as unpaid or pending. The number is not reused.</p>') + `<div class="f" style="margin-top:10px"><label for="cx-r">${tr('Λόγος (προαιρετικά)', 'Reason (optional)')}</label><input id="cx-r" placeholder="${tr('π.χ. λάθος ποσό, νέο έγγραφο ΠΡ-…', 'e.g. wrong amount, new document ΠΡ-…')}"></div>`,
    actions: [{ label: tr('Πίσω', 'Back'), value: null }, { label: tr('Ακύρωση εγγράφου', 'Cancel document'), value: 'x', cls: 'danger', validate: mb => { reason = $('#cx-r', mb).value.trim(); return true; } }] });
  if (r !== 'x') return;
  d.cancelled = { at: todayISO(), reason }; persistDoc(d, true);
  d.type === 'contract' ? viewContract(d) : viewDoc(d.id);
  const again = await confirmBox(tr('Νέο έγγραφο;', 'New document?'), tr('Θέλετε να φτιαχτεί αντίγραφο ως νέο πρόχειρο για τη διόρθωση;', 'Create a copy as a new draft for the correction?'), tr('Ναι, νέο πρόχειρο', 'Yes, new draft'), 'blue');
  if (again) { if (d.type === 'contract') { const c = DB.clients.find(x => x.id === d.clientId); const nc = newContract(c, contractCopy(d)); go('doc', nc.id); } else openNewDoc(d.type, copyOf(d)); }
}
function rowActions(d) { return `<td class="r acts"><button class="btn sm" type="button" data-pdf="${d.id}" title="${d.issued ? tr('PDF / Εκτύπωση', 'PDF / Print') : tr('Έκδοση & PDF', 'Issue & PDF')}">PDF</button>${d.issued ? '' : `<button class="btn sm danger" type="button" data-del="${d.id}" title="${tr('Διαγραφή πρόχειρου', 'Delete draft')}" aria-label="${tr('Διαγραφή πρόχειρου', 'Delete draft')}">✕</button>`}</td>`; }
function bindRowActions(redraw) {
  $$('[data-pdf]').forEach(b => b.onclick = e => { e.stopPropagation(); const d = DB.docs.find(x => x.id === b.dataset.pdf); go('doc', d.id); setTimeout(() => $('#b-pdf')?.click(), 250); });
  $$('[data-del]').forEach(b => b.onclick = async e => { e.stopPropagation(); const d = DB.docs.find(x => x.id === b.dataset.del); if (await deleteDoc(d)) redraw(); });
}

/* email text in the language of the document: the PDF is attached by hand (the browser cannot attach files to an email) */
function emailDialog(d) {
  const S = DB.settings, saved = DL; useDocLang(d);
  const iss = issFor(d.iss || S.iss), B = brandFor(S.brand), t = totals(d);
  const what = { offer: dt('την προσφορά', 'the quotation'), proforma: dt('το προτιμολόγιο', 'the proforma invoice'), contract: dt('το συμβόλαιο συντήρησης', 'the maintenance agreement'), ticket: dt('το δελτίο παραλαβής', 'the intake receipt') }[d.type];
  const no = d.issued ? d.no : '';
  const accts = (d.accounts || S.accounts).filter(a => a.iban);
  const lines = [dt('Καλησπέρα σας,', 'Dear Sir or Madam,'), '', dt(`σας στέλνουμε συνημμένα ${what}${no ? ' ' + no : ''}${d.type === 'contract' && d.start ? ` για την περίοδο ${ddate(d.start)} – ${ddate(contractEnd(d))}` : ''}.`, `Please find attached ${what}${no ? ' ' + no : ''}${d.type === 'contract' && d.start ? ` for the period ${ddate(d.start)} – ${ddate(contractEnd(d))}` : ''}.`), '', `${dt('Σύνολο με ΦΠΑ', 'Total incl. VAT')}: ${deur(t.tot)}`];
  if (d.type === 'offer') lines.push(dt(`Η προσφορά ισχύει έως ${ddate(validUntil(d))}.`, `The quotation is valid until ${ddate(validUntil(d))}.`));
  if (d.type !== 'offer' && num(d.adv) && !paidOf(d)) lines.push(`${dt('Προκαταβολή', 'Advance')} ${dpct(d.adv)}%: ${deur(t.advv)}`);
  if (paidOf(d) && balanceOf(d) > 0.005) lines.push(`${dt('Υπόλοιπο προς εξόφληση', 'Balance due')}: ${deur(balanceOf(d))}`);
  if (accts.length && d.type !== 'offer') { lines.push('', dt('Στοιχεία πληρωμής:', 'Payment details:')); accts.forEach(a => lines.push(`${a.bank}: ${a.iban}`)); if (no) lines.push(`${dt('Αιτιολογία', 'Reference')}: ${no}`); }
  lines.push('', dt('Για οποιαδήποτε διευκρίνιση είμαστε στη διάθεσή σας.', 'Please do not hesitate to contact us with any questions.'), '', dt('Με εκτίμηση,', 'Kind regards,'), iss.name, ...(B.name && B.name !== iss.name ? [B.name] : []), ...[iss.tel, iss.email].filter(Boolean));
  const subject = `${dttl(d.type)}${no ? ' ' + no : ''} · ${B.name || iss.name}`, body = lines.join('\n');
  DL = saved;
  mailModal(tr('Κείμενο για email', 'Email text'), d.cl.email, subject, body);
}
function mailModal(title, to, subject, body) {
  modal({ title, wide: true, body: `<div class="f"><label for="em-to">${tr('Προς', 'To')}</label><input id="em-to" value="${esc(to)}"></div><div class="f" style="margin-top:10px"><label for="em-s">${tr('Θέμα', 'Subject')}</label><input id="em-s" value="${esc(subject)}"></div>
      <div class="f" style="margin-top:10px"><label for="em-b">${tr('Κείμενο', 'Text')}</label><textarea id="em-b" style="min-height:260px">${esc(body)}</textarea></div><p class="note" style="margin-top:10px">${tr('Επισυνάψτε το PDF του εγγράφου στο μήνυμα (ο browser δεν μπορεί να το επισυνάψει αυτόματα).', 'Attach the PDF of the document to the message (the browser cannot attach it automatically).')}</p>`,
    actions: [{ label: tr('Κλείσιμο', 'Close'), value: null }, '|', { label: tr('Αντιγραφή κειμένου', 'Copy text'), value: null, validate: async mb => { try { await navigator.clipboard.writeText($('#em-s', mb).value + '\n\n' + $('#em-b', mb).value); toast(tr('Αντιγράφηκε', 'Copied')); } catch (e) { $('#em-b', mb).select(); document.execCommand('copy'); toast(tr('Αντιγράφηκε', 'Copied')); } return false; } },
      { label: tr('Άνοιγμα στο email', 'Open in email'), value: null, cls: 'blue', validate: mb => { location.href = `mailto:${encodeURIComponent($('#em-to', mb).value.trim())}?subject=${encodeURIComponent($('#em-s', mb).value)}&body=${encodeURIComponent($('#em-b', mb).value)}`; return true; } }] });
}

/* ================================================================== issuing + printing */
async function issueDialog(d) {
  if (d.type === 'contract') return issueContract(d);
  if (d.type === 'ticket') return issueTicket(d);
  const demo = isDemoDoc(d), no = nextNo(d.type, demo);
  let c = d.clientId ? DB.clients.find(x => x.id === d.clientId) : null;
  let ap = afmProblem(d.cl.afm, c ? c.id : null);
  if (!c && ap?.dup && ap.dup.name.trim().toLowerCase() === d.cl.name.trim().toLowerCase()) { c = ap.dup; d.clientId = c.id; ap = null; }
  const mcount = d.type === 'proforma' ? d.items.filter(i => i.m?.on && !i.opt).reduce((a, i) => a + Math.max(1, Math.round(num(i.q)) || 1), 0) : 0;
  const empty = !d.items.some(i => (i.t || '').trim() && num(i.p));
  const missing = !d.cl.name.trim() ? tr('Συμπληρώστε πρώτα την επωνυμία του πελάτη στο «Προς».', 'First fill in the client name under “To”.') : ap ? ap.msg + (ap.dup ? tr(' Συνδέστε το έγγραφο με αυτόν τον πελάτη ή διορθώστε το ΑΦΜ στο «Προς».', ' Link the document to this client or correct the tax number under “To”.') : tr(' Διορθώστε το ΑΦΜ στο «Προς».', ' Correct the tax number under “To”.')) : empty ? tr('Το έγγραφο δεν έχει γραμμή με περιγραφή και τιμή.', 'The document has no line with a description and a price.') : '';
  const r = await modal({ title: `${tr('Έκδοση', 'Issue')} ${ttl(d.type).toLowerCase()}`,
    body: missing ? `<div class="errbox">${esc(missing)}</div>` :
      `<p>${tr(`Το έγγραφο θα πάρει τον αριθμό <b style="color:var(--navy)">${no}</b> και θα αποθηκευτεί στον φάκελο ${TYPES[d.type].dir}. Μετά την έκδοση κλειδώνει· για αλλαγές γίνεται ακύρωση και νέο έγγραφο.`, `The document will get the number <b style="color:var(--navy)">${no}</b> and be saved in the folder ${TYPES[d.type].dir}. After issuing it is locked; for changes, cancel it and make a new one.`)}</p>
       <ul style="margin:10px 0 0 18px"><li>${tr('Πελάτης', 'Client')}: <b>${esc(d.cl.name)}</b> — ${c ? tr('ενημέρωση στο πελατολόγιο', 'updated in the client book') : tr('νέα καταχώριση στο πελατολόγιο', 'new entry in the client book')}</li>${mcount ? `<li>${tr(`${plural(mcount, EQ().a, EQ().as)} θα καταχωρηθούν στον πελάτη`, `${plural(mcount, EQ().a, EQ().as)} will be registered to the client`)}</li>` : ''}<li>${tr('Σύνολο με ΦΠΑ', 'Total incl. VAT')}: <b>${eur(totals(d).tot)}</b></li><li>${tr('Γλώσσα εγγράφου', 'Document language')}: <b>${LANGS[d.lang]}</b></li></ul>
       ${demo ? `<p class="warnbox">${tr('Δεδομένα επίδειξης: παίρνει αριθμό ΔΕΙΓΜΑ και δεν επηρεάζει την κανονική αρίθμηση.', 'Demo data: it gets a DEMO number and does not affect normal numbering.')}</p>` : ''}
       <p class="mut" style="margin-top:12px;font-size:13px">${tr('Στο παράθυρο εκτύπωσης επιλέξτε «Αποθήκευση ως PDF». Το όνομα αρχείου προτείνεται αυτόματα.', 'In the print window choose “Save as PDF”. The file name is suggested automatically.')}</p>`,
    actions: [{ label: tr('Πρόχειρη εκτύπωση', 'Draft print'), value: 'draft' }, '|', { label: tr('Άκυρο', 'Cancel'), value: null }, ...(ap?.dup && d.cl.name.trim() ? [{ label: tr(`Σύνδεση με «${ap.dup.name}»`, `Link to “${ap.dup.name}”`), value: 'link', cls: 'blue' }] : []), ...(missing ? [] : [{ label: tr('Έκδοση & PDF', 'Issue & PDF'), value: 'issue', cls: 'blue' }])] });
  if (r === 'draft') return doPrint(true);
  if (r === 'link') { d.clientId = ap.dup.id; d.cl = pickCl(ap.dup); persistDoc(d, true); viewDoc(d.id); toast(tr('Το έγγραφο συνδέθηκε με τον πελάτη · πατήστε ξανά «Έκδοση & PDF»', 'The document was linked to the client · press “Issue & PDF” again')); return; }
  if (r !== 'issue') return;
  d.no = no; d.issued = true; d.issuedAt = todayISO(); if (demo) d.demo = true;
  if (d.type === 'offer') d.status = 'sent';
  d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban));
  const cl = upsertClient(d); const added = d.type === 'proforma' ? pushMachines(d, cl) : 0;
  cl.machines.forEach(m => { if (m.source?.docId === d.id) m.source.docNo = d.no; });
  persistDoc(d, true); q(() => saveClient(cl));
  await chain; UNLOCK.delete(d.id);
  viewDoc(d.id);
  toast(tr('Εκδόθηκε ', 'Issued ') + d.no + (added ? ` · ${plural(added, EQ().a, EQ().as)} ${tr('στον πελάτη', 'to the client')}` : ''));
  setTimeout(() => doPrint(false), 300);
}
let printing = false, savedTitle = '';
function doPrint(draft, title) {
  printing = true; document.body.classList.toggle('print-draft', !!draft);
  savedTitle = document.title;
  if (title) document.title = title;
  else if (cur) document.title = (cur.issued ? cur.no : 'ΠΡΟΧΕΙΡΟ_' + ttl(cur.type)) + '_' + (slug(cur.cl.name) || 'πελάτης');
  document.activeElement?.blur?.();
  setTimeout(() => window.print(), 50);
}
addEventListener('beforeprint', () => { if (!printing && view.name === 'doc' && cur && !cur.issued) document.body.classList.add('print-draft'); });
addEventListener('afterprint', () => { printing = false; document.body.classList.remove('print-draft'); if (savedTitle) { document.title = savedTitle; savedTitle = ''; } });

/* editing conveniences */
document.addEventListener('paste', e => { if (!e.target.closest || !e.target.closest('[contenteditable]')) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
document.addEventListener('keydown', e => { const el = e.target.closest && e.target.closest('[contenteditable]'); if (el && e.key === 'Enter' && !el.dataset.multi) { e.preventDefault(); el.blur(); } });

/* ================================================================== CSV for Excel (Greek: semicolon + decimal comma · English: comma + decimal point) */
function csv(name, head, rows) {
  const en = UIL === 'en', sep = en ? ',' : ';';
  const cell = v => { v = v == null ? '' : typeof v === 'number' ? v.toLocaleString(en ? 'en-US' : 'el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : String(v); return /[;,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  download(name, '﻿' + [head, ...rows].map(r => r.map(cell).join(sep)).join('\r\n'), 'text/csv;charset=utf-8');
  toast(tr('Το αρχείο αποθηκεύτηκε στις Λήψεις · ανοίγει με Excel', 'The file was saved to Downloads · it opens with Excel'));
}
function exportDocsCSV(list) {
  list = list || DB.docs.filter(d => SALES.includes(d.type));
  csv(`${tr('έγγραφα', 'documents')}_${todayISO()}.csv`, [tr('Αριθμός', 'Number'), tr('Τύπος', 'Type'), tr('Ημερομηνία', 'Date'), tr('Πελάτης', 'Client'), tr('ΑΦΜ', 'Tax no.'), tr('Καθαρή αξία', 'Net'), tr('ΦΠΑ', 'VAT'), tr('Σύνολο', 'Total'), tr('Πληρωμές', 'Payments'), tr('Υπόλοιπο', 'Balance'), tr('Κατάσταση', 'Status'), tr('Γλώσσα', 'Language'), tr('Δείγμα', 'Demo')],
    list.map(d => { const t = totals(d); return [d.issued ? d.no : tr('Πρόχειρο', 'Draft'), ttl(d.type), fmtDate(d.date), d.cl.name, d.cl.afm, t.net, t.vatv, t.tot, paidOf(d), payable(d) && d.type !== 'offer' ? balanceOf(d) : '', docState(d).l, d.lang === 'en' ? 'EN' : 'EL', d.demo ? tr('ναι', 'yes') : '']; }));
}
function exportClientsCSV() {
  csv(`${tr('πελάτες', 'clients')}_${todayISO()}.csv`, [tr('Επωνυμία', 'Name'), tr('Δραστηριότητα', 'Activity'), tr('ΑΦΜ', 'Tax no.'), tr('ΔΟΥ', 'Tax office'), tr('ΓΕΜΗ', 'GEMI'), tr('Διεύθυνση', 'Address'), tr('Τηλέφωνο', 'Phone'), 'Email', EQ().many, tr('Υπόλοιπο', 'Balance'), tr('Σημειώσεις', 'Notes')],
    DB.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'el')).map(c => [c.name, c.act, c.afm, c.doy, c.gemi, c.addr, c.tel, c.email, c.machines.length, clientBalance(c), c.notes]));
}
function exportPaymentsCSV() {
  const rows = DB.docs.flatMap(d => (d.payments || []).map(p => [fmtDate(p.date), d.no || tr('Πρόχειρο', 'Draft'), ttl(d.type), d.cl.name, num(p.amount), payMethodUI(p.method), p.note || '', d.cancelled ? tr('ακυρωμένο', 'cancelled') : ''])).sort((a, b) => a[0].split('.').reverse().join('').localeCompare(b[0].split('.').reverse().join('')));
  csv(`${tr('πληρωμές', 'payments')}_${todayISO()}.csv`, [tr('Ημερομηνία', 'Date'), tr('Έγγραφο', 'Document'), tr('Τύπος', 'Type'), tr('Πελάτης', 'Client'), tr('Ποσό', 'Amount'), tr('Τρόπος', 'Method'), tr('Σημείωση', 'Note'), ''], rows);
}
