// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Grenzen der Aussagen nach Abschnitt 9 (und 4.7) der Technischen Erläuterung von WATT.

export const GRENZE = {
  kette:
    "Ohne Anker ist eine vollständig neue, in sich stimmige Kette nicht erkennbar, ebenso eine am Ende gekürzte Kette (Technische Erläuterung, Abschnitt 9).",
  daten:
    "Verglichen werden die Felder, die das Protokoll trägt; Einstellungen, Kategorien und Stundenplan stehen nicht in der Kette (Technische Erläuterung, 4.1 und 7).",
  zeit:
    "Die Zeitstempel stammen von der Uhr des Geräts; es gibt keinen unabhängigen Zeitstempeldienst, und eine von Anfang an falsch gehende Uhr fällt nie auf. Über einen Neustart hinweg prüft WATT nur, ob der neue Gerätestart nach dem alten beginnt, sonst bleibt der Vermerk eines Rücksprungs (Technische Erläuterung, 4.7 und 9).",
  zeitAlt:
    "Bei Gliedern ohne Uhrstand (Formatversion 18 und früher) vermerkte WATT nur Rücksprünge um mehr als 2 Minuten zwischen zwei Gliedern; kleinere Rücksprünge, eine vorgestellte Uhr und eine zurück- und wieder vorgestellte Uhr fallen dort nicht auf (Technische Erläuterung, Abschnitt 9).",
  anker:
    "Ein Anker belegt die Glieder bis zu seinem Stand. Über spätere Glieder sagt er nichts, und über die Zeit vor dem ersten Anker sagt das nichts (Technische Erläuterung, 6 und 9).",
  inhalt:
    "Die Kette belegt, wann etwas erfasst wurde, nicht, ob es stimmt; es handelt sich um eine Selbstaufzeichnung (Technische Erläuterung, Abschnitt 9).",
  signatur:
    "Eine Signatur trägt keinen Zeitstempel eines Dritten und belegt die Herkunft aus dem echten WATT auf einem bestätigten Gerät, nicht die Person, die es bediente. Eine Kette vor dem ersten Anker bleibt ohne äußeren Vergleich (Technische Erläuterung, 4.7 und 10.).",
  attestierung:
    "Die Bestätigung beruht auf dem Vertrauen in Google und die Gerätehersteller, deren Schlüssel die Zertifikate ausstellen (Technische Erläuterung, 4.7).",
  nachweis:
    "Die Nachweiskette enthält nur Art, Zeitpunkt, Referenz und Prüfsumme; Anhänge an Anzeigen sind kein Teil des Nachweises (Technische Erläuterung, 5 und 5.1).",
  importiertAm:
    "„Importiert am“ lässt sich in einer Datei nicht unbemerkt entfernen oder hinzufügen, außer im Altfall: an einem Datensatz des Bestands, den nach einem Neubeginn ein Änderungs-Glied ohne Uhrstand geändert hat, und bei Start-Gliedern in Form 1 an einem seither unveränderten Datensatz; dort gilt der Wert der Datei (Technische Erläuterung, 7.1 und 9).",
  herkunft:
    "Eine gültige Signatur deckt hinsichtlich der Herkunft nur die Glieder ihres Abschnitts ab der letzten Wiederherstellung bzw. dem Neubeginn; bei eingelesenen Buchungen belegt sie das Einlesen, nicht Erfassungs- und Änderungszeitpunkt aus der Datei, und den Bestand eines Neubeginns deckt sie nicht (Technische Erläuterung, 4.7 und 10.).",
  besondere:
    "Die Übersicht zeigt, was die Kette selbst vermerkt; Erfassungs- und Änderungszeitpunkte eingelesener Buchungen stammen aus der Datei des anderen Geräts (Technische Erläuterung, 7.1 und 9).",
  aktenauszug:
    "SHA256SUMS.txt liegt im selben ZIP wie die Dokumente; allein belegt sie nur, dass Liste und Dateien zusammenpassen. Erst der Abgleich mit der Nachweiskette oder einem Anker bindet sie an WATT (Technische Erläuterung, 5.1 und 8).",
} as const;

// Feste Grenzen für Eingaben von Dritten (Härtung, WATTest 0.1.5). Großzügig gewählt: Echte Exporte von WATT liegen
// weit darunter. Darüber meldet WATTest „?“ mit Hinweis auf die Grenze, nie einen Absturz und nie ✗.

const MB = 1024 * 1024;

export const GRENZWERTE = {
  /** Größe einer geprüften Datei */
  dateiBytes: 200 * MB,
  /** Glieder der Arbeitszeitkette */
  glieder: 1_000_000,
  /** Einträge in kettensignaturen */
  signaturen: 1_000_000,
  /** Einträge in kettenschluessel */
  schluessel: 256,
  /** Zertifikate je Schlüssel */
  zertifikateJeSchluessel: 8,
  /** Größe eines Zertifikats (DER) */
  zertifikatBytes: 8 * 1024,
  /** Größe einer Signatur (DER) */
  signaturBytes: 128,
  /** Verschachtelungstiefe von JSON, auch im Feld daten eines Glieds */
  jsonTiefe: 64,
  /** Verschachtelungstiefe von XML */
  xmlTiefe: 64,
  /** Attribute je XML-Element */
  xmlAttribute: 32,
  /** Verschachtelungstiefe von DER */
  derTiefe: 32,
  /** Tag-Nummer in DER (höchstens zwei Bytes in der langen Form) */
  derTag: 0x3fff,
  /** Einträge in einem ZIP */
  zipEintraege: 10_000,
  /** entpackte Größe eines Eintrags */
  zipEintragBytes: 200 * MB,
  /** entpackte Größe aller Einträge zusammen */
  zipGesamtBytes: 512 * MB,
  /** Kompressionsverhältnis eines Eintrags ab 1 MB entpackter Größe */
  zipVerhaeltnis: 250,
  /** Länge eines Pfads im ZIP (Zeichen) */
  zipPfad: 1024,
} as const;

/** Text der Grenze für Begründungen, z. B. „200 MB“ oder „1.000.000“. */
export function grenzeText(wert: number, einheit?: "bytes"): string {
  if (einheit === "bytes") return wert >= MB ? `${wert / MB} MB` : wert >= 1024 ? `${wert / 1024} KB` : `${wert} Bytes`;
  const s = String(wert);
  return s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : s;
}

export const GRENZE_HAERTUNG =
  "WATTest prüft Dateien von Dritten nur innerhalb fester Grenzen (Größe, Anzahl, Verschachtelung); darüber sagt es nichts über die Datei, sondern meldet „?“.";
