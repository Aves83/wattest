// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Leser für DER (ASN.1, X.690) mit hohen Tag-Nummern, ohne Bibliothek. Streng nach DER: keine unbestimmten
// Längen, Tag-Nummern begrenzt, Längen gegen das Ende der Daten, Verschachtelung begrenzt (GRENZWERTE).

import { GRENZWERTE } from "./grenzen.js";

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
      if (n === 0 && b === 0x80) throw new DerFehler("DER: Tag-Nummer nicht minimal kodiert");
      tag = tag * 128 + (b & 0x7f);
      if (++n > 2 || tag > GRENZWERTE.derTag) throw new DerFehler(`DER: Tag-Nummer über der Grenze von ${GRENZWERTE.derTag}`);
    } while (b & 0x80);
    if (tag < 0x1f) throw new DerFehler("DER: kleine Tag-Nummer in langer Form");
  }
  if (pos >= grenze) throw new DerFehler("DER: Länge fehlt");
  let laenge = bytes[pos++]!;
  if (laenge === 0x80) throw new DerFehler("DER: unbestimmte Länge ist in DER nicht erlaubt");
  if (laenge & 0x80) {
    const n = laenge & 0x7f;
    if (n > 4) throw new DerFehler("DER: Längenfeld zu lang");
    laenge = 0;
    for (let i = 0; i < n; i++) {
      if (pos >= grenze) throw new DerFehler("DER: Länge unvollständig");
      laenge = laenge * 256 + bytes[pos++]!;
    }
  }
  const inhaltStart = pos;
  if (laenge > grenze - inhaltStart) throw new DerFehler("DER: Element länger als die Daten");
  return { klasse, konstruiert, tag, start, inhaltStart, ende: inhaltStart + laenge, bytes };
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

/** Element i einer Liste; fehlt es, ein DerFehler statt eines Zugriffs auf undefined. */
export function teil(liste: Tlv[], i: number, was: string): Tlv {
  const t = liste[i];
  if (!t) throw new DerFehler(`DER: ${was} fehlt`);
  return t;
}

export function erwarte(t: Tlv | undefined, tag: number, klasse = 0): Tlv {
  if (!t) throw new DerFehler(`DER: erwartet Tag ${klasse}/${tag}, gefunden nichts`);
  if (t.tag !== tag || t.klasse !== klasse) throw new DerFehler(`DER: erwartet Tag ${klasse}/${tag}, gefunden ${t.klasse}/${t.tag}`);
  return t;
}

/**
 * Prüft den Aufbau eines Elements ohne Rekursion: Jedes zusammengesetzte Element besteht genau aus seinen Kindern,
 * die Verschachtelung bleibt unter der Grenze.
 */
function pruefeAufbau(t: Tlv): void {
  const stapel: { t: Tlv; tiefe: number }[] = [{ t, tiefe: 1 }];
  while (stapel.length) {
    const { t: e, tiefe } = stapel.pop()!;
    if (!e.konstruiert) continue;
    if (tiefe > GRENZWERTE.derTiefe) throw new DerFehler(`DER: Verschachtelung tiefer als ${GRENZWERTE.derTiefe} Ebenen`);
    for (const k of kinder(e)) stapel.push({ t: k, tiefe: tiefe + 1 });
  }
}

/** Liest genau ein Element, das die Daten ganz ausfüllt, und prüft seinen Aufbau. */
export function wurzel(bytes: Uint8Array): Tlv {
  const t = lies(bytes, 0);
  if (t.ende !== bytes.length) throw new DerFehler("DER: Daten hinter dem Element");
  pruefeAufbau(t);
  return t;
}

/** Nicht negative ganze Zahl (bis 2^53). */
export function ganzzahl(t: Tlv): number {
  const b = inhalt(t);
  if (b.length === 0) throw new DerFehler("DER: leere Zahl");
  if (b[0]! & 0x80) throw new DerFehler("DER: negative Zahl");
  if (b.length > 8) throw new DerFehler("DER: Zahl zu groß");
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
  if (b.length === 0 || b.length > 64) throw new DerFehler("DER: OID ungültig");
  if (b[b.length - 1]! & 0x80) throw new DerFehler("DER: OID unvollständig");
  const teile: number[] = [];
  let wert = 0;
  for (let i = 0; i < b.length; i++) {
    if (wert > Number.MAX_SAFE_INTEGER / 128) throw new DerFehler("DER: Bestandteil der OID zu groß");
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
  const b = inhalt(t);
  if (b.length > 32) throw new DerFehler("DER: Zeitangabe zu lang");
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
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
