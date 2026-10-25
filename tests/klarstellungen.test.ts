// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Klarstellungen der Technischen Erläuterung vom 25.10.2026 (docs/UNKLARHEITEN.md, U-1 bis U-15),
// dazu U-18. U-16 steht in signatur.test.ts, U-17 in vektoren.test.ts, U-19 in eingaben.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr, type Anker } from "../src/kern/anker.js";
import { anzeigeEingabe, type AnzeigeRoh } from "../src/kern/kanonisch.js";
import { abstand, istNachtrag } from "../src/kern/schritte-kette.js";
import { sha256Hex } from "../src/kern/sha.js";
import { erzeugeKette, neuVerketten } from "./erzeuger.js";
import { befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";

type Daten = Record<string, unknown> & { protokoll: Record<string, unknown>[]; eintraege: Record<string, unknown>[]; abwesenheiten: Record<string, unknown>[]; nachweise: Record<string, unknown> };

const lade = (name = "cherimoya-18.json"): Daten => JSON.parse(liesText(`tests/beispiele/${name}`));
const STUNDE = 3600000;

function qr(d: Daten, extra = ""): Anker {
  const a = leseQr(qrAus(d as never, undefined, extra));
  assert.ok(a.ok);
  return a.anker;
}

// U-1: i zählt Anlage-Glieder eintrag und abwesenheit mit importDatei (TE 6.2, 4.1).

async function mitEingelesenerAbwesenheit(): Promise<Daten> {
  const d = lade();
  const imp = d.protokoll.find((x) => String(x["daten"]).includes("importDatei"))!;
  const datei = JSON.parse(String(imp["daten"]))["importDatei"] as string;
  const t = "2026-10-02T11:00:00Z";
  d.protokoll.push({ seq: d.protokoll.length + 1, zeitpunkt: t, aktion: "ANGELEGT", objektArt: "abwesenheit", objektId: "2026-09-29", daten: JSON.stringify({ tag: "2026-09-29", art: "KRANKHEIT", importDatei: datei }), prev: "", hash: "" });
  d.abwesenheiten.push({ tag: "2026-09-29", art: "KRANKHEIT", beginn: null, ende: null, importiertAm: t });
  d.abwesenheiten.sort((a, b) => String(a["tag"]).localeCompare(String(b["tag"])));
  await neuVerketten(d.protokoll);
  return d;
}

test("U-1: i zählt eingelesene Einträge und Abwesenheiten", async () => {
  const d = await mitEingelesenerAbwesenheit();
  const a = qr(d);
  assert.equal(a.i, 2);
  const b = await befund([json("x.json", d)], { anker: [a] });
  for (const s of ["P2", "P3", "P5"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
});

test("U-1: i nur mit den eingelesenen Einträgen ist widerlegt", async () => {
  const d = await mitEingelesenerAbwesenheit();
  const a = qr(d);
  const b = await befund([json("x.json", d)], { anker: [{ ...a, i: 1 }] });
  assert.equal(zeichen(b, "P5"), "widerlegt");
  assert.match(texte(b, "P5"), /i: Der Anker nennt 1 aus einer Datei eingelesene Einträge und Abwesenheiten, die Kette bis Glied 10 enthält 2\./);
});

// U-3: In die Prüfsumme einer Anzeige gehen nur Notizen mit fest true ein, sortiert nach erstelltAm und Kennung (TE 5.1).

test("U-3: Notiz mit fest false geht nicht in die Prüfsumme der Anzeige ein", async () => {
  const d = lade();
  const a = (d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!;
  (a["notizen"] as unknown[]).push({ id: 3, text: "Nach dem Versand ergänzt", erstelltAm: "2026-10-03T09:00:00Z", fest: false, nachVersand: true });
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "bestaetigt", texte(b, "P8"));
});

test("U-3: Notiz von fest true auf false gesetzt: P8 widerlegt", async () => {
  const d = lade();
  const a = (d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!;
  (a["notizen"] as Record<string, unknown>[])[0]!["fest"] = false;
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

test("U-3: Notizen gehen nach erstelltAm und Kennung sortiert ein", () => {
  const v = JSON.parse(liesText("tests/vektoren/technische-erlaeuterung.json")).vektoren.find((x: { id: string }) => x.id === "B4");
  const anzeige = v.objekt.anzeige as AnzeigeRoh;
  const n1 = { id: 1, text: "erste", erstelltAm: "2026-10-01T09:00:00Z", fest: true, nachVersand: false };
  const n2 = { id: 2, text: "zweite", erstelltAm: "2026-10-01T09:00:00Z", fest: true, nachVersand: false };
  const n3 = { id: 3, text: "dritte", erstelltAm: "2026-10-01T10:00:00Z", fest: true, nachVersand: false };
  const docs = [{ art: "ANSCHREIBEN", dateiname: "Anschreiben.pdf", sha256: "315d429b7714cedb6ad04ac31240145257692630457f3c88253c5beceac76027" }];
  const sortiert = anzeigeEingabe({ ...anzeige, notizen: [n1, n2, n3] }, docs);
  assert.equal(anzeigeEingabe({ ...anzeige, notizen: [n3, n2, n1] }, docs), sortiert);
  assert.ok(sortiert.includes("1:320:2026-10-01T09:00:00Z5:erste20:2026-10-01T09:00:00Z6:zweite20:2026-10-01T10:00:00Z6:dritte"), sortiert);
});

// U-4: Nachtrag nach TE 4.5.

test("U-4: Grenzen und Rundung der Nachtrag-Kennzeichnung", () => {
  assert.equal(istNachtrag(24 * STUNDE), false);
  assert.equal(istNachtrag(24 * STUNDE + 999), false);
  assert.equal(istNachtrag(24 * STUNDE + 1000), true);
  assert.equal(abstand(24 * STUNDE + 1000), "ca. 24 Stunden");
  assert.equal(abstand(24 * STUNDE + 29 * 60000 + 59000), "ca. 24 Stunden");
  assert.equal(abstand(24 * STUNDE + 30 * 60000), "ca. 25 Stunden");
  assert.equal(abstand(31 * STUNDE), "ca. 31 Stunden");
  assert.equal(abstand(96 * STUNDE), "ca. 96 Stunden");
  assert.equal(abstand(96 * STUNDE + 999), "ca. 96 Stunden");
  assert.equal(abstand(96 * STUNDE + 1000), "ca. 4 Tage");
  assert.equal(abstand(4 * 24 * STUNDE + 12 * STUNDE - 1000), "ca. 4 Tage");
  assert.equal(abstand(4 * 24 * STUNDE + 12 * STUNDE), "ca. 5 Tage");
  assert.equal(abstand(12 * 24 * STUNDE), "ca. 12 Tage");
});

test("U-4: Erfassung, Änderung und Einlesen werden getrennt gekennzeichnet", async () => {
  const d = lade();
  const b = await befund([json("x.json", d)]);
  // Eingelesener Tagesblock vom 21.09.2026: Ende 22.09.2026 00:00 deutscher Zeit, erfasst am 25.09. um 12:00, eingelesen am 02.10. um 10:00.
  assert.match(texte(b, "P9"), /Eintrag 620ba0d7-1011-4e18-a5ca-ed3e0b918ef8 vom 2026-09-21: Nachgetragen ca\. 84 Stunden nach Ende \(laut Datei\); Eingelesen ca\. 10 Tage nach Ende; Importiert am 02\.10\.2026 10:00/);
  const e = d.eintraege.find((x) => x["importiertAm"] === null && x["beginn"] !== null && x["ende"] !== null)!;
  const ende = Date.parse(String(e["ende"]));
  e["erfasstAm"] = new Date(ende + 31 * STUNDE).toISOString();
  e["geaendertAm"] = new Date(ende + 12 * 24 * STUNDE).toISOString();
  const b2 = await befund([json("x.json", d)]);
  assert.match(texte(b2, "P9"), new RegExp(`Eintrag ${String(e["id"])} vom ${String(e["tag"])}: Nachgetragen ca\\. 31 Stunden nach Ende; Geändert ca\\. 12 Tage nach Ende`));
});

// U-5 und U-6: Vermerke zur Uhr nach TE 8., Schritt 5 und 4.7.

async function kette(): Promise<Daten> {
  return (await erzeugeKette({ eintraege: 3 })).daten as unknown as Daten;
}

function anhaengen(d: Daten, objektArt: string, objektId: string, zeitpunkt: string, daten: Record<string, unknown>): void {
  d.protokoll.push({ seq: d.protokoll.length + 1, zeitpunkt, aktion: "ANGELEGT", objektArt, objektId, daten: JSON.stringify(daten), neustarts: 0, autoZeit: true });
}

const iso = (ms: number): string => new Date(ms).toISOString().replace(".000Z", "Z");

test("U-6: Rücksprung bis zu uhr_verstellt mit richtung zurueck ist erklärt, die Zerlegung stimmt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  const vorher = letzt + 30000;
  const nachher = vorher - 600000;
  anhaengen(d, "uhr_verstellt", "zeitsignal", iso(nachher), { vorher: iso(vorher), nachher: iso(nachher), abweichungSekunden: -600, richtung: "zurueck" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.match(texte(b, "P4"), /Der Vermerk uhr_verstellt erklärt seinen Zeitsprung nach der Rechnung in 4\.7\./);
});

// U-14: abweichungSekunden mit Vorzeichen (TE 4.7, Stand 4828c89). Die frühere Ersatz-Lesart (Betrag) entfällt.

async function mitVerstellung(vorherAbstand: number, sprungMs: number, daten: Record<string, unknown>, autoZeit = true): Promise<Daten> {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  const vorher = letzt + vorherAbstand;
  const nachher = vorher + sprungMs;
  const ms = (t: number): string => new Date(t).toISOString();
  anhaengen(d, "uhr_verstellt", "zeitsignal", ms(nachher), { vorher: ms(vorher), nachher: ms(nachher), ...daten });
  d.protokoll.at(-1)!["autoZeit"] = autoZeit;
  await neuVerketten(d.protokoll);
  return d;
}

test("U-14: abweichungSekunden als Betrag bei richtung zurueck ist nicht bestätigbar", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "start", iso(letzt - 570000), { vorher: iso(letzt + 30000), nachher: iso(letzt - 570000), abweichungSekunden: 600, richtung: "zurueck" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /richtung zurueck passt nicht zu abweichungSekunden 600; nachher − vorher sind -600 Sekunden, abweichungSekunden nennt 600/);
});

test("U-14: nachher − vorher wird zur Null hin auf ganze Sekunden gekürzt, mit Vorzeichen", async () => {
  for (const [ab, erwartet] of [[-600, "bestaetigt"], [-601, "offen"], [600, "offen"]] as const) {
    const d = await mitVerstellung(30000, -600900, { abweichungSekunden: ab, richtung: "zurueck" });
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P4"), erwartet, `${ab}:\n${texte(b, "P4")}`);
  }
  const vor = await befund([json("x.json", await mitVerstellung(30000, 600900, { abweichungSekunden: 600, richtung: "vor" }))]);
  assert.equal(zeichen(vor, "P4"), "bestaetigt", texte(vor, "P4"));
});

test("U-14: Betrag mindestens 120", async () => {
  const b119 = await befund([json("x.json", await mitVerstellung(30000, -119000, { abweichungSekunden: -119, richtung: "zurueck" }))]);
  assert.equal(zeichen(b119, "P4"), "offen");
  assert.match(texte(b119, "P4"), /der Betrag von abweichungSekunden \(-119\) ist kleiner als 120/);
  const b120 = await befund([json("x.json", await mitVerstellung(30000, -120000, { abweichungSekunden: -120, richtung: "zurueck" }))]);
  assert.equal(zeichen(b120, "P4"), "bestaetigt", texte(b120, "P4"));
});

test("U-14: schritte: Summe der Beträge mit dem Vorzeichen der Gesamtrichtung", async () => {
  // Schritte −175 s und +25 s: Summe der Beträge 200, mit Vorzeichen −150.
  const passt = await befund([json("x.json", await mitVerstellung(30000, -150000, { abweichungSekunden: -200, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(passt, "P4"), "bestaetigt", texte(passt, "P4"));
  const vorzeichen = await befund([json("x.json", await mitVerstellung(30000, -150000, { abweichungSekunden: 200, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(vorzeichen, "P4"), "offen", texte(vorzeichen, "P4"));
  const zuKlein = await befund([json("x.json", await mitVerstellung(30000, -250000, { abweichungSekunden: -200, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(zuKlein, "P4"), "offen", texte(zuKlein, "P4"));
});

test("U-14: schritte, die sich genau aufheben, gelten als vor", async () => {
  const vor = await befund([json("x.json", await mitVerstellung(30000, 0, { abweichungSekunden: 240, richtung: "vor", schritte: 2 }, false))]);
  assert.equal(zeichen(vor, "P4"), "bestaetigt", texte(vor, "P4"));
  const zurueck = await befund([json("x.json", await mitVerstellung(30000, 0, { abweichungSekunden: -240, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(zurueck, "P4"), "offen", texte(zurueck, "P4"));
});

// U-15: erster Teil der Zerlegung nicht unter −120 s (Grenze eingeschlossen), bei schritte nicht negativ; darunter nur Hinweis.

const ERSTER_TEIL = /liegt vorher weiter vor dem vorigen Glied, als 4\.7 es vorsieht/;

function hinweisErsterTeil(b: Awaited<ReturnType<typeof befund>>): boolean {
  return b.aussagen.some((a) => a.schritt === "P4" && a.zeichen === "hinweis" && ERSTER_TEIL.test(a.text));
}

test("U-15: erster Teil genau −120 Sekunden: kein Hinweis", async () => {
  const b = await befund([json("x.json", await mitVerstellung(-120000, 600000, { abweichungSekunden: 600, richtung: "vor" }))]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(!hinweisErsterTeil(b), texte(b, "P4"));
});

test("U-15: erster Teil unter −120 Sekunden: Hinweis mit autoZeit, keine ✗ und kein ?", async () => {
  const b = await befund([json("x.json", await mitVerstellung(-121000, 600000, { abweichungSekunden: 600, richtung: "vor" }))]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(hinweisErsterTeil(b), texte(b, "P4"));
  assert.match(texte(b, "P4"), /liegt 121 Sekunden vor Glied \d+ \([^)]*\); autoZeit true\./);
});

test("U-15: bei schritte ist schon ein negativer erster Teil ein Hinweis", async () => {
  const null_ = await befund([json("x.json", await mitVerstellung(0, 200000, { abweichungSekunden: 200, richtung: "vor", schritte: 3 }, false))]);
  assert.ok(!hinweisErsterTeil(null_), texte(null_, "P4"));
  const b = await befund([json("x.json", await mitVerstellung(-1000, 200000, { abweichungSekunden: 200, richtung: "vor", schritte: 3 }, false))]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(hinweisErsterTeil(b), texte(b, "P4"));
  assert.match(texte(b, "P4"), /\(mit schritte\); autoZeit false\./);
});

test("U-5: Rücksprung bis zu uhr_verstellt mit richtung vor ist nicht erklärt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "zeitsignal", iso(letzt - 570000), { vorher: iso(letzt + 30000), nachher: iso(letzt - 570000), abweichungSekunden: 600, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "widerlegt");
  assert.match(texte(b, "P4"), /passen nicht zur Rechnung|passt nicht zur Rechnung/);
});

test("U-5: Rücksprung beim Festhalten eines Nachweises (uhr_ruecksprung mit objektId nachweis) ist erklärt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_ruecksprung", "nachweis", iso(letzt - 600000), { vorher: iso(letzt), nachher: iso(letzt - 600000) });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
});

test("U-5: Rücksprung nach einem Glied uhr_verstellt ist nicht mehr durch dieses erklärt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "zeitsignal", iso(letzt + 630000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
  anhaengen(d, "uhr_abweichung", "timer", iso(letzt + 60000), { art: "korrektur" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "widerlegt", texte(b, "P4"));
});

test("U-6: abweichungSekunden passt nicht zu nachher − vorher: P4 nicht bestätigbar", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "zeitsignal", iso(letzt + 630000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 500, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /nachher − vorher sind 600 Sekunden, abweichungSekunden nennt 500/);
});

test("U-6: zeitpunkt von uhr_verstellt gleicht nicht nachher: P4 nicht bestätigbar", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "glied", iso(letzt + 700000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /gleicht nicht nachher/);
});

// U-18: uhr_ruecksprung, obwohl ein Bezug bestand (TE 8., Schritt 5, und 4.7). Nur Hinweis.

const BEZUG = /Glied uhr_ruecksprung steht in einem Abschnitt, in dem ein Bezug zur Monotonuhr bestand/;

function hinweisBezug(b: Awaited<ReturnType<typeof befund>>): boolean {
  return b.aussagen.some((a) => a.schritt === "P4" && a.zeichen === "hinweis" && BEZUG.test(a.text));
}

async function mitRuecksprungNachGlied(neustarts: number): Promise<Daten> {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_abweichung", "timer", iso(letzt - 600000), { art: "korrektur", abweichungSekunden: 60 });
  d.protokoll.at(-1)!["neustarts"] = neustarts;
  anhaengen(d, "uhr_ruecksprung", String(d.protokoll.length), iso(letzt - 600000), { vorher: iso(letzt), nachher: iso(letzt - 600000) });
  await neuVerketten(d.protokoll);
  return d;
}

test("U-18: uhr_ruecksprung nach einem Glied ohne Neustart seit dem vorigen Glied mit Uhrstand: Hinweis, keine ✗", async () => {
  const d = await mitRuecksprungNachGlied(0);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(hinweisBezug(b), texte(b, "P4"));
  assert.match(texte(b, "P4"), new RegExp(`Glied ${d.protokoll.length} \\([^)]*\\): Bezug seit Glied ${d.protokoll.length - 2} `));
});

test("U-18: nach einem Neustart oder ohne Bezug (neustarts größer als 0 oder -1) kein Hinweis", async () => {
  for (const n of [1, -1]) {
    const b = await befund([json("x.json", await mitRuecksprungNachGlied(n))]);
    assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
    assert.ok(!hinweisBezug(b), `neustarts ${n}`);
  }
});

test("U-18: uhr_ruecksprung mit objektId nachweis zählt die eigenen Neustarts", async () => {
  for (const [n, erwartet] of [[0, true], [2, false], [-1, false]] as const) {
    const d = await kette();
    const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
    anhaengen(d, "uhr_ruecksprung", "nachweis", iso(letzt - 600000), { vorher: iso(letzt), nachher: iso(letzt - 600000) });
    d.protokoll.at(-1)!["neustarts"] = n;
    await neuVerketten(d.protokoll);
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
    assert.equal(hinweisBezug(b), erwartet, `neustarts ${n}`);
  }
});

test("U-18: ohne Uhrstand (Glieder mit sieben Feldern) kein Hinweis", async () => {
  const d = lade();
  d.protokoll[6]!["zeitpunkt"] = "2026-10-02T07:50:00.123Z";
  d.protokoll.splice(7, 0, { seq: 8, zeitpunkt: "2026-10-02T07:50:00.123Z", aktion: "ANGELEGT", objektArt: "uhr_ruecksprung", objektId: "7", daten: '{"vorher":"2026-10-02T08:00:00.123Z","nachher":"2026-10-02T07:50:00.123Z"}', prev: "", hash: "" });
  d.protokoll.forEach((g, i) => (g["seq"] = i + 1));
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(!hinweisBezug(b), texte(b, "P4"));
});

// U-13: Prüfsumme des Datenbestands beim Neubeginn (TE 4.6).

async function nachNeubeginn(): Promise<Daten> {
  const d = (await erzeugeKette({ eintraege: 0 })).daten as unknown as Daten;
  const kopie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === "kettenschluessel" || k === "kettensignaturen") continue;
    kopie[k] = k === "exportiertAm" ? "1970-01-01T00:00:00Z" : k === "appVersion" ? "" : k === "protokoll" ? [] : v;
  }
  const bestand = await sha256Hex(JSON.stringify(kopie, null, 4));
  anhaengen(d, "neubeginn", "", "2026-10-24T08:00:00Z", { bestand, vorherAnzahl: 0, vorherLetzterHash: "0", vorherZeitpunkt: null, eintraege: {}, abwesenheiten: {} });
  await neuVerketten(d.protokoll);
  return d;
}

test("U-13: JSON-Export unmittelbar nach dem Neubeginn: bestand lässt sich nachrechnen", async () => {
  const d = await nachNeubeginn();
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P9"), "bestaetigt", texte(b, "P9"));
  assert.match(texte(b, "P9"), /Die Prüfsumme des Datenbestands im Neubeginn passt zu diesem Export\./);
});

test("U-13: späterer Export: bestand nur festgehalten, kein Widerspruch", async () => {
  const d = await nachNeubeginn();
  (d["profil"] as Record<string, unknown>)["amtBezeichnung"] = "Studienrätin";
  const b = await befund([json("x.json", d)]);
  assert.notEqual(zeichen(b, "P9"), "widerlegt");
  assert.doesNotMatch(texte(b, "P9"), /passt zu diesem Export/);
  assert.match(texte(b, "P9"), /Aus diesem Export lässt sich bestand nicht nachrechnen/);
});
