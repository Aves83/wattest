// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Technische Erläuterung aus watt_public af05f6e (Stand 26.10.2026, Vorabfassung): Herkunft erst ab
// dem ersten Schlüssel (4.7, U-27) mit Neubeginn bzw. Wiederherstellung unmittelbar davor (U-28, seit 3a88095 in der
// TE), Sperrliste „nicht bestätigbar“ (4.7, 4.8, U-25) und Aufbau des ZIP-Archivs zum Aktenauszug (6.3, U-26).

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ausBase64, utf8 } from "../src/kern/bytes.js";
import { sha256Hex } from "../src/kern/sha.js";
import { bereinigeDateiname } from "../src/kern/schritte-nachweis.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiereNeu, testzertifikate, type Erzeugt, type Testzertifikate } from "./erzeuger.js";
import { befund, json, liesText, texte, zeichen } from "./hilfen.js";
import { zip } from "./zip-schreiber.js";

let z: Testzertifikate;

before(async () => {
  z = await testzertifikate("ec384");
});

const opt = (weiter: Record<string, unknown> = {}) => ({ wurzeln: [z.wurzelDer], wurzelnStand: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test" }, appSignatur: APP_DIGEST_HEX, ...weiter });

const NEUBEGINN = { seq: 1, zeitpunkt: "1970-01-01T00:00:00Z", aktion: "ANGELEGT", objektArt: "neubeginn", objektId: "", daten: JSON.stringify({ bestand: "ab".repeat(32), vorherAnzahl: 0, vorherLetzterHash: "0", vorherZeitpunkt: null, eintraege: {}, abwesenheiten: {}, bestandsform: 2 }), neustarts: 0, autoZeit: true };

/** Fügt vor Index i Glieder ein, nummeriert neu, verschiebt die Signaturen dahinter, verkettet und signiert neu. */
async function einfuegen(e: Erzeugt, i: number, glieder: Record<string, unknown>[]): Promise<void> {
  const p = e.daten.protokoll;
  p.splice(i, 0, ...glieder);
  p.forEach((x, j) => (x["seq"] = j + 1));
  for (const s of e.daten.kettensignaturen) if (Number(s["seq"]) > i) s["seq"] = Number(s["seq"]) + glieder.length;
  await neuVerketten(p);
  await signiereNeu(e);
}

function vermerkUhr(e: Erzeugt, i: number, objektId: string): Record<string, unknown> {
  const t = String(e.daten.protokoll[i]!["zeitpunkt"]);
  const vorher = new Date(Date.parse(t) - 600000).toISOString().replace(".000Z", "Z");
  return { seq: 0, zeitpunkt: t, aktion: "ANGELEGT", objektArt: "uhr_verstellt", objektId, daten: JSON.stringify({ vorher, nachher: t, abweichungSekunden: 600, richtung: "vor" }), neustarts: 0, autoZeit: true };
}

function wiederherstellung(zeit: string): Record<string, unknown> {
  return { seq: 0, zeitpunkt: zeit, aktion: "ANGELEGT", objektArt: "wiederherstellung", objektId: "", daten: JSON.stringify({ exportiertAm: zeit, verschluesselt: true, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "NICHT_ABGLEICHBAR", signaturen: "KEINE" }), neustarts: -1, autoZeit: true };
}

const bestaetigt = (b: Awaited<ReturnType<typeof befund>>): string | undefined => b.aussagen.find((a) => a.schritt === "P6" && a.zeichen === "bestaetigt")?.text;

// 4.7 (U-27): Glieder vor dem ersten Glied schluessel mit status verfuegbar deckt keine Signatur.

test("4.7, U-27: Glieder vor dem ersten Schlüssel sind „?“; belegt ist nur, dass sie beim ersten Schlüssel in WATT lagen", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 3 });
  const b = await befund([json("u27.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 4–5.", texte(b, "P6"));
  const a = b.aussagen.find((x) => x.schritt === "P6" && x.zeichen === "offen")!;
  assert.equal(a.text, "Die Herkunft der Glieder 1–3 lässt sich nicht bestätigen.");
  assert.equal(a.details![0]!.text, "Glied 1 bis 3: vor dem Beginn des ersten Abschnitts beim ersten Glied schluessel mit status verfuegbar (Glied 4); keine Signatur deckt sie. Belegt ist nur, dass sie beim ersten Schlüssel in WATT lagen.");
  assert.match(a.begruendung, /Glieder vor dem Beginn des ersten Abschnitts \(dem ersten Glied schluessel mit status verfuegbar oder einem Glied neubeginn bzw\. wiederherstellung unmittelbar davor\) deckt keine Signatur/);
  assert.match(texte(b, "P6"), /Glied 1–3: ohne Schlüssel, vor dem ersten Schlüssel \(keine Signatur deckt sie; belegt ist nur, dass sie beim ersten Schlüssel in WATT lagen\)\./);
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  assert.equal(b.gesamt, "offen");
});

test("4.7, U-27: ein einzelnes Glied vor dem ersten Schlüssel", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  const b = await befund([json("u27.json", e.daten)], opt());
  assert.match(texte(b, "P6"), /^P6 offen: Die Herkunft von Glied 1 lässt sich nicht bestätigen\.\n {4}Glied 1: vor dem Beginn des ersten Abschnitts beim ersten Glied schluessel mit status verfuegbar \(Glied 2\); keine Signatur deckt es\. Belegt ist nur, dass es beim ersten Schlüssel in WATT lag\.$/m);
});

