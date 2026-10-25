// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P6 Signaturen und P7 Attestierung mit erzeugten Ketten im Datenformat 19.

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import { ausBase64, ausHex, base64 } from "../src/kern/bytes.js";
import { leseZertifikat } from "../src/kern/x509.js";
import { APP_DIGEST_HEX, erzeugeKette, neuVerketten, signiereNeu, testzertifikate, type Testzertifikate } from "./erzeuger.js";
import { befund, json, liesText, qrAus, texte, zeichen } from "./hilfen.js";

let z: Testzertifikate;
let fremd: Testzertifikate;

before(async () => {
  z = await testzertifikate("ec384");
  fremd = await testzertifikate("ec384");
});

const opt = (weiter: Record<string, unknown> = {}) => ({ wurzeln: [z.wurzelDer], wurzelnStand: { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test" }, appSignatur: APP_DIGEST_HEX, ...weiter });

test("gültige Kette: P1 bis P9 bestätigt, Kette stammt von WATT auf einem bestätigten Gerät", async () => {
  const e = await erzeugeKette({ eintraege: 5, zertifikate: z });
  const a = leseQr(qrAus(e.daten as never, undefined, ";s=1"));
  assert.ok(a.ok);
  const b = await befund([json("watt-19.json", e.daten)], opt({ anker: [a.anker] }));
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.ok(b.aussagen.some((x) => x.text === "Die Kette stammt von WATT auf einem bestätigten Gerät."));
  assert.ok(b.aussagen.some((x) => x.text === "Die Zeitstempel steigen an; die Kette enthält keinen Rücksprung und keine Verstellung der Geräteuhr."));
  assert.equal(b.gesamtText, "Alle Aussagen sind bestätigt.");
  assert.equal(b.gesamt, "bestaetigt");
});

test("RSA-Wurzel wie die alte Wurzel von Google wird angenommen", async () => {
  const rsa = await testzertifikate("rsa");
  const e = await erzeugeKette({ eintraege: 2, zertifikate: rsa });
  const b = await befund([json("rsa.json", e.daten)], opt({ wurzeln: [rsa.wurzelDer] }));
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
});

test("ohne Fingerabdruck der App ist P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const b = await befund([json("a.json", e.daten)], opt({ appSignatur: "" }));
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /liegt WATTest nicht vor/);
});

// Fingerabdruck des App-Signaturzertifikats aus daten/app-signatur.json (TE 4.7, Schritt 3).
const APP_WATT = JSON.parse(liesText("daten/app-signatur.json")) as { paketname: string; sha256: string };

test("daten/app-signatur.json nennt den Fingerabdruck aus TE 4.7", () => {
  assert.equal(APP_WATT.paketname, "de.achim.watt");
  assert.equal(APP_WATT.sha256, "4accbc1ff7bb15f57a2364e39906568e01c4e4b53e4e5d63e77148eb3bfa99d9");
});

test("App mit dem Signaturzertifikat von WATT: Teilaussage und P7 bestätigt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { appDigest: ausHex(APP_WATT.sha256)! } });
  const b = await befund([json("a.json", e.daten)], opt({ appSignatur: APP_WATT.sha256 }));
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  assert.match(texte(b, "P7"), /✓ Das Signaturzertifikat der App ist das von WATT\./);
});

test("App mit fremdem Signaturzertifikat gegen den Fingerabdruck von WATT: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const b = await befund([json("a.json", e.daten)], opt({ appSignatur: APP_WATT.sha256 }));
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /✗ Die App ist mit einem anderen Zertifikat signiert/);
});

// Challenge (TE 4.7): hash des Kopfs vor dem Glied schluessel; Ausnahme uhr_verstellt mit objektId glied.

test("Schlüssel nach vorhandenen Gliedern: Challenge ist der hash des Kopfs", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 2 });
  assert.equal(e.daten.protokoll[2]!["objektArt"], "schluessel");
  assert.equal(JSON.parse(String(e.daten.protokoll[2]!["daten"]))["challenge"], undefined);
  const b = await befund([json("a.json", e.daten)], opt());
  for (const s of ["P2", "P3", "P4", "P6", "P7"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.match(texte(b, "P7"), /✓ Die Challenge ist die Prüfsumme von Glied 2\./);
});

