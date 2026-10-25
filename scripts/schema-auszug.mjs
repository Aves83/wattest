// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt src/kern/schema-auszug.ts aus den JSON-Schemas von WATT (Versionen 16 bis 19):
// die Teile, die WATTest liest, ohne Beschreibungen. Andere Definitionen werden nur auf ihren Typ geprüft.
// Quelle ist Aves83/watt_public (schema/). Versionen, die die README dort als Vorabfassung führt
// („| 19 (Vorabfassung) |“), stehen in SCHEMA_VORABFASSUNG; P1 nennt das im Befund.
// Aufruf: node scripts/schema-auszug.mjs <Ordner mit watt-daten-<Version>.schema.json und README.md>

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ordner = process.argv[2] ?? "referenz/watt_public";
const GELESEN = [
  "zeitpunkt", "zeitpunktOderNull", "tag", "tagOderNull", "hash", "textOderNull",
  "eintrag", "abwesenheit", "glied", "kettenschluessel", "kettensignatur",
  "nachweise", "anzeige", "anzeigeKopie", "kettenkopf", "dokument", "notiz", "anhang",
  "gespraech", "nachtrag", "nachweisglied",
];
const WEG = new Set(["description", "title", "default", "format", "contentEncoding", "contentMediaType", "$comment", "examples"]);

// Entfernt Schlüsselwörter ohne Bedeutung für die Prüfung; Namen unter "properties" bleiben (dort ist z. B. "format" ein Feld).
function bereinige(x, istProperties = false) {
  if (Array.isArray(x)) return x.map((y) => bereinige(y));
  if (x && typeof x === "object") {
    const o = {};
    for (const [k, v] of Object.entries(x)) {
      if (istProperties) o[k] = bereinige(v);
      else if (!WEG.has(k)) o[k] = bereinige(v, k === "properties");
    }
    return o;
  }
  return x;
}

// Zeilen der Versionstabelle wie „| 19 (Vorabfassung) | …“.
const readme = readFileSync(join(ordner, "README.md"), "utf8");
const vorab = [...readme.matchAll(/^\| (\d+) \(Vorabfassung\) \|/gm)].map((m) => Number(m[1]));

const aus = {};
for (const v of [16, 17, 18, 19]) {
  const s = JSON.parse(readFileSync(join(ordner, `watt-daten-${v}.schema.json`), "utf8"));
  const defs = {};
  for (const [k, d] of Object.entries(s.$defs)) {
    if (GELESEN.includes(k)) defs[k] = bereinige(d);
    else defs[k] = d.type ? { type: d.type } : {};
  }
  aus[v] = {
    required: s.required,
    properties: bereinige(s.properties, true),
    additionalProperties: s.additionalProperties,
    vollstaendig: s.else ? bereinige(s.else) : null,
    defs,
  };
}

const kopf = `// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt von scripts/schema-auszug.mjs aus den JSON-Schemas 16 bis 19 von WATT (Aves83/watt_public, schema/,
// CC BY 4.0, Hans-Joachim Steudel). Nicht von Hand ändern.

/** Versionen, deren Schema die README in schema/ als Vorabfassung führt. */
export const SCHEMA_VORABFASSUNG: readonly number[] = ${JSON.stringify(vorab)};

/* eslint-disable */
export const SCHEMA_AUSZUG: Record<number, any> = `;
writeFileSync("src/kern/schema-auszug.ts", kopf + JSON.stringify(aus) + ";\n");
console.log("geschrieben, Vorabfassung:", vorab.join(", ") || "keine");
