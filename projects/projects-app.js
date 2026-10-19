/* Projects + workbench. Start from a kit, then ask Claude to change it (or use the parts shelf).
   Every change is a new version: undo, redo, restore. Live preview runs the real page; Test on
   phone shows it at phone size with a share link. Publish to the family; remix theirs; ask for
   a play-test in the chat. Kids have a separate daily build cap. Code view in Pilot/Developer. */
(function () {
  const $ = (id) => document.getElementById(id), K = window.StoryKit, F = window.FAMILY, PR = window.R4Projects;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (id) => F.find((p) => p.id === id);
  // r4box.com: the viewer is whoever is signed in, the list and Claude come from projects.html (R4Build).
  let viewer = byId(window.R4Me), list = PR.all(), open = null, tab = 'claude', dens = 'explore', chat = [];
  const CAP = 8, left = () => (viewer.role === 'parent' ? Infinity : window.R4Build.left ?? CAP);
  const save = () => PR.save(list);
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
  function toast(t) { const el = document.createElement('div'); el.className = 'ctoast'; el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2600); }
  function applyDensity() { dens = (() => { try { const v = localStorage.getItem('r4.density.' + viewer.id); if (['play', 'explore', 'pilot', 'dev'].includes(v)) return v; } catch {} return viewer.role === 'parent' ? 'pilot' : 'explore'; })(); document.body.classList.remove('dens-play', 'dens-explore', 'dens-pilot', 'dens-dev'); document.body.classList.add('dens-' + dens); if (dens === 'dev') document.body.classList.add('dens-pilot'); }
  // helpers: people the owner let in. They change the same project; each version records who made it.
  const canEdit = (p) => p.owner === viewer.id || (p.collab || []).includes(viewer.id);
  const helpers = (p) => (p.collab || []).map(byId).filter(Boolean);
  // ---------- the bench grows with the project: its level comes from how much it's been built ----------
  const LV = [['Sketch', 3], ['Build', 6], ['Craft', 10], ['Engineer', Infinity]];
  function level(p) {
    const P = p.versions[p.cur].params, D = PR.KITS[p.kit].defaults;
    const changed = Object.keys(D).filter((k) => JSON.stringify(P[k]) !== JSON.stringify(D[k])).length;
    const extra = (P.panels ? Math.max(0, P.panels.length - 3) : 0) + (P.lines ? Math.max(0, P.lines.length - 3) : 0) + (P.pads ? Math.max(0, (P.pads - 4) / 2) : 0);
    const score = (p.versions.length - 1) + changed + extra, i = LV.findIndex(([, max]) => score < max);
    return { n: i + 1, name: LV[i][0], score, next: LV[i][1] === Infinity ? null : LV[i][1] - score };
  }
  const TYPE_TAB = { game: '🎯 Rules', app: '⚙ Settings', page: '📝 Content', story: '🎞 Panels', toy: '🎛 Pads' };
  // Builder: how deep the bench goes for a person. Maker = kits that grow with the project; Developer = real code too.
  // Builder: how deep the bench goes. Standard is both: kits and code side by side. Maker only keeps
  // to kits (tools unlock as a project grows; a project can still outgrow its kit); Developer only
  // starts from code and shows the code of everything.
  // Builder: every project is code. Standard: kits and code side by side (start either way). Developer
  // only: start from code, no kits. (Older choices: "developer" stays; "maker" and "both" are standard.)
  const devOnly = (u) => { try { return localStorage.getItem('r4.builder.' + u.id) === 'developer'; } catch { return false; } };
  const dev = () => true, kits = () => !devOnly(viewer);
  const ctx = () => ({ sw, esc, toast, viewer: () => viewer, byId, canEdit, save, ago, left, spend: () => {}, claude: (p, q, files, logs, image) => window.R4Build.ask(p, q, files, logs, image), openBench: (id) => openBench(id), explain: (p, f, src) => window.R4Build.explain(p, f, src), sheet: (h) => sheet(h), markUp, withShot, phoneTest, shareSheet });
  // Bench ⇄ Preview: one switch, always in reach at the bottom of the screen
  function sw(mode, toBench, toPrev, code) {
    let el = document.getElementById('bsw'); if (!el) { el = document.createElement('div'); el.id = 'bsw'; el.className = 'bswitch'; el.setAttribute('role', 'tablist'); $('app').append(el); }
    el.innerHTML = `<button role="tab" aria-selected="${mode === 'bench'}" class="${mode === 'bench' ? 'on' : ''}" data-sw="bench">${code ? '⌨ Code' : '🛠 Bench'}</button><button role="tab" aria-selected="${mode === 'prev'}" class="${mode === 'prev' ? 'on' : ''}" data-sw="prev">▶ Preview</button>`;
    el.querySelector('[data-sw=bench]').onclick = () => mode === 'prev' && toBench && toBench();
    el.querySelector('[data-sw=prev]').onclick = () => mode === 'bench' && toPrev && toPrev();
  }
  const clearBench = () => document.querySelectorAll('.bswitch,.pvpanel').forEach((e) => e.remove());
  // ---------- mark up the preview and send it to Claude ----------
  // The preview is a sandboxed frame, so the page can't photograph it (and html2canvas can't run in
  // one): a small script added to the preview's own copy draws itself when asked (its page as an SVG
  // picture, canvases as images) and posts the picture back. The marks are drawn over it here, and
  // both go to Claude as one picture with what to change.
  const SHOT = "<script>addEventListener('message',function(e){if(!e.data||!e.data.r4shot)return;var back=function(u){parent.postMessage({r4shotback:u||null},'*')};try{var W=innerWidth,H=innerHeight,d=document.documentElement.cloneNode(true);var src=document.querySelectorAll('canvas'),cl=d.querySelectorAll('canvas');for(var i=0;i<src.length;i++){try{var im=document.createElement('img');im.src=src[i].toDataURL();im.setAttribute('style',src[i].getAttribute('style')||'');im.style.width=src[i].clientWidth+'px';im.style.height=src[i].clientHeight+'px';cl[i].replaceWith(im)}catch(x){}}d.querySelectorAll('script').forEach(function(s){s.remove()});var b=d.querySelector('body');if(b){b.style.transform='translate('+(-scrollX)+'px,'+(-scrollY)+'px)';}var xml=new XMLSerializer().serializeToString(d);var svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+W+'\" height=\"'+H+'\"><foreignObject width=\"100%\" height=\"100%\">'+xml+'</foreignObject></svg>';var img=new Image();img.onload=function(){try{var c=document.createElement('canvas');c.width=W;c.height=H;var g=c.getContext('2d');g.fillStyle=getComputedStyle(document.body).backgroundColor||'#000';g.fillRect(0,0,W,H);g.drawImage(img,0,0);back(c.toDataURL('image/jpeg',.85))}catch(x){back()}};img.onerror=function(){back()};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}catch(x){back()}})</script>";
  const withShot = (html) => { const i = html.toLowerCase().lastIndexOf('</body>'); return i < 0 ? html + SHOT : html.slice(0, i) + SHOT + html.slice(i); };
  function shoot(frame) {
    return new Promise((ok) => {
      const t = setTimeout(() => { removeEventListener('message', on); ok(null); }, 6000);
      function on(e) { if (e.source !== frame.contentWindow || !e.data || !('r4shotback' in e.data)) return; clearTimeout(t); removeEventListener('message', on); ok(e.data.r4shotback); }
      addEventListener('message', on); frame.contentWindow.postMessage({ r4shot: 1 }, '*');
    });
  }
  // send(text, image) asks Claude and makes the change; it returns Claude's reply.
  function markUp(pn, frame, send) {
    if (pn.querySelector('.mk')) return;
    const bar = document.createElement('form'); bar.className = 'mk';
    bar.innerHTML = `<p class="mksay" hidden></p><div class="mkrow"><button type="button" class="bb" data-mk="clear" title="Clear the marks">↺</button><input placeholder="What should change where you marked?" autocomplete="off" aria-label="What to change"><button class="go mkgo">✦ Send</button><button type="button" class="bb" data-mk="off" aria-label="Stop marking">✕</button></div><small class="mkhint">Draw on the preview to point at what you mean.</small>`;
    pn.append(bar);   // first: the bar takes its room, then the marks cover what's left of the preview
    const r = frame.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const cv = document.createElement('canvas'); cv.className = 'mkc';
    Object.assign(cv.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 36, touchAction: 'none', cursor: 'crosshair' });
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.lineCap = g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#FF3B30';
    let down = false, marks = 0;
    cv.onpointerdown = (e) => { down = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(e.offsetX, e.offsetY); };
    cv.onpointermove = (e) => { if (!down) return; g.lineTo(e.offsetX, e.offsetY); g.stroke(); marks++; };
    cv.onpointerup = cv.onpointercancel = () => { down = false; };
    pn.append(cv);
    const say = (t) => { const p = bar.querySelector('.mksay'); p.hidden = !t; p.textContent = t || ''; };
    const stop = () => { cv.remove(); bar.remove(); pn.querySelector('#kmk, #pmk')?.classList.remove('on'); };
    bar.querySelector('[data-mk=clear]').onclick = () => { g.clearRect(0, 0, cv.width, cv.height); marks = 0; };
    bar.querySelector('[data-mk=off]').onclick = stop;
    bar.onsubmit = async (e) => {
      e.preventDefault();
      const input = bar.querySelector('input'), text = input.value.trim();
      if (!text && !marks) { say('Draw on the preview or say what to change.'); return; }
      const btn = bar.querySelector('.mkgo'); btn.disabled = true; say('Looking at your marks…');
      try {
        // the preview's picture, the marks over it, at most 1000 px wide
        const shot = await shoot(frame), k = Math.min(1, 1000 / r.width), out = document.createElement('canvas');
        out.width = Math.round(r.width * k); out.height = Math.round(r.height * k);
        const o = out.getContext('2d'); o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
        if (shot) { const im = new Image(); await new Promise((ok) => { im.onload = ok; im.onerror = ok; im.src = shot; }); o.drawImage(im, 0, 0, out.width, out.height); }
        o.drawImage(cv, 0, 0, out.width, out.height);
        const reply = await send((text || 'Change what I marked.') + (shot ? '' : ' (The preview couldn’t be pictured: only my marks are in the image.)'), out.toDataURL('image/jpeg', 0.82));
        input.value = ''; g.clearRect(0, 0, cv.width, cv.height); marks = 0; say('✦ ' + reply);
      } catch (err) { say(err.message); }
      btn.disabled = false;
    };
    setTimeout(() => bar.querySelector('input').focus(), 50);
  }
  function openKitPanel(p) {
    const pn = document.createElement('section'); pn.className = 'pvpanel';
    pn.innerHTML = `<header><button class="sb" id="kclose" aria-label="Back to the bench">‹</button><span><b>${esc(p.name)}</b><small id="kver">v${p.versions[p.cur].v}</small></span><span class="grow"></span>${canEdit(p) ? '<button class="bb" id="kmk" title="Mark it up and ask Claude">✏️ Mark</button>' : ''}<button class="bb" id="kre" title="Start again">↻</button><button class="bb" id="kph" aria-label="Test on phone">📱</button></header><iframe id="kpv" title="Preview" sandbox="allow-scripts"></iframe>`;
    $('app').append(pn);
    const show = () => { const q = cur() || p; $('kpv').srcdoc = withShot(PR.html(q)); $('kver').textContent = 'v' + q.versions[q.cur].v; };
    show();
    const close = () => history.back();
    $('kclose').onclick = close; $('kre').onclick = show; $('kph').onclick = () => phoneTest(cur() || p);
    const mk = $('kmk'); if (mk) mk.onclick = () => { if (pn.querySelector('.mk')) return pn.querySelector('[data-mk=off]').click(); mk.classList.add('on');
      markUp(pn, $('kpv'), async (text, image) => {
        const q = cur(), r2 = await window.R4Build.ask(q, text, null, null, image);
        chat.push({ me: true, t: '✏️ ' + text }, { t: r2.say, ok: !!(r2.change || r2.files) });
        if (r2.files) { q.versions = q.versions.slice(0, q.cur + 1); q.versions.push({ v: q.versions[q.versions.length - 1].v + 1, at: Date.now(), note: r2.note, params: {}, files: r2.files, by: viewer.id }); q.cur = q.versions.length - 1; if (r2.name) q.name = r2.name; save(); show(); openBench(q.id, r2.say); }
        else if (r2.change) { commit(q, r2.change, r2.note); show(); }
        return r2.say + (r2.change ? ' (v' + q.versions[q.cur].v + ')' : '');
      }); };
    history.pushState({ bench: p.id, pv: 1 }, ''); sw('prev', close, null);
  }
  const codeOK = () => dens === 'pilot' || dens === 'dev';

  // ---------- home: mine, kits, the family's ----------
  function card(p, mine) {
    const k = PR.KIND[PR.kindOf(p)], v = p.versions[p.cur];
    const team = helpers(p), asked = (p.requests || []).includes(viewer.id), req = (p.requests || []).length;
    const sub = mine === 'together' ? 'with ' + esc(byId(p.owner).name) + (team.length > 1 ? ' + ' + (team.length - 1) : '') : mine ? (p.published ? '<i class="pub">published</i>' : 'draft') + (team.length ? ' · 🤝 ' + team.map((h) => esc(h.name)).join(', ') : '') : 'by ' + esc(byId(p.owner).name);
    return `<div class="pcard" style="--kc:${k[2]}"><button class="pmain" data-open="${p.id}"><span class="pe">${v.params.sprite || PR.KITS[p.kit].em}</span><span class="pt"><b>${esc(p.name)}</b><small>${k[1]} · v${v.v} · ${ago(v.at)} · ${sub}</small></span></button>${mine === true && req ? `<span class="preq">${req} want${req === 1 ? 's' : ''} to help</span>` : ''}${mine ? '' : `<span class="pacts"><button data-play="${p.id}">▶ Play</button><button data-help="${p.id}"${asked ? ' disabled' : ''}>${asked ? 'Asked' : '🤝 Help'}</button><button data-remix="${p.id}">⑂ Remix</button></span>`}</div>`;
  }
  function renderHome() {
    clearBench(); open = null; $('title').textContent = 'projects'; $('back').hidden = true; $('mark').hidden = false;
    const mine = list.filter((p) => p.owner === viewer.id && !p.archived).sort((a, b) => lastAt(b) - lastAt(a));
    const together = list.filter((p) => p.owner !== viewer.id && !p.archived && (p.collab || []).includes(viewer.id));
    const fam = list.filter((p) => p.owner !== viewer.id && p.published && !p.archived && !(p.collab || []).includes(viewer.id));
    const allMine = list.filter((p) => p.owner === viewer.id).length;
    const l = left();
    $('body').innerHTML = `<div class="who"><h2>${dens === 'play' ? 'Make something!' : 'Your projects'}</h2><p>${viewer.role === 'parent' ? 'Pick something to start, then ask Claude to change it.' : `Pick something to start, then ask Claude to change it. <b class="cap">${l} of ${CAP}</b> builds left today.`}</p></div>
      ${mine.length ? `<div class="plist">${mine.slice(0, 3).map((p) => card(p, true)).join('')}</div>` : `<p class="note">${allMine ? 'Everything is put away.' : `Nothing yet. Pick ${kits() ? 'a kit' : 'a starting point'} below.`}</p>`}
      ${allMine > Math.min(3, mine.length) || allMine > 3 ? `<button class="plib" id="plib">🗂 All your projects <b>${allMine}</b><span>›</span></button>` : ''}
      ${together.length ? `<h3 class="k">Making together</h3><div class="plist">${together.map((p) => card(p, 'together')).join('')}</div>` : ''}
      ${kits() ? `<h3 class="k">Start something</h3><div class="kits">${CATS.map((c) => `<button class="kit" data-cat="${c.id}" style="--kc:${c.color}"><span class="ke">${c.em}</span><b>${c.name}</b><small>${c.blurb}</small></button>`).join('')}</div>` : ''}
      ${dev() && window.CodeBench ? `<h3 class="k">Start from code</h3><div class="kits">${Object.entries(CodeBench.TEMPLATES).map(([id, t]) => `<button class="kit code" data-tpl="${id}" style="--kc:#7DF0C8"><span class="ke">⌨</span><b>${t.name}</b><small>${t.blurb}</small></button>`).join('')}</div>` : ''}
      ${fam.length ? `<h3 class="k">Made by the family</h3><div class="plist">${fam.map((p) => card(p, false)).join('')}</div>` : ''}`;
    $('body').querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openBench(b.dataset.open)));
    const lb = $('plib'); if (lb) lb.onclick = () => { history.pushState({ lib: 1 }, '', '?lib=1'); renderLibrary(); };
    $('body').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => ideas(CATS.find((c) => c.id === b.dataset.cat))));
    $('body').querySelectorAll('[data-tpl]').forEach((b) => (b.onclick = () => { const p = CodeBench.create(b.dataset.tpl, ctx()); list.push(p); save(); openBench(p.id); }));
    $('body').querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => player(list.find((p) => p.id === b.dataset.play))));
    $('body').querySelectorAll('[data-remix]').forEach((b) => (b.onclick = () => remix(b.dataset.remix)));
    $('body').querySelectorAll('[data-help]').forEach((b) => (b.onclick = () => askHelp(list.find((p) => p.id === b.dataset.help))));
  }
  // ---------- the library: every project of yours, found, sorted, renamed, put away ----------
  const lastAt = (p) => Math.max(...p.versions.map((v) => v.at || 0));
  let libQ = '', libF = 'all', libS = 'recent', fromLib = false;
  function renderLibrary() {
    clearBench(); open = null; $('title').textContent = 'library'; $('back').hidden = false; $('mark').hidden = true;
    const mine = list.filter((p) => p.owner === viewer.id || (p.collab || []).includes(viewer.id));
    const kindOf = (p) => (PR.isCode(p) ? 'code' : PR.kindOf(p));
    const F = [['all', 'All'], ['game', '🎮 Games'], ['app', '🧰 Apps'], ['page', '🌐 Pages'], ['story', '📖 Stories'], ['toy', '🎨 Toys'], ['code', '⌨ Code'], ['published', 'Published'], ['draft', 'Drafts'], ['archived', '🗄 Put away']];
    const pass = (p) => libF === 'archived' ? p.archived : !p.archived && (libF === 'all' || (libF === 'published' ? p.published : libF === 'draft' ? !p.published : kindOf(p) === libF));
    const q = libQ.trim().toLowerCase();
    const shown = mine.filter((p) => pass(p) && (!q || (p.name + ' ' + PR.KITS[p.kit].name + ' ' + p.versions.map((v) => v.note).join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => libS === 'name' ? a.name.localeCompare(b.name) : libS === 'oldest' ? a.versions[0].at - b.versions[0].at : lastAt(b) - lastAt(a));
    const count = (id) => mine.filter((p) => (id === 'archived' ? p.archived : !p.archived && (id === 'all' || (id === 'published' ? p.published : id === 'draft' ? !p.published : kindOf(p) === id)))).length;
    const row = (p) => { const k = PR.KIND[PR.kindOf(p)], v = p.versions[p.cur], own = p.owner === viewer.id;
      return `<div class="pcard lrow${p.archived ? ' arch' : ''}" style="--kc:${k[2]}"><button class="pmain" data-open="${p.id}"><span class="pe">${v.params.sprite || PR.KITS[p.kit].em}</span><span class="pt"><b>${esc(p.name)}</b><small>${PR.isCode(p) ? '⌨ Code' : k[1]} · v${v.v} · ${p.versions.length} version${p.versions.length === 1 ? '' : 's'} · ${ago(lastAt(p))} · ${own ? (p.published ? '<i class="pub">published</i>' : 'draft') : 'with ' + esc(byId(p.owner).name)}</small></span></button>${own ? `<button class="pmore" data-menu="${p.id}" aria-label="More for ${esc(p.name)}">⋯</button>` : ''}</div>`; };
    $('body').innerHTML = `<div class="who"><h2>All your projects</h2><p>${mine.length} in all${count('archived') ? ` · ${count('archived')} put away` : ''}.</p></div>
      <div class="lbar"><input id="lq" placeholder="Search names and changes…" value="${esc(libQ)}" autocomplete="off" aria-label="Search projects"><select id="ls" aria-label="Sort"><option value="recent">Recent</option><option value="name">A–Z</option><option value="oldest">Oldest</option></select></div>
      <div class="lchips">${F.filter(([id]) => id === 'all' || id === libF || count(id)).map(([id, l]) => `<button data-f="${id}" class="${id === libF ? 'on' : ''}">${l} <small>${count(id)}</small></button>`).join('')}</div>
      <div class="plist">${shown.length ? shown.map(row).join('') : `<p class="note">${q ? 'Nothing matches “' + esc(libQ) + '”.' : libF === 'archived' ? 'Nothing put away.' : 'Nothing here yet.'}</p>`}</div>`;
    $('ls').value = libS;
    const lq = $('lq'); lq.oninput = () => { libQ = lq.value; const pos = lq.selectionStart; renderLibrary(); const n = $('lq'); n.focus(); n.setSelectionRange(pos, pos); };
    $('ls').onchange = () => { libS = $('ls').value; renderLibrary(); };
    $('body').querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { libF = b.dataset.f; renderLibrary(); }));
    $('body').querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { fromLib = true; openBench(b.dataset.open); }));
    $('body').querySelectorAll('[data-menu]').forEach((b) => (b.onclick = () => projectMenu(list.find((p) => p.id === b.dataset.menu))));
  }
  function projectMenu(p) {
    const d = sheet(`<div class="playh"><b>${esc(p.name)}</b><small>${p.versions.length} versions · started ${ago(p.versions[0].at)} ago</small><button data-close aria-label="Close">✕</button></div>
      <div class="pmenu"><label class="tin"><span>Name</span><input id="pmn" value="${esc(p.name)}" maxlength="60"></label>
      <button data-a="open">▶ Open</button><button data-a="dup">⧉ Duplicate</button><button data-a="arch">${p.archived ? '↩ Bring back' : '🗄 Put away'}</button><button data-a="del" class="bad">🗑 Delete…</button></div>`);
    const nm = d.querySelector('#pmn');
    nm.onchange = () => { const v = nm.value.trim(); if (v && v !== p.name) { p.name = v; save(); toast('Renamed.'); renderLibrary(); } };
    d.querySelector('.pmenu').addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'open') { d.close(); return openBench(p.id); }
      if (a === 'dup') { const c = JSON.parse(JSON.stringify(p)); Object.assign(c, { id: p.kit + '-' + Date.now().toString(36), name: p.name + ' copy', published: false, archived: false, collab: [], requests: [], from: { id: p.id, owner: p.owner, name: p.name } }); list.push(c); save(); d.close(); toast('⧉ Copied.'); return renderLibrary(); }
      if (a === 'arch') { p.archived = !p.archived; if (p.archived) p.published = p.published; save(); d.close(); toast(p.archived ? '🗄 Put away. Find it under Put away.' : '↩ Back with your projects.'); return renderLibrary(); }
      if (a === 'del') {
        const b = e.target.closest('[data-a]');
        if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '🗑 Tap again to delete for good'; return; }
        try { await window.R4Build.remove(p.id); list.splice(list.indexOf(p), 1); d.close(); toast('Deleted.'); renderLibrary(); } catch (err) { toast(err.message); }
      }
    });
  }
  function askHelp(p) {
    p.requests = [...new Set([...(p.requests || []), viewer.id])];
    window.R4Build.askHelp(p.id).then(() => window.R4Build.post('@' + byId(p.owner).name + ' can I help on ' + p.name + '?', p.id))
      .then(() => toast('🤝 Asked ' + byId(p.owner).name + '. They’ll see it in Share and in the chat.'), (e) => toast(e.message)); renderHome();
  }
  // ---------- categories: a few ideas each, from a kit with its settings, some finished by Claude ----------
  const CATS = [
    { id: 'game', em: '🎮', name: 'Games', color: '#3DD6C6', blurb: 'Catch, dodge, chase, score.', ideas: [
      { em: '🧺', name: 'Catch game', blurb: 'Move the basket, catch the stars.', kit: 'catch' },
      { em: '🚀', name: 'Space catch', blurb: 'A rocket catching planets, fast, in the dark.', kit: 'catch', set: { title: 'Space catch', sprite: '🚀', item: '🪐', bg: '#000000', color: '#B9A6FF', speed: 1.6 } },
      { em: '🐟', name: 'Deep sea catch', blurb: 'A fish catching glowing things.', kit: 'catch', set: { title: 'Deep sea catch', sprite: '🐟', item: '✨', bg: '#061a33', color: '#3DD6C6' } },
      { em: '🪨', name: 'Dodge the rocks', blurb: 'Rocks fall: don’t get hit. Three lives.', kit: 'catch', set: { title: 'Dodge!', sprite: '🏃', item: '🪨' }, ask: 'Turn this into a dodge game: the falling things are rocks to avoid, not catch. Start with 3 lives (show them as hearts), lose one on a hit, the score goes up the longer you survive, and show Game over with a tap to play again.' },
    ] },
    { id: 'app', em: '🧰', name: 'Apps', color: '#F5C542', blurb: 'Timers, counters, tools.', ideas: [
      { em: '⏱', name: 'Focus timer', blurb: '25 minutes, then a beep.', kit: 'timer', set: { title: 'Focus timer', minutes: 25 } },
      { em: '🍵', name: 'Tea timer', blurb: 'Three minutes, big and gold.', kit: 'timer', set: { title: 'Tea timer', minutes: 3, color: '#F5C542' } },
      { em: '💪', name: 'Workout timer', blurb: '30 seconds on, 10 off, rounds counted.', kit: 'timer', set: { title: 'Workout' }, ask: 'Turn this into an interval workout timer: 30 seconds of work, then 10 seconds of rest, repeated for 8 rounds. Show which it is (WORK or REST) in big letters with different colours, the round number, a beep at each switch, and Start/Pause/Reset.' },
      { em: '🔢', name: 'Tally counter', blurb: 'Tap to count; laps, reps, anything.', kit: 'timer', set: { title: 'Counter' }, ask: 'Turn this into a tally counter: a huge number in the middle, a big + button (and tap anywhere to add one), a smaller − button, a reset button, and it remembers the count on this device.' },
    ] },
    { id: 'page', em: '🌐', name: 'Pages', color: '#B9A6FF', blurb: 'About you, or something you love.', ideas: [
      { em: '😎', name: 'About me', blurb: 'A page about you.', kit: 'page' },
      { em: '❤️', name: 'Something I love', blurb: 'Three reasons, one big emoji.', kit: 'page', set: { title: 'Why I love sharks', sprite: '🦈', color: '#3DD6C6', lines: ['They’ve been around longer than trees.', 'Some glow in the dark.', 'They never run out of teeth.'] } },
      { em: '🏆', name: 'Fan page', blurb: 'Your team, band or game, with a fact card.', kit: 'page', set: { title: 'Fan page', sprite: '🏆' }, ask: 'Turn this into a fan page: a big title with an emoji, a short intro, a grid of 4 fact cards, and a "Random fact" button that shows one of the facts. Leave the facts as easy-to-change text for me to fill in.' },
    ] },
    { id: 'story', em: '📖', name: 'Stories', color: '#FF5A4A', blurb: 'Comics and adventures.', ideas: [
      { em: '🐉', name: 'Comic strip', blurb: 'Three panels: a dragon, a door, pizza.', kit: 'comic' },
      { em: '🛸', name: 'Space comic', blurb: 'Lost in space in four panels.', kit: 'comic', set: { title: 'Lost in space', color: '#B9A6FF', panels: [{ e: '🚀', t: 'We took off on a Tuesday.' }, { e: '🌑', t: 'The moon was not where the map said.' }, { e: '👽', t: 'Someone waved.' }, { e: '🍪', t: 'They wanted to trade cookies.' }] } },
      { em: '🔀', name: 'Choose your path', blurb: 'A story where you pick what happens.', kit: 'comic', set: { title: 'Choose your path' }, ask: 'Turn this into a choose-your-own-adventure: show one scene at a time (an emoji and a few lines), with two buttons for what to do next, at least 6 scenes with two different endings, and a Start again button.' },
    ] },
    { id: 'toy', em: '🎨', name: 'Music & art', blurb: 'Make sounds, make pictures.', ideas: [
      { em: '🥁', name: 'Drum pad', blurb: 'Four pads, tap to play.', kit: 'drums' },
      { em: '🎛', name: 'Big beat pad', blurb: 'Eight pads, in red.', kit: 'drums', set: { title: 'Big beat pad', pads: 8, color: '#FF5A4A' } },
      { em: '🎹', name: 'Piano', blurb: 'An octave of keys you can play.', kit: 'drums', set: { title: 'Piano' }, ask: 'Turn this into a little piano: one octave of white and black keys laid out like a real keyboard, each playing its note (C4 to C5) when tapped, keys light up while pressed, and the computer keys A S D F G H J K play them too.' },
      { em: '🖌', name: 'Finger painting', blurb: 'Draw with your finger, pick colours.', kit: 'drums', set: { title: 'Paint' }, ask: 'Turn this into a finger-painting app: a full-screen canvas you draw on with your finger or mouse, a row of 6 colour swatches, a brush-size slider, and a Clear button.' },
    ] },
  ];
  function ideas(cat) {
    const left0 = left(), d = sheet(`<div class="playh"><b>${cat.em} ${esc(cat.name)}</b><small>Pick one to start</small><button data-close aria-label="Close">✕</button></div>
      <div class="ideas">${cat.ideas.map((x, i) => `<button class="idea" data-i="${i}" style="--kc:${cat.color}"><span class="ie">${x.em}</span><span class="it"><b>${esc(x.name)}${x.ask ? ' <i>✦ Claude builds it</i>' : ''}</b><small>${esc(x.blurb)}</small></span><span class="ig">›</span></button>`).join('')}</div>
      ${cat.ideas.some((x) => x.ask) && left0 !== Infinity ? `<p class="note" style="margin:8px 2px 0">✦ ideas use one of your builds (${left0} left today).</p>` : ''}`);
    d.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { const x = cat.ideas[+b.dataset.i]; d.close(); newFromKit(x.kit, x.set, x.ask); }));
  }
  function newFromKit(kit, set = {}, autoAsk) {
    const k = { ...PR.KITS[kit], defaults: { ...PR.KITS[kit].defaults, ...set } }, id = kit + '-' + Date.now().toString(36);
    // every project is code: the kit is where it starts, as real files (its settings live in main.js)
    const p = { id, owner: viewer.id, kit, name: k.defaults.title, published: false, versions: [{ v: 1, at: Date.now(), note: 'Started from ' + k.name, params: { ...k.defaults }, files: PR.kitFiles(kit, k.defaults) }], cur: 0 };
    list.push(p); save(); openBench(id, null, autoAsk);
  }
  function remix(id) {
    const s = list.find((p) => p.id === id), v = s.versions[s.cur];
    const files = v.files || PR.kitFiles(s.kit, { ...v.params, title: s.name + ' remix' });
    const p = { id: s.kit + '-' + Date.now().toString(36), owner: viewer.id, kit: s.kit, name: s.name + ' remix', published: false, from: { id: s.id, owner: s.owner, name: s.name }, versions: [{ v: 1, at: Date.now(), note: 'Remixed from ' + byId(s.owner).name + '’s ' + s.name, params: { ...v.params, title: s.name + ' remix' }, files }], cur: 0 };
    list.push(p); save(); toast('⑂ Remixed. It’s yours to change.'); openBench(p.id);
  }

  // ---------- versions ----------
  function commit(p, change, note) {
    const base = p.versions[p.cur].params, params = { ...base, ...change };
    p.versions = p.versions.slice(0, p.cur + 1);   // a change after undo drops the redo tail
    p.versions.push({ v: p.versions[p.versions.length - 1].v + 1, at: Date.now(), note, params, by: viewer.id }); p.cur = p.versions.length - 1;
    if (change.title) p.name = change.title;
    save(); paintBench();
  }

  // ---------- Claude (project-build: settings for a kit, files for code) ----------
  let asking = false;
  async function ask(text) {
    const p = list.find((x) => x.id === open); text = text.trim(); if (!text || asking) return;
    chat.push({ me: true, t: text }, { t: '…', wait: true }); asking = true; paintTab();
    try {
      const r = await window.R4Build.ask(p, text);
      chat = chat.filter((m) => !m.wait);
      if (r.files && open === p.id) {
        p.versions = p.versions.slice(0, p.cur + 1);
        p.versions.push({ v: p.versions[p.versions.length - 1].v + 1, at: Date.now(), note: r.note, params: {}, files: r.files, by: viewer.id }); p.cur = p.versions.length - 1;
        if (r.name) p.name = r.name;
        save(); toast('✦ It outgrew the kit: it’s real code now. Commits can take it back.'); return openBench(p.id, r.say);
      }
      if (r.change && open === p.id) {
        chat.push({ t: r.say + ' That’s v' + (p.versions[p.versions.length - 1].v + 1) + '. Undo with ⤺ if you don’t like it.', ok: true });
        commit(p, r.change, r.note);
      } else { chat.push({ t: r.say }); paintTab(); }
    } catch (e) { chat = chat.filter((m) => !m.wait); chat.push({ t: e.message }); paintTab(); }
    asking = false;
  }

  // ---------- workbench ----------
  function openBench(id, intro, autoAsk) {
    clearBench(); open = id; tab = 'claude'; const p = list.find((x) => x.id === id);
    if (PR.isCode(p)) { history.pushState({ bench: id }, '', '?open=' + id); return CodeBench.open(p, ctx(), intro, autoAsk); }
    chat = [{ t: canEdit(p) ? `${p.owner === viewer.id ? 'This is ' + p.name + '.' : 'You’re helping ' + byId(p.owner).name + ' on ' + p.name + '. Your changes show up for both of you.'} Tell me what to change: “make it faster”, “red background”, “I’m a 🐱 catching 🍩”.` : 'This one isn’t yours. Remix it to change it.' }];
    $('title').textContent = 'workbench'; $('back').hidden = false; $('mark').hidden = true;
    $('body').innerHTML = `<div class="bench"><div class="bbar"><span class="bname" id="bname"></span><span class="bver" id="bver"></span><span class="bteam" id="bteam"></span><span class="blvl" id="blvl"></span><span class="grow"></span><button class="bb" id="undo" aria-label="Undo">⤺</button><button class="bb" id="redo" aria-label="Redo">⤻</button><button class="bb" id="phone" aria-label="Test on phone">📱</button><button class="bb share" id="share">↗ Share</button></div>
      <div class="bdev" id="bdev"></div>
      <div class="btabs" id="btabs"></div><div class="tbody" id="tbody"></div></div>`;
    $('undo').onclick = () => { const p = cur(); if (p.cur > 0) { p.cur--; save(); paintBench(); toast('⤺ Back to v' + p.versions[p.cur].v); } };
    $('redo').onclick = () => { const p = cur(); if (p.cur < p.versions.length - 1) { p.cur++; save(); paintBench(); } };
    $('phone').onclick = () => phoneTest(cur()); $('share').onclick = () => shareSheet(cur());
    paintBench(); window.scrollTo(0, 0); history.pushState({ bench: id }, '', '?open=' + id);
    sw('bench', null, () => openKitPanel(cur()));

  }
  const cur = () => list.find((x) => x.id === open);
  function paintBench() {
    const p = cur(); if (!p) return renderHome(); if (PR.isCode(p)) return CodeBench.open(p, ctx()); const mine = canEdit(p), own = p.owner === viewer.id, v = p.versions[p.cur];
    $('bname').textContent = p.name; $('bver').textContent = 'v' + v.v + (p.cur < p.versions.length - 1 ? ' · ' + (p.versions.length - 1 - p.cur) + ' ahead' : '');
    $('undo').disabled = !mine || p.cur === 0; $('redo').disabled = !mine || p.cur === p.versions.length - 1; $('share').hidden = !own;
    $('bname').title = helpers(p).length ? 'With ' + helpers(p).map((h) => h.name).join(', ') : '';
    $('bteam').innerHTML = [p.owner, ...(p.collab || [])].map((u) => `<i title="${esc(byId(u).name)}${u === p.owner ? ' (owner)' : ''}">${esc(byId(u).name[0].toUpperCase())}</i>`).join('');
    { const L0 = level(p), html = PR.html(p); $('bdev').innerHTML = [['id', p.id], ['kit', p.kit], ['v', v.v + '/' + p.versions.length], ['score', L0.score], ['params', Object.keys(v.params).length], ['html', (html.length / 1024).toFixed(1) + 'k'], ['team', 1 + (p.collab || []).length]].map(([k, x]) => `<span><small>${k}</small>${esc(x)}</span>`).join(''); }
    const L = level(p), kind = PR.kindOf(p);
    $('blvl').innerHTML = `Lv ${L.n} · ${L.name}${L.next ? `<small>${L.next} to go</small>` : ''}`; $('blvl').title = L.next ? L.next + ' more changes unlock ' + ['the ' + TYPE_TAB[kind].slice(2) + ' editor and history', 'the code view', 'editing the code'][L.n - 1] : 'Everything is unlocked';
    const T = [['claude', mine ? '✦ Claude' : '✦ About'], ['parts', '🧩 Parts'], ...(L.n >= 2 ? [['type', TYPE_TAB[kind]], ['hist', '🕘 History']] : []), ...(L.n >= 3 || dev() ? [['code', '&lt;/&gt; Code']] : [])];
    if (!T.some(([k]) => k === tab)) tab = 'claude';
    $('btabs').innerHTML = T.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
    $('btabs').querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; paintBench(); }));
    paintTab();
  }
  const SPR = ['🧺', '🐟', '🚀', '🐱', '🦖', '👾', '🤖', '🐸'], ITM = ['⭐', '✨', '💎', '🍩', '🪙', '🍕', '⚽', '🫧'], SW = ['#3DD6C6', '#B9A6FF', '#F5C542', '#FF5A4A', '#4A8BFF', '#FF7AC8'], BG = ['#0B0918', '#061a33', '#0f2a1a', '#2a0f1f', '#000000', '#F3F1FF'];
  function paintTab() {
    const p = cur(), mine = canEdit(p), v = p.versions[p.cur], P = v.params, el = $('tbody');
    if (tab === 'claude') {
      if (!mine) { el.innerHTML = `<p class="note">${esc(p.name)} by ${esc(byId(p.owner).name)}${p.from ? ', remixed from ' + esc(p.from.name) : ''}. ${p.versions.length} versions.</p><p class="note" style="margin-top:-4px">🤝 <b>Help</b> works on this same project with ${esc(byId(p.owner).name)}, once they let you in. ⑂ <b>Remix</b> makes your own copy to change however you like.</p><div class="hacts2"><button class="go" id="hlp"${(p.requests || []).includes(viewer.id) ? ' disabled' : ''}>${(p.requests || []).includes(viewer.id) ? 'Asked to help' : '🤝 Ask to help'}</button><button class="go alt" id="rmx">⑂ Remix it</button></div>`; $('rmx').onclick = () => remix(p.id); $('hlp').onclick = () => { askHelp(p); openBench(p.id); }; return; }
      const LVn = level(p).n, adv = { catch: ['make it 3× faster', 'I’m 🚀 catching 🪐, black background'], timer: ['45 minutes, gold', 'call it Deep work'], page: ['add a line: My best game is Deep sea catch', 'navy background, bigger'], comic: ['add a panel 🏁 where it ends', 'call it Dragon pizza night'], drums: ['8 pads, red', 'smaller'] }[p.kit];
      const sug0 = { catch: ['make it faster', 'I’m a 🐱 catching 🍩', 'blue background'], timer: ['25 minutes', 'make it red', 'bigger'], page: ['add a line: I play chess', 'pink', 'I’m 🦖'], comic: ['add a panel 🚀 where they fly away', 'bigger', 'call it Pizza dragon'], drums: ['more pads', 'purple', 'bigger'] }[p.kit], sug = LVn >= 3 ? [...sug0.slice(0, 1), ...adv] : sug0;
      el.innerHTML = `<div class="bchat" id="bchat">${chat.map((m) => `<div class="bm${m.me ? ' me' : ''}${m.ok ? ' ok' : ''}">${m.me ? '' : '<i>✦</i>'}<span>${esc(m.t)}</span></div>`).join('')}</div>
        <div class="sugs">${sug.map((s) => `<button data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <form class="bask" id="bask"><input id="bq" placeholder="Tell Claude what to change…" autocomplete="off"><button class="ibtn send" aria-label="Send">↑</button></form>
        <p class="capn">${viewer.role === 'parent' ? 'No build limit for parents.' : left() + ' of ' + CAP + ' builds left today · the parts shelf is free'}</p>`;
      $('bask').onsubmit = (e) => { e.preventDefault(); ask($('bq').value); };
      el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => ask(b.dataset.s)));
      const bc = $('bchat'); bc.scrollTop = bc.scrollHeight; return;
    }
    if (tab === 'parts') {
      // the shelf grows with the project too: a few choices at Sketch, all at Build, your own colours at Craft
      const LP = level(p).n, cut = (arr) => (LP === 1 ? arr.slice(0, 4) : arr), KEY = { You: 'sprite', Catch: 'item', Colour: 'color', Background: 'bg', Size: 'size', Speed: 'speed', Sound: 'sound', Pads: 'pads' };
      const pick = (k) => (LP >= 3 && mine ? `<label class="cpick" title="Any colour"><input type="color" data-cc="${k}" value="${/^#[0-9a-f]{6}$/i.test(P[k]) ? P[k] : '#3dd6c6'}">＋</label>` : '');
      const row = (label, html) => `<div class="shrow"><span>${label}<code>${KEY[label]}: ${esc(String(P[KEY[label]]))}</code></span><div class="pchips">${html}</div></div>`;
      const dis = mine ? '' : ' disabled';
      el.innerHTML = '<div class="shelf">' + (!mine ? '<p class="note">Remix it to use the parts.</p>' : '')
        + ('sprite' in P ? row('You', cut(SPR).map((s) => `<button data-p="sprite" data-v="${s}" class="${P.sprite === s ? 'on' : ''}"${dis}>${s}</button>`).join('')) : '')
        + ('item' in P ? row('Catch', cut(ITM).map((s) => `<button data-p="item" data-v="${s}" class="${P.item === s ? 'on' : ''}"${dis}>${s}</button>`).join('')) : '')
        + row('Colour', cut(SW).map((c) => `<button data-p="color" data-v="${c}" class="sw${P.color === c ? ' on' : ''}" style="background:${c}"${dis} aria-label="Colour ${c}"></button>`).join('') + pick('color'))
        + row('Background', cut(BG).map((c) => `<button data-p="bg" data-v="${c}" class="sw${P.bg === c ? ' on' : ''}" style="background:${c}"${dis} aria-label="Background ${c}"></button>`).join('') + pick('bg'))
        + row('Size', `<button data-p="size" data-v="${Math.max(0.6, +(P.size / 1.2).toFixed(2))}"${dis}>−</button><span class="pv">${Math.round(P.size * 100)}%</span><button data-p="size" data-v="${Math.min(2, +(P.size * 1.2).toFixed(2))}"${dis}>+</button>`)
        + ('speed' in P ? row('Speed', `<button data-p="speed" data-v="${+(P.speed / 1.3).toFixed(2)}"${dis}>🐢</button><span class="pv">${P.speed}×</span><button data-p="speed" data-v="${+(P.speed * 1.3).toFixed(2)}"${dis}>🐇</button>`) : '')
        + row('Sound', `<button data-p="sound" data-v="1" class="${P.sound ? 'on' : ''}"${dis}>🔊 On</button><button data-p="sound" data-v="0" class="${P.sound ? '' : 'on'}"${dis}>🔇 Off</button>`)
        + ('pads' in P ? row('Pads', `<button data-p="pads" data-v="${Math.max(2, P.pads - 2)}"${dis}>−</button><span class="pv">${P.pads}</span><button data-p="pads" data-v="${Math.min(8, P.pads + 2)}"${dis}>+</button>`) : '') + '</div>';
      if (LP === 1 && mine) el.insertAdjacentHTML('beforeend', '<p class="note pmore">More parts unlock at Build.</p>');
      el.querySelectorAll('[data-cc]').forEach((i) => (i.onchange = () => commit(p, { [i.dataset.cc]: i.value }, (i.dataset.cc === 'bg' ? 'Background ' : 'Colour ') + i.value)));
      el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { const k = b.dataset.p, raw = b.dataset.v, val = k === 'sound' ? raw === '1' : /^(size|speed|pads)$/.test(k) ? +raw : raw; if (P[k] === val) return; commit(p, { [k]: val }, { sprite: 'You’re ', item: 'Catching ', color: 'Colour ', bg: 'Background ', size: 'Size ', speed: 'Speed ', sound: 'Sound ', pads: 'Pads ' }[k] + (k === 'sound' ? (val ? 'on' : 'off') : k === 'size' ? Math.round(val * 100) + '%' : val)); }));
      return;
    }
    if (tab === 'type') {
      const L = level(p), dis = mine ? '' : ' disabled', kind = PR.kindOf(p);
      const slider = (k, min, max, step, lab) => `<label class="tsl"><span>${lab}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${P[k]}" data-r="${k}"${dis}><b>${P[k]}</b></label>`;
      let h = '';
      if (kind === 'game') h = slider('speed', 0.4, 3, 0.1, 'Speed') + slider('size', 0.6, 2, 0.05, 'Size') + (L.n >= 3 ? `<label class="tin"><span>You</span><input data-t="sprite" value="${esc(P.sprite)}" maxlength="4"${dis}></label><label class="tin"><span>Catch</span><input data-t="item" value="${esc(P.item)}" maxlength="4"${dis}></label>` : '<p class="note">At Craft you can type any emoji for the characters.</p>');
      if (kind === 'app') h = slider('minutes', 1, 60, 1, 'Minutes') + slider('size', 0.6, 2, 0.05, 'Size') + `<label class="tin"><span>Label</span><input data-t="title" value="${esc(P.title)}" maxlength="40"${dis}></label>`;
      if (kind === 'toy') h = slider('pads', 2, 8, 2, 'Pads') + slider('size', 0.6, 2, 0.05, 'Size');
      if (kind === 'page') h = `<label class="tin"><span>Title</span><input data-t="title" value="${esc(P.title)}" maxlength="40"${dis}></label><div class="tlist">${P.lines.map((l, i) => `<div class="trow"><input data-line="${i}" value="${esc(l)}" maxlength="80"${dis}><button data-del="${i}" aria-label="Remove line"${dis}>✕</button></div>`).join('')}<button class="tadd" data-addline${dis}>＋ Add a line</button></div>`;
      if (kind === 'story') h = `<div class="tlist">${P.panels.map((x, i) => `<div class="trow pnl"><span class="pn">${i + 1}</span><input class="pe2" data-pe="${i}" value="${esc(x.e)}" maxlength="4"${dis}><input data-pt="${i}" value="${esc(x.t)}" maxlength="80"${dis}>${L.n >= 3 ? `<button data-up="${i}" aria-label="Move up"${i ? dis : ' disabled'}>↑</button>` : ''}<button data-delp="${i}" aria-label="Remove panel"${P.panels.length > 1 ? dis : ' disabled'}>✕</button></div>`).join('')}<button class="tadd" data-addp${dis}>＋ Add a panel</button></div>${L.n < 3 ? '<p class="note">At Craft you can reorder panels.</p>' : ''}`;
      el.innerHTML = `<div class="ted">${h}</div>`;
      el.querySelectorAll('[data-r]').forEach((r) => { r.oninput = () => (r.nextElementSibling.textContent = r.value); r.onchange = () => commit(p, { [r.dataset.r]: +r.value }, r.previousElementSibling.textContent + ' ' + r.value); });
      el.querySelectorAll('[data-t]').forEach((i) => (i.onchange = () => { const v2 = i.value.trim(); if (v2 && v2 !== P[i.dataset.t]) commit(p, { [i.dataset.t]: v2 }, { title: 'Called it ', sprite: 'You’re ', item: 'Catching ' }[i.dataset.t] + v2); }));
      el.querySelectorAll('[data-line]').forEach((i) => (i.onchange = () => { const L2 = [...P.lines]; L2[+i.dataset.line] = i.value; commit(p, { lines: L2 }, 'Edited line ' + (+i.dataset.line + 1)); }));
      el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => commit(p, { lines: P.lines.filter((_, k) => k !== +b.dataset.del) }, 'Removed a line')));
      el.querySelectorAll('[data-addline]').forEach((b) => (b.onclick = () => commit(p, { lines: [...P.lines, 'Something new'] }, 'Added a line')));
      el.querySelectorAll('[data-pe],[data-pt]').forEach((i) => (i.onchange = () => { const k = +(i.dataset.pe ?? i.dataset.pt), ps = P.panels.map((x) => ({ ...x })); if (i.dataset.pe != null) ps[k].e = i.value || '✨'; else ps[k].t = i.value; commit(p, { panels: ps }, 'Edited panel ' + (k + 1)); }));
      el.querySelectorAll('[data-delp]').forEach((b) => (b.onclick = () => commit(p, { panels: P.panels.filter((_, k) => k !== +b.dataset.delp) }, 'Removed panel ' + (+b.dataset.delp + 1))));
      el.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const k = +b.dataset.up, ps = [...P.panels]; [ps[k - 1], ps[k]] = [ps[k], ps[k - 1]]; commit(p, { panels: ps }, 'Moved panel ' + (k + 1) + ' up'); }));
      el.querySelectorAll('[data-addp]').forEach((b) => (b.onclick = () => commit(p, { panels: [...P.panels, { e: '✨', t: 'And then…' }] }, 'Added a panel')));
      return;
    }
    if (tab === 'hist') {
      el.innerHTML = `<ol class="hist">${p.versions.slice().reverse().map((x) => { const i = p.versions.indexOf(x); return `<li class="${i === p.cur ? 'on' : ''}${i > p.cur ? ' ahead' : ''}"><b>v${x.v}</b><span>${esc(x.note)}<small class="by">${esc((byId(x.by || p.owner) || {}).name || '')}</small></span><small>${ago(x.at)}</small>${i !== p.cur && mine ? `<button data-go="${i}">${i > p.cur ? 'Redo to here' : 'Go back'}</button>` : i === p.cur ? '<em>now</em>' : ''}</li>`; }).join('')}</ol>`;
      el.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { p.cur = +b.dataset.go; save(); paintBench(); toast('Now on v' + p.versions[p.cur].v); }));
      return;
    }
    if (tab === 'code') {
      el.innerHTML = `<div class="codeh"><span>index.html · v${v.v} · ${PR.html(p).length.toLocaleString()} chars</span><button id="cpy">Copy</button></div><pre class="code">${esc(PR.html(p))}</pre>${dev() && mine ? '<button class="go" id="toCode" style="margin:4px 0">⌨ Open as a code project</button>' : ''}${level(p).n >= 4 || dev() ? `<div class="codeh"><span>params.json · edit and apply</span><button id="apj"${mine ? '' : ' disabled'}>Apply</button></div><textarea class="code pj" id="pj" spellcheck="false"${mine ? '' : ' readonly'}>${esc(JSON.stringify(P, null, 2))}</textarea><p class="capn" id="pjerr"></p>` : '<p class="capn">At Engineer you can edit what the page is built from.</p>'}`;
      const tc = $('toCode'); if (tc) tc.onclick = () => { const np = CodeBench.create(null, ctx(), p); list.push(np); save(); toast('⌨ A code copy. The kit version stays as it was.'); openBench(np.id); };
      const ap = $('apj'); if (ap) ap.onclick = () => { try { const nv = JSON.parse($('pj').value); commit(p, nv, 'Edited the code'); tab = 'code'; } catch (e) { $('pjerr').textContent = 'That isn’t valid JSON: ' + e.message; $('pjerr').style.color = 'var(--hot)'; } };
      $('cpy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(PR.html(p)).catch(() => {}); toast('Copied the page.'); };
    }
  }

  // ---------- play, phone test, share ----------
  function sheet(html) { const d = $('sheet'); d.innerHTML = html; d.showModal(); d.onclick = (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }; return d; }
  function player(p) { sheet(`<div class="playh"><b>${esc(p.name)}</b><small>by ${esc(byId(p.owner).name)}</small><button data-close aria-label="Close">✕</button></div><iframe class="playf" sandbox="allow-scripts" title="${esc(p.name)}"></iframe>`).querySelector('iframe').srcdoc = PR.html(p); }
  function phoneTest(p) {
    const link = 'https://r4box.com/p/' + p.id;   // 404.html sends it on to projects.html?play=
    const d = sheet(`<div class="playh"><b>📱 Test on phone</b><small>${esc(p.name)} · v${p.versions[p.cur].v}</small><button data-close aria-label="Close">✕</button></div><div class="phone"><iframe sandbox="allow-scripts" title="Phone preview"></iframe></div><div class="link"><code>${link}</code><button id="cl">Copy link</button></div><p class="note" style="margin:6px 0 0">Open the link on your phone to try it. Only the family can open it${p.published ? '' : ', once it’s published'}.</p>`);
    d.querySelector('iframe').srcdoc = PR.html(p); d.querySelector('#cl').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link).catch(() => {}); toast('Link copied.'); };
  }
  function shareSheet(p) {
    const d = sheet(`<div class="playh"><b>↗ Share</b><small>${esc(p.name)}</small><button data-close aria-label="Close">✕</button></div>
      <div class="srow"><div><b>Publish to the family</b><small>${p.published ? 'Everyone can play v' + p.versions[p.cur].v + ' and remix it.' : 'Only you can see it now.'}</small></div><button class="tog${p.published ? ' on' : ''}" id="pubT" role="switch" aria-checked="${p.published}"><i></i></button></div>
      <h3 class="k" style="margin:4px 0 0">Make it together</h3>${F.filter((u) => u.id !== p.owner).map((u) => { const inn = (p.collab || []).includes(u.id), want = (p.requests || []).includes(u.id); return `<div class="srow"><div><b>${esc(u.name)}</b><small>${inn ? 'Can change it with you. Their versions show their name.' : want ? '🤝 Asked to help.' : 'Let them work on it with you.'}</small></div><button class="tog${inn ? ' on' : ''}" data-co="${u.id}" role="switch" aria-checked="${inn}" aria-label="Let ${esc(u.name)} help"><i></i></button></div>`; }).join('')}
      <button class="go" id="ptest">💬 Ask the family to play-test</button>`);
    d.querySelectorAll('[data-co]').forEach((b) => (b.onclick = () => { const u = b.dataset.co, c = new Set(p.collab || []); c.has(u) ? c.delete(u) : c.add(u); p.collab = [...c]; p.requests = (p.requests || []).filter((x) => x !== u); save(); d.close(); shareSheet(p); if (c.has(u)) toast('🤝 ' + byId(u).name + ' can help now.'); paintBench(); }));
    d.querySelector('#pubT').onclick = () => { p.published = !p.published; save(); d.close(); shareSheet(p); toast(p.published ? 'Published. It grows in your world now.' : 'Back to a draft.'); };
    d.querySelector('#ptest').onclick = () => {
      const k = PR.KIND[PR.kindOf(p)];
      if (!p.published) { p.published = true; save(); }
      d.close();
      window.R4Build.saved().then(() => window.R4Build.post('Can someone play-test my ' + k[1].toLowerCase() + '?', p.id)).then(() => toast('Asked in the family chat.'), (e) => toast(e.message));
    };
  }

  // ---------- chrome ----------
  // ‹ goes up a level: bench → the library (if you came from it) or the projects; library → the projects
  $('back').onclick = () => { const lib = $('title').textContent !== 'library' && fromLib; fromLib = false; history.replaceState(null, '', lib ? '?lib=1' : location.pathname); lib ? renderLibrary() : renderHome(); };
  addEventListener('popstate', () => { if (document.querySelector('.subpage')) return;   // closing Settings: it handles itself
    if (new URLSearchParams(location.search).get('lib')) return renderLibrary();
    const id = new URLSearchParams(location.search).get('open'); id && list.some((p) => p.id === id) ? openBench(id) : renderHome(); });
  $('gear').onclick = () => {
    const pg = document.createElement('section'); pg.className = 'subpage';
    pg.innerHTML = '<header><button class="sb" aria-label="Back">‹</button><span><b>Settings</b><small>View · builder</small></span></header><div class="subb" id="sbody" style="padding:12px"></div>';
    // Settings is a step in history, so the phone's back button closes it too.
    $('app').append(pg); history.pushState({ set: 1 }, '');
    const shut = () => { if (!pg.isConnected) return; pg.remove(); removeEventListener('popstate', shut); open ? paintBench() : renderHome(); };
    addEventListener('popstate', shut); pg.querySelector('.sb').onclick = () => history.back();
    const VIEWS = [['play', '🧸', 'Play', 'A few big controls'], ['explore', '🧭', 'Explore', 'The main things, a little text'], ['pilot', '✈️', 'Pilot', 'Every instrument at once'], ...(viewer.role === 'parent' ? [['dev', '⌘', 'Developer', 'Everything, condensed, plus the raw data']] : [])];
    const paint = () => {
      $('sbody').innerHTML = `<h3 class="k">View</h3><div class="vset">${VIEWS.map(([id, em, n, b]) => `<button class="vopt${dens === id ? ' on' : ''}" data-view="${id}"><span class="em">${em}</span><b>${n}</b><em>${b}</em></button>`).join('')}</div><p class="note" style="margin:6px 0 0">The same view as your home page.</p>
        <h3 class="k">Builder</h3><section class="sset"><div class="srow"><div><b>⌨ Developer only</b><small>Start from code, no kits. Off: kits and code side by side (every project is code either way).</small></div><button class="tog${devOnly(viewer) ? ' on' : ''}" id="devT" role="switch" aria-checked="${devOnly(viewer)}"><i></i></button></div></section><p class="note" style="margin:6px 0 0">For ${esc(viewer.name)}, in Projects.</p>`;
      $('sbody').querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('r4.density.' + viewer.id, b.dataset.view); } catch {} applyDensity(); paint(); }));
      $('devT').onclick = () => { try { devOnly(viewer) ? localStorage.removeItem('r4.builder.' + viewer.id) : localStorage.setItem('r4.builder.' + viewer.id, 'developer'); } catch {} paint(); };
    };
    paint();
  };
  applyDensity();
  const qs = new URLSearchParams(location.search), want = qs.get('open'), play = qs.get('play');
  if (qs.get('lib')) renderLibrary();
  else if (want && list.some((p) => p.id === want)) openBench(want);
  else { renderHome(); const pp = play && list.find((p) => p.id === play); if (pp) player(pp); else if (play || want) toast('That project isn’t here: it may be a draft, or gone.'); }
})();
