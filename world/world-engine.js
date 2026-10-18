/* The pannable world. One canvas, one camera: drag to pan, pinch or wheel to zoom, double-tap
   to dive in, tap anything to see what it really is. Names appear as you zoom in.
   mountWorld(canvas, { topics, events }, { seeds, onPick, onPlant }) ->
     { destroy, setPlant(on), setSeeds(seeds), zoomBy(f), reset(), focus(hit), select(ev) } */
(function () {
  const TAU = Math.PI * 2;
  const PAL = { '--bark': '#3A335F', '--c-park': '#4A4470', '--c-growth': '#B9A6FF', '--c-turn': '#FF5A4A', '--c-close': '#3DD6C6', '--accent': '#F5C542', '--ground': '#06050F' };
  const FLOW = ['#3DD6C6', '#C9FFF8', '#B9A6FF', '#F5C542', '#FF5A4A'];
  function treeData(tutor, events) {
    const ids = new Set(tutor.map((t) => t.id));
    return { ideas: tutor.map((t) => ({ id: t.id, created: t.created, stage: t.stage, parent: ids.has(t.parent) ? t.parent : null })),
      events: events.filter((e) => ids.has(e.topic)).map((e) => ({ id: 'e' + e.id, idea: e.topic, date: e.day, kind: e.kind, effort: e.effort }))
        .sort((p, q) => String(p.date).localeCompare(String(q.date)) || p.id.localeCompare(q.id)) };
  }
  window.mountWorld = function (cv, data, opts = {}) {
    const ctx = cv.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let VW = 1, VH = 1, L, tree = null, cam = { x: 0, y: 0, k: 1 }, kMin = 1, kMax = 6, kStart = 1, tween = null;
    let seeds = opts.seeds || [], plant = false, sel = null, raf = 0, dead = false;
    const evById = Object.fromEntries((data.events || []).map((e) => [String(e.id), e]));
    function build() {
      L = window.layoutWorld(data, seeds, VW, VH);
      if (tree) tree.destroy(); tree = null;
      if (L.tutor.length) tree = window.mountDiaryTree(null, treeData(L.tutor, data.events || []), { external: { w: L.tree.w, h: L.tree.h }, palette: PAL, fill: true, flow: { colors: FLOW, wave: 120, speed: 0.45, tail: 2.6 } });
      kMin = Math.min(VW / L.WW, VH / L.WH); kStart = Math.max(kMin, Math.min(VH / (L.WH * 0.85), VW / (L.WW * 0.78))); kMax = kStart * 7;
    }
    function size() {
      const b = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), first = !L;
      VW = Math.max(1, b.width); VH = Math.max(1, b.height); cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
      if (first) { build(); home(false); }
    }
    const home = (anim = true) => go({ x: L.WW / 2, y: L.gy - (VH * 0.4) / kStart, k: kStart }, anim);
    function clamp(c) {
      const k = Math.max(kMin, Math.min(kMax, c.k)), hw = VW / 2 / k, hh = VH / 2 / k;
      return { k, x: hw * 2 >= L.WW ? L.WW / 2 : Math.max(hw, Math.min(L.WW - hw, c.x)), y: hh * 2 >= L.WH ? L.WH / 2 : Math.max(hh, Math.min(L.WH - hh, c.y)) };
    }
    function go(c, anim) { const to = clamp(c); if (!anim || still) { cam = to; tween = null; } else tween = { from: { ...cam }, to, t0: performance.now(), dur: 520 }; }
    const toWorld = (sx, sy) => ({ x: cam.x + (sx - VW / 2) / cam.k, y: cam.y + (sy - VH / 2) / cam.k });
    function zoomAt(sx, sy, f, anim) { const w = toWorld(sx, sy), k = Math.max(kMin, Math.min(kMax, cam.k * f)); go({ k, x: w.x - (sx - VW / 2) / k, y: w.y - (sy - VH / 2) / k }, anim); }

    function hitTest(sx, sy) {
      const w = toWorld(sx, sy), pad = 10 / cam.k;
      for (const o of L.objs) for (const b of o.buds) if (Math.hypot(b.x - w.x, b.y - w.y) < b.r + pad) return b.seed ? { seed: b.seed, obj: o } : { event: b.ev, topic: o.topic, obj: o };
      if (tree) { let best = null, bd = 12 / cam.k; for (const n of tree.nodes()) { const d = Math.hypot(n.x + L.tree.x - w.x, n.y + L.tree.y - w.y); if (d < bd) { bd = d; best = n; } }
        if (best) { const ev = evById[best.id.slice(1)]; if (ev) return { event: ev, topic: L.tutor.find((t) => t.id === ev.topic), at: { x: best.x + L.tree.x, y: best.y + L.tree.y } }; } }
      for (const o of L.objs) if (Math.hypot(o.hit.x - w.x, o.hit.y - w.y) < o.hit.r) return o.seed ? { seed: o.seed, obj: o } : { topic: o.topic, obj: o };
      const tr = L.tree; if (tree && w.x > tr.x && w.x < tr.x + tr.w && w.y > tr.y && w.y < tr.y + tr.h) return { tree: true };
      return { ground: w.y > L.gy - 20 && w.y < L.gy + 60, w };
    }
    // ---- input ----
    const loc = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const pts = new Map(); let pinch = null, downAt = null, lastTap = 0, moved = 0;
    function onDown(e) { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: loc(e).x, y: loc(e).y }); tween = null;
      if (pts.size === 1) { downAt = { x: loc(e).x, y: loc(e).y, t: performance.now() }; moved = 0; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k, w: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) }; } }
    function onMove(e) { if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = loc(e).x - p.x, dy = loc(e).y - p.y; p.x = loc(e).x; p.y = loc(e).y;
      if (pts.size === 1 && !pinch) { moved += Math.abs(dx) + Math.abs(dy); cam = clamp({ k: cam.k, x: cam.x - dx / cam.k, y: cam.y - dy / cam.k }); }
      else if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], k = Math.max(kMin, Math.min(kMax, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; cam = clamp({ k, x: pinch.w.x - (mx - VW / 2) / k, y: pinch.w.y - (my - VH / 2) / k }); moved = 99; } }
    function onUp(e) { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size || !downAt) return;
      if (moved < 8 && performance.now() - downAt.t < 350) {
        const now = performance.now(), dbl = now - lastTap < 300; lastTap = now;
        if (dbl) { zoomAt(downAt.x, downAt.y, 2.2, true); return; }
        const h = hitTest(downAt.x, downAt.y);
        if (plant && h.ground) return opts.onPlant && opts.onPlant({ x: h.w.x, y: L.gy });
        sel = h.event || null; opts.onPick && opts.onPick(h);
      } downAt = null; }
    const onWheel = (e) => { e.preventDefault(); zoomAt(loc(e).x, loc(e).y, Math.exp(-e.deltaY * 0.0015), false); };
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('wheel', onWheel, { passive: false });

    // ---- render ----
    const qpt = (a, b, c, u) => { const v = 1 - u; return [v * v * a.x + 2 * v * u * c.x + u * u * b.x, v * v * a.y + 2 * v * u * c.y + u * u * b.y]; };
    function drawTies(t, under) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const tie of L.ties) {
        if (!!tie.under !== under) continue;
        const c = tie.under ? { x: (tie.a.x + tie.b.x) / 2, y: L.gy + 30 + Math.abs(tie.a.x - tie.b.x) * 0.12 } : { x: (tie.a.x + tie.b.x) / 2, y: Math.min(tie.a.y, tie.b.y) - 30 - Math.abs(tie.a.x - tie.b.x) * 0.08 };
        ctx.strokeStyle = tie.c; ctx.lineWidth = tie.w; ctx.globalAlpha = tie.dotted ? 0.28 + Math.min(0.3, tie.k * 0.08) : 0.36;
        if (tie.dotted) ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(tie.a.x, tie.a.y); ctx.quadraticCurveTo(c.x, c.y, tie.b.x, tie.b.y); ctx.stroke(); ctx.setLineDash([]);
        const u = tie.dotted ? 0.5 + 0.5 * Math.sin(t * 0.5 + tie.ph * TAU) : (t * 0.09 + tie.ph) % 1, [x, y] = qpt(tie.a, tie.b, c, u);
        window.WorldParts.glow(ctx, x, y, 6 + tie.w * 2, tie.c, 0.9 * Math.sin(Math.PI * Math.max(0.05, Math.min(0.95, u))));
      }
      ctx.restore();
    }
    function frame(now) {
      if (dead) return;
      const t = now / 1000, dpr = cv.width / VW;
      if (tween) { const p = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - p, 3); cam = { k: tween.from.k + (tween.to.k - tween.from.k) * e, x: tween.from.x + (tween.to.x - tween.from.x) * e, y: tween.from.y + (tween.to.y - tween.from.y) * e }; if (p >= 1) tween = null; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, VH); sky.addColorStop(0, '#06050F'); sky.addColorStop(1, '#100C25'); ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * (VW / 2 - cam.x * cam.k), dpr * (VH / 2 - cam.y * cam.k));
      // dust stars in the sky
      const r = window.WorldParts.rng(7); ctx.fillStyle = '#F5F1FF';
      for (let i = 0; i < 220; i++) { const x = r() * L.WW, y = r() * L.gy * 0.8, s = r() * 1.6 + 0.4, tw = r() * TAU; ctx.globalAlpha = 0.15 + 0.2 * Math.sin(t * 1.3 + tw); ctx.fillRect(x, y, s, s); }
      // the soil, then roots in it, then a Flower of Life on its surface
      ctx.globalAlpha = 1; const soil = ctx.createLinearGradient(0, L.gy, 0, L.WH); soil.addColorStop(0, '#120E28'); soil.addColorStop(1, '#06050F'); ctx.fillStyle = soil; ctx.fillRect(0, L.gy, L.WW, L.WH - L.gy);
      ctx.strokeStyle = '#3A335F'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, L.gy); ctx.lineTo(L.WW, L.gy); ctx.stroke();
      drawTies(t, true);
      ctx.save(); ctx.translate(L.root.x, L.gy); ctx.scale(1, 0.22); ctx.lineWidth = 3; const cr = L.tree.w * 0.16;
      for (let ring = 0; ring <= 4; ring++) for (let i = 0; i < Math.max(1, ring * 6); i++) { const a = (i / Math.max(1, ring * 6)) * TAU; ctx.strokeStyle = '#B9A6FF'; ctx.globalAlpha = 0.07 * (1 - ring / 5); ctx.beginPath(); ctx.arc(Math.cos(a) * ring * cr, Math.sin(a) * ring * cr, cr, 0, TAU); ctx.stroke(); }
      ctx.restore();
      if (plant) { ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 3); ctx.fillStyle = '#3DD6C6'; ctx.fillRect(0, L.gy - 4, L.WW, 8); }
      if (tree) { ctx.save(); ctx.translate(L.tree.x, L.tree.y); ctx.globalAlpha = 1; tree.paint(ctx, now); ctx.restore(); }
      for (const o of L.objs) window.WorldParts.draw(ctx, o, t, sel);
      drawTies(t, false);
      // names, in screen space, once you're close enough to read them
      const zoom = cam.k / kStart; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (zoom > 1.45) {
        ctx.font = '700 12px Sora, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, (zoom - 1.45) * 2.5);
        for (const o of L.objs) { const sx = (o.label.x - cam.x) * cam.k + VW / 2, sy = (o.label.y - cam.y) * cam.k + VH / 2; if (sx < -80 || sx > VW + 80 || sy < -20 || sy > VH + 20) continue;
          const txt = o.seed ? '🌱 ' + o.seed.title : o.topic.title, w = ctx.measureText(txt).width + 14;
          ctx.fillStyle = '#06050Fcc'; ctx.beginPath(); ctx.roundRect(sx - w / 2, sy - 16, w, 20, 10); ctx.fill(); ctx.fillStyle = '#F3F1FF'; ctx.fillText(txt, sx, sy - 2); }
      }
      if (!still || tween) raf = requestAnimationFrame(frame);
    }
    size(); raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => { size(); cam = clamp(cam); }); ro.observe(cv);
    return {
      destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); if (tree) tree.destroy(); ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((k) => cv.replaceWith(cv.cloneNode())); },
      setPlant(on) { plant = on; }, select(ev) { sel = ev; },
      setSeeds(s) { seeds = s; const c = cam; build(); cam = c; },
      zoomBy(f) { zoomAt(VW / 2, VH / 2, f, true); }, reset() { home(true); },
      focusTopic(id) { const o = L.objs.find((x) => x.topic && x.topic.id === id); if (o) return go({ x: o.hit.x, y: o.hit.y, k: Math.max(kStart * 2.2, Math.min(kMax, VW / (o.hit.r * 3.4))) }, true);
        if (L.tutor.some((t) => t.id === id)) go({ x: L.tree.x + L.tree.w / 2, y: L.tree.y + L.tree.h * 0.45, k: kStart * 1.5 }, true); },
      focus(h) { const p = h.at || (h.obj && h.obj.hit) || null; if (p) go({ x: p.x, y: p.y, k: Math.max(cam.k, kStart * 2.4) }, true); },
    };
  };
})();