test("uhr_verstellt mit objektId glied zwischen Kopf und schluessel (Erzeuger): Challenge ist der hash davor", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, schluesselNach: 2, verstelltVorSchluessel: true });
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["eintrag", "eintrag", "uhr_verstellt", "schluessel", "eintrag", "eintrag"]);
  const b = await befund([json("a.json", e.daten)], opt());
  for (const s of ["P2", "P3", "P4", "P6", "P7"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.match(texte(b, "P7"), /✓ Die Challenge ist die Prüfsumme von Glied 2 \(vor dem Vermerk uhr_verstellt, Glied 3\)\./);
  assert.match(texte(b, "P4"), /Der Vermerk uhr_verstellt erklärt seinen Zeitsprung nach der Rechnung in 4\.7\./);
});

test("U-18: uhr_ruecksprung mit objektId nachweis als erstes Glied (Erzeuger): Schlüssel folgt mit dem hash des Kopfs als Challenge", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, ruecksprung: { anlass: "nachweis", vorEintrag: 0, neustarts: 0 } });
  assert.deepEqual(e.daten.protokoll.map((x) => x["objektArt"]), ["uhr_ruecksprung", "schluessel", "eintrag", "eintrag", "eintrag"]);
  assert.equal(JSON.parse(String(e.daten.protokoll[1]!["daten"]))["challenge"], undefined);
  const b = await befund([json("a.json", e.daten)], opt());
  for (const s of ["P2", "P3", "P4", "P6", "P7"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.match(texte(b, "P7"), /✓ Die Challenge ist die Prüfsumme von Glied 1\./);
  assert.match(texte(b, "P4"), /Das Glied uhr_ruecksprung mit Uhrstand entstand ohne Bezug, wie 4\.7 es beschreibt\./);
});

test("U-18: uhr_ruecksprung mit Bezug in einer signierten Kette (Erzeuger): P4 nicht bestätigbar, Gesamtzeile ohne ✗", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, ruecksprung: { anlass: "timer", vorEintrag: 2, neustarts: 0 } });
  const b = await befund([json("a.json", e.daten)], opt());
  for (const s of ["P2", "P6", "P7"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  assert.equal(zeichen(b, "P4"), "offen", texte(b, "P4"));
  assert.match(texte(b, "P4"), /Glied 4 \([^)]*\) mit objektId timer: der Vermerk selbst nennt neustarts 0, also einen Bezug\./);
  assert.equal(b.gesamt, "offen");
});

/** Fügt vor dem Glied schluessel ein Glied uhr_verstellt ein, verkettet neu und signiert neu. */
async function verstelltEinfuegen(e: Awaited<ReturnType<typeof erzeugeKette>>, objektId: string): Promise<void> {
  const p = e.daten.protokoll;
  const i = p.findIndex((x) => x["objektArt"] === "schluessel");
  const t = String(p[i]!["zeitpunkt"]);
  const vorher = new Date(Date.parse(t) - 20000).toISOString().replace(".000Z", "Z");
  p.splice(i, 0, { seq: 0, zeitpunkt: t, aktion: "ANGELEGT", objektArt: "uhr_verstellt", objektId, daten: JSON.stringify({ vorher, nachher: t, abweichungSekunden: 20, richtung: "vor" }), neustarts: 0, autoZeit: true });
  p.forEach((x, j) => (x["seq"] = j + 1));
  for (const s of e.daten.kettensignaturen) if (Number(s["seq"]) > i) s["seq"] = Number(s["seq"]) + 1;
  await neuVerketten(p);
  await signiereNeu(e);
}

test("uhr_verstellt mit objektId glied nachträglich eingefügt: Challenge weiter bestätigt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 2 });
  await verstelltEinfuegen(e, "glied");
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
});

test("uhr_verstellt mit anderer objektId zwischen Kopf und schluessel: Challenge widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 2 });
  await verstelltEinfuegen(e, "zeitsignal");
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "bestaetigt", texte(b, "P6"));
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /✗ Die Challenge im Zertifikat \(.*\) passt nicht zu der Prüfsumme von Glied 3\./);
});

