// Browser tests for workout programs. Run on http://localhost:8000:
//   (await import('/tests/programs.test.js?'+Date.now())).run()
const {PROGRAMS, nextDay, buildDay, EX_IDS: A_FULL} = window.ironLevelPrograms;

const S = o => JSON.stringify(o);
const eq = (a, b) => S(a) === S(b);
const none = new Set();

const cases = {
  "ids-valid": () => {
    const ids = new Set(A_FULL.map(e => e.id));
    const bad = PROGRAMS.flatMap(p => p.days.flatMap(d => d.sl.flatMap(s => s.o))).filter(id => !ids.has(id));
    if (bad.length) return {unknown: bad};
    const short = PROGRAMS.flatMap(p => p.days.filter(d => buildDay(p.id, d.id, none, A_FULL).length !== d.sl.length).map(d => p.id + "/" + d.id));
    return short.length === 0 || {short};
  },
  "first-day": () => nextDay("ppl", []) === "push",
  "rotation": () => nextDay("ppl", [{prog:"ppl",day:"push",date:"2026-10-01"}]) === "pull",
  "wraps": () => nextDay("ppl", [{prog:"ppl",day:"legs",date:"2026-10-01"}]) === "push",
  "order-by-date": () => nextDay("fb", [{prog:"fb",day:"b",date:"2026-10-03"},{prog:"fb",day:"a",date:"2026-10-01"}]) === "a",
  "same-date-by-t": () => nextDay("fb", [{prog:"fb",day:"b",date:"2026-10-01",t:2},{prog:"fb",day:"a",date:"2026-10-01",t:1}]) === "a",
  "switch-program": () => nextDay("ul", [{prog:"ppl",day:"push",date:"2026-10-01"}]) === "u1",
  "unknown-day-ignored": () => nextDay("ppl", [{prog:"ppl",day:"push",date:"2026-10-01"},{prog:"ppl",day:"zzz",date:"2026-10-02"}]) === "pull",
  "build-default": () => { const d = buildDay("ppl", "push", none, A_FULL); return eq(d[0], {ex:"bench",s:3,r:"6–8"}) || d[0]; },
  "build-hidden": () => buildDay("ppl", "push", new Set(["bench"]), A_FULL)[0].ex === "hs-bench",
  "fallback-group": () => { const d = buildDay("ppl", "legs", new Set(["squat","smith","hs-hack"]), A_FULL); return d[0].ex === "hs-legp" && d[2].ex === "lf-legp" || d.map(x => x.ex); },
  "slot-skipped": () => buildDay("ppl", "pull", none, [{id:"bench",g:"chest"}]).length === 0,
  "no-duplicates": () => { const d = buildDay("ppl", "pull", none, [{id:"c-x",g:"arms"}]); return eq(d, [{ex:"c-x",s:3,r:"10–12"}]) || d; },
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
