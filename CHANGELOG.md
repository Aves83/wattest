# Änderungen

## 0.1.11 – 27.10.2026

Nachzug auf den Stand 59b1fdb der Technischen Erläuterung (watt_public, Commit 3a11ea8 vom 27.10.2026, Vorabfassung). Bisher galt Commit 69b7418.

- Unterlagen: Diff 69b7418..3a11ea8 von `doc/technische-erlaeuterung.md`, `doc/datenformat.md` und `schema/` gelesen. Geändert hat sich nur TE 6.3, Schritt 7: Ein leerer Name heißt `dokument`, ohne Endung („eine Endung gibt es dann nicht, weil sie nach Schritt 4 mindestens ein Zeichen vor dem Punkt voraussetzt und die Schritte 5 und 6 den Namen davor nicht leeren“). Datenformat, Schemas und Rechenbeispiele B1 bis B15 sind unverändert (`tests/vektoren/` nennt jetzt 3a11ea8); die übrigen Commits betreffen nur die Website von WATT.
- P8: Die Nachbildung der Bereinigung folgt Schritt 7 im Wortlaut; der nicht erreichbare Zweig „`dokument` mit Endung“ ist entfernt. Die Wertung ändert sich nicht: `dokument`, `dokument (2)`, `dokument.pdf` und `dokument (2).pdf` sind weiter bereinigte Namen (E-67).
- Tests: leerer Name, nur Leerraum und Punkte → `dokument`; `dokument.pdf` ist sein eigenes Ergebnis und bereinigt; alle Namen bis sechs Zeichen aus Punkt, Leerraum, Buchstabe und einem Zeichen außerhalb der Basisebene ergeben `dokument` genau dann, wenn nach Schritt 2 nur Punkte und Leerraum bleiben, und jedes Ergebnis ist bereinigt; lange Namen mit Endung werden nie `dokument`; Aufbau mit `dokument`, `dokument (2)`, `dokument.pdf`, `dokument (2).pdf` bestätigt (`tests/nachzug-0-1-11.test.ts`).
- Dokumentation: SPEZIFIKATION, ENTSCHEIDUNGEN (E-67), UNKLARHEITEN (keine neue, keine offen), README.

## 0.1.10 – 27.10.2026

Unterlagen unverändert (watt_public 69b7418); nur die Startseite.

- Startseite: Der Absatz „Über WATT“ ist jetzt Fließtext ohne Links („Über WATT: WATT ist eine kostenlose Android-App (Beta), mit der verbeamtete Lehrkräfte ihre Arbeitszeit erfassen und nachweisen. WATTest stammt vom selben Anbieter, ist aber quelloffen und prüft allein nach den veröffentlichten Unterlagen von WATT.“). Darunter steht die Zeile „Weiterlesen: Website von WATT · Technische Erläuterung · Einfach erklärt (PDF) · Quelltext von WATTest“ mit den bisherigen vier Zielen (neuer Tab, `rel="noopener"`, Trennzeichen „·“ außerhalb der Links), in normaler Schriftgröße, umbrechend, nicht im Druck. Bis 0.1.9 war fast der ganze Absatz Link, und „veröffentlichten Unterlagen von WATT“ führte auf die Technische Erläuterung statt auf eine Beschreibung von WATT. CSS und CSP unverändert.
- Regel: Im Fließtext steht höchstens ein Link, und sein Text nennt das Ziel; mehrere Links stehen in einer Linkzeile mit „·“. Impressum und Datenschutzhinweis entsprachen ihr schon; Hilfen und Befund enthalten keine Links.
- Tests: Absatz ohne Link, Zeile „Weiterlesen“ mit Texten, Zielen und Trennzeichen, CSP-Richtlinien unverändert, Regel für Links auf allen drei Seiten (`tests/bau.test.ts`, `tests/oberflaeche.test.ts`).

## 0.1.9 – 27.10.2026

Nachzug auf den Stand f3810d5 der Technischen Erläuterung (watt_public, Commit 69b7418 vom 27.10.2026, Vorabfassung). Bisher galt Commit 3a88095.

