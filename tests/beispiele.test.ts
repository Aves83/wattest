// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Beispieldateien echter WATT-Versionen: 16 bis 18 mit P1 bis P5, P8, P9 bestätigt, P6 einmal nicht bestätigbar,
// P7 entfällt; 19 (drachenfrucht, erdbeere) signiert, mit Attestierung aus der Testumgebung.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import type { Befund } from "../src/kern/befund.js";
import type { Optionen, Sperrliste } from "../src/kern/kontext.js";
import { pemZuDer } from "../src/kern/x509.js";
import { befund, beispiel, liesText, qrAus, texte, zeichen } from "./hilfen.js";

const VERSIONEN: Record<string, number> = { "apfel-16.json": 16, "bergamotte-17.json": 17, "cherimoya-18.json": 18 };

for (const [name, v] of Object.entries(VERSIONEN)) {
  test(`${name}: P1 bis P5, P8, P9 bestätigt, P6 einmal offen, P7 entfällt als Hinweis`, async () => {
    const daten = JSON.parse(liesText(`tests/beispiele/${name}`));
    const a = leseQr(qrAus(daten));
    assert.ok(a.ok);
    const b = await befund([beispiel(name)], { anker: [a.anker] });
    for (const s of ["P1", "P2", "P3", "P4", "P5", "P8", "P9"] as const) {
      assert.equal(zeichen(b, s), "bestaetigt", `${s} in ${name}:\n${texte(b)}`);
    }
    const p6 = b.aussagen.filter((x) => x.schritt === "P6");
    assert.equal(p6.length, 1);
    assert.equal(p6[0]!.zeichen, "offen");
    assert.equal(p6[0]!.text, `Diese Fassung von WATT (Datenformat ${v}) signiert noch nicht; die Herkunft lässt sich deshalb nicht bestätigen.`);
    const p7 = b.aussagen.filter((x) => x.schritt === "P7");
    assert.deepEqual(p7.map((x) => [x.zeichen, x.text]), [["hinweis", "Entfällt (keine Signatur)."]]);
    assert.equal(b.gesamt, "offen");
    // Mit Anker: kein Satz zum Prüfvermerk, aber der Satz zum Datenformat.
    assert.equal(
      b.gesamtText,
      `Nicht alles lässt sich bestätigen; nichts ist widerlegt. Die Datei ist in sich stimmig. WATT signiert erst ab Datenformat 19; dass diese Datei (Datenformat ${v}) keine Signatur hat, ist kein negativer Befund.`,
    );
  });
}

test("ohne Anker: P5 nicht bestätigbar mit Handlungshinweis, Gesamtzeile nennt Format und Prüfvermerk", async () => {
  const b = await befund([beispiel("cherimoya-18.json")]);
  assert.equal(zeichen(b, "P5"), "offen");
  const p5 = b.aussagen.find((x) => x.schritt === "P5")!;
  assert.equal(p5.text, "Es liegt kein Anker vor. Ein Prüfvermerk aus einem Bericht oder einer Anzeige (Text oder QR-Code) lässt sich hinzufügen, um den Stand daran zu prüfen.");
  // Wortlaut aus dem Feldtest (Auftrag 0.1.5, B1).
  assert.equal(
    b.gesamtText,
    "Nicht alles lässt sich bestätigen; nichts ist widerlegt. Die Datei ist in sich stimmig. WATT signiert erst ab Datenformat 19; dass diese Datei (Datenformat 18) keine Signatur hat, ist kein negativer Befund. Den Zeitpunkt bestätigt ein Prüfvermerk aus einem Bericht oder einer Anzeige, sofern er beigefügt wird.",
  );
});

test("Beispieldateien ohne Sprünge: genau eine Aussage zu den Zeitstempeln", async () => {
  for (const name of Object.keys(VERSIONEN)) {
    const b = await befund([beispiel(name)]);
    const p4 = b.aussagen.filter((x) => x.schritt === "P4" && x.zeichen !== "hinweis");
    assert.deepEqual(
      p4.map((x) => x.text),
      ["Die Zeitstempel steigen an; die Kette enthält keinen Rücksprung und keine Verstellung der Geräteuhr."],
      `${name}:\n${texte(b, "P4")}`,
    );
  }
});

// drachenfrucht-19 (WATT 0.8.111) und erdbeere-19 (WATT 0.8.118), beide Datenformat 19 mit demselben Umfang: signierte
// Kette mit Attestierung aus der Testumgebung von WATT, dazu uhr_verstellt, eingelesene Buchung und Anhänge an einer
// Anzeige. Beide ergeben je Schritt dasselbe.

async function signiert(name: string, weiter: Partial<Optionen> = {}): Promise<Befund> {
  const a = leseQr(qrAus(JSON.parse(liesText(`tests/beispiele/${name}`))));
  assert.ok(a.ok);
  return befund([beispiel(name)], { anker: [a.anker], ...weiter });
}

