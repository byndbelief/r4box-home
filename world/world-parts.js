/* World objects grown like the Clearing tree: bark-coloured wood, glowing buds for events
   (colour = the event's family), the same flow pulses running out from the root.
   Chat curiosities are flowers, games are bushes, trips are star-trees in the sky, and
   seeds you plant are sprouts. All geometry is in world units; draw() runs inside the camera. */
(function () {
  const TAU = Math.PI * 2;
  const BARK = '#3A335F', BARE = '#4A4470', LEAF = '#3DD6C6', GOLD = '#F5C542';
  const FLOW = ['#3DD6C6', '#C9FFF8', '#B9A6FF', '#F5C542', '#FF5A4A'];
  const FAM = { spark: '#B9A6FF', deepen: '#B9A6FF', revive: '#B9A6FF', branch: '#FF5A4A', pivot: '#FF5A4A', merge: '#FF5A4A', ship: '#3DD6C6', park: '#4A4470' };
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // distance from the root on every segment, for the flow pulse
  function finish(o, rx, ry) {
    let maxD = 1;
    o.segs.forEach((s) => { s.d = Math.hypot((s.x1 + s.x2) / 2 - rx, (s.y1 + s.y2) / 2 - ry); maxD = Math.max(maxD, s.d); });
    o.maxD = maxD; return o;
  }

  // ✿ A flower: a stem with a bud per event and a rose-curve bloom at the top.
  function flower(topic, g, x, gy, s) {
    const r = rng(hash(topic.slug)), H = (70 + Math.sqrt(g.effort) * 24) * s, lean = (r() - 0.5) * 0.5 + (g.parked ? 0.6 : 0);
    const segs = [], buds = [], N = 9; let px = x, py = gy, a = -Math.PI / 2 + lean * 0.2;
    for (let i = 0; i < N; i++) {
      a += (r() - 0.5) * 0.16 + lean * 0.05; const len = H / N, nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
      segs.push({ x1: px, y1: py, x2: nx, y2: ny, w: (3.2 - i * 0.22) * s, c: g.parked ? BARE : BARK }); px = nx; py = ny;
    }
    g.evs.forEach((e, i) => {   // events climb the stem; each gets a leaf pair and a bud
      const seg = segs[Math.min(N - 2, 1 + Math.floor((i / Math.max(1, g.evs.length)) * (N - 2)))], side = i % 2 ? 1 : -1;
      const la = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) + side * 1.0, ll = (9 + (+e.effort || 1) * 3) * s;
      const lx = seg.x2 + Math.cos(la) * ll, ly = seg.y2 + Math.sin(la) * ll;
      segs.push({ x1: seg.x2, y1: seg.y2, x2: lx, y2: ly, w: 1.3 * s, c: BARK, leaf: true });
      buds.push({ x: lx, y: ly, r: (2.6 + (+e.effort || 1) * 0.5) * s, c: FAM[e.kind] || FAM.deepen, ev: e });
    });
    const bloom = { x: px, y: py, R: (12 + Math.sqrt(g.effort) * 5) * s * (g.parked ? 0.5 : 1), petals: Math.min(16, 4 + 2 * g.n), seed: r() * TAU, shut: g.parked, gold: g.shipped };
    return finish({ kind: 'flower', topic, g, segs, buds, bloom, label: { x: px, y: py - bloom.R - 8 * s }, hit: { x: (x + px) / 2, y: (gy + py) / 2, r: H * 0.55 + bloom.R } }, x, gy);
  }

  // 🌀 A bush: wood that forks deeper the more it was played, gold fruit for wins.
  function bush(topic, g, x, gy, s) {
    const r = rng(hash(topic.slug)), depth = 2 + Math.min(4, Math.floor(Math.log2((g.played || g.n) + 1))), segs = [], tips = [], joints = [];
    (function grow(px, py, a, len, w, d) {
      const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
      segs.push({ x1: px, y1: py, x2: nx, y2: ny, w, c: g.quiet ? BARE : BARK });
      if (d >= depth) { tips.push({ x: nx, y: ny }); return; }
      joints.push({ x: nx, y: ny });
      const k = 2 + (r() < 0.35 ? 1 : 0);
      for (let i = 0; i < k; i++) grow(nx, ny, a + (i - (k - 1) / 2) * (0.55 + r() * 0.25) + (r() - 0.5) * 0.2, len * (0.68 + r() * 0.12), Math.max(0.9, w * 0.7), d + 1);
    })(x, gy, -Math.PI / 2 + (r() - 0.5) * 0.2, (22 + Math.sqrt(g.played || g.n) * 4) * s, 4 * s, 0);
    const buds = [];
    g.evs.forEach((e, i) => { const j = joints[Math.floor((i / Math.max(1, g.evs.length)) * joints.length)] || joints[0]; if (j) buds.push({ x: j.x, y: j.y, r: (2.6 + (+e.effort || 1) * 0.45) * s, c: FAM[e.kind] || FAM.deepen, ev: e }); });
    const fruit = tips.filter((_, i) => i % Math.max(1, Math.floor(tips.length / Math.max(1, g.won))) === 0).slice(0, g.won).map((t) => ({ ...t, r: 3.6 * s }));
    const top = Math.min(...tips.map((t) => t.y)), xs = tips.map((t) => t.x);
    return finish({ kind: 'bush', topic, g, segs, buds, tips, fruit, label: { x, y: top - 10 * s }, hit: { x, y: (gy + top) / 2, r: Math.max((Math.max(...xs) - Math.min(...xs)) / 2, (gy - top) / 2) + 6 } }, x, gy);
  }

  // ✶ A star-tree: a trip hangs in the sky as a small tree of stars, one star per event.
  function starTree(topic, g, x, y, s) {
    const r = rng(hash(topic.slug)), segs = [], buds = [], n = g.evs.length;
    let nodes = [{ x, y, a: Math.PI / 2 }];
    g.evs.forEach((e, i) => {
      const p = nodes[Math.floor(r() * nodes.length)], a = p.a + (r() - 0.5) * 2.2, len = (26 + r() * 22) * s;
      const q = { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len * 0.7, a };
      segs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, w: 1.1 * s, c: '#5A5385' }); nodes.push(q);
      buds.push({ x: q.x, y: q.y, r: (2.8 + (+e.effort || 1) * 0.6) * s, c: e.kind === 'ship' ? GOLD : '#FFF6DA', ev: e, star: true });
    });
    const xs = nodes.map((p) => p.x), ys = nodes.map((p) => p.y);
    return finish({ kind: 'stars', topic, g, segs, buds, root: { x, y }, label: { x, y: Math.min(...ys) - 10 * s }, hit: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, r: Math.max(30 * s, (Math.max(...xs) - Math.min(...xs)) / 2 + 10, (Math.max(...ys) - Math.min(...ys)) / 2 + 10) } }, x, y);
  }

  // 🌱 A seed you planted: a sprout that waits for its first event.
  function sprout(seed, s) {
    const segs = [{ x1: seed.x, y1: seed.y, x2: seed.x, y2: seed.y - 22 * s, w: 2 * s, c: BARK },
      { x1: seed.x, y1: seed.y - 14 * s, x2: seed.x - 9 * s, y2: seed.y - 20 * s, w: 1.3 * s, c: BARK, leaf: true },
      { x1: seed.x, y1: seed.y - 16 * s, x2: seed.x + 9 * s, y2: seed.y - 23 * s, w: 1.3 * s, c: BARK, leaf: true }];
    const c = seed.kind === 'trip' ? GOLD : seed.kind === 'chat' ? '#B9A6FF' : LEAF;
    return finish({ kind: 'seed', seed, segs, buds: [{ x: seed.x, y: seed.y - 24 * s, r: 3.4 * s, c, seed }], label: { x: seed.x, y: seed.y - 34 * s }, hit: { x: seed.x, y: seed.y - 12 * s, r: 22 * s } }, seed.x, seed.y);
  }

  // ⚒ A project: a straight stem, a leaf pair per version, a glowing gem on top with the project's emoji.
  function project(pr, x, gy, s, col) {
    const n = Math.min(9, Math.max(3, pr.versions.length + 1)), H = (60 + n * 9) * s, segs = [], buds = [];
    let py = gy; for (let i = 0; i < n; i++) { const ny = py - H / n; segs.push({ x1: x, y1: py, x2: x + Math.sin(i * 1.3) * 1.5 * s, y2: ny, w: (3 - i * 0.2) * s, c: BARK }); py = ny; }
    pr.versions.forEach((v, i) => { const sg = segs[Math.min(n - 1, i + 1)], side = i % 2 ? 1 : -1, lx = sg.x2 + side * 12 * s, ly = sg.y2 - 4 * s;
      segs.push({ x1: sg.x2, y1: sg.y2, x2: lx, y2: ly, w: 1.3 * s, c: BARK, leaf: true }); buds.push({ x: lx, y: ly, r: 2.6 * s, c: col, ev: null }); });
    const topic = { id: 'proj:' + pr.id, slug: pr.id, title: pr.name, project: pr.id };
    return finish({ kind: 'project', topic, segs, buds, gem: { x, y: py - 12 * s, r: 11 * s, c: col, em: pr.em, draft: !pr.published }, label: { x, y: py - 30 * s }, hit: { x, y: (gy + py) / 2 - 6 * s, r: H * 0.55 + 14 * s } }, x, gy);
  }
  function drawGem(ctx, g, t) {
    const r = g.r * (1 + 0.05 * Math.sin(t * 1.6 + g.x));
    glow(ctx, g.x, g.y, r * 3, g.c, g.draft ? 0.35 : 0.8);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = g.draft ? 0.6 : 1;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - r); ctx.lineTo(g.x + r, g.y); ctx.lineTo(g.x, g.y + r); ctx.lineTo(g.x - r, g.y); ctx.closePath();
    ctx.fillStyle = '#08061A'; ctx.fill(); ctx.strokeStyle = g.c; ctx.lineWidth = 1.6; if (g.draft) ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = (r * 1.05) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.em, g.x, g.y + 1); ctx.textBaseline = 'alphabetic';
    ctx.globalCompositeOperation = 'lighter';
  }
  function glow(ctx, x, y, r, c, a) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function draw(ctx, o, t, sel) {
    const fade = o.g && o.g.quiet ? 0.6 : 1, sway = o.kind === 'stars' ? 0 : Math.sin(t * 0.8 + (o.maxD % 7)) * 0.012;
    ctx.save();
    if (sway) { const b = o.segs[0]; ctx.translate(b.x1, b.y1); ctx.rotate(sway); ctx.translate(-b.x1, -b.y1); }
    ctx.lineCap = 'round';
    for (const s of o.segs) { ctx.strokeStyle = s.c; ctx.globalAlpha = (o.kind === 'stars' ? 0.55 : 1) * fade; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
    // flow: waves of colour out from the root, calm at the base to hot at the tips
    ctx.globalCompositeOperation = 'lighter';
    for (const s of o.segs) {
      let ph = (t * 0.45 - s.d / 60) % 1; if (ph < 0) ph += 1; const b = Math.max(0, 1 - ph * 2.6); if (!b) continue;
      ctx.strokeStyle = FLOW[Math.min(4, Math.floor((s.d / o.maxD) * 4.99))]; ctx.globalAlpha = b * b * 0.8 * fade; ctx.lineWidth = Math.max(1.1, s.w * 0.75);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    if (o.tips) for (const p of o.tips) glow(ctx, p.x, p.y, 7, LEAF, 0.55 * fade);
    if (o.fruit) for (const p of o.fruit) { glow(ctx, p.x, p.y, p.r * 3.2, GOLD, 0.7); ctx.globalAlpha = 1; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    if (o.bloom) drawBloom(ctx, o.bloom, t, fade);
    if (o.gem) drawGem(ctx, o.gem, t);
    for (const b of o.buds) {
      const beat = 0.75 + 0.25 * Math.sin(t * (b.star ? 2.2 : 1.1) + b.x * 0.07);
      glow(ctx, b.x, b.y, b.r * (b.star ? 4.4 : 3.6), b.c, 0.8 * beat * fade);
      ctx.globalAlpha = fade; ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (sel && b.ev && sel === b.ev) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#F3F1FF'; ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; }
    }
    ctx.restore();
  }
  function drawBloom(ctx, b, t, fade) {
    const R = b.R * (1 + 0.04 * Math.sin(t * 1.1 + b.seed)), k = b.petals % 2 ? b.petals : b.petals / 2, turns = b.petals % 2 ? Math.PI : TAU;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.seed + t * 0.05);
    [[1, b.shut ? BARE : '#3DD6C6', 0.75], [0.7, b.shut ? BARE : '#B9A6FF', 0.6], [0.42, b.shut ? BARE : '#FF5A4A', 0.6]].forEach(([sc, col, al], layer) => {
      ctx.strokeStyle = col; ctx.globalAlpha = al * fade; ctx.lineWidth = 1.3; ctx.beginPath();
      for (let j = 0; j <= 180; j++) { const th = (j / 180) * turns, rr = R * sc * Math.cos(k * th), x = rr * Math.cos(th + layer * Math.PI / b.petals), y = rr * Math.sin(th + layer * Math.PI / b.petals); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    });
    glow(ctx, 0, 0, R * 0.5, b.gold ? GOLD : '#C9FFF8', 0.6 * fade);
    ctx.restore();
  }
  window.WorldParts = { project, flower, bush, starTree, sprout, draw, glow, hash, rng, FAM };
})();
