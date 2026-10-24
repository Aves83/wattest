// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Grenzen der Aussagen nach Abschnitt 9 (und 4.7) der Technischen Erläuterung von WATT.

export const GRENZE = {
  kette:
    "Ohne Anker ist eine vollständig neue, in sich stimmige Kette nicht erkennbar, ebenso eine am Ende gekürzte Kette (Technische Erläuterung, Abschnitt 9).",
  daten:
    "Verglichen werden die Felder, die das Protokoll trägt; Einstellungen, Kategorien und Stundenplan stehen nicht in der Kette (Technische Erläuterung, 4.1 und 7).",
  zeit:
    "Die Zeitstempel stammen von der Uhr des Geräts. Eine von Anfang an falsch gehende Uhr fällt nicht auf; über einen Neustart hinweg bleibt nur der Vermerk eines Rücksprungs (Technische Erläuterung, Abschnitt 9).",
  zeitAlt:
    "Vor dem 24.10.2026 vermerkte WATT nur Rücksprünge um mehr als 2 Minuten zwischen zwei Einträgen; eine vorgestellte Uhr und eine zurück- und wieder vorgestellte Uhr fallen dort nicht auf (Technische Erläuterung, Abschnitt 9).",
  anker:
    "Ein Anker belegt die Glieder bis zu seinem Stand. Über spätere Glieder sagt er nichts, und über die Zeit vor dem ersten Anker sagt das nichts (Technische Erläuterung, 6 und 9).",
  inhalt:
    "Die Kette belegt, wann etwas erfasst wurde, nicht, ob es stimmt; es handelt sich um eine Selbstaufzeichnung (Technische Erläuterung, Abschnitt 9).",
  signatur:
    "Eine Signatur trägt keinen Zeitstempel eines Dritten und belegt die Herkunft aus WATT auf einem Gerät, nicht die Person, die es bediente. Eine Kette vor dem ersten Anker bleibt ohne äußeren Vergleich (Technische Erläuterung, 4.7).",
  attestierung:
    "Die Bestätigung beruht auf dem Vertrauen in Google und die Gerätehersteller, deren Schlüssel die Zertifikate ausstellen (Technische Erläuterung, 4.7).",
  nachweis:
    "Die Nachweiskette enthält nur Art, Zeitpunkt, Referenz und Prüfsumme; Anhänge an Anzeigen sind kein Teil des Nachweises (Technische Erläuterung, 5 und 5.1).",
  besondere:
    "Die Übersicht zeigt, was die Kette selbst vermerkt; Erfassungs- und Änderungszeitpunkte eingelesener Buchungen stammen aus der Datei des anderen Geräts (Technische Erläuterung, 7.1 und 9).",
  aktenauszug:
    "SHA256SUMS.txt liegt im selben ZIP wie die Dokumente; allein belegt sie nur, dass Liste und Dateien zusammenpassen. Erst der Abgleich mit der Nachweiskette oder einem Anker bindet sie an WATT (Technische Erläuterung, 5.1 und 8).",
} as const;