test("4.7, U-27: Ohne Schlüssel mit status verfuegbar deckt keine Signatur ein Glied", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const s = e.daten.protokoll[0]!;
  s["daten"] = JSON.stringify({ ...JSON.parse(String(s["daten"])), status: "nicht_verfuegbar", grund: "Test" });
  e.daten.kettensignaturen = [];
  await neuVerketten(e.daten.protokoll);
  const b = await befund([json("nv.json", e.daten)], opt());
  assert.equal(bestaetigt(b), undefined, texte(b, "P6"));
  assert.match(texte(b, "P6"), /^P6 offen: Kein Glied der Kette trägt eine gültige Signatur\.\n {4}Glied 1 bis 3: die Kette hat kein Glied schluessel mit status verfuegbar; keine Signatur deckt sie\.$/m);
  assert.match(texte(b, "P6"), /Glied 1–3: ohne Schlüssel \(die Kette hat kein Glied schluessel mit status verfuegbar\)/);
});

// 4.7 (U-28, seit 3a88095 in der TE): wiederherstellung bzw. neubeginn vor dem ersten Schlüssel, getrennt nur durch
// Vermerke zur Uhr, gehört zum Abschnitt dieses Schlüssels.

test("U-28: neubeginn und Vermerk zur Uhr vor dem ersten Schlüssel deckt die Signatur mit", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  e.daten.protokoll[0] = { ...NEUBEGINN };
  await einfuegen(e, 1, [vermerkUhr(e, 1, "1")]);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["neubeginn", "uhr_verstellt", "schluessel", "eintrag", "eintrag"]);
  const b = await befund([json("u28.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 1–5.", texte(b, "P6"));
  assert.doesNotMatch(texte(b, "P6"), /vor dem Beginn des ersten Abschnitts/);
  assert.match(b.aussagen.find((a) => a.text === bestaetigt(b))!.begruendung, /oder einem Glied neubeginn bzw\. wiederherstellung unmittelbar davor, getrennt nur durch Vermerke zur Uhr \(4\.7\)/);
});

test("U-28: steht zwischen neubeginn und dem ersten Schlüssel ein anderes Glied, beginnt die Herkunft beim Schlüssel", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 2 });
  e.daten.protokoll[0] = { ...NEUBEGINN };
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]).slice(0, 3), ["neubeginn", "eintrag", "schluessel"]);
  const b = await befund([json("u28.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 3–5.", texte(b, "P6"));
  assert.match(texte(b, "P6"), /^P6 offen: Die Herkunft der Glieder 1–2 lässt sich nicht bestätigen\.\n {4}Glied 1 bis 2: vor dem Beginn des ersten Abschnitts beim ersten Glied schluessel mit status verfuegbar \(Glied 3\)/m);
});

