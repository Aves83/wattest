// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Technische Erläuterung aus watt_public 3a88095 (Stand 26.10.2026, Vorabfassung): Beginn der
// Herkunft nach 4.7 (U-28 geschlossen, U-29) und gleiche Dateinamen im ZIP des Aktenauszugs (6.3, E-67). Seit 0.1.9
// (Stand 69b7418): U-29 geschlossen, Bereinigung in sieben Schritten (tests/nachzug-0-1-9.test.ts).

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

function wiederherstellung(zeit: string): Record<string, unknown> {
  return { seq: 0, zeitpunkt: zeit, aktion: "ANGELEGT", objektArt: "wiederherstellung", objektId: "", daten: JSON.stringify({ exportiertAm: zeit, verschluesselt: true, vorherAnzahl: 0, vorherLetzterHash: "0", vorgeschichte: "NICHT_ABGLEICHBAR", signaturen: "KEINE" }), neustarts: -1, autoZeit: true };
}

function vermerkUhr(zeit: string, objektId: string): Record<string, unknown> {
  const vorher = new Date(Date.parse(zeit) - 600000).toISOString().replace(".000Z", "Z");
  return { seq: 0, zeitpunkt: zeit, aktion: "ANGELEGT", objektArt: "uhr_verstellt", objektId, daten: JSON.stringify({ vorher, nachher: zeit, abweichungSekunden: 600, richtung: "vor" }), neustarts: 0, autoZeit: true };
}

/** Fügt vor Index i Glieder ein, nummeriert neu, verschiebt die Signaturen dahinter, verkettet und signiert neu. */
async function einfuegen(e: Erzeugt, i: number, glieder: Record<string, unknown>[]): Promise<void> {
  const p = e.daten.protokoll;
  p.splice(i, 0, ...glieder);
  p.forEach((x, j) => (x["seq"] = j + 1));
  for (const s of e.daten.kettensignaturen) if (Number(s["seq"]) > i) s["seq"] = Number(s["seq"]) + glieder.length;
  await neuVerketten(p);
  await signiereNeu(e);
}

const bestaetigt = (b: Awaited<ReturnType<typeof befund>>): string | undefined => b.aussagen.find((a) => a.schritt === "P6" && a.zeichen === "bestaetigt")?.text;

test("Rechenbeispiele B1 bis B15 sind seit watt_public 3a88095 unverändert (Quelle jetzt 69b7418)", () => {
  assert.match(liesText("tests/vektoren/technische-erlaeuterung.json"), /Commit 69b7418\), Codeblöcke der Rechenbeispiele, Stand 27\.10\.2026/);
});

// 4.7, Stand 3a88095: Der Abschnitt beginnt beim letzten Glied wiederherstellung bzw. neubeginn vor j, wenn es nach
// dem ersten Glied schluessel mit status verfuegbar liegt, auch wenn bis zum nächsten Schlüssel andere Glieder folgen.

