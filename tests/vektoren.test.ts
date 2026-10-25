// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Rechenbeispiele der Technischen Erläuterung (4.2, 4.6, 4.7, 5.1) als Testvektoren, dazu die Maskierung nach 4.6.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ausBase64, textAus, utf8, utf8Laenge } from "../src/kern/bytes.js";
import {
  anzeigeEingabe,
  bestandDatenEingabe,
  bestandEintragEingabe,
  feld,
  gespraechEingabe,
  gliedEingabe,
  jsonKanonisch,
  jsonZeichenkette,
  nachweisgliedEingabe,
  type AnzeigeRoh,
  type GliedRoh,
} from "../src/kern/kanonisch.js";
import { sha256Hex } from "../src/kern/sha.js";
import { pruefeSignatur } from "../src/kern/x509.js";
import { liesText } from "./hilfen.js";

interface Vektor {
  id: string;
  fundstelle: string;
  eingabe: string;
  sha256: string;
  bestand?: string;
  spkiBase64?: string;
  fingerabdruck?: string;
  signaturBase64?: string;
  objekt?: unknown;
}

const V: Vektor[] = JSON.parse(liesText("tests/vektoren/technische-erlaeuterung.json")).vektoren;
const v = (id: string): Vektor => V.find((x) => x.id === id)!;

/** Zerlegt eine Eingabe aus <Länge>:<Wert>-Feldern; die Länge zählt UTF-8-Bytes. */
function felder(eingabe: string): string[] {
  const b = utf8(eingabe);
  const out: string[] = [];
  let i = 0;
  while (i < b.length) {
    let j = i;
    while (b[j] !== 0x3a) j++;
    const n = Number(textAus(b.subarray(i, j)));
    out.push(textAus(b.subarray(j + 1, j + 1 + n)));
    i = j + 1 + n;
  }
  return out;
}

test("alle Eingaben ergeben ihre angegebene SHA-256", async () => {
  for (const x of V) assert.equal(await sha256Hex(x.eingabe), x.sha256, `${x.id} (${x.fundstelle})`);
});

for (const id of ["B1", "B2", "B10", "B9", "B11"]) {
  test(`${id}: Glied der Arbeitszeitkette nach 4.2`, async () => {
    const f = felder(v(id).eingabe);
    const g: GliedRoh = { seq: Number(f[0]), zeitpunkt: f[1], aktion: f[2], objektArt: f[3], objektId: f[4], daten: f[5], prev: f[6] };
    if (f.length === 9) {
      g.neustarts = Number(f[7]);
      g.autoZeit = f[8] === "true";
    }
    assert.equal(gliedEingabe(g), v(id).eingabe);
    assert.equal(await sha256Hex(gliedEingabe(g)), v(id).sha256);
  });
}

test("B2 und B10 verketten über prev", async () => {
  assert.equal(felder(v("B2").eingabe)[6], v("B1").sha256);
  assert.equal(felder(v("B10").eingabe)[6], v("B2").sha256);
  assert.equal(felder(v("B9").eingabe)[6], v("B10").sha256);
});

test("Umlaute zählen zwei Bytes (4.2)", () => {
  assert.equal(felder("20:Überlastungsanzeige")[0], "Überlastungsanzeige");
});

test("B8: Bestandsprüfsumme eines Eintrags (4.6)", async () => {
  const x = v("B8");
  const e = x.objekt as Record<string, unknown>;
  assert.equal(bestandEintragEingabe(e), x.eingabe);
  assert.equal((await sha256Hex(bestandEintragEingabe(e))).slice(0, 32), x.bestand);
});

test("B3: Prüfsumme des Datenbestands beim Neubeginn (4.6)", async () => {
  const x = v("B3");
  const datei = JSON.parse(x.eingabe) as Record<string, unknown>;
  // Wie ein Export: mit Zeitpunkt, App-Version, Protokoll und Schlüsseln, die die Eingabe ersetzt bzw. weglässt.
  const export_ = { ...datei, exportiertAm: "2026-10-25T08:00:00Z", appVersion: "0.9.0", protokoll: [{ seq: 1 }], kettenschluessel: [], kettensignaturen: [] };
  assert.equal(bestandDatenEingabe(export_), x.eingabe);
  assert.equal(await sha256Hex(bestandDatenEingabe(export_)), x.sha256);
});

test("B12: Signatur über watt-kopf-1:<hash> mit dem Testschlüssel (4.7)", async () => {
  const x = v("B12");
  assert.equal(x.eingabe, `watt-kopf-1:${v("B11").sha256}`);
  const spki = ausBase64(x.spkiBase64!)!;
  assert.equal(await sha256Hex(spki), x.fingerabdruck);
  const sig = ausBase64(x.signaturBase64!)!;
  assert.equal(await pruefeSignatur(spki, "1.2.840.10045.4.3.2", sig, utf8(x.eingabe)), true);
  const falsch = utf8(x.eingabe.replace(/.$/, "0"));
  assert.equal(await pruefeSignatur(spki, "1.2.840.10045.4.3.2", sig, falsch), false);
});

test("B4 und B6: Inhaltsprüfsumme einer Anzeige, Verfahren 2 (5.1)", async () => {
  const x = v("B4");
  const o = x.objekt as { anzeige: AnzeigeRoh; dokumente: { art: string; dateiname: string; inhaltText: string }[] };
  const docs = [];
  for (const d of o.dokumente) docs.push({ art: d.art, dateiname: d.dateiname, sha256: await sha256Hex(d.inhaltText) });
  assert.equal(docs[0]!.sha256, v("B6").sha256);
  assert.equal(anzeigeEingabe(o.anzeige, docs), x.eingabe);
  assert.equal(await sha256Hex(anzeigeEingabe(o.anzeige, docs)), x.sha256);
});

