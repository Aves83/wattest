# WATTest – Spezifikation (Stand 25.10.2026, Entscheidungen Achim eingearbeitet; umgesetzt in WATTest 0.1.5, siehe Abschnitt 13)

> **Stimmt WATT?** WATTest prüft Exporte der App WATT: ob die Arbeitszeitkette intakt ist, ob sie zu vorhandenen Ankern passt, ob die Daten zur Kette passen und, ab WATT „D“, ob die Kette vom echten WATT auf einem bestätigten Gerät stammt.

## 1. Zweck und Abgrenzung

- WATTest prüft **Unverändertheit und Herkunft**, nicht die Richtigkeit der Inhalte. Eine Selbstaufzeichnung bleibt eine Selbstaufzeichnung.
- WATTest bewertet nichts: keine Auswertung von Arbeitszeiten, kein Soll, keine Rechtsfolgen.
- Zielgruppe: Dienstherr, Schulleitung, Personalrat, Rechtsvertretung, Gutachter:innen; außerdem Lehrkräfte, die ihren eigenen Export vor der Weitergabe prüfen.

## 2. Plattform und Grundsätze

| Punkt | Festlegung |
| --- | --- |
| Form | Progressive Web App auf GitHub Pages (`https://aves83.github.io/wattest/`), installierbar, offline nutzbar |
| Zusätzlich | jede Version als **eine einzelne HTML-Datei** zum Herunterladen, mit veröffentlichter SHA-256; läuft ohne Netz |
| Lizenz | EUPL-1.2 (deutsche Fassung in `LICENSE`), Hinweis in jeder Quelldatei und sichtbar in der Fußzeile: „WATTest © 2026 Hans-Joachim Steudel · EUPL-1.2“ (Jahr der ersten Veröffentlichung, später als Spanne) |
| Datenschutz | Die geprüften Dateien verlassen den Rechner nie. Keine Cookies, kein Tracking, keine fremden Quellen. Content Security Policy `default-src 'self'`; Verbindungen nur zu Dateien derselben Herkunft (Sperrliste, Wurzeln). Eingaben werden nicht gespeichert. |
| Sprache, Barrierefreiheit | Deutsch, Gendern mit Doppelpunkt; WCAG 2.2 AA; Befund nie nur über Farbe. Farben für Rot-Grün-Schwäche: **Blau** = bestätigt, **Gelb** (hell) = nicht bestätigbar, **Rot** (dunkel) = widerlegt; deutlich verschiedene Helligkeit, immer mit Zeichen ✓, ?, ✗ |
| Abhängigkeiten | keine zur Laufzeit; Werkzeuge nur zur Entwicklung (z. B. TypeScript, esbuild) mit freizügiger Lizenz |
| Unabhängigkeit | **Kein Code aus WATT.** Umsetzung allein nach den öffentlichen Unterlagen (Abschnitt 3). Übereinstimmung wird über Testvektoren und Beispieldateien belegt. |

## 3. Maßgebliche Unterlagen

