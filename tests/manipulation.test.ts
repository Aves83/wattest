// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Manipulierte Varianten der Beispieldateien je Prüfschritt mit erwartetem ✗ bzw. ?.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr, type Anker } from "../src/kern/anker.js";
import { utf8 } from "../src/kern/bytes.js";
import { neuVerketten } from "./erzeuger.js";
import { anker, befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";

type Daten = Record<string, unknown> & { protokoll: Record<string, unknown>[]; eintraege: Record<string, unknown>[]; abwesenheiten: Record<string, unknown>[]; nachweise: Record<string, unknown> };

const lade = (name = "cherimoya-18.json"): Daten => JSON.parse(liesText(`tests/beispiele/${name}`));

function qr(d: Daten, n?: number, extra = ""): Anker {
  const a = leseQr(qrAus(d as never, n, extra));
  assert.ok(a.ok);
  return a.anker;
}

// P1 Format

test("P1: fehlendes Pflichtfeld ist widerlegt", async () => {
  const d = lade();
  delete d.eintraege[0]!["notiz"];
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P1"), "widerlegt", texte(b, "P1"));
});

test("P1: falscher Typ ist widerlegt", async () => {
  const d = lade();
  d.protokoll[0]!["seq"] = "1";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P1"), "widerlegt");
});

test("P1: unbekanntes Feld ist nicht bestätigbar", async () => {
  const d = lade();
  d["zusatz"] = 1;
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P1"), "offen");
});

test("P1: unbekannte Formatversion ist nicht bestätigbar", async () => {
  const d = lade();
  d["version"] = 20;
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P1"), "offen");
});

// P2 Arbeitszeitkette

test("P2: geändertes daten eines Glieds ist widerlegt", async () => {
  const d = lade();
  d.protokoll[2]!["daten"] = String(d.protokoll[2]!["daten"]).replace('"dauerMinuten":90', '"dauerMinuten":95');
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.match(texte(b, "P2"), /ab Glied 3 unterbrochen/);
});

test("P2: fehlendes Glied ist widerlegt", async () => {
  const d = lade();
  d.protokoll.splice(3, 1);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.match(texte(b, "P2"), /Glied 4 fehlt/);
});

test("P2: geänderter Zeitpunkt mit angepasster Prüfsumme bricht beim Nachfolger", async () => {
  const d = lade();
  d.protokoll[1]!["zeitpunkt"] = "2026-09-29T08:00:01.123Z";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
});

test("P2: nur eines der Felder des Uhrstands ist ein Bruch", async () => {
  const d = lade();
  d.protokoll[0]!["neustarts"] = 0;
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.match(texte(b, "P2"), /nur eines der Felder/);
});

test("P2: Neubeginn nicht als erstes Glied ist widerlegt", async () => {
  const d = lade();
  d.protokoll.splice(2, 0, { seq: 3, zeitpunkt: "2026-09-29T08:00:00.123Z", aktion: "ANGELEGT", objektArt: "neubeginn", objektId: "", daten: '{"bestand":"0"}', prev: "", hash: "" });
  d.protokoll.forEach((g, i) => (g["seq"] = i + 1));
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.match(texte(b, "P2"), /Neubeginn darf nur das erste Glied sein/);
});

test("P2: die Form mit neun Feldern wird erkannt", async () => {
  const d = lade();
  for (const g of d.protokoll) {
    g["neustarts"] = 0;
    g["autoZeit"] = true;
  }
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b, "P2"));
});

// P3 Daten und Kette

test("P3: geänderter Eintrag ohne Glied ist widerlegt", async () => {
  const d = lade();
  d.eintraege[1]!["ende"] = "2026-09-27T23:45:00Z";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /Eintrag nacht .*abweichend in ende/);
});

test("P3: zusätzlicher Eintrag ohne Glied ist widerlegt", async () => {
  const d = lade();
  d.eintraege.push({ ...d.eintraege[1]!, id: "neu" });
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /Eintrag neu: steht in den Daten, aber in keinem Glied/);
});

test("P3: entfernter Eintrag ist widerlegt", async () => {
  const d = lade();
  d.eintraege.splice(2, 1);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /fehlt aber in den Daten/);
});

