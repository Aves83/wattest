# Beispieldateien

Fiktive Beispieldaten aus der App WATT, © 2026 Hans-Joachim Steudel, lizenziert unter EUPL-1.2.

| Datei | Formatversion | WATT-Fassung |
| --- | --- | --- |
| `apfel-16.json` | 16 | 0.8.94 „Apfel“ |
| `bergamotte-17.json` | 17 | 0.8.100 „Bergamotte“ |
| `cherimoya-18.json` | 18 | 0.8.109 „Cherimoya“ |
| `drachenfrucht-19.json` | 19 | 0.8.111 „Drachenfrucht“ |
| `erdbeere-19.json` | 19 | 0.8.118 „Erdbeere“ |

Die Dateien sind unverändert aus `core/data/src/test/resources/formate/` von WATT übernommen (16 bis 18 vom Branch `feat/attestierte-kette`, `drachenfrucht-19.json` von Commit b663ad8 über die GitHub-API; `erdbeere-19.json`, nach dem Datenformat mit dem Code von Commit d0fb4a6 erzeugt, von Achim am 12.11.2026 übergeben, SHA-256 02d9a57a6e1a3a852147f1561f6a1a0eb857eca407a225de870667bc3a0868b1). `tests/beispiele.test.ts` prüft sie: Bei 16 bis 18 ergeben P1 bis P5, P8 und P9 ✓, P6 und P7 „?“, weil diese Versionen noch nicht signieren.

`erdbeere-19.json` hat denselben Umfang wie `drachenfrucht-19.json` und ergibt je Schritt dasselbe. Eine Beispieldatei der Formatversion 20 (`felsenbirne-20.json`): folgt mit Teil 2; bis dahin leiten die Tests Dateien der Version 20 aus `drachenfrucht-19.json` ab (`tests/nachzug-0-1-15.test.ts`).

Die Zertifikatskette in `drachenfrucht-19.json` und `erdbeere-19.json` stammt aus der Testumgebung von WATT, nicht von einem Gerät. Ohne Wurzeln und App-Signatur ergeben P1 bis P6, P8 und P9 ✓ und P7 „?“; mit den Wurzeln von Google aus `daten/` ist P7 ✗, weil die Kette zu keiner dieser Wurzeln führt. Das ist für eine Kette aus der Testumgebung richtig.
