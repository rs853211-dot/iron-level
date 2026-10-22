# JSON-Export und -Import: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profil und Trainingsjournal als JSON-Datei sichern und auf demselben oder einem neuen Gerät wiederherstellen.

**Architecture:** Alles bleibt in `index.html`. Ein neuer Abschnitt `/* ---------- backup ---------- */` direkt nach `draft` (Zeile ~336) enthält zwei reine Funktionen (`makeBackup`, `parseBackup`), dazu kommen `downloadBackup` und `applyImport`. `store` bekommt `replaceAll`. Import ersetzt den Datenstand komplett, nach einer Bestätigung im bestehenden `S.confirm`-Muster. Nur auf dem Onboarding-Bildschirm (noch kein Profil) wird ohne Rückfrage übernommen.

**Tech Stack:** Vanilla JS ohne Build, File API, Web Share API (Level 2, Dateien), `localStorage`. Tests als ES-Modul, das im Browser gegen `window.ironLevelBackup` läuft.

**Spec:** `CLAUDE.md` → „Возможные следующие шаги“, Punkt 1, sowie das Gespräch vom 2026-10-22: Daten liegen nur in `localStorage` eines Geräts, Export/Import soll vor Datenverlust schützen und den Umzug auf ein neues Gerät ermöglichen.

## Global Constraints

- Kein Build, keine Abhängigkeiten. Alles App-Code bleibt in `index.html`. Neue Dateien nur für Tests und `.claude/launch.json`.
- UI-Texte auf Russisch, Anrede «ты». Keine Großbuchstaben-Labels, keine Emojis, keine Icons.
- Buttons: Hauptaktion weiße Pille (`btn primary`), sonst grau (`btn`). Destruktive Bestätigung `btn danger`, Abbrechen `btn ghost`. Gelb `#f2c230` nicht auf Buttons. Mindesthöhe 44px (die vorhandene `.btn`-Klasse erfüllt das).
- Datenmodell aus `CLAUDE.md` unverändert: `profile` und `workout` werden 1:1 gespeichert. Abgeleitetes (XP, Level, Rekorde) kommt **nicht** in die Datei, `derive()` berechnet es neu.
- Exercise-IDs nie umbenennen. Unbekannte `ex`-IDs im Import behalten (`derive()` überspringt sie bereits mit `if(!e) continue`).
- Dateiformat v1: `{"app":"iron-level","version":1,"exportedAt":"<ISO-8601>","profile":{…},"workouts":[…]}`.
- Dateiname: `iron-level-YYYY-MM-DD.json` (Datum über `today()`).
- Lokaler Server unter Windows: `python -m http.server 8000` (`python3` ist auf diesem Rechner der Microsoft-Store-Platzhalter).

## Review Focus

1. **Neues Gerät ohne Profil:** Die Wiederherstellung muss vom Onboarding-Bildschirm aus gehen. Sonst kommt man nie zum Profil-Tab, ohne vorher einen Wegwerf-Charakter anzulegen. → Task 3, Schritt 6
2. **Eigene Geräte in `profile.custom`:** Nach dem Import erscheinen sie im Katalog und zählen für XP. `render()` ruft schon `rebuildEx()` auf, also muss `applyImport` nur `S.profile` vor `render()` setzen. → Task 3, Schritt 7
3. **Export bei aktivem Demo-Modus:** Die Datei darf keine Demo-Trainings enthalten (`S.demo` → `workouts: []`). → Task 1, Test `demo-excluded`
4. **Teilen-Dialog auf dem iPhone abgebrochen:** `navigator.share` wirft dann `AbortError`. Keine Fehlermeldung, kein Fallback-Download. → Task 2, Schritt 4
5. **Doppelte Workout-IDs in der Datei** (z. B. von Hand zusammenkopiert): Nur die erste behalten und als übersprungen zählen. Sonst verdoppelt sich XP. → Task 1, Test `dup-ids`

---

### Task 1: `makeBackup` und `parseBackup` mit Browser-Tests

**Files:**
- Create: `.claude/launch.json`
- Create: `tests/backup.test.js`
- Modify: `index.html` (neuer Abschnitt nach Zeile 335, Export auf `window` vor dem Boot-Block, Zeile ~950)

**Interfaces:**
- Produces:
  - `makeBackup(profile: object, workouts: array, demo: boolean) -> {app:"iron-level", version:1, exportedAt:string, profile, workouts}`. Bei `demo === true` ist `workouts` ein leeres Array.
  - `parseBackup(text: string) -> {ok:true, profile:object, workouts:array, skipped:number} | {ok:false, error:string}`. `error` ist ein fertiger russischer Text für `toast()`.
  - `window.ironLevelBackup = {makeBackup, parseBackup}`: nur für Tests, ohne Wirkung auf die App.
  - `tests/backup.test.js` exportiert `async function run() -> Array<{name:string, pass:boolean, detail:string}>`.