test("P3: geänderte Abwesenheit ist widerlegt, dienstfreie Tage bleiben außen vor", async () => {
  const d = lade();
  d.abwesenheiten[0]!["ende"] = "2026-09-30T09:45:00Z";
  d.abwesenheiten.push({ tag: "2026-12-24", art: "DIENSTFREI", beginn: null, ende: null, importiertAm: null });
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /Abwesenheit am 2026-09-30 .*abweichend in ende/);
});

test("P3: fehlende Markierung „importiert“ ist nach 4.8 ein Hinweis, ein anderer Zeitpunkt bleibt widerlegt", async () => {
  // TE 4.8 und 7.1 (Stand 26.10.2026): Fehlt „Importiert am“, obwohl die Kette das Einlesen belegt, ist das ein
  // Hinweis (WATT ergänzt ihn beim Einspielen); bis 0.1.5 war das ✗.
  const d = lade();
  d.eintraege[0]!["importiertAm"] = null;
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  assert.match(texte(b, "P3"), /^P3 hinweis: Bei 1 Datensatz fehlt „Importiert am“ in der Datei, obwohl die Kette das Einlesen belegt\./m);
  d.eintraege[0]!["importiertAm"] = "2026-10-02T11:00:00Z";
  const b2 = await befund([json("x.json", d)]);
  assert.equal(zeichen(b2, "P3"), "widerlegt");
  assert.match(texte(b2, "P3"), /abweichend in importiertAm/);
});

test("P3: hinzugefügte Markierung „importiert“ ist widerlegt", async () => {
  const d = lade();
  const e = d.eintraege.find((x) => x["importiertAm"] === null)!;
  e["importiertAm"] = "2026-10-02T10:00:00Z";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /abweichend in importiertAm/);
});

test("P3: Neubeginn mit Bestand wird als Ausgangsstand genommen", async () => {
  const d = lade("apfel-16.json");
  // Neue Kette: Neubeginn mit dem Bestand beider Einträge und der Abwesenheit, danach eine Änderung.
  const { sha256Hex } = await import("../src/kern/sha.js");
  const { bestandEintragEingabe, bestandAbwesenheitEingabe } = await import("../src/kern/kanonisch.js");
  const e: Record<string, string> = {};
  for (const x of d.eintraege) e[String(x["id"])] = (await sha256Hex(bestandEintragEingabe(x))).slice(0, 32);
  const a: Record<string, string> = { "2026-10-01": (await sha256Hex(bestandAbwesenheitEingabe(d.abwesenheiten[0]!))).slice(0, 32) };
  d.protokoll = [
    { seq: 1, zeitpunkt: "2026-10-03T08:00:00Z", aktion: "ANGELEGT", objektArt: "neubeginn", objektId: "", daten: JSON.stringify({ bestand: "ab".repeat(32), vorherAnzahl: 6, vorherLetzterHash: "cd".repeat(32), vorherZeitpunkt: "2026-10-02T08:00:00.123Z", eintraege: e, abwesenheiten: a }), prev: "", hash: "" },
  ];
  await neuVerketten(d.protokoll);
  let b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b));
  assert.equal(zeichen(b, "P3"), "bestaetigt", texte(b, "P3"));
  assert.match(texte(b, "P9"), /neu begonnen/);
  // Ein Anker auf den letzten Stand der alten Kette passt zum Neubeginn.
  b = await befund([json("x.json", d)], { anker: [anker({ n: 6, t: "2026-10-02T10:00", sha256: "cd".repeat(32) })] });
  assert.equal(zeichen(b, "P5"), "bestaetigt", texte(b, "P5"));
  // Ein geänderter Eintrag des Bestands fällt auf.
  d.eintraege[0]!["notiz"] = "anders";
  b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P3"), "widerlegt");
  assert.match(texte(b, "P3"), /Bestandsprüfsumme/);
});

// P4 Zeit

test("P4: Rücksprung über 2 Minuten ohne uhr_ruecksprung ist nach 4.8 nicht bestätigbar", async () => {
  // TE 4.8 und 8., Schritt 5 (Stand 26.10.2026): „sonst ist die Stelle nicht bestätigbar“; bis 0.1.5 war das ✗.
  const d = lade();
  d.protokoll[6]!["zeitpunkt"] = "2026-10-02T07:50:00.123Z";
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /ohne dass die Kette es vermerkt\.\n {4}Glied 7 /);
  assert.notEqual(b.gesamt, "widerlegt");
});