- P6: TE 4.7 schließt eine `wiederherstellung` als Eintrag 1 (Einspielen einer Sicherung in eine leere Kette) in den Abschnitt des ersten Schlüssels ein, wenn bis dahin nur Vermerke zur Uhr stehen. Die Wertung ist wieder ✓ wie in 0.1.7 (in 0.1.8 „?“); U-29 geschlossen, E-63 angepasst.
- P8: Dateinamen im ZIP des Aktenauszugs nach den sieben Schritten der neuen TE 6.3: Punkte und Leerraum am Anfang entfallen gemeinsam; die Endung (ab dem letzten Punkt, wenn er nicht am Anfang steht, mindestens ein Zeichen folgt, die Endung mit Punkt höchstens 10 Zeichen hat und keinen Leerraum enthält) bleibt bei der Kürzung auf 120 Zeichen erhalten, ein zerteiltes Surrogatpaar entfällt; am Ende des Namens ohne Endung entfallen Leerraum und Punkte; ein leerer Name heißt `dokument` mit Endung. Ein Name ist bereinigt, wenn er (bzw. ohne einen Zusatz „ (n)“ vor dieser Endung) ein Ergebnis der Schritte sein kann: keines der Zeichen aus Schritt 1, kein „..“, weder Punkt noch Leerraum am Anfang oder am Ende, 1 bis 120 Zeichen. Leerraum am Anfang oder am Ende ist damit wieder eine Abweichung „?“ (0.1.8 ließ ihn nach dem damaligen Wortlaut zu; E-67). Der Zusatz „ (n)“ steht vor der Endung nach Schritt 4, ohne Endung am Ende („Bericht v1.2 final (2)“).
- Startseite: Link „Einfach erklärt: Wie WATT Nachweise sichert (PDF, Unterlage von WATT)“ neben dem Link zur Technischen Erläuterung (neuer Tab, `rel="noopener"`); nur ein Verweis, keine Kopie (die PDF steht nicht unter EUPL), CSP unverändert, nicht im Druck.
- Unterlagen: Diff 3a88095..69b7418 von `doc/technische-erlaeuterung.md`, `doc/datenformat.md` und `schema/` gelesen. Geändert hat sich nur die TE (1., 4.7, 6.3); Datenformat, Schemas und Rechenbeispiele B1 bis B15 sind unverändert (`tests/vektoren/` nennt jetzt 69b7418).
- Tests: Beispiele aus 6.3 („. x.pdf“, „..\x.pdf“, „...“, 150 Zeichen mit .pdf, „Bericht v1.2 final“, leerer Name, Zusatz „ (2)“ vor derselben Endung), Endung nach Schritt 4, Kürzung mit Endung und zerteiltem Surrogatpaar, Aufbau mit Leerraum oder Punkt am Anfang oder Ende („?“), Wiederherstellung als Eintrag 1 mit und ohne andere Glieder vor dem ersten Schlüssel, Link zur Einführung mit unveränderter CSP (`tests/nachzug-0-1-9.test.ts`, `tests/bau.test.ts`, `tests/oberflaeche.test.ts`); die Fälle aus 0.1.7 und 0.1.8 sind an die neue Regel angepasst.

## 0.1.8 – 27.10.2026

Nachzug auf den Stand a612454 der Technischen Erläuterung (watt_public, Commit 3a88095 vom 26.10.2026, Vorabfassung). Bisher galt Commit af05f6e.