- [ ] **Step 1: Server-Konfiguration anlegen**

`.claude/launch.json` mit einer Konfiguration `{"name":"iron-level","runtimeExecutable":"python","runtimeArgs":["-m","http.server","8000"],"port":8000}`.

- [ ] **Step 2: Tests schreiben**

`tests/backup.test.js` mit diesen Fällen. `P` ist ein gültiges Profil `{name:"Тест",sex:"m",bw:80,height:180,age:30,gym:"X",hidden:[],custom:[{id:"c-1",n:"Мой",g:"chest"}],createdAt:"2026-01-01"}`, `W` ist `[{id:"a",date:"2026-10-01",t:1,exercises:[{ex:"hs-bench",sets:[{w:"80",r:"5"}]}]}]`.

```js
const {makeBackup:mk, parseBackup:pb} = window.ironLevelBackup;
const S = o => JSON.stringify(o);
// roundtrip:        pb(S(mk(P,W,false)))  → ok, profile deepEqual P, workouts deepEqual W, skipped 0
// header:           mk(P,W,false).app === "iron-level" && .version === 1 && typeof .exportedAt === "string"
// demo-excluded:    mk(P,W,true).workouts.length === 0
// bad-json:         pb("{nope").ok === false && error === "Не получилось прочитать файл. Это точно JSON из Iron Level?"
// wrong-app:        pb(S({app:"other",profile:P,workouts:W})).error === "Это файл не из Iron Level"
// newer-version:    pb(S({app:"iron-level",version:2,profile:P,workouts:W})).error === "Файл из более новой версии Iron Level. Обнови страницу и попробуй снова"
// no-profile:       pb(S({workouts:W})).error === "В файле нет профиля персонажа"
// bad-bw:           pb(S({profile:{...P,bw:5},workouts:W})).error === "В файле нет профиля персонажа"
// no-workouts:      pb(S({profile:P})).error === "В файле нет журнала тренировок"
// raw-localstorage: pb(S({profile:P,workouts:W})).ok === true      // ohne Header, wie der Wert von "ironlevel.v1"
// bad-date-skipped: pb(S({profile:P,workouts:[...W,{id:"b",date:"01.10.2026",exercises:[]}]})) → ok, workouts.length 1, skipped 1
// dup-ids:          pb(S({profile:P,workouts:[W[0],{...W[0],t:2}]})) → workouts.length 1, workouts[0].t === 1, skipped 1
// sets-as-strings:  pb(S({profile:P,workouts:[{id:"c",date:"2026-10-02",exercises:[{ex:"squat",sets:[{w:100,r:5}]}]}]})).workouts[0].exercises[0].sets[0] deepEqual {w:"100",r:"5"}
// unknown-ex-kept:  pb(S({profile:P,workouts:[{id:"d",date:"2026-10-03",exercises:[{ex:"gone",sets:[{w:"1",r:"1"}]}]}]})).workouts.length === 1
// profile-defaults: pb(S({profile:{name:"A",bw:70},workouts:[]})).profile → sex "m", hidden [], custom []
```

`deepEqual` über `JSON.stringify` mit sortierten Schlüsseln. `run()` gibt für jeden Fall ein Ergebnis zurück und bricht bei einem Fehler nicht ab.

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

`preview_start` mit `iron-level`, `http://localhost:8000` öffnen, dann im Browser ausführen:
`(await import('/tests/backup.test.js?'+Date.now())).run()`
Erwartet: Fehler `Cannot destructure property 'makeBackup' of 'window.ironLevelBackup' as it is undefined`.

- [ ] **Step 4: `makeBackup` und `parseBackup` in `index.html` implementieren**

`parseBackup`-Regeln, in dieser Reihenfolge:
1. `JSON.parse` wirft → Fehler `bad-json`.
2. Kein Objekt, oder `app` vorhanden und `!== "iron-level"` → `wrong-app`.
3. `version > 1` → `newer-version`.
4. `profile` kein Objekt, `name` kein nicht-leerer String oder `bw` keine Zahl in (25, 300) → `no-profile`.
5. `workouts` kein Array → `no-workouts`.
6. Workouts einzeln prüfen: `id` String, `date` passt auf `/^\d{4}-\d{2}-\d{2}$/`, `exercises` Array. Ungültige oder doppelte IDs überspringen und zählen. Bei Exercises nur `{ex:String, sets:Array}` behalten. Sets auf `{w:String(s.w??"0"), r:String(s.r??"0")}` normalisieren. `t` übernehmen, falls Zahl.
7. Profil normalisieren: `sex` ∈ {"m","f"} sonst `"m"`, `hidden` Array von Strings sonst `[]`, `custom` nur Einträge mit String-`id`/`n`/`g` sonst `[]`. Übrige Felder unverändert übernehmen.

