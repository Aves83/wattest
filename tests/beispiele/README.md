# Beispieldateien

Fiktive Beispieldaten aus der App WATT, © 2026 Hans-Joachim Steudel, lizenziert unter EUPL-1.2.

| Datei | Formatversion | WATT-Fassung |
| --- | --- | --- |
| `apfel-16.json` | 16 | 0.8.94 „Apfel“ |
| `bergamotte-17.json` | 17 | 0.8.100 „Bergamotte“ |
| `cherimoya-18.json` | 18 | 0.8.109 „Cherimoya“ |

Die Dateien sind unverändert aus `core/data/src/test/resources/formate/` von WATT (Branch `feat/attestierte-kette`) übernommen. `tests/beispiele.test.ts` prüft sie: P1 bis P5, P8 und P9 ergeben ✓, P6 und P7 „?“, weil diese Versionen noch nicht signieren.
