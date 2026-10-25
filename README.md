# WATTest – Stimmt WATT?

WATTest prüft Exporte der App WATT im Browser: ob die Arbeitszeitkette intakt ist, ob die Daten zur Kette passen, ob vorhandene Anker (Prüfvermerk bzw. QR-Code `watt-pruef:1`) passen, ob die Kette vom echten WATT auf einem bestätigten Gerät stammt (Signatur und Android Key Attestation, ab Datenformat 19) und ob Nachweiskette und Dokumente eines Aktenauszugs unverändert sind.

**Seite:** https://aves83.github.io/wattest/ · **Einzeldatei zum Herunterladen:** unter [Releases](https://github.com/Aves83/wattest/releases)

## Was WATTest ist – und was nicht

- WATTest prüft **Unverändertheit und Herkunft**, nicht die Richtigkeit der Inhalte. Eine Selbstaufzeichnung bleibt eine Selbstaufzeichnung.
- WATTest bewertet nichts: keine Auswertung von Arbeitszeiten, kein Soll, keine Rechtsfolgen.
- Alles geschieht im Browser. Keine Datei und keine Eingabe verlässt den Rechner; es gibt keine Cookies, kein Tracking und keine fremden Quellen.
- WATTest enthält keinen Code von WATT. Es ist allein nach den Unterlagen von WATT gebaut (Technische Erläuterung, Datenformat, Schemas) und wird mit deren Rechenbeispielen und Beispieldateien geprüft.

## Benutzung

1. Dateien wählen oder in die Seite ziehen: vollständiger Klartext-Export (JSON ab Formatversion 16, XML ab 18 oder ZIP mit `anhaenge/`) und, wenn vorhanden, Aktenauszug (ZIP mit `SHA256SUMS.txt`).
2. Anker eingeben, wenn vorhanden: Inhalt des QR-Codes (`watt-pruef:1;…`), den Wortlaut des Prüfvermerks oder Anzahl, Stand und Prüfsumme von Hand. Wo der Browser es kann, lässt sich der QR-Code mit der Kamera scannen.
3. „Prüfen“. Der Befund ist eine Liste einfacher Aussagen:
   - ✓ (blau) bestätigt
   - ? (gelb) nicht bestätigbar – die Prüfung ist nicht möglich oder nicht aussagekräftig
   - ✗ (rot) widerlegt
   - i (grau) Hinweis, ohne Einfluss auf das Gesamtergebnis

   Zu jeder Aussage lassen sich Begründung, Fundstelle und Grenze aufklappen. Ein Prüffehler ist nie ✗.
4. „Befund drucken“ ergibt eine Druckfassung mit Prüfdatum, Version, Prüfsummen der Dateien und Stand von Sperrliste und Wurzeln, ohne Inhalte außer Glied-Nummern und Zeitpunkten.

Buchungsdaten (Export im Überblick) und verschlüsselte Sicherungen (`.wattbak`) erkennt WATTest und erklärt, warum sie nicht prüfbar sind.

### Prüfschritte

| Nr. | Schritt | Inhalt |
| --- | --- | --- |
| P1 | Format | Formatversion 16 bis 19, Pflichtfelder und Typen nach dem Schema der Version |
| P2 | Arbeitszeitkette | Prüfsumme jedes Glieds nach 4.2 (sieben bzw. neun Felder), Verkettung, laufende Nummern, Neubeginn nur am Anfang |
| P3 | Daten und Kette | Kette nachspielen (7.) und mit `eintraege` und `abwesenheiten` vergleichen |
| P4 | Zeit | Zeitstempel, Vermerke zur Geräteuhr (8., Schritt 5; Zerlegung bei `uhr_verstellt` nach 4.7), Neustarts, automatische Uhrzeit |
| P5 | Anker | Glied, Prüfsumme, Zeitpunkt und Zähler des Ankers (6.1, 6.2) |
| P6 | Signaturen | `watt-kopf-1:<hash>` mit dem Schlüssel des Abschnitts (ab Datenformat 19) |
| P7 | Attestierung | Zertifikatskette bis zu einer Wurzel von Google, Sperrliste, Paketname und Signaturzertifikat der App (Fingerabdruck aus 4.7, Schritt 3), Sicherheitsstufe, RootOfTrust, Challenge |
| P8 | Nachweise | Nachweiskette nach 5.1, Inhalte der Anzeigen und Gesprächsnotizen, Aktenauszug gegen `SHA256SUMS.txt` und gegen die Nachweiskette |
| P9 | Besondere Glieder | Neubeginne (mit Prüfsumme des Bestands nach 4.6), Wiederherstellungen, Löschungen, Änderungen mit Kommentar, Nachträge nach 4.5, eingelesene Buchungen |

## Die Einzeldatei prüfen