`window.ironLevelBackup={makeBackup,parseBackup}` direkt vor `/* ---------- boot ---------- */` setzen.

- [ ] **Step 5: Tests erneut ausführen**

Gleicher Aufruf wie in Step 3. Erwartet: alle 15 Einträge `pass: true`.

- [ ] **Step 6: Commit**

```bash
git add .claude/launch.json tests/backup.test.js index.html
git commit -m "feat: backup format with makeBackup/parseBackup and browser tests"
```

---

### Task 2: Export-Button

**Files:**
- Modify: `index.html`: `viewProfile()`-Karte „Данные“ (Zeile ~809–813), Klick-Switch (Zeile ~885–923), Backup-Abschnitt aus Task 1

**Interfaces:**
- Consumes: `makeBackup(profile, workouts, demo)` aus Task 1
- Produces: `async function downloadBackup() -> void`, Aktion `data-act="exp"`

- [ ] **Step 1: Button in die Karte „Данные“ einbauen**

Unter dem Beschreibungstext, vor den Demo-Buttons: `<div class="row"><button class="btn" data-act="exp">Сохранить в файл</button></div>`. Der Import-Button aus Task 3 kommt später in dieselbe Zeile. Den Text bei `store.mode==="local"` ergänzen: `… они пропадут. Сохраняй копию в файл время от времени.`

- [ ] **Step 2: `downloadBackup()` implementieren**

JSON mit 2 Leerzeichen Einrückung, `new File([json], name, {type:"application/json"})`.
- Wenn `navigator.canShare?.({files:[file]})`: `await navigator.share({files:[file]})`. Fängt `AbortError` still ab, bei anderen Fehlern Fallback wie unten.
- Sonst: Blob-URL, unsichtbares `<a download=name>`, `click()`, `URL.revokeObjectURL` nach Tick, `toast("Файл сохранён: "+name)`.

- [ ] **Step 3: `case "exp": downloadBackup(); break;` im Switch ergänzen**

- [ ] **Step 4: Im Browser prüfen**

