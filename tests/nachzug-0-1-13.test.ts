// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Unterlagen aus watt_public b97d95c (WATT 0.8.113, Stand 03.11.2026):
// - Datenformat, Grundregeln: „Eine Datei mit version unter 16 wird abgelehnt (seit 02.11.2026, E-851)“; README der
//   Schemas: „Die kleinste lesbare Formatversion ist 16. Dateien der Versionen 1 bis 15 stammen aus Vorabversionen vor
//   WATT 0.8.94 „Apfel“; WATT lehnt sie ab („Diese Datei ist zu alt.“), Schemas gibt es für sie nicht.“
// - Datenformat, protokoll[].zeitpunkt: „in ganzen Millisekunden; ein Glied mit feinerem Zeitpunkt macht die Datei
//   ungültig (seit 02.11.2026)“; kette[].zeitpunkt der Nachweise „in ganzen Millisekunden wie beim Änderungsprotokoll“.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import { utf8 } from "../src/kern/bytes.js";
import type { Befund } from "../src/kern/befund.js";
import { feinerAlsMillisekunden } from "../src/kern/pruefung.js";
import { nachweiseNeuVerketten, neuVerketten } from "./erzeuger.js";
import { befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";
import { alsXml } from "./xml-schreiber.js";

type Daten = { version: number; protokoll: Record<string, unknown>[]; nachweise: { kette: Record<string, unknown>[] } } & Record<string, unknown>;

const lade = (name: string): Daten => JSON.parse(liesText(`tests/beispiele/${name}`)) as Daten;

/** Befund mit einem Anker auf den Kopf der (gegebenenfalls neu verketteten) Arbeitszeitkette. */
async function mitAnker(d: Daten): Promise<Befund> {
  const a = leseQr(qrAus(d as never));
  assert.ok(a.ok);
  return befund([json("x.json", d)], { anker: [a.anker] });
}

const p1 = (b: Befund): [string, string][] => b.aussagen.filter((x) => x.schritt === "P1").map((x) => [x.zeichen, x.text]);

test("Unterlagen: Rechenbeispiele gegenüber watt_public b97d95c bis auf B3 unverändert (Quelle jetzt c0cbd96, Stand 13.11.2026)", () => {
  assert.match(liesText("tests/vektoren/technische-erlaeuterung.json"), /Commit c0cbd96\), Codeblöcke der Rechenbeispiele, Stand 13\.11\.2026/);
});

test("P1, Formatversion 15: „?“ mit dem Text nach Datenformat und README der Schemas", async () => {
  const d = lade("apfel-16.json");
  d.version = 15;
  const b = await befund([json("alt-15.json", d)]);
  assert.deepEqual(p1(b), [["offen", "WATT liest Dateien ab Formatversion 16; diese Datei hat Formatversion 15."]]);
  const a = b.aussagen.find((x) => x.schritt === "P1")!;
  assert.equal(
    a.begruendung,
    "Dateien der Versionen 1 bis 15 stammen aus Vorabversionen vor WATT 0.8.94 „Apfel“; WATT lehnt sie ab („Diese Datei ist zu alt.“), Schemas gibt es für sie nicht (Datenformat, Grundregeln; README der Schemas). WATTest kennt die Formatversionen 16 bis 20. Die folgenden Schritte rechnen trotzdem nach den bekannten Regeln.",
  );
  assert.ok(!b.aussagen.some((x) => x.zeichen === "widerlegt"), texte(b));
  assert.equal(b.gesamt, "offen");
});

test("P1, Formatversion 21: weiter „WATTest kennt das Datenformat 21 nicht.“ (Version 20 kennt WATTest seit 0.1.15)", async () => {
  const d = lade("apfel-16.json");
  d.version = 21;
  const b = await befund([json("neu-21.json", d)]);
  assert.deepEqual(p1(b), [["offen", "WATTest kennt das Datenformat 21 nicht."]]);
  assert.equal(b.aussagen.find((x) => x.schritt === "P1")!.begruendung, "WATTest 0.1 kennt die Formatversionen 16 bis 20. Eine neuere Version braucht eine neuere Fassung von WATTest. Die folgenden Schritte rechnen trotzdem nach den bekannten Regeln.");
});

