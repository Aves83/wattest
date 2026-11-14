// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Beispieldateien echter WATT-Versionen: 16 bis 18 mit P1 bis P5, P8, P9 bestätigt, P6 einmal nicht bestätigbar,
// P7 entfällt; 19 (drachenfrucht, erdbeere) und 20 (felsenbirne) signiert, mit Attestierung aus der Testumgebung.

import assert from "node:assert/strict";
import { test } from "node:test";
import { leseQr } from "../src/kern/anker.js";
import type { Befund } from "../src/kern/befund.js";
import type { Optionen, Sperrliste } from "../src/kern/kontext.js";
import { hex, puffer } from "../src/kern/bytes.js";
import { pemZuDer } from "../src/kern/x509.js";
import { befund, beispiel, lies, liesText, qrAus, texte, zeichen } from "./hilfen.js";

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
// Anzeige. Beide ergeben je Schritt dasselbe. felsenbirne-20 (WATT 0.8.126, Datenformat 20) hat den Umfang von
// drachenfrucht-19, dazu einen gesendeten Antrag auf Zeitausgleich (art ZEITAUSGLEICH) als Glied 4 der Nachweiskette,
// und ergibt je Schritt ebenfalls dasselbe; die Zählung in P8 und der Wortlaut je Schritt stehen weiter unten.

async function signiert(name: string, weiter: Partial<Optionen> = {}): Promise<Befund> {
  const a = leseQr(qrAus(JSON.parse(liesText(`tests/beispiele/${name}`))));
  assert.ok(a.ok);
  return befund([beispiel(name)], { anker: [a.anker], ...weiter });
}

