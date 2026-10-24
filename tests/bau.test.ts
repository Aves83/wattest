// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Bau: erwartete Dateien, CSP-Hashes, keine fremden Adressen, SHA256SUMS.txt, Reproduzierbarkeit.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { base64, textAus } from "../src/kern/bytes.js";
import { sha256, sha256Hex } from "../src/kern/sha.js";
import { WURZEL } from "./hilfen.js";

const VERSION = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")).version as string;
let a = "";
let b = "";

function baue(ziel: string): void {
  execFileSync(process.execPath, [join(WURZEL, "scripts/bau.mjs"), ziel], { cwd: WURZEL, env: { ...process.env, WATTEST_COMMIT: "0123456789ab" }, stdio: "ignore" });
}

function dateien(ordner: string, praefix = ""): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(ordner, praefix))) {
    const p = praefix ? `${praefix}/${n}` : n;
    if (statSync(join(ordner, p)).isDirectory()) out.push(...dateien(ordner, p));
    else out.push(p);
  }
  return out.sort();
}

before(() => {
  a = mkdtempSync(join(tmpdir(), "wattest-bau-a-"));
  b = mkdtempSync(join(tmpdir(), "wattest-bau-b-"));
  baue(a);
  baue(b);
});

after(() => {
  rmSync(a, { recursive: true, force: true });
  rmSync(b, { recursive: true, force: true });
});

const ERWARTET = ["SHA256SUMS.txt", "daten/sperrliste.json", "daten/wurzeln.json", "datenschutz.html", "impressum.html", "index.html", "manifest.webmanifest", "sw.js", "symbol-192.png", "symbol-512.png", "symbol.svg", `wattest-${VERSION}.html`];

test("dist enthält die erwarteten Dateien", () => {
  assert.deepEqual(dateien(a), [...ERWARTET].sort());
});

test("der Bau ist reproduzierbar", () => {
  for (const d of dateien(a)) assert.deepEqual(readFileSync(join(a, d)), readFileSync(join(b, d)), d);
});

test("SHA256SUMS.txt stimmt und nennt alle Dateien", async () => {
  const zeilen = readFileSync(join(a, "SHA256SUMS.txt"), "utf8").trim().split("\n");
  const genannt = new Set<string>();
  for (const z of zeilen) {
    const m = /^([0-9a-f]{64})  (.+)$/.exec(z);
    assert.ok(m, z);
    assert.equal(await sha256Hex(readFileSync(join(a, m[2]!))), m[1], m[2]);
    genannt.add(m[2]!);
  }
  assert.deepEqual([...genannt].sort(), ERWARTET.filter((d) => d !== "SHA256SUMS.txt").sort());
});

function csp(html: string): Map<string, string> {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  assert.ok(m, "CSP fehlt");
  return new Map(m[1]!.split(";").map((t) => t.trim().split(/\s+(.*)/s) as [string, string]));
}

async function hashVon(text: string): Promise<string> {
  return `'sha256-${base64(await sha256(text))}'`;
}

