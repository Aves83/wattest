// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Deterministische Mutationstests mit festem Seed (Auftrag 0.1.5, C): DER, ZIP, XML und JSON werden abgeschnitten,
// verlängert, in Längenfeldern und Tags verfälscht, mit Zufallsbytes gefüllt und tief verschachtelt. Erwartet:
// kein Absturz (nur die eigene Fehlerklasse des Lesers), kein Hängen über eine feste Zeit, und ✗ nur bei echtem
// Widerspruch – ist die Eingabe nicht lesbar, steht im Befund kein ✗.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseSchluesselbeschreibung } from "../src/kern/attestierung.js";
import type { Befund } from "../src/kern/befund.js";
import { ausBase64, base64, textAus, utf8, verbinde } from "../src/kern/bytes.js";
import { DerFehler, wurzel } from "../src/kern/der.js";
import { JsonFehler, leseJson } from "../src/kern/json.js";
import { sha256Hex } from "../src/kern/sha.js";
import { ecdsaLesbar, ecdsaRoh, leseZertifikat, pemZuDer, schluesselInfo } from "../src/kern/x509.js";
import { leseXml, xmlZuJson, XmlFehler } from "../src/kern/xml.js";
import { leseZip, ZipFehler } from "../src/kern/zip.js";
import { bits, explizit, int, name, oid, oktette, seq, zeit } from "./der-schreiber.js";
import { APP_DIGEST, APP_DIGEST_HEX, erzeugeKette, neuVerketten, schluesselbeschreibung, signiereNeu, testzertifikate } from "./erzeuger.js";
import { befund, liesText, texte } from "./hilfen.js";
import { alsXml } from "./xml-schreiber.js";
import { zip } from "./zip-schreiber.js";

const SEED = 0x57415454; // „WATT“
/** Höchstdauer einer einzelnen Prüfung in Millisekunden („kein Hängen“). */
const HOECHSTENS_MS = 5000;

