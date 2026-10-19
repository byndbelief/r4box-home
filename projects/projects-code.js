/* Code bench: for builders with developer experience. Real files (index.html, style.css, main.js,
   plus any you add), a line-numbered editor, Run (⌘/Ctrl+Enter), a console wired to the preview,
   commits with a message and a diff, checkout, and a Claude that reads the code: it explains
   files, points at the last error, and adds a few real features as reviewed commits. */
(function () {
  const PR = window.R4Projects;
  const TEMPLATES = {
    canvas: { name: 'Canvas game', blurb: 'A game loop, a player, things to catch.', files: {
      'index.html': '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>My game</title>\n</head>\n<body>\n  <canvas id="c"></canvas>\n  <div id="hud">score <b id="score">0</b></div>\n</body>\n</html>\n',
      'style.css': 'html, body { margin: 0; height: 100%; background: #0B0918; color: #F3F1FF; font: 16px system-ui; overflow: hidden; }\ncanvas { display: block; width: 100%; height: 100%; }\n#hud { position: fixed; top: 10px; left: 12px; font-weight: 700; }\n#hud b { color: #3DD6C6; }\n',
      'main.js': "const c = document.getElementById('c'), ctx = c.getContext('2d');\nlet W, H, px, score = 0, items = [], t = 0;\n\nfunction resize() { W = c.width = innerWidth; H = c.height = innerHeight; if (px == null) px = W / 2; }\nresize(); addEventListener('resize', resize);\naddEventListener('pointermove', (e) => (px = e.clientX));\n\nfunction spawn() { items.push({ x: Math.random() * (W - 40) + 20, y: -20, v: 2 + Math.random() * 2 }); }\n\nfunction frame() {\n  t++; ctx.clearRect(0, 0, W, H);\n  if (t % 30 === 0) spawn();\n  ctx.font = '28px serif'; ctx.textAlign = 'center';\n  for (const it of items) { it.y += it.v; ctx.fillText('⭐', it.x, it.y); }\n  items = items.filter((it) => {\n    const hit = it.y > H - 70 && it.y < H - 20 && Math.abs(it.x - px) < 30;\n    if (hit) { score++; document.getElementById('score').textContent = score; }\n    return !hit && it.y < H + 30;\n  });\n  ctx.fillText('🧺', px, H - 30);\n  requestAnimationFrame(frame);\n}\nframe();\nconsole.log('game started');\n" } },
    blank: { name: 'Blank page', blurb: 'Three empty files. Go.', files: {
      'index.html': '<!doctype html>\n<html>\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n',
      'style.css': 'body { background: #06050F; color: #F3F1FF; font: 18px system-ui; padding: 24px; }\n', 'main.js': "console.log('hello from main.js');\n" } },
  };
  function diff(a, b) {   // tiny line diff: LCS over lines, good enough for small files
    const A = (a || '').split('\n'), B = (b || '').split('\n'), n = A.length, m = B.length;
    if (n * m > 160000) return B.map((l) => ['=', l]);
    const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { out.push(['=', A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', A[i++]]); else out.push(['+', B[j++]]); }
    while (i < n) out.push(['-', A[i++]]); while (j < m) out.push(['+', B[j++]]);
    return out;
  }

  let X, p, file = 'main.js', tab = 'files', draft = null, logs = [], viewV = null, ask = [];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => X.esc(s);
  const head = () => p.versions[p.cur];
  const dirty = () => draft && Object.keys(draft).some((k) => draft[k] !== (head().files[k] ?? null)) || (draft && Object.keys(head().files).some((k) => !(k in draft)));
  // the preview opens as its own panel: big, with its own run button and the console under it
  let panel = null;
  function run() { logs = []; paintConsole(); const doc = PR.codeDoc(draft || head().files); if (panel) { $('pv2').srcdoc = doc; $('pv').srcdoc = ''; } else $('pv').srcdoc = doc; }
  function openPanel() {
    panel = document.createElement('section'); panel.className = 'pvpanel'; panel.setAttribute('aria-label', 'Preview');
    panel.innerHTML = `<header><button class="sb" id="pclose" aria-label="Back to the code">‹</button><span><b>${esc(p.name)}</b><small>v${head().v}${dirty() ? ' · unsaved changes' : ''}</small></span><span class="grow"></span><button class="bb" id="prun" title="Run again">▶</button><button class="bb" id="pphone" aria-label="Test on phone">📱</button></header><iframe id="pv2" title="Preview" sandbox="allow-scripts allow-modals"></iframe><div class="cons big" id="cons"></div>`;
    $('app').append(panel); $('cons') && null;
    document.querySelectorAll('.codebench .cons').forEach((c) => (c.id = 'cons-inline'));
    $('pclose').onclick = closePanel; $('prun').onclick = run; $('pphone').onclick = () => X.phoneTest(p);
    history.pushState({ pv: 1 }, ''); run(); X.sw('prev', () => closePanel(), null, true);
  }
  function closePanel(fromPop) {
    if (!panel) return; panel.remove(); panel = null; const ci = document.getElementById('cons-inline'); if (ci) ci.id = 'cons';
    if (fromPop !== true) history.back(); run(); X.sw('bench', null, openPanel, true);
  }
  addEventListener('popstate', () => { if (panel) closePanel(true); });
  function run_() { run(); }
  function commit(msg, files, by) {
    p.versions = p.versions.slice(0, p.cur + 1);
    p.versions.push({ v: head().v + 1, at: Date.now(), note: msg, params: {}, files: { ...files }, by: by || X.viewer().id }); p.cur = p.versions.length - 1;
    draft = null; X.save(); paint();
  }
  addEventListener('message', (e) => { if (!p || !e.data || !e.data.r4log || ![$('pv'), $('pv2')].some((f) => f && f.contentWindow === e.source)) return; logs.push(e.data.r4log); if (logs.length > 80) logs.shift(); paintConsole(); });
  function paintConsole() { const el = $('cons'); if (!el) return; el.innerHTML = logs.length ? logs.map(([l, m]) => `<div class="cl ${l}">${l === 'error' ? '✕' : l === 'warn' ? '!' : '›'} ${esc(m)}</div>`).join('') : '<div class="cl dim">console is empty · ⌘/Ctrl+Enter runs</div>'; el.scrollTop = el.scrollHeight; }

  function open(proj, ctx) {
    X = ctx; p = proj; file = Object.keys(head().files).includes('main.js') ? 'main.js' : Object.keys(head().files)[0]; tab = 'files'; draft = null; viewV = null;
    ask = [{ t: X.canEdit(p) ? 'I can read this code. Try: “explain main.js”, “why is it broken?”, “add arrow keys”, “keep a best score”, “add a restart button”, “make it harder”.' : 'Read-only. Remix it to change the code.' }];
    $('title').textContent = 'code'; $('back').hidden = false; $('mark').hidden = true;
    $('body').innerHTML = `<div class="bench codebench"><div class="bbar"><span class="bname">${esc(p.name)}</span><span class="bver" id="bver"></span><span class="grow"></span><button class="bb" id="crun" title="Run (⌘/Ctrl+Enter)">▶</button><button class="bb" id="cphone" aria-label="Test on phone">📱</button><button class="bb share" id="cshare">↗ Share</button></div>
      <div class="prev mini"><iframe id="pv" title="Preview" sandbox="allow-scripts allow-modals" tabindex="-1"></iframe><button class="pcover" id="popen" aria-label="Open the preview"><span>⤢ Open preview</span></button><span class="live">● run</span></div><div class="cons" id="cons"></div>
      <div class="btabs" id="ctabs"></div><div class="tbody" id="ctb"></div></div>`;
    $('crun').onclick = run; $('popen').onclick = openPanel; X.sw('bench', null, openPanel, true); $('cphone').onclick = () => X.phoneTest(p); $('cshare').onclick = () => X.shareSheet(p); $('cshare').hidden = p.owner !== X.viewer().id;
    paint(); run(); window.scrollTo(0, 0);
  }
  function paint() {
    $('bver').textContent = 'v' + head().v + (dirty() ? ' · unsaved' : '');
    const T = [['files', '📄 Files'], ['claude', '✦ Claude'], ['log', '⎇ Commits']];
    $('ctabs').innerHTML = T.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
    $('ctabs').querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; viewV = null; paint(); }));
    const el = $('ctb'), ed = X.canEdit(p), F = draft || head().files;
    if (tab === 'files') {
      const src = F[file] ?? '', n = src.split('\n').length;
      el.innerHTML = `<div class="ftabs">${Object.keys(F).map((f) => `<button data-f="${esc(f)}" class="${f === file ? 'on' : ''}">${esc(f)}${draft && draft[f] !== head().files[f] ? ' •' : ''}</button>`).join('')}${ed ? '<button class="nf" id="nf">＋</button>' : ''}</div>
        <div class="ed"><pre class="gut" id="gut">${Array.from({ length: n }, (_, i) => i + 1).join('\n')}</pre><textarea id="src" spellcheck="false" autocapitalize="off" autocorrect="off" wrap="off"${ed ? '' : ' readonly'}>${esc(src)}</textarea></div>
        ${ed ? `<form class="cmt" id="cmt"><input id="cmsg" placeholder="${dirty() ? 'What did you change?' : 'Edit, then commit'}" autocomplete="off"><button class="bb" type="button" id="crev"${dirty() ? '' : ' disabled'}>↺</button><button class="bb share" id="cgo"${dirty() ? '' : ' disabled'}>Commit</button></form>` : ''}`;
      el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { file = b.dataset.f; paint(); }));
      const ta = $('src'), g = $('gut');
      ta.onscroll = () => (g.scrollTop = ta.scrollTop);
      ta.oninput = () => { draft = draft || { ...head().files }; draft[file] = ta.value; g.textContent = Array.from({ length: ta.value.split('\n').length }, (_, i) => i + 1).join('\n'); $('bver').textContent = 'v' + head().v + ' · unsaved'; $('cgo').disabled = $('crev').disabled = !dirty(); };
      ta.onkeydown = (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.oninput(); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
      if (ed) {
        $('nf').onclick = () => { const nm = (prompt('New file name', 'helpers.js') || '').trim(); if (!nm || F[nm] != null) return; draft = { ...(draft || head().files), [nm]: '' }; file = nm; paint(); X.toast(nm.endsWith('.js') ? 'Only main.js runs on its own: load ' + nm + ' from index.html with a script tag.' : 'Added ' + nm); };
        $('crev').onclick = () => { draft = null; paint(); run(); };
        $('cmt').onsubmit = (e) => { e.preventDefault(); if (!dirty()) return; commit($('cmsg').value.trim() || 'Edited ' + Object.keys(draft).filter((k) => draft[k] !== head().files[k]).join(', '), draft); run(); X.toast('Committed v' + head().v); };
      }
      return;
    }
    if (tab === 'claude') {
      el.innerHTML = `<div class="bchat" id="cchat">${ask.map((m) => `<div class="bm${m.me ? ' me' : ''}${m.ok ? ' ok' : ''}">${m.me ? '' : '<i>✦</i>'}<span>${m.html || esc(m.t)}</span></div>`).join('')}</div>
        ${ed ? `<div class="sugs">${['explain main.js', 'why is it broken?', 'add arrow keys', 'keep a best score', 'add a restart button', 'make it harder'].map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div><form class="bask" id="cask"><input id="cq" placeholder="Ask about the code…" autocomplete="off"><button class="ibtn send" aria-label="Send">↑</button></form><p class="capn">${X.left() === Infinity ? 'No build limit.' : X.left() + ' builds left today · reading and explaining don’t use one'}</p>` : ''}`;
      const go = (q) => claude(q.trim());
      if (ed) { $('cask').onsubmit = (e) => { e.preventDefault(); go($('cq').value); }; el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => go(b.dataset.s))); }
      $('cchat').scrollTop = 1e6; return;
    }
    if (tab === 'log') {
      if (viewV != null) {
        const v = p.versions[viewV], prev = p.versions[viewV - 1], files = [...new Set([...Object.keys(v.files), ...Object.keys((prev || {}).files || {})])];
        el.innerHTML = `<button class="crumb" id="cbk">‹ All commits</button><div class="dh"><b>v${v.v}</b> ${esc(v.note)} <small>${esc((X.byId(v.by || p.owner) || {}).name)} · ${X.ago(v.at)}</small></div>`
          + files.map((f) => { const dd = diff(prev ? prev.files[f] : '', v.files[f]), ch = dd.filter((x) => x[0] !== '=').length; return ch || !prev ? `<div class="df"><div class="dfn">${esc(f)} <small>+${dd.filter((x) => x[0] === '+').length} −${dd.filter((x) => x[0] === '-').length}</small></div><pre class="dfb">${dd.filter((x, i, a) => x[0] !== '=' || a.slice(Math.max(0, i - 2), i + 3).some((y) => y[0] !== '=')).map(([k, l]) => `<span class="d${k === '+' ? 'a' : k === '-' ? 'r' : ''}">${k === '=' ? ' ' : k} ${esc(l)}</span>`).join('\n')}</pre></div>` : ''; }).join('')
          + (ed && viewV !== p.cur ? `<button class="go" id="cco">Check out v${v.v}</button>` : '');
        $('cbk').onclick = () => { viewV = null; paint(); };
        const co = $('cco'); if (co) co.onclick = () => { p.cur = viewV; draft = null; X.save(); viewV = null; paint(); run(); X.toast('Checked out v' + head().v); };
        return;
      }
      el.innerHTML = `<ol class="hist">${p.versions.slice().reverse().map((x) => { const i = p.versions.indexOf(x); return `<li class="${i === p.cur ? 'on' : ''}${i > p.cur ? ' ahead' : ''}"><b>v${x.v}</b><span>${esc(x.note)}<small class="by">${esc((X.byId(x.by || p.owner) || {}).name || '')}</small></span><small>${X.ago(x.at)}</small><button data-v="${i}">diff</button></li>`; }).join('')}</ol>`;
      el.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { viewV = +b.dataset.v; paint(); }));
    }
  }
  let asking = false;
  async function claude(q) {
    if (!q || asking) return; ask.push({ me: true, t: q }, { t: '…' }); asking = true; paint();
    try {
      const r = await X.claude(p, q, dirty() ? draft : null, logs);
      ask.pop();
      if (r.files) { ask.push({ t: r.say + ' Committed as v' + (head().v + 1) + ': open Commits to read the diff, or check out the one before if you don’t want it.', ok: true }); commit(r.note, r.files, X.viewer().id); run(); }
      else { ask.push({ t: r.say }); paint(); }
    } catch (e) { ask.pop(); ask.push({ t: e.message }); paint(); }
    asking = false;
  }
  function create(tpl, ctx, from) {
    const v = ctx.viewer(), t = TEMPLATES[tpl], files = from ? { 'index.html': PR.html(from), 'style.css': '/* extra styles */\n', 'main.js': '// your code runs after the page\nconsole.log(' + JSON.stringify(from.name + ' as code') + ');\n' } : { ...t.files };
    const p0 = { id: 'code-' + Date.now().toString(36), owner: v.id, kit: 'code', name: from ? from.name + ' (code)' : t.name, published: false, versions: [{ v: 1, at: Date.now(), note: from ? 'Opened ' + from.name + ' as code' : 'Started from ' + t.name, params: {}, files }], cur: 0 };
    return p0;
  }
  window.CodeBench = { open, create, TEMPLATES };
})();
