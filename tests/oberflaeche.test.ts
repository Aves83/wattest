// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Oberfläche: Kontraste nach WCAG 2.2 AA in hellem und dunklem Modus, Helligkeit der Befundfarben,
// Texte und Bedienelemente der Seite.

import assert from "node:assert/strict";
import { test } from "node:test";
import { liesText } from "./hilfen.js";

const css = liesText("src/ui/stil.css");
const seite = liesText("src/ui/seite.html");

function variablen(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

const hell = variablen(/:root\s*\{([\s\S]*?)\}/.exec(css)![1]!);
const dunkel = new Map([...hell, ...variablen(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/.exec(css)![1]!)]);

function leucht(farbe: string): number {
  const k = [1, 3, 5].map((i) => parseInt(farbe.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * k[0]! + 0.7152 * k[1]! + 0.0722 * k[2]!;
}

function kontrast(a: string, b: string): number {
  const [x, y] = [leucht(a), leucht(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const TEXTPAARE: [string, string][] = [
  ["text", "grund"],
  ["text", "karte"],
  ["leise", "grund"],
  ["leise", "karte"],
  ["akzent", "grund"],
  ["akzent", "karte"],
  ["akzent-text", "akzent"],
  ["fehler", "grund"],
  ["fehler", "karte"],
  ["ok-text", "ok-grund"],
  ["offen-text", "offen-grund"],
  ["nein-text", "nein-grund"],
  ["info-text", "info-grund"],
];

for (const [modus, v] of [["hellen", hell], ["dunklen", dunkel]] as const) {
  test(`Kontraste im ${modus} Modus erfüllen WCAG 2.2 AA`, () => {
    for (const [a, b] of TEXTPAARE) {
      const k = kontrast(v.get(a)!, v.get(b)!);
      assert.ok(k >= 4.5, `${a} auf ${b}: ${k.toFixed(2)}`);
    }
    assert.ok(kontrast(v.get("fokus")!, v.get("grund")!) >= 3, "Fokusrahmen");
    assert.ok(kontrast(v.get("linie")!, v.get("grund")!) >= 1.4, "Linien");
  });

  test(`Befundfarben im ${modus} Modus mit deutlich verschiedener Helligkeit`, () => {
    const ok = leucht(v.get("ok-grund")!);
    const offen = leucht(v.get("offen-grund")!);
    const nein = leucht(v.get("nein-grund")!);
    assert.ok(offen > ok && ok > nein, "Gelb hell, Blau mittel, Rot dunkel");
    assert.ok((offen + 0.05) / (ok + 0.05) >= 2.5, "Gelb gegen Blau");
    assert.ok((ok + 0.05) / (nein + 0.05) >= 2.5, "Blau gegen Rot");
  });
}

test("die Seite nennt Überschrift und Zweck und hat beschriftete Eingaben", () => {
  assert.match(seite, /<h1>WATTest – Stimmt WATT\?<\/h1>/);
  assert.match(seite, /keine Datei und keine Eingabe verlässt deinen Rechner/);
  for (const id of [...seite.matchAll(/<(?:input|textarea)[^>]*id="([^"]+)"/g)].map((m) => m[1]!)) {
    assert.match(seite, new RegExp(`<label for="${id}"`), `Beschriftung für ${id}`);
  }
  assert.match(seite, /aria-live="polite"/);
  assert.match(seite, /<html lang="de">/);
});

test("die Startseite erklärt unter der Einleitung, was WATT ist", () => {
  const absatz = /<\/p>\s*<p class="unterzeile ueber">([\s\S]*?)<\/p>\s*<\/header>/.exec(seite);
  assert.ok(absatz, "Absatz „Über WATT“ unmittelbar nach der Einleitung");
  assert.match(absatz[1]!, /^<strong>Über WATT\.<\/strong> /);
  assert.equal(
    absatz[1]!.replace(/<[^>]+>/g, ""),
    "Über WATT. WATT ist eine kostenlose Android-App (Beta), mit der verbeamtete Lehrkräfte ihre Arbeitszeit erfassen und nachweisen. Mehr zu WATT. WATTest stammt vom selben Anbieter, ist aber quelloffen und prüft allein nach den veröffentlichten Unterlagen von WATT. Den Quelltext kann jede:r nachprüfen.",
  );
  for (const m of absatz[1]!.matchAll(/<a [^>]*>/g)) assert.match(m[0], /target="_blank" rel="noopener"/);
});

test("der Datenschutzhinweis nennt den Verantwortlichen ohne Anschrift", () => {
  const ds = liesText("src/ui/datenschutz.html");
  assert.match(ds, /<h1>Datenschutzhinweis<\/h1>\n<p>Verantwortlich ist Hans-Joachim Steudel, <a href="mailto:hans-joachim\.steudel@tum\.de">hans-joachim\.steudel@tum\.de<\/a>\.<\/p>/);
  assert.doesNotMatch(ds, /Manzostr/);
});

test("Fokus ist sichtbar, und nichts scrollt bei 360 px waagerecht", () => {
  assert.match(css, /:focus-visible\s*\{\s*outline: 3px solid/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.doesNotMatch(css, /min-width:\s*(?:[4-9]\d{2}|\d{4,})px/);
  assert.doesNotMatch(css, /width:\s*(?:[4-9]\d{2}|\d{4,})px/);
});
