// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Technische Erläuterung vom 26.10.2026 (watt_public f314de3): Wertung nach 4.8, Glieder ohne
// Uhrstand, Herkunft der Signaturen (4.7), „Importiert am“ und Bestandsform 2 (4.6, 7.1), Aktenauszug mit
// PRUEFEN.txt (6.).

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ausBase64, base64, utf8 } from "../src/kern/bytes.js";
import { bestandAbwesenheitEingabe, bestandEintragEingabe } from "../src/kern/kanonisch.js";
import { sha256Hex } from "../src/kern/sha.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiere, signiereNeu, testzertifikate, type Erzeugt, type Testzertifikate } from "./erzeuger.js";
import { befund, json, liesText, texte, zeichen } from "./hilfen.js";
import { zip } from "./zip-schreiber.js";

type Daten = Record<string, unknown> & { protokoll: Record<string, unknown>[]; eintraege: Record<string, unknown>[]; abwesenheiten: Record<string, unknown>[]; nachweise: Record<string, unknown> };

const lade = (name = "cherimoya-18.json"): Daten => JSON.parse(liesText(`tests/beispiele/${name}`));
const iso = (ms: number): string => new Date(ms).toISOString().replace(".000Z", "Z");

let z: Testzertifikate;

before(async () => {
  z = await testzertifikate("ec384");
});