- P6: TE 4.7 regelt den Beginn der Herkunft jetzt so, wie WATTest es seit 0.1.7 tut: Der Abschnitt beginnt beim letzten Glied `wiederherstellung` bzw. `neubeginn` vor j, wenn es nach dem ersten Glied `schluessel` mit status `verfuegbar` liegt oder zwischen ihm und dem nächsten solchen Schlüssel nur Vermerke zur Uhr stehen, sonst beim ersten Schlüssel (U-28 geklärt, E-63, E-64). Die Wertungen bleiben; Begründung und Einzelheiten verweisen auf 4.7 statt auf U-28 und sagen wie die TE „vor dem Beginn des ersten Abschnitts“. Eine `wiederherstellung` als Eintrag 1 beginnt nach dem ausdrücklichen Satz der TE zu Eintrag 1 keinen Abschnitt (U-29, offen; bis 0.1.7 ✓, jetzt „?“).
- P8: Gleiche Dateinamen in einem Ordner `Eintrag_NN` erhalten nach TE 6.3 vor der Endung „ (n)“ mit n ab 2. Ein solcher Name ist keine Abweichung im Aufbau mehr; die 120 Zeichen gelten für den Namen ohne Zusatz. Ob ein Name bereinigt ist, prüft P8 jetzt danach, ob er ein Ergebnis der sechs Schritte sein kann: Leerraum am Anfang (nach entfernten Punkten) und am Ende nach der Kürzung auf genau 120 Zeichen sind keine Abweichung mehr (E-67). Zwei exakt gleiche Pfade bleiben „?“. Die Grenze der Prüfung (gespeicherte Namen unbekannt) steht in `GRENZE.aufbau`.
- Unterlagen: Diff af05f6e..3a88095 von `doc/technische-erlaeuterung.md`, `doc/datenformat.md` und `schema/` gelesen. Geändert hat sich nur die TE (1., 4.7, 6.3, 8. Schritt 9, Tabelle 12); Datenformat, Schemas und Rechenbeispiele B1 bis B15 sind unverändert (`tests/vektoren/` nennt jetzt 3a88095).
- Tests: Wiederherstellung nach dem ersten Schlüssel mit anderen Gliedern bis zum neuen Schlüssel, Wiederherstellung als Eintrag 1, gleiche Namen mit „ (2)“ und „ (3)“, Name ohne Punkt, 120 Zeichen plus Zusatz (zulässig und zu lang), Groß- und Kleinschreibung, exakt doppelter Pfad, Ergebnisse der Bereinigung mit und ohne Zusatz; Verweise der Tests aus 0.1.7 angepasst, der Test „Dateiname nicht bereinigt“ mit Leerraum am Ende statt am Anfang (E-67).

## 0.1.7 – 26.10.2026

Nachzug auf den Stand faea58b der Technischen Erläuterung (watt_public, Commit af05f6e vom 26.10.2026, Vorabfassung aus „Spezifikation Teil 2“). Bisher galt Commit f314de3. Hashes von watt_public seit 0.1.7 nach der Bereinigung vom 26.10.2026: Die Historie von watt_public wurde umgeschrieben (nur Autor und Commit-Nachrichten, Inhalte unverändert); alle Verweise in WATTest, auch in den Einträgen unten, nennen die neuen Hashes.