test("B5: Inhaltsprüfsumme einer Gesprächsnotiz (5.1)", async () => {
  const x = v("B5");
  assert.equal(gespraechEingabe(x.objekt as Record<string, unknown>), x.eingabe);
});

test("B7: Glied der Nachweiskette (5.1)", async () => {
  const x = v("B7");
  assert.equal(nachweisgliedEingabe(x.objekt as never), x.eingabe);
  assert.equal(await sha256Hex(nachweisgliedEingabe(x.objekt as never)), x.sha256);
});

// U-17: Maskierung nach 4.6 für die Bestandsprüfsumme, den Klartext-Export über bestand und daten (4.2).

test("B13: Bestandsprüfsumme eines Eintrags mit Umlauten, Anführungszeichen und Tabulator (4.6)", async () => {
  const x = v("B13");
  const e = x.objekt as Record<string, unknown>;
  assert.equal(e["notiz"], 'Aufsatz "Märchen"\tGröße');
  assert.equal(bestandEintragEingabe(e), x.eingabe);
  assert.equal(await sha256Hex(bestandEintragEingabe(e)), x.sha256);
  assert.equal(x.sha256.slice(0, 32), x.bestand);
});

test("U-17: Tabelle der Maskierung (4.6)", () => {
  const tabelle: [number, string][] = [
    [0x22, '\\"'],
    [0x5c, "\\\\"],
    [0x08, "\\b"],
    [0x09, "\\t"],
    [0x0a, "\\n"],
    [0x0c, "\\f"],
    [0x0d, "\\r"],
    [0x00, "\\u0000"],
    [0x1b, "\\u001b"],
    [0x1f, "\\u001f"],
  ];
  for (const [c, m] of tabelle) assert.equal(jsonZeichenkette(String.fromCharCode(c)), `"${m}"`, `U+${c.toString(16).padStart(4, "0")}`);
});

test("U-17: alle anderen Zeichen stehen unverändert in UTF-8", () => {
  for (const c of [0x2f, 0x7f, 0x2028, 0x2029, 0xe4, 0xdf, 0x20ac, 0x1f600]) {
    const z = String.fromCodePoint(c);
    assert.equal(jsonZeichenkette(z), `"${z}"`, `U+${c.toString(16)}`);
  }
  assert.equal(utf8(String.fromCodePoint(0xe4)).length, 2);
  assert.equal(utf8(String.fromCodePoint(0x20ac)).length, 3);
  assert.equal(utf8(String.fromCodePoint(0x1f600)).length, 4);
  assert.equal(utf8Laenge(String.fromCodePoint(0x1f600)), 4);
});

test("U-17: ein einzelnes Ersatzzeichen wird in UTF-8 zu einem Fragezeichen (0x3F)", async () => {
  for (const c of [0xd800, 0xdfff, 0xd83d]) {
    const z = String.fromCharCode(c);
    assert.deepEqual([...utf8(`a${z}b`)], [0x61, 0x3f, 0x62]);
    assert.equal(utf8Laenge(`a${z}b`), 3);
    assert.equal(jsonZeichenkette(z), `"${z}"`);
    assert.equal(feld(z), `1:${z}`);
  }
  // Das Paar bleibt ein Zeichen mit vier Bytes, nur der Rest eines Paars wird zu „?“.
  assert.deepEqual([...utf8(String.fromCharCode(0xd83d, 0xde00, 0xde00))], [0xf0, 0x9f, 0x98, 0x80, 0x3f]);
  const e = { ...(v("B13").objekt as Record<string, unknown>), notiz: `Ende ${String.fromCharCode(0xd83d)}` };
  assert.equal(await sha256Hex(bestandEintragEingabe(e)), await sha256Hex(bestandEintragEingabe({ ...e, notiz: "Ende ?" })));
});

test("U-17: kanonisches JSON gleicht JSON.stringify bis auf einzelne Ersatzzeichen", () => {
  const text = `x/ü${String.fromCharCode(0x1b, 0x7f, 0x2028, 0x2029)}€${String.fromCodePoint(0x1f600)}`;
  const wert = { a: text, b: [], c: {}, d: [1, 22.5, -0.25, { e: null, f: true, g: false }], i: undefined, j: [undefined] };
  for (const einzug of [0, 4]) assert.equal(jsonKanonisch(wert, einzug), JSON.stringify(wert, null, einzug));
  const einzeln = { n: String.fromCharCode(0xd800) };
  assert.equal(jsonKanonisch(einzeln), `{"n":"${String.fromCharCode(0xd800)}"}`);
  assert.equal(JSON.stringify(einzeln), '{"n":"\\ud800"}');
});

test("U-17: Prüfsumme des Datenbestands mit Zeichen, die andere Werkzeuge maskieren", () => {
  const datei = JSON.parse(v("B3").eingabe) as Record<string, unknown>;
  const name = `Müller/Été ${String.fromCharCode(0x1b)}€`;
  const text = bestandDatenEingabe({ ...datei, profil: { ...(datei["profil"] as Record<string, unknown>), name } });
  assert.ok(text.includes(`"name": "Müller/Été \\u001b€"`), text);
  assert.ok(!text.includes("\\/") && !text.includes("\\u00e"), text);
});

