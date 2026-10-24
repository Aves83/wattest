// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Bau von WATTest nach dist/ (oder in den Ordner aus dem ersten Argument).
// Reproduzierbar: keine Zeitstempel außer dem Abrufzeitpunkt der Daten; Commit-Kennung aus git.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import * as esbuild from "esbuild";

const WURZEL = fileURLToPath(new URL("..", import.meta.url));
const AUS = process.argv[2] ? resolve(process.argv[2]) : join(WURZEL, "dist");
const KOPF = "// SPDX-License-Identifier: EUPL-1.2\n// WATTest © 2026 Hans-Joachim Steudel\n";
const SEITE = "https://aves83.github.io/wattest/";

const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8"));
const VERSION = paket.version;

function commit() {
  if (process.env.WATTEST_COMMIT) return process.env.WATTEST_COMMIT.slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: WURZEL, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unbekannt";
  }
}
const COMMIT = commit();

const lies = (p) => readFileSync(join(WURZEL, p), "utf8");
const sha256 = (daten) => createHash("sha256").update(daten).digest("hex");
const cspHash = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

/** Inhalt für ein Inline-Skript: kein </script> und kein <!-- im Text. */
const inline = (js) => js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

async function buendel(einstieg, define) {
  const r = await esbuild.build({
    entryPoints: [join(WURZEL, einstieg)],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2022",
    minify: true,
    legalComments: "none",
    charset: "utf8",
    banner: { js: KOPF.trim() },
    define,
    logLevel: "warning",
  });
  return r.outputFiles[0].text;
}

async function css() {
  const r = await esbuild.transform(lies("src/ui/stil.css"), { loader: "css", minify: true, legalComments: "none", charset: "utf8" });
  return "/* SPDX-License-Identifier: EUPL-1.2 */ /* WATTest © 2026 Hans-Joachim Steudel */ " + r.code.trim();
}

// Symbol: blaues Quadrat mit weißem Haken, als SVG und als PNG (eigener Schreiber, zlib aus Node).
const SYMBOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!-- SPDX-License-Identifier: EUPL-1.2 --><!-- WATTest © 2026 Hans-Joachim Steudel --><rect width="512" height="512" rx="96" fill="#1d4ed8"/><path d="M136 270l80 80 160-184" fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;

function crc32(b) {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function png(n) {
  const strecke = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const zeilen = [];
  const s = 4;
  for (let y = 0; y < n; y++) {
    const z = [0];
    for (let x = 0; x < n; x++) {
      let w = 0;
      for (let i = 0; i < s; i++)
        for (let j = 0; j < s; j++) {
          const px = ((x + (i + 0.5) / s) / n) * 512, py = ((y + (j + 0.5) / s) / n) * 512;
          const d = Math.min(strecke(px, py, 136, 270, 216, 350), strecke(px, py, 216, 350, 376, 166));
          if (d <= 28) w++;
        }
      const a = w / (s * s);
      const mix = (f, h) => Math.round(f * (1 - a) + h * a);
      z.push(mix(0x1d, 255), mix(0x4e, 255), mix(0xd8, 255), 255);
    }
    zeilen.push(Buffer.from(z));
  }
  const teil = (typ, daten) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(daten.length);
    const td = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), teil("IHDR", ihdr), teil("IDAT", deflateSync(Buffer.concat(zeilen), { level: 9 })), teil("IEND", Buffer.alloc(0))]);
}

