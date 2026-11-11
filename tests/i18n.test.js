// Tests for the languages (Russian source text, English and German in TR). Run on http://localhost:8000:
//   (await import('/tests/i18n.test.js?'+Date.now())).run()
const {T, plural, guessLang, keys, get, set} = window.ironLevelLang;
const {PROGRAMS} = window.ironLevelPrograms;
const {groupRank} = window.ironLevelInsights;

const S = o => JSON.stringify(o);
const CYR = /[А-Яа-яЁё]/;
const holes = s => (s.match(/\{\d\}/g) || []).sort().join();
/* every case leaves the app in Russian, the language the other test files expect */
const inLang = (l, fn) => { set(l); try { return fn(); } finally { set("ru"); } };

const cases = {
  "starts-russian-in-tests": () => get() === "ru",
  "ru-is-the-source": () => T("Сегодня") === "Сегодня" && T("{0} из {1}", 2, 5) === "2 из 5",
  "note-is-hidden": () => T("Отменить@@undo") === "Отменить" && inLang("en", () => T("Отменить@@undo")) === "Undo",
  "en-de-basic": () => inLang("en", () => T("Сегодня")) === "Today" && inLang("de", () => T("Сегодня")) === "Heute",
  "args-filled": () => inLang("en", () => T("{0} из {1}", 2, 5)) === "2 of 5" && inLang("de", () => T("{0} из {1}", 2, 5)) === "2 von 5",
  "unknown-stays": () => inLang("en", () => T("Нет такого ключа")) === "Нет такого ключа",
  /* a translation that drops or invents a {n} would lose a number on screen */
  "placeholders-match": () => { const bad = [];
    for (const l of ["en", "de"]) inLang(l, () => { for (const k of keys) if (holes(k) !== holes(T(k))) bad.push(l + ": " + k); });
    return bad.length === 0 || bad; },
  /* German is complete; English may leave the note under a brand machine empty (it would repeat the English name) */
  "no-russian-left": () => { const bad = [];
    inLang("de", () => { for (const k of keys) if (CYR.test(T(k))) bad.push("de: " + k); });
    inLang("en", () => { for (const k of keys) if (CYR.test(T(k)) && /^[А-ЯЁ{«]/.test(k)) bad.push("en: " + k); });
    return bad.length === 0 || bad; },
  "plural-ru": () => [1, 2, 5, 11, 21].map(n => plural(n, "подход", "подхода", "подходов")).join() === "подход,подхода,подходов,подходов,подход",
  "plural-en-de": () => inLang("en", () => plural(1, "подход", "подхода", "подходов") + plural(4, "подход", "подхода", "подходов")) === "setsets"
    && inLang("de", () => plural(1, "тренировка", "тренировки", "тренировок") + " " + plural(0, "тренировка", "тренировки", "тренировок")) === "Training Trainings",
  "guess-saved-wins": () => guessLang("de", true, "ru-RU") === "de" && guessLang("en", false, "de-DE") === "en",
  "guess-existing-data-stays-russian": () => guessLang(null, true, "de-DE") === "ru",
  "guess-by-browser": () => guessLang(null, false, "de-AT") === "de" && guessLang(null, false, "ru") === "ru" && guessLang(null, false, "fr-FR") === "en" && guessLang(null, false, undefined) === "ru",
  "guess-rejects-junk": () => guessLang("constructor", false, "en-US") === "en" && guessLang("xx", false, "de") === "de",
  "tables-follow-and-return": () => { const ru = PROGRAMS[0].n, day = PROGRAMS[0].days[0].n;
    const en = inLang("en", () => PROGRAMS[0].n + "|" + PROGRAMS[0].days[0].n);
    return ru === "Фулбади" && en === "Full body|Workout A" && PROGRAMS[0].n === ru && PROGRAMS[0].days[0].n === day || [ru, en, PROGRAMS[0].n]; },
  /* rank names stay Russian in the data (tests and RANK_GEN use them); they are translated where they are shown */
  "rank-names-stay-source": () => inLang("de", () => groupRank(0).name) === "Бронза",
};

export async function run() {
  return Object.entries(cases).map(([name, fn]) => {
    try { const v = fn(); return {name, pass: v === true, detail: v === true ? "" : S(v)}; }
    catch (e) { return {name, pass: false, detail: String(e)}; }
  });
}
