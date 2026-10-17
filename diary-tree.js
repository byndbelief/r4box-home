/* Clearing's idea tree, lifted verbatim from byndbelief/clearing site/index.html
   (buildTreeSegments, fitSegments, prepSpin, paintTree and helpers).
   Wrapped so it can run as a background: mountDiaryTree(canvas, data, opts). */
(function () {
  var QUIET_DAYS = 14;
  var SPIN = (Math.PI * 2) / 40000;
  function makeTree() {
  var PALETTE = {};
  var FLOW = null, FLAT = false, FILL = false, NODE = 1, SEG = 1;
  var state, treeState;
  function todayISO() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function dayNum(d) {
    var t = Date.parse(String(d) + "T00:00:00Z");
    return isNaN(t) ? null : Math.round(t / 86400000);
  }
  function daysBetween(a, b) {
    var x = dayNum(a), y = dayNum(b);
    return (x == null || y == null) ? 0 : y - x;
  }
  function isBackfilled(ev) { return ev && ev.backfilled === true; }

  /* ---------------- derived idea state ---------------- */
  function eventsFor(id) {
    return state.events.filter(function (e) { return e.idea === id; });
  }
  function eventsFor(id) {
    return state.events.filter(function (e) { return e.idea === id; });
  }
  function ideaState(idea) {
    var evs = eventsFor(idea.id);
    var last = evs.length ? evs[evs.length - 1].date : idea.created;
    var quiet = Math.max(0, daysBetween(last, todayISO()));
    var effort = evs.reduce(function (s, e) { return s + (Number(e.effort) || 0); }, 0);

    // parked = stage says so, or a park event with no later revive
    var parked = idea.stage === "parked";
    if (!parked) {
      for (var i = evs.length - 1; i >= 0; i--) {
        if (evs[i].kind === "revive") break;
        if (evs[i].kind === "park") { parked = true; break; }
      }
    }
    var shipped = idea.stage === "shipped";
    var kindState = parked ? "parked" : shipped ? "shipped" : (quiet > QUIET_DAYS ? "quiet" : "active");
    return {
      evs: evs, last: last, quiet: quiet, effort: effort,
      parked: parked, shipped: shipped, status: kindState,
      color: parked ? "var(--c-park)" : shipped ? "var(--c-close)"
        : (kindState === "quiet" ? "var(--bark)" : "var(--c-growth)")
    };
  }
  function hash32(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function rnd(seed, n) {                 // nth value in [0,1) for a seed
    var h = (hash32(seed) ^ (n * 2654435761)) >>> 0;
    h = (h ^ (h >>> 15)) * 2246822507; h = (h ^ (h >>> 13)) * 3266489909;
    return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
  }
  function spread(seed, n, amount) { return (rnd(seed, n) - 0.5) * 2 * amount; }
  // A branch may lean hard but never grow downward: keep every angle within
  // a limit of straight up, or limbs sag and the thing stops reading as a
  // tree. Limbs get 83 degrees -- tight enough to read, wide enough that the
  // canopy can actually reach sideways instead of growing a pole. Twigs pass
  // a looser limit, because real twigs droop and the chaos is the point.
  function clampUp(a, lim) {
    var up = -Math.PI / 2;
    if (lim == null) lim = 1.45;
    if (a < up - lim) return up - lim;
    if (a > up + lim) return up + lim;
    return a;
  }
  function clampUp(a, lim) {
    var up = -Math.PI / 2;
    if (lim == null) lim = 1.45;
    if (a < up - lim) return up - lim;
    if (a > up + lim) return up + lim;
    return a;
  }
  function ideaTree() {
    var kids = {}, roots = [];
    state.ideas.forEach(function (i) { kids[i.id] = []; });
    state.ideas.forEach(function (i) {
      if (i.parent && kids[i.parent]) kids[i.parent].push(i); else roots.push(i);
    });
    function byCreated(a, b) {
      return String(a.created).localeCompare(String(b.created)) || String(a.id).localeCompare(String(b.id));
    }
    roots.sort(byCreated);
    Object.keys(kids).forEach(function (k) { kids[k].sort(byCreated); });
    return { roots: roots, kids: kids };
  }
  function timeSpan() {
    var all = [];
    state.ideas.forEach(function (i) { if (dayNum(i.created) != null) all.push(i.created); });
    state.events.forEach(function (e) { if (dayNum(e.date) != null) all.push(e.date); });
    all.sort();
    var today = todayISO();
    var start = all[0] || today;
    var end = (all.length && all[all.length - 1] > today) ? all[all.length - 1] : today;
    return { start: start, end: end, days: Math.max(1, daysBetween(start, end)) };
  }
  function prepSpin(segs, w) {
    var t = ideaTree(), parent = {};
    Object.keys(t.kids).forEach(function (pid) {
      t.kids[pid].forEach(function (k) { parent[k.id] = pid; });
    });
    function rootOf(id) { var n = 0; while (parent[id] && n++ < 50) id = parent[id]; return id; }
    var trunk = segs.filter(function (g) { return g.kind === "trunk"; })[0];
    var cx = trunk ? trunk.x1 : 0, maxR = 1;
    segs.forEach(function (g) {
      g.ax1 = g.x1 - cx; g.ax2 = g.x2 - cx;
      g.phi = g.idea ? rnd(rootOf(g.idea), 21) * Math.PI : 0;
      maxR = Math.max(maxR, Math.abs(g.ax1), Math.abs(g.ax2));
    });
    // Turned, most limbs are seen at a slant and the crown looks thinner than
    // the flat tree did; spread it a little wider, never past the frame.
    var room = Math.min(cx, w - cx) - 20;
    var widen = Math.max(1, Math.min(1.35, room / maxR));
    segs.forEach(function (g) { g.ax1 *= widen; g.ax2 *= widen; });
    treeState.cx = cx; treeState.maxR = maxR * widen;
  }
  function projectSpin(segs) {
    var th = treeState.theta, cx = treeState.cx;
    segs.forEach(function (g) {
      if (g.ax1 === undefined) return;
      var c = FLAT ? 1 : Math.cos(g.phi + th), sn = FLAT ? 0 : Math.sin(g.phi + th);
      g.x1 = cx + g.ax1 * c; g.x2 = cx + g.ax2 * c;
      g.z = ((g.ax1 + g.ax2) / 2) * sn;
    });
  }
  function depthOf(g) {   // 1 in front, 0.5 at the back
    return 0.5 + 0.5 * (((g.z || 0) / treeState.maxR) + 1) / 2;
  }
  function cssVar(name) {
    if (PALETTE[name]) return PALETTE[name];
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
  }
  function buildTreeSegments(w, h) {
    var span = timeSpan(), t = ideaTree();
    // The trunk carries time, but it does not get the whole frame. Given the
    // full height it dominates, and because the fit is isotropic the whole
    // picture ends up height-locked -- a pole in an empty field. Just over
    // half leaves the rest of the frame for the canopy to spread into.
    var baseY = h - 26, topY = 46, trunkH = (baseY - topY) * 0.52, cx = w / 2;
    var segs = [];
    function yFor(date) {
      var d = Math.max(0, Math.min(span.days, daysBetween(span.start, date)));
      return baseY - (d / span.days) * trunkH;
    }
    // Trunk tapers as it rises. The bare stretch above the newest limb is real
    // -- nothing has started up there -- so it is drawn, but thin enough not to
    // dominate the picture.
    // The trunk stops a little above the newest limb rather than running on to
    // the top of the frame: the stretch past the last idea is real but empty,
    // and drawn full height it reads as a spike poking out of the canopy.
    var newest = 0, ri;
    for (ri = 0; ri < t.roots.length; ri++) {
      newest = Math.max(newest, baseY - yFor(t.roots[ri].created));
    }
    var tipH = Math.min(trunkH, newest);
    var TSEG = 14, ti;
    for (ti = 0; ti < TSEG; ti++) {
      var ya = baseY - (tipH * ti) / TSEG, yb = baseY - (tipH * (ti + 1)) / TSEG;
      segs.push({ x1: cx, y1: ya, x2: cx, y2: yb,
                  w: 12.5 * Math.pow(1 - ti / TSEG, 1.15) + 1, kind: "trunk", order: -1 });
    }

    var orderCounter = 0;

    // Twigs recurse. One straight stub per unit of effort reads as stubble;
    // the same budget spent on a forking twig reads as foliage, and the
    // silhouette picks up the self-similarity that makes a tree a tree.
    // Effort still decides how much there is, so the ornament stays the data.
    function twig(ox, oy, a, len, wd, gen, maxGen, ev, st, idea) {
      var nx = ox + Math.cos(a) * len, ny = oy + Math.sin(a) * len;
      var terminal = gen >= maxGen || len < 4;
      segs.push({
        x1: ox, y1: oy, x2: nx, y2: ny, w: Math.max(0.5, wd),
        idea: idea.id, event: ev.id, twig: true, tip: terminal, gen: gen,
        kind: ev.kind, effort: Number(ev.effort) || 1,
        quiet: st.quiet, parked: st.parked, order: orderCounter++
      });
      if (terminal) return;
      var j;
      for (j = 0; j < 2; j++) {
        var ja = a + (j ? 1 : -1) * (0.34 + gen * 0.1) + spread(ev.id, gen * 7 + j, 0.42);
        twig(nx, ny, clampUp(ja, 1.95), len * 0.62, wd * 0.74, gen + 1, maxGen, ev, st, idea);
      }
    }

    function limb(idea, ox, oy, angle, thick, depth, lim) {
      var st = ideaState(idea);
      var evs = st.evs;
      var px = ox, py = oy, a = angle, seed = idea.id;
      var base = angle;   // the limb's own direction, to pull back toward
      var curl = rnd(idea.id, 13) < 0.5 ? -1 : 1;   // which way this one coils
      var prev = idea.created;
      var kids = t.kids[idea.id] || [];
      var kidByDate = {};
      kids.forEach(function (k) { (kidByDate[k.created] = kidByDate[k.created] || []).push(k); });

      // reach away from the trunk before the first event, so limbs separate
      var lead = 30 + depth * 5;
      var lx = px + Math.cos(a) * lead, ly = py + Math.sin(a) * lead;
      segs.push({ x1: px, y1: py, x2: lx, y2: ly, w: thick, idea: idea.id, order: orderCounter++ });
      px = lx; py = ly;

      evs.forEach(function (ev, n) {
        var gap = Math.max(0, daysBetween(prev, ev.date));
        // Segment length lives in a narrow band on purpose. Let it range freely
        // and the tree reads by accident: a two-event idea after a long
        // silence draws the widest limb on the canvas, while a thirty-event
        // idea decays to segments shorter than the dots drawn on them and
        // piles into a caterpillar. Clamped, visual weight tracks substance.
        var decay = 0.34 + 0.66 * Math.pow(0.87, n);
        var raw = 17 + Math.min(34, gap * 1.4) + (Number(ev.effort) || 1) * 4.2;
        var len = Math.max(13, Math.min(56, raw * decay));
        a += spread(seed, n, 0.46) + (depth ? 0 : spread(seed, n + 97, 0.1));
        if (ev.kind === "pivot") a += spread(ev.id, 3, 0.9);
        // A long-running idea should coil, not march. Each step turns a little
        // further than the last, always the same way, so the limb traces a
        // spiral that tightens as it goes: wide and open at the start, a dense
        // rosette thirty events in. Zig-zagging instead only made a rope.
        a += curl * Math.min(0.5, 0.1 + n * 0.035);
        // Each segment wanders, then gets pulled back toward a heading -- its
        // own at first, bending toward straight up the longer the limb gets.
        // Pulling toward the original heading forever draws a long straight
        // spoke; bending upward makes a long idea arc back into the canopy.
        var target = base + (-Math.PI / 2 - base) * Math.min(0.85, n * 0.07);
        a += (target - a) * (0.18 + Math.min(0.3, n * 0.02));
        // The ceiling lifts as the limb thins out, and past a dozen events it
        // lets go entirely. A heavy limb near the trunk must not sag; a fine
        // shoot far out may coil however it likes. Held to a ceiling the
        // spiral cannot close -- it just slides along the limit and draws a
        // lasso across the frame.
        a = clampUp(a, lim + Math.min(2.4, n * 0.16));
        var sl = len * SEG;
        var nx = px + Math.cos(a) * sl, ny = py + Math.sin(a) * sl;
        thick = Math.max(1.1, thick * 0.9);
        segs.push({
          x1: px, y1: py, x2: nx, y2: ny, w: thick,
          idea: idea.id, event: ev.id, kind: ev.kind,
          effort: Number(ev.effort) || 1, backfilled: isBackfilled(ev),
          quiet: st.quiet, parked: st.parked, order: orderCounter++
        });
        // bushiness is effort: how many twigs leave the node, and how many
        // times each one forks before it ends in a leaf
        var eff = Math.min(5, Number(ev.effort) || 1);
        var nroot = Math.max(2, Math.min(4, eff));
        var maxGen = eff >= 4 ? 3 : eff >= 2 ? 2 : 1;
        var k;
        for (k = 0; k < nroot; k++) {
          var ta = a + spread(ev.id, k, 1.2);
          var tl = len * (0.30 + rnd(ev.id, k + 11) * 0.30);
          twig(nx, ny, clampUp(ta, 1.95), tl, Math.max(0.6, thick * 0.46), 1, maxGen, ev, st, idea);
        }
        if (ev.kind === "branch" || ev.kind === "merge") a -= spread(ev.id, 7, 0.5);
        px = nx; py = ny;
        prev = ev.date;
        (kidByDate[ev.date] || []).forEach(function (kid, m) {
          limb(kid, px, py, a + (m % 2 ? 0.75 : -0.75) + spread(kid.id, 1, 0.3),
               Math.max(1.6, thick * 0.78), depth + 1, lim);
          delete kidByDate[ev.date];
        });
      });

      Object.keys(kidByDate).forEach(function (d) {
        kidByDate[d].forEach(function (kid, m) {
          limb(kid, px, py, a + (m % 2 ? 0.8 : -0.8), Math.max(1.6, thick * 0.75), depth + 1, lim);
        });
      });
    }

    // Which way a limb leans must not track the calendar. Fanning i/(n-1)
    // across a date-sorted list bakes in "old leans left, new leans right",
    // and the whole tree sweeps one way. So: side comes from the idea's own
    // hash, balanced so neither side runs away; how far it leans comes from
    // where it meets the trunk, because a tree spreads low and reaches high.
    var balance = 0;
    t.roots.forEach(function (idea) {
      var y = yFor(idea.created);
      var up = (baseY - y) / Math.max(1, trunkH);   // 0 at the ground, 1 at the top
      var side = rnd(idea.id, 5) < 0.5 ? -1 : 1;
      if (balance >= 1) side = -1; else if (balance <= -1) side = 1;
      balance += side;
      var mag = 0.56 + (1 - up) * 0.74 + spread(idea.id, 2, 0.16);
      // A limb low on the trunk reaches out, but it must not then wander down
      // past the root it grew from -- so the lower it starts, the tighter the
      // ceiling on how far its own events may swing it.
      var lim = 1.04 + up * 0.41;
      limb(idea, cx, y, clampUp(-Math.PI / 2 + side * mag, lim), 7.5, 0, lim);
    });
    return fitSegments(segs, w, h);
  }
  function fitSegments(segs, w, h) {
    var pad = 26, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    segs.forEach(function (g) {
      minX = Math.min(minX, g.x1, g.x2); maxX = Math.max(maxX, g.x1, g.x2);
      minY = Math.min(minY, g.y1, g.y2); maxY = Math.max(maxY, g.y1, g.y2);
    });
    var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    var k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    k = Math.max(0.35, Math.min(k, 2.6));
    // A canopy narrower than the frame strands the tree in a column of white.
    // Stretch it sideways to fill, but gently -- past about a third the limbs
    // start to look sheared rather than grown. Height is never stretched, so
    // the trunk keeps its scale and the dates stay where they are.
    var kx = k;
    if (bw * k < (w - pad * 2) * 0.88) kx = Math.min(k * 1.45, (w - pad * 2) / bw);
    var ky = FILL ? Math.max(k, Math.min((h - pad * 2) / bh, k * 2.2)) : k;
    var ox = (w - bw * kx) / 2 - minX * kx, oy = (h - pad) - maxY * ky;
    if (FILL) {   // r4box addition: keep the trunk on the centre line, canopy fitted to the wider side
      var tr = segs.filter(function (g) { return g.kind === "trunk"; })[0];
      if (tr) {
        var half = Math.max(1, tr.x1 - minX, maxX - tr.x1);
        kx = Math.min(k * 1.45, (w / 2 - pad) / half);
        ox = w / 2 - tr.x1 * kx;
      }
    }
    segs.forEach(function (g) {
      g.x1 = g.x1 * kx + ox; g.y1 = g.y1 * ky + oy;
      g.x2 = g.x2 * kx + ox; g.y2 = g.y2 * ky + oy;
      g.w = Math.max(0.5, g.w * Math.min(1.5, k));
      g.k = k;
    });
    return segs;
  }
  function paintTree(cv, upto) {
    var ctx = cv.getContext("2d"), w = cv._w, h = cv._h;
    var segs = treeState.segs;
    if (upto == null) upto = segs.length;
    var bark = cssVar("--bark"), park = cssVar("--c-park");
    var cGrow = cssVar("--c-growth"), cTurn = cssVar("--c-turn"),
        cClose = cssVar("--c-close"), cAcc = cssVar("--accent"), ground = cssVar("--ground");
    ctx.clearRect(0, 0, w, h);
    projectSpin(segs);
    // Far side first, so the near side is drawn over it.
    var drawn = segs.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); });

    ctx.lineCap = "round";
    drawn.forEach(function (sg, i) {
      if (sg.order >= upto) return;
      var sel = state.sel && sg.idea === state.sel;
      var dim = state.sel && sg.idea && !sel ? 0.22 : 1;
      var life = sg.parked ? 0.4 : sg.quiet > 60 ? 0.45 : sg.quiet > QUIET_DAYS ? 0.65 : 1;
      ctx.globalAlpha = (sg.kind === "trunk" ? 0.75 : 0.9) * life * dim;
      ctx.strokeStyle = sg.parked ? park : bark;
      ctx.lineWidth = sg.w;
      ctx.globalAlpha *= depthOf(sg);
      if (treeState.hover && treeState.hover === sg.idea) { ctx.strokeStyle = cAcc; ctx.globalAlpha = 0.95; }
      ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    });

    // r4box addition: colour pulses flowing out from the root, calm at the trunk to hot at the tips
    if (FLOW) {
      var tnow = performance.now() / 1000, cols = FLOW.colors;
      ctx.globalCompositeOperation = "lighter";
      drawn.forEach(function (sg) {
        if (sg.order >= upto || sg.d == null) return;
        var ph = (tnow * FLOW.speed - sg.d / FLOW.wave) % 1; if (ph < 0) ph += 1;
        var b = Math.max(0, 1 - ph * FLOW.tail); if (b <= 0) return;
        var f = Math.min(0.999, sg.d / FLOW.maxD) * (cols.length - 1), ci = Math.floor(f);
        ctx.strokeStyle = cols[ci];
        ctx.globalAlpha = b * b * 0.9 * depthOf(sg) * (sg.parked ? 0.35 : 1);
        ctx.lineWidth = Math.max(1.2, sg.w * 0.75);
        ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
      });
      ctx.globalCompositeOperation = "source-over";
    }

    // foliage last, so it sits on the wood
    drawn.forEach(function (sg) {
      if (sg.order >= upto || !sg.event || sg.kind === "trunk") return;
      var sel = state.sel && sg.idea === state.sel;
      var dim = state.sel && !sel ? 0.2 : 1;
      var life = sg.parked ? 0 : sg.quiet > 60 ? 0.18 : sg.quiet > QUIET_DAYS ? 0.5 : 1;
      var col = null, r = 0;
      if (sg.twig) {
        // only the tip of a forking twig carries a leaf -- a dot at every
        // fork turns the canopy into soup
        if (life <= 0 || !sg.tip) return;
        col = cClose;
        r = (1.7 + (sg.effort || 1) * 0.18) * Math.min(1.5, sg.k || 1);
        ctx.globalAlpha = 0.46 * life * dim;
      } else if (sg.kind === "ship") { col = cAcc; r = 4.6 * Math.min(1.5, sg.k || 1); ctx.globalAlpha = 0.95 * dim; }
      else if (sg.kind === "branch" || sg.kind === "pivot" || sg.kind === "merge") {
        col = cTurn; r = 3.6 * Math.min(1.5, sg.k || 1); ctx.globalAlpha = 0.9 * dim;
      } else if (sg.kind === "spark" || sg.kind === "revive") { col = cGrow; r = 3.4 * Math.min(1.5, sg.k || 1); ctx.globalAlpha = 0.9 * dim; }
      else if (sg.kind === "park") { col = park; r = 3 * Math.min(1.5, sg.k || 1); ctx.globalAlpha = 0.8 * dim; }
      else { col = cClose; r = (2.6 + (sg.effort || 1) * 0.25) * Math.min(1.5, sg.k || 1); ctx.globalAlpha = (0.35 + 0.5 * life) * dim; }
      if (!col) return;
      if (!sg.twig) r *= NODE;
      ctx.globalAlpha *= depthOf(sg);
      // r4box addition: buds, blossoms and fruit glow, each breathing on its own beat
      if (FLOW) {
        var a0 = ctx.globalAlpha, beat = 0.75 + 0.25 * Math.sin(performance.now() / 900 + rnd(sg.event || "x", 31) * 6.283);
        ctx.globalCompositeOperation = "lighter";
        var halo = sg.twig ? r * 3.2 : r * 4.4;
        var gr = ctx.createRadialGradient(sg.x2, sg.y2, 0, sg.x2, sg.y2, halo);
        gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr; ctx.globalAlpha = Math.min(1, a0 * (sg.twig ? 0.55 : 0.85) * beat);
        ctx.beginPath(); ctx.arc(sg.x2, sg.y2, halo, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = Math.min(1, a0 * (sg.twig ? 1.6 : 1.1));
      }
      ctx.beginPath(); ctx.arc(sg.x2, sg.y2, r, 0, Math.PI * 2);
      if (sg.backfilled) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      } else {
        ctx.fillStyle = col; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = ground; ctx.globalAlpha *= 0.7; ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }
  return function (cv, data, opts) {
    opts = opts || {};
    PALETTE = opts.palette || {};
    FLOW = opts.flow || null;
    FLAT = opts.spin === false;
    FILL = !!opts.fill; NODE = opts.nodeScale || 1; SEG = opts.segScale || 1;
    state = { ideas: data.ideas, events: data.events, sel: null, view: "tree" };
    treeState = { raf: 0, segs: [], hover: null, t: 1, theta: 0, cx: 0, maxR: 1, drag: null, held: false };
    var alive = true;
    function size() {
      var r = cv.parentNode.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var w = Math.max(200, r.width), h = Math.max(200, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + "px"; cv.style.height = h + "px";
      cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      cv._w = w; cv._h = h;
      treeState.segs = buildTreeSegments(w, h);
      if (FLOW) {
        var base = null, maxD = 1;
        treeState.segs.forEach(function (g) { if (g.kind === "trunk" && (!base || g.y1 > base.y1)) base = g; });
        treeState.segs.forEach(function (g) {
          g.d = Math.hypot((g.x1 + g.x2) / 2 - base.x1, (g.y1 + g.y2) / 2 - base.y1);
          maxD = Math.max(maxD, g.d);
        });
        FLOW.maxD = maxD;
      }
      prepSpin(treeState.segs, w);
    }
    function layout() {
      if (!opts.onLayout) return;
      projectSpin(treeState.segs);
      opts.onLayout(treeState.segs.filter(function (g) { return g.event && (!g.twig || (opts.withTips && g.tip)); })
        .map(function (g) { return { id: g.event, kind: g.kind, tip: !!g.twig, x: g.x2, y: g.y2 }; }), cv._w, cv._h);
    }
    size(); layout();
    var total = treeState.segs.length, reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = performance.now(), last = t0, DUR = 2200;
    function frame(now) {
      if (!alive) return;
      var p = Math.min(1, (now - t0) / DUR);
      treeState.t = p < 1 ? 1 - Math.pow(1 - p, 3) : 1;
      if (opts.spin !== false) treeState.theta += (now - last) * SPIN; last = now;
      paintTree(cv, Math.round(treeState.t * treeState.segs.length));
      treeState.raf = requestAnimationFrame(frame);
    }
    if (reduce) paintTree(cv, total); else treeState.raf = requestAnimationFrame(frame);
    var ro = new ResizeObserver(function () { size(); layout(); if (reduce) paintTree(cv); });
    ro.observe(cv.parentNode);
    return function () { alive = false; cancelAnimationFrame(treeState.raf); ro.disconnect(); };
  };
  }
  window.mountDiaryTree = function (cv, data, opts) { return makeTree()(cv, data, opts); };
})();
