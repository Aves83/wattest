# Unklarheiten in den Unterlagen von WATT

Stellen, an denen die Unterlagen (Technische Erläuterung, Datenformat, Schemas, Beispieldateien) unklar sind oder einander widersprechen. WATTest entscheidet nach dem Wortlaut der Technischen Erläuterung (TE); jede Stelle nennt Zitat, Deutung und Folge.

Stand: WATTest 0.1.1, Unterlagen vom 25.10.2026 (Branch `feat/attestierte-kette` von WATT, Commit 97d9f96; TE jetzt `docs/app-texte/technische-erlaeuterung.md`). Die TE vom 25.10.2026 klärt U-1 bis U-13; WATTest folgt jeweils nur noch der Lesart der TE, Ersatz-Lesarten sind gestrichen.

Keine der drei Beispieldateien (`apfel-16`, `bergamotte-17`, `cherimoya-18`) weicht von der Beschreibung ab: Alle Prüfsummen der Arbeitszeitkette, der Nachweiskette, der Anzeige, der Gesprächsnotiz und des Nachtrags lassen sich nach 4.2 und 5.1 nachrechnen, und der Abgleich nach 7. ergibt keine Abweichung. Die Rechenbeispiele B1 bis B12 aus den Codeblöcken der TE sind unverändert.

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

## Offen

### U-14 Vorzeichen von `abweichungSekunden` bei `richtung` `zurueck`

- TE 4.7: „die Abweichung ist positiv bei vorgestellter Uhr“; ob sie bei zurückgestellter Uhr negativ ist oder als Betrag steht, sagt die TE nicht ausdrücklich. Bei `schritte` nennt `abweichungSekunden` „die Summe der Beträge“.
- Folge: WATTest vergleicht Beträge und prüft die Richtung über `richtung` und das Vorzeichen von nachher − vorher. Bei `schritte` darf |nachher − vorher| die Summe der Beträge nicht übersteigen.

### U-15 Erster Teil der Zerlegung „nie negativ“

- TE 4.7: Der erste Teil (vorher − zeitpunkt(voriges)) ist „die tatsächlich verstrichene Zeit nach der Monotonuhr, bis auf unvermerkte Abweichungen von höchstens 2 Minuten …; er ist nie negativ.“
- Deutung: Unvermerkte Korrekturen bis 2 Minuten (z. B. der Netzzeit) können `vorher` knapp vor das vorige Glied legen.
- Folge: WATTest lässt bis zu 2 Minuten zu (E-28).

### U-16 Zeitpunkt der Erzeugung: Glied oder `creationDateTime`?

- TE 4.7, Schritt 1: „Die Gültigkeitszeiträume zum Zeitpunkt der Erzeugung prüfen (Zeitpunkt des Eintrags schluessel bzw. creationDateTime, beide nach der Geräteuhr).“
- Deutung: Beide Angaben stammen von der Geräteuhr und sollten nahe beieinander liegen.
- Folge: WATTest prüft am Zeitpunkt des Glieds `schluessel`, wie bisher.

### U-17 Maskierung in der Eingabe der Bestandsprüfsumme

- TE 4.6 legt Einrückung, Zeilenende und Feldreihenfolge fest, nicht aber die Maskierung von Zeichen in Texten (etwa Nicht-ASCII-Zeichen oder `/`).
- Folge: WATTest schreibt wie `JSON.stringify` (keine Maskierung von Nicht-ASCII und `/`). Rechenbeispiel B3 enthält keine solchen Zeichen. Weicht WATT ab, bleibt ein passender Export unbestätigt (Hinweis), nie ✗.
