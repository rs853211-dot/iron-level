// Tests for the game rules (derive) and for loading stored data. Run like the other tests:
//   (await import('/tests/core.test.js?'+Date.now())).run()   or   node tests/run-node.mjs
const {derive, cleanLoaded, GROUP_KEYS, XP, levelNeed} = window.ironLevelCore;

const P = {name:"Тест", sex:"m", bw:80, gym:"X", hidden:[], custom:[], createdAt:"2026-01-01"};
const set = (w, r) => ({w:String(w), r:String(r)});
// 2026-10-05 is a Monday: workouts on 5 and 6 October fall in one week, on 12 October in the next
const wk = (id, date, ...ex) => ({id, date, t:1, exercises: ex.map(([e, ...s]) => ({ex:e, sets:s}))});

const cases = {
  "no-workouts": () => { const d = derive(P, []); return d.xp === 0 && d.level === 1 && d.prs === 0 || d; },
  "first-workout-xp": () => {
    // 1 set, no record to beat, the lagging group is not trained 3 times: 30 for the workout + 5 for the set
    const d = derive(P, [wk("a", "2026-10-05", ["row", set(60, 8)])]);
    return d.xp === XP.done + XP.set && d.prs === 0 || d.xp;
  },
  "pr-set-bonus": () => {
    const d = derive(P, [wk("a", "2026-10-05", ["row", set(60, 8)]), wk("b", "2026-10-06", ["row", set(70, 8)])]);
    return d.prs === 1 && d.perW.b.prSets === 1 && d.perW.b.xp === XP.done + XP.set + XP.pr || d.perW;
  },
  "lighter-set-no-pr": () => {
    const d = derive(P, [wk("a", "2026-10-05", ["row", set(70, 8)]), wk("b", "2026-10-06", ["row", set(60, 8)])]);
    return d.prs === 0 || d.prs;
  },
  "empty-reps-no-xp": () => {
    const d = derive(P, [wk("a", "2026-10-05", ["row", set(60, 0), set(60, 8)])]);
    return d.perW.a.nSets === 1 || d.perW.a;
  },
  "third-workout-week-bonus": () => {
    const ws = [wk("a", "2026-10-05", ["row", set(60, 8)]), wk("b", "2026-10-06", ["row", set(60, 8)]), wk("c", "2026-10-07", ["row", set(60, 8)])];
    const d = derive(P, ws);
    return d.perW.c.bonus > 0 && d.perW.b.bonus === 0 || d.perW;
  },
  "level-curve": () => levelNeed(1) === 100 && levelNeed(2) === 150 && levelNeed(10) === 550,
  "level-up": () => {
    // enough sets for 100+ XP gets level 2
    const sets = Array.from({length:20}, () => set(50, 10));
    const d = derive(P, [wk("a", "2026-10-05", ["row", ...sets])]);
    return d.xp >= 100 && d.level === 2 || {xp:d.xp, level:d.level};
  },
  "delete-lowers-xp": () => {
    const ws = [wk("a", "2026-10-05", ["row", set(60, 8)]), wk("b", "2026-10-06", ["row", set(70, 8)])];
    return derive(P, ws.slice(0, 1)).xp < derive(P, ws).xp;
  },
  "streak-two-weeks": () => {
    const ws = [wk("a", "2026-10-05", ["row", set(60, 8)]), wk("b", "2026-10-06", ["row", set(60, 8)]),
                wk("c", "2026-10-12", ["row", set(60, 8)]), wk("d", "2026-10-13", ["row", set(60, 8)])];
    return derive(P, ws).cum.streak === 2 || derive(P, ws).cum.streak;
  },
  "unknown-exercise-ignored": () => {
    const d = derive(P, [wk("a", "2026-10-05", ["gone-id", set(60, 8)])]);
    return d.xp === XP.done && d.prs === 0 || d.xp;
  },
  "bench-achievement-barbell": () => !!derive(P, [wk("a", "2026-10-05", ["bench", set(100, 1)])]).unlocked.b100,
  "bench-achievement-plate-loaded": () => !!derive(P, [wk("a", "2026-10-05", ["hs-bench", set(100, 1)])]).unlocked.b100,
  "bench-achievement-needs-100": () => !derive(P, [wk("a", "2026-10-05", ["hs-bench", set(99, 1)])]).unlocked.b100,
  "bench-bodyweight-achievement": () => !!derive(P, [wk("a", "2026-10-05", ["hs-bench", set(80, 1)])]).unlocked.bbw,
  "group-keys": () => GROUP_KEYS.length === 6 || GROUP_KEYS,

  // stored data is untrusted
  "load-null": () => { const r = cleanLoaded(null); return r.profile === null && r.workouts.length === 0 || r; },
  "load-wrong-types": () => { const r = cleanLoaded({profile:"x", workouts:"y"}); return r.profile === null && r.workouts.length === 0 || r; },
  "load-array-as-profile": () => cleanLoaded({profile:[], workouts:[]}).profile === null,
  "load-drops-bad-workouts": () => {
    const good = wk("ok", "2026-10-05", ["row", set(60, 8)]);
    const r = cleanLoaded({profile:P, workouts:[good, null, 5, {id:1, date:"2026-10-05"}, {id:"x", date:"05.10.2026"}, {id:"y"}]});
    return r.workouts.length === 1 && r.workouts[0].id === "ok" || r.workouts;
  },
  "load-keeps-profile": () => cleanLoaded({profile:P, workouts:[]}).profile.name === "Тест",
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : JSON.stringify(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
