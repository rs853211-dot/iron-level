// Browser tests for the gym map layout file. Run on http://localhost:8000:
//   (await import('/tests/map.test.js?'+Date.now())).run()
const {parseMap: pm, makeMapFile: mk, kinds, icons, add, kindEx, machines} = window.ironLevelMap;

const S = o => JSON.stringify(o);
const M = [{id:"rack-1",k:"rack",x:864,y:191,r:0},{id:"m-1",k:"lever",x:500.5,y:300,r:90,n:"Hammer Strength Chest Press",ex:["hs-bench"]},{id:"cab",k:"cable",x:1,y:2,r:0,ex:"cable"}];
const file = ms => S({app:"iron-level-map",version:1,machines:ms});

const cases = {
  "roundtrip": () => { const r = pm(S(mk(M, "X"))); return r.ok && S(r.machines) === S(M) && r.skipped === 0 || r; },
  "header": () => { const f = mk(M, "Gym"); return f.app === "iron-level-map" && f.version === 1 && f.gym === "Gym" && typeof f.exportedAt === "string" || f; },
  "builtin-roundtrip": () => { const r = pm(S(mk(machines, "X"))); return r.ok && r.machines.length === machines.length || r; },
  "builtin-ids-unique": () => new Set(machines.map(m => m.id)).size === machines.length,
  "every-kind-drawn": () => { const miss = kinds.filter(k => !icons.includes(k)); return miss.length === 0 || miss; },
  "every-kind-addable": () => { const miss = kinds.filter(k => !add.includes(k)); return miss.length === 0 && add.length === kinds.length || miss; },
  "kind-ex-known": () => { const cat = window.ironLevelInsights.catalog; const bad = Object.entries(kindEx).flatMap(([k, ex]) => ex === "cable" ? [] : ex.filter(id => !cat.some(e => e.id === id)).map(id => k + ":" + id)); return bad.length === 0 || bad; },
  "bad-json": () => { const r = pm("{nope"); return r.ok === false && r.error === "Не получилось прочитать файл. Это точно JSON карты из Iron Level?" || r; },
  "wrong-app": () => { const r = pm(S({app:"iron-level",machines:M})); return r.error === "Это не файл карты Iron Level" || r; },
  "newer-version": () => { const r = pm(S({app:"iron-level-map",version:2,machines:M})); return r.error === "Файл из более новой версии Iron Level. Обнови страницу и попробуй снова" || r; },
  "no-machines": () => { const r = pm(S({app:"iron-level-map",version:1})); return r.error === "В файле нет тренажёров" || r; },
  "unknown-kind-skipped": () => { const r = pm(file([...M, {id:"z",k:"toString",x:1,y:1}])); return r.machines.length === 3 && r.skipped === 1 || r; },
  "unsafe-id-skipped": () => { const r = pm(file([{id:'a"><img src=x>',k:"rack",x:1,y:1}])); return r.machines.length === 0 && r.skipped === 1 || r; },
  "dup-id-skipped": () => { const r = pm(file([M[0], {...M[0], x:5}])); return r.machines.length === 1 && r.machines[0].x === 864 || r; },
  "bad-coords-skipped": () => { const r = pm(file([{id:"a",k:"rack",x:"1",y:1},{id:"b",k:"rack",x:1e9,y:1}])); return r.skipped === 2 || r; },
  "size-kept": () => { const ms = [{id:"a",k:"rack",x:1,y:1,r:0,s:1.3}]; const r = pm(S(mk(ms, "X"))); return r.machines[0].s === 1.3 || r; },
  "size-default-omitted": () => { const f = mk([{id:"a",k:"rack",x:1,y:1,r:0,s:1}], "X"); const r = pm(file([{id:"b",k:"rack",x:1,y:1,s:1}])); return !("s" in f.machines[0]) && !("s" in r.machines[0]) || [f, r]; },
  "size-clamped": () => { const r = pm(file([{id:"a",k:"rack",x:1,y:1,s:0.01},{id:"b",k:"rack",x:1,y:1,s:99},{id:"c",k:"rack",x:1,y:1,s:"2"}])); return r.machines[0].s === 0.4 && r.machines[1].s === 3 && !("s" in r.machines[2]) || r; },
  "angle-normalized": () => { const r = pm(file([{id:"a",k:"rack",x:1,y:1,r:-90},{id:"b",k:"rack",x:1,y:1,r:"x"}])); return r.machines[0].r === 270 && r.machines[1].r === 0 || r; },
  "name-trimmed": () => { const r = pm(file([{id:"a",k:"mach",x:1,y:1,n:"  " + "x".repeat(60)}])); return r.machines[0].n.length === 40 || r; },
  "ex-sanitized": () => { const r = pm(file([{id:"a",k:"mach",x:1,y:1,ex:["hs-bench",'a"b',"hs-bench",5]}])); return S(r.machines[0].ex) === S(["hs-bench"]) || r; },
  "ex-absent-stays-default": () => { const r = pm(file([{id:"a",k:"rack",x:1,y:1}])); return !("ex" in r.machines[0]) && !("n" in r.machines[0]) || r; },
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
