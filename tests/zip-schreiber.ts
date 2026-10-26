// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Einfacher ZIP-Schreiber für die Tests (gespeichert oder Deflate über CompressionStream); mit rohen Einträgen auch
// für manipulierte ZIP-Dateien (falsche Größen, Zip-Bomben).

import { utf8, verbinde } from "../src/kern/bytes.js";
import { crc32 } from "../src/kern/zip.js";

async function deflate(b: Uint8Array): Promise<Uint8Array> {
  const kopie = new Uint8Array(b.length);
  kopie.set(b);
  const s = new Blob([kopie]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** n MB Nullen, als Strom komprimiert, ohne sie ganz im Speicher zu halten. */
export async function nullenKomprimiert(mb: number): Promise<Uint8Array> {
  const stueck = new Uint8Array(1024 * 1024);
  let n = 0;
  const quelle = new ReadableStream<Uint8Array>({
    pull(c) {
      if (n++ < mb) c.enqueue(stueck);
      else c.close();
    },
  });
  const strom = quelle.pipeThrough(new CompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

export interface RohEintrag {
  pfad: string;
  /** Daten, wie sie im ZIP stehen (bei Methode 8 komprimiert) */
  daten: Uint8Array;
  /** angegebene entpackte Größe */
  groesse: number;
  crc: number;
  methode: 0 | 8;
  /** Änderungszeit als DOS-Uhrzeit und -Datum (Vorgabe 0) */
  zeit?: { uhrzeit: number; datum: number };
}

/** ZIP aus rohen Einträgen; Größen und CRC stehen so im Verzeichnis, wie angegeben. */
export function zipRoh(eintraege: RohEintrag[]): Uint8Array {
  const lokal: Uint8Array[] = [];
  const zentral: Uint8Array[] = [];
  let versatz = 0;
  for (const d of eintraege) {
    const name = utf8(d.pfad);
    const kopf = new Uint8Array(30);
    const v = new DataView(kopf.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(8, d.methode, true);
    v.setUint16(10, d.zeit?.uhrzeit ?? 0, true);
    v.setUint16(12, d.zeit?.datum ?? 0, true);
    v.setUint32(14, d.crc, true);
    v.setUint32(18, d.daten.length, true);
    v.setUint32(22, d.groesse, true);
    v.setUint16(26, name.length, true);
    lokal.push(kopf, name, d.daten);
    const z = new Uint8Array(46);
    const w = new DataView(z.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x800, true);
    w.setUint16(10, d.methode, true);
    w.setUint16(12, d.zeit?.uhrzeit ?? 0, true);
    w.setUint16(14, d.zeit?.datum ?? 0, true);
    w.setUint32(16, d.crc, true);
    w.setUint32(20, d.daten.length, true);
    w.setUint32(24, d.groesse, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, versatz, true);
    zentral.push(z, name);
    versatz += 30 + name.length + d.daten.length;
  }
  const cd = verbinde(zentral);
  const ende = new Uint8Array(22);
  const e = new DataView(ende.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, eintraege.length, true);
  e.setUint16(10, eintraege.length, true);
  e.setUint32(12, cd.length, true);
  e.setUint32(16, versatz, true);
  return verbinde([...lokal, cd, ende]);
}

export async function zip(dateien: { pfad: string; inhalt: Uint8Array | string; zeit?: RohEintrag["zeit"] }[], komprimieren = true): Promise<Uint8Array> {
  const eintraege: RohEintrag[] = [];
  for (const d of dateien) {
    const roh = typeof d.inhalt === "string" ? utf8(d.inhalt) : d.inhalt;
    eintraege.push({ pfad: d.pfad, daten: komprimieren ? await deflate(roh) : roh, groesse: roh.length, crc: crc32(roh), methode: komprimieren ? 8 : 0, ...(d.zeit ? { zeit: d.zeit } : {}) });
  }
  return zipRoh(eintraege);
}
