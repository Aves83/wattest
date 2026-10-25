// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Gemeinsame Hilfen der Tests.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Anker } from "../src/kern/anker.js";
import type { Befund, Schritt, Zeichen } from "../src/kern/befund.js";
import { utf8 } from "../src/kern/bytes.js";
import type { Optionen } from "../src/kern/kontext.js";
import { pruefe, type Eingabedatei } from "../src/kern/pruefung.js";
import { berlinMinute, zeitpunktMs } from "../src/kern/zeit.js";

export const WURZEL = process.cwd();

export function lies(pfad: string): Uint8Array {
  return readFileSync(join(WURZEL, pfad));
}

export function liesText(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), "utf8");
}

export function beispiel(name: string): Eingabedatei {
  return { name, bytes: lies(`tests/beispiele/${name}`) };
}

export function json(name: string, daten: unknown): Eingabedatei {
  return { name, bytes: utf8(JSON.stringify(daten, null, 2)) };
}

export const JETZT = Date.parse("2026-10-25T12:00:00Z");

export function optionen(weiter: Partial<Optionen> = {}): Optionen {
  return {
    anker: [],
    wurzeln: [],
    wurzelnStand: null,
    sperrliste: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test", eintraege: {} },
    appSignatur: "",
    paketname: "de.achim.watt",
    jetzt: JETZT,
    ...weiter,
  };
}

export async function befund(dateien: Eingabedatei[], weiter: Partial<Optionen> = {}): Promise<Befund> {
  return pruefe(dateien, optionen(weiter), { version: "0.1.5", commit: "test" });
}

/** Schlechtestes Zeichen der Aussagen eines Schritts ohne Hinweise; null, wenn es keine gibt. */
export function zeichen(b: Befund, schritt: Schritt): Zeichen | null {
  const a = b.aussagen.filter((x) => x.schritt === schritt && x.zeichen !== "hinweis");
  if (!a.length) return null;
  if (a.some((x) => x.zeichen === "widerlegt")) return "widerlegt";
  if (a.some((x) => x.zeichen === "offen")) return "offen";
  return "bestaetigt";
}

export function texte(b: Befund, schritt?: Schritt): string {
  return b.aussagen
    .filter((a) => !schritt || a.schritt === schritt)
    .map((a) => `${a.schritt} ${a.zeichen}: ${a.text}${a.details ? "\n    " + a.details.map((d) => d.text).join("\n    ") : ""}`)
    .join("\n");
}

interface GliedTest {
  seq: number;
  zeitpunkt: string;
  hash: string;
  objektArt: string;
  aktion: string;
  daten: string;
}

/** Anker als QR-Code aus dem Kopf einer Kette (Glied seq = n), mit den Zählern nach 6.2. */
export function qrAus(daten: { protokoll: GliedTest[] }, n?: number, extra = ""): string {
  const bis = n === undefined ? daten.protokoll.length - 1 : daten.protokoll.findIndex((x) => x.seq === n);
  const g = daten.protokoll[bis]!;
  let r = 0;
  let w = 0;
  let wa = 0;
  let i = 0;
  for (const x of daten.protokoll.slice(0, bis + 1)) {
    if (["uhr_ruecksprung", "uhr_abweichung", "uhr_verstellt"].includes(x.objektArt)) r++;
    if (x.objektArt === "wiederherstellung") {
      w++;
      if (!x.daten.includes('"vorgeschichte":"UEBEREINSTIMMEND"')) wa++;
    }
    if (x.aktion === "ANGELEGT" && x.daten.includes('"importDatei"')) i++;
  }
  const z = (k: string, v: number): string => (v ? `;${k}=${v}` : "");
  return `watt-pruef:1;v=0.8.109;n=${g.seq};t=${berlinMinute(zeitpunktMs(g.zeitpunkt)!)};sha256=${g.hash}${z("r", r)}${z("w", w)}${z("wa", wa)}${z("i", i)}${extra}`;
}

export function anker(a: Partial<Anker> & { n: number; t: string; sha256: string }): Anker {
  return { quelle: "hand", version: null, r: null, w: null, wa: null, i: null, s: null, unbekannt: [], ...a };
}