- P6: Die Herkunft der Signaturen beginnt nach TE 4.7 frühestens beim ersten Glied `schluessel` mit status `verfuegbar`. Glieder davor sind „?“ mit dem Satz „Belegt ist nur, dass sie beim ersten Schlüssel in WATT lagen.“ (bis 0.1.6 deckte eine spätere Signatur sie mit; U-27). Abweichend von der TE gehört ein Glied `neubeginn` bzw. `wiederherstellung` vor dem ersten Schlüssel samt den Vermerken zur Uhr dazwischen zum Abschnitt dieses Schlüssels (Entscheidung Achim 26.10.2026, U-28, E-63, E-64).
- P7: Ein Zertifikat auf der Sperrliste ist jetzt auch nach der TE (4.7, 4.8) „nicht bestätigbar“; die Wertung („?“) bleibt (U-25).
- P8: Aufbau des ZIP-Archivs zum Aktenauszug nach TE 6.3, wenn es eine `PRUEFEN.txt` enthält: Ordner `Eintrag_NN` (mindestens zwei Ziffern, ab 01, steigend, Lücken zulässig), Dateinamen nach den sechs Schritten der Bereinigung, in der Wurzel nur `Technische-Erlaeuterung.pdf`, `PRUEFEN.txt` (UTF-8 ohne BOM, CRLF) und als letzte Datei `SHA256SUMS.txt` (ohne BOM, LF, eine Zeile je anderer Datei in Archivreihenfolge, keine für sich selbst), gleiche Änderungszeit aller Einträge. Eine Abweichung ist „?“, eine veränderte Datei bleibt ✗ (U-26, E-62). Bei mehreren `SHA256SUMS.txt` gilt die flachste (E-66). Der ZIP-Leser liefert dazu die Änderungszeit der Einträge.
- Texte: Datenschutzhinweis und Einleitung der Startseite ohne Anrede („… verlässt den Rechner.“); ein Test durchsucht alle sichtbaren Texte nach „du“, „dein…“, „dir“, „dich“ (E-65). Der unerklärte Rücksprung bleibt „?“.
- Unterlagen: Diff f314de3..af05f6e von `doc/technische-erlaeuterung.md`, `doc/datenformat.md` und `schema/` gelesen. Neu für die Prüfung: 4.7 (Herkunft ab dem ersten Schlüssel, Sperrliste), 4.8 (Sperrliste), 6.3 (ZIP des Aktenauszugs), 8. Schritt 8 und 9. Datenformat nur mit umbenannten Kennungen aus Prüfberichten, Schemas unverändert, Rechenbeispiele B1 bis B15 unverändert. U-25 bis U-27 geklärt, U-28 neu offen.
- Tests: Herkunft vor dem ersten Schlüssel (mehrere Glieder, ein Glied, kein verfügbarer Schlüssel), U-28 mit `neubeginn` und `wiederherstellung` (mit und ohne anderes Glied vor dem Schlüssel), Sperrliste nach der TE, Bereinigung der Dateinamen, Aktenauszug nach 6.3 und jede einzelne Abweichung („?“, nie ✗), Anrede; bestehende Tests mit Gliedern vor dem ersten Schlüssel erwarten dort jetzt „?“ (Verweis auf U-27).

## 0.1.6 – 26.10.2026

Nachzug auf den Stand der Technischen Erläuterung vom 26.10.2026 (watt_public, Commit f314de3; TE und Datenformat auf Stand 9dfd642 von WATT, Vorabfassung). Bisher galt Commit 2256305.

