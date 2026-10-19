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

  let diffFile = null;
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
  const entry = (d) => `<div class="gl" data-term="${esc(d.term)}" role="button" tabindex="0" aria-expanded="false"><b><span>${esc(d.term)}</span><i class="glchev">⌄</i></b><p>${esc(d.means)}</p><div class="glmore" hidden></div></div>`;
  // A word card, opened: where this file uses it, ▶ Try it (the example, editable, run in a sandbox),
  // and ✦ Ask Claude about it (in the Claude tab, about this code).
  const usesOf = (term, src, lang) => { const t = term.toLowerCase(); return src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => wordsOn(l, lang).some((w) => w.toLowerCase() === t) || new RegExp('(^|[^\\w])' + RE(term) + '(?![\\w])', 'i').test(l)); };
  const RUNNER = "<script>(function(){var o=function(k,a){parent.postMessage({r4try:[k,[].map.call(a,function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ')]},'*')};['log','info','warn','error'].forEach(function(k){console[k]=function(){o(k,arguments)}});addEventListener('error',function(e){o('error',[e.message])})})()<\/script>";
  // The one code box: coloured, editable, ▶ Run in a sandbox (an example on its own; a line of the file
  // inside the whole project, so it runs for real), and ✓ Apply to put an edited line into the file.
  // ---------- peek: what one line makes, drawn on its own (a shape, a colour, a list, an element…) ----------
  // The value is worked out in the sandbox; if the line can't stand alone (it uses other lines, or it
  // does something rather than make something), the box shows the whole project instead.
  const balanced = (s) => { let d = 0, q = null; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; } if (`'"\``.includes(ch)) q = ch; else if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; if (d < 0) return false; } return d === 0 && !q; };
  function peekOf(line, lang) {
    const t = line.trim().replace(/[,;]\s*$/, '');
    if (!t || t.startsWith('//')) return null;
    if (lang === 'html') return /^<([\w-]+)[^>]*>.*<\/\1>$|^<(img|input|br|hr)\b[^>]*>$/i.test(t) ? { html: t } : null;
    if (lang === 'css') { const m = t.match(/^([\w-]+)\s*:\s*(.+)$/); return m ? { css: [m[1], m[2]] } : null; }
    let m, expr = null, key = null;
    if ((m = t.match(/^(?:const|let|var)\s+([\w$]+)\s*=\s*([\s\S]+)$/))) { key = m[1]; expr = m[2]; }
    else if ((m = t.match(/^['"]?([\w$-]+)['"]?\s*:\s*([\s\S]+)$/))) { key = m[1]; expr = m[2]; }
    else if (/^[[{'"`\d#-]/.test(t)) expr = t;
    if (!expr || !balanced(expr) || /^(function|\(.*\)\s*=>|async)\b/.test(expr) || /=>/.test(expr)) return null;
    return { expr, key };
  }
  const PEEK = `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0B1F;color:#F3F1FF;font:14px system-ui,sans-serif}
    .card{display:grid;gap:8px;padding:12px 14px;border-radius:12px;background:#ffffff0a;border:1px solid #ffffff1c;max-width:92vw}.k{color:#ACA5D6;font:600 12px ui-monospace,monospace}
    .row{display:flex;gap:10px;align-items:center}.sw{position:relative;width:30px;height:30px;border-radius:8px;border:1px solid #ffffff33}.sw.pick{cursor:pointer;width:40px;height:40px;box-shadow:0 0 0 2px #ffffff22}.sw.pick:hover{box-shadow:0 0 0 2px #F5C542}.sw input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:0;padding:0}.big{font:800 40px system-ui}.emo{font-size:56px}
    .grid{display:grid;gap:3px}.cell{all:unset;box-sizing:border-box;cursor:pointer;width:26px;height:26px;border-radius:4px;display:grid;place-items:center;font:700 11px ui-monospace,monospace;color:#00000088}.cell.off{background:#ffffff08;border:1px dashed #ffffff22;color:#ffffff44}.cell:hover{outline:2px solid #F5C542}
    .bars{display:flex;gap:4px;align-items:flex-end;height:90px}.bar{width:18px;background:#3DD6C6;border-radius:3px 3px 0 0}.chip{padding:3px 9px;border-radius:99px;background:#ffffff12}</style>
    <script>(function(){
      var COL=/^(#[0-9a-f]{3,8}|rgba?\\(|hsla?\\()/i, EMO=/^\\p{Extended_Pictographic}/u;
      function esc(s){return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
      var seen={};
      function sw(c){var m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);if(!m)return '<div class="sw" style="background:'+esc(c)+'"></div>';var h=m[1].length===3?m[1].split('').map(function(x){return x+x}).join(''):m[1],k=seen[c.toLowerCase()]=(seen[c.toLowerCase()]||0)+1;return '<label class="sw pick" style="background:'+esc(c)+'" title="Pick a colour"><input type="color" value="#'+h+'" data-c="'+esc(c)+'" data-k="'+(k-1)+'"></label>'}
      document.addEventListener('input',function(e){if(e.target.dataset.c)e.target.parentNode.style.background=e.target.value});
      document.addEventListener('change',function(e){var t=e.target;if(t.dataset.c)parent.postMessage({r4color:[t.dataset.c,t.value.toUpperCase(),+t.dataset.k]},'*')});
      function shape(v){return Array.isArray(v)&&v.length&&v.every(function(r){return Array.isArray(r)&&r.length&&r.every(function(x){return typeof x==='number'||typeof x==='boolean'})})}
      // a shape: each cell shows its value in the code (1 / 0); tap one to flip it, and the line follows
      var grids=[];
      function grid(v,c){var gi=grids.push(v)-1;return '<div class="grid" data-g="'+gi+'" style="grid-template-columns:repeat('+Math.max.apply(0,v.map(function(r){return r.length}))+',26px)">'+v.map(function(r,ri){return r.map(function(x,ci){return '<button class="cell'+(x?'':' off')+'" data-r="'+ri+'" data-c="'+ci+'" style="'+(x?'background:'+esc(c||'#3DD6C6'):'')+'">'+(typeof x==='boolean'?(x?'true':'false'):x)+'</button>'}).join('')}).join('')+'</div>'}
      document.addEventListener('click',function(e){var b=e.target.closest('.cell');if(!b)return;var g=b.closest('.grid'),gi=+g.dataset.g,v=grids[gi].map(function(r){return r.slice()}),r=+b.dataset.r,cc=+b.dataset.c,x=v[r][cc];v[r][cc]=typeof x==='boolean'?!x:(x?0:1);parent.postMessage({r4grid:[gi,v]},'*')});
      function view(v,key,ctx){
        if(shape(v))return grid(v,ctx&&ctx.color);
        if(typeof v==='string'&&COL.test(v))return '<div class="row">'+sw(v)+'<code>'+esc(v)+'</code></div>';
        if(typeof v==='string')return EMO.test(v)&&v.length<=8?'<div class="emo">'+esc(v)+'</div>':'<div>“'+esc(v)+'”</div>';
        if(typeof v==='number')return '<div class="big">'+v+'</div>';
        if(typeof v==='boolean')return '<div class="big">'+(v?'✓ true':'✗ false')+'</div>';
        if(Array.isArray(v)){
          if(v.length&&v.every(function(x){return typeof x==='number'})){var mx=Math.max.apply(0,v.map(Math.abs))||1;return '<div class="bars">'+v.map(function(x){return '<div class="bar" title="'+x+'" style="height:'+Math.max(4,Math.abs(x)/mx*90)+'px"></div>'}).join('')+'</div>'}
          if(v.length&&v.every(function(x){return typeof x==='string'&&COL.test(x)}))return '<div class="row">'+v.map(sw).join('')+'</div>';
          return '<div class="row" style="flex-wrap:wrap">'+v.slice(0,30).map(function(x){return typeof x==='object'&&x?view(x):'<span class="chip">'+esc(typeof x==='string'?x:JSON.stringify(x))+'</span>'}).join('')+'</div>';
        }
        if(v&&typeof v==='object'){
          var keys=Object.keys(v).slice(0,12),sh=keys.filter(function(k){return shape(v[k])});
          return '<div class="card">'+sh.map(function(k){return grid(v[k],v.color||v.colour)}).join('')+keys.filter(function(k){return sh.indexOf(k)<0}).map(function(k){var x=v[k];return '<div class="row"><span class="k">'+esc(k)+'</span>'+(typeof x==='object'&&x?'<span>'+esc(JSON.stringify(x).slice(0,40))+'</span>':view(x))+'</div>'}).join('')+'</div>';
        }
        if(typeof v==='function')return '<div class="k">a function</div>';
        return '<div class="k">'+esc(String(v))+'</div>';
      }
      window.__peek=function(f,key){try{var v=f();document.body.innerHTML=(key?'<div style="display:grid;gap:8px;justify-items:center"><span class="k">'+esc(key)+'</span>':'<div>')+view(v,key)+'</div>';parent.postMessage({r4peek:'ok'},'*')}catch(e){parent.postMessage({r4peek:'fail'},'*')}};
    })()<\/script>`;
  function peekDoc(pk) {
    if (pk.html) { const css = (draft || head().files)['style.css'] || ''; return `<!doctype html><style>body{margin:0;padding:14px;background:#0D0B1F;color:#fff;font:15px system-ui}${css}</style>${pk.html}<script>parent.postMessage({r4peek:'ok'},'*')<\/script>`; }
    if (pk.css) { const [k, v] = pk.css; return `<!doctype html><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0B1F;color:#fff;font:15px system-ui}.s{padding:16px 22px;border-radius:12px;border:1px dashed #ffffff33;${k}:${v.replace(/[<>]/g, '')}}code{display:block;margin-top:8px;color:#ACA5D6;font:12px ui-monospace,monospace;text-align:center}.sw{position:relative;display:block;margin:10px auto 0;width:40px;height:40px;border-radius:8px;border:1px solid #ffffff33;box-shadow:0 0 0 2px #ffffff22;cursor:pointer}.sw input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}</style><div><div class="s">Aa · sample</div><code>${esc(k)}: ${esc(v)}</code>${/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? `<label class="sw" style="background:${v.trim()}"><input type="color" value="${v.trim().length === 4 ? '#' + v.trim().slice(1).split('').map((x) => x + x).join('') : v.trim()}" data-c="${v.trim()}"></label>` : ''}</div><script>parent.postMessage({r4peek:'ok'},'*');document.addEventListener('input',function(e){var t=e.target;if(t.dataset.c){t.parentNode.style.background=t.value;document.querySelector('.s').style.setProperty(${JSON.stringify(k)},t.value)}});document.addEventListener('change',function(e){var t=e.target;if(t.dataset.c)parent.postMessage({r4color:[t.dataset.c,t.value.toUpperCase(),0]},'*')})<\/script>`; }
    return `<!doctype html><head>${PEEK}</head><body><script>__peek(function(){return (${pk.expr.replace(/<\/script/gi, '<\\/script')}\n)},${JSON.stringify(pk.key)})<\/script></body>`;
  }

  function codeBox(host, d, { code, lang, line, apply, term, onInput }) {
    // the live preview: the project with this line as it is in the box (or the example on its own),
    // redrawn a moment after you stop typing; a JS-only example shows its console here instead
    const page = !!line || lang !== 'js';
    host.innerHTML = `<div class="glprev"${page ? '' : ' hidden'}><iframe class="glframe" sandbox="allow-scripts allow-modals" title="Live preview"></iframe><button class="glre" aria-label="Start again" title="Start again">↻</button><button class="gllive" data-mode title="Switch between this line and the whole project"></button></div><div class="glout"></div>
      <div class="gled"><pre class="glcode" aria-hidden="true">${hl(code, lang).slice(0, -1) || ' '}</pre><textarea class="glcode" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Code">${esc(code)}</textarea></div>
      <div class="glacts"><button class="glaskb" data-askb>✦ Ask</button>${apply ? '<button class="glapply" data-apply disabled>✓ Apply</button>' : ''}<small>${apply ? 'Change it and watch the preview; ✓ puts it in ' + esc(file) + '.' : 'Change it and watch: nothing here touches your project.'}</small></div>`;
    const ta = host.querySelector('textarea'), pre = host.querySelector('pre'), out = host.querySelector('.glout'), fr = host.querySelector('iframe'), ap = host.querySelector('[data-apply]');
    let lit = null, timer = 0, whole = false, peeked = false;   // whole: the project; else what the line makes, if it can stand alone
    const draw = () => { const v = ta.value, r = lit && spot(v, lit, lang); pre.innerHTML = r ? hl(v.slice(0, r[0]), lang).slice(0, -1) + `<mark>${hl(v.slice(r[0], r[1]), lang).slice(0, -1)}</mark>` + hl(v.slice(r[1]), lang).slice(0, -1) : hl(v, lang).slice(0, -1) || ' '; };
    host.mark = (term) => { lit = term; draw(); };
    const mode = host.querySelector('[data-mode]');
    const label = () => { mode.textContent = peeked && !whole ? '🔍 this line · tap for whole' : '● live · whole project'; mode.hidden = !line; };
    const on = (e) => { if (e.source !== fr.contentWindow || !e.data) return;
      if (e.data.r4grid) {
        const [gi, v] = e.data.r4grid, row = '\\[\\s*(?:-?\\d+|true|false)(?:\\s*,\\s*(?:-?\\d+|true|false))*\\s*\\]';
        const re = new RegExp('\\[\\s*' + row + '(?:\\s*,\\s*' + row + ')*\\s*\\]', 'g');
        let i = -1; ta.value = ta.value.replace(re, (m) => (++i === gi ? '[' + v.map((r) => '[' + r.join(',') + ']').join(',') + ']' : m));
        draw(); if (ap) ap.disabled = ta.value === code; clearTimeout(timer); run(); return;
      }
      if (e.data.r4color) {
        const [old, nw, k] = e.data.r4color, src = ta.value, re = new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let i = -1, out2 = src.replace(re, (m) => (++i === k ? nw : m));
        if (out2 === src && k) out2 = src.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), nw);
        ta.value = out2; draw(); if (ap) ap.disabled = ta.value === code; clearTimeout(timer); run(); return;
      }
      if (e.data.r4peek) { if (e.data.r4peek === 'fail' && !whole) { peeked = false; full(); } return; }
      const m = e.data.r4try || e.data.r4log; if (!m) return; out.insertAdjacentHTML('beforeend', `<div class="cl ${m[0]}">${m[0] === 'error' ? '✕' : '›'} ${esc(m[1])}</div>`); };
    addEventListener('message', on); d.addEventListener('close', () => { removeEventListener('message', on); clearTimeout(timer); }, { once: true });
    const full = () => { const F = { ...(draft || head().files) }, L = (F[file] ?? '').split('\n'); L[line - 1] = ta.value; F[file] = L.join('\n'); fr.srcdoc = PR.codeDoc(F); label(); };
    const run = () => {
      out.innerHTML = ''; const v = ta.value;
      if (line) { const pk = !whole && peekOf(v, lang); peeked = !!pk; if (pk) { fr.srcdoc = peekDoc(pk); label(); } else full(); }
      else fr.srcdoc = lang === 'js' ? `<!doctype html><body>${RUNNER}<script>${v.replace(/<\/script/gi, '<\\/script')}<\/script></body>` : lang === 'css' ? `<!doctype html><style>body{font:15px system-ui;color:#fff;background:#0D0B1F}${v}</style><h1>Heading</h1><p class="score">A paragraph</p><button id="go">Button</button>` : `<!doctype html><style>body{font:15px system-ui;color:#fff;background:#0D0B1F}</style>${RUNNER}${v}`;
      if (!page) setTimeout(() => { if (!out.children.length) out.innerHTML = '<div class="cl dim">nothing logged · add console.log(…) to see a value</div>'; }, 900);
    };
    ta.oninput = () => { draw(); if (ap) ap.disabled = ta.value === code; clearTimeout(timer); timer = setTimeout(run, 700); if (onInput) onInput(ta.value); };
    ta.onkeydown = (e) => { if (line && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); clearTimeout(timer); run(); } };
    host.querySelector('.glre').onclick = run;
    mode.onclick = () => { whole = !whole; run(); };
    run();
    // ✦ Ask: Claude, in the Claude tab, about this line (and the word whose card is open), or this word
    host.querySelector('[data-askb]').onclick = () => {
      const open = d.querySelector('.gl.open'), w = (open && open.dataset.term) || term, v = ta.value.trim();
      const q = line ? `What does line ${line} of ${file} do${w ? `, and what does "${w}" mean there` : ''}?\n${v}` : `Explain "${w}" to me, using my ${file} as the example.`;
      d.close(); tab = 'claude'; paint(); claude(q);
    };
    if (ap) ap.onclick = () => { apply(ta.value); code = ta.value; ap.disabled = true; X.toast('✓ Line ' + line + ' changed: commit when you’re ready.'); };
  }
  function activate(d) {
    d.querySelectorAll('.gl[data-term]').forEach((card) => {
      const toggle = (e) => {
        if (e.target.closest('.glmore')) return;
        const open = card.classList.toggle('open'); card.setAttribute('aria-expanded', open);
        const lb = d.querySelector('.lbox');
        if (lb && lb.mark) { d.querySelectorAll('.gl.open').forEach((x) => { if (x !== card) { x.classList.remove('open'); x.setAttribute('aria-expanded', 'false'); x.querySelector('.glmore').hidden = true; } }); lb.mark(open ? card.dataset.term : null); }
        const more = card.querySelector('.glmore'); more.hidden = !open; if (!open || more.dataset.done) return;
        more.dataset.done = 1;
        const term = card.dataset.term, src = (draft || head().files)[file] ?? '', lang = langOf(file), uses = usesOf(term, src, lang), ex = defOf(term)?.example || '';
        const inLine = !!d.querySelector('.lbox');
        more.innerHTML = `<div class="gluse">${uses.length ? `<small>In ${esc(file)}:</small>${uses.slice(0, 12).map(([n]) => `<button data-line="${n}">line ${n}</button>`).join('')}${uses.length > 12 ? `<small>+${uses.length - 12}</small>` : ''}` : `<small>Not in ${esc(file)} yet.</small>`}</div>${!inLine && ex ? '<div class="glbox"></div>' : ''}`;
        more.querySelectorAll('[data-line]').forEach((b) => (b.onclick = () => { const n = +b.dataset.line, line = src.split('\n')[n - 1]; d.close(); openLine(n); }));
        if (!inLine && ex) {
          // an example that prints nothing gets a console.log of its last variable, so ▶ shows something
          const xl = exLang(ex), nm = xl === 'js' && !/console\.log/.test(ex) && ([...ex.matchAll(/\b(?:let|const|var)\s+(\w+)|^\s*(\w+)\s*(?:=|\+\+)/gm)].pop() || []).slice(1).find(Boolean);
          codeBox(more.querySelector('.glbox'), d, { code: nm ? ex + '\nconsole.log(' + nm + ');' : ex, lang: xl, term });
        }
      };
      card.onclick = toggle; card.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); toggle(e); } };
    });
  }
  // A note, opened: its line, the note, and every key word in it explained; then all the words for this file.
  const curLines = () => ((draft || head().files)[file] ?? '').split('\n');
  const notesNow = () => helpCache.get(file + '\u0000' + curLines().join('\n'));
  const nextLine = (n, dir) => { const L = curLines(); let m = n + dir; while (m >= 1 && m <= L.length && !L[m - 1].trim()) m += dir; return m >= 1 && m <= L.length ? m : null; };
  // ‹ › buttons that step to the line before / after (blank lines skipped) in the same kind of panel
  function lineNav(d, n, open) {
    d.querySelectorAll('[data-step]').forEach((b) => { const m = nextLine(n, +b.dataset.step); if (!m) { b.disabled = true; b.textContent = b.dataset.step < 0 ? '‹' : '›'; return; }
      b.textContent = b.dataset.step < 0 ? '‹ line ' + m : 'line ' + m + ' ›'; b.onclick = () => { d.close(); open(m); }; });
  }
  const NAV = '<div class="lnav"><button data-step="-1" aria-label="Previous line"></button><button data-step="1" aria-label="Next line"></button></div>';

  // ✏️ Line: one line of the file, edited with its live preview (what it makes, or the whole project),
  // ✦ Ask and ✓ Apply; its words are chips that open the glossary.
  function openLine(n) {
    const line = curLines()[n - 1] ?? '', lang = langOf(file), nt = notesNow()?.[n];
    const chips = (v) => { const w = wordsOn(v, lang); return w.length ? `<span class="lwl">📖</span>${w.map((x) => `<button class="lchip" data-word="${esc(x)}">${esc(x)}</button>`).join('')}` : ''; };
    const d = X.sheet(`<div class="playh"><b>✏️ Line ${n}</b><small>${esc(file)}</small><button data-close aria-label="Close">✕</button></div>
      <div class="glbody"><div class="lbox"></div>${nt ? `<p class="glnote small">💡 ${marked(nt.text, nt.terms).html}</p>` : ''}<div class="lwords">${chips(line)}</div>${NAV}</div>`);
    let changed = false;
    const wireChips = () => d.querySelectorAll('[data-word]').forEach((b) => (b.onclick = () => { d.close(); openWord(b.dataset.word, n); }));
    codeBox(d.querySelector('.lbox'), d, { code: line, lang, line: n,
      onInput: (v) => { d.querySelector('.lwords').innerHTML = chips(v); wireChips(); const g = d.querySelector('.glnote'); if (g) g.classList.add('stale'); },
      apply: X.canEdit(p) ? (v) => { editLine(n, v); changed = true; } : null });
    wireChips(); lineNav(d, n, openLine);
    d.addEventListener('close', () => { if (changed) paint(); }, { once: true });
  }
  // 📖 a line's words: the line as it is, Claude's note if there is one, and a card for each word.
  function openWords(n) {
    const line = curLines()[n - 1] ?? '', lang = langOf(file), nt = notesNow()?.[n];
    const mk = nt ? marked(nt.text, nt.terms) : { html: '', found: wordsOn(line, lang).map((t) => t.toLowerCase()) }, words = mk.found.map(defOf).filter(Boolean);
    const d = X.sheet(`<div class="playh"><b>📖 Line ${n}</b><small>${esc(file)}</small><button data-close aria-label="Close">✕</button></div>
      <div class="glbody"><pre class="glcode ro">${hl(line, lang).slice(0, -1) || ' '}</pre>${nt ? `<p class="glnote">${mk.html}</p>` : ''}
      <div class="glwords">${words.length ? `<h3 class="k">Words on this line</h3>${words.map(entry).join('')}` : '<p class="note">No words to know on this line.</p>'}</div>
      <div class="lnav"><button class="ledit" data-edit>✏️ ${X.canEdit(p) ? 'Edit' : 'Try'} this line</button><button data-step="-1"></button><button data-step="1"></button></div></div>`);
    activate(d); lineNav(d, n, openWords);
    d.querySelector('[data-edit]').onclick = () => { d.close(); openLine(n); };
    const gn = d.querySelector('.glnote'); if (gn) gn.onclick = (e) => { const b = e.target.closest('b.kw'); if (!b) return; const card = [...d.querySelectorAll('.gl[data-term]')].find((x) => x.dataset.term.toLowerCase() === b.textContent.toLowerCase()); if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1200); } };
  }
  // 📖 one word, opened, from a line editor's chip (‹ back to that line)
  function openWord(term, n) {
    const def = defOf(term); if (!def) return;
    const d = X.sheet(`<div class="playh"><b>📖 ${esc(def.term)}</b><small>${esc(file)}</small><button data-close aria-label="Close">✕</button></div>
      <div class="glbody">${entry(def)}<div class="lnav"><button data-back>‹ back to line ${n}</button></div></div>`);
    activate(d); d.querySelector('.gl[data-term]').click();
    d.querySelector('[data-back]').onclick = () => { d.close(); openLine(n); };
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
    el.querySelectorAll('.hl-note').forEach((b) => (b.onclick = () => { const k = +b.dataset.n; openWords(k); }));
    el.querySelectorAll('.hl-row').forEach((r, i) => { r.onclick = () => openLine(i + 1); });
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
      if (helpOn && tab === 'files' && file === f) { paint(); if (line && n[line]) openWords(line); }
    }, (e) => { reading.delete(key); X.toast(e.message); if (helpOn && tab === 'files') paint(); });
  }

  function open(proj, ctx, intro, autoAsk) {
    X = ctx; p = proj; file = Object.keys(head().files).includes('main.js') ? 'main.js' : Object.keys(head().files)[0]; tab = p.kit === 'code' ? 'files' : 'claude'; draft = null; viewV = null;
    ask = [{ t: X.canEdit(p) ? 'I can read this code. Try: “explain main.js”, “why is it broken?”, or tell me anything you want it to do next, even something completely different.' : 'Read-only. Remix it to change the code.' }];
    if (intro) ask.push({ t: intro, ok: true });
    $('title').textContent = 'code'; $('back').hidden = false; $('mark').hidden = true;
    $('body').innerHTML = `<div class="bench codebench"><div class="bbar"><span class="bname">${esc(p.name)}</span><span class="bver" id="bver"></span><span class="grow"></span><button class="bb" id="crun" title="Run (⌘/Ctrl+Enter)">▶</button><button class="bb" id="cphone" aria-label="Test on phone">📱</button><button class="bb share" id="cshare">↗ Share</button></div>
      <div class="prev mini" hidden><iframe id="pv" title="Preview" sandbox="allow-scripts allow-modals" tabindex="-1"></iframe><button class="pcover" id="popen" aria-label="Open the preview"><span>⤢ Open preview</span></button><span class="live">● run</span></div><div class="cons" id="cons"></div>
      <div class="btabs" id="ctabs"></div><div class="tbody" id="ctb"></div></div>`;
    $('crun').onclick = run; $('popen').onclick = openPanel; X.sw('bench', null, openPanel, true); $('cphone').onclick = () => X.phoneTest(p); $('cshare').onclick = () => X.shareSheet(p); $('cshare').hidden = p.owner !== X.viewer().id;
    paint(); run(); window.scrollTo(0, 0);
    if (autoAsk) { tab = 'claude'; paint(); claude(autoAsk); }   // an idea that Claude builds: it starts at once
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
      // ✏️ tap a line number: that line in the line editor
      g.title = 'Tap a line number to open that line';
      g.onclick = (e) => { const cs = getComputedStyle(g), lh = parseFloat(cs.lineHeight) || 18, n = Math.floor((e.clientY - g.getBoundingClientRect().top + g.scrollTop - parseFloat(cs.paddingTop)) / lh) + 1; if (n >= 1 && n <= ta.value.split('\n').length) openLine(n); };
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
        // a tab per changed file, and one diff that fills the rest of the screen
        const changes = files.map((f) => { const dd = diff(prev ? prev.files[f] : '', v.files[f]); return { f, dd, add: dd.filter((x) => x[0] === '+').length, del: dd.filter((x) => x[0] === '-').length }; }).filter((x) => x.add || x.del || !prev);
        if (!changes.some((x) => x.f === diffFile)) diffFile = (changes.find((x) => x.f === 'main.js') || changes[0] || {}).f;
        const cur2 = changes.find((x) => x.f === diffFile);
        el.innerHTML = `<button class="crumb" id="cbk">‹ All commits</button><div class="dh"><b>v${v.v}</b> ${esc(v.note)} <small>${esc((X.byId(v.by || p.owner) || {}).name)} · ${X.ago(v.at)}</small></div>`
          + (changes.length ? `<div class="ftabs">${changes.map((x) => `<button data-df="${esc(x.f)}" class="${x.f === diffFile ? 'on' : ''}">${esc(x.f)} <small class="dfc"><i class="a">+${x.add}</i> <i class="r">−${x.del}</i></small></button>`).join('')}</div>
            <pre class="dfb dfull">${cur2.dd.filter((x, i, a) => x[0] !== '=' || a.slice(Math.max(0, i - 2), i + 3).some((y) => y[0] !== '=')).map(([k, l]) => `<span class="d${k === '+' ? 'a' : k === '-' ? 'r' : ''}"><i class="dk">${k === '=' ? ' ' : k}</i>${hl(l, langOf(diffFile)).slice(0, -1) || ' '}</span>`).join('')}</pre>` : '<p class="note">No changes in this version.</p>')
          + (ed && viewV !== p.cur ? `<button class="go" id="cco">Check out v${v.v}</button>` : '');
        el.querySelectorAll('[data-df]').forEach((b) => (b.onclick = () => { diffFile = b.dataset.df; paint(); }));
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
