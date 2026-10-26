# Unklarheiten in den Unterlagen von WATT

Stellen, an denen die Unterlagen (Technische Erläuterung, Datenformat, Schemas, Beispieldateien) unklar sind oder einander widersprechen. WATTest entscheidet nach dem Wortlaut der Technischen Erläuterung (TE); jede Stelle nennt Zitat, Deutung und Folge.

Stand: WATTest 0.1.6, Unterlagen vom 26.10.2026 aus dem öffentlichen Repository [Aves83/watt_public](https://github.com/Aves83/watt_public) (Commit 4b2ac60: `doc/technische-erlaeuterung.md`, `doc/datenformat.md`, `schema/` mit den Schemas der Version 19 als Vorabfassung; TE und Datenformat auf dem Stand 9dfd642 von WATT, Kopfzeile „WATT-Version: Vorabfassung · Stand: 26.10.2026“; bis 0.1.5 galt Commit 37ae281). Die TE vom 25.10.2026 klärt U-1 bis U-18, die Schemas in watt_public klären U-19, die TE vom 26.10.2026 klärt U-20 bis U-24; WATTest folgt jeweils nur noch der Lesart der TE. Offen sind U-25 (Sperrliste, Entscheidung Achim vor dem nächsten Stand der TE), U-26 (Name der Technischen Erläuterung im Aktenauszug) und U-27 (Glieder vor dem ersten Schlüssel).

Keine der drei Beispieldateien (`apfel-16`, `bergamotte-17`, `cherimoya-18`) weicht von der Beschreibung ab: Alle Prüfsummen der Arbeitszeitkette, der Nachweiskette, der Anzeige, der Gesprächsnotiz und des Nachtrags lassen sich nach 4.2 und 5.1 nachrechnen, und der Abgleich nach 7. ergibt keine Abweichung. Die Rechenbeispiele B1 bis B13 aus den Codeblöcken der TE sind in 4b2ac60 unverändert; neu sind B14 (Bestandsprüfsumme in Form 2) und B15 (Änderungs-Glied eines eingelesenen Eintrags mit `importiertAm`), beide in `tests/vektoren/`.

## Geklärt

### U-1 Zähler `i` im QR-Code

- Früher: Die TE zählte nur Glieder `eintrag`, das Datenformat auch `abwesenheit`; WATTest ließ beide Zählweisen gelten.
- **Geklärt durch TE Abschnitt 6.2 und 4.1, Stand 25.10.2026:** „gezählt werden die Anlage-Einträge (aktion ANGELEGT) der Arten eintrag und abwesenheit, deren daten importDatei enthalten“.
- Folge: P5 zählt nur noch so; passt `i` nicht, ist der Anker widerlegt.

### U-2 Seit welcher Formatversion gibt es XML?

- Früher: Datenformat und XSD nannten Version 17, die README der Schnittstelle Version 18; WATTest las XML 17 bis 19.
- **Geklärt durch TE Abschnitt 8, Schritt 1, Stand 25.10.2026** (ebenso Datenformat, „XML-Darstellung“, und README der Schnittstelle): „Ausgelieferte Fassungen exportieren XML ab Formatversion 18 (WATT 0.8.109 „Cherimoya“), das XML Schema ist ab Version 18 veröffentlicht.“ Die XSD 17 stammt laut Datenformat aus der Entwicklung und ist nicht veröffentlicht.
- Folge: XML der Versionen 16 und 17 ergibt in P1 „?“ mit „WATT exportiert XML erst ab Formatversion 18.“; die übrigen Schritte rechnen trotzdem (Typtabelle für Version 17 weiter aus der XSD 17). Version 18 und 19 wie bisher.

### U-3 Welche Notizen gehen in die Prüfsumme einer Anzeige ein?

- Früher: „beim Markieren als gesendet vorhanden“ ließ `fest` oder `nachVersand` false zu; WATTest nahm hilfsweise beide.
- **Geklärt durch TE Abschnitt 5.1, Stand 25.10.2026:** „Anzahl der Notizen mit fest true, danach je solche Notiz Zeitpunkt (erstelltAm) und Text, sortiert nach erstelltAm und Kennung wie im Datenformat“; Notizen mit `fest` false „gehen nicht ein und zählen nicht mit“.
- Folge: P8 rechnet nur so, die Notizen sortiert nach `erstelltAm` und `id`.

### U-4 Nachtrag nach 4.5

- Früher: offen, ob Erfassung oder letzte Änderung zählt und ab wann „Tage“ gilt; WATTest nahm 48 Stunden.
- **Geklärt durch TE Abschnitt 4.5, Stand 25.10.2026:** Erfassung und letzte Änderung getrennt; erst ab mehr als 24 Stunden; bis einschließlich 96 Stunden in ganzen Stunden, darüber in ganzen Tagen; Rundung über ganze Sekunden: Stunden = (Sekunden + 1800) div 3600, Tage = (Sekunden + 43200) div 86400; bei Tagesblöcken Ende 00:00 Uhr deutscher Zeit des folgenden Tags; eingelesene Einträge mit „(laut Datei)“, dem Abstand bis zum Einlesen („Eingelesen ca. …“) und „Importiert am …“.
- Folge: P9 nennt je Eintrag „Nachgetragen …“, „Geändert …“, „Eingelesen …“ und „Importiert am …“ nach dieser Regel (Hinweise).

### U-5 Rücksprung beim Festhalten eines Nachweises

- Früher: 8., Schritt 5 nannte nur `uhr_ruecksprung` mit `objektId` `timer`.
- **Geklärt durch TE Abschnitt 8, Schritt 5, Stand 25.10.2026:** Erklärt ist ein Rücksprung, wenn unmittelbar `uhr_ruecksprung` folgt oder das Glied selbst ein Vermerk zur Uhr ist: `uhr_ruecksprung` mit `objektId` `timer` oder `nachweis`, oder `uhr_verstellt` mit `richtung` `zurueck`.
- Folge: P4 prüft genau diese Fälle. Ein Glied nach einem `uhr_verstellt` erklärt dessen Vorgänger nicht mehr (früher hilfsweise angenommen).

### U-6 Zeitpunkt eines Glieds `uhr_verstellt`

- Früher: offen, ob das Glied die Zeit vor oder nach der Verstellung trägt.
- **Geklärt durch TE Abschnitt 4.7 („Zeitpunkt des Eintrags uhr_verstellt“) und 8., Schritt 5, Stand 25.10.2026:** zeitpunkt gleicht `nachher`; bei `objektId` `glied` ist das zugleich der Zeitpunkt des unmittelbar folgenden Glieds; zeitpunkt(uhr_verstellt) − zeitpunkt(voriges) = (vorher − zeitpunkt(voriges)) + (nachher − vorher), der zweite Teil gleicht `abweichungSekunden` (ganze Sekunden, zur Null hin gekürzt), bei `schritte` der Summe mit Vorzeichen.
- Folge: P4 rechnet die Zerlegung je Glied `uhr_verstellt` nach; passt sie nicht, ist die Aussage „?“ (Entscheidung E-27).

### U-7 Abschnitte bei einem Glied `schluessel` ohne Schlüssel

- **Geklärt durch TE Abschnitt 4.7, Stand 25.10.2026:** „Ein Eintrag nicht_verfuegbar beendet den Abschnitt des vorigen Schlüssels … eine Signatur über einen Kopf in diesem Bereich gilt als ungültig, auch wenn sie mit dem früheren Schlüssel rechnerisch stimmt.“ Schritt 7: „bis vor den nächsten Eintrag schluessel, gleich mit welchem Status“.
- Folge: wie bisher in P6.

### U-8 Challenge

- Früher: „leere Kette“ und Form der Challenge gedeutet.
- **Geklärt durch TE Abschnitt 4.7 („Schlüssel“, Schritt 6), Stand 25.10.2026:** Challenge ist der `hash` des Kopfs beim Erzeugen, hexadezimal zu 32 Bytes dekodiert, also des Glieds unmittelbar vor `schluessel`. **Ausnahme:** Steht dazwischen ein `uhr_verstellt` mit `objektId` `glied`, ist es der `hash` des Glieds vor diesem. Bei leerer Kette ist `schluessel` Glied 1 und trägt die 32 Zufallsbytes als `challenge` (64 Zeichen Hex klein); nur dieser Eintrag hat das Feld.
- Folge: P7 prüft beide Fälle und die Ausnahme (Tests mit dem Erzeuger). `challenge` in einem anderen Glied `schluessel` ergibt „?“ (E-29).

### U-9 Gültigkeit der Zertifikate zum Zeitpunkt der Erzeugung

- **Geklärt durch TE Abschnitt 4.7, „Befund in drei Stufen“, Stand 25.10.2026:** nicht bestätigbar, wenn „ein Zertifikat war zum Zeitpunkt der Erzeugung nach der Geräteuhr nicht gültig“.
- Folge: wie bisher „?“.

### U-10 RootOfTrust nicht „Verified“

- **Geklärt durch TE Abschnitt 4.7, „Befund in drei Stufen“, Stand 25.10.2026:** nicht bestätigbar bei „verifiedBootState nicht Verified oder deviceLocked false“.
- Folge: wie bisher „?“. Die übrige Zuordnung in E-4 und E-5 stimmt mit der dreistufigen Liste überein.

### U-11 Name des Listenelements `anhaenge` im XML

- **Geklärt durch Datenformat, „XML-Darstellung“, Stand 25.10.2026:** `anhaenge` → `anhang` steht jetzt in der Liste der Singularformen.
- Folge: wie bisher.

### U-12 Fingerabdruck des App-Signaturzertifikats

- **Geklärt durch Entscheidung Achim 25.10.2026:** Der Wert aus TE Abschnitt 4.7, Schritt 3 (`4accbc1ff7bb15f57a2364e39906568e01c4e4b53e4e5d63e77148eb3bfa99d9`) steht in `daten/app-signatur.json`.
- Folge: Die Teilaussage zur App-Signatur in P7 ist ✓ oder ✗ (E-3).

### U-13 Prüfsumme des Datenbestands beim Neubeginn

- **Geklärt durch TE Abschnitt 4.6, Stand 25.10.2026:** `bestand` lässt sich nur mit einem JSON-Export unmittelbar nach dem Neubeginn nachrechnen; jeder spätere Export ergibt eine andere Prüfsumme, ohne dass das auf eine Manipulation hindeutet. Nachprüfbar bleiben die Bestandsprüfsummen je Eintrag und Abwesenheit sowie `vorherAnzahl`, `vorherLetzterHash` und `vorherZeitpunkt`.
- Folge: P9 rechnet `bestand` aus einem JSON-Export nach; passt er, ✓, sonst nur ein Hinweis (E-31). Die Bestandsprüfsummen prüft P3, die Angaben zur alten Kette P5 (E-7).

### U-14 Vorzeichen von `abweichungSekunden` bei `richtung` `zurueck`

- Früher: TE 4.7 sagte nur „die Abweichung ist positiv bei vorgestellter Uhr“; WATTest verglich Beträge.
- **Geklärt durch TE Abschnitt 4.7 („Verstellung der Geräteuhr“), Stand 25.10.2026 (watt_public 4828c89), ebenso Datenformat (`objektArt`):** „abweichungSekunden trägt ein Vorzeichen: Es ist nachher − vorher in ganzen Sekunden, zur Null hin gekürzt, also positiv bei richtung vor und negativ bei richtung zurueck … der Betrag ist immer mindestens 120. richtung ist genau dann vor, wenn abweichungSekunden positiv ist. Bei summierten kleinen Schritten (schritte) nennt abweichungSekunden die Summe ihrer Beträge mit dem Vorzeichen der Gesamtrichtung …; heben sich die Schritte genau auf, gilt vor.“
- Folge: P4 verlangt ohne `schritte` `abweichungSekunden` = nachher − vorher (gekürzt) mit Vorzeichen, Betrag mindestens 120, `richtung` passend zum Vorzeichen; mit `schritte` dasselbe Vorzeichen wie nachher − vorher (bei genauem Ausgleich positiv) und |nachher − vorher| höchstens |abweichungSekunden|. Sonst „?“ (E-27). Der Betrag bei `richtung` `zurueck` gilt nicht mehr.

### U-15 Erster Teil der Zerlegung

- Früher: TE 4.7: „er ist nie negativ“, zugleich „bis auf unvermerkte Abweichungen von höchstens 2 Minuten“; WATTest ließ bis −2 Minuten zu und gab darunter „?“.
- **Geklärt durch TE Abschnitt 4.7, Stand 25.10.2026 (watt_public 4828c89):** „Der erste Teil ist nicht kleiner als −2 Minuten (−120 Sekunden, Grenze eingeschlossen); bei summierten kleinen Schritten (schritte) … nicht negativ. Ausgenommen sind Korrekturen der Uhr zurück bei eingeschalteter automatischer Uhrzeit (Netzzeit): WATT summiert sie nicht … Liegt der erste Teil unter der Grenze, ist das ein Hinweis zur Klärung, kein Beleg einer Manipulation; autoZeit des Eintrags uhr_verstellt zeigt, ob die automatische Uhrzeit bei der Erkennung eingeschaltet war.“
- Folge: P4 gibt unterhalb der Grenze nur einen Hinweis (i) mit dem Abstand und `autoZeit` des Glieds, nie ✗ oder „?“ (E-28).

### U-16 Bezugszeitpunkt für die Gültigkeit der Zertifikate

- Früher: TE 4.7, Schritt 1 nannte „Zeitpunkt des Eintrags schluessel bzw. creationDateTime“; WATTest nahm den Zeitpunkt des Glieds.
- **Geklärt durch TE Abschnitt 4.7, Schritt 1, Stand 25.10.2026 (watt_public 4828c89):** Gültigkeit aller Zertifikate „(notBefore bis notAfter, Grenzen eingeschlossen) … zu einem einzigen Bezugszeitpunkt“; maßgeblich ist der zeitpunkt des Eintrags `schluessel`. „Einzige Ausnahme ist der im Voraus erzeugte Schlüssel einer leeren Kette (der Eintrag schluessel mit challenge) … dort ist creationDateTime aus der Attestierung maßgeblich (Tag 701 …), und nur wenn es fehlt, der zeitpunkt des Eintrags.“ Sonst ist eine Abweichung von creationDateTime kein Befund. Das Blattzertifikat trägt die Standardgrenzen von Android (01.01.1970 bis 01.01.2048).
- Folge: P7 prüft alle Zertifikate an diesem Bezugszeitpunkt, beim Glied mit `challenge` an `creationDateTime`, und nennt ihn in der Teilaussage. Ungültig zum Bezugszeitpunkt bleibt „?“ (U-9). Der Testerzeuger setzt beim Blattzertifikat die Standardgrenzen von Android.

### U-17 Maskierung in kanonischem JSON

- Früher: TE 4.6 legte die Maskierung von Zeichen nicht fest; WATTest schrieb wie `JSON.stringify`.
- **Geklärt durch TE Abschnitt 4.6 („Maskierung“) und 4.2, Stand 25.10.2026 (watt_public 4828c89):** Für die kanonische Form der Bestandsprüfsumme, den Klartext-Export, über den `bestand` gerechnet wird, und `daten` der Einträge gilt: maskiert werden genau `"`, `\` und U+0000 bis U+001F, mit Kurzform `\b \t \n \f \r`, sonst `\u` mit vier Hexadezimalziffern klein; alle anderen Zeichen stehen unverändert in UTF-8, auch `/`, U+007F, U+2028 und U+2029; ein einzelnes Ersatzzeichen wird in UTF-8 zu „?“ (0x3F). Rechenbeispiel B13.
- Folge: `src/kern/kanonisch.ts` schreibt kanonisches JSON mit eigener Maskierung (`jsonZeichenkette`, `jsonKanonisch`) statt `JSON.stringify`; das ändert nur das einzelne Ersatzzeichen, das `JSON.stringify` als `\udxxx` schreibt. `utf8` in `src/kern/bytes.ts` wandelt ein einzelnes Ersatzzeichen in „?“ statt in U+FFFD. `daten` erzeugt WATTest nicht selbst, es rechnet über den Text aus der Datei. B13 steht in `tests/vektoren/`.

### U-19 Schemas der Formatversion 19

- Früher: watt_public enthielt nur die Schemas 16 bis 18 und die XSD 18; WATTest nutzte für 19 (und XML 17) den früheren Stand der Unterlagen.
- **Geklärt durch watt_public, Commit 4828c89:** `schema/` enthält `watt-daten-19.schema.json` und `watt-daten-19.xsd`; die README führt die Zeile „19 (Vorabfassung)“: noch in keiner ausgelieferten Fassung, „kann sich bis dahin ändern“. Beide Dateien sind inhaltlich gleich dem früheren Stand.
- Folge: Schema-Auszug und XML-Typtabelle sind aus watt_public neu erzeugt (Inhalt unverändert; die Typtabelle kommt jetzt ohne XSD 17 aus, E-30). P1 gibt für Version 19 einen Hinweis „Das Schema der Formatversion 19 ist eine Vorabfassung.“, solange die README sie so nennt (E-38).

### U-18 `uhr_ruecksprung` bei Gliedern mit Uhrstand und Bezug

- Früher: TE 8., Schritt 5 sagte nur, `uhr_ruecksprung` folge „nur noch, wenn kein Bezug bestand (neustarts größer als 0 oder -1)“, nannte die Fälle ohne Bezug nur beispielhaft und legte nicht fest, welches Glied die Neustarts trägt. WATTest gab bis 0.1.3 nur einen Hinweis (i), wenn ein `uhr_ruecksprung` in einem Abschnitt mit Bezug stand.
- **Geklärt durch TE 4.7 und 8., Stand 1af17a5** (watt_public 37ae281; 4.7, Absätze „Bezug“ und „uhr_ruecksprung bei Einträgen mit Uhrstand“; 4.1; 8., Schritt 5): „objektId ist eine laufende Nummer: Der auslösende Eintrag (seq gleich objektId, unmittelbar davor) hat neustarts größer als 0 oder -1; der Vermerk selbst hat neustarts 0.“ – „objektId timer, nachweis, start oder zeitsignal […]: Der Vermerk selbst hat neustarts größer als 0 oder -1.“ – „Einzige Ausnahme beim Uhrstand: Hat die Arbeitszeitkette noch keinen Eintrag, kann ein uhr_ruecksprung mit objektId nachweis ihr erster Eintrag sein (seq 1, prev 0, neustarts 0 […]).“ – „In eingespielten Einträgen (vor dem Eintrag wiederherstellung) beziehen sich neustarts und uhr_ruecksprung auf das Gerät, auf dem sie entstanden“. – „Einträge ohne Uhrstand (vor dem 24.10.2026, sieben Felder) folgen der Regel aus 4.1 ohne Bezug.“ 8., Schritt 5 nennt `start` und `zeitsignal` neben `timer` und `nachweis` als Vermerke, die einen Rücksprung selbst erklären.
- Folge: P4 prüft je `uhr_ruecksprung` mit Uhrstand diese Regel. Ein Verstoß ist „?“ mit Glied-Nummer und Begründung („Die Datei entspricht an dieser Stelle nicht der Beschreibung der Technischen Erläuterung“), nie ✗; sonst ✓ (E-36). Eingespielte Glieder prüft P4 nach derselben Regel; ohne Uhrstand entfällt sie. `uhr_ruecksprung` mit `objektId` `start` oder `zeitsignal` erklärt einen Rücksprung über 2 Minuten. Tests in `tests/klarstellungen.test.ts` und `tests/signatur.test.ts`, auch mit dem Testerzeuger (`ruecksprung`).

### U-20 Einzelnes Ersatzzeichen in den übrigen Prüfsummen

- Früher: TE 4.6 („Maskierung“) nannte die Umwandlung eines einzelnen Ersatzzeichens in „?“ nur für die drei Stellen mit JSON; WATTest wandelte es in allen Eingaben einer Prüfsumme so um (E-39).
- **Geklärt durch TE Abschnitt 4.2 („Kodierung“), Stand 26.10.2026 (watt_public 4b2ac60):** „Alle Eingaben aller Prüfsummen dieser Erläuterung (Felder der Ketten, daten, Bestand, Bestandsprüfsummen, Prüfsummen der Nachweise und Dokumente) wandelt WATT mit derselben Funktion in UTF-8 um. Ein einzelnes Ersatzzeichen (ungültiges UTF-16 ohne Partner, über die Oberfläche praktisch nicht einzugeben) wird dabei überall zu einem Fragezeichen (Byte 0x3F); Prüfende rechnen mit diesem Byte.“ Ebenso Datenformat, „protokoll“.
- Folge: wie bisher (E-39); Test für Glied, Nachweisglied und Gesprächsnotiz in `tests/vektoren.test.ts`.

### U-21 Inhalt des Felds `schritte` in `uhr_verstellt`

- Früher: TE 4.7 und Datenformat nannten `schritte` bei summierten kleinen Schritten, ohne den Inhalt zu beschreiben; `abweichungSekunden` war bei `schritte` die Summe der Beträge, der erste Teil der Zerlegung durfte dann nicht negativ sein. WATTest prüfte nur Vorzeichen und Obergrenze.
- **Geklärt durch TE Abschnitt 4.7 („Anker“, „Verstellung der Geräteuhr“, „Zeitpunkt des Eintrags uhr_verstellt“), Stand 26.10.2026:** WATT vergleicht an einem festen Anker je Gerätestart; „schritte steht nur, wenn sich die Verstellung aus mehreren Messungen ergibt: die Zahl der Messungen seit dem letzten Vermerk (bzw. seit dem Anker), bei denen sich der Versatz um mindestens eine Sekunde geändert hat, … eine ganze Zahl größer als 1; ein einzelner Sprung hat kein Feld schritte.“ – „Der zweite Teil ist die Verstellung seit dem letzten Vermerk; er gleicht abweichungSekunden …, mit und ohne schritte.“ – „Der erste Teil ist nicht kleiner als −2 Minuten (−120 Sekunden, Grenze eingeschlossen), mit und ohne schritte; ausgenommen sind nur nachgeführte Korrekturen der Netzzeit zurück … Nach einer Wiederherstellung oder einem Neubeginn gilt die Regel erst ab dem ersten Eintrag des Geräts danach“. Dazu: zeitpunkt „liegt höchstens um dessen Dauer vor nachher“; `objektId` auch „die laufende Nummer eines Eintrags neubeginn oder wiederherstellung (der Vermerk folgt diesem …)“; nach „Sofort wieder löschen“ kann das folgende Glied fehlen (4.4).
- Folge: P4 verlangt `abweichungSekunden` = nachher − vorher auch mit `schritte`, `schritte` als ganze Zahl größer als 1, `zeitpunkt` nicht nach `nachher`, eine `objektId` nach 4.7; der Hinweis zum ersten Teil gilt ab −120 Sekunden auch mit `schritte` und nicht unmittelbar nach `neubeginn` oder `wiederherstellung`; ein anderer Zeitpunkt des folgenden Glieds bei `glied` ist kein Befund mehr (E-28, E-53).

### U-22 Gewicht eines „Hinweises zur Klärung“ in 4.7

- Früher: TE 4.7 nannte den ersten Teil der Zerlegung unter −120 Sekunden und einen `uhr_ruecksprung` gegen die Regel zum Bezug gleich „ein Hinweis zur Klärung, kein Beleg einer Manipulation“; WATTest gab beim ersten einen Hinweis (i), beim zweiten „?“.
- **Geklärt durch TE Abschnitt 4.8 („Wertung von Unregelmäßigkeiten“), Stand 26.10.2026:** „Hinweis: … ein erster Teil der Zerlegung eines Zeitsprungs außerhalb der Grenze (4.7) …“ – „Nicht bestätigbar: Stellen, die WATT so nie schreibt. Dazu gehören ein uhr_ruecksprung, der nicht zur Regel zum Bezug passt (4.7) …“. 4.7 sagt jetzt ebenso „das ist ein Befund der Stufe ‚nicht bestätigbar‘ (4.8)“ bzw. „ein Hinweis (4.8)“.
- Folge: WATTest wertete schon so; nur die Begründungen zitieren jetzt 4.8. Die Zuordnung aller Stellen aus 4.8 steht in der Spezifikation, Abschnitt 6.1 (E-51).

### U-23 Mehrere Signaturen zu einem Glied und Signaturen zu Gliedern, die es nicht gibt

- Früher: Die TE sagte nicht, ob zu einer `seq` höchstens eine Signatur stehen kann, und nicht, was eine Signatur zu einem fehlenden Glied bedeutet; WATTest wertete beides als „?“ (E-44).
- **Geklärt durch TE Abschnitt 4.7 („Signatur“), Stand 26.10.2026, ebenso Datenformat (`kettensignaturen`):** „Je Eintrag gibt es höchstens eine Signatur, und nur zu Einträgen der Kette (seq von 1 bis zum Kopf). Mehrere Signaturen zu einem Eintrag schreibt WATT nie; eine Datei mit mehreren Signaturen zu einem Eintrag oder mit einer Signatur außerhalb der Kette ist für WATT ungültig und wird nicht eingespielt. Ein Prüfwerkzeug wertet mehrere Signaturen zu einem Eintrag als ‚nicht bestätigbar‘ (4.8).“
- Folge: Mehrere Signaturen zu einem Glied bleiben „?“; seit 0.1.6 zählt keine davon als gültig für die Herkunft (E-54). Eine Signatur außerhalb der Kette und eine `seq` unter 1 bleiben wie in E-44 („?“; `seq` unter 1 zusätzlich P1 ✗ nach dem Schema), denn die TE nennt für ein Prüfwerkzeug keine andere Stufe.

### U-24 Fehlender Eintrag in `kettenschluessel`

- Früher: Die TE nannte den Fall nicht, dass zu einem Glied `schluessel` mit status `verfuegbar` die Zertifikate fehlen; WATTest wertete das seit 0.1.5 als „?“ (bis 0.1.4 ✗).
- **Geklärt durch TE Abschnitt 4.7, Stand 26.10.2026:** „Zu jedem Eintrag schluessel mit status verfuegbar steht sein Schlüssel in kettenschluessel, auch nach Wiederherstellung und Neubeginn … Fehlt der Schlüssel zu einem solchen Eintrag, schreibt WATT das so nie; die Signaturen seines Abschnitts lassen sich ohne ihn weder bestätigen noch widerlegen. Das ist ‚nicht bestätigbar‘ (4.8), nicht ‚widerlegt‘.“ – „seine Signaturen zählen dann weder als gültig noch als ungültig.“ Das Datenformat nennt dazu die Grenzen beim Lesen (256 Schlüssel, 1 bis 8 Zertifikate, 8 KB, Signatur bis 128 Bytes).
- Folge: wie seit 0.1.5 (E-43): P6 „?“ für die Signaturen des Abschnitts (weder gültig noch ungültig), P7 „?“. Die Grenzen stimmen mit `GRENZWERTE` überein (Spezifikation, Abschnitt 14).

## Offen

### U-25 Zertifikat auf der Sperrliste

- TE 4.7, „Befund in drei Stufen“, widerlegt: „… ein Zertifikat ist nicht vom nächsten signiert oder steht auf der Sperrliste; die Kette führt nicht zu einer Wurzel von Google.“
- Deutung (Entscheidung Achim 26.10.2026): Die Sperrliste von Google nennt keinen Zeitpunkt der Sperre; ob das Zertifikat beim Signieren schon gesperrt war, lässt sich nicht feststellen. Eine Sperre belegt keine Fälschung, sondern nur, dass die Bestätigung nicht mehr für das Gerät bürgt. WATT ändert 4.7 im nächsten Paket entsprechend.
- Folge: Seit 0.1.6 ist ein gesperrtes Zertifikat in P7 „?“ mit Seriennummer, Status und Grund aus der Sperrliste, nicht ✗ (E-55); die Gesamtzeile wird dadurch höchstens „?“. Der Punkt wird mit dem nächsten Stand der TE geschlossen.

### U-26 Technische Erläuterung im ZIP des Aktenauszugs

- TE 6. („Aktenauszug“), Stand 26.10.2026: „optional ZIP-Archiv mit den unveränderten Originaldokumenten (Ordner Eintrag_NN je Eintrag), der Technischen Erläuterung als PDF, der Anleitung PRUEFEN.txt zur unabhängigen Prüfung mit WATTest (ab Formatversion 19; Text in UTF-8 mit Windows-Zeilenenden) und der Liste SHA256SUMS.txt mit den SHA-256-Prüfsummen all dieser Dateien, also auch der von PRUEFEN.txt.“
- Die TE nennt weder Namen noch Ort der PDF mit der Technischen Erläuterung und nicht, wie viele Ziffern NN hat. Ohne Unterscheidung prüfte WATTest diese PDF gegen die Nachweiskette und meldete „?“, weil sie zu keiner Anzeige gehört.
- Deutung: Nachweise liegen in den Ordnern `Eintrag_NN`; alles andere im ZIP sind Beigaben.
- Folge: Enthält der Aktenauszug Ordner `Eintrag_<Ziffern>/`, gleicht P8 nur deren PDF mit der Nachweiskette ab; die übrigen Dateien (darunter die Technische Erläuterung und `PRUEFEN.txt`) prüft es nur gegen `SHA256SUMS.txt` und nennt sie als Hinweis (E-59). Ohne solche Ordner (ältere Aktenauszüge) wie bisher alle PDF.

### U-27 Glieder vor dem ersten Schlüssel

- TE 4.7, „Was eine gültige Signatur belegt“: Eine gültige Signatur bei Eintrag j deckt „nur die Einträge ihres Abschnitts: vom letzten Eintrag wiederherstellung bzw. neubeginn vor j (einschließlich) bis j, ohne eine solche Grenze ab Eintrag 1.“ Zugleich nennt die Liste „nicht bestätigbar“ im selben Abschnitt „Einträge vor dem ersten Schlüssel oder nach einem Eintrag nicht_verfuegbar“.
- Unklar ist, ob Glieder vor dem ersten Glied `schluessel` (etwa aus der Zeit vor dem Update) durch eine spätere gültige Signatur ohne Wiederherstellung dazwischen gedeckt sind.
- Deutung: Die Regel zur Herkunft ist die genauere Stelle und nennt „ab Eintrag 1“ ausdrücklich; die Liste meint Glieder, die keine spätere gültige Signatur deckt (etwa eine Kette, die nach dem Update nie signiert wurde).
- Folge: P6 zählt Glieder vor dem ersten Schlüssel zur Herkunft einer späteren gültigen Signatur desselben Herkunftsabschnitts (wie bis 0.1.5); die Übersicht der Abschnitte sagt „ohne Schlüssel (nicht einzeln signiert; eine spätere Signatur desselben Herkunftsabschnitts deckt sie über die Hash-Kette mit)“. Soll die Liste gelten, genügt eine Änderung in `src/kern/schritte-signatur.ts` (Beginn der Herkunftsabschnitte).
