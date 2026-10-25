// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Härtung gegen manipulierte Dateien (Auftrag 0.1.5, A): DER/X.509, ZIP, XML, JSON, feste Grenzen, Abbruch und
// Signaturen zu fremden Gliedern. Ein Lese- oder Prüffehler ist nie ✗, sondern „?“ mit Grund.

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ausBase64, base64, utf8, verbinde } from "../src/kern/bytes.js";
import { DerFehler, lies, wurzel } from "../src/kern/der.js";
import { GRENZWERTE } from "../src/kern/grenzen.js";
import { JsonFehler, leseJson } from "../src/kern/json.js";
import { Abbruch } from "../src/kern/kontext.js";
import { sha256Hex } from "../src/kern/sha.js";
import { leseZertifikat } from "../src/kern/x509.js";
import { leseXml, XmlFehler } from "../src/kern/xml.js";
import { crc32, leseZip, ZipFehler } from "../src/kern/zip.js";
import { auftragAusfuehren, type Meldung } from "../src/worker/auftrag.js";
import { seq } from "./der-schreiber.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiereNeu, testzertifikate, type Erzeugt, type Testzertifikate } from "./erzeuger.js";
import { befund, json, liesText, optionen, texte, zeichen } from "./hilfen.js";
import { alsXml } from "./xml-schreiber.js";
import { nullenKomprimiert, zip, zipRoh } from "./zip-schreiber.js";

let z: Testzertifikate;
before(async () => {
  z = await testzertifikate("ec384");
});

const opt = { wurzeln: [] as Uint8Array[], appSignatur: APP_DIGEST_HEX };
const mitWurzel = (): typeof opt => ({ ...opt, wurzeln: [z.wurzelDer] });
const cherimoya = (): Record<string, unknown> & { protokoll: Record<string, unknown>[] } => JSON.parse(liesText("tests/beispiele/cherimoya-18.json"));
const keinWiderspruch = (b: Awaited<ReturnType<typeof befund>>): void => {
  const w = b.aussagen.filter((a) => a.zeichen === "widerlegt");
  assert.equal(w.length, 0, `unerwartet widerlegt:\n${texte(b)}`);
};

/** Ersetzt die Zertifikate des ersten Schlüssels und hält die Kette sonst stimmig (zertifikateSha256, Prüfsummen, Signaturen). */
async function zertifikateErsetzen(e: Erzeugt, f: (der: Uint8Array[]) => Uint8Array[]): Promise<void> {
  const ks = e.daten.kettenschluessel[0]!;
  const der = f((ks["zertifikate"] as string[]).map((b) => ausBase64(b)!));
  ks["zertifikate"] = der.map(base64);
  const g = e.daten.protokoll.find((x) => x["objektArt"] === "schluessel")!;
  const d = JSON.parse(String(g["daten"]));
  d["zertifikateSha256"] = await sha256Hex(verbinde(der));
  g["daten"] = JSON.stringify(d);
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
}

// DER und X.509

test("DER: unbestimmte Länge, Tag-Nummer über der Grenze, Länge über das Ende, Rest und Tiefe sind DerFehler", () => {
  const fall = (bytes: number[] | Uint8Array, muster: RegExp): void => {
    assert.throws(() => wurzel(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), (e: unknown) => e instanceof DerFehler && muster.test(e.message));
  };
  fall([0x30, 0x80, 0x00, 0x00], /unbestimmte Länge/);
  fall([0x9f, 0x81, 0x80, 0x01, 0x00], /Tag-Nummer über der Grenze/);
  fall([0x9f, 0x80, 0x01, 0x00], /nicht minimal/);
  fall([0x9f, 0x05, 0x00], /kleine Tag-Nummer in langer Form/);
  fall([0x30, 0x84, 0xff, 0xff, 0xff, 0xff], /länger als die Daten/);
  fall([0x30, 0x85, 0x01, 0x00, 0x00, 0x00, 0x00], /Längenfeld zu lang/);
  fall([0x05, 0x00, 0x00], /Daten hinter dem Element/);
  fall([0x30, 0x03, 0x02, 0x05, 0x00], /länger als die Daten/);
  let tief: Uint8Array = new Uint8Array([0x05, 0x00]);
  for (let i = 0; i < GRENZWERTE.derTiefe + 5; i++) tief = seq(tief);
  fall(tief, /Verschachtelung/);
  // Viele Ebenen ohne Rekursion: kein Stapelüberlauf, sondern ein DerFehler.
  let sehrTief: Uint8Array = new Uint8Array([0x05, 0x00]);
  for (let i = 0; i < 2000; i++) sehrTief = seq(sehrTief);
  fall(sehrTief, /Verschachtelung|Längenfeld/);
  assert.doesNotThrow(() => lies(new Uint8Array([0x9f, 0xff, 0x7f, 0x00])));
});