function pruefeOhneP7(b: Befund): void {
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  // Version 19 ist seit watt_public 15db84d veröffentlicht, keine Vorabfassung mehr.
  assert.ok(!b.aussagen.some((x) => x.schritt === "P1" && x.zeichen === "hinweis"), texte(b, "P1"));
  const p4 = b.aussagen.filter((x) => x.schritt === "P4" && x.zeichen !== "hinweis");
  assert.deepEqual(
    p4.map((x) => [x.zeichen, x.text]),
    [
      ["bestaetigt", "Die Zeitstempel steigen an. Die Geräteuhr wurde einmal verstellt oder sprang zurück; jeder Fall ist vermerkt (Glied 5)."],
      ["bestaetigt", "Der Vermerk uhr_verstellt erklärt seinen Zeitsprung nach der Rechnung in 4.7."],
    ],
  );
  assert.deepEqual(b.aussagen.filter((x) => x.schritt === "P6" && x.zeichen !== "hinweis").map((x) => x.text), ["Signaturen belegen die Herkunft der Glieder 1–10."]);
  assert.ok(b.aussagen.some((x) => x.schritt === "P8" && x.zeichen === "hinweis" && x.text === "Die Datei nennt 2 Anhänge zu Anzeigen; Anhänge prüft WATTest nicht."), texte(b, "P8"));
}

const p7Details = (b: Befund): string[] => b.aussagen.filter((x) => x.schritt === "P7").flatMap((x) => (x.details ?? []).map((d) => d.text));

for (const DATEI of ["drachenfrucht-19.json", "erdbeere-19.json"]) {
test(`${DATEI} ohne Wurzeln und App-Signatur: P1 bis P6, P8, P9 bestätigt, P7 offen`, async () => {
  const b = await signiert(DATEI);
  pruefeOhneP7(b);
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  const d = p7Details(b);
  assert.ok(d.includes("? Die Wurzeln von Google sind nicht verfügbar; die Kette lässt sich nicht bis zu einer Wurzel prüfen."), d.join("\n"));
  assert.ok(d.includes("? Der Fingerabdruck des App-Signaturzertifikats von WATT liegt WATTest nicht vor; die Signatur der App lässt sich nicht vergleichen."), d.join("\n"));
  assert.ok(!d.some((x) => x.startsWith("✗")), d.join("\n"));
  assert.equal(b.gesamt, "offen");
});

test(`${DATEI} mit Wurzeln von Google, Sperrliste und App-Signatur aus daten/: ✗ allein in P7, Kette nicht bis zu einer Wurzel (Testumgebung, E-4)`, async () => {
  const wurzeln = JSON.parse(liesText("daten/wurzeln.json")) as { abgerufen: string; quelle: string; zertifikate: { pem: string }[] };
  const app = JSON.parse(liesText("daten/app-signatur.json")) as { paketname: string; sha256: string };
  const b = await signiert(DATEI, {
    wurzeln: wurzeln.zertifikate.flatMap((z) => pemZuDer(z.pem)),
    wurzelnStand: { abgerufen: wurzeln.abgerufen, quelle: wurzeln.quelle },
    sperrliste: JSON.parse(liesText("daten/sperrliste.json")) as Sperrliste,
    appSignatur: app.sha256,
    paketname: app.paketname,
  });
  pruefeOhneP7(b);
  assert.deepEqual(b.aussagen.filter((x) => x.zeichen === "widerlegt").map((x) => [x.schritt, x.text]), [["P7", "Die Kette stammt nicht von WATT auf einem bestätigten Gerät."]]);
  const d = p7Details(b);
  assert.deepEqual(d.filter((x) => x.startsWith("✗")), ["✗ Die Zertifikatskette führt zu keiner der Wurzeln von Google."]);
  assert.deepEqual(d.filter((x) => x.startsWith("?")), []);
  for (const t of [
    "✓ Fingerabdruck und zertifikateSha256 im Glied passen zu den Zertifikaten.",
    "✓ Alle Zertifikate waren zum Zeitpunkt des Glieds (29.09.2026 10:00) gültig.",
    "✓ Paketname de.achim.watt.",
    "✓ Das Signaturzertifikat der App ist das von WATT.",
    "✓ Sicherheitsstufe TEE (geschützte Hardware).",
    "✓ Verifizierter Start (Verified), Bootloader gesperrt.",
    "✓ Die Challenge sind die Zufallsbytes im Glied (leere Kette).",
  ]) assert.ok(d.includes(t), `${t}\n${d.join("\n")}`);
  assert.ok(d.some((x) => /^✓ Kein Zertifikat steht in der Sperrliste \(Stand /.test(x)), d.join("\n"));
  assert.equal(b.gesamt, "widerlegt");
});
}
