// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Beispieldateien echter WATT-Versionen: P1 bis P5, P8, P9 bestätigt, P6 einmal nicht bestätigbar, P7 entfällt.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
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