test("X.509: Zertifikat über 8 KB oder nicht aus genau drei Teilen ist ein DerFehler", () => {
  const gross = seq(seq(new Uint8Array(GRENZWERTE.zertifikatBytes)), seq(), new Uint8Array([0x03, 0x01, 0x00]));
  assert.throws(() => leseZertifikat(gross), (e: unknown) => e instanceof DerFehler && /Grenze/.test(e.message));
  assert.throws(() => leseZertifikat(seq(seq(), seq())), (e: unknown) => e instanceof DerFehler && /drei Teilen/.test(e.message));
  assert.throws(() => leseZertifikat(seq(seq(), seq(), seq())), DerFehler);
});

test("Nicht lesbares Zwischenzertifikat: Signaturen bestätigt, Attestierung „?“, nie ✗", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  await zertifikateErsetzen(e, (der) => [der[0]!, new Uint8Array([0x30, 0x80, 0x00, 0x00]), der[2]!]);
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.match(texte(b, "P7"), /unbestimmte Länge/);
  keinWiderspruch(b);
  assert.equal(b.gesamt, "offen");
});

test("Nicht lesbares Blattzertifikat: Signaturen und Attestierung „?“, nie ✗", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  await zertifikateErsetzen(e, (der) => [verbinde([der[0]!, new Uint8Array([0])]), der[1]!, der[2]!]);
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P6"), /Signaturen lassen sich nicht prüfen/);
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  keinWiderspruch(b);
});

test("Mehr als 8 Zertifikate oder ein Zertifikat über 8 KB: „?“ mit Grenze", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  await zertifikateErsetzen(e, (der) => [...der, ...der, ...der]);
  let b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P7"), /9 Zertifikate, mehr als die Grenze von 8/);
  keinWiderspruch(b);
  const e2 = await erzeugeKette({ eintraege: 2, zertifikate: z });
  await zertifikateErsetzen(e2, (der) => [der[0]!, der[1]!, seq(new Uint8Array(GRENZWERTE.zertifikatBytes + 10))]);
  b = await befund([json("x.json", e2.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P7"), /größer als die Grenze von 8 KB/);
  keinWiderspruch(b);
});

test("Fehlender Eintrag in kettenschluessel: P6 und P7 „?“, nicht ✗ (U-24)", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel = [];
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P6"), /fehlt in kettenschluessel/);
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  keinWiderspruch(b);
});

test("Mehr als 256 Schlüssel: P6 und P7 „?“ mit Grenze", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel = Array.from({ length: GRENZWERTE.schluessel + 1 }, () => e.daten.kettenschluessel[0]!);
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "offen");
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P6"), /zu viele Schlüssel/);
  assert.ok(b.aussagen.some((a) => a.schritt === "P6" && /mehr als die Grenze von 256/.test(a.begruendung)));
  keinWiderspruch(b);
});

// Signaturen (A6)

test("Signaturen zu fehlenden Gliedern, außerhalb der Kette, doppelt oder zu lang: „?“ mit Fundstelle", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z });
  const s = e.daten.kettensignaturen;
  const fp = s[0]!["fingerabdruck"];
  s.push({ seq: 999, fingerabdruck: fp, signatur: s[1]!["signatur"] });
  s.push({ ...s[1]! });
  s[3]!["signatur"] = base64(new Uint8Array(GRENZWERTE.signaturBytes + 1));
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  const p6 = texte(b, "P6");
  assert.match(p6, /Signatur zu Glied 999: Dieses Glied gibt es in der Kette nicht \(sie reicht von Glied 1 bis 5\)/);
  assert.match(p6, /Zu Glied 2 stehen 2 Signaturen/);
  assert.match(p6, /Signatur zu Glied 4 ist länger als die Grenze von 128 Bytes/);
  const offen = b.aussagen.find((a) => a.schritt === "P6" && a.zeichen === "offen")!;
  assert.match(offen.fundstelle!, /Glied 2, 4/);
  keinWiderspruch(b);
  assert.equal(b.gesamt, "offen");
});

