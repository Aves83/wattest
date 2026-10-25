// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Klartext-Export von WATT als Arbeitsgrundlage der Prüfschritte.

import { JsonFehler, leseJson } from "./json.js";
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
  /** daten ist gültiges JSON, aber tiefer verschachtelt als die Grenze; nicht gelesen */
  datenUeberGrenze: boolean;
  /** seq oder neustarts liegen außerhalb des genau darstellbaren Bereichs; die Prüfsumme ist nicht nachrechenbar */
  ungenau: boolean;
}

export interface Klartext {
  name: string;
  quelle: "json" | "xml";
  daten: Record<string, unknown>;
  version: number | null;
  /** Elemente des XML, die WATTest nicht abbilden kann */
  xmlUnbekannt: string[];
  /** Zahlen außerhalb des genau darstellbaren Bereichs (Pfad = Wortlaut), auch im Feld daten der Glieder */
  unsicher: string[];
  /** Dateien unter anhaenge/ eines Klartexts als ZIP */
  anhaenge: { pfad: string; groesse: number }[] | null;
  glieder: Glied[];
}

function text(w: unknown): string {
  return w === null || w === undefined ? "" : String(w);
}

/** Zahl, die JavaScript nicht genau darstellt (über Number.MAX_SAFE_INTEGER oder nicht endlich). */
export function ungenaueZahl(w: unknown): boolean {
  return typeof w === "number" && (!Number.isFinite(w) || Math.abs(w) > Number.MAX_SAFE_INTEGER);
}

function leseDaten(t: string, unsicher: string[], wo: string): { json: Record<string, unknown> | null; ueberGrenze: boolean } {
  try {
    const r = leseJson(t);
    for (const u of r.unsicher) if (unsicher.length < 1000) unsicher.push(`${wo}, daten: ${u}`);
    const j = r.wert;
    return { json: j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null, ueberGrenze: false };
  } catch (e) {
    return { json: null, ueberGrenze: e instanceof JsonFehler && /Grenze/.test(e.message) };
  }
}

export function glieder(daten: Record<string, unknown>, unsicher: string[] = []): Glied[] {
  const liste = Array.isArray(daten["protokoll"]) ? (daten["protokoll"] as unknown[]) : [];
  return liste.map((x, index) => {
    const roh = (x && typeof x === "object" ? x : {}) as GliedRoh;
    const seq = typeof roh.seq === "number" && Number.isSafeInteger(roh.seq) ? roh.seq : null;
    const objektArt = text(roh.objektArt);
    const datenText = text(roh.daten);
    const gelesen = leseDaten(datenText, unsicher, `Glied an Stelle ${index + 1}`);
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
      neustarts: typeof roh.neustarts === "number" && Number.isSafeInteger(roh.neustarts) ? roh.neustarts : null,
      autoZeit: typeof roh.autoZeit === "boolean" ? roh.autoZeit : null,
      form: gliedform(roh),
      roh,
      json: gelesen.json,
      datenUeberGrenze: gelesen.ueberGrenze,
      ungenau: ungenaueZahl(roh.seq) || ungenaueZahl(roh.neustarts),
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