test("U-28: wiederherstellung und Vermerk zur Uhr vor dem ersten Schlüssel: gedeckt ab der Wiederherstellung, davor „?“", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 2 });
  const zeit = String(e.daten.protokoll[1]!["zeitpunkt"]);
  await einfuegen(e, 2, [wiederherstellung(zeit), vermerkUhr(e, 2, "3")]);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]).slice(0, 5), ["eintrag", "eintrag", "wiederherstellung", "uhr_verstellt", "schluessel"]);
  const b = await befund([json("u28.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 3–7.", texte(b, "P6"));
  assert.match(texte(b, "P6"), /Glied 1 bis 2: vor dem Beginn des ersten Abschnitts bei Glied 3 \(wiederherstellung unmittelbar vor dem ersten Glied schluessel mit status verfuegbar, Glied 5\); keine Signatur deckt sie\. Belegt ist nur, dass sie beim ersten Schlüssel in WATT lagen; eingespielt vor der Wiederherstellung in Glied 3\./);
});

test("U-28: Vermerk zur Uhr und ein anderes Glied zwischen Wiederherstellung und erstem Schlüssel: Herkunft ab dem Schlüssel", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 2 });
  const zeit = String(e.daten.protokoll[1]!["zeitpunkt"]);
  await einfuegen(e, 1, [wiederherstellung(zeit), vermerkUhr(e, 1, "2")]);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]).slice(0, 5), ["eintrag", "wiederherstellung", "uhr_verstellt", "eintrag", "schluessel"]);
  const b = await befund([json("u28.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 5–7.", texte(b, "P6"));
  assert.match(texte(b, "P6"), /Glied 1 bis 4: vor dem Beginn des ersten Abschnitts beim ersten Glied schluessel mit status verfuegbar \(Glied 5\)/);
});

// 4.7 und 4.8 (U-25): Ein Zertifikat auf der Sperrliste ist „nicht bestätigbar“, nicht „widerlegt“.

test("4.7, 4.8: Zertifikat auf der Sperrliste ist „?“ nach der TE; die Gesamtzeile ist nie ✗", async () => {
  const te = liesText("tests/vektoren/technische-erlaeuterung.json");
  assert.match(te, /69b7418/);
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const sperrliste = { abgerufen: "2026-10-26T00:00:00Z", quelle: "Test", eintraege: { [z.zwischenSeriennummer.toString(16)]: { status: "REVOKED", reason: "KEY_COMPROMISE" } } };
  const b = await befund([json("s.json", e.daten)], opt({ sperrliste }));
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.match(texte(b, "P7"), /steht auf der Sperrliste: Status REVOKED/);
  assert.equal(b.gesamt, "offen");
});

// 6.3: Aufbau des ZIP-Archivs zum Aktenauszug.