test("Zeitpunkte feiner als Millisekunden: Ziffer ungleich 0 ab der vierten Nachkommastelle", () => {
  for (const z of ["2026-10-02T08:00:00.123456Z", "2026-10-02T08:00:00.1234Z", "2026-10-02T08:00:00.000000001Z", "2026-10-02T08:00:00.0001Z"]) assert.ok(feinerAlsMillisekunden(z), z);
  for (const z of ["2026-10-02T08:00:00.123Z", "2026-10-02T08:00:00.123000Z", "2026-10-02T08:00:00.1230Z", "2026-10-02T08:00:00.1Z", "2026-10-02T08:00:00Z", "2026-10-02T08:00:00.000000000Z", null, 1, ""]) {
    assert.ok(!feinerAlsMillisekunden(z), String(z));
  }
});

test("drachenfrucht-19, Glied 2 der Nachweiskette mit .123456Z, neu verkettet: P1 ✗, P8 Kette ✓, Gesamtzeile ✗", async () => {
  const d = lade("drachenfrucht-19.json");
  d.nachweise.kette[1]!["zeitpunkt"] = "2026-10-02T08:00:00.123456Z";
  await nachweiseNeuVerketten(d.nachweise.kette, 1);
  const b = await mitAnker(d);
  assert.deepEqual(p1(b), [["widerlegt", "Die Datei entspricht nicht dem Datenformat: Glied 2 der Nachweiskette trägt einen Zeitpunkt feiner als Millisekunden; WATT schreibt Zeitpunkte nur in ganzen Millisekunden und lehnt solche Dateien ab."]]);
  const a = b.aussagen.find((x) => x.schritt === "P1")!;
  assert.equal(a.fundstelle, "Glied 2 der Nachweiskette, Datei „x.json“");
  assert.deepEqual(a.details, [{ text: "Glied 2: 2026-10-02T08:00:00.123456Z" }]);
  assert.match(a.begruendung, /^Glied 2 der Nachweiskette trägt einen Zeitpunkt mit einer von 0 verschiedenen Ziffer ab der vierten Nachkommastelle\./);
  assert.ok(b.aussagen.some((x) => x.schritt === "P8" && x.zeichen === "bestaetigt" && x.text === "Die Nachweiskette ist lückenlos und unverändert."), texte(b, "P8"));
  for (const s of ["P2", "P3", "P4", "P5", "P6", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.equal(b.gesamt, "widerlegt");
});

test("drachenfrucht-19, Glied 8 der Arbeitszeitkette mit .123456Z, neu verkettet: P1 ✗, P2 ✓, Gesamtzeile ✗", async () => {
  const d = lade("drachenfrucht-19.json");
  d.protokoll[7]!["zeitpunkt"] = "2026-10-02T08:00:00.123456Z";
  await neuVerketten(d.protokoll);
  const b = await mitAnker(d);
  assert.deepEqual(p1(b), [["widerlegt", "Die Datei entspricht nicht dem Datenformat: Glied 8 der Arbeitszeitkette trägt einen Zeitpunkt feiner als Millisekunden; WATT schreibt Zeitpunkte nur in ganzen Millisekunden und lehnt solche Dateien ab."]]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
  for (const s of ["P3", "P4", "P5", "P8"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  // Die Signaturen der Köpfe 8 bis 10 decken die alten Prüfsummen: P6 ✗, Herkunft bis Glied 7 bestätigt, danach „?“.
  assert.deepEqual(
    b.aussagen.filter((x) => x.schritt === "P6" && x.zeichen !== "hinweis").map((x) => [x.zeichen, x.text]),
    [
      ["widerlegt", "3 Signaturen sind ungültig oder passen nicht zur Kette."],
      ["bestaetigt", "Signaturen belegen die Herkunft der Glieder 1–7."],
      ["offen", "Die Herkunft der Glieder 8–10 lässt sich nicht bestätigen."],
    ],
  );
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.equal(b.gesamt, "widerlegt");
});

test("drachenfrucht-19, mehrere Glieder beider Ketten feiner: je Kette eine Aussage mit erstem Glied und Anzahl", async () => {
  const d = lade("drachenfrucht-19.json");
  for (const i of [6, 7, 8]) d.protokoll[i]!["zeitpunkt"] = "2026-10-02T08:00:00.1230001Z";
  await neuVerketten(d.protokoll);
  for (const g of d.nachweise.kette) g["zeitpunkt"] = "2026-10-02T08:00:00.123900Z";
  await nachweiseNeuVerketten(d.nachweise.kette);
  const b = await mitAnker(d);
  assert.deepEqual(p1(b), [
    ["widerlegt", "Die Datei entspricht nicht dem Datenformat: Glied 7 der Arbeitszeitkette trägt einen Zeitpunkt feiner als Millisekunden; WATT schreibt Zeitpunkte nur in ganzen Millisekunden und lehnt solche Dateien ab."],
    ["widerlegt", "Die Datei entspricht nicht dem Datenformat: Glied 1 der Nachweiskette trägt einen Zeitpunkt feiner als Millisekunden; WATT schreibt Zeitpunkte nur in ganzen Millisekunden und lehnt solche Dateien ab."],
  ]);
  const [arbeit, nachweis] = b.aussagen.filter((x) => x.schritt === "P1");
  assert.match(arbeit!.begruendung, /^3 Glieder der Arbeitszeitkette tragen einen Zeitpunkt .*, das erste ist Glied 7 der Arbeitszeitkette\./);
  assert.deepEqual(arbeit!.details!.map((x) => x.text), ["Glied 7: 2026-10-02T08:00:00.1230001Z", "Glied 8: 2026-10-02T08:00:00.1230001Z", "Glied 9: 2026-10-02T08:00:00.1230001Z"]);
  assert.match(nachweis!.begruendung, /^3 Glieder der Nachweiskette tragen/);
});

test("Grenzfall .123000Z (ganze Millisekunden, E-68): kein ✗ in P1, Nachweiskette und Gesamtzeile wie unverändert", async () => {
  const d = lade("drachenfrucht-19.json");
  d.nachweise.kette[1]!["zeitpunkt"] = "2026-10-02T08:00:00.123000Z";
  await nachweiseNeuVerketten(d.nachweise.kette, 1);
  const b = await mitAnker(d);
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.equal(b.gesamt, "offen");

  // Ebenso in der Arbeitszeitkette: P1 bleibt ✓; die neue Prüfsumme trifft die Signaturen (P6), nicht das Format.
  const e = lade("drachenfrucht-19.json");
  e.protokoll[7]!["zeitpunkt"] = "2026-10-02T08:00:00.123000Z";
  await neuVerketten(e.protokoll);
  const c = await mitAnker(e);
  assert.equal(zeichen(c, "P1"), "bestaetigt", texte(c, "P1"));
  assert.equal(zeichen(c, "P2"), "bestaetigt", texte(c, "P2"));
});

test("XML: feinerer Zeitpunkt wird ebenso erkannt", async () => {
  const d = lade("drachenfrucht-19.json");
  d.nachweise.kette[2]!["zeitpunkt"] = "2026-10-02T08:00:00.1234Z";
  await nachweiseNeuVerketten(d.nachweise.kette, 2);
  const b = await befund([{ name: "x.xml", bytes: utf8(alsXml(d as never)) }]);
  assert.ok(b.aussagen.some((x) => x.schritt === "P1" && x.zeichen === "widerlegt" && /Glied 3 der Nachweiskette trägt/.test(x.text)), texte(b, "P1"));
});