- Wertung nach TE 4.8: „Hinweis“ → i, „nicht bestätigbar“ → ?; ✗ bleibt für Bruch der Kette, Datenabweichung und widerlegte Signatur. Die Zuordnung jeder Stelle aus 4.8 steht als Tabelle in der Spezifikation, Abschnitt 6.1 (E-51).
- P2: Ein Glied ohne Uhrstand nach einem Glied mit Uhrstand ist kein Bruch, sondern „?“ mit Anzahl und erstem Glied; P2 bleibt ✓, wenn die Prüfsummen stimmen. Ein Glied mit nur einem der beiden Felder bleibt ein Bruch (4.2, E-52).
- P4: Ein Rücksprung über 2 Minuten ohne erklärenden Vermerk ist „?“ statt ✗ (4.8, 8. Schritt 5). Ein `uhr_ruecksprung` erklärt seinen Rücksprung gleich mit welcher `objektId`; eine `objektId`, die WATT nicht schreibt, ist „?“. `uhr_verstellt` nach dem neuen Wortlaut von 4.7: `schritte` ist die Zahl der Messungen (ganze Zahl größer als 1), `abweichungSekunden` auch dann nachher − vorher, der erste Teil der Zerlegung hat auch mit `schritte` die Grenze −120 Sekunden und gilt nicht unmittelbar nach `neubeginn` oder `wiederherstellung`, `zeitpunkt` darf um die Dauer des Vorgangs vor `nachher` liegen, `objektId` kann die laufende Nummer eines Glieds `neubeginn` bzw. `wiederherstellung` sein; die Einzelheiten nennen den Anlass jedes Vermerks. Rücksprünge bis 2 Minuten sind ein eigener Hinweis (E-53, U-21, U-22).
- P6: Herkunft nach 4.7. Ein Abschnitt endet vor jeder Wiederherstellung, eine Signatur danach mit dem alten Schlüssel ist ✗. Eine gültige Signatur deckt die Glieder ab der letzten Wiederherstellung bzw. dem Neubeginn; eingespielte Glieder ohne eigene Signatur, Glieder nach der letzten gültigen Signatur ihres Abschnitts und der Bestand eines Neubeginns sind „?“. Bei eingelesenen Buchungen belegt die Signatur das Einlesen, nicht die Zeitpunkte aus der Datei. Mehrere Signaturen zu einem Glied zählen nicht als gültig. Ein doppelter Fingerabdruck in `kettenschluessel` ist „?“ (E-54, E-60, U-23, U-24).
- P7: Ein Zertifikat auf der Sperrliste ist „?“ statt ✗, mit Seriennummer, Status und Grund (Entscheidung Achim 26.10.2026, E-55, U-25).
- P3: Bestandsprüfsummen in Form 2 (`bestandsform` 2, mit `importiertAm`, Rechenbeispiel B14); ein unbekannter Wert ist „?“. „Importiert am“ nach 7.1: Änderungs-Glieder mit Uhrstand tragen den Wert selbst (fehlt er, kein Vermerk), ohne Uhrstand wird er geerbt, nach einem Neubeginn an einem Datensatz des Bestands gilt der Wert der Datei (Hinweis). Fehlt „Importiert am“ in der Datei, obwohl die Kette das Einlesen belegt, ist das ein Hinweis statt ✗; ein anderer Zeitpunkt bleibt ✗ (E-56, E-57).
- P8: Im Aktenauszug sind `PRUEFEN.txt` und die Technische Erläuterung als PDF erwartete Dateien: gegen `SHA256SUMS.txt` geprüft, nicht gegen die Nachweiskette, genannt als Hinweis (E-59, U-26).
- P1: Die Grenzen der Schemas 19 (256 Schlüssel, 8 Zertifikate, Base64 ohne Fremdzeichen) ergeben „?“, nicht ✗ (E-60). `scripts/xml-typen.mjs` erkennt Listen auch an einer festen Höchstzahl (E-61); Schema-Auszug neu erzeugt.
- Texte des Befunds unpersönlich: „…, sofern er beigefügt wird.“, P5 ohne Anker „Ein Prüfvermerk … lässt sich hinzufügen, um den Stand daran zu prüfen.“ (E-58).
- Unterlagen: U-20 bis U-24 durch die TE vom 26.10.2026 geklärt; neu offen U-25 (Sperrliste bis zum nächsten Stand der TE), U-26 (Name der Technischen Erläuterung im Aktenauszug), U-27 (Glieder vor dem ersten Schlüssel). Rechenbeispiele B1 bis B15 (neu B14 und B15).
- Tests: je Punkt oben, darunter Herkunft mit Wiederherstellung, gesperrtes Zwischen- und Blattzertifikat, Bestandsform 2, „Importiert am“ mit und ohne Uhrstand, Aktenauszug mit `PRUEFEN.txt`; geänderte Wertungen mit Verweis auf die TE.

## 0.1.5 – 25.10.2026

Härtung gegen manipulierte Dateien und klarere Befunde. Die Unterlagen von WATT sind unverändert (watt_public, Commit 2256305).