const opt = (weiter: Record<string, unknown> = {}) => ({ wurzeln: [z.wurzelDer], wurzelnStand: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test" }, appSignatur: APP_DIGEST_HEX, ...weiter });

// 4.2 und 4.8: Glied ohne Uhrstand nach einem Glied mit Uhrstand.

test("4.2: Glied ohne Uhrstand nach einem Glied mit Uhrstand ist „?“ mit Anzahl und erstem Glied, P2 bleibt ✓", async () => {
  const e = await erzeugeKette({ eintraege: 3 });
  const p = e.daten.protokoll;
  const t = Date.parse(String(p.at(-1)!["zeitpunkt"]));
  for (const i of [1, 2]) p.push({ seq: p.length + 1, zeitpunkt: iso(t + i * 60000), aktion: "ANGELEGT", objektArt: "uhr_abweichung", objektId: "timer", daten: JSON.stringify({ art: "korrektur" }) });
  await neuVerketten(p);
  const b = await befund([json("x.json", e.daten)]);
  assert.ok(b.aussagen.some((a) => a.schritt === "P2" && a.zeichen === "bestaetigt" && a.text === "Die Kette ist lückenlos und unverändert."), texte(b, "P2"));
  const a = b.aussagen.find((x) => x.schritt === "P2" && x.zeichen === "offen")!;
  assert.equal(a.text, "2 Glieder ohne Uhrstand folgen auf ein Glied mit Uhrstand (erstes: Glied 4).");
  assert.match(a.fundstelle ?? "", /Glied 4–5/);
  assert.match(a.begruendung, /nach 4\.8 ist das „nicht bestätigbar“/i);
  assert.notEqual(b.gesamt, "widerlegt");
});

test("4.2: Glieder ohne Uhrstand vor dem ersten Glied mit Uhrstand sind kein Befund", async () => {
  const d = lade();
  const b = await befund([json("x.json", d)]);
  assert.ok(!b.aussagen.some((x) => x.schritt === "P2" && x.zeichen === "offen"), texte(b, "P2"));
});

test("4.2: Glied mit nur einem der beiden Felder des Uhrstands bleibt ein Bruch", async () => {
  const e = await erzeugeKette({ eintraege: 3 });
  const p = e.daten.protokoll;
  delete p[2]!["autoZeit"];
  await neuVerketten(p);
  const b = await befund([json("x.json", e.daten)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.match(texte(b, "P2"), /nur eines der Felder neustarts und autoZeit ist vorhanden/);
});

// 4.8: Rücksprünge bis 2 Minuten sind ein Hinweis.

test("4.8: Rücksprung bis 2 Minuten ist ein Hinweis, P4 bleibt ✓", async () => {
  const d = lade();
  const vorher = Date.parse(String(d.protokoll[5]!["zeitpunkt"]));
  d.protokoll[6]!["zeitpunkt"] = new Date(vorher - 60000).toISOString();
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  assert.match(texte(b, "P4"), /^P4 hinweis: Die Uhr sprang einmal um höchstens 2 Minuten zurück\./m);
  assert.equal(b.aussagen.find((a) => a.text.startsWith("Die Uhr sprang einmal um höchstens"))!.fundstelle, "Glied 7, Datei „x.json“");
});

// 4.7: Herkunft der Signaturen je Abschnitt ab der letzten Wiederherstellung bzw. dem Neubeginn.

/**
 * Kette mit Schlüssel A (Glied 1), Einträgen 2 bis 4, einer Wiederherstellung (Glied 5), Schlüssel B (Glied 6) und
 * Einträgen 7 bis 9; jedes Glied außer der Wiederherstellung ist mit dem Schlüssel seines Abschnitts signiert.
 */
async function mitWiederherstellung(): Promise<Erzeugt> {
  const e = await erzeugeKette({ eintraege: 6, zertifikate: z, weitereSchluessel: 1 });
  const p = e.daten.protokoll;
  const iB = p.findIndex((x, i) => i > 0 && x["objektArt"] === "schluessel");
  assert.equal(iB, 4);
  const zeit = String(p[iB - 1]!["zeitpunkt"]);
  p.splice(iB, 0, {
    seq: 0,
    zeitpunkt: zeit,
    aktion: "ANGELEGT",
    objektArt: "wiederherstellung",
    objektId: "",
    daten: JSON.stringify({ exportiertAm: zeit, verschluesselt: true, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "NICHT_ABGLEICHBAR", signaturen: "GEPRUEFT" }),
    neustarts: -1,
    autoZeit: true,
  });
  p.forEach((g, i) => (g["seq"] = i + 1));
  for (const s of e.daten.kettensignaturen) if ((s["seq"] as number) > iB) s["seq"] = (s["seq"] as number) + 1;
  await neuVerketten(p);
  await signiereNeu(e);
  return e;
}

const fpA = (e: Erzeugt): string => String(e.daten.protokoll[0]!["objektId"]);

test("4.7: Signaturen belegen die Herkunft je Abschnitt ab der Wiederherstellung", async () => {
  const e = await mitWiederherstellung();
  const b = await befund([json("w.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.match(texte(b, "P6"), /^P6 bestaetigt: Signaturen belegen die Herkunft der Glieder 1–4, 5–9\./m);
  assert.match(texte(b, "P6"), /Glied 1 bis 4: jüngste gültige Signatur bei Glied 4 \([^)]*\); eingespielt mit der Wiederherstellung in Glied 5, belegt durch die mitgelieferten Signaturen\./);
  assert.match(texte(b, "P6"), /Glied 5 \(wiederherstellung|Glied 5: WATT vermerkte beim Einspielen „GEPRUEFT“ \(alle rechnerisch gültig und die Prüfungen ohne Netz bestanden\)/);
});

test("4.7, Schritt 7: Signatur ab einer Wiederherstellung mit dem Schlüssel davor ist ungültig (✗)", async () => {
  const e = await mitWiederherstellung();
  const w = e.daten.protokoll[4]!;
  e.daten.kettensignaturen.push({ seq: 5, fingerabdruck: fpA(e), signatur: base64(await signiere(e.blaetter.get(fpA(e))!, utf8(`watt-kopf-1:${String(w["hash"])}`))) });
  const b = await befund([json("w.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt");
  assert.match(texte(b, "P6"), /Signatur zu Glied 5: Sie nennt den Schlüssel [0-9a-f]{16}…, dessen Glied schluessel vor einer Wiederherstellung liegt; ab einer Wiederherstellung signiert nur ein neuer Schlüssel/);
});

test("4.7: Eingespielte Glieder ohne eigene Signatur deckt eine spätere Signatur nicht", async () => {
  const e = await mitWiederherstellung();
  e.daten.kettensignaturen = e.daten.kettensignaturen.filter((s) => (s["seq"] as number) > 4);
  const b = await befund([json("w.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P6"), /^P6 bestaetigt: Signaturen belegen die Herkunft der Glieder 5–9\./m);
  assert.match(texte(b, "P6"), /^P6 offen: Die Herkunft der Glieder 1–4 lässt sich nicht bestätigen\.\n {4}Glied 1 bis 4: eingespielt vor der Wiederherstellung in Glied 5, ohne eigene gültige Signatur; eine spätere Signatur deckt sie nicht\./m);
});

test("4.7: Eingespielte Glieder nach der letzten mitgelieferten Signatur sind nicht bestätigbar", async () => {
  const e = await mitWiederherstellung();
  e.daten.kettensignaturen = e.daten.kettensignaturen.filter((s) => ![3, 4].includes(s["seq"] as number));
  const b = await befund([json("w.json", e.daten)], opt());
  assert.match(texte(b, "P6"), /Signaturen belegen die Herkunft der Glieder 1–2, 5–9\./);
  assert.match(texte(b, "P6"), /Glied 3 bis 4: eingespielt vor der Wiederherstellung in Glied 5, nach der letzten mitgelieferten gültigen Signatur/);
});

test("4.7, U-23: mehrere Signaturen zu einem Glied sind „?“ und zählen nicht als gültig", async () => {
  const e = await mitWiederherstellung();
  const letzte = e.daten.kettensignaturen.find((s) => s["seq"] === 9)!;
  e.daten.kettensignaturen.push({ ...letzte });
  const b = await befund([json("w.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.match(texte(b, "P6"), /Zu Glied 9 stehen 2 Signaturen; nach 4\.7 gibt es je Glied höchstens eine/);
  assert.match(texte(b, "P6"), /Signaturen belegen die Herkunft der Glieder 1–4, 5–8\./);
  assert.match(texte(b, "P6"), /Die Herkunft von Glied 9 lässt sich nicht bestätigen\./);
});

test("4.7: Nach einer Wiederherstellung ohne neues Glied schluessel nennt die Übersicht das", async () => {
  const e = await mitWiederherstellung();
  e.daten.protokoll.splice(5);
  e.daten.kettensignaturen = e.daten.kettensignaturen.filter((s) => (s["seq"] as number) <= 4);
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
  const b = await befund([json("w.json", e.daten)], opt());
  assert.match(texte(b, "P6"), /Nach Glied 5 folgt kein Glied schluessel; nach 4\.7 legt WATT nach jeder Wiederherstellung einen neuen Schlüssel an\./);
  assert.match(texte(b, "P6"), /Die Herkunft von Glied 5 lässt sich nicht bestätigen\./);
});

test("4.7: Bei eingelesenen Buchungen belegt die Signatur das Einlesen, nicht die Zeitpunkte aus der Datei", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const g = e.daten.protokoll[1]!;
  g["daten"] = JSON.stringify({ ...JSON.parse(String(g["daten"])), importDatei: "ab".repeat(32) });
  e.daten.eintraege[0]!["importiertAm"] = g["zeitpunkt"];
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
  const b = await befund([json("i.json", e.daten)], opt());
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.match(texte(b, "P6"), /1 eingelesene Buchung \(importDatei, Glied 2\): Die Signatur belegt das Einlesen in WATT, nicht Erfassungs- und Änderungszeitpunkt aus der Datei \(4\.7\)\./);
});

test("4.7: Der Bestand eines Neubeginns ist nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  e.daten.protokoll[0] = { seq: 1, zeitpunkt: "1970-01-01T00:00:00Z", aktion: "ANGELEGT", objektArt: "neubeginn", objektId: "", daten: JSON.stringify({ bestand: "ab".repeat(32), vorherAnzahl: 0, vorherLetzterHash: "0", vorherZeitpunkt: null, eintraege: { e9: "cd".repeat(16) }, abwesenheiten: {}, bestandsform: 2 }), neustarts: 0, autoZeit: true };
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
  const b = await befund([json("n.json", e.daten)], opt());
  assert.match(texte(b, "P6"), /^P6 bestaetigt: Signaturen belegen die Herkunft der Glieder 1–4\./m);
  const a = b.aussagen.find((x) => x.schritt === "P6" && x.text === "Die Herkunft des Bestands im Neubeginn lässt sich nicht bestätigen.");
  assert.ok(a, texte(b, "P6"));
  assert.equal(a!.zeichen, "offen");
  assert.match(a!.begruendung, /1 Eintrag und 0 Abwesenheiten in Glied 1/);
});

test("Datenformat: doppelter Fingerabdruck in kettenschluessel ist „?“, nicht ✗", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel.push({ ...e.daten.kettenschluessel[0]! });
  const b = await befund([json("d.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "offen", texte(b, "P6"));
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.match(texte(b, "P6"), /steht mehrfach in kettenschluessel; welche Zertifikate gelten, ist nicht eindeutig/);
  assert.notEqual(b.gesamt, "widerlegt");
});

// 4.6 und 7.1: Bestandsform 2 und „Importiert am“.

/** Klartext der Version 18 mit einem Neubeginn, dessen Bestand alle Einträge und Abwesenheiten der Datei enthält. */
async function mitNeubeginn(form: 1 | 2 | 3): Promise<Daten> {
  const d = lade();
  const e: Record<string, string> = {};
  const a: Record<string, string> = {};
  const f = form === 3 ? 1 : form;
  for (const x of d.eintraege) e[String(x["id"])] = (await sha256Hex(bestandEintragEingabe(x, f))).slice(0, 32);
  for (const x of d.abwesenheiten) if (x["art"] !== "DIENSTFREI") a[String(x["tag"])] = (await sha256Hex(bestandAbwesenheitEingabe(x, f))).slice(0, 32);
  const angaben: Record<string, unknown> = { bestand: "ab".repeat(32), vorherAnzahl: 0, vorherLetzterHash: "0", vorherZeitpunkt: null, eintraege: e, abwesenheiten: a };
  if (form !== 1) angaben["bestandsform"] = form;
  d.protokoll = [{ seq: 1, zeitpunkt: "1970-01-01T00:00:00Z", aktion: "ANGELEGT", objektArt: "neubeginn", objektId: "", daten: JSON.stringify(angaben), prev: "", hash: "" }];
  await neuVerketten(d.protokoll);
  return d;
}

const IMPORTIERT = "620ba0d7-1011-4e18-a5ca-ed3e0b918ef8";

test("4.6: Bestandsform 2 enthält „Importiert am“; entfernt ist das eine Datenabweichung", async () => {
  const d = await mitNeubeginn(2);
  let b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = null;
  b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt", texte(b, "P3"));
  assert.match(texte(b, "P3"), new RegExp(`Eintrag ${IMPORTIERT}: passt nicht zur Bestandsprüfsumme im Neubeginn \\(4\\.6, Form 2\\)`));
});

test("4.6: Bestandsform 1 belegt „Importiert am“ nicht; es gilt der Wert der Datei (Hinweis)", async () => {
  const d = await mitNeubeginn(1);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  assert.match(texte(b, "P3"), /^P3 hinweis: Bei 1 Datensatz belegt die Kette „Importiert am“ nicht; es gilt der Wert der Datei\./m);
  assert.match(texte(b, "P3"), /Bestand eines Neubeginns in Form 1 ohne Glied seither/);
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = null;
  assert.equal(zeichen(await befund([json("x.json", d)]), "P3"), "bestaetigt");
});

test("4.6: unbekannte Bestandsform ist „?“", async () => {
  const d = await mitNeubeginn(3);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "offen", texte(b, "P3"));
  assert.match(texte(b, "P3"), /Die Bestandsprüfsummen des Neubeginns lassen sich nicht nachrechnen\./);
});

/** Hängt an die Kette ein Glied GEAENDERT des eingelesenen Eintrags an, mit oder ohne Uhrstand. */
async function aendereImportiert(d: Daten, uhrstand: boolean, importiertAm?: string | null): Promise<void> {
  const anlage = d.protokoll.find((x) => x["objektId"] === IMPORTIERT && x["aktion"] === "ANGELEGT");
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  const t = iso(letzt + 3600000);
  const e = d.eintraege.find((x) => x["id"] === IMPORTIERT)!;
  const stand: Record<string, unknown> = anlage ? JSON.parse(String(anlage["daten"])) : { tag: e["tag"], kategorieId: e["kategorieId"], unterkategorieId: e["unterkategorieId"], beginn: e["beginn"], ende: e["ende"], dauerMinuten: e["dauerMinuten"], notiz: e["notiz"], quelle: e["quelle"], planRef: e["planRef"], erfasstAm: e["erfasstAm"], geaendertAm: e["geaendertAm"], fach: e["fach"], klasse: e["klasse"] };
  delete stand["importDatei"];
  stand["notiz"] = "geändert";
  stand["geaendertAm"] = t;
  if (importiertAm !== undefined) stand["importiertAm"] = importiertAm;
  const g: Record<string, unknown> = { seq: d.protokoll.length + 1, zeitpunkt: t, aktion: "GEAENDERT", objektArt: "eintrag", objektId: IMPORTIERT, daten: JSON.stringify(stand), prev: "", hash: "" };
  if (uhrstand) Object.assign(g, { neustarts: 0, autoZeit: true });
  d.protokoll.push(g);
  e["notiz"] = "geändert";
  e["geaendertAm"] = t;
  await neuVerketten(d.protokoll);
}

test("7.1: Änderungs-Glied ohne Uhrstand erbt „Importiert am“ vom Anlage-Glied", async () => {
  const d = lade();
  await aendereImportiert(d, false);
  let b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = "2026-10-03T08:00:00Z";
  b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
});

test("7.1: Änderungs-Glied mit Uhrstand trägt importiertAm selbst (B15)", async () => {
  const d = lade();
  const wert = String(d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"]);
  await aendereImportiert(d, true, wert);
  let b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  // Ein anderer Zeitpunkt in der Datei bleibt eine Abweichung.
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = "2026-10-03T08:00:00Z";
  b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /abweichend in importiertAm/);
});

test("7.1: Änderungs-Glied mit Uhrstand ohne importiertAm: kein Vermerk, kein Erben", async () => {
  const d = lade();
  await aendereImportiert(d, true);
  // Die Datei behält „Importiert am“: Die Kette belegt es nicht mehr, also hinzugefügt (✗).
  let b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt", texte(b, "P3"));
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = null;
  b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
});

test("7.1: Änderungs-Glied mit Uhrstand nach einem Neubeginn nimmt importiertAm aus dem Glied", async () => {
  const d = await mitNeubeginn(2);
  const wert = String(d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"]);
  await aendereImportiert(d, true, wert);
  assert.equal(zeichen(await befund([json("x.json", d)]), "P3"), "bestaetigt");
  d.eintraege.find((x) => x["id"] === IMPORTIERT)!["importiertAm"] = null;
  const b = await befund([json("x.json", d)]);
  // Fehlt der Wert in der Datei, obwohl die Kette ihn belegt: Hinweis (4.8).
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  assert.match(texte(b, "P3"), /fehlt „Importiert am“ in der Datei, obwohl die Kette das Einlesen belegt/);
});

test("7.1, 9.: Änderungs-Glied ohne Uhrstand nach einem Neubeginn ändert einen Datensatz des Bestands: Wert der Datei", async () => {
  const d = await mitNeubeginn(1);
  await aendereImportiert(d, false);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  const a = b.aussagen.find((x) => x.schritt === "P3" && /belegt die Kette „Importiert am“ nicht/.test(x.text))!;
  assert.ok(a, texte(b, "P3"));
  assert.match(a.details!.map((x) => x.text).join("\n"), /Glied 2 ohne Uhrstand ändert einen Datensatz aus dem Bestand des Neubeginns; der Bestand trägt nur Prüfsummen; in der Datei „Importiert am“ 2026-10-02T08:00:00\.123Z\./);
  assert.match(a.grenze ?? "", /Altfall/);
});

test("7.1: Lösch-Glieder tragen importiertAm als letzten Stand; es wird nicht abgeglichen", async () => {
  const d = lade();
  const anlage = d.protokoll.find((x) => x["objektId"] === IMPORTIERT && x["aktion"] === "ANGELEGT")!;
  const letzt = Date.parse(String(d.protokoll.at(-1)!["zeitpunkt"]));
  const stand = JSON.parse(String(anlage["daten"]));
  delete stand["importDatei"];
  d.protokoll.push({ seq: d.protokoll.length + 1, zeitpunkt: iso(letzt + 3600000), aktion: "GELOESCHT", objektArt: "eintrag", objektId: IMPORTIERT, daten: JSON.stringify({ ...stand, begruendung: null, importiertAm: "2000-01-01T00:00:00Z" }), prev: "", hash: "" });
  d.eintraege = d.eintraege.filter((x) => x["id"] !== IMPORTIERT);
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
});

// 6.: Aktenauszug mit Ordnern Eintrag_NN, Technischer Erläuterung als PDF und PRUEFEN.txt.

test("6.: PRUEFEN.txt und die Technische Erläuterung im Aktenauszug: gegen SHA256SUMS.txt geprüft, nicht gegen die Nachweiskette", async () => {
  const d = lade();
  const pdf = ausBase64(String(((d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!["dokumente"] as Record<string, unknown>[])[0]!["inhalt"]))!;
  const te = utf8("%PDF-1.7 Technische Erläuterung");
  const pruefen = utf8("Prüfen mit WATTest: https://aves83.github.io/wattest/\r\n");
  const zeile = async (b: Uint8Array, p: string): Promise<string> => `${await sha256Hex(b)}  ${p}\n`;
  const summen = (await zeile(pdf, "Eintrag_01/Anschreiben.pdf")) + (await zeile(te, "Technische-Erlaeuterung.pdf")) + (await zeile(pruefen, "PRUEFEN.txt"));
  const bytes = await zip([
    { pfad: "Aktenauszug/Eintrag_01/Anschreiben.pdf", inhalt: pdf },
    { pfad: "Aktenauszug/Technische-Erlaeuterung.pdf", inhalt: te },
    { pfad: "Aktenauszug/PRUEFEN.txt", inhalt: pruefen },
    { pfad: "Aktenauszug/SHA256SUMS.txt", inhalt: summen },
  ]);
  const b = await befund([{ name: "Aktenauszug.zip", bytes }, json("klartext.json", d)]);
  assert.equal(zeichen(b, "P8"), "bestaetigt", texte(b, "P8"));
  const p8 = texte(b, "P8");
  assert.match(p8, /Die SHA-256 aller 3 Dateien stimmt mit SHA256SUMS\.txt überein|Die Dokumente im Aktenauszug sind unverändert\./);
  assert.match(p8, /^P8 hinweis: 2 Dateien im Aktenauszug sind kein Nachweis\.\n {4}Aktenauszug\/Technische-Erlaeuterung\.pdf\n {4}Aktenauszug\/PRUEFEN\.txt \(Anleitung zur unabhängigen Prüfung\)/m);
  assert.doesNotMatch(p8, /nicht in SHA256SUMS\.txt/);
  assert.doesNotMatch(p8, /in keiner Anzeige der Nachweiskette/);
  assert.match(p8, /gehören zu Nachweisen in der Nachweiskette/);
});

test("6.: Eine veränderte PRUEFEN.txt ist eine Abweichung gegen SHA256SUMS.txt", async () => {
  const pruefen = utf8("Anleitung\r\n");
  const bytes = await zip([
    { pfad: "Aktenauszug/PRUEFEN.txt", inhalt: utf8("Anleitung, verändert\r\n") },
    { pfad: "Aktenauszug/SHA256SUMS.txt", inhalt: `${await sha256Hex(pruefen)}  PRUEFEN.txt\n` },
  ]);
  const b = await befund([{ name: "Aktenauszug.zip", bytes }]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

// Grenzen beim Lesen aus den Schemas 19 (Datenformat, kettenschluessel und kettensignaturen): in P1 „?“, nicht ✗.

test("Schema 19: mehr als 256 Schlüssel und Base64 mit Zeilenumbruch sind in P1 „?“, nicht ✗", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel = Array.from({ length: 257 }, () => e.daten.kettenschluessel[0]!);
  let b = await befund([json("x.json", e.daten)], opt());
  assert.equal(zeichen(b, "P1"), "offen", texte(b, "P1"));
  assert.match(texte(b, "P1"), /Die Datei hält Grenzen des Datenformats nicht ein\.\n {4}\$\.kettenschluessel: mehr als 256 Elemente/);
  assert.notEqual(b.gesamt, "widerlegt");
  const e2 = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const zert = e2.daten.kettenschluessel[0]!["zertifikate"] as string[];
  zert[0] = zert[0]!.slice(0, 64) + "\n" + zert[0]!.slice(64);
  b = await befund([json("x.json", e2.daten)], opt());
  assert.equal(zeichen(b, "P1"), "offen", texte(b, "P1"));
  assert.match(texte(b, "P1"), /kein Base64 ohne Fremdzeichen/);
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.notEqual(b.gesamt, "widerlegt");
});
