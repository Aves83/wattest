// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Laufzeit: eine erzeugte Kette mit 10.000 Gliedern muss in Node unter 10 Sekunden geprüft sein.

import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_DIGEST_HEX, erzeugeKette, testzertifikate } from "./erzeuger.js";
import { befund, json, texte, zeichen } from "./hilfen.js";

test("10.000 Glieder mit Signaturen in unter 10 Sekunden", { timeout: 300000 }, async () => {
  const z = await testzertifikate("ec384");
  const e = await erzeugeKette({ eintraege: 9999, zertifikate: z });
  assert.equal(e.daten.protokoll.length, 10000);
  const datei = json("gross.json", e.daten);
  const start = performance.now();
  const b = await befund([datei], { wurzeln: [z.wurzelDer], appSignatur: APP_DIGEST_HEX });
  const dauer = (performance.now() - start) / 1000;
  console.log(`LAUFZEIT 10.000 Glieder: ${dauer.toFixed(2)} s`);
  for (const s of ["P2", "P3", "P6", "P7"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}: ${texte(b, s)}`);
  assert.ok(dauer < 10, `Laufzeit ${dauer.toFixed(2)} s`);
});