/** mulberry32: kleiner, fester Zufallsgenerator. */
function zufall(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Zufall = () => number;
const ganz = (r: Zufall, n: number): number => Math.floor(r() * n);
const zufallsBytes = (r: Zufall, n: number): Uint8Array => Uint8Array.from({ length: n }, () => ganz(r, 256));

/** Mutationen auf Bytes; jede bekommt den Zufall und liefert eine neue Folge. */
const BYTE_MUTATIONEN: [string, (b: Uint8Array, r: Zufall) => Uint8Array][] = [
  ["abgeschnitten", (b, r) => b.slice(0, ganz(r, b.length))],
  ["verlängert", (b, r) => verbinde([b, zufallsBytes(r, 1 + ganz(r, 64))])],
  ["Bit gekippt", (b, r) => {
    const c = b.slice();
    const i = ganz(r, c.length);
    c[i] = c[i]! ^ (1 << ganz(r, 8));
    return c;
  }],
  ["Längenfeld", (b, r) => {
    const c = b.slice();
    c[ganz(r, c.length)] = [0x00, 0x7f, 0x80, 0x81, 0x82, 0x84, 0x85, 0xff][ganz(r, 8)]!;
    return c;
  }],
  ["Tag", (b, r) => {
    const c = b.slice();
    c[ganz(r, c.length)] = [0x1f, 0x3f, 0x9f, 0xbf, 0xdf, 0xff, 0x30, 0xa0][ganz(r, 8)]!;
    return c;
  }],
  ["Zufallsbytes", (b, r) => zufallsBytes(r, Math.max(1, b.length))],
  ["Bereich doppelt", (b, r) => {
    const i = ganz(r, b.length);
    const j = Math.min(b.length, i + 1 + ganz(r, 32));
    return verbinde([b.subarray(0, j), b.subarray(i, j), b.subarray(j)]);
  }],
  ["Bereich gelöscht", (b, r) => {
    const i = ganz(r, b.length);
    return verbinde([b.subarray(0, i), b.subarray(Math.min(b.length, i + 1 + ganz(r, 32)))]);
  }],
  ["32-Bit-Feld", (b, r) => {
    const c = b.slice();
    if (c.length < 4) return c;
    new DataView(c.buffer).setUint32(ganz(r, c.length - 3), [0, 0xffffffff, 0x7fffffff, ganz(r, 2 ** 32), c.length, c.length + 1][ganz(r, 6)]!, true);
    return c;
  }],
];

/** Mutationen auf Text (XML, JSON). */
const TEXT_MUTATIONEN: [string, (t: string, r: Zufall) => string][] = [
  ["abgeschnitten", (t, r) => t.slice(0, ganz(r, t.length))],
  ["verlängert", (t, r) => t + "<>&;{}[]\",:x0".repeat(1 + ganz(r, 8))],
  ["Zeichen ersetzt", (t, r) => {
    const i = ganz(r, t.length);
    return t.slice(0, i) + `<>&;/="'!?[]{}:,0-9e\\`[ganz(r, 21)]! + t.slice(i + 1);
  }],
  ["Bereich doppelt", (t, r) => {
    const i = ganz(r, t.length);
    const j = Math.min(t.length, i + 1 + ganz(r, 200));
    return t.slice(0, j) + t.slice(i, j) + t.slice(j);
  }],
  ["Bereich gelöscht", (t, r) => {
    const i = ganz(r, t.length);
    return t.slice(0, i) + t.slice(Math.min(t.length, i + 1 + ganz(r, 200)));
  }],
  ["Zahl vergrößert", (t, r) => {
    const stellen = [...t.matchAll(/\d+/g)];
    const m = stellen[ganz(r, stellen.length)];
    return m ? t.slice(0, m.index) + "9".repeat(17 + ganz(r, 300)) + t.slice(m.index! + m[0].length) : t;
  }],
  ["Zufallstext", (t, r) => String.fromCharCode(...zufallsBytes(r, Math.min(t.length, 4096)))],
];

async function zeitlich<T>(f: () => Promise<T>, was: string): Promise<T> {
  const start = performance.now();
  const e = await f();
  const dauer = performance.now() - start;
  assert.ok(dauer < HOECHSTENS_MS, `${was}: ${dauer.toFixed(0)} ms`);
  return e;
}

function nurEigeneFehler(f: () => unknown, Klasse: new (...a: never[]) => Error, was: string): boolean {
  try {
    f();
    return true;
  } catch (e) {
    assert.ok(e instanceof Klasse, `${was}: ${(e as Error)?.constructor?.name}: ${(e as Error)?.message}`);
    return false;
  }
}

const ohneWiderspruch = (b: Befund, was: string): void => {
  assert.ok(!b.aussagen.some((a) => a.zeichen === "widerlegt"), `${was}: ✗ trotz unlesbarer Eingabe\n${texte(b)}`);
};

// Feste DER-Grundlagen: die Wurzeln von Google aus daten/ und ein Zertifikat mit Attestierung aus festen Bytes.
function festeDer(): { name: string; der: Uint8Array }[] {
  const wurzeln = JSON.parse(liesText("daten/wurzeln.json")) as { zertifikate: { pem: string }[] };
  const google = wurzeln.zertifikate.flatMap((z) => pemZuDer(z.pem));
  const ec = google.find((d) => schluesselInfo(leseZertifikat(d).spki)?.art === "ECDSA") ?? google[0]!;
  const kd = schluesselbeschreibung({ challenge: new Uint8Array(32).fill(3), sicherheitsstufe: 1, paket: "de.achim.watt", appDigest: APP_DIGEST, bootzustand: 0, gesperrt: true, mitRootOfTrust: true, erzeugtAm: Date.parse("2026-10-24T08:00:00Z") });
  const alg = seq(oid("1.2.840.10045.4.3.3"));
  const tbs = seq(explizit(0, int(2)), int(1n), alg, name("Test"), seq(zeit(0), zeit(Date.parse("2048-01-01T00:00:00Z"))), name("Blatt"), leseZertifikat(ec).spki, explizit(3, seq(seq(oid("1.3.6.1.4.1.11129.2.1.17"), oktette(kd)))));
  const blatt = seq(tbs, alg, bits(new Uint8Array(96).fill(7)));
  return [...google.map((der, i) => ({ name: `Wurzel ${i + 1}`, der })), { name: "Blatt mit Attestierung", der: blatt }, { name: "KeyDescription", der: kd }];
}

test("DER und X.509: 2.000 Mutationen ergeben nur DerFehler, nie eine andere Ausnahme", () => {
  const r = zufall(SEED);
  const basis = festeDer();
  const start = performance.now();
  let gelesen = 0;
  for (let n = 0; n < 2000; n++) {
    const b = basis[n % basis.length]!;
    const [mname, m] = BYTE_MUTATIONEN[ganz(r, BYTE_MUTATIONEN.length)]!;
    let der = m(b.der, r);
    if (n % 50 === 0) for (let i = 0; i < 40 + ganz(r, 2000); i++) der = seq(der);
    const was = `${b.name}, ${mname}, Nr. ${n}`;
    if (nurEigeneFehler(() => leseZertifikat(der), DerFehler, `${was}, Zertifikat`)) gelesen++;
    nurEigeneFehler(() => leseSchluesselbeschreibung(der), DerFehler, `${was}, KeyDescription`);
    nurEigeneFehler(() => wurzel(der), DerFehler, `${was}, wurzel`);
    // Diese Hilfen fangen selbst und ergeben null bzw. false.
    assert.doesNotThrow(() => (ecdsaRoh(der, 32), ecdsaLesbar(der), schluesselInfo(der)), was);
  }
  const dauer = performance.now() - start;
  console.log(`MUTATION DER: 2.000 Fälle in ${dauer.toFixed(0)} ms, ${gelesen} noch als Zertifikat lesbar`);
  assert.ok(dauer < 20000);
});

test("DER in einer Datei: unlesbares Blattzertifikat ergibt nie ✗", { timeout: 120000 }, async () => {
  const r = zufall(SEED + 1);
  const z = await testzertifikate("ec384");
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const ks = e.daten.kettenschluessel[0]!;
  const original = (ks["zertifikate"] as string[]).map((x) => ausBase64(x)!);
  const g = e.daten.protokoll.find((x) => x["objektArt"] === "schluessel")!;
  let unlesbar = 0;
  for (let n = 0; n < 40; n++) {
    const [mname, m] = BYTE_MUTATIONEN[ganz(r, BYTE_MUTATIONEN.length)]!;
    const blatt = m(original[0]!, r);
    const der = [blatt, original[1]!, original[2]!];
    ks["zertifikate"] = der.map(base64);
    const d = JSON.parse(String(g["daten"]));
    d["zertifikateSha256"] = await sha256Hex(verbinde(der));
    g["daten"] = JSON.stringify(d);
    await neuVerketten(e.daten.protokoll);
    await signiereNeu(e);
    const was = `Blatt ${mname}, Nr. ${n}`;
    const b = await zeitlich(() => befund([{ name: "x.json", bytes: utf8(JSON.stringify(e.daten)) }], { wurzeln: [z.wurzelDer], appSignatur: APP_DIGEST_HEX }), was);
    let lesbar = true;
    try {
      leseZertifikat(blatt);
    } catch {
      lesbar = false;
    }
    if (!lesbar) {
      unlesbar++;
      ohneWiderspruch(b, was);
    }
  }
  assert.ok(unlesbar > 10, `nur ${unlesbar} unlesbare Fälle`);
});

test("ZIP: 300 Mutationen ergeben nur ZipFehler, und der Befund enthält nie ✗", { timeout: 120000 }, async () => {
  const r = zufall(SEED + 2);
  const json = liesText("tests/beispiele/cherimoya-18.json");
  const basis = [await zip([{ pfad: "export.json", inhalt: json }, { pfad: "anhaenge/brief.pdf", inhalt: "%PDF-1.4 Beispiel" }]), await zip([{ pfad: "export.json", inhalt: json }], false)];
  for (let n = 0; n < 300; n++) {
    const [mname, m] = BYTE_MUTATIONEN[ganz(r, BYTE_MUTATIONEN.length)]!;
    const bytes = m(basis[n % 2]!, r);
    const was = `ZIP ${mname}, Nr. ${n}`;
    let eintraege: ReturnType<typeof leseZip> = [];
    nurEigeneFehler(() => (eintraege = leseZip(bytes)), ZipFehler, was);
    for (const e of eintraege) {
      try {
        await zeitlich(() => e.lesen(), was);
      } catch (err) {
        assert.ok(err instanceof ZipFehler, `${was}: ${(err as Error).message}`);
      }
    }
    const b = await zeitlich(() => befund([{ name: "x.zip", bytes }]), was);
    ohneWiderspruch(b, was);
  }
});

test("XML: 400 Mutationen ergeben nur XmlFehler; unlesbares XML ergibt nie ✗", { timeout: 120000 }, async () => {
  const r = zufall(SEED + 3);
  const xml = alsXml(JSON.parse(liesText("tests/beispiele/cherimoya-18.json")));
  let unlesbar = 0;
  for (let n = 0; n < 400; n++) {
    const [mname, m] = TEXT_MUTATIONEN[ganz(r, TEXT_MUTATIONEN.length)]!;
    let t = m(xml, r);
    if (n % 40 === 0) t = t.replace("<wattDaten", "<wattDaten>" + "<a>".repeat(100 + ganz(r, 5000)) + "</a>".repeat(100) + "</wattDaten><x");
    const was = `XML ${mname}, Nr. ${n}`;
    const lesbar = nurEigeneFehler(() => xmlZuJson(leseXml(t)), XmlFehler, was);
    if (n % 4 !== 0) continue;
    const b = await zeitlich(() => befund([{ name: "x.xml", bytes: utf8(t) }]), was);
    if (!lesbar) {
      unlesbar++;
      ohneWiderspruch(b, was);
    }
  }
  assert.ok(unlesbar > 20, `nur ${unlesbar} unlesbare Fälle`);
});

test("JSON: 400 Mutationen ergeben nur JsonFehler; unlesbares JSON ergibt nie ✗", { timeout: 120000 }, async () => {
  const r = zufall(SEED + 4);
  const json = liesText("tests/beispiele/cherimoya-18.json");
  let unlesbar = 0;
  for (let n = 0; n < 400; n++) {
    const [mname, m] = TEXT_MUTATIONEN[ganz(r, TEXT_MUTATIONEN.length)]!;
    let t = m(json, r);
    if (n % 40 === 0) t = t.replace('"format"', '"tief":' + "[".repeat(65 + ganz(r, 100000)) + "]".repeat(65) + ',"format"');
    const was = `JSON ${mname}, Nr. ${n}`;
    const lesbar = nurEigeneFehler(() => leseJson(t), JsonFehler, was);
    if (n % 4 !== 0) continue;
    const bytes = utf8(t);
    const b = await zeitlich(() => befund([{ name: "x.json", bytes }]), was);
    if (!lesbar) {
      unlesbar++;
      ohneWiderspruch(b, was);
    }
    // Der Befund bleibt als Text darstellbar.
    assert.doesNotThrow(() => textAus(utf8(JSON.stringify(b)), true), was);
  }
  assert.ok(unlesbar > 20, `nur ${unlesbar} unlesbare Fälle`);
});
