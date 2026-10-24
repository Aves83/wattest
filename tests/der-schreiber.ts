// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// DER-Schreiber nur für die Tests: baut Zertifikate und die Attestierungserweiterung.

import { utf8, verbinde } from "../src/kern/bytes.js";

function laenge(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const b: number[] = [];
  while (n > 0) {
    b.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return new Uint8Array([0x80 | b.length, ...b]);
}

function kennung(klasse: number, konstruiert: boolean, tag: number): Uint8Array {
  const erst = (klasse << 6) | (konstruiert ? 0x20 : 0);
  if (tag < 31) return new Uint8Array([erst | tag]);
  const teile: number[] = [];
  let t = tag;
  teile.unshift(t & 0x7f);
  t >>= 7;
  while (t > 0) {
    teile.unshift((t & 0x7f) | 0x80);
    t >>= 7;
  }
  return new Uint8Array([erst | 0x1f, ...teile]);
}

export function tlv(klasse: number, konstruiert: boolean, tag: number, inhalt: Uint8Array): Uint8Array {
  return verbinde([kennung(klasse, konstruiert, tag), laenge(inhalt.length), inhalt]);
}

export const seq = (...k: Uint8Array[]): Uint8Array => tlv(0, true, 16, verbinde(k));
export const set = (...k: Uint8Array[]): Uint8Array => tlv(0, true, 17, verbinde(k));
export const oktette = (b: Uint8Array): Uint8Array => tlv(0, false, 4, b);
export const bool = (w: boolean): Uint8Array => tlv(0, false, 1, new Uint8Array([w ? 0xff : 0]));
export const nul = (): Uint8Array => tlv(0, false, 5, new Uint8Array());
export const utf8String = (s: string): Uint8Array => tlv(0, false, 12, utf8(s));
export const bits = (b: Uint8Array): Uint8Array => tlv(0, false, 3, verbinde([new Uint8Array([0]), b]));
/** Explizit getaggt im Kontext (auch hohe Tag-Nummern wie 704). */
export const explizit = (tag: number, inhalt: Uint8Array): Uint8Array => tlv(2, true, tag, inhalt);

function ganzBytes(n: bigint | number): Uint8Array {
  let x = BigInt(n);
  const b: number[] = [];
  do {
    b.unshift(Number(x & 0xffn));
    x >>= 8n;
  } while (x > 0n);
  if (b[0]! & 0x80) b.unshift(0);
  return new Uint8Array(b);
}

export const int = (n: bigint | number): Uint8Array => tlv(0, false, 2, ganzBytes(n));
export const enumWert = (n: number): Uint8Array => tlv(0, false, 10, ganzBytes(n));
export const intRoh = (b: Uint8Array): Uint8Array => {
  let x = b;
  while (x.length > 1 && x[0] === 0 && !(x[1]! & 0x80)) x = x.subarray(1);
  if (x[0]! & 0x80) x = verbinde([new Uint8Array([0]), x]);
  return tlv(0, false, 2, x);
};

export function oid(text: string): Uint8Array {
  const t = text.split(".").map(Number);
  const out: number[] = [40 * t[0]! + t[1]!];
  for (const n of t.slice(2)) {
    const teile: number[] = [n & 0x7f];
    let x = n >> 7;
    while (x > 0) {
      teile.unshift((x & 0x7f) | 0x80);
      x >>= 7;
    }
    out.push(...teile);
  }
  return tlv(0, false, 6, new Uint8Array(out));
}

function zeitText(ms: number, gen: boolean): string {
  const d = new Date(ms).toISOString();
  const s = d.slice(0, 4) + d.slice(5, 7) + d.slice(8, 10) + d.slice(11, 13) + d.slice(14, 16) + d.slice(17, 19) + "Z";
  return gen ? s : s.slice(2);
}

export function zeit(ms: number): Uint8Array {
  const jahr = new Date(ms).getUTCFullYear();
  const gen = jahr >= 2050 || jahr < 1950;
  return tlv(0, false, gen ? 24 : 23, utf8(zeitText(ms, gen)));
}

export function name(cn: string, o = "WATTest Testzertifikate"): Uint8Array {
  return seq(set(seq(oid("2.5.4.10"), utf8String(o))), set(seq(oid("2.5.4.3"), utf8String(cn))));
}
