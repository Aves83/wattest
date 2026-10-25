// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Hilfsfunktionen für Bytes, Hex, Base64 und UTF-8.

const encoder = new TextEncoder();

// Ein einzelnes Ersatzzeichen (ungültiges UTF-16) wird in UTF-8 zu einem Fragezeichen, Byte 0x3F (4.6, Maskierung).
const EINZELNES_ERSATZZEICHEN = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

export function utf8(text: string): Uint8Array {
  return encoder.encode(text.replace(EINZELNES_ERSATZZEICHEN, "?"));
}

export function utf8Laenge(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      n += 4;
      i++;
    } else if (c >= 0xd800 && c <= 0xdfff) n += 1;
    else n += 3;
  }
  return n;
}

export function textAus(bytes: Uint8Array, fatal = true): string {
  return new TextDecoder("utf-8", { fatal }).decode(bytes);
}

const HEX = "0123456789abcdef";

export function hex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    s += HEX[b >> 4]! + HEX[b & 15]!;
  }
  return s;
}

export function ausHex(text: string): Uint8Array | null {
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) return null;
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(2 * i, 2 * i + 2), 16);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_WERT = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Base64 (Standardalphabet, Auffüllung optional, Leerraum erlaubt); null bei ungültigem Text. */
export function ausBase64(text: string): Uint8Array | null {
  const s = text.replace(/[\s]/g, "");
  let ende = s.length;
  while (ende > 0 && s[ende - 1] === "=") ende--;
  if (s.length - ende > 2) return null;
  if (s.length % 4 !== 0 && s.length !== ende) return null;
  const n = Math.floor((ende * 6) / 8);
  const out = new Uint8Array(n);
  let puffer = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < ende; i++) {
    const v = B64_WERT[s.charCodeAt(i)]!;
    if (v < 0) return null;
    puffer = (puffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (j < n) out[j++] = (puffer >> bits) & 0xff;
    }
  }
  if (ende % 4 === 1) return null;
  return out;
}

export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    s += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]!;
    s += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : "=";
    s += i + 2 < bytes.length ? B64[c & 63]! : "=";
  }
  return s;
}

export function verbinde(teile: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const t of teile) n += t.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const t of teile) {
    out.set(t, o);
    o += t.length;
  }
  return out;
}

export function gleich(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Kopie in einen eigenen ArrayBuffer, wie WebCrypto ihn erwartet. */
export function puffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.length);
  new Uint8Array(out).set(bytes);
  return out;
}