Jede Version gibt es als eine einzige HTML-Datei, die ohne Netz läuft (mit Wurzeln und Sperrliste zum Stand des Baus). Ihre SHA-256 steht in `SHA256SUMS.txt` beim Release. Die Einzeldatei auf der Seite (`https://aves83.github.io/wattest/wattest-0.1.2.html`) wird täglich mit frischer Sperrliste neu gebaut; ihre Prüfsumme steht im `SHA256SUMS.txt` der Seite und weicht deshalb von der des Releases ab.

```
sha256sum wattest-0.1.2.html
```

```
Get-FileHash wattest-0.1.2.html -Algorithm SHA256
```

Der Bau ist reproduzierbar: Aus demselben Commit und denselben Daten (`daten/`) entsteht dieselbe Datei.

## Grenzen

Aus Abschnitt 9 der Technischen Erläuterung, unter anderem:

- Ohne Anker ist eine vollständig neue, in sich stimmige Kette nicht erkennbar, ebenso eine am Ende gekürzte Kette.
- Die Zeitstempel stammen von der Uhr des Geräts; eine von Anfang an falsch gehende Uhr fällt nicht auf.
- Die Kette belegt, wann etwas erfasst wurde, nicht, ob es stimmt.
- Eine Signatur belegt die Herkunft aus WATT auf einem Gerät, nicht die Person, die es bediente. Die Bestätigung beruht auf dem Vertrauen in Google und die Gerätehersteller.
- Anhänge an Anzeigen sind kein Teil des Nachweises.
- WATTest prüft nicht das ganze Schema, sondern die Teile, die es liest.

## Unterlagen von WATT

Maßgeblich sind die veröffentlichten Unterlagen von WATT in [Aves83/watt_public](https://github.com/Aves83/watt_public): die [Technische Erläuterung](https://github.com/Aves83/watt_public/blob/main/doc/technische-erlaeuterung.md) und das [Datenformat](https://github.com/Aves83/watt_public/blob/main/doc/datenformat.md) mit den Schemas unter `schema/`. WATTest folgt der Gliederung der Technischen Erläuterung; jede Aussage nennt den Abschnitt (etwa 4.2, 4.7 oder 8., Schritt 5). Unklare Stellen stehen in [docs/UNKLARHEITEN.md](docs/UNKLARHEITEN.md), Entscheidungen in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md), die Spezifikation in [docs/SPEZIFIKATION.md](docs/SPEZIFIKATION.md).

## Bau und Tests

Voraussetzung: Node.js 20 oder neuer. Entwicklungsabhängigkeiten sind nur `typescript` und `esbuild`; zur Laufzeit gibt es keine.

```
npm ci
npm run typecheck
npm test          # node --test auf dem kompilierten Code
npm run build     # nach dist/
npm run daten     # Sperrliste und Wurzeln von Google nach daten/ holen
```

| Ordner | Inhalt |
| --- | --- |
| `src/kern/` | Prüfung ohne DOM: Prüfsummen, Abgleich, Anker, DER/X.509, Attestierung, ZIP, XML |
| `src/worker/` | Web Worker mit Fortschritt |
| `src/ui/` | Seite, Befund, Druckansicht, Impressum, Datenschutz |
| `daten/` | Wurzeln, Sperrliste und Fingerabdruck der App (Technische Erläuterung 4.7, Schritt 3), mit Quelle und Abrufzeitpunkt |
| `tests/` | Testvektoren der Technischen Erläuterung, Beispieldateien von WATT, Erzeuger für Datenformat 19 mit eigenen Testzertifikaten, manipulierte Varianten, Bau und Oberfläche |
| `scripts/` | Bau, Abruf der Daten, Auszüge aus Schemas und XSD, Rechenbeispiele aus der Technischen Erläuterung |

Die Unterlagen von WATT liegen nicht im Repository; `scripts/schema-auszug.mjs` und `scripts/xml-typen.mjs` erzeugen aus Schemas und XSDs die Dateien in `src/kern/`, `scripts/vektoren-holen.mjs` liest die Rechenbeispiele B1 bis B12 aus den Codeblöcken der Technischen Erläuterung nach `tests/vektoren/`.

## Lizenz

WATTest © 2026 Hans-Joachim Steudel, lizenziert unter der [EUPL-1.2](LICENSE) (amtliche deutsche Fassung). Die Beispieldateien unter `tests/beispiele/` sind fiktive Beispieldaten aus der App WATT, ebenfalls unter EUPL-1.2. Die Auszüge aus den Schemas von WATT in `src/kern/` stehen unter CC BY 4.0 (Hans-Joachim Steudel, WATT).

[Impressum](https://aves83.github.io/wattest/impressum.html) · [Datenschutz](https://aves83.github.io/wattest/datenschutz.html)
