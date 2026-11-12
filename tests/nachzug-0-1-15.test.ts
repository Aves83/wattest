// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf Datenformat 20 von WATT „Felsenbirne“ (Grundlage in watt_public: folgt mit Teil 2):
// - Datenformat und Schema 20: nachweise.anzeigen[].art mit UEBERLASTUNGSANZEIGE oder ZEITAUSGLEICH (im XML Typ
//   Anzeigeart), letztes Feld der Anzeige, kein Pflichtfeld; „Fehlt das Feld (Versionen 16 bis 19), ist es eine
//   Überlastungsanzeige.“ Beim Antrag auf Zeitausgleich ist stufe immer AUSSAGE und ohne Bedeutung, zeitraumVon und
//   zeitraumBis sind trotzdem gesetzt, kopien ist leer, dokumente enthält nur das Anschreiben.
// - Technische Erläuterung 5. und 5.1: „Anzeige“ meint beide Arten von Schreiben; beide erzeugen dieselben Einträge
//   ANZEIGE_GESENDET und ANZEIGE_GELOESCHT, die Art steht nicht im Ketteneintrag und geht nicht in die
//   Inhaltsprüfsumme ein, das Prüfverfahren (Verfahren 2) ist für beide dasselbe.
// - Rechenbeispiel B3 mit "version": 20 und neuer Prüfsumme; B4 bis B7 unverändert.
// Eine Beispieldatei der Version 20 gibt es noch nicht; die Dateien hier sind aus drachenfrucht-19 abgeleitet. Die
// Formatversion geht in keine Prüfsumme der Ketten ein, Arbeitszeitkette und Signaturen bleiben deshalb gültig.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import type { Befund } from "../src/kern/befund.js";
import { ausBase64, base64, hex, puffer, utf8 } from "../src/kern/bytes.js";
import { nachweiseNeuVerketten } from "./erzeuger.js";
import { befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";
import { alsXml } from "./xml-schreiber.js";
import { zip } from "./zip-schreiber.js";

type Satz = Record<string, unknown>;
type Daten = { version: number; protokoll: Satz[]; nachweise: { anzeigen: Satz[]; gespraeche: Satz[]; kette: Satz[] } } & Satz;

const lade = (name: string): Daten => JSON.parse(liesText(`tests/beispiele/${name}`)) as Daten;

/** Befund mit einem Anker auf den Kopf der Arbeitszeitkette. */
async function mitAnker(d: Daten, name = "x.json"): Promise<Befund> {
  const a = leseQr(qrAus(d as never));
  assert.ok(a.ok);
  return befund([name.endsWith(".xml") ? { name, bytes: utf8(alsXml(d)) } : json(name, d)], { anker: [a.anker] });
}

const von = (b: Befund, schritt: string): [string, string][] => b.aussagen.filter((x) => x.schritt === schritt && x.zeichen !== "hinweis").map((x) => [x.zeichen, x.text]);
const aussage = (b: Befund, text: string) => {
  const a = b.aussagen.find((x) => x.text === text);
  assert.ok(a, `${text}\n${texte(b)}`);
  return a;
};

// Eigene Rechnung nach 5.1 (Verfahren 2), unabhängig vom Kern; art gehört nicht zu den Feldern.
const L = (w: unknown): string => {
  const t = w === null || w === undefined ? "" : String(w);
  return `${utf8(t).length}:${t}`;
};
const sha = async (b: Uint8Array): Promise<string> => hex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", puffer(b))));

async function pruefsummeVerfahren2(a: Satz): Promise<string> {
  let s = L(2) + L(a["id"]) + L(a["stufe"]) + L(a["zeitraumVon"]) + L(a["zeitraumBis"]) + L(a["angabenArt"]) + L(a["angabenEntfernt"]) + L(a["empfaenger"]);
  const kopien = a["kopien"] as Satz[];
  s += L(kopien.length);
  for (const k of kopien) s += L(k["stelle"]) + L(k["email"]);
  s += L(a["betreff"]) + L(a["anschreiben"]) + L(a["datum"]) + L(a["gesendetAn"]) + L(a["gesendetAm"]);
  const dokumente = a["dokumente"] as Satz[];
  s += L(dokumente.length);
  for (const d of dokumente) s += L(d["art"]) + L(d["dateiname"]) + L(await sha(ausBase64(String(d["inhalt"]))!));
  const fest = (a["notizen"] as Satz[]).filter((n) => n["fest"] === true);
  assert.ok(fest.length <= 1, "die Tests brauchen keine Sortierung der Notizen");
  s += L(fest.length);
  for (const n of fest) s += L(n["erstelltAm"]) + L(n["text"]);
  const k = a["kettenkopf"] as Satz | null;
  s += k ? L(k["anzahl"]) + L(k["hash"]) + L(k["zeitpunkt"]) : L("") + L("") + L("");
  return sha(utf8(s));
}

const UEBERLASTUNG = "c79cbcd4-631f-470d-9405-ae990a708f79";
const ANTRAG = "7d1f3c52-0b7e-4a57-9d0e-5f2a6c1b8e20";
const ANTRAG_PDF = utf8("%PDF-1.4 Antrag");

/**
 * drachenfrucht-19 als Datei der Version 20: die vorhandene Anzeige mit art UEBERLASTUNGSANZEIGE, dazu ein gesendeter
 * Antrag auf Zeitausgleich (stufe AUSSAGE, Zeitraum gesetzt, keine Kopien, nur das Anschreiben), Prüfsumme nach
 * Verfahren 2 selbst gerechnet, als Glied 4 an die Nachweiskette gehängt.
 */
async function mitAntrag(): Promise<Daten> {
  const d = lade("drachenfrucht-19.json");
  d.version = 20;
  d.nachweise.anzeigen[0]!["art"] = "UEBERLASTUNGSANZEIGE";
  const kopf = d.protokoll.at(-1)!;
  const antrag: Satz = {
    id: ANTRAG,
    erzeugtAm: "2026-10-02T09:00:00Z",
    stufe: "AUSSAGE",
    zeitraumVon: "2026-09-21",
    zeitraumBis: "2026-09-25",
    angabenArt: "PLATZHALTER",
    angabenEntfernt: false,
    empfaenger: "leitung@schule.example",
    kopien: [],
    betreff: "Antrag auf Zeitausgleich",
    anschreiben: "Sehr geehrte Damen und Herren …",
    datum: "2026-10-02",
    gesendetAn: "leitung@schule.example",
    gesendetAm: "2026-10-02T09:15:00Z",
    pruefsumme: null,
    wiedervorlageAm: null,
    wiedervorlageErledigt: false,
    wiederhergestelltAm: null,
    backupVom: null,
    dokumente: [{ art: "ANSCHREIBEN", dateiname: "Antrag.pdf", inhalt: base64(ANTRAG_PDF) }],
    notizen: [],
    pruefverfahren: 2,
    kettenkopf: { anzahl: kopf["seq"], hash: kopf["hash"], zeitpunkt: kopf["zeitpunkt"] },
    anhaenge: [],
    art: "ZEITAUSGLEICH",
  };
  antrag["pruefsumme"] = await pruefsummeVerfahren2(antrag);
  d.nachweise.anzeigen.push(antrag);
  d.nachweise.kette.push({ seq: 4, zeitpunkt: "2026-10-02T09:15:00Z", ereignis: "ANZEIGE_GESENDET", referenzId: ANTRAG, pruefsumme: antrag["pruefsumme"], prev: "", hash: "" });
  await nachweiseNeuVerketten(d.nachweise.kette, 3);
  return d;
}

const P8_BESTAETIGT: [string, string][] = [
  ["bestaetigt", "Die Nachweiskette ist lückenlos und unverändert."],
  ["bestaetigt", "Die Nachweise entsprechen der Nachweiskette."],
];
const begruendungP8 = (schreiben: string): string => `WATTest hat die Inhaltsprüfsummen von ${schreiben} mit 2 Dokumenten, 1 Gesprächsnotiz und 1 Nachtrag nach 5.1 neu berechnet; jede stimmt mit der gespeicherten und mit dem Glied der Nachweiskette überein.`;

/** Wie drachenfrucht-19 in 0.1.13: P1 bis P6, P8, P9 ✓, P7 „?“ ohne Wurzeln, Gesamtzeile „?“. */
function wieDrachenfrucht(b: Befund): void {
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.equal(b.gesamt, "offen");
}

test("Unterlagen: B3 mit \"version\": 20 und neuer Prüfsumme, B4 bis B7 unverändert", () => {
  const v = (JSON.parse(liesText("tests/vektoren/technische-erlaeuterung.json")) as { vektoren: { id: string; eingabe: string; sha256: string }[] }).vektoren;
  const b3 = v.find((x) => x.id === "B3")!;
  assert.equal(b3.eingabe.split("\n")[2], '    "version": 20,');
  assert.equal(b3.sha256, "9d646eb97c571b226deea8ab3f188663755d1f3be1d1fbc7da8c67ef1e0d556f");
  // Werte wie in WATTest 0.1.13 (watt_public b97d95c).
  for (const [id, summe] of [
    ["B4", "71106548e39f6879dab3b120034a07da4382b67ce3d2cc3e91c21ff6613912b7"],
    ["B5", "91f081c27971d7668642eb508fc7ee4549cdb67b7f2284c3502dc9893917250b"],
    ["B6", "315d429b7714cedb6ad04ac31240145257692630457f3c88253c5beceac76027"],
    ["B7", "65abd5b0c8432113e3236d16a8764f4023a16a569ad0dd609f814e63a3a08762"],
  ]) assert.equal(v.find((x) => x.id === id)!.sha256, summe, id);
});

test("eigene Rechnung nach 5.1, Verfahren 2, ergibt die gespeicherte Prüfsumme der Anzeige in drachenfrucht-19 und erdbeere-19", async () => {
  for (const name of ["drachenfrucht-19.json", "erdbeere-19.json"]) {
    const a = lade(name).nachweise.anzeigen[0]!;
    assert.equal(await pruefsummeVerfahren2(a), a["pruefsumme"], name);
  }
});

test("P1, Formatversion 20 ohne art (drachenfrucht-19 nur mit version 20): ✓, art ist kein Pflichtfeld; P8 zählt eine Überlastungsanzeige", async () => {
  const d = lade("drachenfrucht-19.json");
  d.version = 20;
  const b = await mitAnker(d);
  assert.deepEqual(von(b, "P1"), [["bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20."]]);
  assert.equal(aussage(b, "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20.").begruendung, "format watt-daten, version 20, exportiert am 2026-10-02T10:00:00.123Z aus WATT 0.8.111. Pflichtfelder und Typen der gelesenen Teile entsprechen watt-daten-20.schema.json.");
  // Version 20 steht (noch) nicht als Vorabfassung in der README der Schemas: kein Hinweis.
  assert.ok(!b.aussagen.some((x) => x.schritt === "P1" && x.zeichen === "hinweis"), texte(b, "P1"));
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, "WATTest hat die Inhaltsprüfsummen von 1 gesendeten Überlastungsanzeige mit 1 Dokument, 1 Gesprächsnotiz und 1 Nachtrag nach 5.1 neu berechnet; jede stimmt mit der gespeicherten und mit dem Glied der Nachweiskette überein.");
  wieDrachenfrucht(b);
});