test("Signatur zu Glied 0: P6 „?“; das Schema verlangt seq ab 1 und bleibt in P1 ✗ (E-8)", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const s = e.daten.kettensignaturen;
  s.push({ seq: 0, fingerabdruck: s[0]!["fingerabdruck"], signatur: s[0]!["signatur"] });
  const b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.match(texte(b, "P6"), /Signatur zu Glied 0: Dieses Glied gibt es in der Kette nicht \(sie reicht von Glied 1 bis 3\)/);
  assert.ok(!b.aussagen.some((a) => a.schritt === "P6" && a.zeichen === "widerlegt"), texte(b, "P6"));
  assert.equal(zeichen(b, "P1"), "widerlegt");
  assert.match(texte(b, "P1"), /kettensignaturen\[\d+\]\.seq: kleiner als 1/);
});

test("Signatur, die nicht als DER lesbar ist: „?“; gültiges DER mit falschem Wert bleibt ✗", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettensignaturen[0]!["signatur"] = base64(new Uint8Array([0x30, 0x80, 0x02, 0x01, 0x01]));
  let b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.match(texte(b, "P6"), /nicht lesbar \(keine ECDSA-Signatur in DER\)/);
  keinWiderspruch(b);
  e.daten.kettensignaturen[0]!["signatur"] = base64(seq(new Uint8Array([0x02, 0x01, 0x01]), new Uint8Array([0x02, 0x01, 0x01])));
  b = await befund([json("x.json", e.daten)], mitWurzel());
  assert.equal(zeichen(b, "P6"), "widerlegt", texte(b, "P6"));
});

test("Zahlen über Number.MAX_SAFE_INTEGER: „?“ statt still gerundet", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  e.daten.kettensignaturen.push({ ...e.daten.kettensignaturen[0]!, seq: 424242 });
  // seq eines Glieds und einer Signatur als Zahl, die JavaScript nicht genau darstellt
  const text = JSON.stringify(e.daten).replace('"seq":424242', '"seq":9007199254740993').replace('"seq":4,', '"seq":12345678901234567890,');
  const b = await befund([{ name: "x.json", bytes: utf8(text) }], mitWurzel());
  assert.equal(zeichen(b, "P1"), "offen", texte(b, "P1"));
  assert.match(texte(b, "P1"), /\$\.protokoll\[3\]\.seq = 12345678901234567890/);
  assert.match(texte(b, "P1"), /\$\.kettensignaturen\[4\]\.seq = 9007199254740993/);
  assert.equal(zeichen(b, "P2"), "offen", texte(b, "P2"));
  assert.match(texte(b, "P2"), /Ein Glied lässt sich nicht nachrechnen/);
  assert.match(texte(b, "P6"), /keine Gliednummer, die WATTest genau lesen kann/);
  keinWiderspruch(b);
});

test("QR-Code und Anker von Hand mit zu großer Zahl werden abgewiesen", async () => {
  const { leseQr, leseHand } = await import("../src/kern/anker.js");
  const r = leseQr(`watt-pruef:1;v=1;n=90071992547409930;t=2026-10-24T10:00;sha256=${"a".repeat(64)}`);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.fehler : "", /zu groß/);
  const h = leseHand({ anzahl: "90071992547409930", stand: "24.10.2026 10:00", pruefsumme: "a".repeat(64) });
  assert.equal(h.ok, false);
});

// JSON

