// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// ZIP-Leser (gespeichert und Deflate über DecompressionStream('deflate-raw')), ohne Bibliothek.

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

async function entpacke(daten: Uint8Array): Promise<Uint8Array> {
  const Ds = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!Ds) throw new ZipFehler("Dieser Browser kann Deflate nicht entpacken (DecompressionStream fehlt).");
  const kopie = new Uint8Array(daten.length);
  kopie.set(daten);
  const strom = new Blob([kopie]).stream().pipeThrough(new Ds("deflate-raw"));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

function dekodiereName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // CP437 ist für deutsche Namen nicht nötig; Latin-1 als Rückfall.
    return String.fromCharCode(...bytes);
  }
}

export function leseZip(bytes: Uint8Array): ZipEintrag[] {
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
  if (cdStart + cdGroesse > bytes.length) throw new ZipFehler("ZIP-Verzeichnis zeigt über das Dateiende.");
  const eintraege: ZipEintrag[] = [];
  let p = cdStart;
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw new ZipFehler("ZIP-Verzeichnis beschädigt.");
    const flags = dv.getUint16(p + 8, true);
    const methode = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const komprimiert = dv.getUint32(p + 20, true);
    const groesse = dv.getUint32(p + 24, true);
    const nameLaenge = dv.getUint16(p + 28, true);
    const extraLaenge = dv.getUint16(p + 30, true);
    const kommentarLaenge = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const pfad = dekodiereName(bytes.subarray(p + 46, p + 46 + nameLaenge), (flags & 0x800) !== 0);
    p += 46 + nameLaenge + extraLaenge + kommentarLaenge;
    if (flags & 1) throw new ZipFehler(`„${pfad}“ ist verschlüsselt.`);
    const eintrag: ZipEintrag = {
      pfad,
      methode,
      groesse,
      komprimiert,
      crc32: crc,
      istOrdner: pfad.endsWith("/"),
      async lesen() {
        if (lokal + 30 > bytes.length || dv.getUint32(lokal, true) !== 0x04034b50) throw new ZipFehler(`Lokaler Kopf von „${pfad}“ fehlt.`);
        const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
        if (start + komprimiert > bytes.length) throw new ZipFehler(`„${pfad}“ reicht über das Dateiende.`);
        const roh = bytes.subarray(start, start + komprimiert);
        let daten: Uint8Array;
        if (methode === 0) daten = roh;
        else if (methode === 8) daten = await entpacke(roh);
        else throw new ZipFehler(`„${pfad}“ nutzt die Kompression ${methode}, die WATTest nicht kennt.`);
        if (daten.length !== groesse) throw new ZipFehler(`„${pfad}“ hat nicht die angegebene Größe.`);
        if (crc32(daten) !== crc) throw new ZipFehler(`Die CRC-32 von „${pfad}“ stimmt nicht.`);
        return daten;
      },
    };
    eintraege.push(eintrag);
  }
  return eintraege;
}