function csp(einzeldatei, skripte, stile) {
  return [
    "default-src 'none'",
    skripte.length ? `script-src ${skripte.map(cspHash).join(" ")}` : "script-src 'none'",
    `style-src ${stile.map(cspHash).join(" ")}`,
    "worker-src 'self' blob:",
    `connect-src ${einzeldatei ? "'none'" : "'self'"}`,
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

function fuelle(vorlage, werte) {
  return vorlage.replace(/\{\{([A-Z]+)\}\}/g, (_, k) => {
    if (!(k in werte)) throw new Error(`Platzhalter ${k} fehlt`);
    return werte[k];
  });
}

const datenJson = (p) => JSON.parse(lies(p));

async function bau() {
  const wurzeln = datenJson("daten/wurzeln.json");
  const sperrliste = datenJson("daten/sperrliste.json");
  const app = datenJson("daten/app-signatur.json");
  const appSignatur = { paketname: app.paketname, sha256: app.sha256 };

  const worker = await buendel("src/worker/worker.ts", {});
  const definiere = (einzeldatei) => ({
    __VERSION__: JSON.stringify(VERSION),
    __COMMIT__: JSON.stringify(COMMIT),
    __APP_SIGNATUR__: JSON.stringify(appSignatur),
    __WORKER_CODE__: JSON.stringify(worker),
    __EINZELDATEI__: String(einzeldatei),
  });
  const stil = await css();
  const vorlage = lies("src/ui/seite.html");
  const svgDaten = `data:image/svg+xml;base64,${Buffer.from(SYMBOL_SVG).toString("base64")}`;

  const seite = async (einzeldatei) => {
    const js = inline(await buendel("src/ui/main.ts", definiere(einzeldatei)));
    const daten = einzeldatei
      ? `<script type="application/json" id="wattest-daten">${JSON.stringify({ wurzeln, sperrliste, appSignatur }).replace(/</g, "\\u003c")}</script>`
      : "";
    const kopf = einzeldatei
      ? `<link rel="icon" href="${svgDaten}">`
      : `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="symbol.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="symbol-192.png">\n<meta name="theme-color" content="#1d4ed8">`;
    return fuelle(vorlage, {
      CSP: csp(einzeldatei, [js], [stil]),
      KOPF: kopf,
      CSS: stil,
      JS: js,
      DATEN: daten,
      VERSION,
      IMPRESSUM: einzeldatei ? `${SEITE}impressum.html` : "impressum.html",
      DATENSCHUTZ: einzeldatei ? `${SEITE}datenschutz.html` : "datenschutz.html",
    });
  };
  const textseite = (p) =>
    fuelle(lies(p), { CSP: csp(false, [], [stil]).replace("worker-src 'self' blob:; ", "").replace("connect-src 'self'; ", ""), KOPF: `<link rel="icon" href="symbol.svg" type="image/svg+xml">`, CSS: stil, VERSION });

  const dateien = new Map();
  dateien.set("index.html", await seite(false));
  dateien.set(`wattest-${VERSION}.html`, await seite(true));
  dateien.set("impressum.html", textseite("src/ui/impressum.html"));
  dateien.set("datenschutz.html", textseite("src/ui/datenschutz.html"));
  dateien.set("daten/sperrliste.json", JSON.stringify(sperrliste));
  dateien.set("daten/wurzeln.json", JSON.stringify(wurzeln));
  dateien.set("symbol.svg", SYMBOL_SVG);
  dateien.set("symbol-192.png", png(192));
  dateien.set("symbol-512.png", png(512));
  dateien.set(
    "manifest.webmanifest",
    JSON.stringify(
      {
        name: "WATTest – Stimmt WATT?",
        short_name: "WATTest",
        description: "Prüft Exporte der App WATT im Browser.",
        lang: "de",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1d4ed8",
        icons: [
          { src: "symbol.svg", sizes: "any", type: "image/svg+xml" },
          { src: "symbol-192.png", sizes: "192x192", type: "image/png" },
          { src: "symbol-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  const zwischenspeicher = ["./", "index.html", "impressum.html", "datenschutz.html", "manifest.webmanifest", "symbol.svg", "symbol-192.png", "symbol-512.png", "daten/sperrliste.json", "daten/wurzeln.json"];
  dateien.set(
    "sw.js",
    `${KOPF}
// Service Worker: hält nur die Dateien dieser Seite vor, damit WATTest auch ohne Netz läuft.
// Geprüfte Dateien und Eingaben gehen nie durch ihn; sie verlassen die Seite nicht.
const CACHE = ${JSON.stringify(`wattest-${VERSION}-${COMMIT}`)};
const DATEIEN = ${JSON.stringify(zwischenspeicher)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((namen) => Promise.all(namen.filter((n) => n.startsWith("wattest-") && n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/daten/")) {
    // Sperrliste und Wurzeln: zuerst frisch, sonst der zuletzt gespeicherte Stand.
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const kopie = r.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname.slice(url.pathname.indexOf("daten/")), kopie));
          }
          return r;
        })
        .catch(() => caches.match(url.pathname.slice(url.pathname.indexOf("daten/")))),
    );
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
`,
  );

  rmSync(AUS, { recursive: true, force: true });
  const summen = [];
  for (const [pfad, inhalt] of [...dateien].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const ziel = join(AUS, pfad);
    mkdirSync(dirname(ziel), { recursive: true });
    const bytes = typeof inhalt === "string" ? Buffer.from(inhalt, "utf8") : inhalt;
    writeFileSync(ziel, bytes);
    summen.push(`${sha256(bytes)}  ${pfad}`);
  }
  writeFileSync(join(AUS, "SHA256SUMS.txt"), summen.join("\n") + "\n");
  const einzel = summen.find((z) => z.endsWith(`wattest-${VERSION}.html`));
  console.log(`WATTest ${VERSION} (${COMMIT}) gebaut nach ${AUS}`);
  console.log(`Einzeldatei: ${einzel}`);
  console.log(`Sperrliste: Stand ${sperrliste.abgerufen}, ${Object.keys(sperrliste.eintraege).length} Einträge; Wurzeln: Stand ${wurzeln.abgerufen}`);
}

await bau();