test("4.7: Wiederherstellung nach dem ersten Schlüssel, danach andere Glieder vor dem neuen Schlüssel: Herkunft ab der Wiederherstellung", async () => {
  const e = await erzeugeKette({ eintraege: 6, zertifikate: z, weitereSchluessel: 1 });
  const zeit = String(e.daten.protokoll[1]!["zeitpunkt"]);
  await einfuegen(e, 2, [wiederherstellung(zeit)]);
  const p = e.daten.protokoll;
  assert.deepEqual(p.map((x) => x["objektArt"]), ["schluessel", "eintrag", "wiederherstellung", "eintrag", "eintrag", "schluessel", "eintrag", "eintrag", "eintrag"]);
  // Nach der Wiederherstellung signiert der alte Schlüssel nicht mehr (4.7, Schritt 7).
  e.daten.kettensignaturen = e.daten.kettensignaturen.filter((s) => Number(s["seq"]) < 3 || Number(s["seq"]) >= 6);
  const b = await befund([json("w.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 1–2, 3–9.", texte(b, "P6"));
  assert.doesNotMatch(texte(b, "P6"), /^P6 (offen|widerlegt): Die Herkunft/m);
});

// U-29: Bis 0.1.8 begann bei Eintrag 1 ein Abschnitt nur mit neubeginn bzw. dem ersten Schlüssel (Wertung „?“ für
// die Glieder 1–2). Seit dem Stand 69b7418 schließt 4.7 eine wiederherstellung als Eintrag 1 ein (U-29 geklärt): Der
// Abschnitt des ersten Schlüssels beginnt bei Eintrag 1, wie in 0.1.7.

test("4.7, U-29: wiederherstellung als Eintrag 1, nur Vermerke zur Uhr bis zum ersten Schlüssel: Herkunft ab Eintrag 1", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  const zeit = String(e.daten.protokoll[0]!["zeitpunkt"]);
  e.daten.protokoll[0] = wiederherstellung(zeit);
  await einfuegen(e, 1, [vermerkUhr(zeit, "1")]);
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["wiederherstellung", "uhr_verstellt", "schluessel", "eintrag", "eintrag"]);
  const b = await befund([json("u29.json", e.daten)], opt());
  assert.equal(bestaetigt(b), "Signaturen belegen die Herkunft der Glieder 1–5.", texte(b, "P6"));
  assert.doesNotMatch(texte(b, "P6"), /^P6 (offen|widerlegt): Die Herkunft/m);
  assert.ok(!b.aussagen.some((a) => a.schritt === "P6" && a.zeichen === "widerlegt"), texte(b, "P6"));
});

// 6.3, Stand 3a88095: gleiche Namen in einem Ordner erhalten vor der Endung „ (n)“, n ab 2.

