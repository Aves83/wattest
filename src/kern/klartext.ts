// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Klartext-Export von WATT als Arbeitsgrundlage der Prüfschritte.

import { gliedform, type GliedRoh, type Gliedform } from "./kanonisch.js";
import { zeitpunktMs } from "./zeit.js";

export interface Glied {
  index: number;
  seq: number | null;
  zeitpunkt: string;
  ms: number | null;
  aktion: string;
  objektArt: string;
  objektId: string;
  daten: string;
  prev: string;
  hash: string;
  neustarts: number | null;
  autoZeit: boolean | null;
  form: Gliedform;
  roh: GliedRoh;
  /** daten als JSON, null wenn nicht lesbar */
  json: Record<string, unknown> | null;
}

export interface Klartext {
  name: string;
  quelle: "json" | "xml";
  daten: Record<string, unknown>;
  version: number | null;
  /** Elemente des XML, die WATTest nicht abbilden kann */
  xmlUnbekannt: string[];
  /** Dateien unter anhaenge/ eines Klartexts als ZIP */
  anhaenge: { pfad: string; groesse: number }[] | null;
  glieder: Glied[];
}

function text(w: unknown): string {
  return w === null || w === undefined ? "" : String(w);
}

function leseJson(t: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(t);
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function glieder(daten: Record<string, unknown>): Glied[] {
  const liste = Array.isArray(daten["protokoll"]) ? (daten["protokoll"] as unknown[]) : [];
  return liste.map((x, index) => {
    const roh = (x && typeof x === "object" ? x : {}) as GliedRoh;
    const seq = typeof roh.seq === "number" && Number.isInteger(roh.seq) ? roh.seq : null;
    const objektArt = text(roh.objektArt);
    const datenText = text(roh.daten);
    return {
      index,
      seq,
      zeitpunkt: text(roh.zeitpunkt),
      ms: zeitpunktMs(roh.zeitpunkt),
      aktion: text(roh.aktion),
      objektArt,
      objektId: text(roh.objektId),
      daten: datenText,
      prev: text(roh.prev),
      hash: text(roh.hash),
      neustarts: typeof roh.neustarts === "number" ? roh.neustarts : null,
      autoZeit: typeof roh.autoZeit === "boolean" ? roh.autoZeit : null,
      form: gliedform(roh),
      roh,
      json: leseJson(datenText),
    };
  });
}

export function gliedName(g: Glied): string {
  return `Glied ${g.seq ?? `an Stelle ${g.index + 1}`}`;
}

export function liste(o: unknown): Record<string, unknown>[] {
  return Array.isArray(o) ? (o.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}

export function objekt(o: unknown): Record<string, unknown> | null {
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
}
