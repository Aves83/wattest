# Unklarheiten in den Unterlagen von WATT

Stellen, an denen die Unterlagen (Technische Erläuterung, Datenformat, Schemas, Beispieldateien) unklar sind oder einander widersprechen. WATTest entscheidet nach dem Wortlaut der Technischen Erläuterung (TE); jede Stelle nennt Zitat, Deutung und Folge.

Stand: WATTest 0.1.5, Unterlagen vom 25.10.2026 aus dem öffentlichen Repository [Aves83/watt_public](https://github.com/Aves83/watt_public) (Commit 37ae281: `doc/technische-erlaeuterung.md`, `doc/datenformat.md`, `schema/` mit den Schemas der Version 19 als Vorabfassung; TE und Datenformat auf dem Stand 1af17a5 von WATT, Kopfzeile „WATT-Version: Vorabfassung“). Die TE vom 25.10.2026 klärt U-1 bis U-18, die Schemas in watt_public klären U-19; WATTest folgt jeweils nur noch der Lesart der TE, Ersatz-Lesarten sind gestrichen. Offen sind U-20 (Antwort angekündigt), U-21 (Bedeutung von `schritte` ändert sich mit dem nächsten Stand der TE), U-22 und die neuen Punkte U-23 und U-24 aus der Härtung (0.1.5; der Stand der TE ist unverändert 37ae281).

Keine der drei Beispieldateien (`apfel-16`, `bergamotte-17`, `cherimoya-18`) weicht von der Beschreibung ab: Alle Prüfsummen der Arbeitszeitkette, der Nachweiskette, der Anzeige, der Gesprächsnotiz und des Nachtrags lassen sich nach 4.2 und 5.1 nachrechnen, und der Abgleich nach 7. ergibt keine Abweichung. Die Rechenbeispiele B1 bis B13 aus den Codeblöcken der TE sind in 37ae281 unverändert.

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

## Offen

### U-20 Einzelnes Ersatzzeichen in den übrigen Prüfsummen

- TE 4.6 („Maskierung“) nennt die Umwandlung eines einzelnen Ersatzzeichens in „?“ für die drei Stellen mit JSON (Bestandsprüfsumme, Klartext-Export für `bestand`, `daten`). Für die übrigen Felder der Kette (4.2) und für die Prüfsummen der Nachweise (5.1), deren Werte ebenfalls „in UTF-8“ eingehen, sagt sie dazu nichts.
- Deutung: Die Umwandlung in UTF-8 ist überall dieselbe.
- Folge: WATTest wandelt in allen Eingaben einer Prüfsumme ein einzelnes Ersatzzeichen in „?“ (E-39). Weicht WATT ab, passt eine solche Prüfsumme nicht; das Zeichen ist über die Oberfläche praktisch nicht einzugeben.
- **Antwort angekündigt, Lesart E-39 bestätigt:** WATT bestätigt die Lesart (alle Prüfsummen, „?“ für ein einzelnes Ersatzzeichen); die TE übernimmt das mit ihrem nächsten Stand. Bis dahin bleibt der Punkt offen, an der Prüfung ändert sich nichts.

### U-21 Inhalt des Felds `schritte` in `uhr_verstellt`

- TE 4.7 und Datenformat nennen das Feld `schritte` bei summierten kleinen Schritten, beschreiben aber nicht seinen Inhalt (Anzahl oder Liste der Schritte); das Schema 19 legt `daten` nur als Text fest.
- Folge: WATTest prüft nur, ob das Feld vorhanden ist, und rechnet nicht die einzelnen Schritte nach, sondern nur Vorzeichen und Obergrenze über nachher − vorher (U-14).
- Stand 0.1.4: Die Bedeutung von `schritte` ändert sich mit dem nächsten Stand der TE; bis dahin bleibt die Prüfung wie beschrieben.

### U-22 Gewicht eines „Hinweises zur Klärung“ in 4.7

- TE 4.7 nennt zwei Abweichungen mit demselben Wortlaut „ein Hinweis zur Klärung, kein Beleg einer Manipulation“: den ersten Teil der Zerlegung unter −120 Sekunden (U-15) und einen `uhr_ruecksprung`, der nicht zur Regel für den Bezug passt (U-18: „passt er nicht zu dieser Regel; das ist ein Hinweis zur Klärung, kein Beleg einer Manipulation“).
- Deutung: Beide sind kein ✗. Ob „Hinweis“ das Zeichen i (zählt nicht für die Gesamtzeile) oder „?“ meint, lässt der Wortlaut offen.
- Folge: WATTest gibt nach den Aufträgen 0.1.3 und 0.1.4 beim ersten Teil einen Hinweis (i, E-28), beim Bezug „?“ (E-36). Die Gesamtzeile wird also nur im zweiten Fall „?“. Sollen beide gleich behandelt werden, genügt eine Änderung in `src/kern/schritte-kette.ts`.

### U-23 Mehrere Signaturen zu einem Glied und Signaturen zu Gliedern, die es nicht gibt

- TE 4.7, „Signatur und Deutung“: „Nach jedem Vorgang, der Einträge anhängt, signiert WATT den neuen Kopf […]. Die Signaturen stehen getrennt von der Kette (Liste kettensignaturen mit seq, fingerabdruck und signatur in Base64, DER) […]. Vor jedem Dokument signiert WATT einen noch unsignierten Kopf, sofern möglich“. Prüfverfahren, Schritt 7: „Jede Signatur mit dem Schlüssel ihres Abschnitts über watt-kopf-1:\<hash des Eintrags seq> prüfen.“
- Die TE sagt nicht ausdrücklich, ob zu einer `seq` höchstens eine Signatur stehen kann, und nicht, was eine Signatur bedeutet, deren `seq` in der Kette fehlt (etwa nach einem gekürzten Export).
- Deutung: „einen noch unsignierten Kopf“ legt eine Signatur je Kopf nahe; eine Signatur ohne Glied lässt sich nach Schritt 7 nicht prüfen.
- Folge: Beides ist „?“ mit Fundstelle, nie ✗ (E-44). Jede Signatur wird einzeln geprüft; eine lesbare, aber falsche bleibt ✗.

### U-24 Fehlender Eintrag in `kettenschluessel`

- TE 4.7: „Die Zertifikate selbst stehen in der Liste kettenschluessel von Sicherung und Klartext (Base64, DER, Blatt zuerst).“ Befund „widerlegt“: „fingerabdruck oder zertifikateSha256 passen nicht zu den Zertifikaten“.
- Die TE nennt nicht den Fall, dass zu einem Eintrag `schluessel` mit status `verfuegbar` die Zertifikate ganz fehlen, und keine Grenzen für Anzahl und Größe der Zertifikate.
- Deutung: Ohne Zertifikate gibt es nichts, wozu Fingerabdruck und `zertifikateSha256` nicht passen könnten; die Prüfung ist nicht möglich.
- Folge: Seit 0.1.5 „?“ in P6 und P7 (bis 0.1.4 ✗); ebenso für unlesbare Zertifikate und solche über den Grenzen aus E-41 (E-43).
