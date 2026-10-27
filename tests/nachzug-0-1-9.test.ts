// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Technische Erläuterung aus watt_public 69b7418 (Stand 27.10.2026, Vorabfassung): Wiederherstellung
// als Eintrag 1 (4.7, U-29 geschlossen) und die Bereinigung der Dateinamen in sieben Schritten (6.3, E-67). Seit 0.1.11
// (Stand 3a11ea8): Schritt 7 ohne Endung (tests/nachzug-0-1-11.test.ts).

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { sha256Hex } from "../src/kern/sha.js";
import { bereinigeDateiname, endungNach63, istBereinigt } from "../src/kern/schritte-nachweis.js";
import { utf8 } from "../src/kern/bytes.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiereNeu, testzertifikate, type Erzeugt, type Testzertifikate } from "./erzeuger.js";
import { befund, json, liesText, texte } from "./hilfen.js";
import { zip } from "./zip-schreiber.js";

let z: Testzertifikate;

before(async () => {
  z = await testzertifikate("ec384");
});

const opt = () => ({ wurzeln: [z.wurzelDer], wurzelnStand: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test" }, appSignatur: APP_DIGEST_HEX });

test("Unterlagen: Rechenbeispiele seit watt_public 69b7418 unverändert (Quelle jetzt 3a11ea8), Stand 27.10.2026", () => {
  assert.match(liesText("tests/vektoren/technische-erlaeuterung.json"), /Commit 3a11ea8\), Codeblöcke der Rechenbeispiele, Stand 27\.10\.2026/);
});

// 4.7, Stand 69b7418: „Dasselbe gilt für eine wiederherstellung als Eintrag 1 (Einspielen einer Sicherung in eine
// leere Kette): Folgt ihr bis zum ersten Eintrag schluessel mit status verfuegbar nichts als Vermerke zur Uhr, beginnt
// der Abschnitt dieses Schlüssels bei Eintrag 1.“ Der Fall mit Vermerken zur Uhr steht in tests/nachzug-0-1-8.test.ts.

function wiederherstellung(zeit: string): Record<string, unknown> {
  return { seq: 0, zeitpunkt: zeit, aktion: "ANGELEGT", objektArt: "wiederherstellung", objektId: "", daten: JSON.stringify({ exportiertAm: zeit, verschluesselt: true, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "NICHT_ABGLEICHBAR", signaturen: "KEINE" }), neustarts: -1, autoZeit: true };
}

async function neu(e: Erzeugt): Promise<void> {
  e.daten.protokoll.forEach((x, j) => (x["seq"] = j + 1));
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
}

const bestaetigt = (b: Awaited<ReturnType<typeof befund>>): string | undefined => b.aussagen.find((a) => a.schritt === "P6" && a.zeichen === "bestaetigt")?.text;

test("4.7, U-29: wiederherstellung als Eintrag 1 unmittelbar vor dem ersten Schlüssel: Herkunft ab Eintrag 1", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  e.daten.protokoll[0] = wiederherstellung(String(e.daten.protokoll[0]!["zeitpunkt"]));
  await neu(e);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["wiederherstellung", "schluessel", "eintrag", "eintrag"]);
  const b = await befund([json("u29a.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 1–4.", texte(b, "P6"));
  assert.doesNotMatch(texte(b, "P6"), /^P6 (offen|widerlegt): Die Herkunft/m);
});

test("4.7, U-29: wiederherstellung als Eintrag 1 mit einem anderen Glied vor dem ersten Schlüssel: Glieder 1–2 „?“", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 2 });
  e.daten.protokoll[0] = wiederherstellung(String(e.daten.protokoll[0]!["zeitpunkt"]));
  await neu(e);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["wiederherstellung", "eintrag", "schluessel", "eintrag"]);
  const b = await befund([json("u29b.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 3–4.", texte(b, "P6"));
  assert.match(texte(b, "P6"), /^P6 offen: Die Herkunft der Glieder 1–2 lässt sich nicht bestätigen\.\n {4}Glied 1 bis 2: vor dem Beginn des ersten Abschnitts beim ersten Glied schluessel mit status verfuegbar \(Glied 3\)/m);
  assert.ok(!b.aussagen.some((a) => a.schritt === "P6" && a.zeichen === "widerlegt"), texte(b, "P6"));
});

// 6.3, Stand 69b7418: sieben Schritte, Beispiele aus der TE.

