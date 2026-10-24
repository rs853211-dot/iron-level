// Browser tests for muscle ranks and recovery. Run on http://localhost:8000:
//   (await import('/tests/insights.test.js?'+Date.now())).run()
const {groupRank, recovery, muscleFill, loadW, catalog} = window.ironLevelInsights;

const S = o => JSON.stringify(o);
const eq = (a, b) => S(a) === S(b);
const G = {bench:"chest", squat:"legs", row:"back", curl:"arms"};
const gOf = id => G[id];
const wk = (date, ...ex) => ({id:date+ex.join(), date, exercises: ex.map(e => ({ex:e, sets:[{w:"50",r:"5"}]}))});

const cases = {
  "rank-zero": () => { const r = groupRank(0); return r.name === "Бронза" && r.next === "Серебро" && r.toNext === 25 && r.pct === 0 || r; },
  "rank-edges": () => [[.249,"Бронза"],[.25,"Серебро"],[.5,"Золото"],[.7,"Платина"],[.9,"Элита"]].every(([v,n]) => groupRank(v).name === n) || [.249,.25,.5,.7,.9].map(v => groupRank(v).name),
  "rank-mid": () => { const r = groupRank(.6); return r.name === "Золото" && r.next === "Платина" && r.toNext === 10 && r.pct === 50 || r; },
  "rank-top": () => { const r = groupRank(1); return r.name === "Элита" && r.next === null && r.toNext === 0 && r.pct === 100 || r; },
  "rank-clamps": () => groupRank(-1).name === "Бронза" && groupRank(2).name === "Элита",
  "rec-empty": () => { const r = recovery([], "2026-10-22", gOf); return r.days === null && r.fresh === 6 && r.recovering.size === 0 || {...r, recovering:[...r.recovering]}; },
  "rec-today": () => { const r = recovery([wk("2026-10-22","bench")], "2026-10-22", gOf); return r.days === 0 && eq([...r.recovering], ["chest"]) && r.fresh === 5 || {...r, recovering:[...r.recovering]}; },
  "rec-yesterday-still-recovering": () => { const r = recovery([wk("2026-10-21","squat","row")], "2026-10-22", gOf); return r.days === 1 && r.recovering.has("legs") && r.recovering.has("back") && r.fresh === 4 || {...r, recovering:[...r.recovering]}; },
  "rec-two-days-fresh": () => { const r = recovery([wk("2026-10-20","squat")], "2026-10-22", gOf); return r.days === 2 && r.recovering.size === 0 && r.fresh === 6 || {...r, recovering:[...r.recovering]}; },
  "rec-latest-wins": () => { const r = recovery([wk("2026-10-10","curl"), wk("2026-10-19","bench")], "2026-10-22", gOf); return r.days === 3 || r; },
  "rec-unknown-ex": () => { const r = recovery([wk("2026-10-22","gone")], "2026-10-22", gOf); return r.days === 0 && r.recovering.size === 0 && r.fresh === 6 || {...r, recovering:[...r.recovering]}; },
  "rec-month-boundary": () => recovery([wk("2026-09-30","bench")], "2026-10-01", gOf).days === 1,
  "fill-ends": () => muscleFill(0) === "#52524c" && muscleFill(1) === "#a8a89f" || [muscleFill(0), muscleFill(1)],
  // catalog checked against the gym videos
  "load-plain": () => loadW("bench", {w:"80"}, 80) === 80,
  "load-bodyweight": () => loadW("pull", {w:"10"}, 80) === 90,
  "load-assisted": () => loadW("as-pull", {w:"20"}, 80) === 60,
  "load-assisted-clamps": () => loadW("as-dip", {w:"120"}, 80) === 0,
  "catalog-new-ids": () => ["as-pull","as-dip","declbb","s360-kbs","s360-gob","s360-trx","s360-slam","sled"].every(id => catalog.some(e => e.id === id)) || catalog.map(e => e.id),
  "catalog-ids-unique": () => new Set(catalog.map(e => e.id)).size === catalog.length,
  "catalog-func-zone": () => catalog.filter(e => e.z === "func").length === 5,
  "fill-monotonic": () => { const l = x => parseInt(muscleFill(x).slice(1,3),16); return l(.2) < l(.5) && l(.5) < l(.8); },
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
