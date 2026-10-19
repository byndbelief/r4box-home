/* Where everything stands in a world, in world units, plus the ties between them.
   One ground; the tree in the middle; flowers (chat) and bushes (games) on the ground either
   side; star-trees (trips) in the sky; planted seeds wherever they were planted.
   Roots run underground from every flower, bush and seed to the tree; light threads run from
   every star-tree to the crown; dotted threads join things that grew on the same days. */
(function () {
  const P = () => window.WorldParts;
  const QUIET = 14, today = () => new Date().toISOString().slice(0, 10);
  const since = (d) => Math.round((Date.parse(today()) - Date.parse(d)) / 864e5);
  function grow(t, events) {
    const evs = events.filter((e) => e.topic === t.id), last = evs.length ? evs[evs.length - 1].day : t.created;
    let parked = t.stage === 'parked';
    for (let i = evs.length - 1; i >= 0 && !parked; i--) { if (evs[i].kind === 'revive') break; if (evs[i].kind === 'park') parked = true; }
    return { evs, n: evs.length, effort: evs.reduce((s, e) => s + (+e.effort || 1), 0), parked, quiet: !parked && since(last) > QUIET,
      played: evs.reduce((s, e) => s + (+(e.meta && e.meta.played) || 0), 0), won: evs.reduce((s, e) => s + (+(e.meta && e.meta.won) || 0), 0),
      shipped: t.stage === 'shipped' || evs.some((e) => e.kind === 'ship') };
  }
  window.layoutWorld = function (data, seeds, VW, VH) {
    const WW = Math.max(900, VW * 2.4), WH = Math.max(700, VH * 1.7), gy = WH * 0.72, s = 1.25;
    const topics = (data.topics || []).slice().sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.slug.localeCompare(b.slug));
    const by = (src) => topics.filter((t) => t.source === src).map((t) => ({ t, g: grow(t, data.events || []) }));
    const tree = { w: WW * 0.34, h: gy * 0.86 }; tree.x = (WW - tree.w) / 2; tree.y = gy - tree.h + 18;
    const root = { x: WW / 2, y: gy }, crown = { x: WW / 2, y: tree.y + tree.h * 0.3 };
    const side = (i) => (i % 2 ? -1 : 1), rank = (i) => Math.floor(i / 2);
    const objs = [];
    by('chat').forEach((o, i) => objs.push(P().flower(o.t, o.g, WW / 2 + side(i) * (tree.w * 0.58 + rank(i) * 120), gy - 2, s)));
    by('game').forEach((o, i) => objs.push(P().bush(o.t, o.g, WW / 2 + side(i + 1) * (tree.w * 0.6 + 70 + rank(i) * 150), gy, s)));
    by('trip').forEach((o, i) => objs.push(P().starTree(o.t, o.g, WW / 2 + side(i) * (WW * 0.2 + rank(i) * 160), WH * (0.1 + (i % 3) * 0.06), s)));
    const KC = { game: '#3DD6C6', app: '#F5C542', page: '#B9A6FF', story: '#FF5A4A', toy: '#7DF0C8' };
    (data.projects || []).forEach((pr, i) => objs.push(P().project(pr, WW / 2 + side(i + 1) * (tree.w * 0.5 + 95 + rank(i) * 70), gy, s, KC[pr.kind] || '#B9A6FF')));
    (seeds || []).forEach((sd, i) => objs.push(P().sprout(sd.x == null ? { ...sd, x: WW / 2 + side(i) * (tree.w * 0.5 + 30 + rank(i) * 46), y: gy } : sd, s)));
    // ties
    const ties = [], tutorDays = new Set((data.events || []).filter((e) => topics.some((t) => t.id === e.topic && t.source === 'tutor')).map((e) => e.day));
    objs.forEach((o) => {
      const base = o.segs[0], from = o.kind === 'stars' ? o.root : { x: base.x1, y: base.y1 };
      const shared = o.g ? o.g.evs.filter((e) => tutorDays.has(e.day)).length : 0;
      ties.push({ a: from, b: o.kind === 'stars' ? crown : root, under: o.kind !== 'stars', c: o.kind === 'stars' ? '#F5C542' : o.kind === 'bush' ? '#3DD6C6' : '#B9A6FF', w: 1 + Math.min(2.2, shared * 0.5), ph: (P().hash(o.topic ? o.topic.slug : o.seed.id) % 100) / 100 });
    });
    const withDays = objs.filter((o) => o.g).map((o) => ({ o, days: new Set(o.g.evs.map((e) => e.day)) }));
    for (let i = 0; i < withDays.length; i++) for (let j = i + 1; j < withDays.length; j++) {
      const k = [...withDays[i].days].filter((d) => withDays[j].days.has(d)).length;
      if (k) ties.push({ a: withDays[i].o.hit, b: withDays[j].o.hit, c: '#C9FFF8', w: 0.7 + Math.min(2, k * 0.6), k, dotted: true, ph: ((i * 7 + j * 3) % 10) / 10 });
    }
    return { WW, WH, gy, s, tree, root, crown, objs, ties, tutor: topics.filter((t) => t.source === 'tutor') };
  };
})();
