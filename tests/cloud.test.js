// Cloud merge rules (cloudMerge): who wins, tombstones, first sync, untrusted server data. Runs under tests/run-node.mjs.
export async function run() {
  const {cloudMerge} = window.ironLevelCloud;
  const out = [];
  const t = (name, fn) => { try { const r = fn(); out.push({name, pass: r === true, detail: r === true ? "" : String(r)}) } catch (e) { out.push({name, pass: false, detail: e.stack || e}) } };
  const prof = {name: "Артём", sex: "m", bw: 80, gym: "G", hidden: [], custom: []};
  const w = (id, date = "2026-11-01", extra = {}) => ({id, date, exercises: [{ex: "bench", sets: [{w: "60", r: "8"}]}], ...extra});
  const rw = (id, ts, o = {}) => ({id, data: o.data || w(id), deleted: !!o.deleted, updated_at: ts});
  const empty = () => ({since: null, dw: {}, del: {}, dp: 0});
  const T1 = "2026-11-10T10:00:00.000000+00:00", T2 = "2026-11-11T10:00:00.000000+00:00";
  const ms = s => Date.parse(s);

  t("first sync on a new phone: server data lands, nothing is pushed back", () => {
    const r = cloudMerge({profile: null, workouts: []}, empty(), {workouts: [rw("a", T1), rw("b", T2)], profile: {data: prof, updated_at: T1}});
    return r.workouts.length === 2 && r.profile.name === "Артём" && !r.pushP && r.up.length === 0 && r.meta.since === T2 || JSON.stringify(r);
  });
  t("first sync with local data and an empty server: all of it goes up", () => {
    const r = cloudMerge({profile: prof, workouts: [w("a"), w("b")]}, empty(), {workouts: [], profile: null});
    return r.pushP && r.up.slice().sort().join() === "a,b" || JSON.stringify(r);
  });
  t("first sync, both sides have data: union, same id keeps the server copy", () => {
    const r = cloudMerge({profile: prof, workouts: [w("a", "2026-01-01"), w("c")]}, empty(), {workouts: [rw("a", T1, {data: w("a", "2026-02-02")}), rw("b", T1)], profile: {data: prof, updated_at: T1}});
    const ids = r.workouts.map(x => x.id).sort().join();
    return ids === "a,b,c" && r.workouts.find(x => x.id === "a").date === "2026-02-02" && r.up.join() === "c" || JSON.stringify(r);
  });
  t("a newer local edit beats the server row and goes up", () => {
    const meta = {...empty(), since: T1, dw: {a: ms(T2) + 1000}};
    const r = cloudMerge({profile: prof, workouts: [w("a", "2026-03-03")]}, meta, {workouts: [rw("a", T2, {data: w("a", "2026-02-02")})], profile: {data: prof, updated_at: T1}});
    return r.workouts[0].date === "2026-03-03" && r.up.join() === "a" || JSON.stringify(r);
  });
  t("an older local edit loses to the server row and the mark is cleared", () => {
    const meta = {...empty(), since: T1, dw: {a: ms(T1)}};
    const r = cloudMerge({profile: prof, workouts: [w("a", "2026-03-03")]}, meta, {workouts: [rw("a", T2, {data: w("a", "2026-02-02")})], profile: {data: prof, updated_at: T2}});
    return r.workouts[0].date === "2026-02-02" && r.up.length === 0 && !("a" in r.meta.dw) || JSON.stringify(r);
  });
  t("a tombstone from the server deletes the workout here", () => {
    const meta = {...empty(), since: T1};
    const r = cloudMerge({profile: prof, workouts: [w("a"), w("b")]}, meta, {workouts: [rw("a", T2, {deleted: true, data: {}})], profile: {data: prof, updated_at: T1}});
    return r.workouts.map(x => x.id).join() === "b" && r.meta.since === T2 || JSON.stringify(r);
  });
  t("a local deletion newer than the server row stays a deletion and is pushed", () => {
    const meta = {...empty(), since: T1, del: {a: ms(T2) + 1}};
    const r = cloudMerge({profile: prof, workouts: []}, meta, {workouts: [rw("a", T2)], profile: {data: prof, updated_at: T1}});
    return r.workouts.length === 0 && r.del.join() === "a" || JSON.stringify(r);
  });
  t("profile: a newer local edit is pushed, an older one is replaced", () => {
    const local = {...prof, bw: 90};
    const a = cloudMerge({profile: local, workouts: []}, {...empty(), since: T1, dp: ms(T2) + 1}, {workouts: [], profile: {data: prof, updated_at: T2}});
    const b = cloudMerge({profile: local, workouts: []}, {...empty(), since: T1, dp: ms(T1)}, {workouts: [], profile: {data: prof, updated_at: T2}});
    return a.pushP && a.profile.bw === 90 && !b.pushP && b.profile.bw === 80 && b.meta.dp === 0 || JSON.stringify([a, b]);
  });
  t("untrusted server rows: bad id, bad date and junk are dropped; the row id wins over the data id", () => {
    const bad = [rw("ok", T1, {data: {...w("zzz")}}), rw("x<y", T1), rw("d", T1, {data: w("d", "not-a-date")}), {id: "n", data: null, deleted: false, updated_at: T1}];
    const r = cloudMerge({profile: prof, workouts: []}, {...empty(), since: T1}, {workouts: bad, profile: {data: prof, updated_at: T1}});
    return r.workouts.map(x => x.id).join() === "ok" || JSON.stringify(r.workouts.map(x => x.id));
  });
  t("an unreadable server profile never replaces a good local one", () => {
    const r = cloudMerge({profile: prof, workouts: []}, {...empty(), since: T1}, {workouts: [], profile: {data: {name: "", bw: 5}, updated_at: T2}});
    return r.profile.name === "Артём" && r.pushP || JSON.stringify(r);
  });
  t("merge does not change its inputs", () => {
    const meta = {...empty(), dw: {a: 5}}, local = {profile: prof, workouts: [w("a")]}, before = JSON.stringify([meta, local]);
    cloudMerge(local, meta, {workouts: [rw("a", T2)], profile: null});
    return JSON.stringify([meta, local]) === before || "inputs were mutated";
  });
  return out;
}
