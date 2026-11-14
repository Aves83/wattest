# Beispieldateien

Fiktive Beispieldaten aus der App WATT, © 2026 Hans-Joachim Steudel, lizenziert unter EUPL-1.2.

| Datei | Formatversion | WATT-Fassung |
| --- | --- | --- |
| `apfel-16.json` | 16 | 0.8.94 „Apfel“ |
| `bergamotte-17.json` | 17 | 0.8.100 „Bergamotte“ |
| `cherimoya-18.json` | 18 | 0.8.109 „Cherimoya“ |
| `drachenfrucht-19.json` | 19 | 0.8.111 „Drachenfrucht“ |
| `erdbeere-19.json` | 19 | 0.8.118 „Erdbeere“ |
| `felsenbirne-20.json` | 20 | 0.8.126 „Felsenbirne“ |

Die Dateien sind unverändert aus `core/data/src/test/resources/formate/` von WATT übernommen (16 bis 18 vom Branch `feat/attestierte-kette`, `drachenfrucht-19.json` von Commit b663ad8 über die GitHub-API; `erdbeere-19.json`, nach dem Datenformat mit dem Code von Commit d0fb4a6 erzeugt, von Achim am 12.11.2026 übergeben, SHA-256 02d9a57a6e1a3a852147f1561f6a1a0eb857eca407a225de870667bc3a0868b1; `felsenbirne-20.json`, nach dem Datenformat mit dem Code von Commit b64e648 erzeugt, von Commit 5859567 über die GitHub-API am 14.11.2026, 54.831 Bytes, SHA-256 557a943938dec2698aff8e8f0e2688324f2fa58873c04dc702a907cc2a5df64e). `tests/beispiele.test.ts` prüft sie: Bei 16 bis 18 ergeben P1 bis P5, P8 und P9 ✓, P6 und P7 „?“, weil diese Versionen noch nicht signieren.

`erdbeere-19.json` hat nach dem Datenformat den Umfang von `drachenfrucht-19.json` ohne Schulfahrt, Geburtsmonat und Ferien von Hand und ergibt je Schritt dasselbe.

`felsenbirne-20.json` hat den Umfang von `drachenfrucht-19.json`, dazu eine dreitägige Schulfahrt und einen gesendeten Antrag auf Zeitausgleich für sie (`art` `ZEITAUSGLEICH`, Stufe `AUSSAGE`, Zeitraum 22.09.2026 bis 24.09.2026, keine Kopien, einziges Dokument das Anschreiben) neben einer gesendeten Überlastungsanzeige (`art` `UEBERLASTUNGSANZEIGE`). Die Nachweiskette hat vier Glieder (`ANZEIGE_GESENDET` für die Überlastungsanzeige, `GESPRAECHSNOTIZ_GESPEICHERT`, `NACHTRAG`, `ANZEIGE_GESENDET` für den Antrag), die Arbeitszeitkette zehn Glieder mit acht Signaturen und einem Schlüssel. Je Schritt ergibt sie dasselbe wie `drachenfrucht-19.json`; P1 lautet „Die Datei ist ein vollständiger Klartext-Export im Datenformat 20.“ ohne Hinweis auf eine Vorabfassung, P8 zählt „1 gesendeten Überlastungsanzeige und 1 gesendeten Antrag auf Zeitausgleich mit 2 Dokumenten, 1 Gesprächsnotiz und 1 Nachtrag“. Die Prüfsumme des Antrags nach Verfahren 2 rechnet `tests/nachzug-0-1-15.test.ts` unabhängig vom Kern nach; dort stehen auch die aus `felsenbirne-20.json` und, als künstliche Dateien der Version 20, aus `drachenfrucht-19.json` abgeleiteten Fälle.

Die Zertifikatskette in `drachenfrucht-19.json`, `erdbeere-19.json` und `felsenbirne-20.json` stammt aus der Testumgebung von WATT, nicht von einem Gerät. Ohne Wurzeln und App-Signatur ergeben P1 bis P6, P8 und P9 ✓ und P7 „?“; mit den Wurzeln von Google aus `daten/` ist P7 ✗, weil die Kette zu keiner dieser Wurzeln führt. Das ist für eine Kette aus der Testumgebung richtig.
