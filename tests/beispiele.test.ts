// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Beispieldateien echter WATT-Versionen: P1 bis P5, P8, P9 bestätigt, P6 und P7 nicht bestätigbar.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import { befund, beispiel, liesText, qrAus, texte, zeichen } from "./hilfen.js";

for (const name of ["apfel-16.json", "bergamotte-17.json", "cherimoya-18.json"]) {
  test(`${name}: P1 bis P5, P8, P9 bestätigt, P6 und P7 offen`, async () => {
    const daten = JSON.parse(liesText(`tests/beispiele/${name}`));
    const a = leseQr(qrAus(daten));
    assert.ok(a.ok);
    const b = await befund([beispiel(name)], { anker: [a.anker] });
    for (const s of ["P1", "P2", "P3", "P4", "P5", "P8", "P9"] as const) {
      assert.equal(zeichen(b, s), "bestaetigt", `${s} in ${name}:\n${texte(b)}`);
    }
    for (const s of ["P6", "P7"] as const) {
      assert.equal(zeichen(b, s), "offen", `${s} in ${name}`);
      assert.ok(b.aussagen.some((x) => x.schritt === s && x.text === "Diese Version von WATT signiert noch nicht."));
    }
    assert.equal(b.gesamt, "offen");
  });
}

test("ohne Anker ist P5 nicht bestätigbar", async () => {
  const b = await befund([beispiel("cherimoya-18.json")]);
  assert.equal(zeichen(b, "P5"), "offen");
});
