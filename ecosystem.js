/* A kid's world, grown from their diary (public.kid_topics / kid_events), in
   r4box's language: the beauty in chaos. Symmetry, fractals, sacred geometry.

   - Learning (tutor topics) is the Clearing tree itself (diary-tree.js): one
     trunk carrying time, a coiling limb per topic, buds per event.
   - Trips are star polygons {n/k} in the sky, inscribed in their circle: one
     point per event.
   - Chat curiosities are rose-curve mandalas round a Seed of Life: petals from
     events, size from effort.
   - Games are strange attractors (Clifford maps), one per game: denser with
     every game played, gold sparks for wins. Chaos, drawn as order.
   Placed in mirror symmetry about the tree, over a faint Flower-of-Life ground.
   Nothing here is stored: the world is drawn fresh from the events.

   mountEcosystem(canvas, { topics, events }, { background, onPick }) -> { destroy }
   onPick gets a topic, { group: 'tutor' } for the tree, or null. */
(function () {
  const QUIET_DAYS = 14;
  const FLOW = ['#3DD6C6', '#C9FFF8', '#B9A6FF', '#F5C542', '#FF5A4A'];
  const TREE_PALETTE = { '--bark': '#3A335F', '--c-park': '#4A4470', '--c-growth': '#B9A6FF', '--c-turn': '#FF5A4A', '--c-close': '#3DD6C6', '--accent': '#F5C542', '--ground': '#0B0918' };
  // Clifford attractors: x' = sin(a y) + c cos(a x), y' = sin(b x) + d cos(b y). One shape per game.
  const ATTRACTOR = {
    golf: [-1.4, 1.6, 1.0, 0.7], duel: [1.7, 1.7, 0.6, 1.2], battleship: [-1.7, 1.3, -0.1, -1.21],
    cards: [-1.8, -2.0, -0.5, -0.9], war: [1.5, -1.8, 1.6, 0.9], gauntlet: [-1.24, -1.25, -1.81, -1.91],
  };
  const TAU = Math.PI * 2;
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const today = () => new Date().toISOString().slice(0, 10);
  const daysSince = (d) => Math.round((Date.parse(today()) - Date.parse(d)) / 864e5);

  function grow(topic, events) {
    const evs = events.filter((e) => e.topic === topic.id);
    const effort = evs.reduce((s, e) => s + (+e.effort || 1), 0);
    const last = evs.length ? evs[evs.length - 1].day : topic.created;
    let parked = topic.stage === 'parked';
    for (let i = evs.length - 1; i >= 0 && !parked; i--) { if (evs[i].kind === 'revive') break; if (evs[i].kind === 'park') parked = true; }
    const played = evs.reduce((s, e) => s + (+e.meta?.played || 0), 0), won = evs.reduce((s, e) => s + (+e.meta?.won || 0), 0);
    return { evs, effort, n: evs.length, parked, quiet: !parked && daysSince(last) > QUIET_DAYS, played, won,
      shipped: topic.stage === 'shipped' || evs.some((e) => e.kind === 'ship') };
  }
  // Mirror slots: 0 sits on the axis's right, 1 on its left, 2 further right...
  const side = (i) => (i % 2 ? -1 : 1), rank = (i) => Math.floor(i / 2);

  // An attractor's orbit, drawn once into its own small canvas (additive dots).
  function attractorImage(kind, played, won, size) {
    const [a, b, c, d] = ATTRACTOR[kind];
    const n = Math.min(60000, 6000 + played * 2500);
    const pts = new Float32Array(n * 2);
    let x = 0.1, y = 0.1, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n + 100; i++) {
      const nx = Math.sin(a * y) + c * Math.cos(a * x), ny = Math.sin(b * x) + d * Math.cos(b * y);
      x = nx; y = ny;
      if (i >= 100) { const k = (i - 100) * 2; pts[k] = x; pts[k + 1] = y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'), span = Math.max(maxX - minX, maxY - minY) || 1, pad = size * 0.06, k = (size - pad * 2) / span;
    const ox = (size - (maxX - minX) * k) / 2 - minX * k, oy = (size - (maxY - minY) * k) / 2 - minY * k;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      g.fillStyle = FLOW[Math.floor((i / n) * 3)]; g.globalAlpha = 0.09;
      g.fillRect(pts[i * 2] * k + ox, pts[i * 2 + 1] * k + oy, 1, 1);
    }
    const sparks = [], r = rng(hash(kind));
    for (let s = 0; s < Math.min(24, won * 2); s++) { const i = Math.floor(r() * n); sparks.push({ x: pts[i * 2] * k + ox - size / 2, y: pts[i * 2 + 1] * k + oy - size / 2, tw: r() * TAU }); }
    return { cv, sparks };
  }

  function layout(data, W, H) {
    const topics = (data.topics || []).slice().sort((p, q) => String(p.created).localeCompare(String(q.created)) || p.slug.localeCompare(q.slug));
    const by = (src) => topics.filter((t) => t.source === src).map((t) => ({ t, g: grow(t, data.events || []) }));
    const cx = W / 2, narrow = W < 620, m = Math.min(W, H);
    const tree = { x: W * (narrow ? 0.04 : 0.2), y: H * 0.05, w: W * (narrow ? 0.92 : 0.6), h: H * 0.8 };
    const hits = [], sky = [], roses = [], swarms = [];
    by('trip').forEach((o, i) => {
      const r = Math.min(m * 0.075, 16 + Math.sqrt(o.g.effort) * 6);
      const x = cx + side(i) * W * (narrow ? 0.3 + rank(i) * 0.12 : 0.36 + rank(i) * 0.07), y = H * (0.12 + (rank(i) % 3) * 0.1);
      const n = Math.max(5, Math.min(12, o.g.n + 4));
      sky.push({ ...o, x, y, r, n, k: Math.floor((n - 1) / 2), spin: (hash(o.t.slug) % 2 ? 1 : -1) * 0.05 });
      hits.push({ x, y, r: r + 8, topic: o.t });
    });
    by('chat').forEach((o, i) => {
      const r = Math.min(m * 0.085, 18 + Math.sqrt(o.g.effort) * 7);
      const x = cx + side(i) * (W * 0.13 + rank(i) * Math.max(64, r * 2.5)), y = H * 0.88 - (rank(i) % 2) * r * 0.8;
      // Even petal counts keep the mandala symmetric: 6, 8, 10... as the topic grows.
      roses.push({ ...o, x, y, r, petals: Math.min(16, 4 + 2 * o.g.n), seed: (hash(o.t.slug) % 1000) / 1000 * TAU });
      hits.push({ x, y, r: r + 6, topic: o.t });
    });
    by('game').forEach((o, i) => {
      const kind = o.t.slug.replace(/^game-/, ''); if (!ATTRACTOR[kind]) return;
      const s = Math.round(Math.min(m * 0.3, 90 + Math.sqrt(o.g.played) * 14));
      const x = cx + side(i) * W * (narrow ? 0.34 : 0.4), y = H * (0.5 + rank(i) * 0.2);
      swarms.push({ ...o, kind, x, y, s, img: attractorImage(kind, o.g.played, o.g.won, s * 2), dir: side(i) });
      hits.push({ x, y, r: s * 0.45, topic: o.t });
    });
    const r = rng(7), dust = Array.from({ length: Math.round(W * H / 7000) }, () => ({ x: r() * W, y: r() * H * 0.7, s: r() * 1.1 + 0.2, tw: r() * TAU }));
    return { tree, hits, sky, roses, swarms, dust, root: { x: cx, y: tree.y + tree.h - 26 * Math.min(1, tree.h / 400) }, m };
  }

  // A star polygon {n/k} in its circle, with the inner circle it leaves.
  function drawStar(ctx, s, t, fade) {
    const rot = t * s.spin - Math.PI / 2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.22 * fade; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s.r * Math.cos(Math.PI * s.k / s.n), 0, TAU); ctx.stroke();
    const p = (i) => [Math.cos(rot + (i * TAU) / s.n) * s.r, Math.sin(rot + (i * TAU) / s.n) * s.r];
    ctx.lineWidth = 1.2;
    for (let i = 0; i < s.n; i++) {
      const [x1, y1] = p(i), [x2, y2] = p(i + s.k);
      ctx.strokeStyle = FLOW[i % 3]; ctx.globalAlpha = 0.55 * fade;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // a glowing point for each event; the newest brightest
    for (let i = 0; i < s.n; i++) {
      const lit = i < s.g.n, [x, y] = p(i), b = 0.7 + 0.3 * Math.sin(t * 2 + i * 1.7);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, lit ? 9 : 4);
      gr.addColorStop(0, lit ? '#FFF6DA' : '#B9A6FF'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (lit ? 0.9 : 0.3) * b * fade; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, lit ? 9 : 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // A rose-curve mandala, r = cos(k θ), over a Seed of Life.
  function drawRose(ctx, o, t, fade) {
    const breathe = 1 + 0.04 * Math.sin(t * 1.1 + o.seed), R = o.r * breathe;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.seed + t * 0.06); ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1; ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.25 * fade;
    for (let i = 0; i < 7; i++) {   // Seed of Life: one circle, six round it
      const a = (i * TAU) / 6, d = i === 6 ? 0 : R * 0.27;
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.27, 0, TAU); ctx.stroke();
    }
    // the outer circle, with a point for each petal
    ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.3 * fade; ctx.beginPath(); ctx.arc(0, 0, R * 1.08, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#C9FFF8';
    for (let i = 0; i < o.petals; i++) { const a = (i * TAU) / o.petals; ctx.globalAlpha = (0.5 + 0.4 * Math.sin(t * 1.6 + i)) * fade; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08, 1.4, 0, TAU); ctx.fill(); }
    const k = o.petals % 2 ? o.petals : o.petals / 2, turns = o.petals % 2 ? Math.PI : TAU;
    const dim = o.parked ? '#4A4470' : null;
    [[1, dim || '#3DD6C6', 0.7], [0.72, dim || '#B9A6FF', 0.55], [0.45, dim || '#F5C542', 0.65]].forEach(([s, col, al], layer) => {
      ctx.strokeStyle = col; ctx.globalAlpha = al * fade; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let j = 0; j <= 240; j++) {
        const th = (j / 240) * turns, rr = R * s * Math.cos(k * th);
        const x = rr * Math.cos(th + layer * Math.PI / o.petals), y = rr * Math.sin(th + layer * Math.PI / o.petals);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
    if (o.g.shipped) { ctx.fillStyle = '#F5C542'; ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  window.mountEcosystem = function (cv, data, opts = {}) {
    const ctx = cv.getContext('2d'), bg = !!opts.background, host = cv.parentNode;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, L = null, raf = 0, dead = false, treeStop = null;
    // The tree lives on its own canvas, in a box over this one, drawn by the Clearing tree code.
    const box = document.createElement('div'), tcv = document.createElement('canvas');
    box.style.cssText = 'position:absolute;pointer-events:none;'; tcv.style.cssText = 'display:block;';
    box.appendChild(tcv); host.insertBefore(box, cv.nextSibling);
    const tutor = (data.topics || []).filter((t) => t.source === 'tutor');
    function mountTree() {
      if (treeStop) treeStop(); treeStop = null;
      if (!tutor.length || !window.mountDiaryTree) return;
      const ids = new Set(tutor.map((t) => t.id));
      const ideas = tutor.map((t) => ({ id: t.id, created: t.created, stage: t.stage, parent: ids.has(t.parent) ? t.parent : null }));
      const events = (data.events || []).filter((e) => ids.has(e.topic))
        .map((e) => ({ id: 'e' + e.id, idea: e.topic, date: e.day, kind: e.kind, effort: e.effort }))
        .sort((p, q) => String(p.date).localeCompare(String(q.date)) || p.id.localeCompare(q.id));
      treeStop = window.mountDiaryTree(tcv, { ideas, events }, { palette: TREE_PALETTE, fill: true,
        flow: { colors: FLOW, wave: 120, speed: 0.45, tail: 2.6 } });
    }
    function size() {
      const b = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(data, W, H);
      const off = cv.offsetTop, offL = cv.offsetLeft;
      Object.assign(box.style, { left: offL + L.tree.x + 'px', top: off + L.tree.y + 'px', width: L.tree.w + 'px', height: L.tree.h + 'px' });
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0B0918'); sky.addColorStop(1, '#120F2A');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (const d of L.dust) { ctx.globalAlpha = 0.2 + 0.2 * Math.sin(t * 1.3 + d.tw); ctx.fillStyle = '#F5F1FF'; ctx.fillRect(d.x, d.y, d.s, d.s); }
      // The ground: a Flower of Life laid flat round the root, fading outward.
      ctx.save(); ctx.translate(L.root.x, L.root.y); ctx.scale(1, 0.28); ctx.lineWidth = 1 / 0.28 * 0.6;
      const cr = L.m * 0.07;
      for (let ring = 0; ring <= 3; ring++) for (let i = 0; i < Math.max(1, ring * 6); i++) {
        const a = (i / Math.max(1, ring * 6)) * TAU, d = ring * cr;
        ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.09 * (1 - ring / 4);
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, cr, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      if (!tutor.length) {   // no tree yet: a Seed of Life where it will grow
        ctx.save(); ctx.translate(L.root.x, L.root.y - L.m * 0.12); ctx.rotate(t * 0.05); ctx.strokeStyle = '#3DD6C6'; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) { const a = (i * TAU) / 6, d = i === 6 ? 0 : L.m * 0.035; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t + i); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, L.m * 0.035, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      for (const s of L.sky) drawStar(ctx, s, t, s.g.quiet ? 0.5 : 1);
      for (const o of L.swarms) {
        const fade = o.g.quiet ? 0.5 : 1, breathe = 1 + 0.03 * Math.sin(t * 0.8 + o.dir);
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.dir * t * 0.03); ctx.scale(breathe, breathe);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.95 * fade;
        ctx.drawImage(o.img.cv, -o.s / 2, -o.s / 2, o.s, o.s);
        for (const sp of o.img.sparks) {
          const x = sp.x / 2, y = sp.y / 2, b = 0.6 + 0.4 * Math.sin(t * 2.2 + sp.tw);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, 6); gr.addColorStop(0, '#F5C542'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = b * fade; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      for (const o of L.roses) drawRose(ctx, { ...o, parked: o.g.parked }, t, o.g.quiet ? 0.5 : 1);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (bg) { ctx.fillStyle = 'rgba(11,9,24,.3)'; ctx.fillRect(0, 0, W, H); }
    }
    function loop(ms) { if (dead) return; draw(ms / 1000); if (!still) raf = requestAnimationFrame(loop); }
    size(); mountTree(); raf = requestAnimationFrame(loop);
    // Resizing a canvas clears it: draw again at once rather than show a blank frame.
    const ro = new ResizeObserver(() => { size(); draw(performance.now() / 1000); }); ro.observe(cv);
    if (!bg && opts.onPick) cv.addEventListener('click', (e) => {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      let best = null, bd = Infinity;
      for (const h of L.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h; } }
      if (best) return opts.onPick(best.topic);
      const tr = L.tree;
      opts.onPick(tutor.length && x > tr.x && x < tr.x + tr.w && y > tr.y && y < tr.y + tr.h ? { group: 'tutor' } : null);
    });
    return { destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); if (treeStop) treeStop(); box.remove(); } };
  };
})();
