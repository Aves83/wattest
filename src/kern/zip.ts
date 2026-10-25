// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// ZIP-Leser (gespeichert und Deflate über DecompressionStream('deflate-raw')), ohne Bibliothek.
// Abgewiesen werden zu viele Einträge, zu große oder zu stark komprimierte Einträge (Zip-Bombe), überlappende
// Einträge, doppelte und unsichere Pfade (etwa mit ../); Grenzen in GRENZWERTE.

import { GRENZWERTE, grenzeText } from "./grenzen.js";

export class ZipFehler extends Error {}

export interface ZipEintrag {
  pfad: string;
  methode: number;
  groesse: number;
  komprimiert: number;
  crc32: number;
  istOrdner: boolean;
  lesen(): Promise<Uint8Array>;
}

const TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function istZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5) && (bytes[3] === 4 || bytes[3] === 6);
}

/** Entpackt Deflate und bricht ab, sobald mehr als die angegebene Größe herauskommt. */
async function entpacke(daten: Uint8Array, groesse: number, pfad: string): Promise<Uint8Array> {
  const Ds = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!Ds) throw new ZipFehler("Dieser Browser kann Deflate nicht entpacken (DecompressionStream fehlt).");
  const out = new Uint8Array(groesse);
  let n = 0;
  const leser = new Blob([daten.slice()]).stream().pipeThrough(new Ds("deflate-raw")).getReader();
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      if (value.length > groesse - n) {
        await leser.cancel().catch(() => undefined);
        throw new ZipFehler(`„${pfad}“ ergibt entpackt mehr als die angegebenen ${grenzeText(groesse)} Bytes.`);
      }
      out.set(value, n);
      n += value.length;
    }
  } catch (e) {
    if (e instanceof ZipFehler) throw e;
    throw new ZipFehler(`„${pfad}“ lässt sich nicht entpacken (${(e as Error).message}).`);
  }
  if (n !== groesse) throw new ZipFehler(`„${pfad}“ hat nicht die angegebene Größe.`);
  return out;
}

function dekodiereName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // CP437 ist für deutsche Namen nicht nötig; Latin-1 als Rückfall.
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
}

/** Pfade relativ und ohne Ausbruch: kein „..“, kein führender Schrägstrich, kein Laufwerk, kein Rückstrich. */
function pruefePfad(pfad: string): void {
  if (pfad === "") throw new ZipFehler("Ein Eintrag im ZIP hat keinen Namen.");
  if (pfad.length > GRENZWERTE.zipPfad) throw new ZipFehler(`Ein Pfad im ZIP ist länger als die Grenze von ${grenzeText(GRENZWERTE.zipPfad)} Zeichen.`);
  if (/[\u0000-\u001f\\]/.test(pfad)) throw new ZipFehler(`Der Pfad „${pfad.replace(/[\u0000-\u001f]/g, "?")}“ enthält Steuerzeichen oder einen Rückstrich.`);
  if (pfad.startsWith("/") || /^[A-Za-z]:/.test(pfad)) throw new ZipFehler(`Der Pfad „${pfad}“ ist absolut.`);
  if (pfad.split("/").includes("..")) throw new ZipFehler(`Der Pfad „${pfad}“ führt mit „..“ aus dem ZIP heraus.`);
}