function pruefeOhneP7(b: Befund): void {
  for (const s of ["P1", "P2", "P3", "P4", "P5", "P6", "P8", "P9"] as const) assert.equal(zeichen(b, s), "bestaetigt", `${s}:\n${texte(b)}`);
  // Version 19 ist seit watt_public 15db84d veröffentlicht, Version 20 seit c0cbd96; keine ist Vorabfassung.
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

for (const DATEI of ["drachenfrucht-19.json", "erdbeere-19.json", "felsenbirne-20.json"]) {
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

// felsenbirne-20 (WATT 0.8.126 „Felsenbirne“, Datenformat 20): Ergebnis je Schritt im Wortlaut, ohne und mit Wurzeln.

async function mitWurzeln(name: string): Promise<Befund> {
  const wurzeln = JSON.parse(liesText("daten/wurzeln.json")) as { abgerufen: string; quelle: string; zertifikate: { pem: string }[] };
  const app = JSON.parse(liesText("daten/app-signatur.json")) as { paketname: string; sha256: string };
  return signiert(name, {
    wurzeln: wurzeln.zertifikate.flatMap((z) => pemZuDer(z.pem)),
    wurzelnStand: { abgerufen: wurzeln.abgerufen, quelle: wurzeln.quelle },
    sperrliste: JSON.parse(liesText("daten/sperrliste.json")) as Sperrliste,
    appSignatur: app.sha256,
    paketname: app.paketname,
  });
}

/** Aussagen ohne Hinweise als [Schritt, Zeichen, Text]. */
const jeSchritt = (b: Befund): [string, string, string][] => b.aussagen.filter((x) => x.zeichen !== "hinweis").map((x) => [x.schritt, x.zeichen, x.text]);

const FELSENBIRNE = (p7: [string, string, string]): [string, string, string][] => [
  ["P1", "bestaetigt", "Die Datei ist ein vollständiger Klartext-Export im Datenformat 20."],
  ["P2", "bestaetigt", "Die Kette ist lückenlos und unverändert."],
  ["P3", "bestaetigt", "Die Daten entsprechen der Kette."],
  ["P4", "bestaetigt", "Die Zeitstempel steigen an. Die Geräteuhr wurde einmal verstellt oder sprang zurück; jeder Fall ist vermerkt (Glied 5)."],
  ["P4", "bestaetigt", "Der Vermerk uhr_verstellt erklärt seinen Zeitsprung nach der Rechnung in 4.7."],
  ["P5", "bestaetigt", "Der Anker vom 02.10.2026 10:10 passt zur Kette."],
  ["P6", "bestaetigt", "Signaturen belegen die Herkunft der Glieder 1–10."],
  p7,
  ["P8", "bestaetigt", "Die Nachweiskette ist lückenlos und unverändert."],
  ["P8", "bestaetigt", "Die Nachweise entsprechen der Nachweiskette."],
  ["P9", "bestaetigt", "Die Kette enthält keinen Neubeginn und keine Wiederherstellung."],
];

test("felsenbirne-20.json ist unverändert übernommen: 54.831 Bytes, SHA-256 557a9439…", async () => {
  const bytes = lies("tests/beispiele/felsenbirne-20.json");
  assert.equal(bytes.length, 54831);
  assert.equal(hex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", puffer(bytes)))), "557a943938dec2698aff8e8f0e2688324f2fa58873c04dc702a907cc2a5df64e");
});

test("felsenbirne-20.json ohne Wurzeln: P1 bis P6, P8, P9 ✓ im Wortlaut, P7 „?“, Gesamtzeile „?“; P1 im Datenformat 20 ohne Hinweis „Vorabfassung“", async () => {
  const b = await signiert("felsenbirne-20.json");
  assert.deepEqual(jeSchritt(b), FELSENBIRNE(["P7", "offen", "Dass die Kette von WATT auf einem bestätigten Gerät stammt, lässt sich nicht bestätigen."]));
  const p1 = b.aussagen.filter((x) => x.schritt === "P1");
  assert.equal(p1.length, 1, texte(b, "P1"));
  assert.equal(p1[0]!.begruendung, "format watt-daten, version 20, exportiert am 2026-10-02T10:00:00.123Z aus WATT 0.8.126. Pflichtfelder und Typen der gelesenen Teile entsprechen watt-daten-20.schema.json.");
  assert.ok(!texte(b).includes("Vorabfassung"), texte(b));
  assert.equal(b.gesamt, "offen");
  assert.equal(
    b.gesamtText,
    "Nicht alles lässt sich bestätigen; nichts ist widerlegt. Bestätigt sind das Format, die Arbeitszeitkette, der Abgleich der Daten mit der Kette, die Zeitstempel, die Anker, die Signaturen, die Nachweiskette und die besonderen Glieder; offen bleibt die Attestierung (siehe die Aussagen mit „?“).",
  );
});

test("felsenbirne-20.json mit Wurzeln von Google, Sperrliste und App-Signatur aus daten/: ✗ allein in P7 (Testumgebung), Gesamtzeile ✗, sonst im Wortlaut wie ohne Wurzeln", async () => {
  const b = await mitWurzeln("felsenbirne-20.json");
  assert.deepEqual(jeSchritt(b), FELSENBIRNE(["P7", "widerlegt", "Die Kette stammt nicht von WATT auf einem bestätigten Gerät."]));
  assert.ok(!texte(b).includes("Vorabfassung"), texte(b));
  assert.equal(b.gesamt, "widerlegt");
  assert.equal(b.gesamtText, "Mindestens eine Aussage ist widerlegt.");
});

test("felsenbirne-20.json, P2, P6 und P8: 10 Glieder, 8 Signaturen, Nachweiskette mit 4 Gliedern, eine gesendete Überlastungsanzeige und ein gesendeter Antrag auf Zeitausgleich", async () => {
  const b = await signiert("felsenbirne-20.json");
  const a = (text: string) => b.aussagen.find((x) => x.text === text)!;
  assert.equal(a("Die Kette ist lückenlos und unverändert.").fundstelle, "Glied 1 bis 10, Datei „felsenbirne-20.json“");
  assert.equal(a("Signaturen belegen die Herkunft der Glieder 1–10.").fundstelle, "Glied 2–4, 6–10, Datei „felsenbirne-20.json“");
  assert.match(a("Signaturen belegen die Herkunft der Glieder 1–10.").begruendung, /^8 Signaturen sind gültig\./);
  assert.equal(a("Die Nachweiskette ist lückenlos und unverändert.").fundstelle, "Nachweisglied 1 bis 4, Datei „felsenbirne-20.json“");
  assert.equal(a("Die Nachweiskette ist lückenlos und unverändert.").begruendung, "WATTest hat die Prüfsumme aller 4 Nachweisglieder nach 5.1 neu berechnet; jede stimmt, und jedes Glied nennt seinen Vorgänger.");
  assert.equal(
    a("Die Nachweise entsprechen der Nachweiskette.").begruendung,
    "WATTest hat die Inhaltsprüfsummen von 1 gesendeten Überlastungsanzeige und 1 gesendeten Antrag auf Zeitausgleich mit 2 Dokumenten, 1 Gesprächsnotiz und 1 Nachtrag nach 5.1 neu berechnet; jede stimmt mit der gespeicherten und mit dem Glied der Nachweiskette überein.",
  );
  // Anhänge trägt nur die Überlastungsanzeige; der Antrag hat keine.
  const anhaenge = a("Die Datei nennt 2 Anhänge zu Anzeigen; Anhänge prüft WATTest nicht.");
  assert.deepEqual(anhaenge.details!.map((x) => x.text), [
    "Überlastungsanzeige eb0caf7b-6913-4778-a6e2-aba5181454be, Anhang 2 (PDF, 16 Bytes): ohne Kopie im Export",
    "Überlastungsanzeige eb0caf7b-6913-4778-a6e2-aba5181454be, Anhang 3 (FOTO, 5000 Bytes): ohne Kopie im Export",
  ]);
});
