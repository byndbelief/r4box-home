/* A kid's world, grown from their diary (public.kid_topics / kid_events).
   A topic's source decides what it becomes: tutor = a tree, chat = a flower,
   trip = a constellation, game = animals. Its events decide how much it has grown:
   size from summed effort, branches and petals from the number of events, stars
   from each event, animals from games won. Parked topics stand bare, finished ones
   bear fruit, quiet ones fade. Nothing here is stored: the world is drawn fresh
   from the events every time, so it can be redrawn differently later.

   mountEcosystem(canvas, { topics, events }, { background, onPick }) -> { destroy } */
(function () {
  const QUIET_DAYS = 14;
  const PAL = { sky0: '#0B0918', sky1: '#1A1540', hill0: '#171331', hill1: '#1F1A3F', ground0: '#141130', ground1: '#0E0C22',
    leaf: ['#3DD6C6', '#5FE3B5', '#9BE37A', '#7FD8F0'], quietLeaf: '#4E4878', bark: '#5A4B7A', fruit: '#F5C542',
    petal: ['#B9A6FF', '#FF5A4A', '#F5C542', '#C9FFF8', '#FF8FCB'], star: '#F5F1FF', line: '#B9A6FF' };
  const SPECIES = {
    golf: { body: '#E8E4FF', ears: 'long', tail: 'puff', legs: 4 },          // rabbit
    duel: { body: '#FF8A4A', ears: 'point', tail: 'bush', legs: 4 },          // fox
    battleship: { body: '#3DD6C6', ears: 'none', tail: 'none', shell: true, legs: 4 },   // turtle
    cards: { body: '#B9A6FF', ears: 'tuft', tail: 'none', bird: true, legs: 2 },        // owl
    war: { body: '#A68A6A', ears: 'round', tail: 'none', legs: 4 },           // bear
    gauntlet: { body: '#D9A55A', ears: 'point', tail: 'puff', antlers: true, legs: 4 },  // deer
  };
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const today = () => new Date().toISOString().slice(0, 10);
  const daysSince = (d) => Math.round((Date.parse(today()) - Date.parse(d)) / 864e5);

  // Each topic's growth, from its events.
  function grow(topic, events) {
    const evs = events.filter((e) => e.topic === topic.id);
    const effort = evs.reduce((s, e) => s + (+e.effort || 1), 0);
    const last = evs.length ? evs[evs.length - 1].day : topic.created;
    let parked = topic.stage === 'parked';
    for (let i = evs.length - 1; i >= 0 && !parked; i--) { if (evs[i].kind === 'revive') break; if (evs[i].kind === 'park') parked = true; }
    const shipped = topic.stage === 'shipped' || evs.some((e) => e.kind === 'ship');
    const played = evs.reduce((s, e) => s + (+e.meta?.played || 0), 0), won = evs.reduce((s, e) => s + (+e.meta?.won || 0), 0);
    return { evs, effort, n: evs.length, parked, shipped, quiet: !parked && daysSince(last) > QUIET_DAYS, played, won };
  }

  function layout(data, W, H) {
    const horizon = H * 0.6, items = [], hits = [];
    const topics = (data.topics || []).slice().sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.slug.localeCompare(b.slug));
    const by = (src) => topics.filter((t) => t.source === src).map((t) => ({ t, g: grow(t, data.events || []) }));
    // Trees along the ground, spread evenly with a little jitter; a branched topic stands by its parent.
    const trees = by('tutor');
    trees.forEach((o, i) => {
      const r = rng(hash(o.t.slug));
      const x = W * (0.08 + 0.84 * ((i + 0.5) / Math.max(trees.length, 1))) + (r() - 0.5) * W * 0.04;
      // Bigger with effort, but never wider than its share of the ground.
      const scale = Math.min(1.25, 0.45 + Math.sqrt(o.g.effort) * 0.16, (W / Math.max(trees.length, 1)) / 150) * Math.min(1, H / 520);
      const y = horizon + H * (0.04 + r() * 0.08);
      const segs = [], leaves = [], fruit = [];
      const depth = Math.min(5, 2 + Math.floor(o.g.n / 2)), spread = 0.35 + r() * 0.25;
      (function branch(x0, y0, len, ang, d) {
        const x1 = x0 + Math.sin(ang) * len, y1 = y0 - Math.cos(ang) * len;
        segs.push({ x0, y0, x1, y1, w: Math.max(1, (depth - d + 1) * 2.2 * scale), d });
        if (d >= depth) { leaves.push({ x: x1, y: y1, r: (9 + r() * 7) * scale, c: PAL.leaf[Math.floor(r() * PAL.leaf.length)], d }); if (o.g.shipped && r() < 0.5) fruit.push({ x: x1 + (r() - .5) * 8, y: y1 + (r() - .5) * 8, d }); return; }
        const kids = d === 0 ? 2 + (o.g.n > 3 ? 1 : 0) : 2;
        for (let k = 0; k < kids; k++) branch(x1, y1, len * (0.68 + r() * 0.12), ang + (k - (kids - 1) / 2) * spread * 2 + (r() - .5) * 0.3, d + 1);
      })(x, y, 46 * scale, (r() - .5) * 0.12, 0);
      items.push({ type: 'tree', z: y, x, y, segs, leaves, fruit, g: o.g, seed: r() * 6.28 });
      hits.push({ x, y: y - 70 * scale, r: 55 * scale, topic: o.t });
    });
    // Constellations in the sky, one star per event.
    by('trip').forEach((o, i, all) => {
      const r = rng(hash(o.t.slug));
      const cx = W * (0.12 + 0.76 * ((i + 0.5) / all.length)) + (r() - .5) * W * 0.08, cy = horizon * (0.15 + r() * 0.5);
      const stars = []; let px = cx, py = cy;
      for (let k = 0; k < Math.max(1, o.g.n); k++) { stars.push({ x: px, y: py, s: 1.4 + Math.min(5, +o.g.evs[k]?.effort || 1) * 0.45, tw: r() * 6.28 }); px += (r() - .5) * 70; py += (r() - .5) * 40; }
      items.push({ type: 'stars', z: -1, stars, g: o.g });
      hits.push({ x: cx, y: cy, r: 40, topic: o.t });
    });
    // Flowers in the meadow at the front.
    by('chat').forEach((o, i, all) => {
      const r = rng(hash(o.t.slug));
      const x = W * (0.05 + 0.9 * ((i + r() * 0.8) / all.length)), y = H * (0.86 + r() * 0.1);
      const h = Math.min(H * 0.22, (24 + Math.sqrt(o.g.effort) * 16) * Math.min(1, H / 520));
      items.push({ type: 'flower', z: y, x, y, h, petals: Math.min(9, 4 + o.g.n), c: PAL.petal[hash(o.t.slug) % PAL.petal.length], g: o.g, seed: r() * 6.28 });
      hits.push({ x, y: y - h, r: 22, topic: o.t });
    });
    // Animals roaming between the trees and the meadow: more of them as the wins add up.
    by('game').forEach((o) => {
      const kind = o.t.slug.replace(/^game-/, ''), sp = SPECIES[kind]; if (!sp) return;
      const r = rng(hash(o.t.slug)), count = Math.max(1, Math.min(6, 1 + Math.floor(o.g.won / 2)));
      const size = Math.min(1.3, 0.7 + Math.sqrt(o.g.played) * 0.1) * Math.min(1, H / 520);
      for (let k = 0; k < count; k++) {
        const y = horizon + H * (0.14 + r() * 0.12);
        items.push({ type: 'animal', z: y, y, sp, size: size * (k ? 0.8 : 1), x0: r() * W, speed: (0.15 + r() * 0.25) * (r() < .5 ? -1 : 1), range: W * (0.15 + r() * 0.25), seed: r() * 6.28, topic: o.t, lead: k === 0 });
      }
    });
    items.sort((a, b) => a.z - b.z);
    // Far background stars, the same every time.
    const r = rng(7), dust = Array.from({ length: Math.round(W * H / 9000) }, () => ({ x: r() * W, y: r() * horizon * 0.95, s: r() * 1.1 + 0.2, tw: r() * 6.28 }));
    return { horizon, items, hits, dust };
  }

  function drawAnimal(ctx, a, x, t, alpha) {
    const s = 14 * a.size, sp = a.sp, dir = Math.sign(a.speed) || 1, step = Math.sin(t * 6 + a.seed);
    ctx.save(); ctx.translate(x, a.y); ctx.scale(dir, 1); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.ellipse(0, 2, s * 1.1, s * 0.25, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ctx.strokeStyle = sp.body; ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.lineCap = 'round';
    if (sp.bird) {   // a round owl that bobs
      const by = -s * 1.1 + step * 1.5;
      ctx.beginPath(); ctx.ellipse(0, by, s * 0.7, s * 0.9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#0B0918'; ctx.beginPath(); ctx.arc(-s * .25, by - s * .3, s * .14, 0, 7); ctx.arc(s * .25, by - s * .3, s * .14, 0, 7); ctx.fill();
      ctx.fillStyle = sp.body; ctx.beginPath(); ctx.moveTo(-s * .5, by - s * .75); ctx.lineTo(-s * .3, by - s * 1.15); ctx.lineTo(-s * .1, by - s * .8); ctx.moveTo(s * .5, by - s * .75); ctx.lineTo(s * .3, by - s * 1.15); ctx.lineTo(s * .1, by - s * .8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * .2, 0); ctx.lineTo(-s * .2, by + s * .8); ctx.moveTo(s * .2, 0); ctx.lineTo(s * .2, by + s * .8); ctx.stroke();
      ctx.restore(); return;
    }
    const bodyY = -s * (sp.shell ? 0.55 : 0.85);
    for (let i = 0; i < 4; i++) { const lx = (i < 2 ? -0.55 : 0.5) * s + (i % 2) * s * 0.15, sw = (i % 2 ? step : -step) * s * 0.25; ctx.beginPath(); ctx.moveTo(lx, bodyY + s * .2); ctx.lineTo(lx + sw, 0); ctx.stroke(); }
    if (sp.shell) { ctx.fillStyle = '#2A9C91'; ctx.beginPath(); ctx.ellipse(0, bodyY, s * 1.05, s * 0.6, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = sp.body; ctx.beginPath(); ctx.ellipse(0, bodyY, s * 0.9, s * 0.45, 0, Math.PI, 0); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, bodyY, s * 0.95, s * 0.5, 0, 0, 7); ctx.fill(); }
    if (sp.tail === 'puff') { ctx.beginPath(); ctx.arc(-s * 0.95, bodyY - s * .1, s * 0.22, 0, 7); ctx.fill(); }
    if (sp.tail === 'bush') { ctx.beginPath(); ctx.ellipse(-s * 1.2, bodyY - s * .25, s * 0.45, s * 0.2, -0.5, 0, 7); ctx.fill(); }
    const hx = s * 1.0, hy = bodyY - s * (sp.shell ? 0.05 : 0.45);
    ctx.beginPath(); ctx.arc(hx, hy, s * (sp.shell ? 0.28 : 0.38), 0, 7); ctx.fill();
    if (sp.ears === 'long') { ctx.beginPath(); ctx.ellipse(hx - s * .08, hy - s * .65, s * .1, s * .38, -0.15, 0, 7); ctx.ellipse(hx + s * .14, hy - s * .62, s * .1, s * .36, 0.2, 0, 7); ctx.fill(); }
    if (sp.ears === 'point') { ctx.beginPath(); ctx.moveTo(hx - s * .25, hy - s * .2); ctx.lineTo(hx - s * .12, hy - s * .62); ctx.lineTo(hx + s * .02, hy - s * .25); ctx.moveTo(hx + s * .05, hy - s * .25); ctx.lineTo(hx + s * .22, hy - s * .6); ctx.lineTo(hx + s * .32, hy - s * .15); ctx.fill(); }
    if (sp.ears === 'round') { ctx.beginPath(); ctx.arc(hx - s * .22, hy - s * .3, s * .14, 0, 7); ctx.arc(hx + s * .22, hy - s * .3, s * .14, 0, 7); ctx.fill(); }
    if (sp.antlers) { ctx.strokeStyle = '#F5C542'; ctx.lineWidth = Math.max(1, s * .08); ctx.beginPath(); ctx.moveTo(hx, hy - s * .3); ctx.lineTo(hx - s * .25, hy - s * .85); ctx.moveTo(hx - s * .12, hy - s * .6); ctx.lineTo(hx - s * .4, hy - s * .7); ctx.moveTo(hx + s * .05, hy - s * .3); ctx.lineTo(hx + s * .3, hy - s * .85); ctx.stroke(); }
    ctx.fillStyle = '#0B0918'; ctx.beginPath(); ctx.arc(hx + s * .15, hy - s * .05, Math.max(1, s * .06), 0, 7); ctx.fill();
    ctx.restore();
  }

  window.mountEcosystem = function (cv, data, opts = {}) {
    const ctx = cv.getContext('2d'), bg = !!opts.background;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, L = null, raf = 0, dead = false;
    function size() {
      const b = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(data, W, H);
    }
    function frame(ms) {
      if (dead) return;
      const t = ms / 1000, hz = L.horizon;
      const sky = ctx.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, PAL.sky0); sky.addColorStop(1, PAL.sky1);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
      for (const d of L.dust) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + d.tw); ctx.fillStyle = PAL.star; ctx.fillRect(d.x, d.y, d.s, d.s); }
      ctx.globalAlpha = 1;
      // two hills, then the ground
      [[PAL.hill0, 0.06, 0.0021, 1.7], [PAL.hill1, 0.03, 0.0034, 4.1]].forEach(([c, amp, f, ph]) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, hz - H * amp * (1 + Math.sin(x * f + ph)) * 0.8);
        ctx.lineTo(W, H); ctx.fill();
      });
      const gr = ctx.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, PAL.ground0); gr.addColorStop(1, PAL.ground1);
      ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
      for (const it of L.items) {
        const fade = it.g?.quiet ? 0.45 : 1;
        if (it.type === 'stars') {
          ctx.strokeStyle = PAL.line; ctx.globalAlpha = 0.25 * fade; ctx.lineWidth = 1; ctx.beginPath();
          it.stars.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.stroke();
          for (const s of it.stars) {
            const tw = 0.75 + 0.25 * Math.sin(t * 2 + s.tw);
            ctx.globalAlpha = fade * tw;
            const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s * 5);
            glow.addColorStop(0, 'rgba(255,240,200,.55)'); glow.addColorStop(1, 'rgba(255,240,200,0)');
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 5, 0, 7); ctx.fill();
            ctx.fillStyle = '#FFF6DA'; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, 7); ctx.fill();
            // a small cross of light on the bigger ones
            if (s.s > 2.5) { ctx.strokeStyle = '#FFF6DA'; ctx.lineWidth = 1; ctx.globalAlpha = fade * tw * 0.6; ctx.beginPath(); ctx.moveTo(s.x - s.s * 3, s.y); ctx.lineTo(s.x + s.s * 3, s.y); ctx.moveTo(s.x, s.y - s.s * 3); ctx.lineTo(s.x, s.y + s.s * 3); ctx.stroke(); }
          }
        } else if (it.type === 'tree') {
          const sway = (d) => Math.sin(t * 0.9 + it.seed) * d * 1.3;
          ctx.globalAlpha = fade; ctx.strokeStyle = PAL.bark; ctx.lineCap = 'round';
          for (const s of it.segs) { ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.x0 + sway(s.d), s.y0); ctx.lineTo(s.x1 + sway(s.d + 1), s.y1); ctx.stroke(); }
          if (!it.g.parked) for (const l of it.leaves) { ctx.fillStyle = it.g.quiet ? PAL.quietLeaf : l.c; ctx.globalAlpha = fade * 0.85; ctx.beginPath(); ctx.arc(l.x + sway(l.d + 1), l.y, l.r, 0, 7); ctx.fill(); }
          ctx.globalAlpha = fade; ctx.fillStyle = PAL.fruit;
          for (const f of it.fruit) { ctx.beginPath(); ctx.arc(f.x + sway(f.d + 1), f.y, 3.2, 0, 7); ctx.fill(); }
        } else if (it.type === 'flower') {
          const sw = Math.sin(t * 1.4 + it.seed) * 3, tx = it.x + sw, ty = it.y - it.h;
          ctx.globalAlpha = fade; ctx.strokeStyle = '#3E9C7A'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.quadraticCurveTo(it.x, it.y - it.h * .5, tx, ty); ctx.stroke();
          ctx.fillStyle = '#3E9C7A'; ctx.beginPath(); ctx.ellipse(it.x + 5, it.y - it.h * .35, 6, 2.5, -0.5, 0, 7); ctx.fill();
          ctx.fillStyle = it.g.parked ? PAL.quietLeaf : it.c;
          for (let k = 0; k < it.petals; k++) { const a = (k / it.petals) * 6.283 + it.seed; ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * 6, ty + Math.sin(a) * 6, 6, 3.2, a, 0, 7); ctx.fill(); }
          ctx.fillStyle = PAL.fruit; ctx.beginPath(); ctx.arc(tx, ty, 3.4, 0, 7); ctx.fill();
        } else if (it.type === 'animal') {
          const x = ((it.x0 + Math.sin(t * it.speed * 0.6 + it.seed) * it.range) % W + W) % W;
          it.cur = x;
          const dir = Math.cos(t * it.speed * 0.6 + it.seed) * it.speed;
          drawAnimal(ctx, { ...it, speed: dir || it.speed }, x, still ? 0 : t, fade);
        }
        ctx.globalAlpha = 1;
      }
      if (bg) { ctx.fillStyle = 'rgba(11,9,24,.35)'; ctx.fillRect(0, 0, W, H); }
      if (!still) raf = requestAnimationFrame(frame);
    }
    size(); raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => { size(); if (still) frame(0); }); ro.observe(cv);
    if (!bg && opts.onPick) cv.addEventListener('click', (e) => {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const animals = L.items.filter((i) => i.type === 'animal' && i.lead).map((i) => ({ x: i.cur ?? i.x0, y: i.y - 14, r: 26, topic: i.topic }));
      let best = null, bd = Infinity;
      for (const h of [...L.hits, ...animals]) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h; } }
      opts.onPick(best ? best.topic : null);
    });
    return { destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); } };
  };
})();
