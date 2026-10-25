// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Befund: eine Liste einfacher Aussagen mit ✓ (bestätigt), ? (nicht bestätigbar), ✗ (widerlegt)
// und Hinweisen, die das Gesamtergebnis nicht beeinflussen.

export type Zeichen = "bestaetigt" | "offen" | "widerlegt" | "hinweis";

export type Schritt = "E" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9";

export const SCHRITTNAMEN: Record<Schritt, string> = {
  E: "Eingaben",
  P1: "Format",
  P2: "Arbeitszeitkette",
  P3: "Daten und Kette",
  P4: "Zeit",
  P5: "Anker",
  P6: "Signaturen",
  P7: "Attestierung",
  P8: "Nachweiskette und Dokumente",
  P9: "Besondere Glieder",
};

export interface Detail {
  /** Text ohne Inhalte: Glied-Nummern, Zeitpunkte, Feldnamen, Kennungen */
  text: string;
  /** Inhalte wie Begründungen; nur am Bildschirm, nie im Druck */
  inhalt?: string;
}

export interface Aussage {
  schritt: Schritt;
  /** Datei, zu der die Aussage gehört */
  datei?: string;
  zeichen: Zeichen;
  text: string;
  begruendung: string;
  fundstelle?: string;
  grenze?: string;
  details?: Detail[];
  /** Art eines erwarteten „?“ für die Gesamtzeile: kein Anker, keine Signatur vor Datenformat 19 */
  kennung?: "ohne-anker" | "ohne-signatur";
}

export interface GeprueftDatei {
  name: string;
  groesse: number;
  sha256: string;
  art: string;
}

export interface Stand {
  /** Zeitpunkt des Abrufs (ISO) oder null, wenn nicht verfügbar */
  abgerufen: string | null;
  quelle: string;
  anzahl: number;
}

export interface Befund {
  wattestVersion: string;
  commit: string;
  geprueftAm: string;
  dateien: GeprueftDatei[];
  sperrliste: Stand | null;
  wurzeln: Stand | null;
  aussagen: Aussage[];
  gesamt: Zeichen;
  gesamtText: string;
}

export const SYMBOL: Record<Zeichen, string> = { bestaetigt: "✓", offen: "?", widerlegt: "✗", hinweis: "i" };

export function gesamt(aussagen: Aussage[]): Zeichen {
  if (aussagen.some((a) => a.zeichen === "widerlegt")) return "widerlegt";
  if (aussagen.some((a) => a.zeichen === "offen")) return "offen";
  if (aussagen.some((a) => a.zeichen === "bestaetigt")) return "bestaetigt";
  return "offen";
}

/** Gegenstand je Schritt für den zweiten Satz der Gesamtzeile, mit Angabe der Mehrzahl für das Verb. */
const GEGENSTAND: Record<Schritt, [string, boolean]> = {
  E: ["die Eingaben", true],
  P1: ["das Format", false],
  P2: ["die Arbeitszeitkette", false],
  P3: ["der Abgleich der Daten mit der Kette", false],
  P4: ["die Zeitstempel", true],
  P5: ["die Anker", true],
  P6: ["die Signaturen", true],
  P7: ["die Attestierung", false],
  P8: ["die Nachweiskette", false],
  P9: ["die besonderen Glieder", true],
};

/** Aufzählung der Gegenstände und ob das Verb in der Mehrzahl steht. */
function gegenstaende(schritte: Schritt[]): [string, boolean] {
  return [aufzaehlung(schritte.map((s) => GEGENSTAND[s][0])), schritte.length > 1 || GEGENSTAND[schritte[0]!][1]];
}