test("6.3, E-67: Ergebnis der Bereinigung und Zusatz „ (n)“", () => {
  for (const name of ["Anschreiben.pdf", "Anschreiben (2).pdf", "Anschreiben (3).pdf", "Anschreiben (2) (2).pdf", "Anschreiben (12).pdf", "Anschreiben", "Anschreiben (2)", "dokument", "dokument (2)", "anschreiben.pdf"]) {
    assert.ok(istBereinigt(name), name);
  }
  // Länge: 120 Zeichen gelten für den Namen ohne Zusatz.
  assert.ok(istBereinigt(`${"a".repeat(116)}.pdf`));
  assert.ok(istBereinigt(`${"a".repeat(116)} (2).pdf`));
  assert.ok(istBereinigt(`${"a".repeat(120)} (2)`));
  assert.ok(!istBereinigt(`${"a".repeat(117)} (2).pdf`));
  assert.ok(!istBereinigt(`${"a".repeat(117)}.pdf`));
  assert.ok(!istBereinigt(`${"a".repeat(120)} (1)`));
  assert.ok(!istBereinigt(`${"a".repeat(120)} (02)`));
  assert.ok(!istBereinigt(`${"a".repeat(120)} (2) (2)`));
  assert.ok(!istBereinigt(`${"a".repeat(120)}(2)`));
  // Ohne den Zusatz muss der Rest selbst ein Ergebnis der Bereinigung sein.
  assert.ok(!istBereinigt(".Anschreiben (2).pdf"));
  assert.ok(!istBereinigt(" (2).pdf"), "seit 0.1.9: aus „. (2).pdf“ wird „(2).pdf“, der Rest „.pdf“ wäre leer");
  assert.ok(istBereinigt("(2).pdf"));
  assert.ok(!istBereinigt(`a..b${"c".repeat(120)} (2).pdf`));
  // Seit 0.1.9 (Stand 69b7418, Schritte 3 und 6): weder Leerraum noch Punkt am Anfang oder am Ende, auch nicht nach
  // der Kürzung auf 120 Zeichen; bis 0.1.8 waren Leerraum am Anfang und am Ende bei genau 120 Zeichen zulässig.
  assert.ok(!istBereinigt(" Anschreiben.pdf"));
  assert.ok(!istBereinigt(`${"a".repeat(119)} `));
  assert.ok(!istBereinigt(`${"a".repeat(119)}  (2)`));
  assert.ok(istBereinigt(`${"a".repeat(119)} (2)`));
  assert.ok(!istBereinigt("Anschreiben.pdf "));
  assert.ok(!istBereinigt(".Anschreiben.pdf"));
  assert.ok(!istBereinigt("a..pdf"));
  assert.ok(!istBereinigt("a:b.pdf"));
  assert.ok(!istBereinigt(""));
  assert.ok(!istBereinigt("   "));
  // Jedes Ergebnis der Bereinigung besteht die Prüfung, auch mit Zusatz vor der Endung nach Schritt 4.
  for (const roh of [". Anschreiben.pdf", "..  x", `${"a".repeat(119)} b.pdf`, `.${"a".repeat(119)} b`, "...pdf", "a....pdf", "\t.x", "😀".repeat(61), "  .Anschreiben.pdf　", "", "Anschreiben.pdf", "Bericht v1.2 final", "..\\x.pdf", "..."]) {
    const s = bereinigeDateiname(roh);
    assert.ok(istBereinigt(s), JSON.stringify(s));
    const endung = endungNach63(s);
    const mit = `${s.slice(0, s.length - endung.length)} (2)${endung}`;
    assert.ok(istBereinigt(mit), JSON.stringify(mit));
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
  ["zwei gleiche Namen mit „ (2)“", ["Eintrag_03/Anschreiben.pdf", "Eintrag_03/Anschreiben (2).pdf"]],
  ["drei gleiche Namen mit „ (2)“ und „ (3)“", ["Eintrag_03/Anschreiben.pdf", "Eintrag_03/Anschreiben (2).pdf", "Eintrag_03/Anschreiben (3).pdf"]],
  ["Name ohne Punkt", ["Eintrag_01/Anschreiben", "Eintrag_01/Anschreiben (2)"]],
  ["Name mit 120 Zeichen plus Zusatz", [`Eintrag_01/${"a".repeat(116)}.pdf`, `Eintrag_01/${"a".repeat(116)} (2).pdf`]],
  ["Groß- und Kleinschreibung ohne Zusatz", ["Eintrag_02/Anschreiben.pdf", "Eintrag_02/anschreiben.pdf"]],
];

for (const [name, dokumente] of zulaessig) {
  test(`6.3: ${name}: Aufbau bestätigt`, async () => {
    const r = await aufbau(dokumente);
    assert.equal(r.zeichen, "bestaetigt", r.details);
    assert.ok(r.b.aussagen.some((x) => x.text === "Die Dokumente im Aktenauszug sind unverändert." && x.zeichen === "bestaetigt"), texte(r.b, "P8"));
  });
}

test("6.3: Name mit Zusatz, dessen Rest länger als 120 Zeichen ist: Aufbau „?“", async () => {
  const r = await aufbau([`Eintrag_01/${"a".repeat(116)}.pdf`, `Eintrag_01/${"a".repeat(117)} (2).pdf`]);
  assert.equal(r.zeichen, "offen");
  assert.match(r.details, new RegExp(`Eintrag_01/a{117} \\(2\\)\\.pdf: Der Dateiname ist nicht nach 6\\.3 bereinigt`));
});

test("6.3: zwei exakt gleiche Pfade im ZIP bleiben „?“, nie ✗", async () => {
  const b = await befund([{ name: "Aktenauszug.zip", bytes: await aktenauszug(["Eintrag_03/Anschreiben.pdf", "Eintrag_03/Anschreiben.pdf"]) }]);
  const a = b.aussagen.find((x) => x.text === "„Aktenauszug.zip“ ist ein ZIP, das WATTest nicht liest.");
  assert.ok(a, texte(b));
  assert.equal(a.zeichen, "offen");
  assert.match(a.begruendung, /„Eintrag_03\/Anschreiben\.pdf“ steht mehrfach im ZIP\./);
  assert.equal(b.gesamt, "offen");
});