test("Challenge im Glied, obwohl die Kette nicht leer war: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 1 });
  const g = e.daten.protokoll[1]!;
  g["daten"] = JSON.stringify({ ...JSON.parse(String(g["daten"])), challenge: "00".repeat(32) });
  await neuVerketten(e.daten.protokoll);
  await signiereNeu(e);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.match(texte(b, "P7"), /obwohl die Kette nicht leer war/);
});

test("geänderte Signatur: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const s = e.daten.kettensignaturen[1]!;
  const sig = ausBase64(String(s["signatur"]))!;
  sig[sig.length - 2]! ^= 0x01;
  s["signatur"] = base64(sig);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt", texte(b, "P6"));
});

test("Signatur eines anderen Schlüssels: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const andere = await erzeugeKette({ eintraege: 3, zertifikate: z });
  e.daten.kettensignaturen[2]!["signatur"] = andere.daten.kettensignaturen[2]!["signatur"];
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt");
});

test("unsignierte letzte Glieder: P6 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 4, zertifikate: z, ohneSignaturAmEnde: 2 });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "offen");
  assert.match(texte(b, "P6"), /Die Glieder 4 bis 5 sind nicht signiert/);
});

test("Zertifikat mit anderem Paketnamen: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { paket: "de.fremd.app" } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /de\.fremd\.app/);
});

test("anderes Signaturzertifikat der App: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { appDigest: new Uint8Array(32).fill(1) } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
});

test("Sicherheitsstufe Software: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { sicherheitsstufe: 0 } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /Software/);
});

test("verifiedBootState Unverified: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { bootzustand: 2 } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
  assert.match(texte(b, "P7"), /UNVERIFIED/);
});

test("Bootloader offen: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { gesperrt: false } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen");
});

test("gesperrte Seriennummer: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const sperrliste = { abgerufen: "2026-10-25T00:00:00Z", quelle: "Test", eintraege: { [z.zwischenSeriennummer.toString(16)]: { status: "REVOKED", reason: "KEY_COMPROMISE" } } };
  const b = await befund([json("a.json", e.daten)], opt({ sperrliste }));
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /gesperrt/);
});

test("ohne Sperrliste: P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  const b = await befund([json("a.json", e.daten)], opt({ sperrliste: null }));
  assert.equal(zeichen(b, "P7"), "offen");
});

test("fremde Wurzel: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: fremd });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /keiner der Wurzeln/);
});

test("falsche Challenge: P7 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { challenge: new Uint8Array(32).fill(3) } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "widerlegt");
  assert.match(texte(b, "P7"), /Challenge/);
});

test("Fingerabdruck in kettenschluessel passt nicht zum Blatt: P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z });
  e.daten.kettenschluessel[0]!["zertifikate"] = (e.daten.kettenschluessel[0]!["zertifikate"] as string[]).slice(1);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "widerlegt");
});

test("geänderter Eintrag mit neu berechneter Kette: P2 bestätigt, P6 widerlegt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  const g = e.daten.protokoll[2]!;
  g["daten"] = String(g["daten"]).replace("Korrektur 2", "Korrektur 9");
  (e.daten.eintraege[1] as Record<string, unknown>)["notiz"] = String((e.daten.eintraege[1] as Record<string, unknown>)["notiz"]).replace("Korrektur 2", "Korrektur 9");
  await neuVerketten(e.daten.protokoll);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P2"), "bestaetigt");
  assert.equal(zeichen(b, "P3"), "bestaetigt");
  assert.equal(zeichen(b, "P6"), "widerlegt", texte(b, "P6"));
});

test("neu signiert mit eigenem Schlüssel, aber Zertifikate unverändert: weiter stimmig, Kette stammt vom Blatt", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z });
  await signiereNeu(e);
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P6"), "bestaetigt");
});

test("Version 19 ohne Schlüssel: P6 und P7 nicht bestätigbar", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: null });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P2"), "bestaetigt", texte(b));
  assert.equal(zeichen(b, "P6"), "offen");
  assert.equal(zeichen(b, "P7"), "offen");
});