const ABFOLGE: Schritt[] = ["E", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"];

/**
 * Gesamtzeile: ✗ vor ? vor ✓. Bei „?“ folgt aus den Ergebnissen, was bestätigt ist und was fehlt. Die Formatversion
 * stammt aus der Datei (`formate`, eine je Klartext).
 */
export function gesamtText(aussagen: Aussage[], formate: (number | null)[] = []): string {
  const z = gesamt(aussagen);
  if (z === "widerlegt") return "Mindestens eine Aussage ist widerlegt.";
  if (z === "bestaetigt") return "Alle Aussagen sind bestätigt.";
  return ["Nicht alles lässt sich bestätigen; nichts ist widerlegt.", ...lage(aussagen, formate)].join(" ");
}

function lage(aussagen: Aussage[], formate: (number | null)[]): string[] {
  const offen = aussagen.filter((a) => a.zeichen === "offen");
  const uebrige = offen.filter((a) => !a.kennung);
  const ohneSignatur = offen.some((a) => a.kennung === "ohne-signatur");
  const ohneAnker = offen.some((a) => a.kennung === "ohne-anker");
  const mehrere = formate.length > 1;
  const saetze: string[] = [];
  const kette = aussagen.some((a) => a.schritt === "P2" && a.zeichen === "bestaetigt");
  if (!uebrige.length && kette) saetze.push(mehrere ? "Die Dateien sind in sich stimmig." : "Die Datei ist in sich stimmig.");
  else if (uebrige.length) {
    const fehlt = ABFOLGE.filter((s) => uebrige.some((a) => a.schritt === s));
    const bestaetigt = ABFOLGE.filter((s) => !fehlt.includes(s) && aussagen.some((a) => a.schritt === s && a.zeichen === "bestaetigt"));
    const [was, mehrzahl] = gegenstaende(fehlt);
    const offenText = `offen ${mehrzahl ? "bleiben" : "bleibt"} ${was} (siehe die Aussagen mit „?“).`;
    if (bestaetigt.length) {
      const [wasB, mehrzahlB] = gegenstaende(bestaetigt);
      saetze.push(`Bestätigt ${mehrzahlB ? "sind" : "ist"} ${wasB}; ${offenText}`);
    } else saetze.push(offenText[0]!.toUpperCase() + offenText.slice(1));
  }
  if (ohneSignatur) {
    const alt = [...new Set(formate.filter((v): v is number => v !== null && v < 19))].sort((a, b) => a - b);
    const wer = alt.length > 1 ? `diese Dateien (Datenformat ${aufzaehlung(alt.map(String))}) keine Signatur haben` : `diese Datei (Datenformat ${alt[0] ?? "?"}) keine Signatur hat`;
    saetze.push(`WATT signiert erst ab Datenformat 19; dass ${wer}, ist kein negativer Befund.`);
  }
  if (ohneAnker) saetze.push("Den Zeitpunkt bestätigt ein Prüfvermerk aus einem Bericht oder einer Anzeige, wenn du ihn hinzufügst.");
  return saetze;
}

export function schlechtestes(aussagen: Aussage[], schritt: Schritt): Zeichen | null {
  const a = aussagen.filter((x) => x.schritt === schritt && x.zeichen !== "hinweis");
  if (!a.length) return aussagen.some((x) => x.schritt === schritt) ? "hinweis" : null;
  return gesamt(a);
}

/** „1 Glied“, „2 Glieder“ usw. */
export function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${zahl(n)} ${n === 1 ? einzahl : mehrzahl}`;
}

/** Ganze Zahl mit Tausenderpunkt, unabhängig von der Sprache des Browsers. */
export function zahl(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  const mit = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : s;
  return (n < 0 ? "-" : "") + mit;
}

export function aufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile.join("");
  return teile.slice(0, -1).join(", ") + " und " + teile[teile.length - 1];
}

/** Liste von Nummern kurz: 1–3, 7, 9–12. */
export function bereiche(nummern: number[], max = 12): string {
  const s = [...new Set(nummern)].sort((a, b) => a - b);
  const teile: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j]! + 1) j++;
    teile.push(i === j ? String(s[i]) : `${s[i]}–${s[j]}`);
    i = j;
  }
  if (teile.length > max) return teile.slice(0, max).join(", ") + ` und ${teile.length - max} weitere`;
  return teile.join(", ");
}
