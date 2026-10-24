// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Einfacher ZIP-Schreiber für die Tests (gespeichert oder Deflate über CompressionStream).

import { utf8, verbinde } from "../src/kern/bytes.js";
import { crc32 } from "../src/kern/zip.js";

async function deflate(b: Uint8Array): Promise<Uint8Array> {
  const kopie = new Uint8Array(b.length);
  kopie.set(b);
  const s = new Blob([kopie]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function zip(dateien: { pfad: string; inhalt: Uint8Array | string }[], komprimieren = true): Promise<Uint8Array> {
  const lokal: Uint8Array[] = [];
  const zentral: Uint8Array[] = [];
  let versatz = 0;
  for (const d of dateien) {
    const roh = typeof d.inhalt === "string" ? utf8(d.inhalt) : d.inhalt;
    const daten = komprimieren ? await deflate(roh) : roh;
    const name = utf8(d.pfad);
    const crc = crc32(roh);
    const kopf = new Uint8Array(30);
    const v = new DataView(kopf.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(8, komprimieren ? 8 : 0, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, daten.length, true);
    v.setUint32(22, roh.length, true);
    v.setUint16(26, name.length, true);
    lokal.push(kopf, name, daten);
    const z = new Uint8Array(46);
    const w = new DataView(z.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x800, true);
    w.setUint16(10, komprimieren ? 8 : 0, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, daten.length, true);
    w.setUint32(24, roh.length, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, versatz, true);
    zentral.push(z, name);
    versatz += 30 + name.length + daten.length;
  }
  const cd = verbinde(zentral);
  const ende = new Uint8Array(22);
  const e = new DataView(ende.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, dateien.length, true);
  e.setUint16(10, dateien.length, true);
  e.setUint32(12, cd.length, true);
  e.setUint32(16, versatz, true);
  return verbinde([...lokal, cd, ende]);
}