test("JSON: Tiefe über der Grenze ist JsonFehler, auch bei 100.000 Ebenen ohne Stapelüberlauf", () => {
  assert.throws(() => leseJson("[".repeat(65) + "]".repeat(65)), (e: unknown) => e instanceof JsonFehler && /Grenze von 64/.test(e.message));
  assert.throws(() => leseJson('{"a":' + "[".repeat(100000) + "]".repeat(100000) + "}"), JsonFehler);
  assert.doesNotThrow(() => leseJson("[".repeat(64) + "]".repeat(64)));
  // Anführungszeichen und Klammern in Zeichenketten zählen nicht.
  assert.deepEqual(leseJson('{"a":"[[[\\"]]]{{","b":[1]}').unsicher, []);
  assert.deepEqual(leseJson('{"a":[1,2,123456789012345678]}').unsicher, ["$.a[2] = 123456789012345678"]);
  assert.deepEqual(leseJson('{"a":1e400,"b":-9007199254740991}').unsicher, ["$.a = 1e400"]);
});

test("JSON-Datei zu tief: „?“ in den Eingaben mit Grenze, kein ✗", async () => {
  const text = '{"format":"watt-daten","version":18,"x":' + "[".repeat(200) + "]".repeat(200) + "}";
  const b = await befund([{ name: "tief.json", bytes: utf8(text) }]);
  assert.equal(zeichen(b, "E"), "offen");
  assert.match(texte(b, "E"), /Verschachtelung tiefer als die Grenze von 64 Ebenen/);
  assert.ok(b.aussagen.some((a) => a.schritt === "E" && a.grenze));
  keinWiderspruch(b);
});

test("daten eines Glieds zu tief: P3 „?“ für diesen Eintrag, kein ✗", async () => {
  const d = cherimoya();
  const g = d.protokoll.find((x) => x["objektArt"] === "eintrag")!;
  g["daten"] = '{"x":' + "[".repeat(100) + "]".repeat(100) + "}";
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
  assert.equal(zeichen(b, "P3"), "offen", texte(b, "P3"));
  assert.match(texte(b, "P3"), /lässt sich nicht nachspielen/);
  keinWiderspruch(b);
});

// XML

test("XML: DTD und Entitäten (Billion Laughs, externe Entität) werden abgewiesen", () => {
  const lol = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><wattDaten>&lol2;</wattDaten>';
  assert.throws(() => leseXml(lol), (e: unknown) => e instanceof XmlFehler && /DTD und Entitäten/.test(e.message));
  const extern = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><wattDaten>&e;</wattDaten>';
  assert.throws(() => leseXml(extern), XmlFehler);
  assert.throws(() => leseXml("<wattDaten>&e;</wattDaten>"), (e: unknown) => e instanceof XmlFehler && /Unbekannte Entität/.test(e.message));
  assert.throws(() => leseXml("<wattDaten>&#0;</wattDaten>"), XmlFehler);
  assert.throws(() => leseXml("<wattDaten>&#x110000;</wattDaten>"), XmlFehler);
  assert.throws(() => leseXml("<wattDaten>&#xD800;</wattDaten>"), XmlFehler);
});

test("XML: Tiefe und Attributanzahl begrenzt, doppelte Attribute abgewiesen", () => {
  const tief = "<a>".repeat(GRENZWERTE.xmlTiefe + 1) + "</a>".repeat(GRENZWERTE.xmlTiefe + 1);
  assert.throws(() => leseXml(tief), (e: unknown) => e instanceof XmlFehler && /Verschachtelung/.test(e.message));
  assert.doesNotThrow(() => leseXml("<a>".repeat(GRENZWERTE.xmlTiefe) + "</a>".repeat(GRENZWERTE.xmlTiefe)));
  const viele = `<a ${Array.from({ length: GRENZWERTE.xmlAttribute + 1 }, (_, i) => `x${i}="1"`).join(" ")}/>`;
  assert.throws(() => leseXml(viele), (e: unknown) => e instanceof XmlFehler && /Attribute/.test(e.message));
  assert.throws(() => leseXml('<a x="1" x="2"/>'), (e: unknown) => e instanceof XmlFehler && /doppelt/.test(e.message));
  // __proto__ als Name bleibt ein gewöhnliches Feld.
  const el = leseXml('<a __proto__="1"/>');
  assert.equal(Object.getPrototypeOf(el.attribute), Object.prototype);
});