export function leseZip(bytes: Uint8Array): ZipEintrag[] {
  if (bytes.length < 22) throw new ZipFehler("Die Datei ist zu kurz für ein ZIP.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipFehler("Kein ZIP-Verzeichnis gefunden.");
  const anzahl = dv.getUint16(eocd + 10, true);
  const cdGroesse = dv.getUint32(eocd + 12, true);
  const cdStart = dv.getUint32(eocd + 16, true);
  if (anzahl === 0xffff || cdStart === 0xffffffff) throw new ZipFehler("ZIP64 wird nicht unterstützt.");
  if (anzahl > GRENZWERTE.zipEintraege) throw new ZipFehler(`Das ZIP hat ${grenzeText(anzahl)} Einträge, mehr als die Grenze von ${grenzeText(GRENZWERTE.zipEintraege)}.`);
  if (cdStart + cdGroesse > eocd) throw new ZipFehler("ZIP-Verzeichnis zeigt über das Dateiende.");
  const cdEnde = cdStart + cdGroesse;
  const eintraege: ZipEintrag[] = [];
  const pfade = new Set<string>();
  const belegt: { von: number; bis: number; pfad: string }[] = [];
  let gesamt = 0;
  let p = cdStart;
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > cdEnde || dv.getUint32(p, true) !== 0x02014b50) throw new ZipFehler("ZIP-Verzeichnis beschädigt.");
    const flags = dv.getUint16(p + 8, true);
    const methode = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const komprimiert = dv.getUint32(p + 20, true);
    const groesse = dv.getUint32(p + 24, true);
    const nameLaenge = dv.getUint16(p + 28, true);
    const extraLaenge = dv.getUint16(p + 30, true);
    const kommentarLaenge = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    if (p + 46 + nameLaenge + extraLaenge + kommentarLaenge > cdEnde) throw new ZipFehler("ZIP-Verzeichnis beschädigt.");
    const pfad = dekodiereName(bytes.subarray(p + 46, p + 46 + nameLaenge), (flags & 0x800) !== 0);
    p += 46 + nameLaenge + extraLaenge + kommentarLaenge;
    pruefePfad(pfad);
    if (pfade.has(pfad)) throw new ZipFehler(`„${pfad}“ steht mehrfach im ZIP.`);
    pfade.add(pfad);
    if (flags & 1) throw new ZipFehler(`„${pfad}“ ist verschlüsselt.`);
    if (komprimiert === 0xffffffff || groesse === 0xffffffff || lokal === 0xffffffff) throw new ZipFehler("ZIP64 wird nicht unterstützt.");
    if (methode !== 0 && methode !== 8) throw new ZipFehler(`„${pfad}“ nutzt die Kompression ${methode}, die WATTest nicht kennt.`);
    if (methode === 0 && komprimiert !== groesse) throw new ZipFehler(`„${pfad}“ ist unkomprimiert, nennt aber zwei verschiedene Größen.`);
    if (groesse > GRENZWERTE.zipEintragBytes) throw new ZipFehler(`„${pfad}“ ist entpackt ${grenzeText(groesse, "bytes")} groß, mehr als die Grenze von ${grenzeText(GRENZWERTE.zipEintragBytes, "bytes")}.`);
    gesamt += groesse;
    if (gesamt > GRENZWERTE.zipGesamtBytes) throw new ZipFehler(`Die Einträge des ZIP sind entpackt zusammen größer als die Grenze von ${grenzeText(GRENZWERTE.zipGesamtBytes, "bytes")}.`);
    if (groesse > 1024 * 1024 && groesse > GRENZWERTE.zipVerhaeltnis * Math.max(komprimiert, 1)) {
      throw new ZipFehler(`„${pfad}“ ist mehr als ${GRENZWERTE.zipVerhaeltnis}-fach komprimiert; das deutet auf eine Zip-Bombe.`);
    }
    if (lokal + 30 > cdStart || dv.getUint32(lokal, true) !== 0x04034b50) throw new ZipFehler(`Lokaler Kopf von „${pfad}“ fehlt.`);
    const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
    if (start + komprimiert > cdStart) throw new ZipFehler(`„${pfad}“ reicht über seinen Bereich im ZIP hinaus.`);
    belegt.push({ von: lokal, bis: start + komprimiert, pfad });
    const eintrag: ZipEintrag = {
      pfad,
      methode,
      groesse,
      komprimiert,
      crc32: crc,
      istOrdner: pfad.endsWith("/"),
      async lesen() {
        const roh = bytes.subarray(start, start + komprimiert);
        const daten = methode === 0 ? roh : await entpacke(roh, groesse, pfad);
        if (daten.length !== groesse) throw new ZipFehler(`„${pfad}“ hat nicht die angegebene Größe.`);
        if (crc32(daten) !== crc) throw new ZipFehler(`Die CRC-32 von „${pfad}“ stimmt nicht.`);
        return daten;
      },
    };
    eintraege.push(eintrag);
  }
  // Überlappende Einträge (mehrere Namen für dieselben Daten) sind der Kern einer Zip-Bombe ohne Verschachtelung.
  belegt.sort((a, b) => a.von - b.von);
  for (let i = 1; i < belegt.length; i++) {
    if (belegt[i]!.von < belegt[i - 1]!.bis) throw new ZipFehler(`Die Einträge „${belegt[i - 1]!.pfad}“ und „${belegt[i]!.pfad}“ überlappen im ZIP.`);
  }
  return eintraege;
}
