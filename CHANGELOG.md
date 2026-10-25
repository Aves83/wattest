# Änderungen

## 0.1.4 – 25.10.2026

- Unterlagen: Technische Erläuterung und Datenformat aus Aves83/watt_public, Commit 37ae281 (Stand 1af17a5 von WATT, Vorabfassung). Rechenbeispiele B1 bis B13 und Schemas inhaltlich unverändert.
- P4 (U-18, geklärt durch TE 4.7 und 8.): Bei `uhr_ruecksprung` mit Uhrstand gilt die Regel der TE zum Bezug. Bei `objektId` mit laufender Nummer hat das auslösende Glied davor `neustarts` größer als 0 oder -1 und der Vermerk selbst 0; bei `timer`, `nachweis`, `start` und `zeitsignal` hat der Vermerk selbst `neustarts` größer als 0 oder -1. Ausnahme: `nachweis` als erstes Glied einer leeren Kette mit 0. Eingespielte Glieder vor einer `wiederherstellung` folgen derselben Regel; ohne Uhrstand entfällt sie. Ein Verstoß ist „?“ mit Glied-Nummer und Begründung, nie ✗; der bisherige Hinweis „uhr_ruecksprung trotz Bezug“ entfällt.
- P4: `uhr_ruecksprung` mit `objektId` `start` oder `zeitsignal` erklärt einen Rücksprung über 2 Minuten (8., Schritt 5); die Liste der Vermerke nennt beide Anlässe.
- U-20: WATT bestätigt die Lesart von E-39, die TE übernimmt sie mit dem nächsten Stand; bis dahin offen. U-21 bleibt offen (Bedeutung von `schritte` ändert sich mit dem nächsten Stand der TE), die Prüfung bleibt wie bisher. Neu offen: U-22 (gleicher Wortlaut „Hinweis zur Klärung“ bei U-15 und U-18, unterschiedlich gewertet).
- Tests: je Fall der Regel zum Bezug, die Ausnahme mit Schlüssel und Challenge, eingespielte Glieder, Glieder ohne Uhrstand, `start` und `zeitsignal` als Erklärung. Der Testerzeuger kann einen Rücksprung mit wählbarem Anlass und wählbaren `neustarts` einfügen (`ruecksprung`).

## 0.1.3 – 25.10.2026

- Unterlagen: Technische Erläuterung und Datenformat aus Aves83/watt_public, Commit 4828c89 (Stand 85a7f6e von WATT). Die Klarstellungen zu U-14 bis U-17 sind übernommen, die Ersatz-Lesarten gestrichen; `docs/UNKLARHEITEN.md` vermerkt je Punkt „geklärt durch TE Abschnitt …“.
- P4 (U-14): `abweichungSekunden` hat ein Vorzeichen (nachher − vorher, ganze Sekunden, zur Null hin gekürzt, negativ bei `zurueck`, Betrag mindestens 120); bei `schritte` die Summe der Beträge mit dem Vorzeichen der Gesamtrichtung, bei genauem Ausgleich `vor`. Ein Betrag bei `richtung` `zurueck` ergibt jetzt „?“.
- P4 (U-15): Liegt der erste Teil der Zerlegung unter −120 Sekunden (Grenze eingeschlossen), bei `schritte` unter 0, gibt WATTest nur einen Hinweis mit `autoZeit` des Glieds, kein „?“ mehr.
- P7 (U-16): Gültigkeit aller Zertifikate zu einem Bezugszeitpunkt, Grenzen eingeschlossen: Zeitpunkt des Glieds `schluessel`, beim Vorratsschlüssel der leeren Kette (Glied mit `challenge`) `creationDateTime` aus der Attestierung, ohne es der Zeitpunkt des Glieds.
- Kanonisches JSON (U-17): Bestandsprüfsummen und Prüfsumme des Datenbestands mit eigener Maskierung nach 4.6 statt `JSON.stringify`; ein einzelnes Ersatzzeichen wird in UTF-8 zu „?“. Neues Rechenbeispiel B13.
- Schemas (U-19): Schema-Auszug und XML-Typtabelle aus `schema/` von watt_public neu erzeugt (Inhalt unverändert, die XSD 17 wird nicht mehr gebraucht). P1 meldet für Formatversion 19 als Hinweis, dass das Schema eine Vorabfassung ist, solange die README es so nennt.
- U-18 bleibt ein Hinweis; TE 8., Schritt 5 ist in 4828c89 unverändert. Neu offen: U-20 (Ersatzzeichen in den übrigen Prüfsummen) und U-21 (Inhalt von `schritte`).
- Tests: B13, Tabelle der Maskierung, Ersatzzeichen, Vorzeichen und Grenzen von `abweichungSekunden`, erster Teil der Zerlegung, Bezugszeitpunkt der Zertifikate mit Grenzfällen, Hinweis auf die Vorabfassung. Der Testerzeuger setzt beim Blattzertifikat die Standardgrenzen von Android (01.01.1970 bis 01.01.2048) und `creationDateTime` wählbar.