// U-16: Bezugszeitpunkt für die Gültigkeit der Zertifikate (4.7, Schritt 1).

test("U-16: Vorratsschlüssel der leeren Kette: creationDateTime ist der Bezug, auch Tage vor dem Glied", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { erzeugtAm: Date.parse("2026-10-20T07:30:00Z") } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  assert.match(texte(b, "P7"), /Alle Zertifikate waren zum Zeitpunkt der Erzeugung laut creationDateTime \(20\.10\.2026 09:30\) gültig\./);
});

test("U-16: creationDateTime vor dem Zwischenzertifikat: nicht bestätigbar, obwohl das Glied im Zeitraum liegt", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { erzeugtAm: Date.parse("2026-10-01T00:00:00Z") - 1000 } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "offen", texte(b, "P7"));
  assert.match(texte(b, "P7"), /Zum Zeitpunkt der Erzeugung laut creationDateTime \(.*\) war Zertifikat 2 nicht gültig/);
});

test("U-16: leere Kette ohne creationDateTime: Bezug ist der Zeitpunkt des Glieds", async () => {
  const e = await erzeugeKette({ eintraege: 2, zertifikate: z, bestaetigung: { erzeugtAm: null } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  assert.match(texte(b, "P7"), /Alle Zertifikate waren zum Zeitpunkt des Glieds \(24\.10\.2026 10:00\) gültig\./);
});

test("U-16: Schlüssel nach vorhandenen Gliedern: nur der Zeitpunkt des Glieds zählt, creationDateTime nicht", async () => {
  const e = await erzeugeKette({ eintraege: 3, zertifikate: z, schluesselNach: 2, bestaetigung: { erzeugtAm: Date.parse("2026-09-01T00:00:00Z") } });
  const b = await befund([json("a.json", e.daten)], opt());
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  assert.match(texte(b, "P7"), /Alle Zertifikate waren zum Zeitpunkt des Glieds \(.*\) gültig\./);
});

test("U-16: Grenzen der Gültigkeit zählen mit", async () => {
  const beginn = Date.parse("2026-10-01T00:00:00Z");
  const genau = await erzeugeKette({ eintraege: 1, zertifikate: z, beginn, bestaetigung: { erzeugtAm: null } });
  const b = await befund([json("a.json", genau.daten)], opt());
  assert.equal(zeichen(b, "P7"), "bestaetigt", texte(b, "P7"));
  const davor = await erzeugeKette({ eintraege: 1, zertifikate: z, beginn: beginn - 1000, bestaetigung: { erzeugtAm: null } });
  const b2 = await befund([json("a.json", davor.daten)], opt());
  assert.equal(zeichen(b2, "P7"), "offen", texte(b2, "P7"));
  const ende = await erzeugeKette({ eintraege: 1, zertifikate: z, beginn: Date.parse("2026-12-31T00:00:00Z"), bestaetigung: { erzeugtAm: null } });
  const b3 = await befund([json("a.json", ende.daten)], opt({ jetzt: Date.parse("2027-01-02T00:00:00Z") }));
  assert.equal(zeichen(b3, "P7"), "bestaetigt", texte(b3, "P7"));
  const danach = await erzeugeKette({ eintraege: 1, zertifikate: z, beginn: Date.parse("2026-12-31T00:00:01Z"), bestaetigung: { erzeugtAm: null } });
  const b4 = await befund([json("a.json", danach.daten)], opt({ jetzt: Date.parse("2027-01-02T00:00:00Z") }));
  assert.equal(zeichen(b4, "P7"), "offen", texte(b4, "P7"));
});

test("U-16: Blattzertifikat mit den Standardgrenzen von Android (01.01.1970 bis 01.01.2048)", async () => {
  const e = await erzeugeKette({ eintraege: 1, zertifikate: z });
  const blatt = leseZertifikat(ausBase64(String((e.daten.kettenschluessel[0]!["zertifikate"] as string[])[0]))!);
  assert.equal(blatt.nichtVor, Date.parse("1970-01-01T00:00:00Z"));
  assert.equal(blatt.nichtNach, Date.parse("2048-01-01T00:00:00Z"));
});
