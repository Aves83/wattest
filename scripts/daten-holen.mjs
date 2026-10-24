// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Holt die Sperrliste und die Wurzelzertifikate der Android Key Attestation von Google nach daten/.
// Scheitert ein Abruf, bleibt der eingecheckte Stand unverändert; der Befund nennt dessen Datum.
// Aufruf: node scripts/daten-holen.mjs

import { X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const SPERRLISTE = "https://android.googleapis.com/attestation/status";
const WURZELN = "https://android.googleapis.com/attestation/root";
const WURZELN_SEITE = "https://developer.android.com/privacy-and-security/security-key-attestation";

async function hole(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function sortiert(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

function schreibe(pfad, daten) {
  writeFileSync(pfad, JSON.stringify(daten, null, 2) + "\n");
}

const jetzt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
let fehler = 0;

try {
  const s = await hole(SPERRLISTE);
  if (!s || typeof s.entries !== "object") throw new Error("Sperrliste ohne entries");
  const eintraege = {};
  for (const [k, v] of Object.entries(s.entries)) {
    const e = { status: String(v.status) };
    if (v.reason) e.reason = String(v.reason);
    if (v.expires) e.expires = String(v.expires);
    eintraege[k.toLowerCase().replace(/^0+(?=.)/, "")] = e;
  }
  schreibe("daten/sperrliste.json", { quelle: SPERRLISTE, abgerufen: jetzt, eintraege: sortiert(eintraege) });
  console.log(`Sperrliste: ${Object.keys(eintraege).length} Einträge, Stand ${jetzt}`);
} catch (e) {
  fehler++;
  console.warn(`Sperrliste nicht abrufbar (${e.message}); es bleibt der eingecheckte Stand.`);
}

try {
  const liste = await hole(WURZELN);
  if (!Array.isArray(liste) || !liste.length) throw new Error("keine Wurzeln");
  const zertifikate = liste.map((pem) => {
    const x = new X509Certificate(pem);
    const name = x.subject.split("\n").join(", ");
    return { name, gueltigBis: new Date(x.validTo).toISOString().slice(0, 10), sha256: x.fingerprint256.replace(/:/g, "").toLowerCase(), pem: pem.trim() + "\n" };
  });
  let alt = null;
  try {
    alt = JSON.parse(readFileSync("daten/wurzeln.json", "utf8"));
  } catch {
    alt = null;
  }
  const gleich = alt && JSON.stringify(alt.zertifikate) === JSON.stringify(zertifikate);
  schreibe("daten/wurzeln.json", { quelle: `${WURZELN} (verlinkt von ${WURZELN_SEITE})`, abgerufen: jetzt, zertifikate });
  console.log(`Wurzeln: ${zertifikate.length}${gleich ? " (unverändert)" : " (neu oder geändert)"}`);
} catch (e) {
  fehler++;
  console.warn(`Wurzeln nicht abrufbar (${e.message}); es bleibt der eingecheckte Stand.`);
}

process.exitCode = 0;
if (fehler) console.warn(`${fehler} Abruf(e) gescheitert.`);
