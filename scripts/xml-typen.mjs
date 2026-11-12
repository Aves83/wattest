// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt src/kern/xml-typen.ts aus den XSDs von WATT (Versionen 18 und 19, Aves83/watt_public, schema/).
// Aufruf: node scripts/xml-typen.mjs <Ordner mit watt-daten-<Version>.xsd>
// Die XSDs liegen nicht im Repository. Eine XSD 17 ist nicht veröffentlicht (U-2); XML der Version 17 liest
// WATTest mit derselben Tabelle, deren Typen die Felder der Version 17 enthalten.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ordner = process.argv[2] ?? "referenz/watt_public";
const typen = {};
const einfach = {};

/** Inhalt eines complexType ab der Stelle hinter seinem öffnenden Tag bis zum passenden Ende; anonyme Typen darin zählen mit. */
function inhaltBis(text, ab) {
  const re = /<xs:complexType\b[^>]*>|<\/xs:complexType>/g;
  re.lastIndex = ab;
  let tiefe = 1;
  for (let m; (m = re.exec(text)); ) {
    if (m[0].startsWith("</")) {
      if (--tiefe === 0) return { inhalt: text.slice(ab, m.index), ende: re.lastIndex };
    } else if (!m[0].endsWith("/>")) tiefe++;
  }
  throw new Error("complexType nicht geschlossen");
}

/**
 * Liest die Elemente eines Typs. Ein Element ohne type-Attribut mit einem anonymen complexType aus Elementen (XSD 19:
 * zertifikate im Typ Kettenschluessel) erhält den Typnamen <Typ>.<Element>; seine Elemente gehören nicht zum äußeren Typ.
 * Ein anonymer Typ ohne Elemente (antwort: Zahl mit Attribut schluessel) bleibt außen vor, ihn liest xml.ts selbst.
 */
function liesTyp(name, inhalt) {
  const felder = (typen[name] ??= {});
  const re = /<xs:element name="([^"]+)"([^>]*?)(\/?)>/g;
  for (let m; (m = re.exec(inhalt)); ) {
    const [, feld, attribute, leer] = m;
    // Liste: maxOccurs unbounded oder eine Zahl größer als 1 (seit Version 19 z. B. 256 Schlüssel, 8 Zertifikate).
    const max = /maxOccurs="([^"]+)"/.exec(attribute)?.[1];
    const liste = max === "unbounded" || (max !== undefined && Number(max) > 1);
    const typ = /type="([^"]+)"/.exec(attribute)?.[1];
    if (typ) {
      felder[feld] = { typ, liste };
      continue;
    }
    const auf = /\s*<xs:complexType>/y;
    auf.lastIndex = re.lastIndex;
    if (leer || !auf.test(inhalt)) continue;
    const innen = inhaltBis(inhalt, auf.lastIndex);
    re.lastIndex = innen.ende;
    if (!innen.inhalt.includes("<xs:element ")) continue;
    felder[feld] = { typ: `${name}.${feld}`, liste };
    liesTyp(`${name}.${feld}`, innen.inhalt);
  }
}

for (const v of [18, 19]) {
  const xsd = readFileSync(join(ordner, `watt-daten-${v}.xsd`), "utf8");
  for (const m of xsd.matchAll(/<xs:simpleType name="([^"]+)">\s*<xs:restriction base="([^"]+)"/g)) einfach[m[1]] = m[2];
  const re = /<xs:complexType name="([^"]+)">/g;
  for (let m; (m = re.exec(xsd)); ) {
    const innen = inhaltBis(xsd, re.lastIndex);
    liesTyp(m[1], innen.inhalt);
    re.lastIndex = innen.ende;
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

// Ein Typ ist eine Liste, wenn er genau ein Element hat, das mehrfach vorkommen kann.
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

// Erzeugt von scripts/xml-typen.mjs aus den XSDs 18 und 19 von WATT (Aves83/watt_public, schema/,
// CC BY 4.0, Hans-Joachim Steudel). Nicht von Hand ändern.

export type XmlTyp = { liste: string; von: string } | { felder: Record<string, string> };

export const XML_TYPEN: Record<string, XmlTyp> = `;
writeFileSync("src/kern/xml-typen.ts", kopf + JSON.stringify(ausgabe, null, 2) + ";\n");
console.log(Object.keys(ausgabe).length, "Typen");
