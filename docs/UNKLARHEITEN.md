# Unklarheiten in den Unterlagen von WATT

Stellen, an denen die Unterlagen (Technische Erläuterung, Datenformat, Schemas, Beispieldateien) unklar sind oder einander widersprechen. WATTest entscheidet nach dem Wortlaut der Technischen Erläuterung (TE); jede Stelle nennt Zitat, Deutung und Folge.

Stand: WATTest 0.1.3, Unterlagen vom 25.10.2026 aus dem öffentlichen Repository [Aves83/watt_public](https://github.com/Aves83/watt_public) (Commit 4828c89: `doc/technische-erlaeuterung.md`, `doc/datenformat.md`, `schema/` mit den Schemas der Version 19 als Vorabfassung; TE und Datenformat auf dem Stand 85a7f6e von WATT, Kopfzeile „WATT-Version: Vorabfassung“). Die TE vom 25.10.2026 klärt U-1 bis U-17, die Schemas in watt_public klären U-19; WATTest folgt jeweils nur noch der Lesart der TE, Ersatz-Lesarten sind gestrichen. Offen sind U-18 (TE 8., Schritt 5 ist in 4828c89 unverändert) und die neuen Punkte U-20 und U-21.

Keine der drei Beispieldateien (`apfel-16`, `bergamotte-17`, `cherimoya-18`) weicht von der Beschreibung ab: Alle Prüfsummen der Arbeitszeitkette, der Nachweiskette, der Anzeige, der Gesprächsnotiz und des Nachtrags lassen sich nach 4.2 und 5.1 nachrechnen, und der Abgleich nach 7. ergibt keine Abweichung. Die Rechenbeispiele B1 bis B12 aus den Codeblöcken der TE sind unverändert; neu ist B13 (4.6, Maskierung).

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

## Offen

### U-18 `uhr_ruecksprung` in einem Abschnitt mit Bezug

- TE 8., Schritt 5: „Seit dem 24.10.2026 (4.7) steht bei Einträgen mit Uhrstand eine Verstellung in beide Richtungen als uhr_verstellt vor dem auslösenden Eintrag bzw. an ihrem eigenen Zeitpunkt; uhr_ruecksprung folgt dann nur noch, wenn kein Bezug bestand (neustarts größer als 0 oder -1).“ TE 4.7: „Schreibt ein Vorgang mehrere Einträge, nennt der erste die Neustarts, die folgenden 0.“ Die Fälle ohne Bezug nennt 4.7 nur beispielhaft („etwa beim ersten Eintrag nach dem Update, nach einer Wiederherstellung oder ohne Zähler“), und der Bezug selbst steht nie in der Datei.
- Deutung: Auslösend ist bei `objektId` `timer` oder `nachweis` der Vermerk selbst, sonst das Glied unmittelbar davor (`objektId` nennt dessen `seq`). Ein Bezug bestand, wenn das Glied vor dem auslösenden den Uhrstand trägt und jedes Glied vom auslösenden bis zum Vermerk den Uhrstand mit `neustarts` 0 trägt (kein Neustart dazwischen).
- Folge: P4 gibt dann einen Hinweis (i) mit den betroffenen Gliedern, nie ✗ oder „?“: Aus der Datei lässt sich nicht ausschließen, dass der Bezug auf einem anderen Weg fehlte; der Rücksprung selbst ist vermerkt.

### U-20 Einzelnes Ersatzzeichen in den übrigen Prüfsummen

- TE 4.6 („Maskierung“) nennt die Umwandlung eines einzelnen Ersatzzeichens in „?“ für die drei Stellen mit JSON (Bestandsprüfsumme, Klartext-Export für `bestand`, `daten`). Für die übrigen Felder der Kette (4.2) und für die Prüfsummen der Nachweise (5.1), deren Werte ebenfalls „in UTF-8“ eingehen, sagt sie dazu nichts.
- Deutung: Die Umwandlung in UTF-8 ist überall dieselbe.
- Folge: WATTest wandelt in allen Eingaben einer Prüfsumme ein einzelnes Ersatzzeichen in „?“ (E-39). Weicht WATT ab, passt eine solche Prüfsumme nicht; das Zeichen ist über die Oberfläche praktisch nicht einzugeben.

### U-21 Inhalt des Felds `schritte` in `uhr_verstellt`

- TE 4.7 und Datenformat nennen das Feld `schritte` bei summierten kleinen Schritten, beschreiben aber nicht seinen Inhalt (Anzahl oder Liste der Schritte); das Schema 19 legt `daten` nur als Text fest.
- Folge: WATTest prüft nur, ob das Feld vorhanden ist, und rechnet nicht die einzelnen Schritte nach, sondern nur Vorzeichen und Obergrenze über nachher − vorher (U-14).
