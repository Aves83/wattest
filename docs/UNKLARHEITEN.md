# Unklarheiten in den Unterlagen von WATT

Stellen, an denen die Unterlagen (Technische Erläuterung, Datenformat, Schemas, Beispieldateien) unklar sind oder einander widersprechen. WATTest entscheidet nach dem Wortlaut der Technischen Erläuterung (TE); jede Stelle nennt Zitat, Deutung und Folge. Stand: WATTest 0.1.0, Unterlagen vom 25.10.2026 (Branch `feat/attestierte-kette` von WATT).

Keine der drei Beispieldateien (`apfel-16`, `bergamotte-17`, `cherimoya-18`) weicht von der Beschreibung ab: Alle Prüfsummen der Arbeitszeitkette, der Nachweiskette, der Anzeige, der Gesprächsnotiz und des Nachtrags lassen sich nach 4.2 und 5.1 nachrechnen, und der Abgleich nach 7. ergibt keine Abweichung.

## U-1 Zähler `i` im QR-Code: nur Einträge oder auch Abwesenheiten?

- TE 6.2: „gegebenenfalls ‚Aus einer Datei eingelesene Einträge: <Anzahl>.‘ – gezählt werden die Anlage-Einträge eintrag mit importDatei (4.1)“; zum QR-Code nur „bei eingelesenen Buchungen ;i=<Anzahl>“. TE 7.1: „der QR-Code des Prüfvermerks ihre Anzahl (i=…)“ (gemeint: der eingelesenen Einträge).
- Datenformat, QR-Code: „`i`: Anzahl der aus einer Datei eingelesenen Einträge und Abwesenheiten mit Gutschrift (Anlage-Glieder mit `importDatei`)“.
- Deutung: Der Wortlaut der TE zählt Glieder `eintrag`, das Datenformat zusätzlich `abwesenheit`.
- Folge: WATTest lässt beide Zählweisen gelten; erst wenn `i` zu keiner passt, ist der Anker widerlegt. WATT sollte eine Fassung festlegen.

## U-2 Seit welcher Formatversion gibt es XML?

- `docs/schnittstelle/README.md`, Version 18: „Erste Version mit XML-Export; dazu das XML Schema `watt-daten-18.xsd`.“ Die Tabelle nennt für Version 17 nur `watt-daten-17.schema.json`.
- Datenformat: „XML Schema `watt-daten-<Version>.xsd` je Formatversion ab 17“; `watt-daten-17.xsd` liegt im Ordner; „Seit dem 16.10.2026 (F-223) exportiert WATT den Klartext wahlweise als XML“.
- Folge: WATTest liest XML der Versionen 17 bis 19 (wie der Auftrag). Bei XML der Version 16 meldet P1 „?“.

## U-3 Welche Notizen gehen in die Prüfsumme einer Anzeige ein?

- TE 5.1: „Anzahl der Notizen, die beim Markieren als gesendet vorhanden waren, danach je Notiz Zeitpunkt und Text“.
- Datenformat: `notizen` mit `fest` („`fest` gehören zum Nachweis“) und `nachVersand`.
- Deutung: Die Notizen mit `fest` true. Ebenso denkbar: alle mit `nachVersand` false.
- Folge: WATTest rechnet mit `fest`. Stimmt die Prüfsumme nur mit der anderen Lesart, gilt sie als bestätigt, und der Befund nennt das. In `cherimoya-18` gibt es eine Notiz, auf die beide Lesarten passen.

## U-4 Nachtrag nach 4.5: Erfassung oder letzte Änderung?

- TE 4.5: „Jeder Eintrag speichert, wann er erfasst und zuletzt geändert wurde. Liegt dieser Zeitpunkt mehr als 24 Stunden nach dem Ende der Tätigkeit, kennzeichnet WATT den Eintrag mit dem Abstand („ca. x Stunden“ bzw. „ca. x Tage“).“
- Deutung: „dieser Zeitpunkt“ kann die Erfassung oder die letzte Änderung meinen. Ab wann „Tage“ statt „Stunden“ gilt, steht nicht da.
- Folge: P9 nennt „erfasst … nach Ende“ und, wenn die Erfassung rechtzeitig war, „zuletzt geändert … nach Ende“; bis 48 Stunden in Stunden, darüber in Tagen (gerundet). P9 gibt hier nur Hinweise.

## U-5 Rücksprung beim Festhalten eines Nachweises

