// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Eingaben: XML, Klartext als ZIP, Aktenauszug, Anker; dazu Zeit und Hilfsfunktionen.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseAnkerText, leseHand, leseQr } from "../src/kern/anker.js";
import { ausBase64, base64, utf8 } from "../src/kern/bytes.js";
import { sha256Hex } from "../src/kern/sha.js";
import { berlinMinute, deutsch, zeitpunktMs } from "../src/kern/zeit.js";
import { leseZip } from "../src/kern/zip.js";
import { befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";
import { alsXml } from "./xml-schreiber.js";
import { zip } from "./zip-schreiber.js";

const lade = (name: string): Record<string, unknown> & { protokoll: never[]; nachweise: Record<string, unknown> } => JSON.parse(liesText(`tests/beispiele/${name}`));

for (const name of ["bergamotte-17.json", "cherimoya-18.json"]) {
  test(`XML: ${name} als XML ergibt denselben Befund`, async () => {
    const d = lade(name);
    const a = leseQr(qrAus(d));
    assert.ok(a.ok);
    const xml = { name: name.replace(".json", ".xml"), bytes: utf8(alsXml(d)) };
    const b = await befund([xml], { anker: [a.anker] });
    for (const s of ["P2", "P3", "P4", "P5", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
    if (name === "cherimoya-18.json") {
      assert.equal(zeichen(b, "P1"), "bestaetigt", texte(b, "P1"));
      assert.match(texte(b, "P1"), /\(XML\)/);
    } else {
      // TE 8., Schritt 1: WATT exportiert XML erst ab Formatversion 18.
      assert.equal(zeichen(b, "P1"), "offen", texte(b, "P1"));
      assert.match(texte(b, "P1"), /WATT exportiert XML erst ab Formatversion 18\./);
    }
  });
}

test("XML: Zeilenumbruch und CR in Texten bleiben erhalten", async () => {
  const d = lade("cherimoya-18.json");
  const b = await befund([{ name: "x.xml", bytes: utf8(alsXml(d)) }]);
  assert.equal(zeichen(b, "P2"), "bestaetigt");
});

test("XML: geänderter Wert im XML fällt auf", async () => {
  const d = lade("cherimoya-18.json");
  const xml = alsXml(d).replace("<dauerMinuten>120</dauerMinuten>", "<dauerMinuten>150</dauerMinuten>");
  const b = await befund([{ name: "x.xml", bytes: utf8(xml) }]);
  assert.equal(zeichen(b, "P3"), "widerlegt", texte(b, "P3"));
});

test("XML: kaputtes XML ist ein Prüffehler", async () => {
  const b = await befund([{ name: "x.xml", bytes: utf8("<wattDaten><format>watt-daten</format>") }]);
  assert.equal(zeichen(b, "E"), "offen");
  assert.ok(!b.aussagen.some((a) => a.zeichen === "widerlegt"));
});

test("ZIP: Klartext mit anhaenge/ wird geprüft, Anhänge nur aufgelistet", async () => {
  const d = lade("cherimoya-18.json");
  const a = (d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!;
  a["anhaenge"] = [{ id: 1, art: "PDF", name: "Attest.pdf", groesse: 4, erstelltAm: "2026-10-02T08:00:00Z", dateiname: "anhaenge/815cf717-1-Attest-pdf" }];
  d["version"] = 19;
  const bytes = await zip([
    { pfad: "WATT-Klartext.json", inhalt: JSON.stringify(d) },
    { pfad: "anhaenge/815cf717-1-Attest-pdf", inhalt: "%PDF" },
    { pfad: "anhaenge/fremd.pdf", inhalt: "x" },
  ]);
  const b = await befund([{ name: "WATT-Klartext.zip", bytes }]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b));
  const p8 = texte(b, "P8");
  assert.match(p8, /Anhänge prüft WATTest nicht/);
  assert.match(p8, /Kopie im ZIP, Größe passt/);
  assert.match(p8, /fremd\.pdf .*keinem Anhang zugeordnet/);
});

test("ZIP: Leser prüft CRC-32", async () => {
  const bytes = await zip([{ pfad: "a.txt", inhalt: "Hallo Welt" }], false);
  const i = bytes.indexOf(0x48); // „H“ im Inhalt
  bytes[i] = 0x4a;
  await assert.rejects(leseZip(bytes)[0]!.lesen());
});

async function aktenauszug(dokument: Uint8Array, summe?: string): Promise<Uint8Array> {
  const h = summe ?? (await sha256Hex(dokument));
  return zip([
    { pfad: "Aktenauszug/Anschreiben.pdf", inhalt: dokument },
    { pfad: "Aktenauszug/SHA256SUMS.txt", inhalt: `${h}  Anschreiben.pdf\n` },
  ]);
}

test("Aktenauszug: unveränderte Dokumente, mit Klartext an die Nachweiskette gebunden", async () => {
  const d = lade("cherimoya-18.json");
  const pdf = ausBase64(String(((d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!["dokumente"] as Record<string, unknown>[])[0]!["inhalt"]))!;
  const az = { name: "Aktenauszug.zip", bytes: await aktenauszug(pdf) };
  let b = await befund([az]);
  assert.equal(zeichen(b, "P8"), "offen", texte(b, "P8"));
  assert.match(texte(b, "P8"), /Die Dokumente im Aktenauszug sind unverändert/);
  b = await befund([az, json("klartext.json", d)]);
  assert.equal(zeichen(b, "P8"), "bestaetigt", texte(b, "P8"));
  assert.match(texte(b, "P8"), /gehören zu Nachweisen in der Nachweiskette/);
});

test("Aktenauszug: geänderte Datei ist widerlegt", async () => {
  const pdf = utf8("%PDF-1.4 Beispiel");
  const h = await sha256Hex(pdf);
  const geaendert = utf8("%PDF-1.4 Beispiex");
  const b = await befund([{ name: "Aktenauszug.zip", bytes: await aktenauszug(geaendert, h) }]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

test("Aktenauszug: Dokument, das in keiner Anzeige steht, ist nicht bestätigbar", async () => {
  const b = await befund([{ name: "Aktenauszug.zip", bytes: await aktenauszug(utf8("%PDF fremd")) }, json("k.json", lade("cherimoya-18.json"))]);
  assert.match(texte(b, "P8"), /finden sich nicht|findet sich nicht/);
});

// Anker lesen

test("QR-Text wird gelesen, Zähler und s=1", () => {
  const r = leseQr("watt-pruef:1;v=0.8.123;n=1234;t=2026-10-06T14:32;sha256=f85dd10a5ff51917ff6cd40e1263806151e5e6b7ab07191c23d2df2810253ea2;r=3;w=1;wa=1;i=2;s=1");
  assert.ok(r.ok);
  assert.equal(r.anker.n, 1234);
  assert.equal(r.anker.r, 3);
  assert.equal(r.anker.s, true);
});

test("falsch formatierte Anker ergeben eine Fehlermeldung", () => {
  for (const t of [
    "watt-pruef:2;v=1;n=1;t=2026-10-06T14:32;sha256=" + "a".repeat(64),
    "watt-pruef:1;v=1;n=1;t=2026-10-06 14:32;sha256=" + "a".repeat(64),
    "watt-pruef:1;v=1;n=x;t=2026-10-06T14:32;sha256=" + "a".repeat(64),
    "watt-pruef:1;v=1;n=1;t=2026-10-06T14:32;sha256=abc",
    "watt-pruef:1;v=1;t=2026-10-06T14:32;sha256=" + "a".repeat(64),
    "watt-pruef:1;v=1;n=0;t=2026-10-06T14:32;sha256=" + "a".repeat(64),
    "irgendwas",
  ]) {
    const r = leseAnkerText(t);
    assert.equal(r.ok, false, t);
  }
  const h = leseHand({ anzahl: "zwölf", stand: "2026-03-12", pruefsumme: "xyz" });
  assert.equal(h.ok, false);
  if (!h.ok) assert.deepEqual(Object.keys(h.fehler).sort(), ["anzahl", "pruefsumme", "stand"]);
});

test("Prüfvermerk im Wortlaut wird gelesen", () => {
  const r = leseAnkerText(
    "Prüfvermerk WATT 0.8.109: Arbeitszeitprotokoll mit 9 Einträgen, Stand 02.10.2026, 12:00 Uhr, SHA-256:\n40126645" + "0".repeat(56) + "\nMit dieser Prüfsumme lässt sich später prüfen …",
  );
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.anker.n, 9);
  assert.equal(r.anker.t, "2026-10-02T12:00");
  assert.equal(r.anker.version, "0.8.109");
});

test("Stand von Hand mit Komma und „Uhr“", () => {
  const h = leseHand({ anzahl: "9", stand: "2.10.2026, 12:00 Uhr", pruefsumme: "A".repeat(64) });
  assert.ok(h.ok);
  assert.equal(h.anker.t, "2026-10-02T12:00");
  assert.equal(h.anker.sha256, "a".repeat(64));
});

// Zeit

test("deutsche Zeit mit Sommer- und Winterzeit", () => {
  assert.equal(berlinMinute(zeitpunktMs("2026-10-25T00:59:59Z")!), "2026-10-25T02:59");
  assert.equal(berlinMinute(zeitpunktMs("2026-10-25T01:00:00Z")!), "2026-10-25T02:00");
  assert.equal(berlinMinute(zeitpunktMs("2026-03-29T00:59:00Z")!), "2026-03-29T01:59");
  assert.equal(berlinMinute(zeitpunktMs("2026-03-29T01:00:00Z")!), "2026-03-29T03:00");
  assert.equal(deutsch(zeitpunktMs("2026-12-31T23:30:00.999Z")!), "01.01.2027 00:30");
  assert.equal(zeitpunktMs("2026-02-30T00:00:00Z"), null);
  assert.equal(zeitpunktMs("2026-09-27T21:00:00.250Z"), Date.parse("2026-09-27T21:00:00.250Z"));
});

test("Base64 hin und zurück", () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100]) {
    const b = new Uint8Array(n).map((_, i) => (i * 37) & 255);
    assert.deepEqual(ausBase64(base64(b)), b);
  }
  assert.equal(ausBase64("@@@"), null);
});
