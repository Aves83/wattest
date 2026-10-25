// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Liest die Rechenbeispiele B1 bis B12 aus den Codeblöcken der Technischen Erläuterung (Markdown)
// und schreibt tests/vektoren/technische-erlaeuterung.json. Die Zerlegung in Felder (objekt) gehört
// WATTest und bleibt aus der bisherigen Datei erhalten.
// Ohne Pfad holt das Skript die öffentliche Fassung aus Aves83/watt_public (doc/technische-erlaeuterung.md);
// mit Pfad liest es eine lokale Kopie, etwa zum Abgleich einer neuen Fassung.
// Aufruf: node scripts/vektoren-holen.mjs [<technische-erlaeuterung.md>]

import { readFileSync, writeFileSync } from "node:fs";

const REPO = "Aves83/watt_public";
const PFAD = "doc/technische-erlaeuterung.md";
const ziel = "tests/vektoren/technische-erlaeuterung.json";

async function hole(url, art) {
  const r = await fetch(url, { headers: { "User-Agent": "wattest-vektoren-holen" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return art === "json" ? r.json() : r.text();
}

let quelle;
let herkunft;
let text;
if (process.argv[2]) {
  quelle = process.argv[2];
  herkunft = `lokale Kopie ${quelle}`;
  text = readFileSync(quelle, "utf8");
} else {
  const commit = (await hole(`https://api.github.com/repos/${REPO}/commits/main`, "json")).sha;
  quelle = `${REPO}/${PFAD}`;
  herkunft = `${REPO}, ${PFAD}, Commit ${commit.slice(0, 7)}`;
  text = await hole(`https://raw.githubusercontent.com/${REPO}/${commit}/${PFAD}`, "text");
}
// Kopfzeile der TE: „WATT-Version: … · Stand: TT.MM.JJJJ“.
const stand = /^WATT-Version: .* · Stand: (\d{2}\.\d{2}\.\d{4})$/m.exec(text)?.[1];
if (!stand) throw new Error(`${quelle}: Kopfzeile mit Stand fehlt`);

const FELD = {
  Eingabe: "eingabe",
  "SHA-256": "sha256",
  "Bestandsprüfsumme": "bestand",
  "Öffentlicher Schlüssel": "spkiBase64",
  Fingerabdruck: "fingerabdruck",
  Signatur: "signaturBase64",
};

const zeilen = text.replace(/\r\n/g, "\n").split("\n");
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
  quelle: `Technische Erläuterung für Gutachter:innen von WATT (${herkunft}), Codeblöcke der Rechenbeispiele, Stand ${stand}`,
  vektoren,
  hinweis: alt.hinweis,
};
writeFileSync(ziel, JSON.stringify(aus, null, 2) + "\n");
console.log(`${vektoren.length} Rechenbeispiele nach ${ziel}`);