for (const name of ["index.html", `wattest-${VERSION}.html`, "impressum.html", "datenschutz.html"]) {
  test(`${name}: CSP mit stimmenden Hashes`, async () => {
    const html = readFileSync(join(a, name), "utf8");
    const c = csp(html);
    assert.equal(c.get("default-src"), "'none'");
    assert.equal(c.get("base-uri"), "'none'");
    assert.equal(c.get("form-action"), "'none'");
    const skripte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    const stile = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
    assert.equal(stile.length, 1);
    assert.equal(c.get("style-src"), (await Promise.all(stile.map(hashVon))).join(" "));
    if (skripte.length) assert.equal(c.get("script-src"), (await Promise.all(skripte.map(hashVon))).join(" "));
    else assert.equal(c.get("script-src"), "'none'");
    assert.doesNotMatch(html, /\sstyle="/, "keine Inline-Stile");
    assert.doesNotMatch(html, /\son[a-z]+="/, "keine Inline-Ereignisse");
    if (name === "index.html") {
      assert.equal(c.get("connect-src"), "'self'");
      assert.equal(c.get("worker-src"), "'self' blob:");
      assert.equal(c.get("img-src"), "'self' data: blob:");
      assert.equal(c.get("manifest-src"), "'self'");
    }
    if (name.startsWith("wattest-")) assert.equal(c.get("connect-src"), "'none'");
  });
}

// Erlaubte Adressen: Links in Fußzeile, Impressum und Datenschutz sowie Quellenangaben in den Daten.
const ERLAUBT = [
  /^https:\/\/github\.com\/Aves83\/wattest$/,
  /^https:\/\/aves83\.github\.io\/wattest\/(impressum|datenschutz)\.html$/,
  /^https:\/\/docs\.github\.com\/de\/site-policy\/privacy-policies\/github-general-privacy-statement$/,
  /^https:\/\/www\.lda\.bayern\.de\/$/,
  /^mailto:hans-joachim\.steudel@tum\.de$/,
];
const QUELLEN = [/^https:\/\/android\.googleapis\.com\/attestation\/(status|root)$/, /^https:\/\/developer\.android\.com\/privacy-and-security\/security-key-attestation$/];
const SVG_NS = "http://www.w3.org/2000/svg";

test("dist lädt keine fremden Adressen", () => {
  for (const d of dateien(a)) {
    if (/\.png$/.test(d)) continue;
    let text = textAus(new Uint8Array(readFileSync(join(a, d))), false);
    // Quellenangaben der Daten sind Text, keine Verweise.
    text = text.replace(/"quelle":"[^"]*"/g, (q) => {
      for (const u of q.match(/https?:\/\/[^\s"()]+/g) ?? []) assert.ok(QUELLEN.some((r) => r.test(u)), `${d}: Quelle ${u}`);
      return '"quelle":""';
    });
    for (const m of text.matchAll(/(?:src|href|action|poster|data)\s*=\s*"([^"]*)"/gi)) {
      const ziel = m[1]!;
      if (!/^(https?:|mailto:|\/\/)/i.test(ziel)) continue;
      const vor = text.slice(Math.max(0, m.index! - 200), m.index!);
      const istLink = /<a\s[^>]*$/i.test(vor);
      assert.ok(istLink, `${d}: ${ziel} wird geladen, nicht verlinkt`);
      assert.ok(ERLAUBT.some((r) => r.test(ziel)), `${d}: Link ${ziel} nicht erlaubt`);
    }
    for (const u of text.match(/https?:\/\/[^\s"'<>)\\]+/g) ?? []) {
      assert.ok(u === SVG_NS || ERLAUBT.some((r) => r.test(u)), `${d}: Adresse ${u}`);
    }
    assert.doesNotMatch(text, /url\(\s*['"]?https?:/i, `${d}: CSS lädt fremde Adresse`);
    assert.doesNotMatch(text, /@import/i, `${d}: @import`);
  }
});

test("die Einzeldatei ist vollständig und verweist auf keine weiteren Dateien", () => {
  const html = readFileSync(join(a, `wattest-${VERSION}.html`), "utf8");
  assert.match(html, /<script type="application\/json" id="wattest-daten">/);
  assert.doesNotMatch(html, /rel="manifest"/);
  assert.doesNotMatch(html, /href="symbol/);
  assert.doesNotMatch(html, /fetch\("daten\//);
  for (const m of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
    const z = m[1]!;
    assert.ok(/^(data:|#|https:\/\/|mailto:)/.test(z), `Verweis ${z}`);
  }
  const daten = JSON.parse(/<script type="application\/json" id="wattest-daten">([\s\S]*?)<\/script>/.exec(html)![1]!);
  assert.ok(Object.keys(daten.sperrliste.eintraege).length > 0);
  assert.equal(daten.wurzeln.zertifikate.length, 2);
  assert.ok(daten.sperrliste.abgerufen);
});

test("Fußzeile mit Version, Lizenz und Links", () => {
  for (const name of ["index.html", `wattest-${VERSION}.html`]) {
    const html = readFileSync(join(a, name), "utf8");
    assert.match(html, new RegExp(`WATTest ${VERSION.replace(/\./g, "\\.")} · © 2026 Hans-Joachim Steudel · EUPL-1.2 · <a href="https://github.com/Aves83/wattest">Quelltext</a> · <a href="[^"]*impressum.html">Impressum</a> · <a href="[^"]*datenschutz.html">Datenschutz</a>`));
  }
});

test("Service Worker hält nur Dateien der Seite vor", () => {
  const sw = readFileSync(join(a, "sw.js"), "utf8");
  const liste = JSON.parse(/const DATEIEN = (\[.*\]);/.exec(sw)![1]!) as string[];
  for (const d of liste) assert.ok(d === "./" || existsSync(join(a, d)), d);
  assert.ok(!liste.includes(`wattest-${VERSION}.html`));
});