test("6.3: Dateinamen werden in sieben Schritten bereinigt (seit 0.1.9 nach dem Stand 69b7418)", () => {
  assert.equal(bereinigeDateiname('a\\b/c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j");
  assert.equal(bereinigeDateiname("x\u0000y\u001fz\u007f.pdf"), "x_y_z_.pdf");
  // Aus „...“ wird zunächst „_.“ und nach Schritt 6 „_“ (bis 0.1.8: „_.“).
  assert.equal(bereinigeDateiname("..."), "_");
  assert.equal(bereinigeDateiname("a....pdf"), "a__pdf");
  assert.equal(bereinigeDateiname("  .Anschreiben.pdf　"), "Anschreiben.pdf");
  // Ein Tabulator ist ein Steuerzeichen und wird in Schritt 1 zu _, bevor Schritt 3 Leerraum entfernt.
  assert.equal(bereinigeDateiname("\t.Anschreiben.pdf"), "_.Anschreiben.pdf");
  assert.equal(bereinigeDateiname("\u0085x"), "x");
  assert.equal(bereinigeDateiname("...pdf"), "_.pdf");
  assert.equal(bereinigeDateiname("."), "dokument");
  assert.equal(bereinigeDateiname(""), "dokument");
  assert.equal(bereinigeDateiname("   "), "dokument");
  assert.equal(bereinigeDateiname("a".repeat(130)), "a".repeat(120));
  assert.equal(bereinigeDateiname("😀".repeat(61)).length, 120);
  assert.equal(bereinigeDateiname("Anschreiben.pdf"), "Anschreiben.pdf");
});

const PDF1 = utf8("%PDF-1.7 Anschreiben");
const PDF2 = utf8("%PDF-1.7 Zusammenfassung");
const TE = utf8("%PDF-1.7 Technische Erläuterung");
const PRUEFEN = utf8("Prüfen mit WATTest\r\nhttps://aves83.github.io/wattest/\r\n");

interface Datei {
  pfad: string;
  inhalt: Uint8Array | string;
  zeit?: { uhrzeit: number; datum: number };
}

/** Aktenauszug nach 6.3; aendere passt die Dateien vor SHA256SUMS.txt an, summen die fertige Liste. */
async function aktenauszug(aendere: (d: Datei[]) => void = () => undefined, summen: (text: string) => string | Uint8Array = (t) => t, ohneSumme = false): Promise<Uint8Array> {
  const dateien: Datei[] = [
    { pfad: "Eintrag_01/Anschreiben.pdf", inhalt: PDF1 },
    { pfad: "Eintrag_03/Zusammenfassung.pdf", inhalt: PDF2 },
    { pfad: "Technische-Erlaeuterung.pdf", inhalt: TE },
    { pfad: "PRUEFEN.txt", inhalt: PRUEFEN },
  ];
  aendere(dateien);
  let text = "";
  for (const d of dateien) text += `${await sha256Hex(typeof d.inhalt === "string" ? utf8(d.inhalt) : d.inhalt)}  ${d.pfad}\n`;
  return zip(ohneSumme ? dateien : [...dateien, { pfad: "SHA256SUMS.txt", inhalt: summen(text) }]);
}

async function aufbau(bytes: Uint8Array): Promise<{ zeichen: string; text: string; details: string; b: Awaited<ReturnType<typeof befund>> }> {
  const b = await befund([{ name: "Aktenauszug.zip", bytes }]);
  const a = b.aussagen.find((x) => x.schritt === "P8" && /Aufbau des ZIP-Archivs|keine PRUEFEN\.txt/.test(x.text));
  assert.ok(a, texte(b, "P8"));
  return { zeichen: a.zeichen, text: a.text, details: (a.details ?? []).map((d) => d.text).join("\n"), b };
}

test("6.3: Aktenauszug nach 6.3 (mit Lücke in den Nummern): Aufbau bestätigt, Dateien unverändert", async () => {
  const r = await aufbau(await aktenauszug());
  assert.equal(r.zeichen, "bestaetigt", texte(r.b, "P8"));
  assert.equal(r.text, "Der Aufbau des ZIP-Archivs entspricht 6.3.");
  assert.ok(r.b.aussagen.some((x) => x.text === "Die Dokumente im Aktenauszug sind unverändert." && x.zeichen === "bestaetigt"));
  assert.doesNotMatch(texte(r.b, "P8"), /nicht in SHA256SUMS\.txt/);
});

test("6.3: Ordner Eintrag_100 (ab 100 dreistellig) nach Eintrag_03", async () => {
  const bytes = await aktenauszug((d) => {
    d.splice(2, 0, { pfad: "Eintrag_100/Einzelnachweis.pdf", inhalt: "%PDF-1.7 Einzelnachweis" });
  });
  const r = await aufbau(bytes);
  assert.equal(r.zeichen, "bestaetigt", r.details);
});

const abweichungen: [string, (d: Datei[]) => void, ((t: string) => string | Uint8Array) | null, RegExp][] = [
  ["Ordner mit einer Ziffer", (d) => (d[0]!.pfad = "Eintrag_1/Anschreiben.pdf"), null, /Eintrag_1\/Anschreiben\.pdf: liegt nicht in einem Ordner Eintrag_NN/],
  ["Ordner mit führender Null", (d) => (d[0]!.pfad = "Eintrag_001/Anschreiben.pdf"), null, /Eintrag_001\/Anschreiben\.pdf: liegt nicht in einem Ordner Eintrag_NN/],
  ["Ordner Eintrag_00", (d) => (d[0]!.pfad = "Eintrag_00/Anschreiben.pdf"), null, /Eintrag_00\/Anschreiben\.pdf: liegt nicht in einem Ordner Eintrag_NN/],
  ["Unterordner", (d) => (d[0]!.pfad = "Eintrag_01/x/Anschreiben.pdf"), null, /Eintrag_01\/x\/Anschreiben\.pdf: liegt nicht in einem Ordner Eintrag_NN/],
  ["weitere Datei in der Wurzel", (d) => d.splice(2, 0, { pfad: "Aktenauszug.pdf", inhalt: "%PDF" }), null, /Aktenauszug\.pdf: In der Wurzel stehen nach 6\.3 nur Technische-Erlaeuterung\.pdf, PRUEFEN\.txt, SHA256SUMS\.txt\./],
  // Leerraum am Ende bleibt nur nach der Kürzung auf 120 Zeichen; am Anfang kann er aus WATT stammen (E-67).
  ["Dateiname nicht bereinigt", (d) => (d[0]!.pfad = "Eintrag_01/Anschreiben.pdf "), null, /Der Dateiname ist nicht nach 6\.3 bereinigt \(bereinigt: „Anschreiben\.pdf“\)/],
  ["Dateiname mit Punktfolge", (d) => (d[0]!.pfad = "Eintrag_01/a..pdf"), null, /bereinigt: „a_pdf“/],
  ["Technische Erläuterung fehlt", (d) => d.splice(2, 1), null, /Technische-Erlaeuterung\.pdf fehlt in der Wurzel\./],
  ["Technische Erläuterung unter anderem Namen", (d) => (d[2]!.pfad = "Technische_Erlaeuterung.pdf"), null, /Technische-Erlaeuterung\.pdf fehlt in der Wurzel\./],
  ["Reihenfolge der Ordner", (d) => d.splice(0, 2, d[1]!, d[0]!), null, /Eintrag_01\/Anschreiben\.pdf: steht im Archiv nach Eintrag_03\/Zusammenfassung\.pdf/],
  ["PRUEFEN.txt vor der Technischen Erläuterung", (d) => d.splice(2, 2, d[3]!, d[2]!), null, /Technische-Erlaeuterung\.pdf: steht im Archiv nach PRUEFEN\.txt/],
  ["PRUEFEN.txt mit LF", (d) => (d[3]!.inhalt = "Prüfen\nmit WATTest\r\n"), null, /PRUEFEN\.txt hat 1 Zeilenende LF; nach 6\.3 endet jede Zeile mit CRLF\./],
  ["PRUEFEN.txt mit einzelnem CR", (d) => (d[3]!.inhalt = "Prüfen\rmit WATTest\r\n"), null, /PRUEFEN\.txt hat 1 einzelnes CR/],
  ["PRUEFEN.txt mit BOM", (d) => (d[3]!.inhalt = new Uint8Array([0xef, 0xbb, 0xbf, ...PRUEFEN])), null, /PRUEFEN\.txt beginnt mit einem BOM\./],
  ["PRUEFEN.txt kein UTF-8", (d) => (d[3]!.inhalt = new Uint8Array([0x50, 0xfc, 0x0d, 0x0a])), null, /PRUEFEN\.txt ist kein gültiges UTF-8\./],
  ["verschiedene Änderungszeiten", (d) => (d[1]!.zeit = { uhrzeit: 0x6000, datum: 0x5d5a }), null, /2 verschiedene Änderungszeiten/],
  ["SHA256SUMS.txt mit CRLF", () => undefined, (t) => t.replace(/\n/g, "\r\n"), /SHA256SUMS\.txt enthält CR/],
  ["SHA256SUMS.txt mit BOM", () => undefined, (t) => new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(t)]), /SHA256SUMS\.txt beginnt mit einem BOM\./],
  ["SHA256SUMS.txt ohne letztes Zeilenende", () => undefined, (t) => t.slice(0, -1), /SHA256SUMS\.txt endet nicht mit einem Zeilenende\./],
  ["SHA256SUMS.txt mit Großbuchstaben", () => undefined, (t) => t.replace(/^[0-9a-f]{64}/gm, (h) => h.toUpperCase()), /Zeile 1: nicht in der Form „64 Zeichen Hexadezimal in Kleinbuchstaben/],
  ["SHA256SUMS.txt mit Stern", () => undefined, (t) => t.replace(/  /g, " *"), /Zeile 1: nicht in der Form/],
  ["SHA256SUMS.txt in anderer Reihenfolge", () => undefined, (t) => t.split("\n").slice(0, -1).reverse().join("\n") + "\n", /nennt nicht genau die übrigen Dateien des Archivs in seiner Reihenfolge/],
  ["SHA256SUMS.txt mit Leerzeile", () => undefined, (t) => t + "\n", /Zeile 5: nicht in der Form/],
  ["SHA256SUMS.txt nennt sich selbst", () => undefined, (t) => t + `${"0".repeat(64)}  SHA256SUMS.txt\n`, /SHA256SUMS\.txt nennt sich selbst\./],
];