test("Version 20, gesendeter Antrag auf Zeitausgleich (AUSSAGE, Zeitraum gesetzt, keine Kopien), Nachweiskette neu verkettet: P1 ✓, P8 ✓", async () => {
  const d = await mitAntrag();
  const antrag = d.nachweise.anzeigen[1]!;
  assert.deepEqual([antrag["art"], antrag["stufe"], antrag["zeitraumVon"], antrag["zeitraumBis"], antrag["kopien"]], ["ZEITAUSGLEICH", "AUSSAGE", "2026-09-21", "2026-09-25", []]);
  const b = await mitAnker(d);
  assert.deepEqual(von(b, "P1"), [["bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20."]]);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweiskette ist lückenlos und unverändert.").fundstelle, "Nachweisglied 1 bis 4, Datei „x.json“");
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("1 gesendeten Überlastungsanzeige und 1 gesendeten Antrag auf Zeitausgleich"));
  // Anhänge trägt nur die Überlastungsanzeige; die Einzelheiten nennen das Schreiben nach seiner Art.
  const anhaenge = aussage(b, "Die Datei nennt 2 Anhänge zu Anzeigen; Anhänge prüft WATTest nicht.");
  assert.ok(anhaenge.details!.every((x) => x.text.startsWith(`Überlastungsanzeige ${UEBERLASTUNG}, Anhang `)), texte(b, "P8"));
  wieDrachenfrucht(b);
});

