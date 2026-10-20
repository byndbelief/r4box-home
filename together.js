/* The family clearing: every world's tree on one ground, joined by what they share.
   r4box addition, built on ecosystem.js's language (Flower-of-Life ground, star polygons,
   flow colours) and the Clearing tree (mountDiaryTree).
   - Each person's tree: their tutor topics (Dad's: his Clearing ideas). Dad in the middle.
   - Roots: under the ground, one thread per thing two or more people share (same slug).
     Games run teal, trips gold. A pulse travels each root, faster the more it was done together.
   - Shared trips: one star polygon in the sky, with threads down to each crown that was there.
   mountTogether(canvas, family, { onPick, solo }) -> { destroy }   (solo: just one world, drawn big)
   onPick gets { person } for a tree, { shared } for a root or star, or null. */
(function () {
  const TAU = Math.PI * 2, FLOW = ['#3DD6C6', '#C9FFF8', '#B9A6FF', '#F5C542', '#FF5A4A'];
  const PAL = { '--bark': '#3A335F', '--c-park': '#4A4470', '--c-growth': '#B9A6FF', '--c-turn': '#FF5A4A', '--c-close': '#3DD6C6', '--accent': '#F5C542', '--ground': '#000000' };
  const COL = { game: '#3DD6C6', trip: '#F5C542', chat: '#B9A6FF', tutor: '#B9A6FF' };

  function treeData(w) {
    const tut = w.topics.filter((t) => t.source === 'tutor'), ids = new Set(tut.map((t) => t.id));
    return { ideas: tut.map((t) => ({ id: t.id, created: t.created, stage: t.stage, parent: ids.has(t.parent) ? t.parent : null })),
      events: w.events.filter((e) => ids.has(e.topic)).map((e) => ({ id: 'e' + e.id, idea: e.topic, date: e.day, kind: e.kind, effort: e.effort }))
        .sort((p, q) => String(p.date).localeCompare(String(q.date)) || p.id.localeCompare(q.id)) };
  }
  function sharedOf(family) {
    const by = {};
    family.forEach((p, pi) => p.world.topics.forEach((t) => {
      if (t.source !== 'game' && t.source !== 'trip') return;
      const evs = p.world.events.filter((e) => e.topic === t.id);
      const played = evs.reduce((s, e) => s + (+(e.meta && e.meta.played) || 0), 0) || evs.length;
      (by[t.slug] = by[t.slug] || { slug: t.slug, title: t.title, source: t.source, who: [] }).who.push({ pi, played });
    }));
    return Object.values(by).filter((s) => s.who.length > 1);
  }

  window.mountTogether = function (cv, family, opts = {}) {
    const ctx = cv.getContext('2d'), host = cv.parentNode, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const order = [1, 0, 2].filter((i) => family[i]);   // kid, Dad, kid
    const shared = sharedOf(family);
    let W = 0, H = 0, L = null, raf = 0, dead = false;
    const trees = order.map((pi) => {
      const box = document.createElement('div'), tcv = document.createElement('canvas');
      box.style.cssText = 'position:absolute;pointer-events:none;'; tcv.style.display = 'block';
      box.appendChild(tcv); host.insertBefore(box, cv.nextSibling);
      return { pi, box, tcv, stop: null };
    });
    function size() {
      const b = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const groundY = H * 0.9,   // low: the trees fill the world down to its edge
             slots = trees.length === 3 ? [[0.2, 0.4, 0.5], [0.5, 0.46, 0.62], [0.8, 0.4, 0.5]] : trees.length === 2 ? [[0.3, 0.44, 0.56], [0.7, 0.44, 0.56]] : opts.solo ? [[0.5, 0.9, 0.74]] : [[0.5, 0.5, 0.6]];   // solo: one world, big
      const tr = trees.map((t, i) => { const [fx, fw, fh] = slots[i]; const w = W * fw, h = H * fh; return { ...t, x: W * fx - w / 2, y: groundY - h, w, h, base: { x: W * fx, y: groundY } }; });
      tr.forEach((t) => Object.assign(t.box.style, { left: cv.offsetLeft + t.x + 'px', top: cv.offsetTop + t.y + 'px', width: t.w + 'px', height: t.h + 'px' }));
      const baseOf = (pi) => tr.find((t) => t.pi === pi).base, crownOf = (pi) => { const t = tr.find((x) => x.pi === pi); return { x: t.base.x, y: t.y + t.h * 0.18 }; };
      // roots: each shared thing joins its people pairwise, deeper for each extra root
      const roots = [], stars = [], hits = [];
      let depth = 0;
      shared.forEach((s) => {
        if (s.source === 'trip') {
          const x = W * (0.5 + (stars.length % 2 ? 0.22 : -0.22) * Math.min(1, stars.length)), y = H * 0.24, r = Math.min(W, H) * 0.055;
          stars.push({ s, x, y, r, n: 5 + s.who.length * 2, threads: s.who.map((w) => crownOf(w.pi)) });
          hits.push({ x, y, r: r + 10, shared: s });
          return;
        }
        depth++;
        const ws = s.who.slice().sort((a, b) => order.indexOf(a.pi) - order.indexOf(b.pi));
        for (let i = 0; i < ws.length - 1; i++) {
          const a = baseOf(ws[i].pi), b = baseOf(ws[i + 1].pi), sag = 14 + depth * 13;
          const together = Math.min(ws[i].played, ws[i + 1].played);
          roots.push({ s, a, b, sag, speed: 0.12 + Math.min(0.35, together * 0.02), phase: (depth * 0.37) % 1, w: 1.2 + Math.min(2.4, together * 0.12) });
          hits.push({ x: (a.x + b.x) / 2, y: a.y + sag * 0.75, r: 16, shared: s });
        }
      });
      tr.forEach((t) => hits.push({ x: t.base.x, y: t.y + t.h * 0.5, r: Math.min(t.w, t.h) * 0.45, person: family[t.pi] }));
      const rr = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      L = { tr, roots, stars, hits, groundY, dust: Array.from({ length: Math.round(W * H / 6000) }, () => ({ x: rr() * W, y: rr() * groundY * 0.9, s: rr() * 1.1 + 0.2, tw: rr() * TAU })) };
    }
    function mountTrees() {
      L.tr.forEach((t, i) => { const tt = trees[i]; if (tt.stop) tt.stop(); tt.stop = window.mountDiaryTree(tt.tcv, treeData(family[t.pi].world), { palette: PAL, fill: true, flow: { colors: FLOW, wave: 110, speed: 0.45, tail: 2.6 } }); });
    }
    const qp = (r, u) => { const mx = (r.a.x + r.b.x) / 2, my = r.a.y + r.sag * 1.3, v = 1 - u; return [v * v * r.a.x + 2 * v * u * mx + u * u * r.b.x, v * v * r.a.y + 2 * v * u * my + u * u * r.b.y]; };
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#000000'); sky.addColorStop(0.78, '#06040E'); sky.addColorStop(1, '#000000');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      for (const d of L.dust) { ctx.globalAlpha = 0.18 + 0.2 * Math.sin(t * 1.3 + d.tw); ctx.fillStyle = '#F5F1FF'; ctx.fillRect(d.x, d.y, d.s, d.s); }
      // one ground for everyone: a Flower of Life laid flat, centred on Dad's root
      ctx.save(); ctx.translate(W / 2, L.groundY); ctx.scale(1, 0.24); ctx.lineWidth = 2.4;
      const cr = Math.min(W, H) * 0.09;
      for (let ring = 0; ring <= 4; ring++) for (let i = 0; i < Math.max(1, ring * 6); i++) {
        const a = (i / Math.max(1, ring * 6)) * TAU, d = ring * cr;
        ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.08 * (1 - ring / 5);
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, cr, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      // roots, with a pulse running each
      for (const r of L.roots) {
        const c = COL[r.s.source];
        ctx.strokeStyle = c; ctx.globalAlpha = 0.42; ctx.lineWidth = r.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(r.a.x, r.a.y); ctx.quadraticCurveTo((r.a.x + r.b.x) / 2, r.a.y + r.sag * 1.3, r.b.x, r.b.y); ctx.stroke();
        for (let k = 0; k < 2; k++) {
          const u = (t * r.speed + r.phase + k * 0.5) % 1, [x, y] = qp(r, u), uu = k ? 1 - u : u, [px, py] = qp(r, uu);
          const gr = ctx.createRadialGradient(px, py, 0, px, py, 9); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.85 * Math.sin(Math.PI * uu); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
        }
      }
      // shared trips: a star with threads to each crown that was there
      for (const s of L.stars) {
        for (const th of s.threads) { ctx.strokeStyle = '#F5C542'; ctx.globalAlpha = 0.12; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(th.x, th.y); ctx.stroke(); }
        ctx.setLineDash([]);
        const rot = t * 0.05 - Math.PI / 2, k = Math.floor((s.n - 1) / 2), p = (i) => [s.x + Math.cos(rot + (i * TAU) / s.n) * s.r, s.y + Math.sin(rot + (i * TAU) / s.n) * s.r];
        ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        for (let i = 0; i < s.n; i++) { const [x1, y1] = p(i), [x2, y2] = p(i + k); ctx.strokeStyle = FLOW[i % 4]; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // names under each tree
      ctx.font = '700 11px Sora, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ACA5D6';
      ctx.shadowColor = '#000000'; ctx.shadowBlur = 6;
      for (const tr of L.tr) { ctx.fillText(family[tr.pi].name, tr.base.x, L.groundY + 16); ctx.fillText(family[tr.pi].name, tr.base.x, L.groundY + 16); }
      ctx.shadowBlur = 0;
    }
    function loop(ms) { if (dead) return; draw(ms / 1000); if (!still) raf = requestAnimationFrame(loop); }
    size(); mountTrees(); raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { size(); mountTrees(); draw(performance.now() / 1000); }); ro.observe(cv);
    const click = (e) => {
      const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      let best = null, bd = Infinity;
      for (const h of L.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h; } }
      opts.onPick && opts.onPick(best ? (best.person ? { person: best.person } : { shared: best.shared }) : null);
    };
    cv.addEventListener('click', click);
    return { shared, destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('click', click); trees.forEach((t) => { if (t.stop) t.stop(); t.box.remove(); }); } };
  };
})();
