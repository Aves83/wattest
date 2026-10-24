# Daten

| Datei | Inhalt | Quelle |
| --- | --- | --- |
| `wurzeln.json` | Wurzelzertifikate der Android Key Attestation (PEM): die RSA-Wurzel „Google Hardware Attestation Root“ und „Key Attestation CA1“ (ECDSA P-384), mit Abrufzeitpunkt | https://android.googleapis.com/attestation/root, verlinkt von https://developer.android.com/privacy-and-security/security-key-attestation |
| `sperrliste.json` | Sperrliste der Attestierungszertifikate (Seriennummer hexadezimal, klein, ohne führende Nullen → Status und Grund), mit Abrufzeitpunkt | https://android.googleapis.com/attestation/status |
| `app-signatur.json` | Paketname von WATT und SHA-256 des App-Signaturzertifikats; leer, bis WATT ihn veröffentlicht | WATT (Technische Erläuterung 4.7) |

`npm run daten` holt Sperrliste und Wurzeln neu (`scripts/daten-holen.mjs`). Scheitert ein Abruf, bleibt der eingecheckte Stand. Die Veröffentlichung auf GitHub Pages holt beide bei jedem Lauf frisch, ohne sie einzuchecken; der Befund nennt den Stand.