test("XML-Datei mit DTD: „?“ in den Eingaben, kein ✗; Zahl über dem Bereich: P1 „?“", async () => {
  const b = await befund([{ name: "x.xml", bytes: utf8('<!DOCTYPE wattDaten [<!ENTITY a "b">]><wattDaten/>') }]);
  assert.equal(zeichen(b, "E"), "offen");
  keinWiderspruch(b);
  const d = cherimoya();
  const xml = alsXml(d).replace(/<seq>3<\/seq>/, "<seq>99999999999999999999</seq>");
  const b2 = await befund([{ name: "x.xml", bytes: utf8(xml) }]);
  assert.match(texte(b2, "P1"), /nicht genau lesen.*\n.*wattDaten\/protokoll\[2\]\/seq = 99999999999999999999/);
  assert.equal(zeichen(b2, "P2"), "offen", texte(b2, "P2"));
});

// ZIP

test("ZIP: Zip-Bombe über der Grenze der entpackten Größe wird abgewiesen, ohne zu entpacken", async () => {
  const daten = await nullenKomprimiert(1);
  const bombe = zipRoh([{ pfad: "export.json", daten, groesse: GRENZWERTE.zipEintragBytes + 1, crc: 0, methode: 8 }]);
  assert.throws(() => leseZip(bombe), (e: unknown) => e instanceof ZipFehler && /mehr als die Grenze von 200 MB/.test(e.message));
  const b = await befund([{ name: "bombe.zip", bytes: bombe }]);
  assert.equal(zeichen(b, "E"), "offen");
  assert.match(texte(b, "E"), /ZIP, das WATTest nicht liest/);
  keinWiderspruch(b);
});

test("ZIP: Zip-Bombe mit hohem Kompressionsverhältnis wird abgewiesen", { timeout: 120000 }, async () => {
  const daten = await nullenKomprimiert(150);
  assert.ok(daten.length < 1024 * 1024, `${daten.length} Bytes`);
  const bombe = zipRoh([{ pfad: "export.json", daten, groesse: 150 * 1024 * 1024, crc: 0, methode: 8 }]);
  assert.throws(() => leseZip(bombe), (e: unknown) => e instanceof ZipFehler && /komprimiert; das deutet auf eine Zip-Bombe/.test(e.message));
});

test("ZIP: falsch kleine Größe stoppt das Entpacken bei der angegebenen Größe", async () => {
  const daten = await nullenKomprimiert(50);
  const bombe = zipRoh([{ pfad: "export.json", daten, groesse: 1000, crc: crc32(new Uint8Array(1000)), methode: 8 }]);
  const [eintrag] = leseZip(bombe);
  const start = performance.now();
  await assert.rejects(eintrag!.lesen(), (e: unknown) => e instanceof ZipFehler && /mehr als die angegebenen/.test(e.message));
  assert.ok(performance.now() - start < 5000);
  const b = await befund([{ name: "bombe.zip", bytes: bombe }]);
  assert.equal(zeichen(b, "E"), "offen", texte(b));
  keinWiderspruch(b);
});

test("ZIP: überlappende Einträge, doppelte und unsichere Pfade, zu viele Einträge werden abgewiesen", async () => {
  const inhalt = utf8("{}");
  const roh = { daten: inhalt, groesse: inhalt.length, crc: crc32(inhalt), methode: 0 as const };
  for (const [pfad, muster] of [
    ["../export.json", /führt mit „\.\.“ aus dem ZIP heraus/],
    ["a/../../x.json", /„\.\.“/],
    ["/etc/x.json", /absolut/],
    ["C:/x.json", /absolut/],
    ["a\\b.json", /Rückstrich/],
    ["a\u0000.json", /Steuerzeichen/],
  ] as const) {
    assert.throws(() => leseZip(zipRoh([{ pfad, ...roh }])), (e: unknown) => e instanceof ZipFehler && muster.test(e.message), pfad);
  }
  assert.throws(() => leseZip(zipRoh([{ pfad: "a.json", ...roh }, { pfad: "a.json", ...roh }])), /mehrfach/);
  // Zweiter Eintrag zeigt im Verzeichnis auf den lokalen Kopf des ersten (gleiche Daten unter zwei Namen).
  const z2 = zipRoh([{ pfad: "a.json", ...roh }, { pfad: "b.json", ...roh }]);
  const dv = new DataView(z2.buffer, z2.byteOffset);
  const cd = dv.getUint32(z2.length - 22 + 16, true);
  const zweiter = cd + 46 + "a.json".length;
  dv.setUint32(zweiter + 42, 0, true);
  assert.throws(() => leseZip(z2), (e: unknown) => e instanceof ZipFehler && /überlappen|Lokaler Kopf/.test(e.message));
  const viele = zipRoh(Array.from({ length: GRENZWERTE.zipEintraege + 1 }, (_, i) => ({ pfad: `d${i}.txt`, ...roh })));
  assert.throws(() => leseZip(viele), (e: unknown) => e instanceof ZipFehler && /mehr als die Grenze von 10\.000/.test(e.message));
});