test("dieselbe Datei mit geändertem art, Prüfsumme unverändert: P8 bleibt ✓, art geht nicht in die Prüfsumme ein", async () => {
  // Antrag als Überlastungsanzeige ausgegeben.
  const d = await mitAntrag();
  d.nachweise.anzeigen[1]!["art"] = "UEBERLASTUNGSANZEIGE";
  let b = await mitAnker(d);
  assert.deepEqual(von(b, "P1"), [["bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20."]]);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("2 gesendeten Überlastungsanzeigen"));
  wieDrachenfrucht(b);

  // Überlastungsanzeige (Stufe ZUSAMMENFASSUNG, eine Kopie) als Antrag ausgegeben: Das Schema bindet stufe und kopien
  // nicht an art, WATTest wertet die Art nicht (E-70): P1 und P8 bleiben ✓.
  const e = await mitAntrag();
  e.nachweise.anzeigen[0]!["art"] = "ZEITAUSGLEICH";
  b = await mitAnker(e);
  assert.deepEqual(von(b, "P1"), [["bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20."]]);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("2 gesendeten Anträgen auf Zeitausgleich"));

  // Ohne art beim Antrag: nach dem Schema eine Überlastungsanzeige, Prüfsumme und Kette unberührt.
  const f = await mitAntrag();
  delete f.nachweise.anzeigen[1]!["art"];
  b = await mitAnker(f);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("2 gesendeten Überlastungsanzeigen"));
});

