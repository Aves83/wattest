// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P6 Signaturen und P7 Attestierung mit erzeugten Ketten im Datenformat 19.

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import { ausBase64, base64 } from "../src/kern/bytes.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiereNeu, testzertifikate, type Testzertifikate } from "./erzeuger.js";
import { befund, json, qrAus, texte, zeichen } from "./hilfen.js";

let z: Testzertifikate;
let fremd: Testzertifikate;

before(async () => {
  z = await testzertifikate("ec384");
  fremd = await testzertifikate("ec384");
});

const opt = (weiter: Record<string, unknown> = {}) => ({ wurzeln: [z.wurzelDer], wurzelnStand: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test" }, appSignatur: APP_DIGEST_HEX, ...weiter });

test("gültige Kette: P1 bis P9 bestätigt, Kette stammt von WATT auf einem bestätigten Gerät", async () => {
  const e = await erzeugeKette({ eintraege: 5, zertifikate: z });
  const a = leseQr(qrAus(e.daten as never, undefined, ";s=1"));
  assert.ok(a.ok);
  const b = await befund([json("watt-19.json", e.daten)], opt({ anker: [a.anker] }));
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.ok(b.aussagen.some((x) => x.text === "Die Kette stammt von WATT auf einem bestätigten Gerät."));
  assert.ok(b.aussagen.some((x) => x.text === "Die Uhr des Geräts wurde nicht verstellt."));
  assert.equal(b.gesamt, "bestaetigt");
});

test("RSA-Wurzel wie die alte Wurzel von Google wird angenommen", async () => {
  const rsa = await testzertifikate("rsa");
  const e = await erzeugeKette({ eintraege: 2, zertifikate: rsa });
  const b = await befund([json("rsa.json", e.daten)], opt({ wurzeln: [rsa.wurzelDer] }));
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
});

test("ohne veröffentlichten Fingerabdruck der App ist P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const b = await befund([json("a.json", e.daten)], opt({ appSignatur: "" }));
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /noch nicht veröffentlicht/);
});

test("geänderte Signatur: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const s = e.daten.kettensignaturen[1]!;
  const sig = ausBase64(String(s["signatur"]))!;
  sig[sig.length - 2]! ^= 0x01;
  s["signatur"] = base64(sig);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt", texte(b, "P6"));
});

test("Signatur eines anderen Schlüssels: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const andere = await erzeugeKette({ eintraege: 3, zertifikate: z });
  e.daten.kettensignaturen[2]!["signatur"] = andere.daten.kettensignaturen[2]!["signatur"];
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt");
});

test("unsignierte letzte Glieder: P6 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, ohneSignaturAmEnde: 2 });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "offen");
  assert.match(texte(b, "P6"), /Die Glieder 4 bis 5 sind nicht signiert/);
});

test("Zertifikat mit anderem Paketnamen: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { paket: "de.fremd.app" } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /de\.fremd\.app/);
});

test("anderes Signaturzertifikat der App: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { appDigest: new Uint8Array(32).fill(1) } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
});

test("Sicherheitsstufe Software: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { sicherheitsstufe: 0 } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /Software/);
});

test("verifiedBootState Unverified: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { bootzustand: 2 } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /UNVERIFIED/);
});

test("Bootloader offen: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { gesperrt: false } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
});

test("gesperrte Seriennummer: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const sperrliste = { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test", eintraege: { [z.zwischenSeriennummer.toString(16)]: { status: "REVOKED", reason: "KEY_COMPROMISE" } } };
  const b = await befund([json("a.json", e.daten)], opt({ sperrliste }));
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /gesperrt/);
});

test("ohne Sperrliste: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const b = await befund([json("a.json", e.daten)], opt({ sperrliste: null }));
  assert.equal(zeichen(b, "P7"), "offen");
});

test("fremde Wurzel: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: fremd });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /keiner der Wurzeln/);
});

test("falsche Challenge: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { challenge: new Uint8Array(32).fill(3) } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /Challenge/);
});

test("Fingerabdruck in kettenschluessel passt nicht zum Blatt: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel[0]!["zertifikate"] = (e.daten.kettenschluessel[0]!["zertifikate"] as string[]).slice(1);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt");
});

test("geänderter Eintrag mit neu berechneter Kette: P2 bestätigt, P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const g = e.daten.protokoll[2]!;
  g["daten"] = String(g["daten"]).replace("Korrektur 2", "Korrektur 9");
  (e.daten.eintraege[1] as Record<string, unknown>)["notiz"] = String((e.daten.eintraege[1] as Record<string, unknown>)["notiz"]).replace("Korrektur 2", "Korrektur 9");
  await neuVerketten(e.daten.protokoll);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P3"), "bestaetigt");
  assert.equal(zeichen(b, "P6"), "widerlegt", texte(b, "P6"));
});

test("neu signiert mit eigenem Schlüssel, aber Zertifikate unverändert: weiter stimmig, Kette stammt vom Blatt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  await signiereNeu(e);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "bestaetigt");
});

test("Version 19 ohne Schlüssel: P6 und P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: null });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b));
  assert.equal(zeichen(b, "P6"), "offen");
  assert.equal(zeichen(b, "P7"), "offen");
});
