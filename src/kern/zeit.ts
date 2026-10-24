// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Zeitpunkte in UTC und deutsche Zeit (Europe/Berlin) ohne Intl.

const ZEITPUNKT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Millisekunden seit 1970 für einen Zeitpunkt nach ISO 8601 in UTC, sonst null. */
export function zeitpunktMs(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const m = ZEITPUNKT.exec(text);
  if (!m) return null;
  const [j, mo, t, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || t < 1 || t > 31 || h > 23 || mi > 59 || s > 59) return null;
  const ms = m[7] ? Number(m[7].padEnd(3, "0").slice(0, 3)) : 0;
  const wert = Date.UTC(j, mo - 1, t, h, mi, s, ms);
  if (new Date(wert).getUTCDate() !== t) return null;
  return wert;
}

export function istZeitpunkt(text: unknown): boolean {
  return zeitpunktMs(text) !== null;
}

export function istTag(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const m = TAG.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1;
}

/** Letzter Sonntag eines Monats um 01:00 UTC. */
function letzterSonntag(jahr: number, monat: number): number {
  const ende = new Date(Date.UTC(jahr, monat + 1, 0, 1, 0, 0));
  const wt = ende.getUTCDay();
  return ende.getTime() - wt * 86400000;
}

/** Abstand der deutschen Zeit zu UTC in Minuten (60 oder 120). */
export function berlinVersatzMinuten(ms: number): number {
  const jahr = new Date(ms).getUTCFullYear();
  const beginn = letzterSonntag(jahr, 2);
  const ende = letzterSonntag(jahr, 9);
  return ms >= beginn && ms < ende ? 120 : 60;
}

export interface Ortszeit {
  jahr: number;
  monat: number;
  tag: number;
  stunde: number;
  minute: number;
}

export function berlin(ms: number): Ortszeit {
  const d = new Date(ms + berlinVersatzMinuten(ms) * 60000);
  return {
    jahr: d.getUTCFullYear(),
    monat: d.getUTCMonth() + 1,
    tag: d.getUTCDate(),
    stunde: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const z2 = (n: number): string => String(n).padStart(2, "0");

/** „12.03.2026 14:32“ in deutscher Zeit. */
export function deutsch(ms: number): string {
  const o = berlin(ms);
  return `${z2(o.tag)}.${z2(o.monat)}.${o.jahr} ${z2(o.stunde)}:${z2(o.minute)}`;
}

/** „12.03.2026“ in deutscher Zeit. */
export function deutschTag(ms: number): string {
  const o = berlin(ms);
  return `${z2(o.tag)}.${z2(o.monat)}.${o.jahr}`;
}

/** „2026-03-12T14:32“ in deutscher Zeit, wie im QR-Code. */
export function berlinMinute(ms: number): string {
  const o = berlin(ms);
  return `${o.jahr}-${z2(o.monat)}-${z2(o.tag)}T${z2(o.stunde)}:${z2(o.minute)}`;
}

/** Zeitpunkt (UTC-Millisekunden) des Beginns eines Kalendertags in deutscher Zeit. */
export function berlinTagesbeginn(tag: string): number | null {
  const m = TAG.exec(tag);
  if (!m) return null;
  const mitternachtUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const winter = mitternachtUtc - 60 * 60000;
  return berlinVersatzMinuten(winter) === 60 ? winter : mitternachtUtc - 120 * 60000;
}

/** Ende eines Kalendertags in deutscher Zeit (Beginn des Folgetags). */
export function berlinTagesende(tag: string): number | null {
  const m = TAG.exec(tag);
  if (!m) return null;
  const folgetag = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10);
  return berlinTagesbeginn(folgetag);
}

/** Zeitpunkt im ISO-Format von WATT: Sekunden immer, Millisekunden nur, wenn nicht null. */
export function isoWatt(ms: number): string {
  const s = new Date(ms).toISOString();
  return s.endsWith(".000Z") ? s.slice(0, 19) + "Z" : s;
}