for (const [name, aendere, summen, erwartet] of abweichungen) {
  test(`6.3: ${name}: Aufbau „?“, nicht ✗`, async () => {
    const r = await aufbau(await aktenauszug(aendere, summen ?? undefined));
    assert.equal(r.zeichen, "offen", `${r.text}\n${r.details}`);
    assert.equal(r.text, "Der Aufbau des ZIP-Archivs weicht von 6.3 ab.");
    assert.match(r.details, erwartet);
  });
}

test("6.3: SHA256SUMS.txt nicht als letzte Datei", async () => {
  const dateien: Datei[] = [
    { pfad: "Eintrag_01/Anschreiben.pdf", inhalt: PDF1 },
    { pfad: "Technische-Erlaeuterung.pdf", inhalt: TE },
    { pfad: "PRUEFEN.txt", inhalt: PRUEFEN },
  ];
  let text = "";
  for (const d of dateien) text += `${await sha256Hex(d.inhalt as Uint8Array)}  ${d.pfad}\n`;
  const r = await aufbau(await zip([dateien[0]!, dateien[1]!, { pfad: "SHA256SUMS.txt", inhalt: text }, dateien[2]!]));
  assert.equal(r.zeichen, "offen");
  assert.match(r.details, /SHA256SUMS\.txt ist nicht die letzte Datei im Archiv\./);
  assert.match(r.details, /PRUEFEN\.txt: steht im Archiv nach SHA256SUMS\.txt/);
});