Alle Unterlagen liest WATTest aus dem öffentlichen Repository [Aves83/watt_public](https://github.com/Aves83/watt_public) (seit 25.10.2026), nicht aus dem Repository von WATT; `scripts/vektoren-holen.mjs` holt die Technische Erläuterung von dort.

1. **[Technische Erläuterung für Gutachter:innen](https://github.com/Aves83/watt_public/blob/main/doc/technische-erlaeuterung.md)** (`doc/technische-erlaeuterung.md`, als Markdown, Kopfzeile „WATT-Version: Vorabfassung“; Eingaben, Prüfsummen und Befehle der Rechenbeispiele stehen in Codeblöcken), vor allem 4.1, 4.2 (Prüfsumme der Arbeitszeitkette), 4.5 (Nachträge), 4.6 (Neubeginn, Maskierung in kanonischem JSON), 4.7 (Uhrstand, Schlüssel und Signatur), 5 und 5.1 (Nachweiskette, Prüfsummen der Dokumente), 6.1 und 6.2 (Prüfvermerk, QR-Code `watt-pruef:1`), 7 und 7.1 (Abgleich der Daten mit der Kette, Vorgeschichte, eingelesene Buchungen), 8 (Prüfverfahren), 9 (Grenzen).
2. **[Datenformat](https://github.com/Aves83/watt_public/blob/main/doc/datenformat.md)** (`doc/datenformat.md`) mit JSON-Schema je Formatversion ab 16 und XSD ab 18 (`schema/`; veröffentlicht sind die Versionen ausgelieferter Fassungen, derzeit 16 bis 18, dazu Version 19 als Vorabfassung laut `schema/README.md`, siehe `docs/UNKLARHEITEN.md`, U-19).
3. **Fingerabdruck des App-Signaturzertifikats** von WATT (SHA-256): Technische Erläuterung 4.7, Schritt 3; in `daten/app-signatur.json` (Entscheidung Achim 25.10.2026).
4. **Testvektoren** der Technischen Erläuterung und die **Beispieldateien** je ausgelieferter Version (`apfel-16`, `bergamotte-17`, …) als Konformitätstests.

Voraussetzung: Technische Erläuterung und Datenformat sind öffentlich zugänglich; erfüllt seit 25.10.2026 (Abschnitt 11). Die Beispieldateien in `tests/beispiele/` bleiben unverändert.

## 4. Eingaben

| Eingabe | Unterstützt | Bemerkung |
| --- | --- | --- |
| Vollständiger Klartext-Export JSON | ja, ab Formatversion 16 | Hauptfall |
| Vollständiger Klartext-Export XML | ja, ab Formatversion 18 | gleiche Prüfung; WATT exportiert XML erst ab Formatversion 18 (TE 8., Schritt 1), XML der Version 17 ergibt in P1 „?“ |
| Klartext als ZIP mit `anhaenge/` | ja | Anhänge werden nicht geprüft (nicht in der Nachweiskette), nur aufgelistet |
| Aktenauszug: ZIP mit Originalen und `SHA256SUMS.txt` | ja | Dokumente gegen `SHA256SUMS.txt` und gegen die Prüfsummen der Nachweiskette |
| Anker | ja, beliebig viele | QR-Text `watt-pruef:1;…` (Kamera über `BarcodeDetector`, wo vorhanden, sonst Einfügen), oder von Hand: Anzahl, Stand, Prüfsumme aus dem Prüfvermerk |
| Buchungsdaten (Export im Überblick) | nur Hinweis | enthalten keine Kette, daher nicht prüfbar |
| Verschlüsselte Sicherung `.wattbak` | nein | bräuchte die Passphrase der Lehrkraft |

Dateien werden per Auswahl oder Ziehen geöffnet und nur im Speicher des Browsers gelesen. ZIP über `DecompressionStream('deflate-raw')`, ohne Bibliothek.

## 5. Prüfschritte

Jeder Schritt liefert einen Teilbefund (Abschnitt 6) mit Begründung und Fundstelle (Glied-Nummer, Datei).

| Nr. | Schritt | Inhalt |
| --- | --- | --- |
| P1 | Format | Formatversion erkannt, Datei gegen das Schema ihrer Version gültig; unbekannte Version → „nicht bestätigbar“; Hinweis, solange die README der Schemas die Version als Vorabfassung führt (derzeit 19) |
| P2 | Arbeitszeitkette | Prüfsumme jedes Glieds nach 4.2 neu berechnen (beide kanonischen Formen: ohne und mit `neustarts`/`autoZeit`), Verkettung über `prev`, `seq` lückenlos ab 1, Neubeginn nur als erstes Glied |
| P3 | Daten passen zur Kette | Kette nachspielen nach 7.; der entstehende Stand muss genau `eintraege` und `abwesenheiten` entsprechen; Abweichungen je Eintrag |
| P4 | Zeit | Zeitstempel steigend, als genau eine Aussage je nach Lage (ohne Sprünge; mit Sprüngen, alle vermerkt; Sprung ohne Vermerk ✗, Abschnitt 6); ein Rücksprung über 2 Minuten ist erklärt, wenn unmittelbar ein `uhr_ruecksprung` folgt oder das Glied selbst ein Vermerk zur Uhr ist (`uhr_ruecksprung` mit `objektId` `timer`, `nachweis`, `start` oder `zeitsignal`, `uhr_verstellt` mit `richtung` `zurueck`; 8. Schritt 5); je `uhr_verstellt` die Zerlegung des Zeitsprungs nach 4.7 (`zeitpunkt` = `nachher`; `abweichungSekunden` = `nachher − vorher` in ganzen Sekunden, zur Null hin gekürzt, mit Vorzeichen, Betrag mindestens 120, `richtung` `vor` genau bei positivem Wert; bei `schritte` die Summe der Beträge mit dem Vorzeichen der Gesamtrichtung, bei genauem Ausgleich `vor`); Hinweis, wenn der erste Teil (`vorher` − Zeitpunkt des vorigen Glieds) unter −120 Sekunden liegt, bei `schritte` unter 0; Liste aller `uhr_ruecksprung`, `uhr_abweichung`, `uhr_verstellt`; Summe der `neustarts`; Abschnitte mit `autoZeit` aus; bei `uhr_ruecksprung` mit Uhrstand die Regel zum Bezug nach 4.7 (`objektId` laufende Nummer: auslösendes Glied davor `neustarts` größer als 0 oder -1, Vermerk 0; `timer`, `nachweis`, `start`, `zeitsignal`: Vermerk selbst größer als 0 oder -1; Ausnahme `nachweis` als erstes Glied einer leeren Kette mit 0; eingespielte Glieder ebenso; ohne Uhrstand entfällt die Regel), Verstoß „?“ (U-18) |
| P5 | Anker | Je Anker: Glied mit `seq = n` suchen, `hash = sha256`, Zeitpunkt in Europe/Berlin auf Minuten = `t`; die Zähler `r`, `w`, `wa`, `i` (Anlage-Glieder `eintrag` und `abwesenheit` mit `importDatei`), `s` gegen die Kette bis `n`; Anker ohne passendes Glied → „widerlegt“ bzw. „nicht in dieser Kette“; ohne Anker „?“ mit dem Handlungshinweis „Füge einen Prüfvermerk aus einem Bericht oder einer Anzeige hinzu (Text oder QR-Code), um den Stand daran zu prüfen.“ |
| P6 | Signaturen (ab D) | Signatur je Kopf über `watt-kopf-1:<hash>` mit dem Schlüssel aus dem Glied `schluessel` prüfen; Abschnitte: signiert ab Glied n, eingespielt (vor `wiederherstellung`, Herkunft aus deren eigenen Signaturen), unsigniert, ungültig ab Glied n; Signaturen zu Gliedern, die es nicht gibt, mehrere zu einem Glied, nicht genau lesbare `seq`, nicht lesbare oder zu lange Signaturen und Schlüssel mit unlesbaren Zertifikaten → „?“ mit Fundstelle; vor Datenformat 19 nur ein „?“ (Abschnitt 6) |
| P7 | Attestierung (ab D) | Zertifikatskette bis zu einer Google-Wurzel (alte RSA-Wurzel und „Key Attestation CA1“, ECDSA P-384), Gültigkeit aller Zertifikate zum Bezugszeitpunkt, Grenzen eingeschlossen (Zeitpunkt des Glieds `schluessel`; beim Vorratsschlüssel der leeren Kette, dem Glied mit `challenge`, `creationDateTime` und ohne es der Zeitpunkt des Glieds), keine gesperrten Zertifikate laut Sperrliste (Stand angeben); aus der Erweiterung 1.3.6.1.4.1.11129.2.1.17: Paketname `de.achim.watt` und SHA-256 der App-Signatur = veröffentlichter Fingerabdruck, Sicherheitsstufe TEE oder StrongBox (Software → „nicht bestätigt“), `verifiedBootState` Verified und `deviceLocked`, Challenge = `hash` des Kopfs vor dem Glied `schluessel` (steht dazwischen `uhr_verstellt` mit `objektId` `glied`, der `hash` des Glieds davor), bei leerer Kette die Zufallsbytes in `challenge`; Hinweis, wenn das erste signierte Glied älter ist als das Zwischenzertifikat (grobe Untergrenze); nicht lesbare Zertifikate und Angaben → „?“, nie ✗; vor Datenformat 19 Hinweis „Entfällt (keine Signatur).“ |
| P8 | Nachweiskette | Prüfsummen nach 5.1 neu berechnen (Anzeigen mit den Notizen mit `fest` true, Gesprächsnotizen, Nachträge aus den Inhalten der Datei), Verkettung, Löschvermerke; im Aktenauszug jedes Dokument gegen `SHA256SUMS.txt` und gegen die Kette |
| P9 | Besondere Glieder | Übersicht: Neubeginne mit Angaben zur alten Kette (Prüfsumme des Bestands nachgerechnet, wenn der Export ein JSON unmittelbar nach dem Neubeginn ist, 4.6), Wiederherstellungen mit Vorgeschichte, Löschungen mit Begründung, Änderungen mit Kommentar, Nachträge über 24 h nach 4.5 (Erfassung, Änderung und Einlesen getrennt, bis 96 h in Stunden, darüber in Tagen), eingelesene Buchungen (`importDatei`) |

Rechnen im Web Worker mit Fortschritt in Teilschritten (Live-Region) und „Abbrechen“; Ziel: 10.000 Glieder in wenigen Sekunden auf einem durchschnittlichen Laptop, ohne die Seite zu blockieren. Ausnahmen in einem Schritt werden zu „?“; scheitert die ganze Prüfung, zeigt die Seite einen Befund mit einer Aussage „?“ statt einer leeren Seite. Feste Grenzen für Eingaben in Abschnitt 14.

## 6. Befund

- Der Befund ist eine **Liste einfacher Aussagen**, je Aussage ein Zeichen:
  - ✓ blau: bestätigt
  - ? gelb: nicht bestätigbar (Prüfung nicht möglich oder nicht aussagekräftig, z. B. keine Signaturen, Software-Attestation, Sperrliste nicht verfügbar)
  - ✗ rot: widerlegt
- Beispiele: „Die Kette ist lückenlos und unverändert.“, „Die Daten entsprechen der Kette.“, „Der Anker vom 12.03.2026 passt zur Kette.“, „Die Kette stammt von WATT auf einem bestätigten Gerät.“, „Die Zeitstempel steigen an; die Kette enthält keinen Rücksprung und keine Verstellung der Geräteuhr.“, „Das Gerät wurde 14-mal neu gestartet.“ (Hinweis), „Die Dokumente im Aktenauszug sind unverändert.“
- Zu jeder Aussage aufklappbar: Begründung, Fundstelle (Glied-Nummer, Datei) und Grenze („Über die Zeit vor dem ersten Anker sagt das nichts.“, aus Abschnitt 9 der Technischen Erläuterung).
- Ein Prüffehler ist nie ✗.
- Dazu Hinweise (i, grau) für reine Informationen wie Neustarts; sie beeinflussen die Gesamtzeile nicht (Entscheidung E-1).
- Oben eine Gesamtzeile: ✗, wenn eine Aussage ✗ ist, sonst ?, wenn eine ? ist, sonst ✓.
- Bei „?“ folgt in der Gesamtzeile aus den Ergebnissen, was bestätigt ist und was fehlt (Auftrag 0.1.5, Feldtest 25.10.2026):
  - „Die Datei ist in sich stimmig.“, wenn die Kette bestätigt ist und kein anderes „?“ als die beiden folgenden vorliegt; sonst „Bestätigt sind …; offen bleiben … (siehe die Aussagen mit „?“).“ nach Schritten.
  - Datenformat 16 bis 18 (Formatversion aus der Datei): „WATT signiert erst ab Datenformat 19; dass diese Datei (Datenformat <n>) keine Signatur hat, ist kein negativer Befund.“
  - Ohne Anker: „Den Zeitpunkt bestätigt ein Prüfvermerk aus einem Bericht oder einer Anzeige, wenn du ihn hinzufügst.“
- P4 sagt zu den Zeitstempeln genau eine Aussage: ohne Sprünge „Die Zeitstempel steigen an; die Kette enthält keinen Rücksprung und keine Verstellung der Geräteuhr.“; mit Sprüngen, alle vermerkt: „Die Zeitstempel steigen an. Die Geräteuhr wurde <n>-mal verstellt oder sprang zurück; jeder Fall ist vermerkt (Glied …).“ (gezählt `uhr_ruecksprung` und `uhr_verstellt`; `uhr_abweichung` steht in den Einzelheiten); ein Sprung ohne Vermerk bleibt ✗ mit Fundstelle.
- Datenformat 16 bis 18: P6 einmal „?“ („Diese Fassung von WATT (Datenformat <n>) signiert noch nicht; die Herkunft lässt sich deshalb nicht bestätigen.“), P7 als Hinweis „Entfällt (keine Signatur).“
- Jede Aussage trägt höchstens 200 Einzelheiten; der Rest wird gezählt („… und n weitere.“).
- Druckansicht bzw. PDF über den Browser mit: Prüfdatum, WATTest-Version, SHA-256 jeder geprüften Datei, Stand der Sperrliste und der Wurzeln, allen Teilbefunden. Keine persönlichen Inhalte außer Glied-Nummern und Zeitpunkten.

## 7. Sperrliste und Wurzeln

- Die Sperrliste von Google (`https://android.googleapis.com/attestation/status`) ist vom Browser nicht lesbar (keine CORS-Freigabe, geprüft 24.10.2026).
- Eine GitHub Action im Repository lädt sie täglich und legt sie mit Abrufzeitpunkt als `daten/sperrliste.json` auf die Seite, ohne sie einzuchecken; ebenso die Wurzelzertifikate (`daten/wurzeln.json`, von `https://android.googleapis.com/attestation/root`). Scheitert der Abruf, bleibt der eingecheckte Stand, und der Befund nennt sein Datum.
- Die einzelne HTML-Datei enthält den Stand zum Zeitpunkt ihres Baus und nennt ihn; der Befund weist auf einen veralteten Stand hin.

## 8. Aufbau

| Teil | Inhalt |
| --- | --- |
| `kern/` | reines TypeScript ohne DOM: SHA-256 (WebCrypto), kanonische Formen, Kette, Abgleich, DER/X.509-Leser, Attestierung, QR-Text, ZIP-Leser; in Node testbar |
| `worker/` | führt die Prüfung aus, meldet Fortschritt |
| `ui/` | Seite, Dateiauswahl, Anker, Befund, Druckansicht |
| `tests/` | Testvektoren der Technischen Erläuterung, Beispieldateien von WATT, eigene manipulierte Varianten (je Prüfschritt mindestens eine, die „widerlegt“ ergibt) |
| `.github/workflows/` | Tests bei jedem Pull Request, Bau und Veröffentlichung auf Pages, tägliche Abholung von Sperrliste und Wurzeln |

Der Bau ist reproduzierbar: Aus demselben Commit entsteht dieselbe HTML-Datei mit derselben Prüfsumme.

## 9. Ausbaustufen

Entscheidung Achim 25.10.2026: WATTest setzt gleich auf WATT D auf (wenige Nutzer:innen, noch keine Prüffälle; bis dahin bleibt das Nachrechnen von Hand nach der Technischen Erläuterung).
1. **Erste Version:** P1 bis P9 für Dateien ab WATT D, Befund, Druckansicht, einzelne HTML-Datei, Sperrlisten-Action. Ältere Formatversionen (16 bis 18) ohne P6 und P7, Befund dort ?.
2. **Danach:** PWA (installierbar, Service Worker), QR mit Kamera.
3. **Später, bei Bedarf:** Android-Hülle (Trusted Web Activity) für Google Play.

## 10. Zusammenspiel mit WATT

- Die Technische Erläuterung nennt WATTest in Abschnitt 8, Schritt 3 mit Adresse, Quelltext und Lizenz (Stand 25.10.2026).
- Jede Änderung an Kette, Datenformat oder Prüfvermerk in WATT braucht eine passende Version von WATTest; die Testvektoren sind die gemeinsame Grundlage.

## 11. Entscheidungen und offene Punkte

Entschieden (Achim 25.10.2026):
1. Technische Erläuterung und Datenformat sind seit 25.10.2026 in watt_public veröffentlicht: [Technische Erläuterung](https://github.com/Aves83/watt_public/blob/main/doc/technische-erlaeuterung.md), [Datenformat](https://github.com/Aves83/watt_public/blob/main/doc/datenformat.md). Die Startseite verlinkt sie im Absatz „Über WATT“, die Fußzeile verlinkt WATT (`https://aves83.github.io/watt_public/`).
2. Beispieldateien von WATT (fiktive Daten) liegen im WATTest-Repository unter EUPL-1.2 mit dem Vermerk „fiktive Beispieldaten“.
3. Adresse `https://aves83.github.io/wattest/`, Repository `Aves83/wattest`.
4. Texte der Seite: Datenschutzhinweis ohne Anschrift („Verantwortlich ist Hans-Joachim Steudel, hans-joachim.steudel@tum.de.“), Impressum unverändert; Absatz „Über WATT“ unter der Einleitung der Startseite; Links darin öffnen in neuem Tab.

Zurückgestellt (Achim 25.10.2026):
- Prüfbarer Auszug für einen Zeitraum (Abschnitt 12). Alternative Achims: ein vollständiger Ketten-Export, der nur die Buchungen mit allem Zugehörigen enthält (Kette, Einträge, Abwesenheiten, Signaturen, Zertifikate), aber keine Einstellungen.

Offen:
- keine. Das Impressum für watt_public und WATTest besteht (WATTest seit 0.1.1, watt_public seit 24.10.2026).

## 12. Option (zurückgestellt): prüfbarer Auszug für einen Zeitraum

Ziel: Statt des vollständigen Klartexts nur einen Zeitraum weitergeben und trotzdem prüfen lassen.

- Problem: Jede Prüfsumme hängt an ihrem Vorgänger und am vollen Inhalt. Die Glieder eines Zeitraums liegen verstreut in der Kette (ein Nachtrag für März kann im Juli entstehen). Ohne die übrigen Glieder lässt sich nichts nachrechnen.
- Lösung: Der Auszug enthält **alle** Glieder, aber nur die des Zeitraums vollständig. Die übrigen Glieder stehen **verdeckt** darin, nur mit `seq`, `prev` und `hash`, ohne Zeitpunkt und Inhalt.
- Prüfung: vollständige Glieder neu berechnen, verdeckte mit ihrer angegebenen Prüfsumme übernehmen, Verkettung, Anker und Signaturen wie beim vollständigen Export. Weil niemand einen anderen Inhalt mit derselben Prüfsumme finden kann, sind auch die verdeckten Glieder festgelegt.
- Zum Zeitraum gehören alle Glieder eines Eintrags bzw. einer Abwesenheit, wenn irgendeine Fassung im Zeitraum liegt, damit der Abgleich je Objekt (P3) vollständig ist.
- Sichtbar bleibt nur die Gesamtzahl der Glieder. Ein Anker auf ein verdecktes Glied prüft nur die Prüfsumme, nicht den Zeitpunkt.
- Voraussetzung in WATT: Erweiterung der Buchungsdaten (JSON/XML im Export-Dialog) um diesen Auszug der Kette samt Signaturen und Zertifikaten; neue Formatversion bzw. Erweiterung von 19.

## 13. Stand der Umsetzung (WATTest 0.1.5, 25.10.2026)

- P1 bis P9 umgesetzt wie in Abschnitt 5; Einzelheiten der Deutung in `docs/ENTSCHEIDUNGEN.md` und `docs/UNKLARHEITEN.md`.
- Abweichend von Abschnitt 9 sind PWA (Service Worker, installierbar) und QR mit der Kamera (über `BarcodeDetector`, nur wo vorhanden) schon in 0.1.0 enthalten.
- Content Security Policy: `default-src none`, Skripte und Stile über Hashes, `worker-src self blob:`, `connect-src self` (Einzeldatei `none`), `img-src self data: blob:`, `manifest-src self`, `base-uri none`, `form-action none`.
- Fußzeile (alle drei Seiten): „WATTest 0.1.5 · © 2026 Hans-Joachim Steudel · EUPL-1.2 · Quelltext · WATT · Impressum · Datenschutz“.
- Startseite mit dem Absatz „Über WATT“ unter der Einleitung (Links auf WATT, die Technische Erläuterung und den Quelltext, in neuem Tab); im Druck ausgeblendet wie die Einleitung.
- P4 prüft bei `uhr_ruecksprung` mit Uhrstand die Regel zum Bezug aus 4.7 („uhr_ruecksprung bei Einträgen mit Uhrstand“); ein Verstoß ist „?“ mit Glied-Nummer, nie ✗ (U-18, E-36). `uhr_ruecksprung` mit `objektId` `start` und `zeitsignal` erklärt einen Rücksprung wie `timer` und `nachweis` (8., Schritt 5).
- Der Fingerabdruck des App-Signaturzertifikats steht in `daten/app-signatur.json` (TE 4.7, Schritt 3); die Teilaussage zur App-Signatur in P7 ist damit ✓ oder ✗.
- Die Klarstellungen der Technischen Erläuterung vom 25.10.2026 sind übernommen (`docs/UNKLARHEITEN.md`, U-1 bis U-19; watt_public, Commit 37ae281, TE und Datenformat auf Stand 1af17a5 von WATT, Vorabfassung); die Rechenbeispiele B1 bis B13 liest `scripts/vektoren-holen.mjs` aus den Codeblöcken der TE.
- Kanonisches JSON (Bestandsprüfsumme je Eintrag und Abwesenheit, Prüfsumme des Datenbestands) schreibt WATTest mit eigener Maskierung nach 4.6: nur `"`, `\` und U+0000 bis U+001F, alles andere roh in UTF-8; ein einzelnes Ersatzzeichen wird in UTF-8 zu „?“ (U-17).
- Schema-Auszug und XML-Typtabelle erzeugen `scripts/schema-auszug.mjs` und `scripts/xml-typen.mjs` aus `schema/` von watt_public (JSON-Schemas 16 bis 19, XSD 18 und 19); P1 nennt für Version 19 die Vorabfassung als Hinweis (U-19).
- P1 prüft Pflichtfelder und Typen der gelesenen Teile gegen einen Auszug der Schemas, keinen vollständigen Schema-Validator.
- Formatversionen 16 bis 18: P6 einmal „?“ mit „Diese Fassung von WATT (Datenformat <n>) signiert noch nicht; die Herkunft lässt sich deshalb nicht bestätigen.“, P7 Hinweis „Entfällt (keine Signatur).“ (seit 0.1.5; bis 0.1.4 beide „?“).
- Befundtexte seit 0.1.5 (Feldtest Achim 25.10.2026): Gesamtzeile mit zweitem Satz, P4 mit genau einer Aussage zu den Zeitstempeln, P5 ohne Anker mit Handlungshinweis (Abschnitt 6).
- Härtung seit 0.1.5 (Abschnitt 14): DER/X.509, ZIP, XML und JSON mit festen Grenzen; Lese- und Grenzfehler sind „?“, nie ✗; Zahlen über Number.MAX_SAFE_INTEGER werden genannt statt gerundet; „Abbrechen“ und Befund „?“ statt leerer Seite. Getestet mit deterministischen Mutationstests (fester Seed) und einer Kette mit 100.000 Gliedern, 50 Schlüsseln und 100.000 Signaturen.

## 14. Feste Grenzen für Eingaben (seit WATTest 0.1.5)

WATTest bekommt Dateien von Dritten. Damit eine manipulierte Datei die Seite nicht zum Absturz bringt, nicht hängen lässt und nicht den Speicher füllt, gelten feste, großzügige Grenzen (`src/kern/grenzen.ts`, `GRENZWERTE`). Echte Exporte von WATT liegen weit darunter. Darüber meldet WATTest „?“ mit Hinweis auf die Grenze, nie ✗ und nie einen Absturz.

| Gegenstand | Grenze | Folge darüber |
| --- | --- | --- |
| Größe einer Datei | 200 MB | Datei wird nicht gelesen; Eingaben „?“, SHA-256 „nicht berechnet“ |
| Glieder der Arbeitszeitkette | 1.000.000 | Eingaben „?“, keine Prüfschritte |
| Signaturen in `kettensignaturen` | 1.000.000 | P6 „?“ |
| Schlüssel in `kettenschluessel` | 256 | P6 und P7 „?“ |
| Zertifikate je Schlüssel | 8 | Schlüssel nicht lesbar: Signaturen und Attestierung „?“ |
| Größe eines Zertifikats | 8 KB | ebenso |
| Größe einer Signatur | 128 Bytes | diese Signatur „?“ |
| DER: Verschachtelung, Tag-Nummer | 32 Ebenen, 16.383 (zwei Bytes) | DER-Fehler, „?“; unbestimmte Längen, Längen über das Ende und Daten hinter einem Element ebenso |
| JSON: Verschachtelung | 64 Ebenen (auch im Feld `daten`) | Datei: Eingaben „?“; `daten` eines Glieds: P3 „?“ für das Objekt |
| JSON und XML: ganze Zahlen | Number.MAX_SAFE_INTEGER (9.007.199.254.740.991) | P1 „?“ mit Pfad; betroffene Glieder in P2 „?“, Signaturen in P6 „?“ |
| XML: Verschachtelung, Attribute je Element | 64 Ebenen, 32 Attribute | Eingaben „?“; DTD und Entitäten (außer den fünf vordefinierten und Zeichenreferenzen) werden abgewiesen |
| ZIP: Einträge | 10.000 | Eingaben „?“ |
| ZIP: entpackte Größe | 200 MB je Eintrag, 512 MB zusammen | ebenso, vor dem Entpacken; beim Entpacken Abbruch, sobald mehr als die angegebene Größe entsteht |
| ZIP: Kompressionsverhältnis | 250 : 1 ab 1 MB entpackter Größe | ebenso (Zip-Bombe) |
| ZIP: Pfade | 1.024 Zeichen; kein `..`, kein absoluter Pfad, kein Rückstrich, keine Steuerzeichen, keine doppelten Namen, keine überlappenden Einträge | ebenso |
| Einzelheiten je Aussage | 200 | Rest gezählt |