- TE 8., Schritt 5: Nach einem Rücksprung muss ein `uhr_ruecksprung` folgen, „außer der Eintrag ist selbst ein uhr_ruecksprung mit objektId timer“.
- TE 4.1 beschreibt dasselbe für `objektId` `nachweis` („folgt in der Arbeitszeitkette der Vermerk uhr_ruecksprung mit objektId nachweis“).
- Folge: WATTest behandelt `nachweis` wie `timer`.

## U-6 Zeitpunkt eines Glieds `uhr_verstellt`

- TE 8., Schritt 5: „eine Verstellung in beide Richtungen als uhr_verstellt vor dem auslösenden Eintrag bzw. an ihrem eigenen Zeitpunkt“.
- Deutung: Ob das Glied `uhr_verstellt` die Zeit vor oder nach der Verstellung trägt, steht nicht da.
- Folge: Ein Rücksprung gilt als vermerkt, wenn das springende Glied selbst oder sein Vorgänger ein `uhr_verstellt` ist.

## U-7 Abschnitte bei einem Glied `schluessel` ohne Schlüssel

- TE 4.7, Schritt 7: „Jede Signatur mit dem Schlüssel ihres Abschnitts (vom Eintrag schluessel bis vor den nächsten)“.
- Deutung: Ein Glied `schluessel` mit `status` `nicht_verfuegbar` beendet den Abschnitt des vorigen Schlüssels.
- Folge: Danach gilt der Abschnitt als ohne Schlüssel; eine Signatur dort ist ungültig.

## U-8 Challenge „bei einer leeren Kette“

- TE 4.7: „Challenge ist der Hash des Eintrags vor dem Eintrag schluessel als 32 Bytes, bei einer leeren Kette 32 Zufallsbytes, die im Eintrag stehen.“
- Deutung: Der gespeicherte `hash` des Vorgängers, hexadezimal in 32 Bytes gewandelt; „leere Kette“ heißt, das Glied `schluessel` ist Glied 1.
- Folge: So prüft P7.

## U-9 Gültigkeit der Zertifikate „zum Zeitpunkt der Erzeugung“

- TE 4.7, Schritt 1: „jedes Zertifikat muss vom nächsten signiert und zum Zeitpunkt der Erzeugung gültig gewesen sein.“ Die Liste „widerlegt“ nennt diesen Fall nicht.
- Deutung: Der Zeitpunkt der Erzeugung ist der des Glieds `schluessel` nach der Geräteuhr.
- Folge: Liegt er außerhalb der Gültigkeit, ist die Teilaussage „?“ (die Uhr des Geräts kann falsch gehen), nicht „✗“.

## U-10 RootOfTrust nicht „Verified“

- TE 4.7, Schritt 4 verlangt `verifiedBootState` Verified und `deviceLocked` true; die Liste „widerlegt“ nennt den Fall nicht.
- Folge: WATTest meldet „?“ (nicht bestätigt), nicht „✗“. Siehe auch `docs/ENTSCHEIDUNGEN.md`, E-5.

## U-11 Name des Listenelements `anhaenge` im XML

- Datenformat, XML-Darstellung: Die Liste der Singularformen nennt `anhaenge` nicht; `watt-daten-19.xsd` nutzt `anhang`.
- Folge: WATTest liest `anhang` (Typtabelle aus der XSD).

## U-12 Fingerabdruck des App-Signaturzertifikats

- TE 4.7, Schritt 3 nennt bereits „SHA-256 des App-Signaturzertifikats 4accbc1ff7bb15f57a2364e39906568e01c4e4b53e4e5d63e77148eb3bfa99d9“. Die Spezifikation von WATTest sieht vor, ihn aus der Veröffentlichung in watt_public zu übernehmen.
- Folge: `daten/app-signatur.json` bleibt nach dem Auftrag leer („noch nicht veröffentlicht“), bis WATT ihn veröffentlicht; die Teilaussage ist bis dahin „?“. Siehe `docs/ENTSCHEIDUNGEN.md`, E-3.

## U-13 Prüfsumme des Datenbestands beim Neubeginn

- TE 4.6: „Nachrechnen lässt sich das mit einem Klartext-Export als JSON (nicht XML), der unmittelbar nach dem Neubeginn entstand“.
- Folge: WATTest rechnet `bestand` nicht aus einem späteren Export nach (das geht nach der TE nicht); es zeigt den Wert in P9. Die kanonische Form ist mit Rechenbeispiel B3 getestet (`bestandDatenEingabe`).
