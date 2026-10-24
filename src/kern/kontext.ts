// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Gemeinsamer Zustand der Prüfschritte für einen Klartext.

import type { Anker } from "./anker.js";
import type { Aussage, Schritt, Zeichen, Detail } from "./befund.js";
import type { Klartext } from "./klartext.js";

export interface Sperreintrag {
  status: string;
  reason?: string;
  expires?: string;
}

export interface Sperrliste {
  abgerufen: string | null;
  quelle: string;
  eintraege: Record<string, Sperreintrag>;
}

export interface Optionen {
  anker: Anker[];
  /** Vertrauensanker (DER); im Betrieb die Wurzeln von Google, in Tests eigene */
  wurzeln: Uint8Array[];
  wurzelnStand: { abgerufen: string | null; quelle: string } | null;
  sperrliste: Sperrliste | null;
  /** SHA-256 des App-Signaturzertifikats von WATT (hex), leer, solange nicht veröffentlicht */
  appSignatur: string;
  paketname: string;
  /** Zeitpunkt der Prüfung (ms) */
  jetzt: number;
  fortschritt?: (anteil: number, text: string) => void;
}

export type SignaturStatus = "gueltig" | "ungueltig" | "unpruefbar";

export interface Kontext {
  kt: Klartext;
  optionen: Optionen;
  aussagen: Aussage[];
  /** neu berechnete Prüfsumme je Glied (Index) */
  berechnet: string[];
  /** Index des ersten Bruchs der Kette oder null */
  ersterBruch: number | null;
  /** Ergebnis der Signaturprüfung je seq */
  signaturen: Map<number, SignaturStatus>;
  /** Fortschritt innerhalb dieses Klartexts, 0 bis 1 */
  melde(anteil: number, text: string): void;
}

export function sage(
  k: { aussagen: Aussage[]; kt?: { name: string }; datei?: string },
  schritt: Schritt,
  zeichen: Zeichen,
  text: string,
  begruendung: string,
  weiter: { fundstelle?: string; grenze?: string; details?: Detail[] } = {},
): Aussage {
  const datei = k.kt?.name ?? k.datei;
  const a: Aussage = { schritt, ...(datei ? { datei } : {}), zeichen, text, begruendung, ...weiter };
  k.aussagen.push(a);
  return a;
}

export function dateiFundstelle(k: Kontext, mehr?: string): string {
  return mehr ? `${mehr}, Datei „${k.kt.name}“` : `Datei „${k.kt.name}“`;
}