- Feste Grenzen für Eingaben von Dritten, zentral in `src/kern/grenzen.ts` und in der Spezifikation (Abschnitt 14): Datei 200 MB, 1 Mio. Glieder, 1 Mio. Signaturen, 256 Schlüssel, 8 Zertifikate je Schlüssel, Zertifikat 8 KB, Signatur 128 Bytes, Verschachtelung DER 32, JSON und XML 64 Ebenen, XML 32 Attribute, ZIP 10.000 Einträge, 200 MB je Eintrag, 512 MB zusammen, Verhältnis 250 : 1. Darüber „?“ mit Hinweis auf die Grenze, nie ✗ und kein Absturz (E-41).
- DER/X.509: keine unbestimmten Längen, Tag-Nummern bis 16.383 in minimaler Form, Längen gegen das Ende der Daten, Verschachtelung geprüft ohne Rekursion, jedes Zertifikat genau ein Element aus drei Teilen ohne Rest; fehlende Teile ergeben einen DER-Fehler statt einer Ausnahme. Ein unlesbares Zertifikat ist „?“, nie ✗; ist nur ein Zwischenzertifikat unlesbar, prüft P6 die Signaturen mit dem Blatt (E-43). Ein fehlender Eintrag in `kettenschluessel` ist jetzt „?“ statt ✗ (U-24).
- ZIP: Zip-Bomben werden vor dem Entpacken abgewiesen (Größe, Verhältnis, überlappende Einträge); entpackt wird als Strom bis zur angegebenen Größe. Abgewiesen werden auch Pfade mit `..`, absolute Pfade, Rückstriche, Steuerzeichen und doppelte Namen (E-46).
- XML: Tiefe und Attribute je Element begrenzt, doppelte Attribute und ungültige Zeichenreferenzen abgewiesen; DTD und Entitäten wie bisher nicht unterstützt.
- JSON: Tiefe begrenzt (auch im Feld `daten`), Prüfung ohne Rekursion vor dem Lesen. Zahlen über Number.MAX_SAFE_INTEGER nennt P1 mit Pfad („?“); betroffene Glieder sind in P2 „?“ statt ✗, Signaturen in P6 „?“ (E-42).
- Signaturen (P6): zu Gliedern, die es nicht gibt, mit `seq` außerhalb der Kette, mehrere zu einem Glied, über 128 Bytes oder nicht als DER lesbar: „?“ mit Fundstelle statt ✗ (E-44, U-23). Eine lesbare, aber falsche Signatur bleibt ✗.
- Ablauf: „Abbrechen“ neben „Prüfen“; Fortschritt in Teilschritten in der Live-Region. Bricht die Prüfung ab, zeigt die Seite einen Befund mit „?“ statt einer leeren Seite (E-49). Dateien über 200 MB liest die Seite nicht ein. Jede Aussage trägt höchstens 200 Einzelheiten.
- Oberfläche: Das Attribut `hidden` blendet jetzt auch Knöpfe aus; bisher blieb dadurch „QR-Code mit der Kamera scannen“ auch in Browsern ohne Erkennung von QR-Codes sichtbar.
- Befundtexte nach dem Feldtest vom 25.10.2026: Die Gesamtzeile sagt bei „?“ in einem zweiten Satz, was bestätigt ist und was fehlt (E-47). P4 zeigt genau eine Aussage zu den Zeitstempeln (E-48). P5 ohne Anker gibt den Hinweis, einen Prüfvermerk hinzuzufügen. Bei Datenformat 16 bis 18 nur noch ein „?“ in P6, P7 als Hinweis „Entfällt (keine Signatur).“
- Tests: deterministische Mutationstests mit festem Seed für DER (2.000 Fälle), ZIP (300), XML und JSON (je 400); Härtungstests je Grenze; Zip-Bomben; Kette mit 100.000 Gliedern, 50 Schlüsseln und 100.000 Signaturen; je Lage der neuen Befundtexte. Der Testerzeuger kann weitere Schlüssel einfügen (`weitereSchluessel`).

## 0.1.4 – 25.10.2026

- Unterlagen: Technische Erläuterung und Datenformat aus Aves83/watt_public, Commit 2256305 (Stand 1af17a5 von WATT, Vorabfassung). Rechenbeispiele B1 bis B13 und Schemas inhaltlich unverändert.
- P4 (U-18, geklärt durch TE 4.7 und 8.): Bei `uhr_ruecksprung` mit Uhrstand gilt die Regel der TE zum Bezug. Bei `objektId` mit laufender Nummer hat das auslösende Glied davor `neustarts` größer als 0 oder -1 und der Vermerk selbst 0; bei `timer`, `nachweis`, `start` und `zeitsignal` hat der Vermerk selbst `neustarts` größer als 0 oder -1. Ausnahme: `nachweis` als erstes Glied einer leeren Kette mit 0. Eingespielte Glieder vor einer `wiederherstellung` folgen derselben Regel; ohne Uhrstand entfällt sie. Ein Verstoß ist „?“ mit Glied-Nummer und Begründung, nie ✗; der bisherige Hinweis „uhr_ruecksprung trotz Bezug“ entfällt.
- P4: `uhr_ruecksprung` mit `objektId` `start` oder `zeitsignal` erklärt einen Rücksprung über 2 Minuten (8., Schritt 5); die Liste der Vermerke nennt beide Anlässe.
- U-20: WATT bestätigt die Lesart von E-39, die TE übernimmt sie mit dem nächsten Stand; bis dahin offen. U-21 bleibt offen (Bedeutung von `schritte` ändert sich mit dem nächsten Stand der TE), die Prüfung bleibt wie bisher. Neu offen: U-22 (gleicher Wortlaut „Hinweis zur Klärung“ bei U-15 und U-18, unterschiedlich gewertet).
- Tests: je Fall der Regel zum Bezug, die Ausnahme mit Schlüssel und Challenge, eingespielte Glieder, Glieder ohne Uhrstand, `start` und `zeitsignal` als Erklärung. Der Testerzeuger kann einen Rücksprung mit wählbarem Anlass und wählbaren `neustarts` einfügen (`ruecksprung`).

