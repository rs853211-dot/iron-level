// Browser tests for the backup format. Run on http://localhost:8000:
//   (await import('/tests/backup.test.js?'+Date.now())).run()
const {makeBackup: mk, parseBackup: pb} = window.ironLevelBackup;

const S = o => JSON.stringify(o);
const sortKeys = v => Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
const eq = (a, b) => S(sortKeys(a)) === S(sortKeys(b));

const P = {name:"Тест",sex:"m",bw:80,height:180,age:30,gym:"X",hidden:[],custom:[{id:"c-1",n:"Мой",g:"chest"}],createdAt:"2026-01-01"};
const W = [{id:"a",date:"2026-10-01",t:1,exercises:[{ex:"hs-bench",sets:[{w:"80",r:"5"}]}]}];

const cases = {
  "roundtrip": () => { const r = pb(S(mk(P, W, false))); return r.ok && eq(r.profile, {...P, programs:[], program:null}) && eq(r.workouts, W) && r.skipped === 0 || r; },
  "prog-kept": () => { const r = pb(S({profile:{...P,program:"ppl"},workouts:[{...W[0],prog:"ppl",day:"push"}]})); return r.profile.program === "ppl" && r.workouts[0].prog === "ppl" && r.workouts[0].day === "push" || r; },
  "prog-proto-dropped": () => { const r = pb(S({profile:{...P,program:"constructor",custom:[{id:"c-9",n:"X",g:"constructor"}]},workouts:[{...W[0],prog:"toString",day:"x"}]})); return r.ok && r.profile.program === null && r.profile.custom.length === 0 && !("prog" in r.workouts[0]) || r; },
  "prog-unknown-dropped": () => { const r = pb(S({profile:{...P,program:"zzz"},workouts:[{...W[0],prog:"ppl",day:"zzz"}]})); return r.profile.program === null && !("prog" in r.workouts[0]) && !("day" in r.workouts[0]) || r; },
  "header": () => { const b = mk(P, W, false); return b.app === "iron-level" && b.version === 3 && typeof b.exportedAt === "string" || b; },
  "demo-excluded": () => mk(P, W, true).workouts.length === 0,
  "bad-json": () => { const r = pb("{nope"); return r.ok === false && r.error === "Не получилось прочитать файл. Это точно JSON из Iron Level?" || r; },
  "wrong-app": () => { const r = pb(S({app:"other",profile:P,workouts:W})); return r.error === "Это файл не из Iron Level" || r; },
  "newer-version": () => { const r = pb(S({app:"iron-level",version:4,profile:P,workouts:W})); return r.error === "Файл из более новой версии Iron Level. Обнови страницу и попробуй снова" || r; },
  "no-profile": () => { const r = pb(S({workouts:W})); return r.error === "В файле нет профиля персонажа" || r; },
  "bad-bw": () => { const r = pb(S({profile:{...P,bw:5},workouts:W})); return r.error === "В файле нет профиля персонажа" || r; },
  "no-workouts": () => { const r = pb(S({profile:P})); return r.error === "В файле нет журнала тренировок" || r; },
  "raw-localstorage": () => { const r = pb(S({profile:P,workouts:W})); return r.ok === true || r; },
  "bad-date-skipped": () => { const r = pb(S({profile:P,workouts:[...W,{id:"b",date:"01.10.2026",exercises:[]}]})); return r.ok && r.workouts.length === 1 && r.skipped === 1 || r; },
  "dup-ids": () => { const r = pb(S({profile:P,workouts:[W[0],{...W[0],t:2}]})); return r.workouts.length === 1 && r.workouts[0].t === 1 && r.skipped === 1 || r; },
  "sets-as-strings": () => { const r = pb(S({profile:P,workouts:[{id:"c",date:"2026-10-02",exercises:[{ex:"squat",sets:[{w:100,r:5}]}]}]})); return eq(r.workouts[0].exercises[0].sets[0], {w:"100",r:"5"}) || r; },
  "unknown-ex-kept": () => { const r = pb(S({profile:P,workouts:[{id:"d",date:"2026-10-03",exercises:[{ex:"gone",sets:[{w:"1",r:"1"}]}]}]})); return r.workouts.length === 1 || r; },
  "profile-defaults": () => { const p = pb(S({profile:{name:"A",bw:70},workouts:[]})).profile; return p.sex === "m" && eq(p.hidden, []) && eq(p.custom, []) || p; },
  // review findings
  "unsafe-workout-id-skipped": () => { const r = pb(S({profile:P,workouts:[...W,{...W[0],id:'x"><img src=x onerror=alert(1)>'}]})); return r.workouts.length === 1 && r.skipped === 1 || r; },
  "unsafe-ex-dropped": () => { const r = pb(S({profile:P,workouts:[{id:"e",date:"2026-10-04",exercises:[{ex:'a"b',sets:[]},{ex:"squat",sets:[]}]}]})); return eq(r.workouts[0].exercises.map(e => e.ex), ["squat"]) || r; },
  "custom-sanitized": () => { const p = pb(S({profile:{...P,custom:[{id:"c-2",n:"Ok",g:"legs",t:0,z:"hs",bw:true},{id:"c-3",n:"BadGroup",g:"nope"},{id:"hs-bench",n:"Clash",g:"chest"},{id:'c"4',n:"Bad",g:"arms"}]},workouts:[]})).profile; return eq(p.custom, [{id:"c-2",n:"Ok",g:"legs"}]) || p.custom; },
  "profile-whitelist": () => { const p = pb(S({profile:{name:"x".repeat(40),bw:80,height:"abc",age:"31",gym:{a:1},evil:1,createdAt:5},workouts:[]})).profile; return p.name.length === 24 && p.height === null && p.age === 31 && p.gym === "Crunch Fit Lichtenberg" && !("evil" in p) && /^\d{4}-\d{2}-\d{2}$/.test(p.createdAt) || p; },
  "impossible-date-skipped": () => { const r = pb(S({profile:P,workouts:[...W,{id:"f",date:"2026-02-31",exercises:[]}]})); return r.workouts.length === 1 && r.skipped === 1 || r; },
  "own-program-roundtrip": () => { const prog = {id:"p-a", n:"Моя", days:[{id:"d-1", n:"День 1", sl:[{o:["bench"], s:4, r:"6–8"}]}]};
    const r = pb(S(mk({...P, programs:[prog], program:"p-a"}, [{...W[0], prog:"p-a", day:"d-1"}], false)));
    return r.ok && eq(r.profile.programs, [prog]) && r.profile.program === "p-a" && r.workouts[0].prog === "p-a" && r.workouts[0].day === "d-1" || r; },
  "own-program-day-removed": () => { const prog = {id:"p-a", n:"Моя", days:[{id:"d-1", n:"День 1", sl:[]}]};
    const r = pb(S({profile:{...P, programs:[prog], program:"p-a"}, workouts:[{...W[0], prog:"p-a", day:"d-9"}]})); return r.ok && !("prog" in r.workouts[0]) || r; },
  "own-program-missing-selected": () => { const r = pb(S({profile:{...P, program:"p-zzz"}, workouts:W})); return r.ok && r.profile.program === null || r; },
  "edited-builtin-selected": () => { const prog = {id:"ppl", n:"Мой ППН", days:[{id:"push", n:"Пуш", sl:[]}]};
    const r = pb(S({profile:{...P, programs:[prog], program:"ppl"}, workouts:[{...W[0], prog:"ppl", day:"push"}]})); return r.ok && r.profile.program === "ppl" && r.workouts[0].day === "push" || r; },
  "old-v1-file": () => { const r = pb(S({app:"iron-level", version:1, profile:{...P, program:"ppl"}, workouts:[{...W[0], prog:"ppl", day:"push"}]})); return r.ok && eq(r.profile.programs, []) && r.profile.program === "ppl" && r.workouts[0].day === "push" || r; },
  "programs-garbage-dropped": () => { const r = pb(S({profile:{...P, programs:"x"}, workouts:W})); return r.ok && eq(r.profile.programs, []) || r; },
  "schedule-roundtrip": () => { const r = pb(S(mk({...P, schedule:[5,1,3]}, W, false))); return r.ok && eq(r.profile.schedule, [1,3,5]) || r; },
  "schedule-garbage-dropped": () => { const r = pb(S({profile:{...P, schedule:[0,8,"2",1.5,null,2,2]}, workouts:W})); return r.ok && eq(r.profile.schedule, [2]) || r; },
  "schedule-absent-stays-absent": () => { const r = pb(S({profile:P, workouts:W})); return r.ok && !("schedule" in r.profile) || r; },
  "schedule-not-array": () => { const r = pb(S({profile:{...P, schedule:"1,3,5"}, workouts:W})); return r.ok && !("schedule" in r.profile) || r; },
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
