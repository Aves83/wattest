// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Liest die Rechenbeispiele B1 bis B12 aus den Codeblöcken der Technischen Erläuterung (Markdown)
// und schreibt tests/vektoren/technische-erlaeuterung.json. Die Zerlegung in Felder (objekt) gehört
// WATTest und bleibt aus der bisherigen Datei erhalten.
// Aufruf: node scripts/vektoren-holen.mjs [<technische-erlaeuterung.md>] [<Stand>]

import { readFileSync, writeFileSync } from "node:fs";

const quelle = process.argv[2] ?? "referenz/technische-erlaeuterung.md";
const stand = process.argv[3] ?? "25.10.2026";
const ziel = "tests/vektoren/technische-erlaeuterung.json";

const FELD = {
  Eingabe: "eingabe",
  "SHA-256": "sha256",
  "Bestandsprüfsumme": "bestand",
  "Öffentlicher Schlüssel": "spkiBase64",
  Fingerabdruck: "fingerabdruck",
  Signatur: "signaturBase64",
};

const zeilen = readFileSync(quelle, "utf8").split("\n");
const gefunden = new Map();
let abschnitt = "";
for (let i = 0; i < zeilen.length; i++) {
  const z = zeilen[i];
  const h = /^#{2,3} (\d+(?:\.\d+)?)\.? /.exec(z);
  if (h) abschnitt = h[1];
  const m = /^- (.+?) \((B\d+)(?:, [^)]*)?\):$/.exec(z);
  if (!m || !(m[1] in FELD)) continue;
  let j = i + 1;
  while (j < zeilen.length && zeilen[j].trim() === "") j++;
  if (zeilen[j].trim() !== "```") throw new Error(`Zeile ${j + 1}: Codeblock zu ${m[1]} (${m[2]}) erwartet`);
  const inhalt = [];
  for (j++; zeilen[j].trim() !== "```"; j++) inhalt.push(zeilen[j].replace(/^ {2}/, ""));
  const id = m[2];
  const v = gefunden.get(id) ?? { id, fundstelle: `Technische Erläuterung, Abschnitt ${abschnitt}, Rechenbeispiel ${id}` };
  let wert = inhalt.join("\n");
  // B3: Die TE schreibt jeden Zeilenumbruch als \n (Abschnitt 4.6).
  if (FELD[m[1]] === "eingabe" && id === "B3") wert = wert.split("\\n").join("\n");
  v[FELD[m[1]]] = wert;
  gefunden.set(id, v);
}

const alt = JSON.parse(readFileSync(ziel, "utf8"));
const vektoren = [...gefunden.values()].map((v) => {
  const a = alt.vektoren.find((x) => x.id === v.id);
  return a?.objekt !== undefined ? { ...v, objekt: a.objekt } : v;
});
for (const a of alt.vektoren) if (!gefunden.has(a.id)) throw new Error(`${a.id} fehlt in ${quelle}`);

const aus = {
  quelle: `Technische Erläuterung für Gutachter:innen aus WATT (Branch feat/attestierte-kette, docs/app-texte/technische-erlaeuterung.md), Codeblöcke der Rechenbeispiele, Stand ${stand}`,
  vektoren,
  hinweis: alt.hinweis,
};
writeFileSync(ziel, JSON.stringify(aus, null, 2) + "\n");
console.log(`${vektoren.length} Rechenbeispiele nach ${ziel}`);
