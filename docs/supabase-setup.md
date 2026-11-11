# Supabase einrichten (einmalig, ca. 10 Minuten)

Ohne diese Schritte bleibt die Cloud-Synchronisation aus: In `index.html` stehen `CLOUD.url` und `CLOUD.key` leer, die Karte «Облако» im Profil erscheint nicht, die App arbeitet wie bisher nur lokal.

## 1. Projekt anlegen

1. Auf https://supabase.com mit GitHub oder E-Mail anmelden (kostenloser Plan genügt).
2. «New project»: Name `iron-level`, ein starkes Datenbank-Passwort (im Passwortmanager ablegen, die App braucht es nicht), **Region: Central EU (Frankfurt)**. Die EU-Region ist wichtig für die DSGVO.
3. Warten, bis das Projekt bereit ist (ca. 2 Minuten).

## 2. Tabellen und Zugriffsregeln erzeugen

1. Links «SQL Editor» → «New query».
2. Den gesamten Inhalt von `supabase/schema.sql` einfügen und «Run» drücken. Das Skript darf beliebig oft laufen.
3. Unter «Table Editor» müssen jetzt `profiles` und `workouts` stehen, jeweils mit dem Hinweis «RLS enabled». Ohne diese Regeln würde jeder Nutzer fremde Daten sehen, deshalb nicht überspringen.

## 3. Anmeldung per Code einstellen

Die App meldet per **Code aus der E-Mail** an, nicht per Link (ein Link würde in Safari statt in der Home-Bildschirm-App öffnen).

1. «Authentication» → «Sign In / Providers»: «Email» ist aktiv, «Confirm email» kann an bleiben.
2. «Authentication» → «Email Templates» → «Magic Link»: Den Text so ändern, dass er den Code enthält, zum Beispiel:
   `Dein Code für Iron Level: {{ .Token }}`
   (Auch das Template «Confirm signup» gleich ändern, denn der erste Login läuft darüber.)
3. «Authentication» → «URL Configuration»: Als «Site URL» `https://rs853211-dot.github.io/iron-level/` eintragen.
4. Hinweis zum Versand: Der eingebaute Mailversand von Supabase ist stark begrenzt (wenige Mails pro Stunde) und liefert nur an Adressen im Projektteam. Für dich als Besitzer reicht das. Für Gym-Kunden (Version 2.0) braucht es einen eigenen SMTP-Dienst, zum Beispiel Resend (kostenloser Plan vorhanden).

## 4. Schlüssel in die App eintragen

1. «Project Settings» → «API Keys» (oder «Data API»): **Project URL** (`https://xxxx.supabase.co`) und den **publishable key** (`sb_publishable_…`, älter: `anon`) kopieren.
2. In `index.html` die Zeile `const CLOUD={url:"",key:""};` ausfüllen.
3. **Nie** den `service_role`- oder `secret`-Key eintragen. Der publishable key darf öffentlich im Repo stehen, weil die Zugriffsregeln (RLS) die Daten schützen.

## 5. Prüfen

1. App öffnen → Profil → «Облако» → E-Mail eingeben → «Получить код» → Code eintippen → «Войти».
2. Eine Trainingseinheit speichern. In Supabase unter «Table Editor» → `workouts` erscheint nach wenigen Sekunden eine Zeile.
3. Auf einem zweiten Gerät (oder im Browser) anmelden: Die Daten erscheinen dort.
4. Eine Einheit auf Gerät A löschen: Sie verschwindet auf Gerät B nach der nächsten Synchronisation.

## Kosten

Kostenloser Plan: 500 MB Datenbank und 50 000 aktive Nutzer pro Monat, für diese App um ein Vielfaches mehr als nötig (ein Trainingsjahr wiegt unter 1 MB). Auf dem kostenlosen Plan wird ein Projekt nach einer Woche ohne Aktivität pausiert (die Daten bleiben, ein Klick im Dashboard weckt es auf). Pro-Plan ab ca. 25 USD pro Monat nur bei Bedarf. Preise vor der Entscheidung auf supabase.com/pricing prüfen.

## Wie die Synchronisation funktioniert (Kurzfassung)

- Die App arbeitet immer aus `localStorage` (auch offline im Fitnessstudio). Die Cloud ist eine zweite Kopie.
- Sync: Änderungen seit dem letzten Abruf holen, zusammenführen (eine neuere lokale Änderung gewinnt gegen die Server-Zeile, sonst gewinnt der Server), Geändertes hochladen. Eine gelöschte Einheit wird als «Tombstone» gespeichert, damit das Löschen auch andere Geräte erreicht.
- Zeitstempel auf dem Server setzt die Datenbank, nicht die Uhr des Telefons.
- Die Zusammenführung steht in `cloudMerge()` und ist durch `tests/cloud.test.js` abgesichert.
- Abmelden löscht keine lokalen Daten. Beim nächsten Anmelden wird neu zusammengeführt (Vereinigung beider Seiten).
