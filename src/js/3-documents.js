/* ================================================================== home */
function homeData() {
  const t = todayISO(), y = t.slice(0, 4), ym = t.slice(0, 7);
  const live = DB.docs.filter(d => d.issued && !d.cancelled);
  const unpaid = live.filter(d => d.type !== 'offer' && payable(d) && balanceOf(d) > 0.005);
  const waiting = live.filter(d => d.type === 'offer' && docState(d).k === 'sent');
  const expiring = live.filter(d => d.type === 'contract' && contractState(d).k === 'soon');
  const visits = visitPlan().filter(v => !v.done && v.ym <= ym);
  const received = DB.docs.filter(d => !d.cancelled).flatMap(d => d.payments || []).filter(p => String(p.date).startsWith(y)).reduce((a, p) => a + num(p.amount), 0);
  return { unpaid, waiting, expiring, visits, received, y };
}
function viewHome() {
  const B = DB.settings.brand, H = homeData(), sum = (a, f) => a.reduce((s, d) => s + f(d), 0);
  const att = [
    ...H.visits.map(v => ({ k: v.ym < todayISO().slice(0, 7) ? 'bad' : 'warn', l: v.ym < todayISO().slice(0, 7) ? 'Καθυστερεί' : 'Αυτόν τον μήνα', t: `Επίσκεψη ${v.n}/${v.of} · ${v.doc.cl.name}`, s: `${ymLabel(v.ym)} · ${v.doc.no}`, go: ['doc', v.doc.id] })),
    ...H.waiting.filter(d => daysBetween(todayISO(), validUntil(d)) <= 7).map(d => ({ k: 'warn', l: 'Λήγει σε ' + plural(Math.max(0, daysBetween(todayISO(), validUntil(d))), 'ημέρα', 'ημέρες'), t: `Προσφορά ${d.no} · ${d.cl.name}`, s: `${eur(totals(d).tot)} · χωρίς απάντηση`, go: ['doc', d.id] })),
    ...H.expiring.map(d => ({ k: 'warn', l: 'Λήγει ' + fmtDate(contractEnd(d)), t: `Συμβόλαιο ${d.no} · ${d.cl.name}`, s: 'Ώρα για ανανέωση', go: ['doc', d.id] })),
    ...H.unpaid.filter(d => daysBetween(d.issuedAt || d.date, todayISO()) > 30).map(d => ({ k: 'bad', l: 'Ανεξόφλητο > 30 ημ.', t: `${TYPES[d.type].title} ${d.no} · ${d.cl.name}`, s: `Υπόλοιπο ${eur(balanceOf(d))}`, go: ['doc', d.id] })),
  ];
  const recent = DB.docs.filter(d => d.file).sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 7);
  const empty = !DB.docs.length && !DB.clients.length;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>${esc(B.name || DB.settings.iss.name || 'Αρχική')}</h2>
      <button class="btn" type="button" data-q="client">+ Πελάτης</button><button class="btn" type="button" data-q="offer">+ Προσφορά</button><button class="btn blue" type="button" data-q="proforma">+ Προτιμολόγιο</button></div>
    ${empty ? `<div class="card"><div class="empty"><b>Καλώς ήρθατε</b>Ξεκινήστε με «+ Προσφορά» ή «+ Πελάτης».<br>Θέλετε πρώτα να δείτε πώς δουλεύει; <button class="btn sm" type="button" id="b-demo" style="margin-left:6px">Φόρτωση δεδομένων επίδειξης</button></div></div>` : `
    <div class="tiles">
      <button class="tile" type="button" data-tile="unpaid"><span>Ανεξόφλητα</span><b class="num">${eur(sum(H.unpaid, balanceOf))}</b><small>${plural(H.unpaid.length, 'έγγραφο', 'έγγραφα')}</small></button>
      <button class="tile" type="button" data-tile="pending"><span>Προσφορές σε αναμονή</span><b class="num">${H.waiting.length}</b><small>${eur(sum(H.waiting, d => totals(d).tot))}</small></button>
      <button class="tile" type="button" data-tile="visits"><span>Επισκέψεις συντήρησης</span><b class="num">${H.visits.length}</b><small>για αυτόν τον μήνα ή εκκρεμείς</small></button>
      <button class="tile" type="button" data-tile="soon"><span>Συμβόλαια που λήγουν</span><b class="num">${H.expiring.length}</b><small>τις επόμενες 60 ημέρες</small></button>
      <div class="tile static"><span>Εισπράξεις ${H.y}</span><b class="num">${eur(H.received)}</b><small>από καταχωρημένες πληρωμές</small></div>
    </div>
    <div class="grid2" style="margin-top:16px"><div class="card section"><h3>Χρειάζονται προσοχή <span class="chip">${att.length}</span></h3>
        ${att.length ? `<div class="tablewrap"><table class="list"><tbody>${att.slice(0, 12).map((a, i) => `<tr class="click" data-att="${i}" tabindex="0"><td><b>${esc(a.t)}</b><span class="sub">${esc(a.s)}</span></td><td class="r"><span class="chip ${a.k}">${esc(a.l)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="note" style="margin:0">Όλα είναι εντάξει. Δεν υπάρχει κάτι που εκκρεμεί.</p>'}</div>
      <div class="card section"><h3>Πρόσφατα</h3>${recent.length ? `<div class="tablewrap"><table class="list"><tbody>${recent.map(d => `<tr class="click" data-id="${d.id}" tabindex="0"><td><span class="chip ${d.type}">${TYPES[d.type].title}</span></td><td class="nw"><b>${d.issued ? esc(d.no) : 'Πρόχειρο'}</b><span class="sub">${esc(d.cl.name || '—')}</span></td><td class="r">${chipOf(docState(d))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note" style="margin:0">—</p>'}</div></div>`}</div>`;
  $$('[data-q]').forEach(b => b.onclick = () => b.dataset.q === 'client' ? go('client', 'new') : openNewDoc(b.dataset.q));
  if ($('#b-demo')) $('#b-demo').onclick = loadDemo;
  $$('[data-att]').forEach(tr => tr.onclick = () => go(...att[+tr.dataset.att].go));
  $$('tr[data-id]').forEach(tr => tr.onclick = () => go('doc', tr.dataset.id));
  $$('[data-tile]').forEach(b => b.onclick = () => { const k = b.dataset.tile; if (k === 'unpaid' || k === 'pending') { filt.docs.t = k; go('docs'); } else { filt.contracts.t = k === 'visits' ? 'visits' : 'soon'; go('contracts'); } });
}

/* ================================================================== documents list */
const demoChip = x => x.demo ? ' <span class="chip demo">ΔΕΙΓΜΑ</span>' : '';
function viewDocs() {
  const f = filt.docs;
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>Έγγραφα</h2>
    <input class="search" id="q" type="search" placeholder="Αναζήτηση πελάτη ή αριθμού" value="${esc(f.q)}" aria-label="Αναζήτηση εγγράφων">
    <button class="btn sm" type="button" id="b-csv" title="Λίστα για Excel">⇩ CSV</button></div>
    <div class="vh" style="margin-top:-6px"><div class="seg" role="tablist">${[['all', 'Όλα'], ['offer', 'Προσφορές'], ['proforma', 'Προτιμολόγια'], ['pending', 'Σε αναμονή'], ['unpaid', 'Ανεξόφλητα'], ['draft', 'Πρόχειρα'], ['cancelled', 'Ακυρωμένα']].map(([k, l]) => `<button type="button" data-t="${k}" class="${f.t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>Αριθμός</th><th>Τύπος</th><th>Πελάτης</th><th>Ημερομηνία</th><th class="r">Σύνολο</th><th class="r">Υπόλοιπο</th><th>Κατάσταση</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const match = d => {
    const s = docState(d).k;
    return f.t === 'all' ? true : f.t === 'draft' ? !d.issued : f.t === 'cancelled' ? !!d.cancelled : f.t === 'pending' ? (d.type === 'offer' && s === 'sent')
      : f.t === 'unpaid' ? (payable(d) && d.type !== 'offer' && balanceOf(d) > 0.005) : d.type === f.t;
  };
  const rowsOf = () => { const ql = f.q.toLowerCase(); return DB.docs.filter(d => SALES.includes(d.type) && match(d) && (!ql || [d.no, d.cl.name, d.cl.afm].join(' ').toLowerCase().includes(ql)))
    .sort((a, b) => (b.issued ? b.date : b.updated).localeCompare(a.issued ? a.date : a.updated) || String(b.updated).localeCompare(String(a.updated))); };
  const draw = () => {
    const rows = rowsOf();
    $('#rows').innerHTML = rows.length ? rows.map(d => { const st = docState(d), bal = payable(d) && d.type !== 'offer' ? balanceOf(d) : null;
      return `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}" tabindex="0"><td><b>${d.issued ? esc(d.no) : '<span class="mut">—</span>'}</b></td><td><span class="chip ${d.type}">${TYPES[d.type].title}</span>${demoChip(d)}</td>
      <td>${d.cl.name ? esc(d.cl.name) : '<span class="mut">χωρίς πελάτη</span>'}</td><td class="num">${fmtDate(d.date)}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td>
      <td class="r num">${bal == null ? '<span class="mut">—</span>' : bal > 0.005 ? eur(bal) : '<span class="mut">0,00 €</span>'}</td><td>${chipOf(st)}</td>${rowActions(d)}</tr>`; }).join('')
      : `<tr><td colspan="8"><div class="empty"><b>${DB.docs.some(d => SALES.includes(d.type)) ? 'Κανένα έγγραφο με αυτά τα φίλτρα' : 'Δεν υπάρχουν ακόμα έγγραφα'}</b>Πατήστε «+ Νέο» πάνω δεξιά για προσφορά ή προτιμολόγιο.</div></td></tr>`;
    $$('#rows tr.click').forEach(tr => { tr.onclick = () => go('doc', tr.dataset.id); tr.onkeydown = e => { if (e.key === 'Enter') go('doc', tr.dataset.id); }; });
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
  $('#view').innerHTML = `<div class="view"><div class="vh"><h2>Πελάτες</h2>
    <input class="search" id="q" type="search" placeholder="Όνομα, ΑΦΜ, τηλέφωνο" value="${esc(f.q)}" aria-label="Αναζήτηση πελατών">
    <button class="btn sm" type="button" id="b-csv" title="Λίστα για Excel">⇩ CSV</button><button class="btn blue" id="b-nc" type="button">+ Νέος πελάτης</button></div>
    <div class="card"><div class="tablewrap"><table class="list"><thead><tr><th>Πελάτης</th><th>ΑΦΜ</th><th>Τηλέφωνο</th><th class="r">Έγγραφα</th><th class="r">${E.many}</th><th class="r">Υπόλοιπο</th></tr></thead><tbody id="rows"></tbody></table></div></div></div>`;
  const draw = () => {
    const ql = f.q.toLowerCase();
    const rows = DB.clients.filter(c => !ql || [c.name, c.afm, c.tel, c.email].join(' ').toLowerCase().includes(ql)).sort((a, b) => a.name.localeCompare(b.name, 'el'));
    $('#rows').innerHTML = rows.length ? rows.map(c => { const bal = clientBalance(c); return `<tr class="click" data-id="${c.id}" tabindex="0"><td><b>${esc(c.name)}</b>${demoChip(c)}<span class="sub">${esc(c.act || c.addr)}</span></td><td class="num">${esc(c.afm)}</td><td class="num">${esc(c.tel)}</td>
      <td class="r num">${DB.docs.filter(d => d.clientId === c.id && d.file).length}</td><td class="r num">${c.machines.length}</td><td class="r num">${bal > 0.005 ? `<b>${eur(bal)}</b>` : '<span class="mut">—</span>'}</td></tr>`; }).join('')
      : `<tr><td colspan="6"><div class="empty"><b>${DB.clients.length ? 'Δεν βρέθηκε πελάτης' : 'Το πελατολόγιο είναι άδειο'}</b>Οι πελάτες καταχωρούνται αυτόματα όταν εκδίδετε έγγραφο, ή με «+ Νέος πελάτης».</div></td></tr>`;
    $$('#rows tr.click').forEach(tr => { tr.onclick = () => go('client', tr.dataset.id); tr.onkeydown = e => { if (e.key === 'Enter') go('client', tr.dataset.id); }; });
  };
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  $('#b-nc').onclick = () => go('client', 'new');
  $('#b-csv').onclick = exportClientsCSV;
  draw();
}
const clientBalance = c => DB.docs.filter(d => d.clientId === c.id && payable(d) && d.type !== 'offer').reduce((a, d) => a + Math.max(0, balanceOf(d)), 0);

function viewClient(id) {
  const c = id === 'new' ? normClient({}) : DB.clients.find(x => x.id === id);
  if (!c) return go('clients');
  const E = EQ();
  const F = [['name', 'Επωνυμία / Ονοματεπώνυμο', 'wide req'], ['act', 'Δραστηριότητα', ''], ['afm', 'ΑΦΜ', 'req'], ['doy', 'ΔΟΥ', ''], ['gemi', 'ΓΕΜΗ', ''], ['addr', 'Διεύθυνση', ''], ['tel', 'Τηλέφωνο', ''], ['email', 'Email', '']];
  const bal = clientBalance(c);
  $('#view').innerHTML = `<div class="view"><button class="back" type="button" id="bk">← Πελάτες</button>
    <div class="vh"><h2 id="cn">${esc(c.name) || 'Νέος πελάτης'}</h2>${demoChip(c)}${bal > 0.005 ? `<span class="chip unpaid">Υπόλοιπο ${eur(bal)}</span>` : ''}
      <button class="btn" type="button" id="b-no">+ Προσφορά</button><button class="btn blue" type="button" id="b-np">+ Προτιμολόγιο</button>
      <div class="dd"><button class="btn ghost" type="button" id="b-more" aria-haspopup="menu" aria-label="Περισσότερα">⋯</button><div class="menu" hidden id="m-more"><button type="button" id="b-delc" style="color:var(--bad)">Διαγραφή πελάτη</button></div></div></div>
    <div class="grid2"><div class="stack">
      <div class="card section"><h3>Στοιχεία</h3><div class="form">${F.map(([k, l, cls]) => `<div class="f ${cls.includes('wide') ? 'wide' : ''} ${cls.includes('req') ? 'req' : ''}"><label for="c-${k}">${l}</label><input id="c-${k}" data-k="${k}" value="${esc(c[k])}"></div>`).join('')}
        <div class="f wide"><label for="c-notes">Σημειώσεις</label><textarea id="c-notes" data-k="notes">${esc(c.notes)}</textarea></div></div><div id="afmw"></div></div>
      <div class="card section"><h3>${E.many} <span class="chip" id="mcount">${c.machines.length}</span><span class="sp"></span><button class="btn sm" type="button" id="b-am">+ ${E.one}</button></h3>
        <p class="note">${isHvac() ? 'Τα μηχανήματα από τα προτιμολόγια μπαίνουν αυτόματα με την έκδοση. Προσθέστε και όσα έχει ήδη ο πελάτης.' : 'Ο εξοπλισμός από τα προτιμολόγια μπαίνει αυτόματα με την έκδοση (γραμμές σημαδεμένες ως εξοπλισμός). Προσθέστε και ό,τι έχει ήδη ο πελάτης.'}</p>
        <div class="tablewrap"><table class="list" id="mt"></table></div></div>
    </div><div class="stack">
      <div class="card section"><h3>Έγγραφα</h3><div id="cdocs"></div></div>
      <div class="card section"><h3>Συμβόλαια συντήρησης<span class="sp"></span><button class="btn sm" type="button" id="b-nk">+ Συμβόλαιο</button></h3><div id="ccons"></div></div>
    </div></div></div>`;
  $('#bk').onclick = () => go('clients');
  const problem = () => !c.name.trim() ? { msg: 'Η επωνυμία είναι υποχρεωτική.', field: 'name' } : afmProblem(c.afm, c.id);
  const showProblem = force => {
    const p = problem(), box = $('#afmw');
    $('#c-afm').classList.toggle('bad', !!p && p.field !== 'name' && (force || c.afm.trim().length > 0));
    $('#c-name').classList.toggle('bad', !!p && p.field === 'name' && force);
    if (p && (force || c.afm.trim() || p.dup)) {
      box.innerHTML = `<div class="errbox">${esc(p.msg)} ${p.dup ? '<button class="btn sm" type="button" id="b-goo">Άνοιγμα πελάτη</button>' : ''}<br><span>${DB.clients.includes(c) ? 'Οι αλλαγές δεν αποθηκεύονται μέχρι να διορθωθεί.' : 'Ο πελάτης δεν αποθηκεύεται μέχρι να διορθωθεί.'}</span></div>`;
      if (p.dup) $('#b-goo').onclick = () => go('client', p.dup.id);
    } else box.innerHTML = '';
    return !p;
  };
  const okToUse = () => { if (showProblem(true)) return true; toast('Διορθώστε πρώτα τα στοιχεία του πελάτη'); $(problem().field === 'name' ? '#c-name' : '#c-afm').focus(); return false; };
  $$('[data-k]').forEach(inp => inp.oninput = () => {
    c[inp.dataset.k] = inp.dataset.k === 'afm' ? inp.value.replace(/[^\d\s]/g, '') : inp.value;
    if (inp.dataset.k === 'afm' && inp.value !== c.afm) inp.value = c.afm;
    if (inp.dataset.k === 'name') $('#cn').textContent = inp.value || 'Νέος πελάτης';
    if (showProblem(false)) persistClient(c); else cancelLater('c' + c.id);
  });
  $('#c-afm').onblur = () => showProblem(c.afm.trim().length > 0);
  $('#c-afm').setAttribute('inputmode', 'numeric'); $('#c-afm').setAttribute('maxlength', '11');
  const drawM = () => {
    $('#mt').innerHTML = c.machines.length ? `<thead><tr><th>${E.one}</th><th>Θέση</th><th>Εγκατάσταση</th><th>Εγγύηση</th></tr></thead><tbody>${c.machines.map(m => `<tr class="click" data-id="${m.id}" tabindex="0"><td><b>${esc(machineLabel(m) || E.one)}</b>${m.serial ? `<span class="sub">S/N ${esc(m.serial)}</span>` : ''}</td><td>${esc(m.location) || '<span class="mut">—</span>'}</td><td class="num">${fmtDate(m.installed) || '—'}</td><td>${warrantyChip(m)}</td></tr>`).join('')}</tbody>`
      : `<tbody><tr><td><div class="empty" style="padding:22px">${E.none}</div></td></tr></tbody>`;
    $$('#mt tr.click').forEach(tr => tr.onclick = async () => { const m = c.machines.find(x => x.id === tr.dataset.id); const r = await machineForm(clone(m), { allowDelete: true });
      if (r === 'delete') { if (await confirmBox('Διαγραφή', `Να αφαιρεθεί ${isHvac() ? 'το μηχάνημα' : 'ο εξοπλισμός'} από τον πελάτη;`)) { c.machines = c.machines.filter(x => x !== m); persistClient(c, true); drawM(); } }
      else if (r && typeof r === 'object') { Object.assign(m, r); persistClient(c, true); drawM(); } });
    $('#mcount').textContent = c.machines.length;
  };
  $('#b-am').onclick = async () => { if (!okToUse()) return; const m = await machineForm({ id: uid() }); if (m && typeof m === 'object') { c.machines.push(m); persistClient(c, true); drawM(); } };
  const docs = DB.docs.filter(d => d.clientId === c.id && SALES.includes(d.type)).sort((a, b) => b.date.localeCompare(a.date));
  $('#cdocs').innerHTML = docs.length ? `<div class="tablewrap"><table class="list"><tbody>${docs.map(d => `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}"><td><span class="chip ${d.type}">${TYPES[d.type].title}</span></td><td><b>${d.issued ? esc(d.no) : 'Πρόχειρο'}</b><span class="sub">${fmtDate(d.date)}</span></td><td>${chipOf(docState(d))}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="note" style="margin:0">Δεν υπάρχουν έγγραφα για αυτόν τον πελάτη.</p>';
  $$('#cdocs tr.click').forEach(tr => tr.onclick = () => go('doc', tr.dataset.id));
  const cons = DB.docs.filter(d => d.clientId === c.id && d.type === 'contract').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  $('#ccons').innerHTML = cons.length ? `<div class="tablewrap"><table class="list"><tbody>${cons.map(d => `<tr class="click ${d.cancelled ? 'cx' : ''}" data-id="${d.id}"><td><b>${d.issued ? esc(d.no) : 'Πρόχειρο'}</b><span class="sub">${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}</span></td><td>${contractStatus(d)}</td><td class="r num"><b>${eur(totals(d).tot)}</b></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="note" style="margin:0">${c.machines.length ? 'Δεν υπάρχει συμβόλαιο. Πατήστε «+ Συμβόλαιο».' : `Προσθέστε πρώτα ${isHvac() ? 'τα μηχανήματα' : 'τον εξοπλισμό'} του πελάτη και μετά φτιάξτε συμβόλαιο.`}</p>`;
  $$('#ccons tr.click').forEach(tr => tr.onclick = () => go('doc', tr.dataset.id));
  $('#b-nk').onclick = () => { if (!okToUse()) return; persistClient(c, true); openContract(c); };
  const fromClient = () => ({ clientId: c.id, cl: pickCl(c) });
  $('#b-no').onclick = () => { if (!okToUse()) return; persistClient(c, true); openNewDoc('offer', fromClient()); };
  $('#b-np').onclick = () => { if (!okToUse()) return; persistClient(c, true); openNewDoc('proforma', fromClient()); };
  $('#b-more').onclick = e => { e.stopPropagation(); $('#m-more').hidden = !$('#m-more').hidden; };
  $('#b-delc').onclick = async () => {
    $('#m-more').hidden = true;
    const issued = DB.docs.filter(d => d.clientId === c.id && d.issued).length;
    if (!(await confirmBox('Διαγραφή πελάτη', `Να διαγραφεί ο πελάτης «${esc(c.name)}»;${issued ? ` Τα ${issued} εκδομένα έγγραφά του <b>δεν</b> διαγράφονται και κρατούν τα στοιχεία του.` : ''}`))) return;
    DB.clients = DB.clients.filter(x => x !== c); cancelLater('c' + c.id); if (c.file) q(() => delFile(DIRS.clients, c.file)); go('clients');
  };
  drawM();
  if (id === 'new') $('#c-name').focus(); else showProblem(false);
}

/* ================================================================== new documents */
function newDoc(type, from = {}) {
  const df = DB.settings.defaults;
  const d = normDoc(Object.assign({ id: uid(), type, issued: false, date: todayISO(), vat: df.vat, adv: df.adv, days: df.days, dur: '', durU: df.durU }, clone(from),
    { id: uid(), type, issued: false, no: '', issuedAt: '', status: undefined, cancelled: undefined, payments: [], date: todayISO(), dateManual: false, file: undefined, dir: undefined, created: new Date().toISOString(), updated: undefined }));
  delete d.iss; delete d.accounts;
  if (d.clientId && DB.clients.find(c => c.id === d.clientId)?.demo) d.demo = true;
  normDoc(d); DB.docs.push(d); return d;
}
function openNewDoc(type, from) { const d = newDoc(type, from); go('doc', d.id); }
const copyOf = d => ({ clientId: d.clientId, cl: d.cl, items: d.items, extra: d.extra, vat: d.vat, adv: d.adv, days: d.days, dur: d.dur, durU: d.durU, demo: d.demo });

/* ================================================================== sales document editor */
const UNLOCK = new Set();
function viewDoc(id) {
  const d = DB.docs.find(x => x.id === id); if (!d) return go('docs');
  if (d.type === 'contract') return viewContract(d);
  cur = d;
  if (!d.issued && !d.dateManual) d.date = todayISO();
  const S = DB.settings, iss = d.issued && d.iss ? d.iss : S.iss;
  const accts = (d.issued && d.accounts ? d.accounts : S.accounts).filter(a => a.bank || a.iban);
  const T = TYPES[d.type], lock = d.issued && !UNLOCK.has(d.id), ce = lock ? '' : 'contenteditable';
  $('#view').innerHTML = `<div class="subbar so">
      <button class="btn ghost sm" type="button" id="bk">← Έγγραφα</button>
      <div class="dt"><span class="chip ${d.type}">${T.title}</span><span id="st-no">${d.issued ? esc(d.no) : 'Πρόχειρο'}</span>${d.issued ? chipOf(docState(d)) : ''}${demoChip(d)}${relChips(d)}</div>
      <span class="sp"></span><span class="ovf" id="ovf" hidden>Ξεπερνά τη μία σελίδα A4</span>
      <div class="dd"><button class="btn" type="button" id="b-opt" aria-haspopup="menu">Επιλογές ⋯</button>
        <div class="menu panel" id="m-opt" hidden>
          ${lock ? '' : `${d.issued ? '' : `<div class="f"><label for="o-type">Τύπος εγγράφου</label><select id="o-type">${SALES.map(k => `<option value="${k}" ${k === d.type ? 'selected' : ''}>${TYPES[k].title}</option>`).join('')}</select></div>`}
          <div class="row2"><div class="f"><label for="o-vat">ΦΠΑ %</label><input id="o-vat" type="number" min="0" max="100" value="${esc(d.vat)}"></div>
          <div class="f"><label for="o-adv">Προκαταβολή %</label><input id="o-adv" type="number" min="0" max="100" value="${esc(d.adv)}"></div></div>
          <div class="row2"><div class="f"><label for="o-days">Ισχύς ημέρες</label><input id="o-days" type="number" min="0" value="${esc(d.days)}"></div>
          <div class="f"><label for="o-dur">Ολοκλήρωση</label><input id="o-dur" type="number" min="0" placeholder="–" value="${esc(d.dur)}"></div></div>
          <div class="f"><label for="o-durU">Μονάδα ολοκλήρωσης</label><select id="o-durU">${DUR_UNITS.map(u => `<option ${u === d.durU ? 'selected' : ''}>${u}</option>`).join('')}</select></div><hr>`}
          <button type="button" id="o-mail">Κείμενο για email</button>
          <button type="button" id="o-dup">Αντίγραφο ως νέο πρόχειρο</button>
          ${d.issued ? '' : '<button type="button" id="o-draft">Πρόχειρη εκτύπωση (χωρίς αριθμό)</button>'}
          ${d.issued && lock && !d.cancelled ? '<button type="button" id="o-unlock">Διόρθωση εκδομένου…</button>' : ''}
          ${d.issued ? '<hr><button type="button" id="o-hard" style="color:var(--bad)">Οριστική διαγραφή αρχείου…</button>' : ''}
        </div></div>
      ${d.cancelled ? '' : d.type === 'offer' ? '<button class="btn conv" type="button" id="b-conv" title="Νέο πρόχειρο προτιμολόγιο με τα στοιχεία της προσφοράς">→ Προτιμολόγιο</button>' : '<button class="btn conv" type="button" id="b-tocon" title="Νέο πρόχειρο συμβόλαιο με τον πελάτη και τον εξοπλισμό του προτιμολογίου">→ Συμβόλαιο</button>'}
      ${d.issued ? (d.cancelled ? '' : '<button class="btn danger" type="button" id="b-cancel">Ακύρωση</button>') : '<button class="btn danger" type="button" id="b-del">Διαγραφή</button><button class="btn" type="button" id="b-save">Αποθήκευση</button>'}
      <button class="btn blue" type="button" id="b-pdf">${d.issued ? 'PDF / Εκτύπωση' : 'Έκδοση & PDF'}</button>
    </div>
    <div class="wrap">${statusCard(d)}<div class="page ${lock ? 'locked' : ''}" id="page">
    <aside>
      <div class="logo">${lockup(S.brand)}</div>
      <div class="blk" title="${d.issued ? 'Στοιχεία κατά την έκδοση' : 'Αλλάζουν από τις Ρυθμίσεις'}"><div class="lbl">Εκδότης</div>${issuerBlock(iss)}</div>
      <div class="blk" title="${d.issued ? 'Στοιχεία κατά την έκδοση' : 'Αλλάζουν από τις Ρυθμίσεις'}"><div class="lbl">Πληρωμή</div>
        ${accts.map(a => `<div class="acct"><span class="k">${esc(a.bank)}</span><br><span class="iban">${esc(a.iban)}</span></div>`).join('')}
        <span class="k">Αιτιολογία:</span> <span data-out="no"></span></div>
      <div class="totalbox"><div class="lbl">Σύνολο με ΦΠΑ</div><div class="big num" data-out="tot"></div>
        <div class="split" data-adv><span>Προκαταβολή <span data-out="advp"></span>%</span><b class="num" data-out="advv"></b></div>
        <div class="split" data-adv><span>Εξόφληση <span data-out="balp"></span>%</span><b class="num" data-out="bal"></b></div></div>
      ${S.brand.credit ? creditHTML() : ''}
    </aside>
    <main>
      <div class="hA"><div><div class="eb">${T.label}</div><div class="hA-no"><span data-out="no"></span>${d.issued ? '' : '<span class="prov" title="Ο αριθμός οριστικοποιείται με την έκδοση">ΠΡΟΣΩΡΙΝΟΣ</span>'}</div></div>
        <div class="hA-r"><div><span class="t">ΗΜΕΡΟΜΗΝΙΑ</span>${lock ? '<span data-out="date"></span>' : '<label class="dp" title="Επιλογή ημερομηνίας"><span data-out="date"></span><input type="date" id="e-date" aria-label="Ημερομηνία έκδοσης"></label>'}</div>
        <div><span class="t">ΙΣΧΥΕΙ ΕΩΣ</span>${lock ? '<span data-out="valid"></span>' : '<label class="dp" title="Επιλογή λήξης ισχύος"><span data-out="valid"></span><input type="date" id="e-valid" aria-label="Ισχύει έως"></label>'}</div></div></div>
      <div class="lbl">Προς ${lock ? '' : `<button class="linkbtn so ${d.clientId ? 'ok' : ''}" type="button" id="b-pick">${d.clientId ? '✓ Από το πελατολόγιο · αλλαγή' : 'Επιλογή από πελατολόγιο'}</button>`}</div>
      <div class="to">
        <div class="nm2" ${ce} data-k="name" data-ph="Επωνυμία πελάτη"></div>
        <div class="ln"><span class="opt" data-o="act"><span class="mut" ${ce} data-k="act" data-ph="Δραστηριότητα"></span></span></div>
        <div class="ln"><span class="opt" data-o="addr"><span ${ce} data-k="addr" data-ph="Διεύθυνση"></span></span></div>
        <div class="ln"><span class="opt" data-o="afm">ΑΦΜ <span ${ce} data-k="afm" data-ph="ΑΦΜ"></span></span><span class="opt" data-o="doy">ΔΟΥ <span ${ce} data-k="doy" data-ph="ΔΟΥ"></span></span><span class="opt" data-o="gemi">ΓΕΜΗ <span ${ce} data-k="gemi" data-ph="ΓΕΜΗ"></span></span></div>
        <div class="ln mut"><span class="opt" data-o="tel"><span ${ce} data-k="tel" data-ph="τηλέφωνο"></span></span><span class="opt" data-o="email"><span ${ce} data-k="email" data-ph="email"></span></span></div>
      </div>
      <table><thead><tr><th style="width:7mm">#</th><th>ΠΕΡΙΓΡΑΦΗ</th><th class="c" style="width:15mm">ΠΟΣ.</th><th class="r" style="width:22mm">ΤΙΜΗ</th><th class="r" style="width:23mm">ΣΥΝΟΛΟ</th></tr></thead><tbody id="items"></tbody></table>
      ${lock ? '' : '<div class="addrows so"><button class="addrow" id="b-add" type="button">+ Προσθήκη γραμμής</button><button class="addrow" id="b-cat" type="button">+ Από κατάλογο</button></div>'}
      <div class="sums" id="sums"></div>
      <div class="terms"><div class="lbl">Όροι</div><ol id="terms">
        <li data-out="vatterm"></li>
        <li data-adv data-out="advterm"></li>
        <li data-adv>Το υπόλοιπο <span data-out="balp"></span>% εξοφλείται με την παράδοση και ολοκλήρωση ${d.type === 'offer' ? 'του έργου' : 'των εργασιών'}.</li>
        <li>${d.type === 'offer' ? 'Η προσφορά' : 'Το προτιμολόγιο'} ισχύει για <span data-out="days"></span> ημέρες από την ημερομηνία έκδοσης.</li>
        <li id="t-dur">Χρόνος ολοκλήρωσης: <b data-out="dur"></b> από ${num(d.adv) ? 'την καταβολή της προκαταβολής' : 'την αποδοχή'}.</li></ol>
        ${lock ? '' : '<button class="addrow so" id="b-term" type="button">+ Προσθήκη όρου</button>'}
        <div class="sign"><div>Για τον εκδότη</div><div>Αποδοχή πελάτη · υπογραφή / σφραγίδα</div></div>
        <div class="nofisc">Το παρόν δεν αποτελεί φορολογικό παραστατικό.</div></div>
    </main></div></div>`;
  setWM(d);
  const touch = () => { calc(); persistDoc(d); };
  $('#bk').onclick = () => go('docs');
  $$('.to [data-k]').forEach(el => { el.textContent = d.cl[el.dataset.k] || ''; if (!lock) el.oninput = () => { d.cl[el.dataset.k] = textOf(el); touch(); }; });
  if (!lock) {
    const de = $('#e-date'), ve = $('#e-valid');
    de.value = d.date;
    de.onchange = () => { if (de.value) { d.date = de.value; d.dateManual = true; touch(); } };
    ve.onchange = () => { if (!ve.value) return; const diff = daysBetween(d.date, ve.value); if (diff >= 0) { d.days = diff; if ($('#o-days')) $('#o-days').value = diff; touch(); } };
    [de, ve].forEach(i => i.onclick = () => { try { i.showPicker(); } catch (e) { } });
    $('#b-pick').onclick = async () => { const c = await clientPicker(); if (!c) return; d.clientId = c.id; d.cl = pickCl(c); if (c.demo) d.demo = true; persistDoc(d, true); viewDoc(d.id); };
    $('#b-add').onclick = () => { d.items.push(blankItem()); renderItems(d); touch(); $$('#items .it-t').pop().focus(); };
    $('#b-cat').onclick = async () => { const it = await catalogPicker(); if (!it) return; const last = d.items[d.items.length - 1]; const row = { t: it.t, s: it.s || '', q: 1, u: it.u || 'τεμ.', p: num(it.p), vat: it.vat ?? '' };
      if (last && !last.t && !num(last.p) && !last.s) d.items[d.items.length - 1] = row; else d.items.push(row); renderItems(d); touch(); };
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
  $('#o-dup').onclick = () => { persistDoc(d, true); openNewDoc(d.type, copyOf(d)); toast('Δημιουργήθηκε αντίγραφο ως νέο πρόχειρο'); };
  $('#o-mail').onclick = () => emailDialog(d);
  if ($('#o-unlock')) $('#o-unlock').onclick = async () => { if (await confirmBox('Διόρθωση εκδομένου', `Το ${esc(d.no)} έχει ήδη σταλεί; Αν ναι, προτιμήστε «Ακύρωση» και νέο έγγραφο, ώστε να συμφωνεί με αυτό που έχει ο πελάτης. Να ξεκλειδώσει για διόρθωση;`, 'Ξεκλείδωμα', 'blue')) { UNLOCK.add(d.id); viewDoc(d.id); } };
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
const issuerBlock = iss => `<span class="strong">${esc(iss.name)}</span>${iss.father ? '<br>' + esc(iss.father) : ''}${iss.addr ? '<br>' + esc(iss.addr) : ''}${iss.afm ? `<br><span class="k">ΑΦΜ</span> ${esc(iss.afm)}` : ''}${iss.doy ? `<br><span class="k">ΔΟΥ</span> ${esc(iss.doy)}` : ''}${iss.tel ? `<br><span class="k">Τηλ.</span> ${esc(iss.tel)}` : ''}${iss.email ? '<br>' + esc(iss.email) : ''}`;
function setWM(d) {
  const p = $('#page'); if (!p) return;
  const w = d.cancelled ? 'ΑΚΥΡΩΘΗΚΕ' : (d.demo || isDemoDoc(d)) ? 'ΔΕΙΓΜΑ' : 'ΠΡΟΧΕΙΡΟ';
  p.dataset.wm = w; p.classList.toggle('wm', w !== 'ΠΡΟΧΕΙΡΟ'); p.classList.toggle('wm-bad', w === 'ΑΚΥΡΩΘΗΚΕ');
}

/* related documents: where it came from and what was made from it */
function relChips(d) {
  const out = [];
  if (d.from) { const src = DB.docs.find(x => x.id === d.from.id), T = TYPES[d.from.type]?.title || ''; const label = src?.issued ? src.no : d.from.no || 'πρόχειρο ' + T.toLowerCase();
    out.push(src ? `<button class="chip so-from" type="button" data-rel="${src.id}" title="Άνοιγμα">από ${esc(label)} ↗</button>` : `<span class="chip">από ${esc(label)}</span>`); }
  for (const k of childrenOf(d)) out.push(`<button class="chip so-from" type="button" data-rel="${k.id}" title="Άνοιγμα">→ ${esc(k.issued ? k.no : TYPES[k.type].title + ' (πρόχειρο)')} ↗</button>`);
  return out.join('');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rel]'); if (b) go('doc', b.dataset.rel); });

/* status card above the page: offer answer, payments, cancellation */
function statusCard(d) {
  if (!d.issued) return '';
  const st = docState(d);
  let h = '';
  if (d.cancelled) h += `<div class="sc-cx"><b>Ακυρώθηκε ${fmtDate(d.cancelled.at)}</b>${d.cancelled.reason ? ' · ' + esc(d.cancelled.reason) : ''}<span class="sp"></span><button class="btn sm" type="button" id="sc-uncx">Αναίρεση ακύρωσης</button></div>`;
  if (d.type === 'offer' && !d.cancelled) {
    h += `<div class="sc-row"><b>Απάντηση πελάτη</b><div class="seg" id="sc-st">${[['sent', 'Σε αναμονή'], ['accepted', 'Αποδεκτή'], ['rejected', 'Απορρίφθηκε']].map(([k, l]) => `<button type="button" data-st="${k}" class="${(d.status || 'sent') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${st.k === 'expired' ? `<span class="chip warn">Η ισχύς έληξε ${fmtDate(validUntil(d))}</span>` : (d.status || 'sent') === 'sent' ? `<span class="mut">ισχύει έως ${fmtDate(validUntil(d))}</span>` : ''}
      ${d.status === 'accepted' && !childrenOf(d).some(k => k.type === 'proforma') ? '<button class="btn sm conv" type="button" id="sc-conv">→ Δημιουργία προτιμολογίου</button>' : ''}</div>`;
  }
  if (payable(d) && d.type !== 'offer' || (d.payments || []).length) h += paymentsBlock(d);
  return h ? `<div class="statuscard so card">${h}</div>` : '';
}
function paymentsBlock(d) {
  const t = totals(d).tot, paid = paidOf(d), bal = Math.round((t - paid) * 100) / 100, ps = payState(d);
  return `<div class="sc-row"><b>Πληρωμές</b>${chipOf(ps)}<span class="mut">Σύνολο ${eur(t)} · Εισπράχθηκαν ${eur(paid)} · <b style="color:var(--navy)">Υπόλοιπο ${eur(Math.max(0, bal))}</b></span></div>
    ${(d.payments || []).length ? `<table class="list pays"><tbody>${d.payments.map(p => `<tr><td class="num">${fmtDate(p.date)}</td><td class="r num"><b>${eur(num(p.amount))}</b></td><td>${esc(p.method)}</td><td class="mut">${esc(p.note || '')}</td><td class="r"><button class="btn sm ghost" type="button" data-rmpay="${p.id}" aria-label="Αφαίρεση πληρωμής">×</button></td></tr>`).join('')}</tbody></table>` : ''}
    ${d.cancelled ? '' : `<div class="payadd"><input type="date" id="pa-date" value="${todayISO()}" aria-label="Ημερομηνία πληρωμής"><input class="inp" id="pa-amt" inputmode="decimal" value="${bal > 0 ? String(bal).replace('.', ',') : ''}" placeholder="Ποσό €" aria-label="Ποσό"><select id="pa-m" aria-label="Τρόπος">${PAY_METHODS.map(m => `<option>${m}</option>`).join('')}</select><input class="inp" id="pa-note" placeholder="Σημείωση (προαιρετικά)" aria-label="Σημείωση">
      ${num(d.adv) && !paid && d.type !== 'contract' ? `<button class="btn sm" type="button" id="pa-adv">Προκαταβολή ${eur(totals(d).advv)}</button>` : ''}<button class="btn sm blue" type="button" id="pa-add">+ Πληρωμή</button></div>`}`;
}
function bindStatusCard(d) {
  const redraw = () => (d.type === 'contract' ? viewContract(d) : viewDoc(d.id));
  $$('#sc-st [data-st]').forEach(b => b.onclick = () => { d.status = b.dataset.st; d.statusAt = todayISO(); persistDoc(d, true); redraw(); if (d.status === 'accepted') toast('Η προσφορά σημειώθηκε ως αποδεκτή'); });
  if ($('#sc-conv')) $('#sc-conv').onclick = () => offerToProforma(d);
  if ($('#sc-uncx')) $('#sc-uncx').onclick = async () => { if (!(await confirmBox('Αναίρεση ακύρωσης', `Το ${esc(d.no)} θα ξαναγίνει ενεργό.`, 'Αναίρεση', 'blue'))) return; delete d.cancelled; persistDoc(d, true); redraw(); };
  $$('[data-rmpay]').forEach(b => b.onclick = async () => { if (!(await confirmBox('Αφαίρεση πληρωμής', 'Να αφαιρεθεί η πληρωμή;', 'Αφαίρεση'))) return; d.payments = d.payments.filter(p => p.id !== b.dataset.rmpay); persistDoc(d, true); redraw(); });
  if ($('#pa-adv')) $('#pa-adv').onclick = () => { $('#pa-amt').value = String(totals(d).advv).replace('.', ','); $('#pa-note').value = 'Προκαταβολή'; };
  if ($('#pa-add')) $('#pa-add').onclick = () => {
    const amt = Math.round(num($('#pa-amt').value) * 100) / 100; if (!(amt > 0)) { toast('Γράψτε το ποσό'); return $('#pa-amt').focus(); }
    d.payments.push({ id: uid(), date: $('#pa-date').value || todayISO(), amount: amt, method: $('#pa-m').value, note: $('#pa-note').value.trim() });
    d.payments.sort((a, b) => a.date.localeCompare(b.date)); persistDoc(d, true); redraw();
    toast(balanceOf(d) <= 0.005 ? 'Εξοφλήθηκε' : 'Καταχωρήθηκε πληρωμή · υπόλοιπο ' + eur(balanceOf(d)));
  };
}

/* lines: discount, VAT and equipment per line */
function renderItems(d) {
  const tb = $('#items'); tb.innerHTML = '';
  const lock = d.issued && !UNLOCK.has(d.id), ce = lock ? '' : 'contenteditable', E = EQ();
  d.items.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="n">${String(i + 1).padStart(2, '0')}${lock ? '' : `<button class="del so" type="button" title="Διαγραφή γραμμής" aria-label="Διαγραφή γραμμής ${i + 1}">×</button><button class="lopt so" type="button" title="Έκπτωση, ΦΠΑ, ${E.a}, κατάλογος" aria-label="Ρυθμίσεις γραμμής ${i + 1}">⋯</button>`}</td>
      <td><span class="it-t" ${ce} data-f="t" data-ph="Περιγραφή"></span><span class="it-s" ${ce} data-multi="1" data-f="s" data-ph="λεπτομέρειες (προαιρετικά, Enter για νέα γραμμή)"></span><span class="mwrap"></span></td>
      <td class="c"><span ${ce} data-f="q" data-ph="1"></span><span class="u" ${ce} data-f="u" data-ph="μ.μ."></span></td>
      <td class="r num"><span ${ce} data-f="p" data-ph="0,00"></span><span class="u" data-o="disc"></span></td><td class="r num b"><span data-o="line"></span><span class="u" data-o="lvat"></span></td>`;
    const chip = () => {
      const w = $('.mwrap', tr), on = it.m?.on;
      if (lock && !on) { w.innerHTML = ''; return; }
      w.innerHTML = `<button type="button" class="mchip so ${on ? '' : 'off'}" title="${d.type === 'proforma' ? `Περνά στον πελάτη με την έκδοση` : 'Περνά στον πελάτη όταν εκδοθεί προτιμολόγιο'}" ${lock ? 'disabled' : ''}>${on ? E.icon + ' ' + E.one + ': ' + esc(machineLabel(it.m) || 'χωρίς στοιχεία') + (num(it.q) > 1 ? ' ×' + num(it.q) : '') : '+ σήμανση ως ' + E.a}</button>`;
      if (!lock) $('.mchip', w).onclick = () => lineDialog(d, it, 'eq');
    };
    tr.querySelectorAll('[data-f]').forEach(el => {
      const f = el.dataset.f;
      el.textContent = f === 'p' ? (it.p === '' ? '' : eur(num(it.p))) : (it[f] ?? '');
      if (lock) return;
      el.oninput = () => {
        it[f] = textOf(el);
        if (f === 't' && isHvac() && (!it.m || it.m.auto)) { const p = parseMachine(it.t); it.m = p.btu ? { on: true, auto: true, ...p, model: '' } : null; chip(); }
        if (f === 'q') chip();
        calc(); persistDoc(d);
      };
      if (f === 'p') { el.onfocus = () => { el.textContent = it.p === '' ? '' : String(num(it.p)).replace('.', ','); }; el.onblur = () => { it.p = num(it.p); el.textContent = eur(it.p); calc(); persistDoc(d); }; }
      if (f === 'q') el.onblur = () => { it.q = num(it.q); el.textContent = String(it.q).replace('.', ','); chip(); calc(); persistDoc(d); };
    });
    if (!lock) {
      tr.querySelector('.del').onclick = () => { d.items.splice(i, 1); if (!d.items.length) d.items.push(blankItem()); renderItems(d); calc(); persistDoc(d); };
      tr.querySelector('.lopt').onclick = () => lineDialog(d, it);
    }
    tb.appendChild(tr); chip();
  });
}
async function lineDialog(d, it, focus) {
  const hv = isHvac(), E = EQ(), p = hv ? parseMachine(it.t) : {}, m = it.m || {};
  let vals = null;
  const body = `<div class="form">
      <div class="f"><label for="li-disc">Έκπτωση %</label><input id="li-disc" type="number" min="0" max="100" step="0.5" value="${esc(it.disc || '')}" placeholder="0"></div>
      <div class="f"><label for="li-vat">ΦΠΑ % της γραμμής</label><input id="li-vat" type="number" min="0" max="100" value="${esc(it.vat ?? '')}" placeholder="όπως το έγγραφο (${esc(d.vat)}%)"></div></div>
    <div class="sub-h">${E.one}</div>
    <label class="chk" style="margin:0 0 10px"><input type="checkbox" id="li-on" ${m.on || (focus === 'eq' && !it.m) ? 'checked' : ''}> Η γραμμή είναι ${E.a} που θα καταχωρηθεί στον πελάτη</label>
    <div class="form" id="li-eq"><div class="f"><label for="li-brand">${hv ? 'Μάρκα' : 'Κατασκευαστής'}</label><input id="li-brand" ${hv ? 'list="brands2"' : ''} value="${esc(m.brand || p.brand || '')}">${hv ? `<datalist id="brands2">${BRANDS.map(b => `<option value="${esc(b)}">`).join('')}</datalist>` : ''}</div>
      <div class="f"><label for="li-kind">${hv ? 'Τύπος' : 'Περιγραφή / τύπος'}</label>${hv ? `<select id="li-kind"><option value=""></option>${KINDS.map(k => `<option ${k === (m.kind || p.kind) ? 'selected' : ''}>${k}</option>`).join('')}</select>` : `<input id="li-kind" value="${esc(m.kind || '')}">`}</div>
      ${hv ? `<div class="f"><label for="li-btu">BTU</label><input id="li-btu" inputmode="numeric" value="${esc(m.btu || p.btu || '')}"></div>` : ''}<div class="f"><label for="li-model">Μοντέλο</label><input id="li-model" value="${esc(m.model || '')}"></div></div>
    <label class="chk" style="margin-top:14px"><input type="checkbox" id="li-cat"> Αποθήκευση της γραμμής στον κατάλογο (περιγραφή, μονάδα, τιμή, ΦΠΑ)</label>`;
  const r = await modal({ title: 'Γραμμή ' + (d.items.indexOf(it) + 1), body,
    actions: [{ label: 'Άκυρο', value: null }, { label: 'Εφαρμογή', value: 'ok', cls: 'blue', validate: mb => { const v = id => ($('#' + id, mb)?.value || '').trim();
      vals = { disc: v('li-disc'), vat: v('li-vat'), on: $('#li-on', mb).checked, brand: v('li-brand'), kind: v('li-kind'), btu: v('li-btu').replace(/\D/g, ''), model: v('li-model'), cat: $('#li-cat', mb).checked }; return true; } }],
    onOpen: mb => { const sync = () => $('#li-eq', mb).style.opacity = $('#li-on', mb).checked ? 1 : .45; $('#li-on', mb).onchange = sync; sync(); if (focus === 'eq') $('#li-brand', mb).focus(); } });
  if (r !== 'ok' || !vals) return;
  it.disc = vals.disc === '' ? '' : clampPct(vals.disc);
  it.vat = vals.vat === '' ? '' : clampPct(vals.vat);
  it.m = vals.on ? { on: true, auto: false, brand: vals.brand, kind: vals.kind, btu: vals.btu, model: vals.model } : { on: false, auto: false };
  if (vals.cat) {
    if (!it.t.trim()) toast('Η γραμμή χρειάζεται περιγραφή για τον κατάλογο');
    else { const C = DB.settings.catalog, ex = C.find(x => x.t.trim().toLowerCase() === it.t.trim().toLowerCase()); const row = { t: it.t.trim(), s: it.s || '', u: it.u || 'τεμ.', p: num(it.p), vat: it.vat ?? '' };
      if (ex) Object.assign(ex, row); else C.push({ id: uid(), ...row }); persistSettings(); toast(ex ? 'Ενημερώθηκε στον κατάλογο' : 'Αποθηκεύτηκε στον κατάλογο'); }
  }
  renderItems(d); calc(); persistDoc(d);
}
function catalogPicker() {
  return new Promise(resolve => {
    const C = DB.settings.catalog; let chosen = null;
    if (!C.length) { modal({ title: 'Κατάλογος', body: '<p>Ο κατάλογος είναι άδειος.</p><p class="note">Για να προσθέσετε: στη γραμμή ενός εγγράφου πατήστε «⋯» και τσεκάρετε «Αποθήκευση στον κατάλογο», ή από Ρυθμίσεις → Κατάλογος.</p>', actions: [{ label: 'Κλείσιμο', value: null }] }).then(() => resolve(null)); return; }
    modal({ title: 'Από τον κατάλογο', body: `<input class="inp" id="ct-q" placeholder="Αναζήτηση" aria-label="Αναζήτηση στον κατάλογο"><div class="pick" id="ct"></div>`, actions: [{ label: 'Άκυρο', value: null }],
      onOpen: (mb, close) => {
        const draw = () => { const ql = $('#ct-q', mb).value.toLowerCase(); const list = C.filter(x => !ql || (x.t + ' ' + x.s).toLowerCase().includes(ql)).sort((a, b) => a.t.localeCompare(b.t, 'el'));
          $('#ct', mb).innerHTML = list.map(x => `<button type="button" data-id="${x.id}"><b>${esc(x.t)}</b><span class="mut"> · ${eur(num(x.p))} / ${esc(x.u)}${x.vat !== '' && x.vat != null ? ' · ΦΠΑ ' + esc(x.vat) + '%' : ''}</span></button>`).join('') || '<div class="empty">Δεν βρέθηκε.</div>';
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
    const sp = document.createElement('span'); sp.dataset.ph = 'νέος όρος'; sp.textContent = t; sp.style.minWidth = '40mm';
    if (!lock) { sp.contentEditable = 'true';
      sp.oninput = () => { d.extra[i] = textOf(sp); li.classList.toggle('empty', !d.extra[i].trim()); persistDoc(d); };
      sp.onblur = () => { if (!d.extra[i]?.trim()) { d.extra.splice(i, 1); renderTerms(d); persistDoc(d); } }; }
    li.appendChild(sp); ol.appendChild(li);
  });
}
function calc() {
  const d = cur; if (!d) return;
  if (d.type === 'contract') return calcContract();
  const t = totals(d), anyDisc = d.items.some(it => clampPct(it.disc) > 0), mixed = t.vatBy.length > 1 || d.items.some(it => it.vat !== '' && it.vat != null && num(it.vat) !== num(d.vat));
  $$('#items tr').forEach((tr, i) => { const it = d.items[i]; if (!it) return; const dc = clampPct(it.disc);
    $('[data-o=line]', tr).textContent = it.p === '' ? '' : eur(lineNet(it));
    $('[data-o=disc]', tr).textContent = dc ? `έκπτωση ${String(dc).replace('.', ',')}%` : '';
    $('[data-o=lvat]', tr).textContent = mixed ? `ΦΠΑ ${lineRate(d, it)}%` : ''; });
  $('#sums').innerHTML = (anyDisc ? `<div><span>Αξία</span><span class="num">${eur(t.gross)}</span></div><div><span>Έκπτωση</span><span class="num">−${eur(t.disc)}</span></div>` : '')
    + `<div><span>Καθαρή αξία</span><span class="num">${eur(t.net)}</span></div>` + t.vatBy.map(v => `<div><span>ΦΠΑ ${String(v.r).replace('.', ',')}%</span><span class="num">${eur(v.v)}</span></div>`).join('')
    + `<div class="g"><span>Σύνολο</span><span class="num">${eur(t.tot)}</span></div>`;
  const vu = validUntil(d), adv = num(d.adv);
  const out = { tot: eur(t.tot), advv: eur(t.advv), bal: eur(t.bal), advp: d.adv, balp: Math.round((100 - adv) * 100) / 100,
    days: d.days, dur: num(d.dur) ? d.dur + ' ' + durUnit(d.dur, d.durU) : '', date: fmtDate(d.date), valid: fmtDate(vu), no: d.issued ? d.no : nextNo(d.type, isDemoDoc(d)),
    vatterm: mixed ? 'Οι τιμές μονάδας είναι χωρίς ΦΠΑ· ο ΦΠΑ υπολογίζεται επί της καθαρής αξίας με τον συντελεστή που αναγράφεται σε κάθε γραμμή.' : `Οι τιμές μονάδας είναι χωρίς ΦΠΑ· ο ΦΠΑ ${d.vat}% υπολογίζεται επί της καθαρής αξίας.`,
    advterm: `${d.type === 'offer' ? 'Για την αποδοχή της προσφοράς απαιτείται' : 'Απαιτείται'} προκαταβολή ${d.adv}% της συνολικής αξίας.` };
  $$('[data-out]').forEach(el => el.textContent = out[el.dataset.out] ?? '');
  $$('[data-adv]').forEach(el => el.hidden = !adv);
  $$('.to .opt').forEach(o => o.classList.toggle('empty', !String(d.cl[o.dataset.o] || '').trim()));
  $$('.to .ln').forEach(l => l.classList.toggle('empty', !$$('.opt:not(.empty)', l).length));
  $('#t-dur').hidden = !num(d.dur);
  if ($('#e-valid')) { $('#e-valid').value = vu; $('#e-valid').min = d.date; }
  requestAnimationFrame(() => { const p = $('#page'); if (!p) return; const extra = $$('.page .so,.page .addrow,.page .mwrap', p).reduce((a, b) => a + b.offsetHeight, 0); $('#ovf').hidden = p.scrollHeight - extra <= 1125; });
}

/* ================================================================== conversions */
function offerToProforma(d) {
  persistDoc(d, true);
  if (d.issued && (d.status || 'sent') === 'sent') { d.status = 'accepted'; d.statusAt = todayISO(); persistDoc(d, true); }
  openNewDoc('proforma', { ...copyOf(d), from: { id: d.id, type: d.type, no: d.issued ? d.no : '' } });
  toast('Νέο πρόχειρο προτιμολόγιο με τα στοιχεία της προσφοράς' + (d.issued ? ' · η προσφορά σημειώθηκε αποδεκτή' : ''));
}
async function proformaToContract(d) {
  let c = d.clientId ? DB.clients.find(x => x.id === d.clientId) : null;
  let ap = afmProblem(d.cl.afm, c ? c.id : null);
  if (!c && ap?.dup && ap.dup.name.trim().toLowerCase() === d.cl.name.trim().toLowerCase()) { c = ap.dup; d.clientId = c.id; ap = null; }
  const problem = !d.cl.name.trim() ? 'Συμπληρώστε πρώτα την επωνυμία του πελάτη στο «Προς».' : ap ? ap.msg + (ap.dup ? ' Συνδέστε το έγγραφο με αυτόν τον πελάτη ή διορθώστε το ΑΦΜ.' : ' Διορθώστε το ΑΦΜ στο «Προς».') : '';
  if (problem) {
    const r = await modal({ title: 'Μετατροπή σε συμβόλαιο', body: `<p>Για το συμβόλαιο χρειάζεται πελάτης με έγκυρο ΑΦΜ.</p><div class="errbox">${esc(problem)}</div>`,
      actions: [{ label: 'Κλείσιμο', value: null }, ...(ap?.dup && d.cl.name.trim() ? [{ label: `Σύνδεση με «${ap.dup.name}»`, value: 'link', cls: 'blue' }] : [])] });
    if (r === 'link') { d.clientId = ap.dup.id; d.cl = pickCl(ap.dup); persistDoc(d, true); return proformaToContract(d); }
    return;
  }
  c = upsertClient(d);
  const added = pushMachines(d, c);
  persistDoc(d, true); q(() => saveClient(c)); await chain;
  const mids = c.machines.filter(m => m.source?.docId === d.id).map(m => m.id);
  const nc = newContract(c, { from: { id: d.id, type: d.type, no: d.issued ? d.no : '' }, vat: d.vat, demo: d.demo });
  nc.machineIds = mids.length ? mids : c.machines.map(m => m.id);
  go('doc', nc.id);
  toast(mids.length ? `Νέο πρόχειρο συμβόλαιο με ${plural(mids.length, EQ().a, EQ().as)} από το προτιμολόγιο${added ? ' (καταχωρήθηκαν στον πελάτη)' : ''}` : `Νέο πρόχειρο συμβόλαιο · επιλέξτε ή προσθέστε ${EQ().as}`);
}

/* ================================================================== explicit actions */
async function saveNow(d) { cancelLater('d' + d.id); await q(() => saveDoc(d)); toast('Αποθηκεύτηκε στο ' + d.dir + ' / ' + d.file); }
async function deleteDoc(d) {
  if (d.issued) return false;
  if (!(await confirmBox('Διαγραφή πρόχειρου', 'Να διαγραφεί το πρόχειρο;'))) return false;
  return removeDoc(d);
}
async function removeDoc(d) {
  DB.docs = DB.docs.filter(x => x !== d); cancelLater('d' + d.id);
  if (d.file) await q(() => delFile(d.dir, d.file));
  if (cur === d) cur = null;
  toast('Διαγράφηκε'); return true;
}
async function hardDelete(d) {
  let ok = false;
  await modal({ title: 'Οριστική διαγραφή', body: `<p>Το <b>${esc(d.no)}</b> έχει εκδοθεί. Η σωστή πρακτική είναι η <b>ακύρωση</b>, ώστε να μένει ίχνος και να μη «χαθεί» αριθμός.</p><p>Αν πρόκειται για λάθος δοκιμή, γράψτε τον αριθμό για επιβεβαίωση:</p><input class="inp" id="hd" placeholder="${esc(d.no)}" aria-label="Αριθμός εγγράφου">`,
    actions: [{ label: 'Πίσω', value: null }, { label: 'Οριστική διαγραφή', value: 'x', cls: 'danger', validate: mb => { ok = $('#hd', mb).value.trim() === d.no; if (!ok) toast('Ο αριθμός δεν ταιριάζει'); return ok; } }] });
  return ok ? removeDoc(d) : false;
}
async function cancelDoc(d) {
  let reason = '';
  const r = await modal({ title: 'Ακύρωση ' + esc(d.no), body: `<p>Το έγγραφο μένει στον φάκελο με την ένδειξη <b>ΑΚΥΡΩΘΗΚΕ</b> και δεν μετρά σε ανεξόφλητα και αναμονές. Ο αριθμός δεν ξαναδίνεται.</p><div class="f" style="margin-top:10px"><label for="cx-r">Λόγος (προαιρετικά)</label><input id="cx-r" placeholder="π.χ. λάθος ποσό, νέο έγγραφο ΠΡ-…"></div>`,
    actions: [{ label: 'Πίσω', value: null }, { label: 'Ακύρωση εγγράφου', value: 'x', cls: 'danger', validate: mb => { reason = $('#cx-r', mb).value.trim(); return true; } }] });
  if (r !== 'x') return;
  d.cancelled = { at: todayISO(), reason }; persistDoc(d, true);
  d.type === 'contract' ? viewContract(d) : viewDoc(d.id);
  const again = await confirmBox('Νέο έγγραφο;', 'Θέλετε να φτιαχτεί αντίγραφο ως νέο πρόχειρο για τη διόρθωση;', 'Ναι, νέο πρόχειρο', 'blue');
  if (again) { if (d.type === 'contract') { const c = DB.clients.find(x => x.id === d.clientId); const nc = newContract(c, contractCopy(d)); go('doc', nc.id); } else openNewDoc(d.type, copyOf(d)); }
}
function rowActions(d) { return `<td class="r acts"><button class="btn sm" type="button" data-pdf="${d.id}" title="${d.issued ? 'PDF / Εκτύπωση' : 'Έκδοση & PDF'}">PDF</button>${d.issued ? '' : `<button class="btn sm danger" type="button" data-del="${d.id}" title="Διαγραφή πρόχειρου" aria-label="Διαγραφή πρόχειρου">✕</button>`}</td>`; }
function bindRowActions(redraw) {
  $$('[data-pdf]').forEach(b => b.onclick = e => { e.stopPropagation(); const d = DB.docs.find(x => x.id === b.dataset.pdf); go('doc', d.id); setTimeout(() => $('#b-pdf')?.click(), 250); });
  $$('[data-del]').forEach(b => b.onclick = async e => { e.stopPropagation(); const d = DB.docs.find(x => x.id === b.dataset.del); if (await deleteDoc(d)) redraw(); });
}

/* email text: the PDF is attached by hand (the browser cannot attach files to an email) */
function emailDialog(d) {
  const S = DB.settings, iss = d.iss || S.iss, B = S.brand, t = totals(d);
  const what = { offer: 'την προσφορά', proforma: 'το προτιμολόγιο', contract: 'το συμβόλαιο συντήρησης' }[d.type];
  const no = d.issued ? d.no : '';
  const accts = (d.accounts || S.accounts).filter(a => a.iban);
  const lines = [`Καλησπέρα σας,`, '', `σας στέλνουμε συνημμένα ${what}${no ? ' ' + no : ''}${d.type === 'contract' && d.start ? ` για την περίοδο ${fmtDate(d.start)} – ${fmtDate(contractEnd(d))}` : ''}.`, '', `Σύνολο με ΦΠΑ: ${eur(t.tot)}`];
  if (d.type === 'offer') lines.push(`Η προσφορά ισχύει έως ${fmtDate(validUntil(d))}.`);
  if (d.type !== 'offer' && num(d.adv) && !paidOf(d)) lines.push(`Προκαταβολή ${d.adv}%: ${eur(t.advv)}`);
  if (paidOf(d) && balanceOf(d) > 0.005) lines.push(`Υπόλοιπο προς εξόφληση: ${eur(balanceOf(d))}`);
  if (accts.length && d.type !== 'offer') { lines.push('', 'Στοιχεία πληρωμής:'); accts.forEach(a => lines.push(`${a.bank}: ${a.iban}`)); if (no) lines.push(`Αιτιολογία: ${no}`); }
  lines.push('', 'Για οποιαδήποτε διευκρίνιση είμαστε στη διάθεσή σας.', '', 'Με εκτίμηση,', iss.name, ...(B.name && B.name !== iss.name ? [B.name] : []), ...[iss.tel, iss.email].filter(Boolean));
  const subject = `${TYPES[d.type].title}${no ? ' ' + no : ''} · ${B.name || iss.name}`, body = lines.join('\n');
  modal({ title: 'Κείμενο για email', wide: true, body: `<div class="f"><label for="em-to">Προς</label><input id="em-to" value="${esc(d.cl.email)}"></div><div class="f" style="margin-top:10px"><label for="em-s">Θέμα</label><input id="em-s" value="${esc(subject)}"></div>
      <div class="f" style="margin-top:10px"><label for="em-b">Κείμενο</label><textarea id="em-b" style="min-height:260px">${esc(body)}</textarea></div><p class="note" style="margin-top:10px">Επισυνάψτε το PDF του εγγράφου στο μήνυμα (ο browser δεν μπορεί να το επισυνάψει αυτόματα).</p>`,
    actions: [{ label: 'Κλείσιμο', value: null }, '|', { label: 'Αντιγραφή κειμένου', value: null, validate: async mb => { try { await navigator.clipboard.writeText($('#em-s', mb).value + '\n\n' + $('#em-b', mb).value); toast('Αντιγράφηκε'); } catch (e) { $('#em-b', mb).select(); document.execCommand('copy'); toast('Αντιγράφηκε'); } return false; } },
      { label: 'Άνοιγμα στο email', value: null, cls: 'blue', validate: mb => { location.href = `mailto:${encodeURIComponent($('#em-to', mb).value.trim())}?subject=${encodeURIComponent($('#em-s', mb).value)}&body=${encodeURIComponent($('#em-b', mb).value)}`; return true; } }] });
}

/* ================================================================== issuing + printing */
async function issueDialog(d) {
  if (d.type === 'contract') return issueContract(d);
  const demo = isDemoDoc(d), no = nextNo(d.type, demo);
  let c = d.clientId ? DB.clients.find(x => x.id === d.clientId) : null;
  let ap = afmProblem(d.cl.afm, c ? c.id : null);
  if (!c && ap?.dup && ap.dup.name.trim().toLowerCase() === d.cl.name.trim().toLowerCase()) { c = ap.dup; d.clientId = c.id; ap = null; }
  const mcount = d.type === 'proforma' ? d.items.filter(i => i.m?.on).reduce((a, i) => a + Math.max(1, Math.round(num(i.q)) || 1), 0) : 0;
  const empty = !d.items.some(i => (i.t || '').trim() && num(i.p));
  const missing = !d.cl.name.trim() ? 'Συμπληρώστε πρώτα την επωνυμία του πελάτη στο «Προς».' : ap ? ap.msg + (ap.dup ? ' Συνδέστε το έγγραφο με αυτόν τον πελάτη ή διορθώστε το ΑΦΜ στο «Προς».' : ' Διορθώστε το ΑΦΜ στο «Προς».') : empty ? 'Το έγγραφο δεν έχει γραμμή με περιγραφή και τιμή.' : '';
  const r = await modal({ title: `Έκδοση ${TYPES[d.type].title.toLowerCase()}`,
    body: missing ? `<div class="errbox">${esc(missing)}</div>` :
      `<p>Το έγγραφο θα πάρει τον αριθμό <b style="color:var(--navy)">${no}</b> και θα αποθηκευτεί στον φάκελο ${TYPES[d.type].dir}. Μετά την έκδοση κλειδώνει· για αλλαγές γίνεται ακύρωση και νέο έγγραφο.</p>
       <ul style="margin:10px 0 0 18px"><li>Πελάτης: <b>${esc(d.cl.name)}</b> — ${c ? 'ενημέρωση στο πελατολόγιο' : 'νέα καταχώριση στο πελατολόγιο'}</li>${mcount ? `<li>${plural(mcount, EQ().a, EQ().as)} θα καταχωρηθούν στον πελάτη</li>` : ''}<li>Σύνολο με ΦΠΑ: <b>${eur(totals(d).tot)}</b></li></ul>
       ${demo ? '<p class="warnbox">Δεδομένα επίδειξης: παίρνει αριθμό ΔΕΙΓΜΑ και δεν επηρεάζει την κανονική αρίθμηση.</p>' : ''}
       <p class="mut" style="margin-top:12px;font-size:13px">Στο παράθυρο εκτύπωσης επιλέξτε «Αποθήκευση ως PDF». Το όνομα αρχείου προτείνεται αυτόματα.</p>`,
    actions: [{ label: 'Πρόχειρη εκτύπωση', value: 'draft' }, '|', { label: 'Άκυρο', value: null }, ...(ap?.dup && d.cl.name.trim() ? [{ label: `Σύνδεση με «${ap.dup.name}»`, value: 'link', cls: 'blue' }] : []), ...(missing ? [] : [{ label: 'Έκδοση & PDF', value: 'issue', cls: 'blue' }])] });
  if (r === 'draft') return doPrint(true);
  if (r === 'link') { d.clientId = ap.dup.id; d.cl = pickCl(ap.dup); persistDoc(d, true); viewDoc(d.id); toast('Το έγγραφο συνδέθηκε με τον πελάτη · πατήστε ξανά «Έκδοση & PDF»'); return; }
  if (r !== 'issue') return;
  d.no = no; d.issued = true; d.issuedAt = todayISO(); if (demo) d.demo = true;
  if (d.type === 'offer') d.status = 'sent';
  d.iss = clone(DB.settings.iss); d.accounts = clone(DB.settings.accounts.filter(a => a.bank || a.iban));
  const cl = upsertClient(d); const added = d.type === 'proforma' ? pushMachines(d, cl) : 0;
  cl.machines.forEach(m => { if (m.source?.docId === d.id) m.source.docNo = d.no; });
  persistDoc(d, true); q(() => saveClient(cl));
  await chain; UNLOCK.delete(d.id);
  viewDoc(d.id);
  toast(`Εκδόθηκε ${d.no}` + (added ? ` · ${plural(added, EQ().a, EQ().as)} στον πελάτη` : ''));
  setTimeout(() => doPrint(false), 300);
}
let printing = false, savedTitle = '';
function doPrint(draft, title) {
  printing = true; document.body.classList.toggle('print-draft', !!draft);
  savedTitle = document.title;
  if (title) document.title = title;
  else if (cur) document.title = (cur.issued ? cur.no : 'ΠΡΟΧΕΙΡΟ_' + TYPES[cur.type].title) + '_' + (slug(cur.cl.name) || 'πελάτης');
  document.activeElement?.blur?.();
  setTimeout(() => window.print(), 50);
}
addEventListener('beforeprint', () => { if (!printing && view.name === 'doc' && cur && !cur.issued) document.body.classList.add('print-draft'); });
addEventListener('afterprint', () => { printing = false; document.body.classList.remove('print-draft'); if (savedTitle) { document.title = savedTitle; savedTitle = ''; } });

/* editing conveniences */
document.addEventListener('paste', e => { if (!e.target.closest || !e.target.closest('[contenteditable]')) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
document.addEventListener('keydown', e => { const el = e.target.closest && e.target.closest('[contenteditable]'); if (el && e.key === 'Enter' && !el.dataset.multi) { e.preventDefault(); el.blur(); } });

/* ================================================================== CSV for Excel (semicolon, BOM, Greek decimals) */
function csv(name, head, rows) {
  const cell = v => { v = v == null ? '' : typeof v === 'number' ? v.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  download(name, '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('Το αρχείο αποθηκεύτηκε στις Λήψεις · ανοίγει με Excel');
}
function exportDocsCSV(list) {
  list = list || DB.docs.filter(d => SALES.includes(d.type));
  csv(`έγγραφα_${todayISO()}.csv`, ['Αριθμός', 'Τύπος', 'Ημερομηνία', 'Πελάτης', 'ΑΦΜ', 'Καθαρή αξία', 'ΦΠΑ', 'Σύνολο', 'Πληρωμές', 'Υπόλοιπο', 'Κατάσταση', 'Δείγμα'],
    list.map(d => { const t = totals(d); return [d.issued ? d.no : 'Πρόχειρο', TYPES[d.type].title, fmtDate(d.date), d.cl.name, d.cl.afm, t.net, t.vatv, t.tot, paidOf(d), payable(d) && d.type !== 'offer' ? balanceOf(d) : '', docState(d).l, d.demo ? 'ναι' : '']; }));
}
function exportClientsCSV() {
  csv(`πελάτες_${todayISO()}.csv`, ['Επωνυμία', 'Δραστηριότητα', 'ΑΦΜ', 'ΔΟΥ', 'ΓΕΜΗ', 'Διεύθυνση', 'Τηλέφωνο', 'Email', EQ().many, 'Υπόλοιπο', 'Σημειώσεις'],
    DB.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'el')).map(c => [c.name, c.act, c.afm, c.doy, c.gemi, c.addr, c.tel, c.email, c.machines.length, clientBalance(c), c.notes]));
}
function exportPaymentsCSV() {
  const rows = DB.docs.flatMap(d => (d.payments || []).map(p => [fmtDate(p.date), d.no || 'Πρόχειρο', TYPES[d.type].title, d.cl.name, num(p.amount), p.method, p.note || '', d.cancelled ? 'ακυρωμένο' : ''])).sort((a, b) => a[0].split('.').reverse().join('').localeCompare(b[0].split('.').reverse().join('')));
  csv(`πληρωμές_${todayISO()}.csv`, ['Ημερομηνία', 'Έγγραφο', 'Τύπος', 'Πελάτης', 'Ποσό', 'Τρόπος', 'Σημείωση', ''], rows);
}