test("6.3: die Beispiele der TE zur Bereinigung", () => {
  assert.equal(bereinigeDateiname(". x.pdf"), "x.pdf");
  assert.equal(bereinigeDateiname("..\\x.pdf"), "__x.pdf");
  assert.equal(bereinigeDateiname("..."), "_");
  assert.equal(bereinigeDateiname(`${"a".repeat(146)}.pdf`), `${"a".repeat(116)}.pdf`);
  assert.equal(bereinigeDateiname("Bericht v1.2 final"), "Bericht v1.2 final");
  assert.equal(endungNach63("Bericht v1.2 final"), "");
  assert.equal(bereinigeDateiname(""), "dokument");
  assert.equal(bereinigeDateiname("   "), "dokument");
  assert.equal(bereinigeDateiname(". . ."), "dokument");
});

test("6.3, Schritt 4: die Endung", () => {
  assert.equal(endungNach63("Anschreiben.pdf"), ".pdf");
  assert.equal(endungNach63("a.b.c"), ".c");
  assert.equal(endungNach63("a.123456789"), ".123456789");
  assert.equal(endungNach63("a.1234567890"), "", "mit Punkt mehr als 10 Zeichen");
  assert.equal(endungNach63(".pdf"), "", "Punkt am Anfang");
  assert.equal(endungNach63("x."), "", "nichts nach dem Punkt");
  assert.equal(endungNach63("a.b c"), "", "Leerraum in der Endung");
  assert.equal(endungNach63("a.b c"), "", "geschütztes Leerzeichen in der Endung");
  assert.equal(endungNach63("Anschreiben"), "");
});

test("6.3, Schritte 3, 5 und 6: Leerraum und Punkte am Anfang und am Ende, Kürzung mit Endung", () => {
  assert.equal(bereinigeDateiname(".pdf"), "pdf");
  assert.equal(bereinigeDateiname(" . .a.pdf"), "a.pdf");
  assert.equal(bereinigeDateiname("x."), "x");
  assert.equal(bereinigeDateiname("x. . "), "x");
  assert.equal(bereinigeDateiname("a. .pdf"), "a.pdf");
  assert.equal(bereinigeDateiname("Anschreiben.pdf　"), "Anschreiben.pdf");
  assert.equal(bereinigeDateiname("a.b c"), "a.b c");
  assert.equal(bereinigeDateiname("a.langeendung"), "a.langeendung");
  // Die Kürzung trifft nur den Namen ohne Endung; die Endung bleibt.
  assert.equal(bereinigeDateiname(`${"a".repeat(130)}.tar.gz`), `${"a".repeat(117)}.gz`);
  assert.equal(bereinigeDateiname(`${"a".repeat(116)}.pdf`), `${"a".repeat(116)}.pdf`);
  assert.equal(bereinigeDateiname(`${"a".repeat(119)} b.pdf`), `${"a".repeat(116)}.pdf`);
  assert.equal(bereinigeDateiname(`${"a".repeat(115)} .pdf`), `${"a".repeat(115)}.pdf`);
  assert.equal(bereinigeDateiname(`${"a".repeat(115)} ${"b".repeat(20)}.pdf`), `${"a".repeat(115)}.pdf`);
  assert.equal(bereinigeDateiname("a".repeat(130)), "a".repeat(120));
  assert.equal(bereinigeDateiname(`${"a".repeat(119)}.${"b".repeat(20)}`), `${"a".repeat(119)}`);
  // Ein zerteiltes Surrogatpaar entfällt ganz.
  assert.equal(bereinigeDateiname(`a${"😀".repeat(60)}`), `a${"😀".repeat(59)}`);
  assert.equal(bereinigeDateiname(`${"😀".repeat(60)}.pdf`), `${"😀".repeat(58)}.pdf`);
  assert.equal(bereinigeDateiname(`${"😀".repeat(60)}.pdfx`), `${"😀".repeat(57)}.pdfx`);
  assert.equal(bereinigeDateiname("😀".repeat(61)), "😀".repeat(60));
});

test("6.3, E-67: bereinigt ist ein Name ohne Leerraum und Punkt am Anfang und Ende, auch mit Zusatz vor der Endung", () => {
  for (const name of ["x.pdf", "__x.pdf", "_", "Bericht v1.2 final", "Bericht v1.2 final (2)", "dokument", "a .b", "a.b c", "x (2).pdf", "Anschreiben (2).pdf", "Anschreiben.pdf (2)", `${"a".repeat(116)}.pdf`, `${"a".repeat(116)} (2).pdf`]) {
    assert.ok(istBereinigt(name), name);
  }
  // Ein Ergebnis der Schritte, das nicht sein eigenes Ergebnis ist: aus 110 × x, „ .bcdefghi“ und weiteren Zeichen
  // über 120 hinaus (Endung in Schritt 4 zu lang) entsteht nach Kürzung ein Name, dessen Endung Schritt 4 jetzt erkennt.
  const gekuerzt = `${"x".repeat(110)} .bcdefghi`;
  assert.equal(bereinigeDateiname(`${gekuerzt}${"j".repeat(50)}`), gekuerzt);
  assert.notEqual(bereinigeDateiname(gekuerzt), gekuerzt);
  assert.ok(istBereinigt(gekuerzt));
  // „x (2) .pdf“ fehlt hier: Es ist ein Ergebnis der Schritte (Endung mit Leerraum, also keine; Zusatz am Ende „ .pdf“ unbeachtet).
  for (const name of [" x.pdf", "x.pdf ", "x.", ".x", " x.pdf", "x.pdf　", " x (2).pdf", "x (2).", `${"a".repeat(117)}.pdf`, `${"a".repeat(117)} (2).pdf`, "a..b", "a|b", "", " "]) {
    assert.ok(!istBereinigt(name), JSON.stringify(name));
  }
});