Desktop-Browser (kein `canShare` mit Dateien): Demo laden, Profil → „Сохранить в файл“ → Toast `Файл сохранён: iron-level-<heute>.json`. Inhalt abfangen, bevor man klickt: `const o=URL.createObjectURL; window.__b=null; URL.createObjectURL=b=>{window.__b=b; return o(b)}`. Dann `JSON.parse(await __b.text())` prüfen: `workouts.length === 0` (Demo ausgeschlossen). Danach eine echte Test-Trainingseinheit anlegen, erneut exportieren: `workouts.length === 1`.
Abbruch-Pfad: `navigator.share=async()=>{throw new DOMException("x","AbortError")}; navigator.canShare=()=>true;` setzen, Button klicken → kein Toast, keine Konsolenfehler.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: export profile and workouts to a JSON file"
```

---

### Task 3: Import mit Bestätigung, auch beim Onboarding

**Files:**
- Modify: `index.html`: `store` (Zeile ~294–331), `S` (Zeile 338), `viewProfile()`, `viewOnboard()` (Zeile ~492–510), Klick-Switch inkl. Ausnahmeliste in Zeile 884, `change`-Listener (Zeile ~925)
- Modify: `CLAUDE.md`: Abschnitt „Как устроено сейчас“ und „Возможные следующие шаги“

**Interfaces:**
- Consumes: `parseBackup(text)` aus Task 1
- Produces:
  - `store.replaceAll(profile: object, workouts: array) -> Promise<boolean>`: `false`, wenn nicht gespeichert werden konnte
  - `async function applyImport(data: {profile, workouts}) -> void`
  - Zustand `S.pendingImport: {profile, workouts, skipped} | null`, Bestätigung über `S.confirm === "import"`
  - Aktionen `imp-open`, `imp-yes`, `imp-no`, verstecktes `<input type="file" id="imp-file">`

- [ ] **Step 1: `store.replaceAll` implementieren**

- `mode==="db"`: Profil setzen, bestehende Workout-Dokumente laden, IDs löschen, die nicht im Import vorkommen, jedes importierte Workout setzen. Bei Fehler: `toast("Не получилось загрузить в хранилище. Проверь сеть")` und `false`.
- Lokal: `localStorage.setItem(LS, …)` **ohne** stilles Verschlucken. Bei Ausnahme `toast("В браузере не хватило места для этих данных")` und `false`.

- [ ] **Step 2: Import-Button und Dateifeld in „Данные“ einbauen**

In die Zeile aus Task 2: `<button class="btn" data-act="imp-open">Загрузить из файла</button>`, dazu am Kartenende `<input type="file" id="imp-file" accept=".json,application/json" hidden>`.
Bei `S.confirm==="import"` darunter:
`<p class="meta">В файле ${n} ${plural(n,"тренировка","тренировки","тренировок")}${skipped?`, ${skipped} пропущено`:""}. Сейчас записано ${m}: они будут заменены.</p>` und die Zeile `<button class="btn danger" data-act="imp-yes">Заменить</button><button class="btn ghost" data-act="imp-no">Отмена</button>`.

- [ ] **Step 3: Datei lesen**

`imp-open` → `$("#imp-file").click()`. Im `change`-Listener zuerst `if(el.id==="imp-file")` behandeln: `await el.files[0].text()`, `el.value=""` (damit dieselbe Datei erneut gewählt werden kann), `parseBackup`. Bei `!ok` → `toast(error)`. Bei `ok` und `!S.profile` → direkt `applyImport`. Sonst `S.pendingImport=…; S.confirm="import"; render()`.

- [ ] **Step 4: `applyImport` implementieren**

Reihenfolge: `S.profile`, `S.workouts` setzen, `S.demo=false`, `S.coach=null`, `S.summary=null`, `S.confirm=null`, `S.pendingImport=null`. Dann `await store.replaceAll(...)`, `S.tab="home"`, `render()`, `window.scrollTo(0,0)`, `toast(\`Загружено: ${n} ${plural(n,"тренировка","тренировки","тренировок")}\`)`. Bei `false` von `replaceAll` den Toast aus Step 1 stehen lassen (kein Erfolgs-Toast). Ein laufender Entwurf (`S.active`, `draft`) bleibt unangetastet.

- [ ] **Step 5: Switch ergänzen**

`case "imp-open"`, `case "imp-yes": applyImport(S.pendingImport)`, `case "imp-no": S.pendingImport=null; render()`. In Zeile 884 `"imp-yes"` zur Ausnahmeliste hinzufügen, damit `S.confirm` beim Bestätigen nicht vorher gelöscht wird.

- [ ] **Step 6: Wiederherstellung beim Onboarding**

In `viewOnboard()` unter „Создать персонажа“: `<button class="btn ghost block" data-act="imp-open">Восстановить из файла</button>` plus dasselbe versteckte `#imp-file`.

- [ ] **Step 7: Im Browser prüfen**

Testdateien liefert `JSON.stringify(window.ironLevelBackup.makeBackup(P,W,false))` mit den `P`/`W` aus Task 1. Ins Dateifeld bringen über `DataTransfer` + `dispatchEvent(new Event("change",{bubbles:true}))`.
1. `localStorage.clear()`, neu laden → Onboarding → Import → Startbildschirm mit Name „Тест“, Profil-Tab „Мой зал“ zeigt das eigene Gerät „Мой“, XP > 0.
2. Mit vorhandenen Daten importieren → Bestätigungstext mit korrekten Zahlen → „Отмена“ → nichts geändert. Erneut → „Заменить“ → Toast `Загружено: 1 тренировка`, nach Neuladen weiterhin da.
3. Datei mit `{"app":"other"}` → Toast `Это файл не из Iron Level`, Daten unverändert.
4. Dieselbe Datei zweimal hintereinander wählen → zweites Mal öffnet sich die Bestätigung wieder.
5. `tests/backup.test.js` erneut → alle grün.

- [ ] **Step 8: `CLAUDE.md` aktualisieren**

Unter „Как устроено сейчас“ eine Zeile: Резервная копия: «Профиль → Данные» сохраняет JSON (`{app, version:1, exportedAt, profile, workouts}`), загрузка заменяет все данные; проверка файла — `parseBackup()`, тесты — `tests/backup.test.js`. Punkt 1 aus „Возможные следующие шаги“ streichen und die übrigen neu nummerieren.

- [ ] **Step 9: Commit**

```bash
git add index.html CLAUDE.md
git commit -m "feat: import a JSON backup, also from onboarding"
```
