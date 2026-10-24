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

export function gesamtText(z: Zeichen): string {
  if (z === "widerlegt") return "Mindestens eine Aussage ist widerlegt.";
  if (z === "offen") return "Nicht alles lässt sich bestätigen; nichts ist widerlegt.";
  return "Alle Aussagen sind bestätigt.";
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