test("P4: nachträglich geänderter Zeitpunkt ohne neue Prüfsumme bleibt ein Bruch", async () => {
  const d = lade();
  d.protokoll[6]!["zeitpunkt"] = "2026-10-02T07:50:00.123Z";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P2"), "widerlegt");
  assert.equal(b.gesamt, "widerlegt");
});

test("P4: Rücksprung mit folgendem uhr_ruecksprung ist vermerkt", async () => {
  const d = lade();
  d.protokoll[6]!["zeitpunkt"] = "2026-10-02T07:50:00.123Z";
  d.protokoll.splice(7, 0, { seq: 8, zeitpunkt: "2026-10-02T07:50:00.123Z", aktion: "ANGELEGT", objektArt: "uhr_ruecksprung", objektId: "7", daten: '{"vorher":"2026-10-02T08:00:00.123Z","nachher":"2026-10-02T07:50:00.123Z"}', prev: "", hash: "" });
  d.protokoll.forEach((g, i) => (g["seq"] = i + 1));
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P4"), "bestaetigt", texte(b, "P4"));
  // Eine Aussage statt zwei (B2): der Rücksprung zählt, die Abweichung beim Timer steht nur in den Einzelheiten.
  assert.match(texte(b, "P4"), /Die Zeitstempel steigen an\. Die Geräteuhr wurde einmal verstellt oder sprang zurück; jeder Fall ist vermerkt \(Glied 8\)\.\n.*Glied 8 .*\n.*Glied 10 .*Timer-Laufs/);
  assert.doesNotMatch(texte(b, "P4"), /Vorgänge an der Geräteuhr/);
});

test("P4: Neustarts und ausgeschaltete automatische Uhrzeit werden genannt", async () => {
  const d = lade();
  d.protokoll.forEach((g, i) => {
    g["neustarts"] = i === 3 ? 14 : i === 5 ? -1 : 0;
    g["autoZeit"] = i < 6;
  });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.match(texte(b, "P4"), /Das Gerät wurde 14-mal neu gestartet/);
  assert.match(texte(b, "P4"), /Bei 3 Gliedern war „Datum und Uhrzeit automatisch“ ausgeschaltet/);
});

// P5 Anker

test("P5: passender Anker von Hand", async () => {
  const d = lade();
  const b = await befund([json("x.json", d)], { anker: [anker({ n: 6, t: "2026-10-02T10:00", sha256: String(d.protokoll[5]!["hash"]) })] });
  assert.equal(zeichen(b, "P5"), "bestaetigt", texte(b, "P5"));
  assert.match(texte(b, "P5"), /Der Anker vom 02\.10\.2026 10:00 passt zur Kette/);
});

test("P5: falsche Prüfsumme ist widerlegt", async () => {
  const d = lade();
  const b = await befund([json("x.json", d)], { anker: [anker({ n: 6, t: "2026-10-02T10:00", sha256: "1".repeat(64) })] });
  assert.equal(zeichen(b, "P5"), "widerlegt");
  assert.match(texte(b, "P5"), /gehört nicht zu dieser Kette/);
});

test("P5: falscher Zeitpunkt ist widerlegt", async () => {
  const d = lade();
  const b = await befund([json("x.json", d)], { anker: [anker({ n: 6, t: "2026-10-02T11:00", sha256: String(d.protokoll[5]!["hash"]) })] });
  assert.equal(zeichen(b, "P5"), "widerlegt");
  assert.match(texte(b, "P5"), /Zeitpunkt/);
});

test("P5: Anker hinter dem Ende der Kette (gekürzte Kette) ist widerlegt", async () => {
  const d = lade();
  const a = qr(d);
  d.protokoll.splice(7);
  d.eintraege.splice(0, 1);
  d.abwesenheiten.splice(0, 1);
  const b = await befund([json("x.json", d)], { anker: [a] });
  assert.equal(zeichen(b, "P5"), "widerlegt");
  assert.match(b.aussagen.find((x) => x.schritt === "P5")!.begruendung, /gekürzt/);
});

