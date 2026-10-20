// r4box.com/diary.html: one person's world. Ported from the design system's family-world kit
// (family-app.js) with three changes: seeds and shares are real (window.R4Store, backed by
// kid_seeds / kid_shares, 108) instead of this device's storage; the viewer can differ from
// the world's owner (window.R4_VIEWER: a parent opening a kid's world sees names, never words);
// and there is no prototype "viewing as" bar or settings page.
// Family world: the clearing (everyone together) and each person's world (diary.html, recreated).
// Privacy follows 095_kid_diary.sql: a kid reads only their own diary; a parent sees a kid's
// world and topic names, never summaries or entries, unless the kid shares them with the family.
// Individual pages follow the shared story pattern (../shared/story-kit.js): world on top
// (can go full screen), then progress, seeds, what's growing, a topic's story in chapters, journal.
(function () {
  const $ = (id) => document.getElementById(id), K = window.StoryKit;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REALM = { tutor: ['🌳', 'Learning', 'a limb on your tree'], chat: ['✿', 'Chat', 'a flower'], trip: ['✶', 'Trips', 'stars in the sky'], game: ['🌀', 'Games', 'a bush'] };
  const KIND = { spark: 'sprouted', deepen: 'grew', branch: 'branched', pivot: 'turned', merge: 'joined', park: 'rested', revive: 'came back', ship: 'finished' };
  const FAMC = { spark: '#B9A6FF', deepen: '#B9A6FF', revive: '#B9A6FF', branch: '#FF5A4A', pivot: '#FF5A4A', merge: '#FF5A4A', ship: '#3DD6C6', park: '#5A5385' };
  const DOT = { dad_commander: '#F5C542', obanai_rocks: '#3DD6C6', phoenix_lord: '#FF5A4A' };
  const nice = (d, o = { weekday: 'long', month: 'short', day: 'numeric' }) => new Date(d + 'T12:00:00').toLocaleDateString([], o);
  const short = (d) => nice(d, { month: 'short', day: 'numeric' });
  const F = window.FAMILY, byId = (id) => F.find((p) => p.id === id);
  $('worldBox').after($('legend'));
  const SOLO = window.R4_SOLO || null;
  let viewer = byId(window.R4_VIEWER) || (SOLO && byId(SOLO.person)) || F[0], view = SOLO ? { kind: 'world', id: SOLO.person } : { kind: 'together' }, live = null;
  if (SOLO) { document.body.classList.add('solo'); if (!localStorage.getItem('r4.density.' + viewer.id) && SOLO.density) K.setDensity(viewer, SOLO.density); }

  const access = (p) => (p.id === viewer.id ? 'own' : viewer.role === 'parent' ? 'names' : 'none');
  const realmName = (p, k) => (k === 'tutor' && p.id === 'dad_commander' ? 'Ideas' : REALM[k][1]);
  const storyId = (p, t) => 'story:' + p.id + ':' + t.id, entryId = (p, en) => 'entry:' + p.id + ':' + en.day;
  const canRead = (p, id) => access(p) === 'own' || K.isShared(id);
  const evText = (e) => e.summary || (e.meta ? e.meta.played + ' played, ' + e.meta.won + ' won' : '');

  function stop() { if (live) live.destroy(); live = null; $('pick').hidden = true; $('tools').hidden = true; planting(false); full(false); window.scrollTo(0, 0); }
  // SOLO.noSeeds / SOLO.noShare: a world that is written for you (Dad's Clearing diary) has no seeds to plant or entries to share.
  const NOSEED = !!(SOLO && SOLO.noSeeds), NOSHARE = !!(SOLO && SOLO.noShare);
  const seedsOf = (p) => (NOSEED || !window.R4Store ? [] : window.R4Store.seeds(p));
  function planting(on) { $('plantBtn').classList.toggle('on', on); $('worldBox').classList.toggle('planting', on); if (live && live.setPlant) live.setPlant(on); $('hint').textContent = on ? 'Tap the ground to plant a seed' : (live && view.kind === 'world' ? 'Drag to look around · pinch or double-tap to zoom' : ''); }
  function full(on) { document.body.classList.toggle('isfull', on); $('worldBox').classList.toggle('full', on); $('zFull').textContent = on ? '✕' : '⛶'; $('zFull').setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); }
  $('zFull').onclick = () => full(!document.body.classList.contains('isfull'));
  function asBar() {
    if (SOLO || !$('as')) { if ($('as')) $('as').hidden = true; return; }
    $('as').innerHTML = F.map((p) => `<button data-as="${p.id}" class="${p.id === viewer.id ? 'on' : ''}">${esc(p.name)}</button>`).join('');
    $('as').querySelectorAll('[data-as]').forEach((b) => (b.onclick = () => { viewer = byId(b.dataset.as); localStorage.setItem('r4fam.as', viewer.id); render(); }));
  }
  function render() { asBar(); $('worldBox').hidden = view.kind === 'settings'; document.body.classList.toggle('insettings', view.kind === 'settings'); if (view.kind === 'settings') return renderSettings(); view.kind === 'world' ? renderWorld(byId(view.id)) : renderTogether(); }
  let back = { kind: 'together' };
  function renderSettings() {
    if (live) live.destroy(); live = null; $('pick').hidden = true; $('private').hidden = true; $('legend').innerHTML = '';
    document.body.classList.remove('dens-play', 'dens-pilot', 'dens-dev'); document.body.classList.add('dens-explore');
    $('title').textContent = 'Settings'; $('back').hidden = false; $('markA').hidden = true; window.scrollTo(0, 0);
    window.R4Security.renderSettings($('body'));
  }
  // (The kit's ⚙ settings page is a prototype: not here.)
  const go = (v) => { view = v; render(); };
  $('back').onclick = () => go(view.kind === 'settings' ? back : SOLO ? { kind: 'world', id: SOLO.person } : { kind: 'together' });

  // ---------- density: toy cockpit → real cockpit ----------
  let dens = 'explore';
  const LIM = { play: { tiles: 4, journal: 1, chapters: 3 }, explore: { tiles: 6, journal: 3, chapters: 6 }, pilot: { tiles: 99, journal: 8, chapters: 99 }, dev: { tiles: 99, journal: 8, chapters: 99 } };
  const dense = () => dens === 'pilot' || dens === 'dev';
  function applyDensity(p) { dens = K.densityOf(p); document.body.classList.remove('dens-play', 'dens-explore', 'dens-pilot', 'dens-dev'); document.body.classList.add('dens-' + dens); if (dens === 'dev') document.body.classList.add('dens-pilot'); }
  function densityPicker(p) {
    if (access(p) !== 'own') return '';
    const auto = K.densityByAge(p.age);
    const cur = K.DENSITY.find((d) => d.id === dens);
    return `<div class="vpick"><button class="vbtn" id="vbtn" aria-haspopup="menu" aria-expanded="false" aria-label="View: ${cur.name}"><span>${cur.em}</span>${cur.name}<i>▾</i></button><div class="vmenu" id="vmenu" role="menu" hidden><p>View</p>${K.DENSITY.map((d) => `<button role="menuitemradio" aria-checked="${d.id === dens}" data-dens="${d.id}" class="${d.id === dens ? 'on' : ''}"><span>${d.em}</span><b>${d.name}${d.id === auto ? ' <small>for your age</small>' : ''}</b><em>${d.blurb}</em></button>`).join('')}</div></div>`;
  }
  function wireDensity(p, redraw) {
    const vb = $('vbtn'), vm = $('vmenu');
    if (vb) { vb.onclick = (e) => { e.stopPropagation(); const open = vm.hidden; vm.hidden = !open; vb.setAttribute('aria-expanded', open); if (open) setTimeout(() => document.addEventListener('click', function off() { vm.hidden = true; vb.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', off); }), 0); }; } $('body').querySelectorAll('[data-dens]').forEach((b) => (b.onclick = () => { K.setDensity(p, b.dataset.dens === K.densityByAge(p.age) ? null : b.dataset.dens); applyDensity(p); redraw(); })); }

  // ---------- cards open as their own page (better on a phone) ----------
  // The card's body is moved into a full-screen page and moved back on close, so its handlers
  // (and any React content mounted in it) keep working. The phone's back button closes it.
  let sub = null;
  function openSub(sec) {
    if (sub) closeSub(true);
    const body = sec.querySelector(':scope > .ctxb'), title = sec.querySelector(':scope > .ctxh .top b').textContent, sum = (sec.querySelector(':scope > .ctxh .sum') || {}).textContent || '';
    const pg = document.createElement('section'); pg.className = 'subpage'; pg.setAttribute('aria-label', title);
    pg.innerHTML = `<header><button class="sb" aria-label="Back">‹</button><span><b>${esc(title)}</b><small>${esc(sum)}</small></span></header><div class="subb"></div>`;
    const box = pg.querySelector('.subb'); while (body.firstChild) box.append(body.firstChild);
    $('app').append(pg); document.body.classList.add('insub'); pg.querySelector('.sb').onclick = () => history.back();
    sub = { sec, body, pg, y: window.scrollY }; history.pushState({ sub: 1 }, ''); pg.scrollTop = 0;
  }
  function closeSub(silent) {
    if (!sub) return; const { body, pg, y } = sub, box = pg.querySelector('.subb');
    while (box.firstChild) body.append(box.firstChild);
    pg.remove(); document.body.classList.remove('insub'); sub = null; if (!silent) window.scrollTo(0, y);
  }
  addEventListener('popstate', () => closeSub());
  document.addEventListener('click', (e) => {
    const h = e.target.closest && e.target.closest('.page .grp > .ctxh, .page .devcard > .ctxh'); if (!h || h.closest('.subpage')) return;
    e.stopImmediatePropagation(); e.preventDefault(); const sec = h.parentElement;
    if (sec.dataset.xc) { const el = sec.querySelector('.xbody'); if (!el.dataset.on) { el.dataset.on = 1; SOLO.mount(sec.dataset.xc, el, { openTopic: (id) => { history.back(); setTimeout(() => { const p = byId(view.id), t = p && p.world.topics.find((x) => x.id === id); if (t) renderStory(p, t); }, 60); } }); } }
    openSub(sec);
  }, true);
  const _rs0 = renderStory; renderStory = function (p, t) { if (sub) { closeSub(true); history.replaceState(null, ''); } _rs0(p, t); };
  const _stop0 = stop; stop = function () { if (sub) { closeSub(true); history.replaceState(null, ''); } _stop0(); };

  // ---------- small pieces of the story pattern ----------
  function days14(evs, color = '#3DD6C6') {
    const cells = K.lastDays(evs, 14), max = Math.max(1, ...cells.map((c) => c.v));
    return `<div class="d14">${cells.map((c) => `<i class="${c.v ? 'on' : ''}${c.today ? ' t' : ''}" title="${esc(short(c.day))}" style="${c.v ? `--s:${(0.45 + 0.55 * c.v / max).toFixed(2)};background:${color};box-shadow:0 0 8px ${color}` : ''}"></i>`).join('')}</div>`;
  }
  function progress(evs, opts = {}) {
    const st = K.streak(evs.map((e) => e.day)), week = K.lastDays(evs, 7).filter((c) => c.v).length;
    const big = st.now ? `<b>${st.now}</b><span>day${st.now === 1 ? '' : 's'} in a row<small>best ${st.best}</small></span>` : `<b class="dim">${st.last ? st.sinceLast : 0}</b><span>${st.last ? 'days since it last grew' : 'nothing yet'}<small>best run ${st.best} day${st.best === 1 ? '' : 's'}</small></span>`;
    return `<section class="prog"><div class="streak">${big}</div><div class="wk"><span class="lbl">Last 2 weeks · ${week} of the last 7 days</span>${days14(evs, opts.color)}<span class="ends"><span>2 weeks ago</span><span>today</span></span></div>${opts.counts ? `<div class="counts">${opts.counts.map(([n, l, c]) => `<span><b style="color:${c || 'var(--ink)'}">${n}</b>${l}</span>`).join('')}</div>` : ''}</section>`;
  }
  const shareBtn = (id, on) => NOSHARE ? '' : `<button class="share${on ? ' on' : ''}" data-share="${esc(id)}">${on ? '✓ Shared with family' : '↗ Share with family'}</button>`;
  function wireShare(root, metaOf) {
    root.querySelectorAll('[data-share]').forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); const id = b.dataset.share, on = !K.isShared(id); K.setShared(id, on, metaOf(id)); b.classList.toggle('on', on); b.textContent = on ? '✓ Shared with family' : '↗ Share with family'; }));
  }
  // Journal as a calendar: a month at a glance, tap a day to read it.
  function journal(p, entries, tById, events) {
    const a = access(p), list = entries.filter((en) => a === 'own' || K.isShared(entryId(p, en)));
    if (!list.length && a !== 'own') return '';
    const last = list.map((e) => e.day).sort().pop();
    return `<section class="ctx devcard grp"><button class="ctxh" data-ctxt aria-expanded="false"><span class="top"><b>${a === 'own' ? 'Journal' : 'Shared with you'}</b><span class="n" style="color:#F5C542">${list.length}</span><span class="chev">⌄</span></span><span class="sum">${list.length ? 'Last entry ' + esc(short(last)) + ' · agenda, week, month' : 'Nothing written yet'}</span></button><div class="ctxb"><section class="cal" id="jr"></section></div></section>`;
  }
  function wireJournal(p, entries, tById, events) {
    const el = $('jr'); if (!el) return;
    const a = access(p), list = entries.filter((en) => a === 'own' || K.isShared(entryId(p, en)));
    const byDay = Object.fromEntries(list.map((en) => [en.day, en])), evDay = {};
    events.forEach((e) => { (evDay[e.day] = evDay[e.day] || []).push(e); });
    const latest = list.map((e) => e.day).sort().pop() || K.today();
    let sel = latest, month = latest.slice(0, 7), mode = localStorage.getItem('r4fam.jv') || 'agenda';
    const allDays = [...list.map((e) => e.day), ...Object.keys(evDay)].sort(), minM = (allDays[0] || K.today()).slice(0, 7), maxM = K.today().slice(0, 7);
    const shiftM = (m, n) => { const [y, mo] = m.split('-').map(Number), d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const jvBar = () => `<div class="jv" role="tablist">${[['month', 'Month'], ['week', 'Week'], ['agenda', 'Agenda']].map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" data-jv="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const topicsOn = (day) => [...new Map((evDay[day] || []).map((e) => tById[e.topic]).filter(Boolean).map((t) => [t.id, t])).values()];
    function wireJv() { el.querySelectorAll('[data-jv]').forEach((b) => (b.onclick = () => { mode = b.dataset.jv; localStorage.setItem('r4fam.jv', mode); draw(); })); }
    function drawWeek() {
      const d0 = K.dn(sel) - new Date(sel + 'T12:00:00Z').getUTCDay(), days = Array.from({ length: 7 }, (_, i) => K.iso(d0 + i));
      el.innerHTML = `<div class="calh"><button data-w="-7" aria-label="Previous week">‹</button><b>${K.range(days[0], days[6])}</b><span></span><button data-w="7" ${days[6] >= K.today() ? 'disabled' : ''} aria-label="Next week">›</button></div>${jvBar()}
        <div class="wk7">${days.map((day) => { const en = byDay[day], ts = topicsOn(day); return `<button data-day="${day}" class="${en ? 'en' : ''}${day === sel ? ' sel' : ''}${day === K.today() ? ' today' : ''}"><span class="dd">${nice(day, { weekday: 'short' })}<b>${+day.slice(8)}</b></span><span class="tx">${en ? `<p>${esc(en.body)}</p>` : ts.length ? '' : '<p class="none">Nothing</p>'}${ts.length ? `<span class="tg">${ts.slice(0, 3).map((t) => `<span>${REALM[t.source][0]} ${esc(t.title)}</span>`).join('')}${ts.length > 3 ? `<span>+${ts.length - 3}</span>` : ''}</span>` : ''}</span></button>`; }).join('')}</div>`;
      el.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { sel = K.iso(K.dn(sel) + +b.dataset.w); if (sel > K.today()) sel = K.today(); month = sel.slice(0, 7); draw(); }));
      el.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { const again = sel === b.dataset.day; sel = b.dataset.day; month = sel.slice(0, 7); if (again) mode = 'month'; draw(); }));
      wireJv();
    }
    function drawAgenda() {
      const days = [...new Set([...Object.keys(byDay), ...Object.keys(evDay)])].filter((d) => d <= K.today()).sort().reverse().slice(0, 40);
      let wk = null, rows = '';
      days.forEach((day) => { const w = K.iso(K.dn(day) - new Date(day + 'T12:00:00Z').getUTCDay()); if (w !== wk) { wk = w; rows += `<h4>Week of ${esc(short(w))}</h4>`; }
        const en = byDay[day], ts = topicsOn(day), n = (evDay[day] || []).length;
        rows += `<button data-day="${day}"><span class="ad">${esc(nice(day, { weekday: 'short', day: 'numeric' }))}</span><span class="at">${en ? '✎ ' + esc(en.body) : ts.map((t) => REALM[t.source][0] + ' ' + esc(t.title)).join(' · ')}</span><span class="an">${n ? n + '●' : ''}</span></button>`; });
      el.innerHTML = `<div class="calh"><b>Agenda</b><span>${days.length} days</span></div>${jvBar()}<div class="agd">${rows || '<p class="note">Nothing yet.</p>'}</div>`;
      el.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { sel = b.dataset.day; month = sel.slice(0, 7); mode = 'week'; draw(); }));
      wireJv();
    }
    function draw() {
      if (mode === 'week') return drawWeek();
      if (mode === 'agenda') return drawAgenda();
      const [y, mo] = month.split('-').map(Number), first = new Date(Date.UTC(y, mo - 1, 1)), n = new Date(Date.UTC(y, mo, 0)).getUTCDate(), pad = first.getUTCDay();
      const cells = []; for (let i = 0; i < pad; i++) cells.push('<i></i>');
      let count = 0;
      for (let d = 1; d <= n; d++) {
        const day = month + '-' + String(d).padStart(2, '0'), en = byDay[day], ev = evDay[day] || [], eff = ev.reduce((s, e) => s + (+e.effort || 1), 0);
        if (en) count++;
        cells.push(`<button data-day="${day}" class="${en ? 'en' : ''}${ev.length ? ' ev' : ''}${day === sel ? ' sel' : ''}${day === K.today() ? ' today' : ''}" style="--g:${Math.min(1, eff / 8).toFixed(2)}" aria-label="${esc(nice(day))}${en ? ', journal entry' : ''}"><span>${d}</span>${ev.length ? '<em></em>' : ''}</button>`);
      }
      const en = byDay[sel], ev = evDay[sel] || [], uniq = [...new Map(ev.map((e) => tById[e.topic]).filter(Boolean).map((t) => [t.id, t])).values()];
      el.innerHTML = `<div class="calh"><button data-m="-1" ${month <= minM ? 'disabled' : ''} aria-label="Previous month">‹</button><b>${first.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b><span>${count} entr${count === 1 ? 'y' : 'ies'}</span><button data-m="1" ${month >= maxM ? 'disabled' : ''} aria-label="Next month">›</button></div>
        ${jvBar()}<div class="dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<span>${x}</span>`).join('')}</div><div class="grid">${cells.join('')}</div>
        <div class="calkey"><span><i class="k1"></i>wrote</span><span><i class="k2"></i>something grew</span></div>
        <article class="dayc"><div class="d">${esc(nice(sel))}</div>${en ? `<p>${esc(en.body)}</p>` : `<p class="none">${a === 'own' ? 'Nothing written this day.' : 'Nothing shared this day.'}</p>`}
        ${uniq.length ? `<span class="sub">What grew · ${ev.length}</span><div class="chips">${uniq.slice(0, 6).map((t) => `<button data-t="${t.id}">${REALM[t.source][0]} <span>${esc(t.title)}</span></button>`).join('')}</div>` : ''}
        ${en && a === 'own' ? shareBtn(entryId(p, en), K.isShared(entryId(p, en))) : ''}</article>`;
      el.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => { sel = b.dataset.day; draw(); }));
      el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { month = shiftM(month, +b.dataset.m); const inM = (d) => d.startsWith(month); sel = list.map((e) => e.day).filter(inM).sort().pop() || Object.keys(evDay).filter(inM).sort().pop() || month + '-01'; draw(); }));
      el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => renderStory(p, tById[b.dataset.t])));
      wireShare(el, (id) => { const e = list.find((x) => entryId(p, x) === id); return { kind: 'entry', title: nice(e.day, { weekday: 'long' }) + '’s entry', day: e.day, text: e.body.slice(0, 160) }; });
      wireJv();
    }
    draw();
  }
  // Play: the toy cockpit. A big streak, up to four big buttons, one finished count, one seed button.
  function playHome(p, growing, done, seeds) {
    const st = K.streak(p.world.events.map((e) => e.day));
    return `<section class="play"><div class="pstreak"><b>${st.now || 0}</b><span>${st.now ? 'days in a row!' : 'Grow something today'}</span></div>
      <div class="pbig">${growing.slice(0, 4).map(({ t }) => `<button data-t="${t.id}"><span>${REALM[t.source][0]}</span><b>${esc(t.title)}</b></button>`).join('')}</div>
      <div class="prow"><span class="ptro">🏆 <b>${done.length}</b> finished</span>${access(p) === 'own' && !NOSEED ? `<button id="playSeed">🌱 Plant${seeds.length ? ' · ' + seeds.length : ''}</button>` : ''}</div></section>`;
  }
  function playEntry(p) {
    const en = (p.entries || []).filter((x) => access(p) === 'own' || K.isShared(entryId(p, x)))[0];
    return en ? `<h3 class="k">Last time</h3><article class="pentry"><div class="d">${esc(nice(en.day, { weekday: 'long' }))}</div><p>${esc(en.body)}</p></article>` : '';
  }
  // Pilot: the real cockpit. A strip of instruments, each a number with a label.
  function gauges(p, sts, events) {
    const st = K.streak(events.map((e) => e.day)), wk = K.lastDays(events, 7), mo = K.lastDays(events, 30);
    const eff = (cells) => cells.reduce((s, c) => s + c.v, 0), by = (src) => sts.filter((x) => x.t.source === src).length;
    const g = [[st.now, 'streak'], [st.best, 'best run'], [st.total, 'active days'], [wk.filter((c) => c.v).length + '/7', 'this week'], [mo.filter((c) => c.v).length + '/30', 'this month'], [eff(wk), 'effort 7d'], [eff(mo), 'effort 30d'], [events.length, 'moments'], [by('tutor'), realmName(p, 'tutor').toLowerCase()], [by('chat'), 'chats'], [by('trip'), 'trips'], [by('game'), 'games']];
    return `<section class="gauges">${g.map(([n, l]) => `<span><b>${n}</b>${l}</span>`).join('')}</section>`;
  }
  // Developer: the raw event log, filterable and sortable, with export. Everything condensed.
  function devPanel(p) {
    const kinds = [...new Set(p.world.events.map((e) => e.kind))];
    return `<section class="dev"><div class="devh"><b>Event log</b><span id="devN"></span><button id="devCsv">Copy CSV</button><button id="devJson">Export JSON</button></div>
      <div class="devf"><input id="devQ" placeholder="filter: topic, text, date…" autocomplete="off"><select id="devSrc"><option value="">all sources</option>${Object.keys(REALM).map((k) => `<option value="${k}">${k}</option>`).join('')}</select></div>
      <div class="devk">${kinds.map((k) => `<button data-kind="${k}" class="on" style="--c:${FAMC[k] || '#B9A6FF'}">${k}</button>`).join('')}</div>
      <div class="devt"><table><thead><tr><th data-sort="day">day</th><th data-sort="src">src</th><th data-sort="topic">topic</th><th data-sort="kind">kind</th><th data-sort="effort">eff</th><th>note</th></tr></thead><tbody id="devB"></tbody></table></div></section>`;
  }
  function wireDev(p) {
    const a = access(p), tById = Object.fromEntries(p.world.topics.map((t) => [t.id, t]));
    const rows = p.world.events.map((e) => ({ id: e.id, day: e.day, src: (tById[e.topic] || {}).source || '', topic: (tById[e.topic] || {}).title || e.topic, tid: e.topic, kind: e.kind, effort: +e.effort || 1, note: a === 'own' || K.isShared(storyId(p, tById[e.topic] || {})) ? evText(e) : '·' }));
    let sort = 'day', dir = -1, off = new Set(), shown = [];
    function draw() {
      const q = $('devQ').value.trim().toLowerCase(), src = $('devSrc').value;
      shown = rows.filter((r) => !off.has(r.kind) && (!src || r.src === src) && (!q || (r.topic + ' ' + r.note + ' ' + r.day).toLowerCase().includes(q)))
        .sort((x, y) => (x[sort] > y[sort] ? 1 : x[sort] < y[sort] ? -1 : 0) * dir || String(y.day).localeCompare(String(x.day)));
      $('devN').textContent = shown.length + ' / ' + rows.length;
      $('devB').innerHTML = shown.slice(0, 200).map((r) => `<tr data-t="${esc(r.tid)}"><td>${esc(r.day.slice(5))}</td><td>${REALM[r.src] ? REALM[r.src][0] : ''}</td><td>${esc(r.topic)}</td><td><i style="background:${FAMC[r.kind] || '#B9A6FF'}"></i>${esc(r.kind)}</td><td>${r.effort}</td><td>${esc(r.note)}</td></tr>`).join('');
      $('body').querySelectorAll('.devt th[data-sort]').forEach((th) => th.classList.toggle('on', th.dataset.sort === sort));
      $('devB').querySelectorAll('[data-t]').forEach((tr) => (tr.onclick = () => renderStory(p, tById[tr.dataset.t])));
    }
    $('devQ').oninput = draw; $('devSrc').onchange = draw;
    $('body').querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { off.has(b.dataset.kind) ? off.delete(b.dataset.kind) : off.add(b.dataset.kind); b.classList.toggle('on'); draw(); }));
    $('body').querySelectorAll('.devt th[data-sort]').forEach((th) => (th.onclick = () => { dir = sort === th.dataset.sort ? -dir : th.dataset.sort === 'day' ? -1 : 1; sort = th.dataset.sort; draw(); }));
    const csv = () => ['day,source,topic,kind,effort,note', ...shown.map((r) => [r.day, r.src, r.topic, r.kind, r.effort, r.note].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))].join('\n');
    $('devCsv').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(csv()).catch(() => {}); $('devCsv').textContent = 'Copied ' + shown.length; setTimeout(() => ($('devCsv').textContent = 'Copy CSV'), 1600); };
    $('devJson').onclick = () => { const b = new Blob([JSON.stringify({ person: p.id, exported: K.today(), topics: p.world.topics, events: shown.map((r) => r.id) }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = p.id + '-world.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 500); };
    draw();
  }
  // Context card: an overview of a group (count, last 2 weeks, who's in it) that opens into rows.
  function ctxCard(p, key, title, list, color, sum, open) {
    if (!list.length) return '';
    const evs = list.flatMap((x) => x.s.evs), peek = list.slice(0, 3).map((x) => REALM[x.t.source][0] + ' ' + esc(x.t.title)).join('<i>·</i>') + (list.length > 3 ? `<i>·</i>+${list.length - 3} more` : '');
    const row = ({ t, s }) => `<button class="crow" data-t="${t.id}"><span class="em">${REALM[t.source][0]}</span><span class="mid"><b>${esc(t.title)}</b><small>${s.done ? 'finished ' + short(lastOf(p, t)) : s.resting ? 'resting · ' + s.quiet + 'd quiet' : s.quiet === 0 ? 'grew today' : 'grew ' + short(lastOf(p, t))} · ${s.evs.length} moment${s.evs.length === 1 ? '' : 's'}</small></span><span class="go">›</span></button>`;
    return `<section class="ctx${open ? ' open' : ''}" data-ctx="${key}"><button class="ctxh" data-ctxt aria-expanded="${open}"><span class="top"><b>${title}</b><span class="n" style="color:${color}">${list.length}</span><span class="chev">⌄</span></span><span class="sum">${sum}</span>${days14(evs, color)}<span class="peek">${peek}</span></button><div class="ctxb">${list.map(row).join('')}</div></section>`;
  }
  // ---------- the clearing ----------
  function renderTogether() {
    const HOME = window.R4Home || null;
    stop(); if (HOME) applyDensity(viewer); else { document.body.classList.remove('dens-play', 'dens-pilot', 'dens-dev'); document.body.classList.add('dens-explore'); }
    $('title').textContent = HOME ? 'home' : 'Family'; $('back').hidden = true; $('markA').hidden = false; $('worldBox').classList.remove('solo');
    $('hint').textContent = '';
    live = window.mountTogether($('cv'), F, { onPick: pickTogether });
    const sh = live.shared;
    $('legend').innerHTML = F.map((p) => `<span><i style="display:inline-block;flex:none;width:7px;height:7px;border-radius:9px;background:${DOT[p.id]};margin-right:6px"></i>${esc(p.name)}</span>`).join('');
    $('private').hidden = !!HOME;
    $('private').textContent = viewer.role === 'parent'
      ? 'Everyone’s tree, on one ground. Roots are games you played together; stars are trips you shared. You see the kids’ topic names, and only what they choose to share.'
      : 'Everyone’s tree, on one ground. You see the others’ trees as shapes. What you write stays yours unless you share it.';
    const who = (s) => s.who.map((w) => F[w.pi].name).join(' · ');
    const shared = Object.entries(K.sharedAll()).filter(([id]) => F.some((p) => id.split(':')[1] === p.id)).sort((a, b) => String(b[1].day || '').localeCompare(String(a[1].day || ''))).slice(0, 8);
    $('body').innerHTML = (shared.length ? `<h3 class="k">Shared with the family</h3><div class="sharedlist">${shared.map(([id, m]) => { const p = byId(id.split(':')[1]); return `<button data-shared="${esc(id)}"><i class="dot" style="background:${DOT[p.id]}"></i><span><b>${esc(m.title || '')}</b><small>${esc(p.name)} · ${m.kind === 'story' ? 'a story' : esc(short(m.day))}</small><em>${esc(m.text || '')}</em></span></button>`; }).join('')}</div>` : '')
      + `<h3 class="k">Growing together</h3><div class="topics">${sh.map((s) => `<button data-s="${s.slug}">${REALM[s.source][0]} ${esc(s.title)}<small>${esc(who(s))}</small></button>`).join('')}</div>
      <h3 class="k">Worlds</h3><div class="people">${F.map((p) => { const a = access(p), n = p.world.topics.length, st = K.streak(p.world.events.map((e) => e.day)); return `<button data-p="${p.id}"><i class="dot" style="background:${DOT[p.id]};box-shadow:0 0 8px ${DOT[p.id]}"></i><span><b>${p.id === viewer.id ? 'My world' : esc(p.name) + '’s world'}</b><small>${n} things growing${st.now ? ' · ' + st.now + '-day streak' : ''}</small></span><span class="lock">${a === 'own' ? 'open ›' : a === 'names' ? 'names only ›' : 'theirs'}</span></button>`; }).join('')}</div>`;
    if (HOME) { const top = document.createElement('div'); top.id = 'homeTop'; $('body').prepend(top); HOME.render(top, { viewer, family: F, dens, picker: densityPicker(viewer), openWorld: (id) => openPerson(byId(id)), openStory: (pid, tid) => go({ kind: 'world', id: pid, topic: tid }), esc, short, nice, K, REALM });
      wireDensity(viewer, () => renderTogether()); const fam = document.createElement('section'); fam.className = 'ctx devcard grp'; fam.innerHTML = '<button class="ctxh" data-ctxt aria-expanded="false"><span class="top"><b>Family</b><span class="n" style="color:#F5C542">' + F.length + '</span><span class="chev">⌄</span></span><span class="sum">Worlds, shared stories, growing together</span></button><div class="ctxb"></div>'; const kids = [...$('body').children].filter((x) => x !== top); kids.forEach((x) => fam.querySelector('.ctxb').append(x)); $('body').append(fam); }
    $('body').querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => pickTogether({ shared: sh.find((s) => s.slug === b.dataset.s) })));
    $('body').querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => openPerson(byId(b.dataset.p))));
    $('body').querySelectorAll('[data-shared]').forEach((b) => (b.onclick = () => {
      const parts = b.dataset.shared.split(':'), kind = parts[0], pid = parts[1], rest = parts.slice(2).join(':');
      const p = byId(pid);
      if (kind === 'story' && access(p) !== 'none') return go({ kind: 'world', id: p.id, topic: rest });
      const m = K.sharedAll()[b.dataset.shared] || {};
      $('pick').hidden = false; $('pick').innerHTML = `<h2>${esc(m.title || '')} <small>${esc(p.name)} shared this</small></h2><p>${esc(m.text || '')}</p>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }
  function openPerson(p) {
    if (access(p) !== 'none') return go({ kind: 'world', id: p.id });
    $('pick').hidden = false;
    $('pick').innerHTML = `<h2>${esc(p.name)}’s world <small>${p.world.topics.length} things growing</small></h2><p>This one is theirs. You see its shape here, on the family ground; only ${esc(p.name)} opens it. Anything they share shows up above.</p>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function pickTogether(hit) {
    if (!hit) { $('pick').hidden = true; return; }
    if (hit.person) return openPerson(hit.person);
    const s = hit.shared;
    $('pick').hidden = false;
    $('pick').innerHTML = `<h2>${REALM[s.source][0]} ${esc(s.title)} <small>${s.source === 'game' ? 'a root between your trees' : 'a star over your trees'}</small></h2>
      <ul>${s.who.map((w) => `<li><span>${esc(F[w.pi].name)}</span>${s.source === 'game' ? w.played + ' games' : 'was there'}</li>`).join('')}</ul>`;
  }

  // ---------- one world (diary.html) ----------
  function renderWorld(p) {
    stop();
    const a = access(p), w = p.world, topics = w.topics, events = w.events;
    applyDensity(p);
    $('title').textContent = SOLO ? SOLO.title : a === 'own' ? 'My diary' : p.name + '’s world'; $('back').hidden = !!SOLO; $('markA').hidden = !SOLO; $('worldBox').classList.add('solo');
    live = window.mountWorld($('cv'), { topics, events, projects: p.world.projects || [] }, { seeds: a === 'own' ? seedsOf(p) : [], onPick: (h) => pickWorld(p, h), budLabel: (e) => short(e.day) + ' · ' + (KIND[e.kind] || e.kind), onPlant: (at) => plantForm(p, at) });
    $('tools').hidden = false; $('plantBtn').hidden = a !== 'own' || NOSEED;
    $('zIn').onclick = () => live.zoomBy(1.8); $('zOut').onclick = () => live.zoomBy(1 / 1.8); $('zHome').onclick = () => live.reset();
    $('plantBtn').onclick = () => planting(!$('plantBtn').classList.contains('on'));
    planting(false);
    const n = (src) => topics.filter((t) => t.source === src).length;
    $('legend').innerHTML = Object.keys(REALM).filter((k) => n(k)).map((k) => `<span>${REALM[k][0]} ${realmName(p, k)} <b>${n(k)}</b></span>`).join('');
    $('private').hidden = true;
    if (view.topic) { const t = topics.find((x) => x.id === view.topic); view.topic = null; if (t) return renderStory(p, t); }
    renderHome(p);
  }
  const lastOf = (p, t) => p.world.events.filter((e) => e.topic === t.id).map((e) => e.day).pop() || t.created;
  function topicState(p, t) {
    const evs = p.world.events.filter((e) => e.topic === t.id), quiet = K.dn(K.today()) - K.dn(lastOf(p, t));
    return { evs, quiet, resting: t.stage === 'parked' || quiet > 14, done: t.stage === 'shipped' || evs.some((e) => e.kind === 'ship') };
  }
  function renderHome(p) {
    if (live && live.light) live.light(null);   // back from a story: the whole tree again
    const a = access(p), w = p.world, topics = w.topics, events = w.events, tById = Object.fromEntries(topics.map((t) => [t.id, t]));
    const sts = topics.map((t) => ({ t, s: topicState(p, t) })), growing = sts.filter((x) => !x.s.resting && !x.s.done), done = sts.filter((x) => x.s.done), resting = sts.filter((x) => x.s.resting && !x.s.done);
    const seeds = a === 'own' ? seedsOf(p) : [];
    const byLast = (x, y) => x.s.quiet - y.s.quiet;
    $('body').innerHTML = `<div class="who"><div class="whoh"><h2>${a === 'own' ? 'Your world' : esc(p.name) + '’s world'}</h2>${densityPicker(p)}</div><p>${topics.length} things growing in it${a === 'names' ? '. You see the names; what they wrote stays theirs unless they share it.' : '.'}</p></div>`
      + (dens === 'play' ? playHome(p, growing.sort(byLast), done, seeds) : '')
      + (dens === 'play' ? '' : progress(events, { counts: [[growing.length, 'growing', '#B9A6FF'], [done.length, 'finished', '#3DD6C6'], [resting.length, 'resting', '#7A73A8'], ...(a === 'own' && !NOSEED ? [[seeds.length, 'seeds', '#F5C542']] : [])] }))
      + (dens === 'pilot' ? gauges(p, sts, events) : '')
      + (dens === 'dev' ? `<section class="ctx devcard"><button class="ctxh" data-ctxt aria-expanded="false"><span class="top"><b>⌘ Developer</b><span class="n" style="color:#3DD6C6">${events.length}</span><span class="chev">⌄</span></span><span class="sum">Instruments, event log, export · ${topics.length} topics</span></button><div class="ctxb">${gauges(p, sts, events)}${devPanel(p)}</div></section>` : '')
      + (a === 'own' && dens !== 'play' && !NOSEED ? `<h3 class="k">Seeds</h3><div class="seeds">${seeds.map((s) => `<button data-seed="${s.id}">🌱 ${esc(s.title)}<small>planted ${esc(short(s.day))}</small></button>`).join('')}<button class="add" id="addSeed">＋ Plant a seed</button></div>${seeds.length ? '' : '<p class="note">Something you want to grow next. It sprouts on the ground and waits for you.</p>'}` : '')
      + (dens === 'play' ? '' : `<section class="ctx devcard grp"><button class="ctxh" data-ctxt aria-expanded="false"><span class="top"><b>Everything growing</b><span class="n" style="color:#B9A6FF">${topics.length}</span><span class="chev">⌄</span></span><span class="sum">${growing.length} growing · ${done.length} finished · ${resting.length} resting</span></button><div class="ctxb"><div class="ctxs">`
      + ctxCard(p, 'growing', 'Growing now', growing.sort(byLast), '#B9A6FF', (() => { const n14 = growing.filter((x) => x.s.quiet <= 14).length, top = growing[0]; return top ? `${n14} grew in the last 2 weeks · latest: ${esc(top.t.title)}, ${top.s.quiet === 0 ? 'today' : short(lastOf(p, top.t))}` : ''; })(), dens === 'explore')
      + ctxCard(p, 'done', 'Finished', done.sort(byLast), '#3DD6C6', done[0] ? `Most recent: ${esc(done[0].t.title)}, ${short(lastOf(p, done[0].t))}` : '', false)
      + ctxCard(p, 'resting', 'Resting', resting.sort((x, y) => y.s.quiet - x.s.quiet), '#7A73A8', resting.length ? `Quiet longest: ${esc(resting[0].t.title)}, ${resting[0].s.quiet} days` : '', false)
      + '</div></div></section>')
      + (SOLO && SOLO.cards && dens !== 'play' ? SOLO.cards.map((c) => `<section class="ctx devcard grp xc" data-xc="${c.id}"><button class="ctxh" data-ctxt aria-expanded="false"><span class="top"><b>${esc(c.title)}</b>${c.n != null ? `<span class="n" style="color:${c.color || '#B9A6FF'}">${c.n}</span>` : ''}<span class="chev">⌄</span></span><span class="sum">${esc(c.sum || '')}</span></button><div class="ctxb"><div class="xbody"></div></div></section>`).join('') : '')
      + (dens === 'play' ? playEntry(p) : journal(p, p.entries, tById, events))
      + (p.real ? `<p class="note" style="margin-top:18px">This tree is the Clearing diary. <a href="../diary/index.html">Open it in full ›</a></p>` : '');
    $('body').querySelectorAll('[data-t]').forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); renderStory(p, tById[b.dataset.t]); }));
    wireDensity(p, () => renderHome(p));
    if (dens === 'dev') wireDev(p);
    $('body').querySelectorAll('[data-xc]').forEach((sec) => sec.querySelector('.ctxh').addEventListener('click', () => { const el = sec.querySelector('.xbody'); if (el.dataset.on) return; el.dataset.on = 1; SOLO.mount(sec.dataset.xc, el, { openTopic: (id) => tById[id] && renderStory(p, tById[id]) }); }));
    if ($('playSeed')) $('playSeed').onclick = () => { full(true); planting(true); };
    $('body').querySelectorAll('[data-ctxt]').forEach((b) => (b.onclick = () => { const s = b.parentElement, on = !s.classList.contains('open'); s.classList.toggle('open', on); b.setAttribute('aria-expanded', on); }));
    wireJournal(p, p.entries, tById, events);
    $('body').querySelectorAll('[data-seed]').forEach((b) => (b.onclick = () => { const s = seeds.find((x) => x.id === b.dataset.seed); full(true); pickWorld(p, s.x == null ? { seed: s } : { seed: s, obj: { hit: { x: s.x, y: s.y - 14 } } }); }));
    if ($('addSeed')) $('addSeed').onclick = () => { full(true); planting(true); };
  }

  // ---------- one topic's story ----------
  function renderStory(p, t) {
    if (!t) return;
    const a = access(p), sid = storyId(p, t), read = canRead(p, sid), s = topicState(p, t), [emoji, , what] = REALM[t.source];
    live.focusTopic(t.id); $('pick').hidden = true;
    const chs = K.chapters(s.evs);
    $('body').innerHTML = `<button class="crumb" id="crumb">‹ ${a === 'own' ? 'Your world' : esc(p.name) + '’s world'}</button>
      <div class="who"><h2>${emoji} ${esc(t.title)}</h2><p>${what} · started ${esc(short(t.created))} · ${s.evs.length} moment${s.evs.length === 1 ? '' : 's'}${s.done ? ' · finished' : s.resting ? ' · resting' : ''}</p>${a === 'own' ? shareBtn(sid, K.isShared(sid)) : K.isShared(sid) ? '<span class="share on">✓ Shared with the family</span>' : ''}</div>`
      + progress(s.evs, { color: t.source === 'trip' ? '#F5C542' : '#B9A6FF' })
      + `<h3 class="k">The story · ${chs.length} chapter${chs.length === 1 ? '' : 's'}</h3>${read ? '' : '<p class="note">You see how it grew. What happened in each moment stays private unless it’s shared.</p>'}
      <ol class="story">${chs.slice().reverse().map((c) => `<li class="chap ${c.key}" data-chap><div class="ch"><span class="n">Chapter ${c.n}</span><b>${c.name}</b><span class="r">${esc(K.range(c.start, c.end))}</span></div>
        <div class="marks">${c.evs.map((e) => `<i style="background:${FAMC[e.kind] || '#B9A6FF'};--s:${(0.7 + (+e.effort || 1) * 0.12).toFixed(2)}" title="${esc(KIND[e.kind] || e.kind)}"></i>`).join('')}<span>${c.days} day${c.days === 1 ? '' : 's'}</span></div>
        ${read ? `<p class="lead">${esc(evText(c.evs[c.evs.length - 1]))}</p><ul class="evs">${c.evs.slice().reverse().map((e) => `<li><span>${esc(short(e.day))} · ${esc(KIND[e.kind] || e.kind)}</span>${esc(evText(e))}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`;
    $('crumb').onclick = () => { live.reset(); renderHome(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    $('body').querySelectorAll('[data-chap]').forEach((el) => (el.onclick = () => el.classList.toggle('open')));
    const first = $('body').querySelector('[data-chap]'); if (first && read) first.classList.add('open');
    wireShare($('body'), () => ({ kind: 'story', title: emoji + ' ' + t.title, day: lastOf(p, t), text: chs.length + ' chapters · latest: ' + (evText(s.evs[s.evs.length - 1]) || '').slice(0, 120) }));
    const top = $('worldBox').getBoundingClientRect().bottom + window.scrollY - 8; window.scrollTo({ top: Math.max(0, top - 60), behavior: 'smooth' });
  }

  // full screen: a story opens in the card (the panel on the right on a phone on its side, the sheet along
  // the bottom upright), and the world stays
  const inFull = () => document.body.classList.contains('isfull');
  function markMoment(id, scroll) {
    let hit = null;
    $('pick').querySelectorAll('[data-ev]').forEach((li) => { const on = li.dataset.ev === String(id); li.classList.toggle('on', on); if (on) hit = li; });
    if (hit && scroll) { hit.closest('[data-chap]')?.classList.add('open'); hit.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !!hit;
  }
  function storyPanel(p, t, back) {
    const read = canRead(p, storyId(p, t)), s = topicState(p, t), [emoji, , what] = REALM[t.source], chs = K.chapters(s.evs);
    $('pick').innerHTML = `<div class="row" style="margin-top:0"><button class="ghost" id="pback">‹ Back</button></div>
      <h2>${emoji} ${esc(t.title)} <small>${what} · started ${esc(short(t.created))} · ${s.evs.length} moment${s.evs.length === 1 ? '' : 's'}${s.done ? ' · finished' : s.resting ? ' · resting' : ''}</small></h2>
      ${read ? '' : '<p>You see how it grew. What happened in each moment stays private unless it’s shared.</p>'}
      <ol class="story pstory" data-topic="${esc(t.id)}">${chs.slice().reverse().map((c) => `<li class="chap ${c.key}${read ? ' open' : ''}" data-chap><div class="ch"><span class="n">Chapter ${c.n}</span><b>${c.name}</b><span class="r">${esc(K.range(c.start, c.end))}</span></div>
        <div class="marks">${c.evs.map((e) => `<i style="background:${FAMC[e.kind] || '#B9A6FF'};--s:${(0.7 + (+e.effort || 1) * 0.12).toFixed(2)}"></i>`).join('')}<span>${c.days} day${c.days === 1 ? '' : 's'}</span></div>
        ${read ? `<p class="lead">${esc(evText(c.evs[c.evs.length - 1]))}</p><ul class="evs">${c.evs.slice().reverse().map((e) => `<li data-ev="${esc(e.id)}"><span>${esc(short(e.day))} · ${esc(KIND[e.kind] || e.kind)}</span>${esc(evText(e))}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`;
    $('pback').onclick = back;
    // a moment here and its bud on the limb: tap one, the other lights
    $('pick').querySelectorAll('[data-ev]').forEach((li) => (li.onclick = (ev) => { ev.stopPropagation(); live.showEvent(li.dataset.ev); markMoment(li.dataset.ev, false); }));
    $('pick').querySelectorAll('[data-chap]').forEach((el) => (el.onclick = () => el.classList.toggle('open')));
    $('pick').scrollTop = 0;
  }

  const kindWord = { tutor: ['🌳', 'Something to learn', 'grows into a limb on your tree'], chat: ['✿', 'A wonder', 'grows into a flower'], trip: ['✶', 'Somewhere to go', 'hangs in the sky as stars'] };
  function pickWorld(p, h) {
    if (h.topic && h.topic.project) { location.href = '/projects.html?open=' + encodeURIComponent(h.topic.project); return; }
    const a = access(p);
    if (h.event) {
      const e = h.event, t = h.topic || {}, read = t.id ? canRead(p, storyId(p, t)) : a === 'own';
      live.focus(h);
      // its limb's story already open in the side panel: find the moment there instead
      if (!$('pick').hidden && t.id && $('pick').querySelector(`.pstory[data-topic="${CSS.escape(String(t.id))}"]`) && markMoment(e.id, true)) return;
      $('pick').hidden = false;
      $('pick').innerHTML = `<h2>${REALM[t.source || 'tutor'][0]} ${esc(t.title || '')} <small>${esc(short(e.day))} · ${esc(KIND[e.kind] || e.kind)}</small></h2>
        ${read ? `<p>${esc(evText(e) || 'No words for this one.')}</p>` : '<p>What happened stays private to them.</p>'}
        <div class="row"><button class="ghost" id="allOf">Read its story ›</button></div>
        ${read && t.id ? (() => { const s = topicState(p, t), rest = s.evs.filter((x) => x !== e).slice().reverse().slice(0, 30);   // the rest of its story: shown in the side panel (a phone on its side)
          return rest.length ? `<div class="pmore"><h3>The rest of its story · ${s.evs.length} moment${s.evs.length === 1 ? '' : 's'}</h3><ul>${rest.map((x) => `<li><small>${esc(short(x.day))} · ${esc(KIND[x.kind] || x.kind)}</small>${esc(evText(x) || '·')}</li>`).join('')}</ul></div>` : ''; })() : ''}`;
      $('allOf').onclick = () => (inFull() && t.id ? storyPanel(p, t, () => pickWorld(p, h)) : (full(false), renderStory(p, t)));
      return;
    }
    if (h.seed) {
      live.light(null); if (h.obj) live.focus(h);
      const s = h.seed, [em, word, grows] = kindWord[s.kind];
      $('pick').hidden = false;
      $('pick').innerHTML = `<h2>🌱 ${esc(s.title)} <small>${em} ${word} · planted ${esc(short(s.day))}</small></h2><p>Waiting for its first moment. When you start on it, it ${grows}.</p><div class="row"><button class="ghost" id="dig">Dig it up</button></div>`;
      $('dig').onclick = async () => { await window.R4Store.dig(p, s.id); live.setSeeds(seedsOf(p)); $('pick').hidden = true; if (!document.body.classList.contains('isfull')) renderHome(p); };
      return;
    }
    if (h.topic) { if (inFull()) { live.focusTopic(h.topic.id); return storyPanel(p, h.topic, () => { live.light(null); $('pick').hidden = true; }); } full(false); return renderStory(p, h.topic); }
    live.light(null);   // tapped away: the whole tree again, turning
    if (h.tree) return showTree(p);
    $('pick').hidden = true;
  }
  function showTree(p) {
    const a = access(p), limbs = p.world.topics.filter((x) => x.source === 'tutor');
    $('pick').hidden = false;
    $('pick').innerHTML = `<h2>🌳 ${a === 'own' ? 'Your tree' : esc(p.name) + '’s tree'} <small>${limbs.length} limb${limbs.length === 1 ? '' : 's'}</small></h2><div class="chips" style="margin-top:10px">${limbs.map((x) => `<button data-t="${x.id}">${esc(x.title)}</button>`).join('')}</div>`;
    $('pick').querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { const t = limbs.find((x) => x.id === b.dataset.t);
      if (inFull()) { live.focusTopic(t.id); return storyPanel(p, t, () => { live.light(null); showTree(p); }); }   // full screen: the limb's story in the same card
      full(false); renderStory(p, t); }));
  }
  function plantForm(p, at) {
    let kind = 'tutor';
    $('pick').hidden = false;
    $('pick').innerHTML = `<h2>🌱 Plant a seed</h2><p>Something you want to grow. It sprouts here and waits for you.</p>
      <div class="plantform"><input id="seedName" maxlength="60" placeholder="e.g. learn to juggle"><div class="kinds">${Object.entries(kindWord).map(([k, [em, w]]) => `<button data-k="${k}" class="${k === kind ? 'on' : ''}">${em} ${w}</button>`).join('')}</div>
      <div class="row"><button class="go" id="doPlant" style="margin-top:0">Plant it</button><button class="ghost" id="noPlant" style="margin-top:0">Cancel</button></div></div>`;
    $('pick').querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { kind = b.dataset.k; $('pick').querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('noPlant').onclick = () => { $('pick').hidden = true; planting(false); };
    $('doPlant').onclick = async () => {
      const title = $('seedName').value.trim(); if (!title) { $('seedName').focus(); return; }
      const seed = { id: 's' + Date.now(), title, kind, x: at.x, y: at.y, day: K.today() };
      $('doPlant').disabled = true;
      const saved = await window.R4Store.plant(p, seed); if (!saved) { $('doPlant').disabled = false; return; }
      Object.assign(seed, saved); live.setSeeds(seedsOf(p)); planting(false);
      pickWorld(p, { seed, obj: { hit: { x: at.x, y: at.y - 14 } } });
      renderHome(p);
    };
  }
  render();
})();