test("Version 20, geänderter Inhalt des Antrags (stufe, Zeitraum, Betreff) bei gleicher Prüfsumme: P8 ✗ wie bei der Überlastungsanzeige", async () => {
  for (const [feld, wert] of [["stufe", "NACHWEIS"], ["zeitraumBis", "2026-09-26"], ["betreff", "Antrag"]] as const) {
    const d = await mitAntrag();
    d.nachweise.anzeigen[1]![feld] = wert;
    const b = await mitAnker(d);
    assert.deepEqual(von(b, "P8"), [
      ["bestaetigt", "Die Nachweiskette ist lückenlos und unverändert."],
      ["widerlegt", "Die Nachweise entsprechen nicht der Nachweiskette."],
    ], feld);
    assert.deepEqual(aussage(b, "Die Nachweise entsprechen nicht der Nachweiskette.").details!.map((x) => x.text), [
      `Antrag auf Zeitausgleich ${ANTRAG}: Die gespeicherte Prüfsumme passt nicht zum Inhalt (Verfahren 2).`,
      `Antrag auf Zeitausgleich ${ANTRAG}: Nachweisglied 4 nennt eine andere Prüfsumme als der Inhalt ergibt.`,
    ]);
  }
});

test("Version 20, art mit unbekanntem Wert: P1 ✗; P8 rechnet weiter und nennt das Schreiben ohne Art", async () => {
  const d = await mitAntrag();
  d.nachweise.anzeigen[1]!["art"] = "WIDERSPRUCH";
  const b = await mitAnker(d);
  assert.deepEqual(von(b, "P1"), [["widerlegt", "Die Datei entspricht nicht dem Datenformat 20."]]);
  assert.deepEqual(aussage(b, "Die Datei entspricht nicht dem Datenformat 20.").details!.map((x) => x.text), ["$.nachweise: Wert passt zu keiner erlaubten Form", '$.nachweise.anzeigen[1].art: Wert "WIDERSPRUCH" ist nicht erlaubt']);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("1 gesendeten Überlastungsanzeige und 1 gesendeten Schreiben"));
  assert.equal(b.gesamt, "widerlegt");
  // Ebenso ein Wert vom falschen Typ.
  const e = await mitAntrag();
  e.nachweise.anzeigen[1]!["art"] = 2;
  assert.equal(zeichen(await mitAnker(e), "P1"), "widerlegt");
});

