// Runs all tests/*.test.js under Node, with a tiny stand-in for the browser. Usage: node tests/run-node.mjs
// No dependencies. The app is one inline script in index.html; it is executed in a vm context with stubs.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const src = html.split("<script>")[1].split("</script>")[0];

const el = () => new Proxy(function () {}, {
  get: (t, k) => k === "classList" ? {contains() { return false }, toggle() {}, add() {}, remove() {}}
    : k === "dataset" || k === "style" ? {} : (k in t ? t[k] : () => el()),
  set: () => true,
});
const store = new Map();
const ctx = {
  document: {querySelector: () => el(), getElementById: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el()},
  localStorage: {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)},
  navigator: {}, Intl, console, setTimeout, innerWidth: 400, innerHeight: 800,
  addEventListener() {}, scrollTo() {}, matchMedia: () => ({matches: false}),
  File, URL, AbortController, Date, Math, JSON, Object, Array, Set, Map, String, Number, Promise, parseInt, parseFloat, isNaN, isFinite,
};
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
await new Promise(r => setTimeout(r, 200));
globalThis.window = ctx;

let total = 0, failed = 0;
const files = fs.readdirSync(path.join(root, "tests")).filter(f => f.endsWith(".test.js")).sort();
for (const f of files) {
  const res = await (await import(pathToFileURL(path.join(root, "tests", f)).href)).run();
  const bad = res.filter(r => !r.pass);
  total += res.length; failed += bad.length;
  console.log(`${f}: ${res.length - bad.length}/${res.length}`);
  for (const b of bad) console.log(`  FAIL ${b.name}: ${String(b.detail).slice(0, 200)}`);
}
console.log(failed ? `\n${failed} of ${total} failed` : `\nall ${total} passed`);
process.exit(failed ? 1 : 0);
