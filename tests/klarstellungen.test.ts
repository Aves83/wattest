// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Klarstellungen der Technischen Erläuterung vom 25.10.2026 (docs/UNKLARHEITEN.md, U-1 bis U-15 und U-18).
// U-16 steht in signatur.test.ts, U-17 in vektoren.test.ts, U-19 in eingaben.test.ts.

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

// U-14: abweichungSekunden mit Vorzeichen (TE 4.7, Stand 8b7bb58). Die frühere Ersatz-Lesart (Betrag) entfällt.

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

// U-21: schritte ist die Zahl der Messungen (ganze Zahl größer als 1); abweichungSekunden ist auch dann
// nachher − vorher (TE 4.7, Stand 26.10.2026). Die frühere Lesart „Summe der Beträge“ entfällt.

test("U-21: schritte: abweichungSekunden gleicht nachher − vorher wie ohne schritte", async () => {
  const passt = await befund([json("x.json", await mitVerstellung(30000, -150000, { abweichungSekunden: -150, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(passt, "P4"), "bestaetigt", texte(passt, "P4"));
  assert.match(texte(passt, "P4"), /Uhr zurückgestellt um 3 Minuten \(nach einer von Android gemeldeten Änderung der Uhrzeit, aus 2 Messungen\)/);
  // Summe der Beträge (frühere Lesart) passt nicht mehr.
  const summe = await befund([json("x.json", await mitVerstellung(30000, -150000, { abweichungSekunden: -200, richtung: "zurueck", schritte: 2 }, false))]);
  assert.equal(zeichen(summe, "P4"), "offen", texte(summe, "P4"));
  assert.match(texte(summe, "P4"), /nachher − vorher sind -150 Sekunden, abweichungSekunden nennt -200/);
});

test("U-21: schritte muss eine ganze Zahl größer als 1 sein", async () => {
  for (const schritte of [1, 0, 2.5, "3", -4]) {
    const b = await befund([json("x.json", await mitVerstellung(30000, 600000, { abweichungSekunden: 600, richtung: "vor", schritte }, false))]);
    assert.equal(zeichen(b, "P4"), "offen", `${String(schritte)}:\n${texte(b, "P4")}`);
    assert.match(texte(b, "P4"), /schritte \([^)]*\) ist keine ganze Zahl größer als 1/);
  }
  const ohne = await befund([json("x.json", await mitVerstellung(30000, 600000, { abweichungSekunden: 600, richtung: "vor" }, false))]);
  assert.equal(zeichen(ohne, "P4"), "bestaetigt", texte(ohne, "P4"));
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

test("U-15: bei schritte gilt dieselbe Grenze von −120 Sekunden (TE 4.7, Stand 26.10.2026)", async () => {
  const b119 = await befund([json("x.json", await mitVerstellung(-119000, 200000, { abweichungSekunden: 200, richtung: "vor", schritte: 3 }, false))]);
  assert.equal(zeichen(b119, "P4"), "bestaetigt", texte(b119, "P4"));
  assert.ok(!hinweisErsterTeil(b119), texte(b119, "P4"));
  const b = await befund([json("x.json", await mitVerstellung(-121000, 200000, { abweichungSekunden: 200, richtung: "vor", schritte: 3 }, false))]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(hinweisErsterTeil(b), texte(b, "P4"));
  assert.match(texte(b, "P4"), /\(mit schritte\); autoZeit false\./);
});

test("U-15: nach einer Wiederherstellung gilt die Regel zum ersten Teil erst ab dem ersten Glied des Geräts", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "wiederherstellung", "", iso(letzt + 60000), { exportiertAm: iso(letzt), verschluesselt: false, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "NICHT_ABGLEICHBAR" });
  d.protokoll.at(-1)!["neustarts"] = -1;
  const w = d.protokoll.length;
  // Der Vermerk folgt dem Glied wiederherstellung (objektId dessen seq); vorher liegt weit vor diesem.
  anhaengen(d, "uhr_verstellt", String(w), iso(letzt + 660000), { vorher: iso(letzt - 600000), nachher: iso(letzt + 660000), abweichungSekunden: 1260, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.ok(!hinweisErsterTeil(b), texte(b, "P4"));
  assert.match(texte(b, "P4"), new RegExp(`Uhr vorgestellt um 21 Minuten \\(nach Glied ${w} \\(Neubeginn oder Wiederherstellung\\)\\)`));
});

test("uhr_verstellt: objektId nach 4.7, sonst nicht bestätigbar", async () => {
  // Laufende Nummer, die kein Glied neubeginn oder wiederherstellung nennt, und ein unbekannter Anlass.
  for (const objektId of ["2", "app"]) {
    const d = await kette();
    const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
    anhaengen(d, "uhr_verstellt", objektId, iso(letzt + 630000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
    await neuVerketten(d.protokoll);
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P4"), "offen", `${objektId}:\n${texte(b, "P4")}`);
    assert.match(texte(b, "P4"), objektId === "2" ? /objektId 2 nennt kein Glied neubeginn oder wiederherstellung/ : /objektId app ist kein Anlass aus 4\.7/);
  }
  for (const objektId of ["glied", "zeitsignal", "timer", "nachweis", "start"]) {
    const d = await kette();
    const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
    anhaengen(d, "uhr_verstellt", objektId, iso(letzt + 630000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
    await neuVerketten(d.protokoll);
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P4"), "bestaetigt", `${objektId}:\n${texte(b, "P4")}`);
  }
});

test("U-5: Rücksprung bis zu uhr_verstellt mit richtung vor ist nicht erklärt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "zeitsignal", iso(letzt - 570000), { vorher: iso(letzt + 30000), nachher: iso(letzt - 570000), abweichungSekunden: 600, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  // Unerklärter Rücksprung: nach 4.8 und 8., Schritt 5 „nicht bestätigbar“ (bis 0.1.5 ✗).
  assert.equal(zeichen(b, "P4"), "offen");
  assert.match(texte(b, "P4"), /passen nicht zur Rechnung|passt nicht zur Rechnung/);
  assert.match(texte(b, "P4"), /^P4 offen: Die Uhr sprang 1 Mal um mehr als 2 Minuten zurück, ohne dass die Kette es vermerkt\./m);
});

test("U-5: Rücksprung beim Festhalten eines Nachweises (uhr_ruecksprung mit objektId nachweis) ist erklärt", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_ruecksprung", "nachweis", iso(letzt - 600000), { vorher: iso(letzt), nachher: iso(letzt - 600000) });
  // Ohne Bezug, etwa nach einem Neustart; mit neustarts 0 wäre der Vermerk nach 4.7 nicht bestätigbar (U-18).
  d.protokoll.at(-1)!["neustarts"] = -1;
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
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /ohne dass die Kette es vermerkt/);
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

test("U-6: zeitpunkt von uhr_verstellt nach nachher: P4 nicht bestätigbar", async () => {
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "glied", iso(letzt + 700000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /zeitpunkt \([^)]*\) liegt nach nachher/);
});

test("U-6: zeitpunkt von uhr_verstellt vor nachher (Dauer des Vorgangs) und folgendes Glied mit anderem Zeitpunkt (4.4, 4.7)", async () => {
  // TE 4.7, Stand 26.10.2026: zeitpunkt liegt höchstens um die Dauer des Vorgangs vor nachher; nach
  // „Sofort wieder löschen“ kann das folgende Glied einen anderen Zeitpunkt haben (4.4).
  const d = await kette();
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  anhaengen(d, "uhr_verstellt", "glied", iso(letzt + 629000), { vorher: iso(letzt + 30000), nachher: iso(letzt + 630000), abweichungSekunden: 600, richtung: "vor" });
  anhaengen(d, "uhr_abweichung", "timer", iso(letzt + 700000), { art: "korrektur" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
});

// U-18: uhr_ruecksprung bei Gliedern mit Uhrstand nur ohne Bezug (TE 4.7, „Bezug“ und „uhr_ruecksprung bei Einträgen
// mit Uhrstand“; 8., Schritt 5; watt_public 4b6401b). Ein Verstoß ist „?“, nie ✗.

const REGEL_OK = /uhr_ruecksprung mit Uhrstand (entstand|entstanden) ohne Bezug, wie 4\.7 es beschreibt\./;
const REGEL_VERSTOSS = /uhr_ruecksprung (passt|passen) nicht zur Regel für den Bezug in 4\.7\./;

function bezug(b: Awaited<ReturnType<typeof befund>>): "bestaetigt" | "offen" | null {
  const a = b.aussagen.filter((x) => x.schritt === "P4" && (REGEL_OK.test(x.text) || REGEL_VERSTOSS.test(x.text)));
  assert.ok(a.length <= 1, texte(b, "P4"));
  if (!a.length) return null;
  assert.ok(a[0]!.zeichen === "bestaetigt" || a[0]!.zeichen === "offen", texte(b, "P4"));
  return a[0]!.zeichen as "bestaetigt" | "offen";
}

type Anlass = "glied" | "timer" | "nachweis" | "start" | "zeitsignal";

async function mitRuecksprung(anlass: Anlass, neustarts: number, vorEintrag = 2): Promise<Daten> {
  return (await erzeugeKette({ eintraege: 4, ruecksprung: { anlass, vorEintrag, neustarts } })).daten as unknown as Daten;
}

test("U-18: objektId mit laufender Nummer, auslösendes Glied mit neustarts größer als 0 oder -1, Vermerk 0: bestätigt", async () => {
  for (const n of [1, 3, -1]) {
    const d = await mitRuecksprung("glied", n);
    const v = d.protokoll.find((x) => x["objektArt"] === "uhr_ruecksprung")!;
    assert.equal(v["objektId"], "3");
    assert.equal(v["neustarts"], 0);
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
    assert.equal(zeichen(b, "P4"), "bestaetigt", `neustarts ${n}:\n${texte(b, "P4")}`);
    assert.equal(bezug(b), "bestaetigt", `neustarts ${n}`);
  }
});

test("U-18: objektId mit laufender Nummer, auslösendes Glied mit neustarts 0: nicht bestätigbar mit Glied-Nummer, keine ✗", async () => {
  const d = await mitRuecksprung("glied", 0);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.equal(bezug(b), "offen");
  const a = b.aussagen.find((x) => REGEL_VERSTOSS.test(x.text))!;
  assert.match(a.fundstelle ?? "", /Glied 4\b/);
  assert.match(a.begruendung, /entspricht an dieser Stelle nicht der Beschreibung der Technischen Erläuterung/);
  assert.match(a.details!.map((x) => x.text).join("\n"), /Glied 4 \([^)]*\) mit objektId 3: das auslösende Glied 3 nennt neustarts 0, also einen Bezug\./);
  assert.notEqual(b.gesamt, "widerlegt");
});

test("U-18: objektId mit laufender Nummer, der Vermerk selbst mit neustarts ungleich 0: nicht bestätigbar", async () => {
  const d = await mitRuecksprung("glied", 1);
  const v = d.protokoll.find((x) => x["objektArt"] === "uhr_ruecksprung")!;
  v["neustarts"] = 1;
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /mit objektId 3: der Vermerk selbst nennt neustarts 1 statt 0\./);
});

test("U-18: objektId timer, nachweis, start oder zeitsignal: der Vermerk selbst trägt neustarts größer als 0 oder -1", async () => {
  for (const anlass of ["timer", "nachweis", "start", "zeitsignal"] as const) {
    for (const [n, erwartet] of [[2, "bestaetigt"], [-1, "bestaetigt"], [0, "offen"]] as const) {
      const d = await mitRuecksprung(anlass, n);
      const b = await befund([json("x.json", d)]);
      assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
      assert.equal(zeichen(b, "P4"), erwartet, `${anlass}, neustarts ${n}:\n${texte(b, "P4")}`);
      assert.equal(bezug(b), erwartet, `${anlass}, neustarts ${n}`);
      if (erwartet === "offen") assert.match(texte(b, "P4"), new RegExp(`Glied 3 \\([^)]*\\) mit objektId ${anlass}: der Vermerk selbst nennt neustarts 0, also einen Bezug\\.`));
    }
  }
});

test("U-18: uhr_ruecksprung mit objektId start oder zeitsignal erklärt einen Rücksprung (8., Schritt 5)", async () => {
  for (const anlass of ["start", "zeitsignal"] as const) {
    const d = await mitRuecksprung(anlass, 1);
    const b = await befund([json("x.json", d)]);
    assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
    assert.match(texte(b, "P4"), /^P4 bestaetigt: Die Zeitstempel steigen an\. Die Geräteuhr wurde einmal verstellt oder sprang zurück; jeder Fall ist vermerkt \(Glied \d+\)\./m);
    assert.match(texte(b, "P4"), anlass === "start" ? /Rücksprung der Uhr beim Öffnen der App oder einer Seite von / : /Rücksprung der Uhr nach einer von Android gemeldeten Änderung der Uhrzeit von /);
    // Ein Vermerk zur Uhr erklärt seinen Rücksprung gleich mit welcher objektId (4.1, 8., Schritt 5, Stand
    // 26.10.2026); eine objektId, die WATT nicht schreibt, ist aber „nicht bestätigbar“.
    const v = d.protokoll.find((x) => x["objektArt"] === "uhr_ruecksprung")!;
    v["objektId"] = "app";
    await neuVerketten(d.protokoll);
    const b2 = await befund([json("x.json", d)]);
    assert.equal(zeichen(b2, "P4"), "offen", texte(b2, "P4"));
    assert.doesNotMatch(texte(b2, "P4"), /ohne dass die Kette es vermerkt/);
    assert.match(texte(b2, "P4"), /objektId app ist weder eine laufende Nummer noch timer, nachweis, start oder zeitsignal/);
  }
});

test("U-18: Ausnahme: uhr_ruecksprung mit objektId nachweis als erstes Glied einer leeren Kette mit neustarts 0", async () => {
  const d = await mitRuecksprung("nachweis", 0, 0);
  assert.equal(d.protokoll[0]!["objektArt"], "uhr_ruecksprung");
  assert.equal(d.protokoll[0]!["prev"], "0");
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.equal(bezug(b), "bestaetigt");
  // Die Ausnahme gilt nur für nachweis.
  for (const anlass of ["timer", "start", "zeitsignal"] as const) {
    const b2 = await befund([json("x.json", await mitRuecksprung(anlass, 0, 0))]);
    assert.equal(bezug(b2), "offen", anlass);
  }
});

test("U-18: eingespielte Glieder vor einer wiederherstellung folgen derselben Regel", async () => {
  const wiederherstellung = (d: Daten, neustarts: number): void => {
    const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
    anhaengen(d, "wiederherstellung", "", iso(letzt + 60000), { exportiertAm: iso(letzt + 30000), verschluesselt: true, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "LEER" });
    d.protokoll.at(-1)!["neustarts"] = neustarts;
  };
  // Eingespielt: auslösendes Glied mit neustarts 0 – auch vor der wiederherstellung „?“.
  const d1 = await mitRuecksprung("glied", 0);
  wiederherstellung(d1, -1);
  await neuVerketten(d1.protokoll);
  const b1 = await befund([json("x.json", d1)]);
  assert.equal(bezug(b1), "offen", texte(b1, "P4"));
  assert.match(texte(b1, "P4"), /Glied 4 \([^)]*\) mit objektId 3: das auslösende Glied 3/);
  // Eingespielt und regelgerecht, danach wiederherstellung mit -1 und ein uhr_ruecksprung mit ihrer seq: bestätigt.
  const d2 = await mitRuecksprung("glied", 1);
  wiederherstellung(d2, -1);
  const w = d2.protokoll.at(-1)!;
  const zuvor = d2.protokoll.at(-2)!;
  w["zeitpunkt"] = iso(Date.parse(String(zuvor["zeitpunkt"])) - 600000);
  anhaengen(d2, "uhr_ruecksprung", String(w["seq"]), String(w["zeitpunkt"]), { vorher: String(zuvor["zeitpunkt"]), nachher: String(w["zeitpunkt"]) });
  await neuVerketten(d2.protokoll);
  const b2 = await befund([json("x.json", d2)]);
  assert.equal(zeichen(b2, "P4"), "bestaetigt", texte(b2, "P4"));
  assert.equal(bezug(b2), "bestaetigt");
  assert.match(texte(b2, "P4"), /Die 2 Glieder uhr_ruecksprung mit Uhrstand entstanden ohne Bezug/);
});

test("U-18: ohne Uhrstand (Glieder mit sieben Feldern) entfällt die Regel", async () => {
  const d = lade();
  d.protokoll[6]!["zeitpunkt"] = "2026-10-02T07:50:00.123Z";
  d.protokoll.splice(7, 0, { seq: 8, zeitpunkt: "2026-10-02T07:50:00.123Z", aktion: "ANGELEGT", objektArt: "uhr_ruecksprung", objektId: "7", daten: '{"vorher":"2026-10-02T08:00:00.123Z","nachher":"2026-10-02T07:50:00.123Z"}', prev: "", hash: "" });
  d.protokoll.forEach((g, i) => (g["seq"] = i + 1));
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.equal(bezug(b), null, texte(b, "P4"));
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