test("Version 20 als XML mit art (Typ Anzeigeart): wie JSON; unbekannter Wert ebenso P1 ✗", async () => {
  const d = await mitAntrag();
  const xml = alsXml(d);
  assert.match(xml, /<anhaenge\/>\n\s*<art>ZEITAUSGLEICH<\/art>\n\s*<\/anzeige>/);
  const b = await mitAnker(d, "x.xml");
  assert.deepEqual(von(b, "P1"), [["bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20 (XML)."]]);
  assert.match(aussage(b, "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20 (XML).").begruendung, /entsprechen watt-daten-20\.xsd \(über die Abbildung auf das JSON und watt-daten-20\.schema\.json\)\.$/);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  assert.equal(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, begruendungP8("1 gesendeten Überlastungsanzeige und 1 gesendeten Antrag auf Zeitausgleich"));
  for (const s of ["P2", "P3", "P4", "P5", "P6", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);

  d.nachweise.anzeigen[1]!["art"] = "WIDERSPRUCH";
  const c = await mitAnker(d, "x.xml");
  assert.deepEqual(von(c, "P1"), [["widerlegt", "Die Datei entspricht nicht dem Datenformat 20."]]);
  assert.deepEqual(von(c, "P8"), P8_BESTAETIGT);
});

test("Version 19 mit Feld art: Schema 19 kennt das Feld nicht, P1 „?“ (unbekanntes Feld, E-8); P8 übergeht es", async () => {
  for (const name of ["x.json", "x.xml"]) {
    const d = lade("drachenfrucht-19.json");
    d.nachweise.anzeigen[0]!["art"] = "ZEITAUSGLEICH";
    const b = await mitAnker(d, name);
    assert.deepEqual(von(b, "P1"), [
      ["bestaetigt", `Die Datei ist ein vollständiger Klartext-Export im Datenformat 19${name.endsWith(".xml") ? " (XML)" : ""}.`],
      ["offen", "Die Datei enthält Felder, die das Datenformat nicht kennt."],
    ], name);
    assert.deepEqual(aussage(b, "Die Datei enthält Felder, die das Datenformat nicht kennt.").details!.map((x) => x.text), ["$.nachweise.anzeigen[0]: unbekanntes Feld art"], name);
    assert.ok(!b.aussagen.some((x) => x.zeichen === "widerlegt"), texte(b));
    assert.deepEqual(von(b, "P8"), P8_BESTAETIGT, name);
    // Vor Version 20 ist jedes Schreiben eine Überlastungsanzeige; das unbekannte Feld ändert die Benennung nicht.
    assert.match(aussage(b, "Die Nachweise entsprechen der Nachweiskette.").begruendung, /von 1 gesendeten Überlastungsanzeige mit 1 Dokument,/);
    assert.equal(b.gesamt, "offen");
  }
});

test("gelöschtes Schreiben: Das Glied nennt keine Art, P8 nennt es „Schreiben“ (Version 20 und 19)", async () => {
  const d = await mitAntrag();
  const antrag = d.nachweise.anzeigen.pop()!;
  d.nachweise.kette.push({ seq: 5, zeitpunkt: "2026-10-02T09:30:00Z", ereignis: "ANZEIGE_GELOESCHT", referenzId: ANTRAG, pruefsumme: antrag["pruefsumme"], prev: "", hash: "" });
  await nachweiseNeuVerketten(d.nachweise.kette, 4);
  let b = await mitAnker(d);
  assert.deepEqual(von(b, "P8"), P8_BESTAETIGT);
  let h = aussage(b, "Die Nachweiskette vermerkt 1 Löschung.");
  assert.equal(h.zeichen, "hinweis");
  assert.deepEqual(h.details!.map((x) => x.text), [`Nachweisglied 5: Schreiben ${ANTRAG} gelöscht (eingetragen in Nachweisglied 4).`]);
  assert.equal(h.begruendung, "Gesendete Schreiben (Überlastungsanzeigen und Anträge auf Zeitausgleich) und Gesprächsnotizen lassen sich löschen; ihr Inhalt verschwindet, der Vermerk ihrer Existenz bleibt in der Kette (5.). Das Glied nennt die Art eines Schreibens nicht; ein gelöschtes heißt hier deshalb nur „Schreiben“.");
  wieDrachenfrucht(b);

  const e = lade("drachenfrucht-19.json");
  const anzeige = e.nachweise.anzeigen.pop()!;
  e.nachweise.kette.push({ seq: 4, zeitpunkt: "2026-10-02T09:30:00Z", ereignis: "ANZEIGE_GELOESCHT", referenzId: UEBERLASTUNG, pruefsumme: anzeige["pruefsumme"], prev: "", hash: "" });
  await nachweiseNeuVerketten(e.nachweise.kette, 3);
  b = await mitAnker(e);
  h = aussage(b, "Die Nachweiskette vermerkt 1 Löschung.");
  assert.deepEqual(h.details!.map((x) => x.text), [`Nachweisglied 4: Schreiben ${UEBERLASTUNG} gelöscht (eingetragen in Nachweisglied 1).`]);
  assert.equal(zeichen(b, "P8"), "bestaetigt", texte(b, "P8"));
});

test("Aktenauszug mit dem Anschreiben des Antrags: an die Nachweiskette gebunden, benannt als Antrag auf Zeitausgleich", async () => {
  const d = await mitAntrag();
  const anschreiben = ausBase64(String((d.nachweise.anzeigen[0]!["dokumente"] as Satz[])[0]!["inhalt"]))!;
  const bytes = await zip([
    { pfad: "Aktenauszug/Anschreiben.pdf", inhalt: anschreiben },
    { pfad: "Aktenauszug/Antrag.pdf", inhalt: ANTRAG_PDF },
    { pfad: "Aktenauszug/SHA256SUMS.txt", inhalt: `${await sha(anschreiben)}  Anschreiben.pdf\n${await sha(ANTRAG_PDF)}  Antrag.pdf\n` },
  ]);
  const b = await befund([{ name: "Aktenauszug.zip", bytes }, json("x.json", d)]);
  const a = aussage(b, "Die Dokumente im Aktenauszug gehören zu Nachweisen in der Nachweiskette.");
  assert.equal(a.zeichen, "bestaetigt");
  assert.deepEqual(a.details!.map((x) => x.text), [
    `Aktenauszug/Anschreiben.pdf: Dokument Anschreiben.pdf der Überlastungsanzeige ${UEBERLASTUNG}, Nachweisglied 1 (Datei „x.json“)`,
    `Aktenauszug/Antrag.pdf: Dokument Antrag.pdf des Antrags auf Zeitausgleich ${ANTRAG}, Nachweisglied 4 (Datei „x.json“)`,
  ]);
});

test("P1: Version 21 bleibt unbekannt; unter 16 nennt die Begründung die Versionen 16 bis 20", async () => {
  const d = lade("drachenfrucht-19.json");
  d.version = 21;
  let b = await befund([json("neu-21.json", d)]);
  assert.deepEqual(von(b, "P1"), [["offen", "WATTest kennt das Datenformat 21 nicht."]]);
  assert.match(aussage(b, "WATTest kennt das Datenformat 21 nicht.").begruendung, /^WATTest 0\.1 kennt die Formatversionen 16 bis 20\. Eine neuere Version braucht eine neuere Fassung von WATTest\./);
  assert.ok(!b.aussagen.some((x) => x.zeichen === "widerlegt"), texte(b));
  d.version = 15;
  b = await befund([json("alt-15.json", d)]);
  assert.match(aussage(b, "WATT liest Dateien ab Formatversion 16; diese Datei hat Formatversion 15.").begruendung, /WATTest kennt die Formatversionen 16 bis 20\./);
});
