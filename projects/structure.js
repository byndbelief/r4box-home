/* One thing per line, so the line editor can open any line on its own: CSS gets one property per
   line, JS one statement per line, and `let a = 1, b = 2;` becomes `let a = 1;` and `let b = 2;`.
   CSS is laid out by js-beautify (window.beautifier, MIT); JS by the small scanner here, which leaves
   objects and arrays as they were written. HTML and other files stay as they are. */
(function () {
  const OPT = { indent_size: 2, preserve_newlines: true, max_preserve_newlines: 2, end_with_newline: true };
  // `let a, b = 1, c = f(x, y);` at the start of a line → one declaration each. Skipped (left whole) if
  // the scan isn't sure where it ends: a regex or template it can't follow, or brackets that don't close.
  function splitDecls(src) {
    const out = []; let i = 0;
    const lineStart = (k) => { let j = k - 1; while (j >= 0 && (src[j] === ' ' || src[j] === '\t')) j--; return j < 0 || src[j] === '\n'; };
    while (i < src.length) {
      const m = /^(let|const|var)\s+/.exec(src.slice(i, i + 8));
      if (!m || !lineStart(i) || (i > 0 && /[\w$]/.test(src[i - 1]))) { out.push(src[i++]); continue; }
      const ind = src.slice(src.lastIndexOf('\n', i - 1) + 1, i), kw = m[1];
      let j = i + m[0].length, depth = 0, start = j, last = '';
      const parts = []; let end = -1, ok = true;
      while (j < src.length) {
        const c = src[j];
        if (c === '/' && src[j + 1] === '/') { ok = false; break; }   // a comment inside: leave it whole
        if (c === '/' && src[j + 1] === '*') { ok = false; break; }
        if (c === '"' || c === "'" || c === '`') {
          let k = j + 1; while (k < src.length && src[k] !== c) { if (src[k] === '\\') k++; if (c === '`' && src[k] === '$' && src[k + 1] === '{') { let d = 1; k += 2; while (k < src.length && d) { if (src[k] === '{') d++; else if (src[k] === '}') d--; else if (/['"`]/.test(src[k])) { ok = false; break; } k++; } if (!ok) break; continue; } if (c !== '`' && src[k] === '\n') { ok = false; break; } k++; }
          if (!ok || k >= src.length) { ok = false; break; } j = k + 1; last = c; continue;
        }
        if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(last)) {   // a regex literal
          let k = j + 1, cls = false; while (k < src.length && src[k] !== '\n' && (cls || src[k] !== '/')) { if (src[k] === '\\') k++; else if (src[k] === '[') cls = true; else if (src[k] === ']') cls = false; k++; }
          if (src[k] !== '/') { ok = false; break; } j = k + 1; while (/[a-z]/.test(src[j] || '')) j++; last = 'r'; continue;
        }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) { if (--depth < 0) { ok = false; break; } }
        else if (c === ',' && !depth) { parts.push(src.slice(start, j)); start = j + 1; }
        else if (c === ';' && !depth) { end = j + 1; break; }
        else if (c === '\n' && !depth && !/[,=+\-*/&|?:([{]$/.test(last)) { const rest = src.slice(j).match(/^\s*(\S)/); if (!rest || !/^[.,?:+\-*/&|=)\]}]/.test(rest[1]) || rest[1] === '}') { end = j; break; } }
        if (!/\s/.test(c)) last = c;
        j++;
      }
      if (end < 0 && ok && depth === 0 && j >= src.length) end = j;
      if (!ok || end < 0) { out.push(src[i++]); continue; }
      parts.push(src.slice(start, src[end - 1] === ';' ? end - 1 : end));
      const decl = parts.map((s) => s.trim()).filter(Boolean);
      if (decl.length < 2) { out.push(src.slice(i, end)); i = end; continue; }
      out.push(decl.map((d, n) => (n ? ind : '') + kw + ' ' + d + ';').join('\n'));
      i = end;
    }
    return out.join('');
  }
  // a string, template, comment or regex starting at i: where it ends (or -1 if it isn't one)
  const KW_BEFORE_RE = /(?:^|[^\w$])(return|typeof|case|do|else|in|of|yield|await|void|delete|throw|new)$/;
  function atomEnd(src, i, prev, before) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const k = src.indexOf('\n', i); return k < 0 ? src.length : k; }
    if (c === '/' && src[i + 1] === '*') { const k = src.indexOf('*/', i + 2); return k < 0 ? src.length : k + 2; }
    if (c === '"' || c === "'") { let k = i + 1; while (k < src.length && src[k] !== c && src[k] !== '\n') { if (src[k] === '\\') k++; k++; } return k + 1; }
    if (c === '`') { let k = i + 1; while (k < src.length && src[k] !== '`') { if (src[k] === '\\') k++; else if (src[k] === '$' && src[k + 1] === '{') { let d = 1; k += 2; while (k < src.length && d) { const e = /['"`]/.test(src[k]) ? atomEnd(src, k, '', '') : -1; if (e > 0) { k = e; continue; } if (src[k] === '{') d++; else if (src[k] === '}') d--; k++; } continue; } k++; } return k + 1; }
    if (c === '/' && (/[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || prev === '' || KW_BEFORE_RE.test(before))) {
      let k = i + 1, cls = false; while (k < src.length && src[k] !== '\n' && (cls || src[k] !== '/')) { if (src[k] === '\\') k++; else if (src[k] === '[') cls = true; else if (src[k] === ']') cls = false; k++; }
      if (src[k] !== '/') return -1; k++; while (/[a-z]/.test(src[k] || '')) k++; return k;
    }
    return -1;
  }
  // Blocks open onto their own lines and each statement gets one: `{ a(); b(); }` → three lines.
  // Objects and arrays stay as they were written (a piece like `{ color, shape: [[1,1],[1,1]] }` is one line).
  const NOT_BLOCK = /(?:^|[^\w$])(return|typeof|in|of|case|yield|await|new|delete|void|throw)$/;
  function breakLines(src) {
    let out = '', i = 0, prev = '', word = '';
    const stack = [];   // { c, block, empty }
    const nl = () => { out = out.replace(/[ \t]+$/, ''); if (out && !out.endsWith('\n')) out += '\n'; while (src[i] === ' ' || src[i] === '\t') i++; if (src[i] === '\n') i++; };
    const restEmpty = (j) => { while (src[j] === ' ' || src[j] === '\t') j++; return j >= src.length || src[j] === '\n' || src.startsWith('//', j); };
    while (i < src.length) {
      const c = src[i], e = atomEnd(src, i, prev, out.slice(-12));
      if (e > 0) { out += src.slice(i, e); if (!src.startsWith('//', i) && !src.startsWith('/*', i)) prev = src[e - 1] === '/' ? 'r' : '"'; i = e; continue; }
      if (/[\w$]/.test(c)) { let k = i; while (k < src.length && /[\w$]/.test(src[k])) k++; word = src.slice(i, k); out += word; prev = 'w'; i = k; continue; }
      i++;
      if (c === '{') {
        const block = prev === ')' || prev === '>' && out.trimEnd().endsWith('=>') || prev === '{' || prev === '}' || prev === ';' || prev === '' || prev === 'w' && !NOT_BLOCK.test(out);
        let j = i; while (/\s/.test(src[j] || '')) j++;
        const empty = src[j] === '}';
        stack.push({ c, block, empty }); out += c; prev = c;
        if (block && !empty) nl();
        continue;
      }
      if (c === '}') {
        const top = stack.pop() || {};
        if (top.block && !top.empty && !/^\s*$/.test(out.slice(out.lastIndexOf('\n') + 1))) nl();
        out += c; prev = c;
        if (top.block) { let j = i; while (src[j] === ' ' || src[j] === '\t') j++; const m = /^[\w$]+/.exec(src.slice(j, j + 20)); if (m && !/^(else|catch|finally|while)$/.test(m[0])) nl(); }
        continue;
      }
      if (c === '(' || c === '[') { stack.push({ c, block: false }); out += c; prev = c; continue; }
      if (c === ')' || c === ']') { stack.pop(); out += c; prev = c; continue; }
      if (c === ';') { out += c; prev = c; const top = stack[stack.length - 1]; if ((!top || top.block) && !restEmpty(i)) nl(); continue; }
      out += c; if (!/\s/.test(c)) prev = c;
    }
    return out;
  }
  // Indent by what's open: each line one step in from the line that opened its bracket.
  function reindent(src) {
    const lines = []; let i = 0, prev = '', line = '', ind = 0, lastCode = '';
    const stack = [];
    const lineStartInd = (rest) => { let n = stack.length ? stack[stack.length - 1].ind + 1 : 0; if (/^(?:\.[\w$]|\+(?!\+)|-(?!-)|\*|\/(?![/*])|\?|:|&&|\|\|)/.test(rest) || /(?:[=*?:]|[^+]\+|[^-]-|&&|\|\|)$/.test(lastCode)) n++; const m = /^[)\]}]+/.exec(rest); if (m) { const k = stack.length - m[0].length; n = k >= 0 && stack[k] ? stack[k].ind : 0; } return n; };
    let atLineStart = true;
    while (i <= src.length) {
      if (atLineStart) {
        let j = i; while (src[j] === ' ' || src[j] === '\t') j++;
        ind = lineStartInd(src.slice(j, j + 8)); line = src[j] === '\n' || j >= src.length ? '' : '  '.repeat(ind); i = j; atLineStart = false;
      }
      if (i >= src.length) { lines.push(line); break; }
      const c = src[i];
      if (c === '\n') { const t = line.replace(/[ \t]+$/, ''); lines.push(t); const code = t.replace(/\/\/.*$/, '').trim(); if (code) lastCode = code; i++; atLineStart = true; continue; }
      const e = atomEnd(src, i, prev, line.slice(-12));
      if (e > 0) { const a = src.slice(i, e), parts = a.split('\n'); line += parts[0]; for (let k = 1; k < parts.length; k++) { lines.push(line); line = parts[k]; } if (!a.startsWith('//') && !a.startsWith('/*')) prev = '"'; i = e; continue; }
      if (/[\w$]/.test(c)) { let k = i; while (k < src.length && /[\w$]/.test(src[k])) k++; line += src.slice(i, k); prev = 'w'; i = k; continue; }
      if ('([{'.includes(c)) stack.push({ ind });
      else if (')]}'.includes(c)) stack.pop();
      line += c; if (!/\s/.test(c)) prev = c; i++;
    }
    return lines.join('\n');
  }
  function js(src) {
    try {
      const out = reindent(splitDecls(breakLines(src))).replace(/\n{3,}/g, '\n\n');
      return out.endsWith('\n') ? out : out + '\n';
    } catch (e) { return src; }
  }
  function css(src) {
    const B = window.beautifier; if (!B) return src;
    try { return B.css(src, { ...OPT, newline_between_rules: false, selector_separator_newline: false }); } catch (e) { return src; }
  }
  // files in, files out: only what changes is a new string
  function structure(files) {
    const out = {};
    for (const [k, v] of Object.entries(files || {})) out[k] = typeof v !== 'string' ? v : /\.m?js$/i.test(k) ? js(v) : /\.css$/i.test(k) ? css(v) : v;
    return out;
  }
  const one = (name, src) => structure({ [name]: src })[name];
  window.R4Structure = { structure, one, splitDecls };
})();
