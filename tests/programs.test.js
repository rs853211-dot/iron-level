// Browser tests for workout programs. Run on http://localhost:8000:
//   (await import('/tests/programs.test.js?'+Date.now())).run()
const {PROGRAMS, nextDay, buildDay, cleanPrograms, progList, rebuildPrograms, MAX_PROGS, MAX_DAYS, MAX_SLOTS, EX_IDS: A_FULL} = window.ironLevelPrograms;

const S = o => JSON.stringify(o);
const eq = (a, b) => S(a) === S(b);
const none = new Set();
const OWN = {id:"p-mine", n:"Моя", days:[{id:"d-1", n:"Грудь", sl:[{o:["bench","hs-bench"], s:4, r:"6–8"}]}, {id:"d-2", n:"Спина", sl:[{o:["pull"], s:3, r:"8–10"}, {o:["curl"], s:3, r:"10–12"}]}]};

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
  // programs of the user: an edited copy of a built-in replaces it, any other id is an own program
  "own-valid": () => { const r = cleanPrograms([OWN]); return eq(r, [OWN]) || r; },
  "own-list": () => { const l = progList([OWN]); return l.length === PROGRAMS.length + 1 && l[l.length - 1].own === true && l[l.length - 1].sub === "Своя программа" || l.map(x => x.id); },
  "own-used": () => { rebuildPrograms([OWN]); try { return nextDay("p-mine", []) === "d-1" && buildDay("p-mine", "d-2", none, A_FULL).map(x => x.ex).join() === "pull,curl" || buildDay("p-mine", "d-2", none, A_FULL); } finally { rebuildPrograms([]); } },
  "own-rotation": () => { rebuildPrograms([OWN]); try { return nextDay("p-mine", [{prog:"p-mine",day:"d-1",date:"2026-10-01"}]) === "d-2" && nextDay("p-mine", [{prog:"p-mine",day:"d-2",date:"2026-10-01"}]) === "d-1"; } finally { rebuildPrograms([]); } },
  "edited-builtin-replaces": () => {
    const edited = {id:"ppl", n:"Мой ППН", days:[{id:"push", n:"Пуш", sl:[{o:["bench"], s:5, r:"5"}]}]};
    rebuildPrograms([edited]);
    try { const l = progList([edited]); return l.length === PROGRAMS.length && l.find(x => x.id === "ppl").edited === true && buildDay("ppl", "push", none, A_FULL)[0].s === 5 && nextDay("ppl", []) === "push"; }
    finally { rebuildPrograms([]); }
  },
  "reset-builtin": () => { rebuildPrograms([{id:"ppl", n:"X", days:[{id:"a", n:"A", sl:[]}]}]); rebuildPrograms([]); return nextDay("ppl", []) === "push"; },
  "empty-day-builds-nothing": () => { rebuildPrograms([{id:"p-e", n:"E", days:[{id:"d", n:"D", sl:[]}]}]); try { return buildDay("p-e", "d", none, A_FULL).length === 0; } finally { rebuildPrograms([]); } },
  "hidden-falls-back-in-own": () => { rebuildPrograms([OWN]); try { return buildDay("p-mine", "d-2", new Set(["pull"]), A_FULL)[0].ex !== "pull" && buildDay("p-mine", "d-2", new Set(["pull"]), A_FULL)[0].ex.length > 0; } finally { rebuildPrograms([]); } },
  "clean-not-array": () => eq(cleanPrograms(null), []) && eq(cleanPrograms("x"), []) && eq(cleanPrograms({}), []),
  "clean-bad-program-dropped": () => eq(cleanPrograms([null, 5, {id:"p-1", n:"", days:[{id:"d", n:"D"}]}, {id:"bad id", n:"X", days:[{id:"d", n:"D"}]}, {id:"p-2", n:"Y", days:[]}, {id:"p-3", n:"Z"}]), []),
  "clean-html-names": () => { const r = cleanPrograms([{id:"p-x", n:"<img src=x onerror=1>", days:[{id:"d", n:"<b>x</b>", sl:[]}]}]); return r.length === 1 && r[0].n === "<img src=x onerror=1>" || r; },
  "clean-reps-whitelist": () => { const r = cleanPrograms([{id:"p-x", n:"X", days:[{id:"d", n:"D", sl:[{o:["bench"], s:3, r:"<script>"}, {o:["bench"], s:3, r:"6-8"}, {o:["bench"], s:3, r:"abc"}, {o:["bench"], s:3, r:"10–12"}]}]}]); return eq(r[0].days[0].sl.map(x => x.r), ["8–12", "6-8", "8–12", "10–12"]) || r[0].days[0].sl; },
  "clean-sets-clamped": () => { const r = cleanPrograms([{id:"p-x", n:"X", days:[{id:"d", n:"D", sl:[{o:["bench"], s:99}, {o:["bench"], s:0}, {o:["bench"], s:"4"}, {o:["bench"]}]}]}]); return eq(r[0].days[0].sl.map(x => x.s), [10, 3, 4, 3]) || r[0].days[0].sl; },
  "clean-slot-without-exercise": () => { const r = cleanPrograms([{id:"p-x", n:"X", days:[{id:"d", n:"D", sl:[{o:[], s:3, r:"8"}, {o:['a"b'], s:3, r:"8"}, {s:3}]}]}]); return r[0].days[0].sl.length === 0 || r[0].days[0].sl; },
  "clean-limits": () => {
    const many = Array.from({length: 30}, (_, i) => ({id:"p-" + i, n:"P" + i, days:Array.from({length: 20}, (_, j) => ({id:"d" + j, n:"D" + j, sl:Array.from({length: 40}, () => ({o:["bench"], s:3, r:"8"}))}))}));
    const r = cleanPrograms(many);
    return r.length === MAX_PROGS && r[0].days.length === MAX_DAYS && r[0].days[0].sl.length === MAX_SLOTS || [r.length, r[0].days.length, r[0].days[0].sl.length];
  },
  "clean-duplicate-ids": () => { const r = cleanPrograms([{id:"p-x", n:"A", days:[{id:"d", n:"D"}, {id:"d", n:"E"}]}, {id:"p-x", n:"B", days:[{id:"d", n:"D"}]}]); return r.length === 1 && r[0].days.length === 1 && r[0].n === "A" || r; },
  "clean-proto-ids-safe": () => { const r = cleanPrograms([{id:"__proto__", n:"A", days:[{id:"constructor", n:"D"}]}]); rebuildPrograms(r); try { return nextDay("__proto__", []) === "constructor" && nextDay("ppl", []) === "push"; } finally { rebuildPrograms([]); } },
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