test("ZIP mit Klartext bleibt lesbar", async () => {
  const d = cherimoya();
  const z1 = await zip([{ pfad: "export.json", inhalt: JSON.stringify(d) }, { pfad: "anhaenge/a.pdf", inhalt: "x" }]);
  const b = await befund([{ name: "export.zip", bytes: z1 }]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b));
});

// Feste Grenzen und Ablauf

test("Datei über 200 MB und Kette über 1 Mio. Glieder: „?“ mit Grenze, ohne zu lesen", async () => {
  const b = await befund([{ name: "riesig.json", bytes: new Uint8Array(0), groesse: GRENZWERTE.dateiBytes + 1 }]);
  assert.equal(zeichen(b, "E"), "offen");
  assert.match(texte(b, "E"), /größer, als WATTest prüft/);
  assert.equal(b.dateien[0]!.sha256, "");
  const viele = '{"format":"watt-daten","version":18,"protokoll":[' + "{},".repeat(GRENZWERTE.glieder) + "{}]}";
  const b2 = await befund([{ name: "viele.json", bytes: utf8(viele) }]);
  assert.equal(zeichen(b2, "E"), "offen");
  assert.match(texte(b2, "E"), /mehr Glieder, als WATTest prüft/);
  keinWiderspruch(b2);
});

test("Abbrechen beendet die Prüfung ohne Befund; eine Ausnahme ergibt einen Befund „?“ statt einer leeren Seite", async () => {
  const d = cherimoya();
  let n = 0;
  const { pruefe } = await import("../src/kern/pruefung.js");
  await assert.rejects(pruefe([json("x.json", d)], optionen({ abgebrochen: () => ++n > 3 }), { version: "t", commit: "t" }), Abbruch);
  const meldungen: Meldung[] = [];
  const auftrag = { dateien: [json("x.json", d)], anker: [], daten: { wurzeln: null, sperrliste: null, appSignatur: { paketname: "de.achim.watt", sha256: "" } }, jetzt: Date.now(), version: "t", commit: "t" };
  await auftragAusfuehren(auftrag, (m) => meldungen.push(m), () => true);
  assert.deepEqual(meldungen.at(-1), { art: "abgebrochen" });
  meldungen.length = 0;
  await auftragAusfuehren({ ...auftrag, dateien: [{ name: "kaputt", bytes: null as unknown as Uint8Array }] }, (m) => meldungen.push(m));
  const letzte = meldungen.at(-1)!;
  assert.equal(letzte.art, "ergebnis");
  assert.ok(letzte.art === "ergebnis" && letzte.befund.gesamt === "offen" && letzte.befund.aussagen.length === 1);
  assert.match(letzte.art === "ergebnis" ? letzte.befund.aussagen[0]!.text : "", /nicht vollständig ausführen/);
});

test("Einzelheiten je Aussage sind begrenzt", async () => {
  const d = cherimoya();
  for (const g of d.protokoll) g["hash"] = "0".repeat(64);
  const viele = Array.from({ length: 300 }, () => ({ ...d.protokoll[0]! }));
  d.protokoll = viele;
  const b = await befund([json("x.json", d)]);
  const p2 = b.aussagen.find((a) => a.schritt === "P2" && a.zeichen === "widerlegt")!;
  assert.equal(p2.details!.length, 201);
  assert.match(p2.details!.at(-1)!.text, /^… und \d+ weitere\.$/);
});
