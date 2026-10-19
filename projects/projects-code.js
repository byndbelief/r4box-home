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
  function run() { logs = []; paintConsole(); const doc = PR.codeDoc(draft || head().files); if (panel) { $('pv2').srcdoc = X.withShot(doc); $('pv').srcdoc = ''; } else $('pv').srcdoc = doc; }
  function openPanel() {
    panel = document.createElement('section'); panel.className = 'pvpanel'; panel.setAttribute('aria-label', 'Preview');
    panel.innerHTML = `<header><button class="sb" id="pclose" aria-label="Back to the code">‹</button><span><b>${esc(p.name)}</b><small>v${head().v}${dirty() ? ' · unsaved changes' : ''}</small></span><span class="grow"></span>${X.canEdit(p) ? '<button class="bb" id="pmk" title="Mark it up and ask Claude">✏️ Mark</button>' : ''}<button class="bb" id="prun" title="Run again">▶</button><button class="bb" id="pphone" aria-label="Test on phone">📱</button></header><iframe id="pv2" title="Preview" sandbox="allow-scripts allow-modals"></iframe><div class="cons big" id="cons"></div>`;
    $('app').append(panel); $('cons') && null;
    document.querySelectorAll('.codebench .cons').forEach((c) => (c.id = 'cons-inline'));
    $('pclose').onclick = closePanel; $('prun').onclick = run;
    const mk = $('pmk'); if (mk) mk.onclick = () => { if (panel.querySelector('.mk')) return panel.querySelector('[data-mk=off]').click(); mk.classList.add('on');
      X.markUp(panel, $('pv2'), async (text, image) => {
        const r = await X.claude(p, text, dirty() ? draft : null, logs, image);
        ask.push({ me: true, t: '✏️ ' + text }, { t: r.say, ok: !!r.files });
        if (r.files) { commit(r.note, r.files, X.viewer().id); run(); }
        return r.say + (r.files ? ' (v' + head().v + ')' : '');
      }); }; $('pphone').onclick = () => X.phoneTest(p);
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

  // ---------- colour: a small highlighter for JS, CSS and HTML (raw text in, escaped HTML out) ----------
  const JS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(const|let|var|function|return|if|else|for|while|do|break|continue|new|class|extends|import|from|export|default|try|catch|finally|throw|typeof|instanceof|in|of|await|async|switch|case|this|null|undefined|true|false)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
  const CSS = /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|dvh|s|ms|deg)?\b)|([\w-]+)(?=\s*:[^;{}]*[;}])/g;
  const HTML = /(<!--[\s\S]*?-->)|('(?:[^'\n])*'|"(?:[^"\n])*")|(<\/?[\w-]+|\/?>)|(\s[\w:-]+)(?==)/g;
  const KIND = { js: [JS, ['com', 'str', 'kw', 'num', 'fn']], css: [CSS, ['com', 'str', 'num', 'prop']], html: [HTML, ['com', 'str', 'tag', 'attr']] };
  const langOf = (f) => (/\.css$/i.test(f) ? 'css' : /\.html?$/i.test(f) ? 'html' : 'js');
  function hl(src, lang) {
    const [re, cls] = KIND[lang]; let out = '', at = 0, m; re.lastIndex = 0;
    while ((m = re.exec(src))) {
      if (!m[0]) { re.lastIndex++; continue; }
      const g = m.slice(1).findIndex((x) => x != null);
      out += esc(src.slice(at, m.index)) + `<i class="t-${cls[g]}">${esc(m[0])}</i>`; at = m.index + m[0].length;
    }
    return out + esc(src.slice(at)) + '\n';
  }
  // ---------- 💡 Help: Claude's note on each line, under it (cached by the file's words) ----------
  let helpOn = false; const helpCache = new Map();
  // Words to know: a starter glossary that's always there (so key words light up right away), and
  // Claude's own definitions for this file, which come with its notes and win where both exist.
  const GLOSS = {
    'variable': ['A named box that holds a value, so you can use it and change it later.', 'let score = 0;\nscore = score + 1;'],
    'let': ['Makes a variable whose value can change later.', 'let lives = 3;\nlives = 2;'],
    'const': ['Makes a variable that keeps the same value (you can’t point it at something else).', 'const name = "Ava";'],
    'function': ['A named set of steps you can run again and again by calling it.', 'function greet() {\n  console.log("hi");\n}\ngreet();'],
    'argument': ['A value you hand to a function when you call it.', 'greet("Sam");  // "Sam" is the argument'],
    'parameter': ['The name a function gives to a value it receives.', 'function greet(name) { … }  // name is the parameter'],
    'return': ['Sends a value back out of a function to whoever called it.', 'function double(n) { return n * 2; }'],
    'console': ['A hidden log where your code can write messages; here it shows under the preview.', 'console.log("it works");'],
    'console.log': ['Writes a message to the console: the quickest way to check what your code is doing.', 'console.log("score is", score);'],
    'string': ['Text, written inside quotes.', 'const word = "hello";'],
    'number': ['A plain number you can do maths with.', 'const total = 2 + 3;  // 5'],
    'boolean': ['A value that is either true or false.', 'let isPlaying = true;'],
    'array': ['A list of values in order, counted from 0.', 'const fruits = ["apple", "pear"];\nfruits[0];  // "apple"'],
    'object': ['A bundle of named values (properties) kept together.', 'const player = { name: "Ava", score: 10 };'],
    'property': ['A named value that belongs to an object.', 'player.score  // reads the score property'],
    'method': ['A function that belongs to an object, called with a dot.', 'fruits.push("plum");'],
    'if': ['Runs some code only when a condition is true.', 'if (score > 10) {\n  console.log("you win");\n}'],
    'condition': ['A question your code asks that comes out true or false.', 'score > 10'],
    'loop': ['Code that repeats, again and again, until it’s told to stop.', 'for (let i = 0; i < 3; i++) { … }'],
    'for loop': ['A loop that counts: start, keep going while true, step.', 'for (let i = 0; i < 5; i++) {\n  console.log(i);\n}'],
    'event': ['Something that happens on the page: a click, a key press, a tap.', '"click", "keydown", "pointermove"'],
    'event listener': ['Code that waits for an event and runs when it happens.', 'button.addEventListener("click", () => { … });'],
    'addEventListener': ['Attaches an event listener to something on the page.', 'button.addEventListener("click", go);'],
    'click': ['The event when something is clicked or tapped.', 'el.addEventListener("click", …)'],
    'element': ['One piece of the page: a button, a heading, a picture.', '<button id="go">Go</button>'],
    'page element': ['One piece of the page: a button, a heading, a picture.', '<p id="laps">0</p>'],
    'id': ['A unique name you give an element so your code can find it.', '<button id="lapBtn">Lap</button>'],
    'document': ['The whole web page, as your code sees it.', 'document.title = "My game";'],
    'getElementById': ['Finds the element on the page with that id.', 'const btn = document.getElementById("lapBtn");'],
    'querySelector': ['Finds the first element that matches a CSS selector.', 'document.querySelector(".score")'],
    'textContent': ['The text inside an element; set it to change what it says.', 'lapsText.textContent = laps;'],
    'innerHTML': ['The HTML inside an element; set it to replace what’s in it.', 'box.innerHTML = "<b>Hi</b>";'],
    'DOM': ['The page as a tree of elements your code can read and change.', 'document.body.append(el);'],
    'canvas': ['A drawing area on the page that code paints shapes and pictures on.', '<canvas id="c"></canvas>'],
    'context': ['The canvas’s pen: what you call to actually draw.', 'const ctx = canvas.getContext("2d");'],
    'requestAnimationFrame': ['Asks the browser to run your function before the next screen redraw: the heart of an animation.', 'function frame() { …; requestAnimationFrame(frame); }'],
    'game loop': ['A function that runs over and over (about 60 times a second) to move and redraw everything.', 'function frame() { update(); draw(); requestAnimationFrame(frame); }'],
    'setInterval': ['Runs a function again every so many milliseconds.', 'setInterval(tick, 1000);  // every second'],
    'setTimeout': ['Runs a function once, after a wait in milliseconds.', 'setTimeout(done, 2000);'],
    'callback': ['A function you hand to something else, to be run later.', 'setTimeout(() => alert("hi"), 1000);'],
    'arrow function': ['A shorter way to write a function.', 'const add = (a, b) => a + b;'],
    'increment': ['Add one to a number.', 'laps = laps + 1;  // or laps++'],
    'operator': ['A symbol that does something to values: + - * / = === …', 'a + b, a === b'],
    'comment': ['A note in code for people; the computer skips it.', '// this is a comment'],
    'HTML': ['The language for what’s on the page: headings, buttons, pictures.', '<h1>Hello</h1>'],
    'CSS': ['The language for how the page looks: colours, sizes, layout.', 'h1 { color: teal; }'],
    'tag': ['How HTML marks a piece of the page, in angle brackets.', '<p> … </p>'],
    'attribute': ['Extra information on an HTML tag.', '<img src="cat.png" alt="a cat">'],
    'selector': ['In CSS, which elements a style applies to.', '.score { … }  #go { … }  button { … }'],
    'class': ['A label you can put on many elements so CSS or code can find them together.', '<div class="card">'],
    'style': ['How something looks; in code, an element’s style property.', 'box.style.color = "red";'],
    'browser': ['The app that shows web pages and runs their code.', 'Chrome, Safari, Firefox'],
    'score': ['In a game, the number that counts how well you’re doing.', 'let score = 0;'],
  };
  // everyday words that are also code words: lit up only when Claude marks them in a note
  const PLAIN = new Set(['if', 'let', 'id', 'class', 'style', 'number', 'string', 'object', 'return', 'score', 'click', 'tag', 'condition', 'browser', 'comment', 'context', 'property', 'event', 'element', 'method']);
  let gloss = {};   // Claude's, for the files read so far: lower-case term -> { term, means, example }
  const RE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Mark the key words in a note: Claude's for that note, plus any starter-glossary word in it.
  function marked(text, terms) {
    const all = [...new Set([...(terms || []), ...Object.keys(GLOSS).filter((w) => !PLAIN.has(w)), ...Object.values(gloss).map((g) => g.term)])].filter((t) => t && new RegExp('(^|[^\\w])' + RE(t) + '(?![\\w])', 'i').test(text)).sort((a, b) => b.length - a.length);
    if (!all.length) return { html: esc(text), found: [] };
    const re = new RegExp('(^|[^\\w])(' + all.map(RE).join('|') + ')(?![\\w])', 'gi'), found = new Set();
    let out = '', at = 0, m;
    while ((m = re.exec(text))) { const s = m.index + m[1].length; out += esc(text.slice(at, s)) + `<b class="kw">${esc(m[2])}</b>`; found.add(m[2].toLowerCase()); at = s + m[2].length; }
    return { html: out + esc(text.slice(at)), found: [...found] };
  }
  const defOf = (t) => { const k = t.toLowerCase(), c = gloss[k], s = Object.entries(GLOSS).find(([w]) => w.toLowerCase() === k); return c ? c : s ? { term: s[0], means: s[1][0], example: s[1][1] } : null; };
  const exLang = (x) => (/^\s*</.test(x) ? 'html' : /\{[^}]*:/.test(x) && !/[=(]/.test(x) ? 'css' : 'js');
  const entry = (d) => `<div class="gl" data-term="${esc(d.term)}" role="button" tabindex="0" aria-expanded="false"><b><span>${esc(d.term)}</span><button class="glask" data-askc aria-label="Ask Claude about ${esc(d.term)}">✦ Ask</button><i class="glchev">⌄</i></b><p>${esc(d.means)}</p><div class="glmore" hidden></div></div>`;
  // A word card, opened: where this file uses it, ▶ Try it (the example, editable, run in a sandbox),
  // and ✦ Ask Claude about it (in the Claude tab, about this code).
  const usesOf = (term, src, lang) => { const t = term.toLowerCase(); return src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => wordsOn(l, lang).some((w) => w.toLowerCase() === t) || new RegExp('(^|[^\\w])' + RE(term) + '(?![\\w])', 'i').test(l)); };
  const RUNNER = "<script>(function(){var o=function(k,a){parent.postMessage({r4try:[k,[].map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')]},'*')};['log','info','warn','error'].forEach(function(k){console[k]=function(){o(k,arguments)}});addEventListener('error',function(e){o('error',[e.message])})})()<\/script>";
  // The one code box: coloured, editable, ▶ Run in a sandbox (an example on its own; a line of the file
  // inside the whole project, so it runs for real), and ✓ Apply to put an edited line into the file.
  function codeBox(host, d, { code, lang, line, apply }) {
    host.innerHTML = `<div class="gled"><pre class="glcode" aria-hidden="true">${hl(code, lang).slice(0, -1) || ' '}</pre><textarea class="glcode" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Code">${esc(code)}</textarea></div>
      <div class="glacts"><button data-run>▶ Run</button>${apply ? '<button class="glapply" data-apply disabled>✓ Apply</button>' : ''}<small>${apply ? 'Edit, ▶ to try it in the project, ✓ to put it in ' + esc(file) + '.' : 'Edit it and ▶ again: nothing here touches your project.'}</small></div><div class="glout"></div><iframe class="glframe" sandbox="allow-scripts allow-modals" title="Run" hidden></iframe>`;
    const ta = host.querySelector('textarea'), pre = host.querySelector('pre'), out = host.querySelector('.glout'), fr = host.querySelector('iframe'), ap = host.querySelector('[data-apply]');
    let lit = null;
    const draw = () => { const v = ta.value, r = lit && spot(v, lit, lang); pre.innerHTML = r ? hl(v.slice(0, r[0]), lang).slice(0, -1) + `<mark>${hl(v.slice(r[0], r[1]), lang).slice(0, -1)}</mark>` + hl(v.slice(r[1]), lang).slice(0, -1) : hl(v, lang).slice(0, -1) || ' '; };
    host.mark = (term) => { lit = term; draw(); };
    ta.oninput = () => { draw(); if (ap) ap.disabled = ta.value === code; };
    if (line) ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); host.querySelector('[data-run]').click(); } };
    const on = (e) => { if (e.source !== fr.contentWindow || !e.data) return; const m = e.data.r4try || e.data.r4log; if (!m) return; out.insertAdjacentHTML('beforeend', `<div class="cl ${m[0]}">${m[0] === 'error' ? '✕' : '›'} ${esc(m[1])}</div>`); };
    addEventListener('message', on); d.addEventListener('close', () => removeEventListener('message', on), { once: true });
    host.querySelector('[data-run]').onclick = () => {
      out.innerHTML = ''; const v = ta.value;
      if (line) {   // the project, with this line as it is in the box
        const F = { ...(draft || head().files) }, L = (F[file] ?? '').split('\n'); L[line - 1] = v; F[file] = L.join('\n');
        fr.hidden = lang === 'js'; fr.srcdoc = PR.codeDoc(F);
      } else {
        fr.hidden = lang === 'js';
        fr.srcdoc = lang === 'js' ? `<!doctype html><body>${RUNNER}<script>${v.replace(/<\/script/gi, '<\\/script')}<\/script></body>` : lang === 'css' ? `<!doctype html><style>body{font:15px system-ui;color:#fff;background:#0D0B1F}${v}</style><h1>Heading</h1><p class="score">A paragraph</p><button id="go">Button</button>` : `<!doctype html><style>body{font:15px system-ui;color:#fff;background:#0D0B1F}</style>${RUNNER}${v}`;
      }
      setTimeout(() => { if (lang === 'js' && !out.children.length) out.innerHTML = '<div class="cl dim">ran, nothing logged · add console.log(…) to see a value</div>'; }, 900);
    };
    if (ap) ap.onclick = () => { apply(ta.value); code = ta.value; ap.disabled = true; X.toast('✓ Line ' + line + ' changed: commit when you’re ready.'); };
  }
  function activate(d) {
    d.querySelectorAll('.gl[data-term]').forEach((card) => {
      card.querySelector('.glask').onclick = (e) => { e.stopPropagation(); const term = card.dataset.term; d.close(); tab = 'claude'; paint(); claude(`Explain "${term}" to me, using my ${file} as the example.`); };
      const toggle = (e) => {
        if (e.target.closest('.glmore, .glask')) return;
        const open = card.classList.toggle('open'); card.setAttribute('aria-expanded', open);
        const lb = d.querySelector('.lbox');
        if (lb && lb.mark) { d.querySelectorAll('.gl.open').forEach((x) => { if (x !== card) { x.classList.remove('open'); x.setAttribute('aria-expanded', 'false'); x.querySelector('.glmore').hidden = true; } }); lb.mark(open ? card.dataset.term : null); }
        const more = card.querySelector('.glmore'); more.hidden = !open; if (!open || more.dataset.done) return;
        more.dataset.done = 1;
        const term = card.dataset.term, src = (draft || head().files)[file] ?? '', lang = langOf(file), uses = usesOf(term, src, lang), ex = defOf(term)?.example || '';
        const inLine = !!d.querySelector('.lbox');
        more.innerHTML = `<div class="gluse">${uses.length ? `<small>In ${esc(file)}:</small>${uses.slice(0, 12).map(([n]) => `<button data-line="${n}">line ${n}</button>`).join('')}${uses.length > 12 ? `<small>+${uses.length - 12}</small>` : ''}` : `<small>Not in ${esc(file)} yet.</small>`}</div>${!inLine && ex ? '<div class="glbox"></div>' : ''}`;
        more.querySelectorAll('[data-line]').forEach((b) => (b.onclick = () => { const n = +b.dataset.line, line = src.split('\n')[n - 1]; d.close(); openNote(n, line, { terms: wordsOn(line, lang).length ? wordsOn(line, lang) : [term] }); }));
        if (!inLine && ex) {
          // an example that prints nothing gets a console.log of its last variable, so ▶ shows something
          const xl = exLang(ex), nm = xl === 'js' && !/console\.log/.test(ex) && ([...ex.matchAll(/\b(?:let|const|var)\s+(\w+)|^\s*(\w+)\s*(?:=|\+\+)/gm)].pop() || []).slice(1).find(Boolean);
          codeBox(more.querySelector('.glbox'), d, { code: nm ? ex + '\nconsole.log(' + nm + ');' : ex, lang: xl });
        }
      };
      card.onclick = toggle; card.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); toggle(e); } };
    });
  }
  // A note, opened: its line, the note, and every key word in it explained; then all the words for this file.
  function openNote(n, line, note) {
    const mk = note.text ? marked(note.text, note.terms) : { html: '', found: note.terms.map((t) => t.toLowerCase()) }, lang = langOf(file);
    const words = mk.found.map(defOf).filter(Boolean), more = [...new Map([...Object.values(gloss), ...Object.entries(GLOSS).map(([term, [means, example]]) => ({ term, means, example }))].map((d) => [d.term.toLowerCase(), d])).values()].filter((d) => !mk.found.includes(d.term.toLowerCase()));
    const d = X.sheet(`<div class="playh"><b>💡 Line ${n}</b><small>${esc(file)}</small><button data-close aria-label="Close">✕</button></div>
      <div class="glbody"><div class="lbox"></div>${note.text ? `<p class="glnote">${mk.html}</p>` : ''}
      <div class="glwords">${words.length ? `<h3 class="k">${note.text ? 'Words to know' : 'Words on this line'}</h3>${words.map(entry).join('')}` : ''}</div>
      <details class="glall"><summary>All words (${more.length})</summary>${more.sort((a, b) => a.term.localeCompare(b.term)).map(entry).join('')}</details></div>`);
    let changed = false;
    codeBox(d.querySelector('.lbox'), d, { code: line, lang, line: n, apply: X.canEdit(p) ? (v) => { editLine(n, v); changed = true; const g = d.querySelector('.glnote'); if (g) g.classList.add('stale');
      if (!note.text) { const w = wordsOn(v, lang).map(defOf).filter(Boolean); d.querySelector('.glwords').innerHTML = w.length ? `<h3 class="k">Words on this line</h3>${w.map(entry).join('')}` : ''; activate(d); } } : null });
    d.addEventListener('close', () => { if (changed) paint(); }, { once: true });
    activate(d);
    const gn = d.querySelector('.glnote'); if (gn) gn.onclick = (e) => { const b = e.target.closest('b.kw'); if (!b) return; const card = [...d.querySelectorAll('.gl[data-term]')].find((x) => x.dataset.term.toLowerCase() === b.textContent.toLowerCase()); if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1200); } };
  }
  // The words a line of code uses, from the starter glossary: the first layer of Help, there at once.
  const CODE_WORDS = { js: [[/\bconst\s/, 'const'], [/\blet\s/, 'let'], [/\b(let|const|var)\s/, 'variable'], [/\bfunction\b/, 'function'], [/=>/, 'arrow function'], [/\breturn\b/, 'return'],
      [/\bif\s*\(/, 'if'], [/\bfor\s*\(/, 'for loop'], [/console\.log/, 'console.log'], [/\bdocument\b/, 'document'], [/getElementById/, 'getElementById'], [/querySelector/, 'querySelector'],
      [/addEventListener/, 'event listener'], [/['"]click['"]/, 'click'], [/textContent/, 'textContent'], [/innerHTML/, 'innerHTML'], [/requestAnimationFrame/, 'requestAnimationFrame'],
      [/setInterval/, 'setInterval'], [/setTimeout/, 'setTimeout'], [/getContext/, 'context'], [/\bcanvas\b/i, 'canvas'], [/\+\+|\+=\s*1\b|=\s*(\w+)\s*\+\s*1\b/, 'increment'], [/\.style\b/, 'style'],
      [/\/\/|\/\*/, 'comment'], [/\[[^\]]*,/, 'array'], [/\{\s*\w+\s*:/, 'object'], [/\.push\(|\.filter\(|\.map\(|\.forEach\(/, 'method']],
    html: [[/<[a-z]/i, 'tag'], [/\sid=/, 'id'], [/\sclass=/, 'class'], [/\s[\w-]+=/, 'attribute'], [/<canvas/i, 'canvas'], [/<!--/, 'comment']],
    css: [[/^[^:{]*\{/, 'selector'], [/\.[\w-]+\s*[{,]/, 'class'], [/[\w-]+\s*:/, 'style'], [/\/\*/, 'comment']] };
  const SPOT = { variable: /\b(?:let|const|var)\s+([\w$]+)/, increment: /([\w$]+\s*(?:\+\+|\+=\s*1\b|=\s*[\w$]+\s*\+\s*1\b))/, 'for loop': /\bfor\s*\(/, if: /\bif\s*\(/, click: /['"]click['"]/ };
  function spot(line, term, lang) {
    const t = term.toLowerCase(), re = SPOT[t] || (CODE_WORDS[lang].find(([, w]) => w.toLowerCase() === t) || [])[0] || new RegExp(RE(term), 'i');
    const m = line.match(re); if (!m) return null;
    const s = m[1] != null ? m.index + m[0].indexOf(m[1]) : m.index, len = (m[1] != null ? m[1] : m[0]).trimEnd().length;
    return [s, s + len];
  }
  const wordsOn = (line, lang) => [...new Set(CODE_WORDS[lang].filter(([re]) => re.test(line)).map(([, w]) => w))];

  function helpView(el, src) {
    const key = file + '\u0000' + src, lines = src.split('\n'), lang = langOf(file), notes = helpCache.get(key);
    const rows = (n) => lines.map((l, i) => { const w = n && n[i + 1] ? null : wordsOn(l, lang);
      return `<div class="hl-row"><span class="hn">${i + 1}</span><code>${hl(l, lang).slice(0, -1) || ' '}</code></div>${n && n[i + 1] ? `<button class="hl-note" data-n="${i + 1}">💡 ${marked(n[i + 1].text, n[i + 1].terms).html}<span class="hl-more">more ›</span></button>`
        : w.length ? `<button class="hl-note gw" data-n="${i + 1}" data-w="${esc(w.join('|'))}">📖 ${w.map((x) => `<b class="kw">${esc(x)}</b>`).join(' · ')}<span class="hl-more">learn ›</span></button>` : ''}`; }).join('');
    // the starter words this file's code uses: there at once, before Claude's notes arrive
    const inCode = Object.keys(GLOSS).filter((w) => new RegExp('(^|[^\\w.])' + RE(w) + '(?![\\w])', w === 'HTML' || w === 'CSS' || w === 'DOM' ? '' : 'i').test(src) || (w === 'variable' && /\b(let|const|var)\s/.test(src)) || (w === 'event listener' && /addEventListener/.test(src)) || (w === 'string' && /['"`]/.test(src)) || (w === 'comment' && /\/\/|\/\*|<!--/.test(src)));
    el.innerHTML = `<div class="helpv">${inCode.length ? `<button class="hl-words" id="hlw">📖 Words in this file <small>${inCode.length}</small></button>` : ''}${notes ? '' : reading.has(key) ? '<p class="hl-wait">✦ Claude is reading ' + esc(file) + '…</p>' : ''}${rows(notes)}</div>`;
    const hw = el.querySelector('#hlw'); if (hw) hw.onclick = () => activate(X.sheet(`<div class="playh"><b>📖 Words in ${esc(file)}</b><small>${inCode.length} to know</small><button data-close aria-label="Close">✕</button></div><div class="glbody">${inCode.map(defOf).filter(Boolean).map(entry).join('')}</div>`));
    el.querySelectorAll('.hl-note').forEach((b) => (b.onclick = () => { const k = +b.dataset.n; openNote(k, lines[k - 1], b.dataset.w ? { terms: b.dataset.w.split('|') } : notes[k]); }));
  }
  // One line of the open file, changed from the help panel: a draft, like typing in the editor.
  function editLine(k, v) {
    draft = draft || { ...head().files };
    const before = draft[file] ?? '', L = before.split('\n'); L[k - 1] = v; draft[file] = L.join('\n');
    // Claude's notes stay with their lines (one line changed, none moved)
    const old = helpCache.get(file + '\u0000' + before); if (old) helpCache.set(file + '\u0000' + draft[file], old);
    $('bver').textContent = 'v' + head().v + (dirty() ? ' · unsaved' : '');
  }
  // Help starts with the glossary only; Claude reads the file when asked (a question, not a build).
  const reading = new Set();
  function dig(src, line) {
    const key = file + '\u0000' + src;
    if (helpCache.has(key) || reading.has(key)) return;
    reading.add(key); if (helpOn && tab === 'files') paint();
    const f = file;
    X.explain(p, f, src).then((r) => {
      const n = {};
      for (const x of r.help || []) if (x && x.n >= 1) n[x.n] = n[x.n] ? { text: n[x.n].text + ' ' + x.text, terms: [...n[x.n].terms, ...(x.terms || [])] } : { text: x.text, terms: x.terms || [] };
      for (const g of r.glossary || []) gloss[g.term.toLowerCase()] = g;
      helpCache.set(key, n); reading.delete(key);
      if (helpOn && tab === 'files' && file === f) { paint(); if (line && n[line]) openNote(line, src.split('\n')[line - 1], n[line]); }
    }, (e) => { reading.delete(key); X.toast(e.message); if (helpOn && tab === 'files') paint(); });
  }

  function open(proj, ctx, intro) {
    X = ctx; p = proj; file = Object.keys(head().files).includes('main.js') ? 'main.js' : Object.keys(head().files)[0]; tab = p.kit === 'code' ? 'files' : 'claude'; draft = null; viewV = null;
    ask = [{ t: X.canEdit(p) ? 'I can read this code. Try: “explain main.js”, “why is it broken?”, or tell me anything you want it to do next, even something completely different.' : 'Read-only. Remix it to change the code.' }];
    if (intro) ask.push({ t: intro, ok: true });
    $('title').textContent = 'code'; $('back').hidden = false; $('mark').hidden = true;
    $('body').innerHTML = `<div class="bench codebench"><div class="bbar"><span class="bname">${esc(p.name)}</span><span class="bver" id="bver"></span><span class="grow"></span><button class="bb" id="crun" title="Run (⌘/Ctrl+Enter)">▶</button><button class="bb" id="cphone" aria-label="Test on phone">📱</button><button class="bb share" id="cshare">↗ Share</button></div>
      <div class="prev mini" hidden><iframe id="pv" title="Preview" sandbox="allow-scripts allow-modals" tabindex="-1"></iframe><button class="pcover" id="popen" aria-label="Open the preview"><span>⤢ Open preview</span></button><span class="live">● run</span></div><div class="cons" id="cons"></div>
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
      el.innerHTML = `<div class="ftabs">${Object.keys(F).map((f) => `<button data-f="${esc(f)}" class="${f === file ? 'on' : ''}">${esc(f)}${draft && draft[f] !== head().files[f] ? ' •' : ''}</button>`).join('')}${ed ? '<button class="nf" id="nf">＋</button>' : ''}<button class="nf help${helpOn ? ' on' : ''}" id="hlp" title="Help me: what each line does">💡 Help</button></div>
        ${helpOn ? '<div class="ed edh" id="edh"></div>' : `<div class="ed"><pre class="gut" id="gut">${Array.from({ length: n }, (_, i) => i + 1).join('\n')}</pre><div class="edw"><pre class="hlc" id="hlc" aria-hidden="true">${hl(src, langOf(file))}</pre><textarea id="src" spellcheck="false" autocapitalize="off" autocorrect="off" wrap="off"${ed ? '' : ' readonly'}>${esc(src)}</textarea></div></div>`}
        ${ed ? `<form class="cmt" id="cmt"><input id="cmsg" placeholder="${dirty() ? 'What did you change?' : 'Edit, then commit'}" autocomplete="off"><button class="bb" type="button" id="crev"${dirty() ? '' : ' disabled'}>↺</button><button class="bb share" id="cgo"${dirty() ? '' : ' disabled'}>Commit</button></form>` : ''}`;
      el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { file = b.dataset.f; paint(); }));
      $('hlp').onclick = () => { helpOn = !helpOn; paint(); };
      if (helpOn) { helpView($('edh'), src); if (ed) wireCommit(F); return; }
      const ta = $('src'), g = $('gut'), hc = $('hlc');
      ta.onscroll = () => { g.scrollTop = ta.scrollTop; hc.scrollTop = ta.scrollTop; hc.scrollLeft = ta.scrollLeft; };
      ta.oninput = () => { draft = draft || { ...head().files }; draft[file] = ta.value; hc.innerHTML = hl(ta.value, langOf(file)); ta.onscroll(); g.textContent = Array.from({ length: ta.value.split('\n').length }, (_, i) => i + 1).join('\n'); $('bver').textContent = 'v' + head().v + ' · unsaved'; $('cgo').disabled = $('crev').disabled = !dirty(); };
      ta.onkeydown = (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.oninput(); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
      if (ed) wireCommit(F);
      return;
    }
    function wireCommit(F) {
      {
        $('nf').onclick = () => { const nm = (prompt('New file name', 'helpers.js') || '').trim(); if (!nm || F[nm] != null) return; draft = { ...(draft || head().files), [nm]: '' }; file = nm; paint(); X.toast(nm.endsWith('.js') ? 'Only main.js runs on its own: load ' + nm + ' from index.html with a script tag.' : 'Added ' + nm); };
        $('crev').onclick = () => { draft = null; paint(); run(); };
        $('cmt').onsubmit = (e) => { e.preventDefault(); if (!dirty()) return; commit($('cmsg').value.trim() || 'Edited ' + Object.keys(draft).filter((k) => draft[k] !== head().files[k]).join(', '), draft); run(); X.toast('Committed v' + head().v); };
      }
    }
    if (tab === 'claude') {
      el.innerHTML = `<div class="bchat" id="cchat">${ask.map((m) => `<div class="bm${m.me ? ' me' : ''}${m.ok ? ' ok' : ''}">${m.me ? '' : '<i>✦</i>'}<span>${m.html || esc(m.t)}</span></div>`).join('')}</div>
        ${ed ? `<div class="sugs">${['explain main.js', 'why is it broken?', 'make it look nicer', 'add a sound', 'add a reset button', 'turn it into a game'].map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div><form class="bask" id="cask"><input id="cq" placeholder="Ask about the code…" autocomplete="off"><button class="ibtn send" aria-label="Send">↑</button></form><p class="capn">${X.left() === Infinity ? 'No build limit.' : X.left() + ' builds left today · reading and explaining don’t use one'}</p>` : ''}`;
      const go = (q) => claude(q.trim());
      if (ed) { $('cask').onsubmit = (e) => { e.preventDefault(); go($('cq').value); }; el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => go(b.dataset.s))); }
      $('cchat').scrollTop = 1e6; return;
    }
    if (tab === 'log') {
      if (viewV != null) {
        // a version from before it outgrew its kit has no files: show the page the kit built
        const fo = (x) => (x ? x.files || { 'index.html': PR.KITS[p.kit].build(x.params) } : {});
        const v = { ...p.versions[viewV], files: fo(p.versions[viewV]) }, pv = p.versions[viewV - 1], prev = pv && { ...pv, files: fo(pv) }, files = [...new Set([...Object.keys(v.files), ...Object.keys((prev || {}).files || {})])];
        el.innerHTML = `<button class="crumb" id="cbk">‹ All commits</button><div class="dh"><b>v${v.v}</b> ${esc(v.note)} <small>${esc((X.byId(v.by || p.owner) || {}).name)} · ${X.ago(v.at)}</small></div>`
          + files.map((f) => { const dd = diff(prev ? prev.files[f] : '', v.files[f]), ch = dd.filter((x) => x[0] !== '=').length; return ch || !prev ? `<div class="df"><div class="dfn">${esc(f)} <small>+${dd.filter((x) => x[0] === '+').length} −${dd.filter((x) => x[0] === '-').length}</small></div><pre class="dfb">${dd.filter((x, i, a) => x[0] !== '=' || a.slice(Math.max(0, i - 2), i + 3).some((y) => y[0] !== '=')).map(([k, l]) => `<span class="d${k === '+' ? 'a' : k === '-' ? 'r' : ''}">${k === '=' ? ' ' : k} ${esc(l)}</span>`).join('\n')}</pre></div>` : ''; }).join('')
          + (ed && viewV !== p.cur ? `<button class="go" id="cco">Check out v${v.v}</button>` : '');
        $('cbk').onclick = () => { viewV = null; paint(); };
        const co = $('cco'); if (co) co.onclick = () => { p.cur = viewV; draft = null; X.save(); viewV = null; X.toast('Checked out v' + head().v); if (!head().files) return X.openBench(p.id); paint(); run(); };
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
      if (r.name) p.name = r.name;
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