test("P5: falsche Zähler im QR-Code sind widerlegt", async () => {
  const d = lade();
  const a = qr(d);
  a.r = 3;
  const b = await befund([json("x.json", d)], { anker: [a] });
  assert.equal(zeichen(b, "P5"), "widerlegt");
  assert.match(texte(b, "P5"), /r: Der Anker nennt 3/);
});

test("P5: Anker vor einem Bruch der Kette passt, danach nicht", async () => {
  const d = lade();
  const frueh = qr(d, 3);
  const spaet = qr(d, 9);
  d.protokoll[5]!["daten"] = String(d.protokoll[5]!["daten"]).replace("SONDERURLAUB", "KRANKHEIT");
  const b = await befund([json("x.json", d)], { anker: [frueh, spaet] });
  const p5 = b.aussagen.filter((a) => a.schritt === "P5");
  assert.equal(p5[0]!.zeichen, "bestaetigt", texte(b, "P5"));
  assert.equal(p5[1]!.zeichen, "widerlegt");
});

// P8 Nachweise

test("P8: geänderter Inhalt einer Anzeige ist widerlegt", async () => {
  const d = lade();
  const a = (d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!;
  a["betreff"] = "Anzeige";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

test("P8: geändertes Dokument einer Anzeige ist widerlegt", async () => {
  const d = lade();
  const doc = ((d.nachweise["anzeigen"] as Record<string, unknown>[])[0]!["dokumente"] as Record<string, unknown>[])[0]!;
  doc["inhalt"] = "JVBERi0xLjQgQmVpc3BpZWx4";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

test("P8: geänderte Gesprächsnotiz ist widerlegt", async () => {
  const d = lade();
  (d.nachweise["gespraeche"] as Record<string, unknown>[])[0]!["inhalt"] = "anders";
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

test("P8: entferntes Glied der Nachweiskette ist widerlegt", async () => {
  const d = lade();
  (d.nachweise["kette"] as unknown[]).splice(1, 1);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P8"), "widerlegt");
});

// P9 und Eingaben

test("P9: Wiederherstellung mit abweichender Vorgeschichte ist nicht bestätigbar", async () => {
  const d = lade();
  d.protokoll.push({ seq: 10, zeitpunkt: "2026-10-03T08:00:00Z", aktion: "ANGELEGT", objektArt: "wiederherstellung", objektId: "", daten: JSON.stringify({ exportiertAm: "2026-10-02T12:00:00Z", verschluesselt: true, vorherAnzahl: 4, vorherLetzterHash: "ef".repeat(32), vorgeschichte: "ABWEICHEND" }), prev: "", hash: "" });
  await neuVerketten(d.protokoll);
  const b = await befund([json("x.json", d)]);
  assert.equal(zeichen(b, "P9"), "offen", texte(b, "P9"));
  assert.match(texte(b, "P9"), /abweichende Vorgeschichte/);
  // Anker auf den ersetzten Kopf.
  const b2 = await befund([json("x.json", d)], { anker: [anker({ n: 4, t: "2026-10-02T10:00", sha256: "ef".repeat(32) })] });
  assert.match(texte(b2, "P5"), /bei der Wiederherstellung/);
});

test("Buchungsdaten und Sicherungen werden erkannt und erklärt", async () => {
  const d = lade();
  d["umfang"] = "BUCHUNGEN";
  const wattbak = { name: "WATT-Sicherung.wattbak", bytes: utf8("WATTBKUP\u0003...") };
  const b = await befund([json("buchungen.json", d), wattbak]);
  assert.equal(zeichen(b, "E"), "offen");
  assert.match(texte(b, "E"), /nur Buchungsdaten/);
  assert.match(texte(b, "E"), /verschlüsselte Sicherung/);
  assert.equal(zeichen(b, "P2"), null);
});

test("unlesbare Datei ist ein Prüffehler, kein Befund ✗", async () => {
  const b = await befund([{ name: "kaputt.json", bytes: utf8("{ kein json") }]);
  assert.equal(b.gesamt, "offen");
  assert.ok(!b.aussagen.some((a) => a.zeichen === "widerlegt"));
});
