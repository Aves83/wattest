// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Laufzeit: 10.000 Glieder unter 10 Sekunden; 100.000 Glieder mit 50 Schlüsseln und 100.000 Signaturen in
// vertretbarer Zeit (Auftrag 0.1.5, C).

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

test("100.000 Glieder mit 50 Schlüsseln und 100.000 Signaturen in unter 120 Sekunden", { timeout: 900000 }, async () => {
  const z = await testzertifikate("ec384");
  // Ein Glied je Minute: Beginn am 01.10.2026, damit alle Schlüssel in der Gültigkeit des Test-Zwischenzertifikats liegen.
  const e = await erzeugeKette({ eintraege: 99950, zertifikate: z, weitereSchluessel: 49, beginn: Date.parse("2026-10-01T08:00:00Z") });
  assert.equal(e.daten.protokoll.length, 100000);
  assert.equal(e.daten.kettenschluessel.length, 50);
  assert.equal(e.daten.kettensignaturen.length, 100000);
  const datei = json("sehr-gross.json", e.daten);
  const start = performance.now();
  let meldungen = 0;
  const b = await befund([datei], { wurzeln: [z.wurzelDer], appSignatur: APP_DIGEST_HEX, fortschritt: () => void meldungen++ });
  const dauer = (performance.now() - start) / 1000;
  console.log(`LAUFZEIT 100.000 Glieder, 50 Schlüssel, 100.000 Signaturen (${(datei.bytes.length / 1024 / 1024).toFixed(1)} MB): ${dauer.toFixed(2)} s`);
  for (const s of ["P1", "P2", "P3", "P4", "P6", "P7", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}: ${texte(b, s)}`);
  assert.equal(b.aussagen.filter((x) => x.schritt === "P7" && x.zeichen === "bestaetigt").length, 50);
  // Teilschritte melden Fortschritt (Live-Region der Seite).
  assert.ok(meldungen > 100, `nur ${meldungen} Fortschrittsmeldungen`);
  // Einzelheiten sind begrenzt, damit der Befund klein bleibt.
  for (const a of b.aussagen) assert.ok((a.details?.length ?? 0) <= 201, `${a.schritt}: ${a.details?.length} Einzelheiten`);
  assert.ok(dauer < 120, `Laufzeit ${dauer.toFixed(2)} s`);
});
