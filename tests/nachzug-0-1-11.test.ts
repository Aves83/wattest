// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Nachzug auf die Technische Erläuterung aus watt_public b9ca278 (Stand 27.10.2026, Vorabfassung): 6.3, Schritt 7
// ohne Endung. „Ist der Name ohne Endung danach leer, heißt er dokument (eine Endung gibt es dann nicht, weil sie nach
// Schritt 4 mindestens ein Zeichen vor dem Punkt voraussetzt und die Schritte 5 und 6 den Namen davor nicht leeren).“

import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256Hex } from "../src/kern/sha.js";
import { bereinigeDateiname, endungNach63, istBereinigt } from "../src/kern/schritte-nachweis.js";
import { utf8 } from "../src/kern/bytes.js";
import { befund, liesText, texte } from "./hilfen.js";
import { zip } from "./zip-schreiber.js";

test("Unterlagen: Rechenbeispiele aus watt_public b9ca278, Stand 27.10.2026", () => {
  assert.match(liesText("tests/vektoren/technische-erlaeuterung.json"), /Commit b9ca278\), Codeblöcke der Rechenbeispiele, Stand 27\.10\.2026/);
});

test("6.3, Schritt 7: ein leerer Name heißt dokument, ohne Endung", () => {
  for (const name of ["", " ", "   ", ".", ". . .", " . ", "　.", " ", "\u0085. "]) {
    assert.equal(bereinigeDateiname(name), "dokument", JSON.stringify(name));
  }
});

test("6.3, Schritt 7: „dokument.pdf“ ist ein bereinigter Name und sein eigenes Ergebnis", () => {
  assert.equal(bereinigeDateiname("dokument.pdf"), "dokument.pdf");
  assert.equal(endungNach63("dokument.pdf"), ".pdf");
  assert.ok(istBereinigt("dokument.pdf"));
  assert.ok(istBereinigt("dokument (2).pdf"));
  // Ein Name, der nur aus Punkten und Leerraum vor der Endung besteht, verliert sie in Schritt 3 mit (Punkt am Anfang).
  assert.equal(bereinigeDateiname(". .pdf"), "pdf");
});

// Alle Namen bis zu sechs Zeichen aus Punkt, Leerzeichen, ideografischem Leerzeichen, a und einem Zeichen außerhalb
// der Basisebene: dokument genau dann, wenn nach Schritt 2 nur Punkte und Leerraum bleiben; jedes Ergebnis ist bereinigt.
test("6.3, Schritt 7: dokument nur für Namen aus Punkten und Leerraum; jedes Ergebnis ist bereinigt", () => {
  const zeichen = [".", " ", "　", "a", "😀"];
  let namen = [""];
  for (let n = 1; n <= 6; n++) {
    namen = namen.flatMap((s) => zeichen.map((z) => s + z));
    for (const name of namen) {
      const ergebnis = bereinigeDateiname(name);
      const leer = /^[.\p{White_Space}]*$/u.test(name) && !name.includes("..");
      assert.equal(ergebnis === "dokument", leer, JSON.stringify(name));
      assert.ok(istBereinigt(ergebnis), `${JSON.stringify(name)} → ${JSON.stringify(ergebnis)}`);
    }
  }
});

test("6.3, Schritt 7: lange Namen mit Endung werden nie zu dokument", () => {
  for (const vorn of ["a", " a", ". a", "😀"]) {
    for (const endung of [".pdf", ".123456789", ".x"]) {
      for (const laenge of [1, 109, 110, 111, 116, 117, 200]) {
        const name = `${vorn}${" .".repeat(laenge)}${endung}`;
        const ergebnis = bereinigeDateiname(name);
        assert.notEqual(ergebnis, "dokument", JSON.stringify(name));
        assert.ok(istBereinigt(ergebnis), `${JSON.stringify(name)} → ${JSON.stringify(ergebnis)}`);
      }
    }
  }
});

const TE = utf8("%PDF-1.7 Technische Erläuterung");
const PRUEFEN = utf8("Prüfen mit WATTest\r\nhttps://aves83.github.io/wattest/\r\n");

async function aktenauszug(dokumente: string[]): Promise<Uint8Array> {
  const dateien = [...dokumente.map((pfad, i) => ({ pfad, inhalt: utf8(`%PDF-1.7 Dokument ${i + 1}`) })), { pfad: "Technische-Erlaeuterung.pdf", inhalt: TE }, { pfad: "PRUEFEN.txt", inhalt: PRUEFEN }];
  let text = "";
  for (const d of dateien) text += `${await sha256Hex(d.inhalt)}  ${d.pfad}\n`;
  return zip([...dateien, { pfad: "SHA256SUMS.txt", inhalt: text }]);
}

test("6.3: Ordner mit dokument, dokument (2), dokument.pdf und dokument (2).pdf: Aufbau bestätigt", async () => {
  const b = await befund([{ name: "Aktenauszug.zip", bytes: await aktenauszug(["Eintrag_01/dokument", "Eintrag_01/dokument (2)", "Eintrag_01/dokument.pdf", "Eintrag_01/dokument (2).pdf"]) }]);
  const a = b.aussagen.find((x) => x.schritt === "P8" && /Aufbau des ZIP-Archivs/.test(x.text));
  assert.equal(a?.zeichen, "bestaetigt", texte(b, "P8"));
  assert.ok(!b.aussagen.some((x) => x.zeichen === "widerlegt"), texte(b));
});
