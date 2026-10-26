// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Kleiner Prüfer für den Teil von JSON Schema, den die Schemas von WATT nutzen
// (type, const, enum, pattern, minimum, maximum, minItems, maxItems, required, properties,
// additionalProperties, items, $ref, oneOf, dependentRequired). Kein vollständiger Validator.

import { SCHEMA_AUSZUG } from "./schema-auszug.js";

/** Muster der Schemas 19 für Base64 ohne Fremdzeichen (kettenschluessel, kettensignaturen). */
const BASE64 = "^[A-Za-z0-9+/]+={0,2}$";

export interface SchemaFehler {
  /** grenze: mehr Elemente als maxItems; seit Version 19 die Grenzen beim Lesen (E-41, E-60): „?“, nicht ✗ */
  art: "fehlt" | "typ" | "unbekannt" | "grenze";
  pfad: string;
  text: string;
}

type Schema = Record<string, unknown>;

function typVon(w: unknown): string {
  if (w === null) return "null";
  if (Array.isArray(w)) return "array";
  if (typeof w === "number") return Number.isInteger(w) ? "integer" : "number";
  return typeof w;
}

function passtTyp(w: unknown, typ: string): boolean {
  const t = typVon(w);
  if (typ === "number") return t === "number" || t === "integer";
  return t === typ;
}

const MUSTER = new Map<string, RegExp>();

function muster(quelle: string): RegExp {
  let re = MUSTER.get(quelle);
  if (!re) MUSTER.set(quelle, (re = new RegExp(quelle, "u")));
  return re;
}

class Pruefer {
  fehler: SchemaFehler[] = [];
  constructor(private defs: Record<string, Schema>) {}

  pruefe(w: unknown, s: Schema, pfad: string, sammeln = true): boolean {
    const vorher = this.fehler.length;
    this.pruefeIntern(w, s, pfad);
    const ok = this.fehler.filter((f, i) => i >= vorher && f.art !== "unbekannt").length === 0;
    if (!sammeln) this.fehler.length = vorher;
    return ok;
  }

  private pruefeIntern(w: unknown, s: Schema, pfad: string): void {
    if (typeof s["$ref"] === "string") {
      const name = (s["$ref"] as string).replace("#/$defs/", "");
      const d = this.defs[name];
      if (d) this.pruefeIntern(w, d, pfad);
      return;
    }
    if (Array.isArray(s["oneOf"])) {
      const varianten = s["oneOf"] as Schema[];
      // Erste passende Variante nehmen; ihre Hinweise auf unbekannte Felder behalten.
      for (const v of varianten) {
        if (this.pruefe(w, v, pfad, false)) {
          this.pruefe(w, v, pfad, true);
          break;
        }
        if (v === varianten[varianten.length - 1]) {
          this.fehler.push({ art: "typ", pfad, text: `${pfad}: Wert passt zu keiner erlaubten Form` });
        }
      }
    }
    if (s["type"] !== undefined) {
      const typen = Array.isArray(s["type"]) ? (s["type"] as string[]) : [s["type"] as string];
      if (!typen.some((t) => passtTyp(w, t))) {
        this.fehler.push({ art: "typ", pfad, text: `${pfad}: erwartet ${typen.join(" oder ")}, gefunden ${typVon(w)}` });
        return;
      }
    }
    if ("const" in s && w !== s["const"]) this.fehler.push({ art: "typ", pfad, text: `${pfad}: erwartet ${JSON.stringify(s["const"])}` });
    if (Array.isArray(s["enum"]) && !(s["enum"] as unknown[]).includes(w)) this.fehler.push({ art: "typ", pfad, text: `${pfad}: Wert ${JSON.stringify(w)} ist nicht erlaubt` });
    if (typeof s["pattern"] === "string" && typeof w === "string" && !muster(s["pattern"] as string).test(w)) {
      // Base64 ohne Fremdzeichen (Zertifikate und Signaturen, seit Version 19): eine Grenze beim Lesen, kein Typfehler.
      if (s["pattern"] === BASE64) this.fehler.push({ art: "grenze", pfad, text: `${pfad}: kein Base64 ohne Fremdzeichen` });
      else this.fehler.push({ art: "typ", pfad, text: `${pfad}: Form ungültig` });
    }
    if (typeof w === "number") {
      if (typeof s["minimum"] === "number" && w < (s["minimum"] as number)) this.fehler.push({ art: "typ", pfad, text: `${pfad}: kleiner als ${s["minimum"]}` });
      if (typeof s["maximum"] === "number" && w > (s["maximum"] as number)) this.fehler.push({ art: "typ", pfad, text: `${pfad}: größer als ${s["maximum"]}` });
    }
    if (Array.isArray(w)) {
      if (typeof s["minItems"] === "number" && w.length < (s["minItems"] as number)) this.fehler.push({ art: "typ", pfad, text: `${pfad}: zu wenige Elemente` });
      if (typeof s["maxItems"] === "number" && w.length > (s["maxItems"] as number)) this.fehler.push({ art: "grenze", pfad, text: `${pfad}: mehr als ${s["maxItems"]} Elemente` });
      if (s["items"]) w.forEach((x, i) => this.pruefeIntern(x, s["items"] as Schema, `${pfad}[${i}]`));
    }
    if (w && typeof w === "object" && !Array.isArray(w)) {
      const o = w as Record<string, unknown>;
      for (const r of (s["required"] as string[] | undefined) ?? []) {
        if (!(r in o)) this.fehler.push({ art: "fehlt", pfad: `${pfad}.${r}`, text: `${pfad}: Pflichtfeld ${r} fehlt` });
      }
      const dep = s["dependentRequired"] as Record<string, string[]> | undefined;
      if (dep) {
        for (const [k, noetig] of Object.entries(dep)) {
          if (k in o) for (const n of noetig) if (!(n in o)) this.fehler.push({ art: "fehlt", pfad: `${pfad}.${n}`, text: `${pfad}: ${k} ohne ${n}` });
        }
      }
      const props = (s["properties"] as Record<string, Schema> | undefined) ?? {};
      for (const [k, v] of Object.entries(o)) {
        if (props[k]) this.pruefeIntern(v, props[k]!, `${pfad}.${k}`);
        else if (s["additionalProperties"] === false) this.fehler.push({ art: "unbekannt", pfad: `${pfad}.${k}`, text: `${pfad}: unbekanntes Feld ${k}` });
      }
    }
  }
}

export function bekannteVersion(v: unknown): v is number {
  return typeof v === "number" && SCHEMA_AUSZUG[v] !== undefined;
}

/** Prüft eine Datei gegen den Schema-Auszug ihrer Version. */
export function pruefeSchema(daten: Record<string, unknown>, version: number): SchemaFehler[] {
  const s = SCHEMA_AUSZUG[version];
  const p = new Pruefer(s.defs);
  p.pruefe(daten, { type: "object", required: s.required, properties: s.properties, additionalProperties: s.additionalProperties }, "$");
  if (s.vollstaendig && daten["umfang"] !== "BUCHUNGEN") p.pruefe(daten, s.vollstaendig, "$");
  const gesehen = new Set<string>();
  return p.fehler.filter((f) => !gesehen.has(f.text) && gesehen.add(f.text));
}