const TE = utf8("%PDF-1.7 Technische Erläuterung");
const PRUEFEN = utf8("Prüfen mit WATTest\r\nhttps://aves83.github.io/wattest/\r\n");

/** Aktenauszug nach 6.3 mit den angegebenen Dokumenten (Pfad im Archiv), dazu die Dateien der Wurzel. */
async function aktenauszug(dokumente: string[]): Promise<Uint8Array> {
  const dateien = [...dokumente.map((pfad, i) => ({ pfad, inhalt: utf8(`%PDF-1.7 Dokument ${i + 1}`) })), { pfad: "Technische-Erlaeuterung.pdf", inhalt: TE }, { pfad: "PRUEFEN.txt", inhalt: PRUEFEN }];
  let text = "";
  for (const d of dateien) text += `${await sha256Hex(d.inhalt)}  ${d.pfad}\n`;
  return zip([...dateien, { pfad: "SHA256SUMS.txt", inhalt: text }]);
}

async function aufbau(dokumente: string[]): Promise<{ zeichen: string; details: string; b: Awaited<ReturnType<typeof befund>> }> {
  const b = await befund([{ name: "Aktenauszug.zip", bytes: await aktenauszug(dokumente) }]);
  const a = b.aussagen.find((x) => x.schritt === "P8" && /Aufbau des ZIP-Archivs/.test(x.text));
  assert.ok(a, texte(b));
  return { zeichen: a.zeichen, details: (a.details ?? []).map((d) => d.text).join("\n"), b };
}

const zulaessig: [string, string[]][] = [
  ["Beispiele der TE", ["Eintrag_01/x.pdf", "Eintrag_01/__x.pdf", "Eintrag_01/_", `Eintrag_01/${"a".repeat(116)}.pdf`, "Eintrag_01/dokument"]],
  ["Name ohne Endung mit Zusatz am Ende", ["Eintrag_02/Bericht v1.2 final", "Eintrag_02/Bericht v1.2 final (2)"]],
  ["Zusatz vor derselben Endung", ["Eintrag_03/Anschreiben.pdf", "Eintrag_03/Anschreiben (2).pdf", "Eintrag_03/Anschreiben (3).pdf"]],
];

for (const [name, dokumente] of zulaessig) {
  test(`6.3: ${name}: Aufbau bestätigt`, async () => {
    const r = await aufbau(dokumente);
    assert.equal(r.zeichen, "bestaetigt", r.details);
    assert.ok(r.b.aussagen.some((x) => x.text === "Die Dokumente im Aktenauszug sind unverändert." && x.zeichen === "bestaetigt"), texte(r.b, "P8"));
  });
}

const abweichend: [string, string, string][] = [
  ["Leerraum am Anfang", "Eintrag_01/ x.pdf", "x.pdf"],
  ["Leerraum am Ende", "Eintrag_01/x.pdf ", "x.pdf"],
  ["Punkt am Ende", "Eintrag_01/x.", "x"],
  ["Punkt am Anfang", "Eintrag_01/.x.pdf", "x.pdf"],
  ["Name ohne Zusatz länger als 120 Zeichen", `Eintrag_01/${"a".repeat(117)}.pdf`, `${"a".repeat(116)}.pdf`],
];

for (const [name, pfad, bereinigt] of abweichend) {
  test(`6.3: ${name}: Aufbau „?“, Dokumente bleiben ✓`, async () => {
    const r = await aufbau([pfad]);
    assert.equal(r.zeichen, "offen", r.details);
    assert.ok(r.details.includes(`${pfad}: Der Dateiname ist nicht nach 6.3 bereinigt (bereinigt: „${bereinigt}“).`), r.details);
    assert.ok(r.b.aussagen.some((x) => x.text === "Die Dokumente im Aktenauszug sind unverändert." && x.zeichen === "bestaetigt"), texte(r.b, "P8"));
    assert.ok(!r.b.aussagen.some((x) => x.zeichen === "widerlegt"), texte(r.b));
  });
}
