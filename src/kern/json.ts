// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// JSON von Dritten lesen: Verschachtelungstiefe begrenzt (GRENZWERTE), Zahlen außerhalb des genau darstellbaren
// Bereichs (über Number.MAX_SAFE_INTEGER) werden mit ihrem Pfad gemeldet statt still gerundet.

import { GRENZWERTE } from "./grenzen.js";

export class JsonFehler extends Error {}

export interface JsonErgebnis {
  wert: unknown;
  /** Pfade und Wortlaut der Zahlen außerhalb des genau darstellbaren Bereichs */
  unsicher: string[];
}

function pfadText(pfad: (string | number)[]): string {
  let s = "$";
  for (const p of pfad) s += typeof p === "number" ? `[${p}]` : `.${p}`;
  return s;
}

/**
 * Durchläuft den Text einmal ohne Rekursion: prüft die Tiefe und sammelt Zahlen, die JavaScript nicht genau
 * darstellen kann. Syntaxfehler meldet anschließend JSON.parse.
 */
function durchlaufe(t: string, maxTiefe: number): string[] {
  const unsicher: string[] = [];
  const pfad: (string | number)[] = [];
  const liste: boolean[] = [];
  let schluessel = "";
  const n = t.length;
  let i = 0;
  while (i < n) {
    const c = t.charCodeAt(i);
    if (c === 0x22) {
      let j = i + 1;
      for (;;) {
        const q = t.indexOf('"', j);
        if (q < 0) return unsicher;
        let b = q - 1;
        while (b > i && t.charCodeAt(b) === 0x5c) b--;
        if ((q - 1 - b) % 2 === 0) {
          j = q;
          break;
        }
        j = q + 1;
      }
      schluessel = j - i <= 200 ? t.slice(i + 1, j) : "…";
      i = j + 1;
    } else if (c === 0x7b || c === 0x5b) {
      if (pfad.length >= maxTiefe) throw new JsonFehler(`Verschachtelung tiefer als die Grenze von ${maxTiefe} Ebenen bei ${pfadText(pfad)}`);
      liste.push(c === 0x5b);
      pfad.push(c === 0x5b ? 0 : "");
      i++;
    } else if (c === 0x7d || c === 0x5d) {
      pfad.pop();
      liste.pop();
      i++;
    } else if (c === 0x3a) {
      if (pfad.length && !liste[liste.length - 1]) pfad[pfad.length - 1] = schluessel;
      i++;
    } else if (c === 0x2c) {
      const k = pfad.length - 1;
      if (k >= 0 && liste[k]) pfad[k] = (pfad[k] as number) + 1;
      i++;
    } else if (c === 0x2d || (c >= 0x30 && c <= 0x39)) {
      let j = i + 1;
      while (j < n) {
        const d = t.charCodeAt(j);
        if ((d >= 0x30 && d <= 0x39) || d === 0x2e || d === 0x65 || d === 0x45 || d === 0x2b || d === 0x2d) j++;
        else break;
      }
      // Erst ab 16 Ziffern oder mit Exponent kann eine Zahl den genauen Bereich verlassen.
      if (j - i >= 16 || /[eE]/.test(t.slice(i, j))) {
        const w = Number(t.slice(i, j));
        if (!Number.isFinite(w) || Math.abs(w) > Number.MAX_SAFE_INTEGER) {
          if (unsicher.length < 1000) unsicher.push(`${pfadText(pfad)} = ${t.slice(i, Math.min(j, i + 40))}`);
        }
      }
      i = j;
    } else i++;
  }
  return unsicher;
}

/** Liest JSON mit Tiefengrenze; wirft JsonFehler bei zu tiefer Verschachtelung oder ungültigem JSON. */
export function leseJson(text: string, maxTiefe: number = GRENZWERTE.jsonTiefe): JsonErgebnis {
  const unsicher = durchlaufe(text, maxTiefe);
  try {
    return { wert: JSON.parse(text), unsicher };
  } catch (e) {
    throw new JsonFehler((e as Error).message);
  }
}