test("6.3: Eine veränderte Datei bleibt ✗, auch wenn der Aufbau stimmt", async () => {
  const bytes = await aktenauszug(undefined, (t) => t.replace(/^[0-9a-f]{64}/, "0".repeat(64)));
  const r = await aufbau(bytes);
  assert.equal(r.zeichen, "bestaetigt", r.details);
  assert.equal(zeichen(r.b, "P8"), "widerlegt");
});

test("6.3: Ohne PRUEFEN.txt prüft WATTest den Aufbau nicht (Fassung vor Formatversion 19)", async () => {
  const bytes = await aktenauszug((d) => d.splice(3, 1));
  const r = await aufbau(bytes);
  assert.equal(r.zeichen, "hinweis");
  assert.equal(r.text, "Das ZIP enthält keine PRUEFEN.txt; seinen Aufbau prüft WATTest nicht.");
  assert.notEqual(zeichen(r.b, "P8"), "widerlegt");
});

test("6.3: Ein Dokument namens SHA256SUMS.txt in einem Ordner Eintrag_NN ist nicht die Liste", async () => {
  const pdf = ausBase64("JVBERi0xLjc=")!;
  const bytes = await aktenauszug((d) => d.splice(1, 0, { pfad: "Eintrag_02/SHA256SUMS.txt", inhalt: pdf }));
  const r = await aufbau(bytes);
  assert.equal(r.zeichen, "bestaetigt", r.details);
  assert.ok(r.b.aussagen.some((x) => x.text === "Die Dokumente im Aktenauszug sind unverändert."), texte(r.b, "P8"));
});