## 0.1.2 – 25.10.2026

- Unterlagen: Technische Erläuterung, Datenformat und Schemas liest WATTest jetzt aus dem öffentlichen Repository Aves83/watt_public (Commit 1b52ef6, Inhalt gleich dem bisherigen Stand; die Schemas der Version 19 sind dort noch nicht veröffentlicht, U-19). `scripts/vektoren-holen.mjs` holt die TE von dort; die Rechenbeispiele B1 bis B12 sind unverändert. README und Spezifikation verlinken die beiden Dokumente.
- Startseite: neuer Absatz „Über WATT“ unter der Einleitung, mit Links auf WATT, die Technische Erläuterung und den Quelltext (in neuem Tab).
- Fußzeile: zusätzlich „WATT“ mit Link auf https://aves83.github.io/watt_public/.
- Datenschutzhinweis: Verantwortlicher ohne Anschrift. Das Impressum bleibt unverändert.
- P4: Hinweis, wenn ein Glied `uhr_ruecksprung` in einem Abschnitt steht, in dem nach 8., Schritt 5 ein Bezug bestand (vorangehendes Glied mit Uhrstand, `neustarts` 0 bis zum Vermerk); keine ✗ (U-18).
- Tests: Absatz „Über WATT“, Datenschutzhinweis, neue Links im Test „keine fremden Adressen“, CSP ohne fremde Herkunft, Hinweis zu U-18.

## 0.1.1 – 25.10.2026

Erste veröffentlichte Version. Grundlage ist die Technische Erläuterung von WATT vom 25.10.2026 (Markdown); sie klärt die Punkte aus `docs/UNKLARHEITEN.md`.

- P5: Der Zähler `i` des QR-Codes zählt die Anlage-Glieder `eintrag` und `abwesenheit` mit `importDatei` (6.2); die zweite Lesart entfällt.
- P1: XML der Formatversionen 16 und 17 ergibt „?“ („WATT exportiert XML erst ab Formatversion 18.“).
- P8: In die Prüfsumme einer Anzeige gehen nur Notizen mit `fest` true ein, sortiert nach `erstelltAm` und Kennung (5.1); die zweite Lesart entfällt.
- P4: Rücksprünge nach 8., Schritt 5 (auch `uhr_ruecksprung` mit `nachweis` und `uhr_verstellt` mit `richtung` `zurueck`); Zerlegung des Zeitsprungs je `uhr_verstellt` nach 4.7.
- P7: Challenge mit der Ausnahme `uhr_verstellt` mit `objektId` `glied` vor dem Glied `schluessel`; Fingerabdruck des App-Signaturzertifikats aus 4.7, Schritt 3 in `daten/app-signatur.json`, die Teilaussage ist damit ✓ oder ✗.
- P9: Nachträge nach 4.5 (Erfassung, Änderung und Einlesen getrennt, bis 96 Stunden in Stunden, darüber in Tagen, „laut Datei“, „Importiert am“); Prüfsumme des Bestands beim Neubeginn aus einem JSON-Export nachgerechnet (4.6).
- Rechenbeispiele B1 bis B12 aus den Codeblöcken der Technischen Erläuterung neu eingelesen (`scripts/vektoren-holen.mjs`), unverändert.
- Erzeuger für Datenformat 19: Schlüssel nach vorhandenen Gliedern, mit und ohne `uhr_verstellt` davor.

## 0.1.0 – 25.10.2026

Interne erste Fassung, nicht mehr als Release veröffentlicht.

- Prüfschritte P1 bis P9 nach Spezifikation, Abschnitt 5: Format, Arbeitszeitkette (sieben und neun Felder), Abgleich der Daten mit der Kette, Zeit, Anker, Signaturen, Attestierung, Nachweiskette und Aktenauszug, besondere Glieder.
- Eingaben: Klartext-Export als JSON (Datenformat 16 bis 19), XML (17 bis 19) und ZIP mit `anhaenge/`, Aktenauszug mit `SHA256SUMS.txt`; Buchungsdaten und `.wattbak` werden erkannt und erklärt.
- Anker als QR-Inhalt, Wortlaut des Prüfvermerks oder von Hand; QR mit der Kamera, wo der Browser `BarcodeDetector` anbietet.
- Befund mit ✓, ?, ✗ und Hinweisen, Begründung, Fundstelle und Grenze; Druckansicht.
- Prüfung im Web Worker mit Fortschritt; 10.000 Glieder mit Signaturen in Node in etwa 2 Sekunden.
- Seite auf GitHub Pages mit Service Worker, täglich frischer Sperrliste; Einzeldatei `wattest-0.1.0.html`, die ohne Netz läuft; reproduzierbarer Bau mit CSP-Hashes.
- Tests: Rechenbeispiele B1 bis B12 der Technischen Erläuterung, Beispieldateien `apfel-16`, `bergamotte-17`, `cherimoya-18`, Erzeuger für Datenformat 19 mit eigenen Testzertifikaten, manipulierte Varianten je Prüfschritt, Bau und Oberfläche.
