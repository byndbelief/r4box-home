/* Story kit: the shared pattern for every individual diary page (a kid's world on
   family-world, an idea on diary.r4box.com). World on top, story scrolling below:
   progress (streak + last 14 days), seeds/next steps, the story told in chapters, the
   journal days it appears in, and share-with-family. Plain JS so both kits can load it.
   Events are { day, kind, effort, summary? }. Days are ISO dates. */
(function () {
  const dn = (d) => Math.round(Date.parse(String(d).slice(0, 10) + 'T00:00:00Z') / 864e5);
  const iso = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
  const today = () => new Date().toISOString().slice(0, 10);

  // Days in a row with something growing, ending today or yesterday; plus the best run ever.
  function streak(days) {
    const set = new Set(days.map(dn)); if (!set.size) return { now: 0, best: 0, last: null, total: 0 };
    const s = [...set].sort((a, b) => a - b); let best = 1, run = 1;
    for (let i = 1; i < s.length; i++) { run = s[i] - s[i - 1] === 1 ? run + 1 : 1; best = Math.max(best, run); }
    const t = dn(today()); let d = set.has(t) ? t : set.has(t - 1) ? t - 1 : null, now = 0;
    if (d != null) while (set.has(d)) { now++; d--; }
    return { now, best, last: iso(s[s.length - 1]), total: s.length, sinceLast: t - s[s.length - 1] };
  }
  // The last n days as cells: { day, v (summed effort), dow, today }
  function lastDays(evs, n = 14) {
    const t = dn(today()), m = {};
    evs.forEach((e) => { const k = dn(e.day); m[k] = (m[k] || 0) + (+e.effort || 1); });
    return Array.from({ length: n }, (_, i) => { const k = t - (n - 1 - i); return { day: iso(k), v: m[k] || 0, dow: new Date(k * 864e5).getUTCDay(), today: k === t }; });
  }
  // A story in chapters: a new chapter starts after a gap of more than `gap` days.
  const NAME = { first: 'It begins', ship: 'Finished', turn: 'A turn', revive: 'Back again', park: 'Resting', grow: 'Growing' };
  function chapters(evs, gap = 7) {
    const out = []; let cur = null;
    evs.slice().sort((a, b) => String(a.day).localeCompare(String(b.day))).forEach((e) => {
      const d = dn(e.day);
      if (!cur || d - cur.endN > gap) { cur = { start: e.day, end: e.day, endN: d, evs: [] }; out.push(cur); }
      cur.evs.push(e); cur.end = e.day; cur.endN = d;
    });
    out.forEach((c, i) => {
      const k = c.evs.map((e) => e.kind);
      const key = i === 0 ? 'first' : k.includes('ship') ? 'ship' : k.includes('park') ? 'park' : k.includes('revive') ? 'revive' : k.some((x) => /branch|pivot|merge/.test(x)) ? 'turn' : 'grow';
      c.n = i + 1; c.name = i === 0 && k.includes('ship') ? 'Start to finish' : NAME[key]; c.key = key;
      c.effort = c.evs.reduce((s, e) => s + (+e.effort || 1), 0);
      c.days = new Set(c.evs.map((e) => e.day)).size;
    });
    return out;
  }
  const range = (a, b, fmt) => { const f = (d) => new Date(d + 'T12:00:00').toLocaleDateString([], fmt || { month: 'short', day: 'numeric' }); return a === b ? f(a) : f(a) + ' – ' + f(b); };
  // Share with family: one flag per thing, shared across both kits (same origin).
  // r4box.com: shares live in kid_shares (108), through window.R4Store; the family reads them.
  const all = () => (window.R4Store ? window.R4Store.shared() : {});
  const isShared = (id) => !!all()[id];
  function setShared(id, on, meta) { if (window.R4Store) window.R4Store.setShared(id, on, { at: today(), ...(meta || {}) }); }
  // Next steps / goals for a thing (diary ideas; kids use planted seeds).
  const goalsOf = (id) => { try { return JSON.parse(localStorage.getItem('r4.goals.' + id) || '[]'); } catch { return []; } };
  const setGoals = (id, g) => localStorage.setItem('r4.goals.' + id, JSON.stringify(g));
  // Density: how much a page shows at once, from a toy cockpit to a real one.
  // Default comes from age; a person's own pick overrides it (stored per person).
  const DENSITY = [
    { id: 'play', name: 'Play', em: '🧸', blurb: 'A few big controls' },
    { id: 'explore', name: 'Explore', em: '🧭', blurb: 'The main things, a little text' },
    { id: 'pilot', name: 'Pilot', em: '✈️', blurb: 'Every instrument at once' },
    { id: 'dev', name: 'Developer', em: '⌘', blurb: 'Everything, condensed, plus the raw data' },
  ];
  const densityByAge = (age) => (age == null ? 'explore' : age < 9 ? 'play' : age < 15 ? 'explore' : 'pilot');
  const densityOf = (p) => { const v = localStorage.getItem('r4.density.' + p.id); return v === 'alien' ? 'dev' : DENSITY.some((d) => d.id === v) ? v : densityByAge(p.age); };
  const setDensity = (p, v) => (v ? localStorage.setItem('r4.density.' + p.id, v) : localStorage.removeItem('r4.density.' + p.id));
  window.StoryKit = { DENSITY, densityByAge, densityOf, setDensity, dn, iso, today, streak, lastDays, chapters, range, isShared, setShared, sharedAll: all, goalsOf, setGoals };
})();
