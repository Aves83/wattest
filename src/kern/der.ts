// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Leser für DER (ASN.1, X.690) mit hohen Tag-Nummern, ohne Bibliothek.

export class DerFehler extends Error {}

export interface Tlv {
  /** Klasse: 0 universal, 1 application, 2 context, 3 private */
  klasse: number;
  konstruiert: boolean;
  tag: number;
  /** Beginn des ganzen Elements im Puffer */
  start: number;
  /** Beginn des Inhalts */
  inhaltStart: number;
  ende: number;
  bytes: Uint8Array;
}

export const T = {
  BOOLEAN: 1,
  INTEGER: 2,
  BIT_STRING: 3,
  OCTET_STRING: 4,
  NULL: 5,
  OID: 6,
  UTF8: 12,
  ENUMERATED: 10,
  SEQUENCE: 16,
  SET: 17,
  PRINTABLE: 19,
  IA5: 22,
  UTCTIME: 23,
  GENTIME: 24,
} as const;

export function lies(bytes: Uint8Array, pos = 0, grenze = bytes.length): Tlv {
  if (pos >= grenze) throw new DerFehler("DER: Ende der Daten");
  const start = pos;
  const b0 = bytes[pos++]!;
  const klasse = b0 >> 6;
  const konstruiert = (b0 & 0x20) !== 0;
  let tag = b0 & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    let b: number;
    let n = 0;
    do {
      if (pos >= grenze) throw new DerFehler("DER: Tag unvollständig");
      b = bytes[pos++]!;
      tag = tag * 128 + (b & 0x7f);
      if (++n > 4) throw new DerFehler("DER: Tag zu groß");
    } while (b & 0x80);
  }
  if (pos >= grenze) throw new DerFehler("DER: Länge fehlt");
  let laenge = bytes[pos++]!;
  if (laenge & 0x80) {
    const n = laenge & 0x7f;
    if (n === 0 || n > 4) throw new DerFehler("DER: Länge ungültig");
    laenge = 0;
    for (let i = 0; i < n; i++) {
      if (pos >= grenze) throw new DerFehler("DER: Länge unvollständig");
      laenge = laenge * 256 + bytes[pos++]!;
    }
  }
  const inhaltStart = pos;
  const ende = inhaltStart + laenge;
  if (ende > grenze) throw new DerFehler("DER: Element länger als die Daten");
  return { klasse, konstruiert, tag, start, inhaltStart, ende, bytes };
}

export function inhalt(t: Tlv): Uint8Array {
  return t.bytes.subarray(t.inhaltStart, t.ende);
}

export function ganz(t: Tlv): Uint8Array {
  return t.bytes.subarray(t.start, t.ende);
}

export function kinder(t: Tlv): Tlv[] {
  if (!t.konstruiert) throw new DerFehler("DER: Element ist nicht zusammengesetzt");
  const out: Tlv[] = [];
  let p = t.inhaltStart;
  while (p < t.ende) {
    const k = lies(t.bytes, p, t.ende);
    out.push(k);
    p = k.ende;
  }
  return out;
}

export function erwarte(t: Tlv, tag: number, klasse = 0): Tlv {
  if (t.tag !== tag || t.klasse !== klasse) throw new DerFehler(`DER: erwartet Tag ${klasse}/${tag}, gefunden ${t.klasse}/${t.tag}`);
  return t;
}

export function wurzel(bytes: Uint8Array): Tlv {
  const t = lies(bytes, 0);
  if (t.ende !== bytes.length) throw new DerFehler("DER: Daten hinter dem Element");
  return t;
}

/** Nicht negative ganze Zahl (bis 2^53). */
export function ganzzahl(t: Tlv): number {
  const b = inhalt(t);
  if (b.length === 0) throw new DerFehler("DER: leere Zahl");
  if (b[0]! & 0x80) throw new DerFehler("DER: negative Zahl");
  let n = 0;
  for (const x of b) n = n * 256 + x;
  if (n > Number.MAX_SAFE_INTEGER) throw new DerFehler("DER: Zahl zu groß");
  return n;
}

export function bool(t: Tlv): boolean {
  const b = inhalt(t);
  if (b.length !== 1) throw new DerFehler("DER: BOOLEAN ungültig");
  return b[0] !== 0;
}

export function oid(t: Tlv): string {
  const b = inhalt(t);
  const teile: number[] = [];
  let wert = 0;
  for (let i = 0; i < b.length; i++) {
    wert = wert * 128 + (b[i]! & 0x7f);
    if (!(b[i]! & 0x80)) {
      if (teile.length === 0) {
        const erst = wert < 40 ? 0 : wert < 80 ? 1 : 2;
        teile.push(erst, wert - erst * 40);
      } else teile.push(wert);
      wert = 0;
    }
  }
  return teile.join(".");
}

export function bitString(t: Tlv): Uint8Array {
  const b = inhalt(t);
  if (b.length === 0 || b[0] !== 0) throw new DerFehler("DER: BIT STRING mit ungenutzten Bits");
  return b.subarray(1);
}

/** UTCTime oder GeneralizedTime als Millisekunden seit 1970. */
export function zeit(t: Tlv): number {
  const s = String.fromCharCode(...inhalt(t));
  let m: RegExpExecArray | null;
  if (t.tag === T.UTCTIME) {
    m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
    if (!m) throw new DerFehler("DER: UTCTime ungültig");
    const jj = Number(m[1]);
    const jahr = jj >= 50 ? 1900 + jj : 2000 + jj;
    return Date.UTC(jahr, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  if (t.tag === T.GENTIME) {
    m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
    if (!m) throw new DerFehler("DER: GeneralizedTime ungültig");
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  throw new DerFehler("DER: keine Zeitangabe");
}
