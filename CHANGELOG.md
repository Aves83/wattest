# Änderungen

## 0.1.0 – 25.10.2026

Erste Version.

- Prüfschritte P1 bis P9 nach Spezifikation, Abschnitt 5: Format, Arbeitszeitkette (sieben und neun Felder), Abgleich der Daten mit der Kette, Zeit, Anker, Signaturen, Attestierung, Nachweiskette und Aktenauszug, besondere Glieder.
- Eingaben: Klartext-Export als JSON (Datenformat 16 bis 19), XML (17 bis 19) und ZIP mit `anhaenge/`, Aktenauszug mit `SHA256SUMS.txt`; Buchungsdaten und `.wattbak` werden erkannt und erklärt.
- Anker als QR-Inhalt, Wortlaut des Prüfvermerks oder von Hand; QR mit der Kamera, wo der Browser `BarcodeDetector` anbietet.
- Befund mit ✓, ?, ✗ und Hinweisen, Begründung, Fundstelle und Grenze; Druckansicht.
- Prüfung im Web Worker mit Fortschritt; 10.000 Glieder mit Signaturen in Node in etwa 2 Sekunden.
- Seite auf GitHub Pages mit Service Worker, täglich frischer Sperrliste; Einzeldatei `wattest-0.1.0.html`, die ohne Netz läuft; reproduzierbarer Bau mit CSP-Hashes.
- Tests: Rechenbeispiele B1 bis B12 der Technischen Erläuterung, Beispieldateien `apfel-16`, `bergamotte-17`, `cherimoya-18`, Erzeuger für Datenformat 19 mit eigenen Testzertifikaten, manipulierte Varianten je Prüfschritt, Bau und Oberfläche.