## 0.1.3 – 25.10.2026

- Unterlagen: Technische Erläuterung und Datenformat aus Aves83/watt_public, Commit 29e8679 (Stand 85a7f6e von WATT). Die Klarstellungen zu U-14 bis U-17 sind übernommen, die Ersatz-Lesarten gestrichen; `docs/UNKLARHEITEN.md` vermerkt je Punkt „geklärt durch TE Abschnitt …“.
- P4 (U-14): `abweichungSekunden` hat ein Vorzeichen (nachher − vorher, ganze Sekunden, zur Null hin gekürzt, negativ bei `zurueck`, Betrag mindestens 120); bei `schritte` die Summe der Beträge mit dem Vorzeichen der Gesamtrichtung, bei genauem Ausgleich `vor`. Ein Betrag bei `richtung` `zurueck` ergibt jetzt „?“.
- P4 (U-15): Liegt der erste Teil der Zerlegung unter −120 Sekunden (Grenze eingeschlossen), bei `schritte` unter 0, gibt WATTest nur einen Hinweis mit `autoZeit` des Glieds, kein „?“ mehr.
- P7 (U-16): Gültigkeit aller Zertifikate zu einem Bezugszeitpunkt, Grenzen eingeschlossen: Zeitpunkt des Glieds `schluessel`, beim Vorratsschlüssel der leeren Kette (Glied mit `challenge`) `creationDateTime` aus der Attestierung, ohne es der Zeitpunkt des Glieds.
- Kanonisches JSON (U-17): Bestandsprüfsummen und Prüfsumme des Datenbestands mit eigener Maskierung nach 4.6 statt `JSON.stringify`; ein einzelnes Ersatzzeichen wird in UTF-8 zu „?“. Neues Rechenbeispiel B13.
- Schemas (U-19): Schema-Auszug und XML-Typtabelle aus `schema/` von watt_public neu erzeugt (Inhalt unverändert, die XSD 17 wird nicht mehr gebraucht). P1 meldet für Formatversion 19 als Hinweis, dass das Schema eine Vorabfassung ist, solange die README es so nennt.
- U-18 bleibt ein Hinweis; TE 8., Schritt 5 ist in 29e8679 unverändert. Neu offen: U-20 (Ersatzzeichen in den übrigen Prüfsummen) und U-21 (Inhalt von `schritte`).
- Tests: B13, Tabelle der Maskierung, Ersatzzeichen, Vorzeichen und Grenzen von `abweichungSekunden`, erster Teil der Zerlegung, Bezugszeitpunkt der Zertifikate mit Grenzfällen, Hinweis auf die Vorabfassung. Der Testerzeuger setzt beim Blattzertifikat die Standardgrenzen von Android (01.01.1970 bis 01.01.2048) und `creationDateTime` wählbar.

## 0.1.2 – 25.10.2026

- Unterlagen: Technische Erläuterung, Datenformat und Schemas liest WATTest jetzt aus dem öffentlichen Repository Aves83/watt_public (Commit 3170836, Inhalt gleich dem bisherigen Stand; die Schemas der Version 19 sind dort noch nicht veröffentlicht, U-19). `scripts/vektoren-holen.mjs` holt die TE von dort; die Rechenbeispiele B1 bis B12 sind unverändert. README und Spezifikation verlinken die beiden Dokumente.
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
