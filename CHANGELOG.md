# Änderungen

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
