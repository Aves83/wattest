// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt src/kern/xml-typen.ts aus den XSDs von WATT (Versionen 17 bis 19).
// Aufruf: node scripts/xml-typen.mjs <Ordner mit watt-daten-<Version>.xsd>
// Die XSDs liegen nicht im Repository; sie stammen aus docs/schnittstelle/ von WATT.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ordner = process.argv[2] ?? "referenz/schnittstelle";
const typen = {};
const einfach = {};

for (const v of [17, 18, 19]) {
  const xsd = readFileSync(join(ordner, `watt-daten-${v}.xsd`), "utf8");
  for (const m of xsd.matchAll(/<xs:simpleType name="([^"]+)">\s*<xs:restriction base="([^"]+)"/g)) einfach[m[1]] = m[2];
  for (const m of xsd.matchAll(/<xs:complexType name="([^"]+)">([\s\S]*?)<\/xs:complexType>/g)) {
    const name = m[1];
    const felder = (typen[name] ??= {});
    for (const e of m[2].matchAll(/<xs:element name="([^"]+)" type="([^"]+)"([^>]*)\/?>/g)) {
      felder[e[1]] = { typ: e[2], liste: /maxOccurs="unbounded"/.test(e[3]) };
    }
  }
}

function grund(typ) {
  let t = typ;
  for (let i = 0; i < 10 && einfach[t]; i++) t = einfach[t];
  if (["xs:int", "xs:long", "xs:integer", "xs:decimal", "xs:double"].includes(t)) return "zahl";
  if (t === "xs:boolean") return "bool";
  if (typen[t]) return t;
  return "text";
}

// Ein Typ ist eine Liste, wenn er genau ein Element mit maxOccurs="unbounded" hat.
const ausgabe = {};
for (const [name, felder] of Object.entries(typen)) {
  const eintraege = Object.entries(felder);
  if (eintraege.length === 1 && eintraege[0][1].liste) {
    ausgabe[name] = { liste: eintraege[0][0], von: grund(eintraege[0][1].typ) };
  } else {
    const f = {};
    for (const [k, { typ }] of eintraege) f[k] = grund(typ);
    ausgabe[name] = { felder: f };
  }
}

const kopf = `// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt von scripts/xml-typen.mjs aus den XSDs 17 bis 19 von WATT. Nicht von Hand ändern.

export type XmlTyp = { liste: string; von: string } | { felder: Record<string, string> };

export const XML_TYPEN: Record<string, XmlTyp> = `;
writeFileSync("src/kern/xml-typen.ts", kopf + JSON.stringify(ausgabe, null, 2) + ";\n");
console.log(Object.keys(ausgabe).length, "Typen");
