// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Kanonische Formen nach der Technischen Erläuterung von WATT (4.2, 4.6, 5.1).

import { utf8Laenge } from "./bytes.js";
import { isoWatt, zeitpunktMs } from "./zeit.js";

/** Ein Feld als <Länge in UTF-8-Bytes>:<Wert> (4.2); null und undefined ergeben 0:. */
export function feld(wert: unknown): string {
  const text = wert === null || wert === undefined ? "" : String(wert);
  return `${utf8Laenge(text)}:${text}`;
}

export function felder(werte: unknown[]): string {
  let s = "";
  for (const w of werte) s += feld(w);
  return s;
}

export interface GliedRoh {
  seq: unknown;
  zeitpunkt: unknown;
  aktion: unknown;
  objektArt: unknown;
  objektId: unknown;
  daten: unknown;
  prev: unknown;
  hash?: unknown;
  neustarts?: unknown;
  autoZeit?: unknown;
}

export type Gliedform = "sieben" | "neun" | "bruch";

/** Form des Glieds nach 4.2: sieben Felder, neun Felder mit Uhrstand oder Bruch (nur eines der beiden). */
export function gliedform(g: GliedRoh): Gliedform {
  const n = g.neustarts !== undefined;
  const a = g.autoZeit !== undefined;
  if (n && a) return "neun";
  if (!n && !a) return "sieben";
  return "bruch";
}

/** Eingabe der Prüfsumme eines Glieds der Arbeitszeitkette (4.2). */
export function gliedEingabe(g: GliedRoh): string {
  const basis = felder([g.seq, g.zeitpunkt, g.aktion, g.objektArt, g.objektId, g.daten, g.prev]);
  if (gliedform(g) === "neun") return basis + felder([g.neustarts, g.autoZeit]);
  return basis;
}

export interface NachweisgliedRoh {
  seq: unknown;
  zeitpunkt: unknown;
  ereignis: unknown;
  referenzId: unknown;
  pruefsumme: unknown;
  prev: unknown;
  hash?: unknown;
}

/** Eingabe der Prüfsumme eines Glieds der Nachweiskette (5.1). */
export function nachweisgliedEingabe(g: NachweisgliedRoh): string {
  return felder([g.seq, g.zeitpunkt, g.ereignis, g.referenzId, g.pruefsumme, g.prev]);
}

/** Zeitpunkt in der Darstellung von 4.2; unlesbare Werte bleiben unverändert. */
export function zeitpunktKanonisch(wert: unknown): unknown {
  const ms = zeitpunktMs(wert);
  return ms === null ? wert : isoWatt(ms);
}

export interface DokumentFeld {
  art: unknown;
  dateiname: unknown;
  sha256: string;
}

export interface AnzeigeRoh {
  id?: unknown;
  stufe?: unknown;
  zeitraumVon?: unknown;
  zeitraumBis?: unknown;
  angabenArt?: unknown;
  angabenEntfernt?: unknown;
  empfaenger?: unknown;
  kopien?: { stelle?: unknown; email?: unknown }[];
  betreff?: unknown;
  anschreiben?: unknown;
  datum?: unknown;
  gesendetAn?: unknown;
  gesendetAm?: unknown;
  notizen?: { id?: unknown; text?: unknown; erstelltAm?: unknown; fest?: unknown; nachVersand?: unknown }[];
  kettenkopf?: { anzahl?: unknown; hash?: unknown; zeitpunkt?: unknown } | null;
  pruefverfahren?: unknown;
}

/**
 * Eingabe der Inhaltsprüfsumme einer Anzeige (5.1, Verfahren 1 und 2).
 * Notizen: nur die mit fest true, sortiert nach erstelltAm und Kennung.
 */
export function anzeigeEingabe(a: AnzeigeRoh, dokumente: DokumentFeld[]): string {
  const verfahren = a.pruefverfahren === 2 || a.pruefverfahren === "2" ? 2 : 1;
  const werte: unknown[] = [];
  if (verfahren === 2) werte.push(2);
  werte.push(a.id, a.stufe, a.zeitraumVon, a.zeitraumBis, a.angabenArt, a.angabenEntfernt, a.empfaenger);
  const kopien = a.kopien ?? [];
  if (verfahren === 2) {
    werte.push(kopien.length);
    for (const k of kopien) werte.push(k.stelle, k.email);
  } else {
    werte.push(kopien.map((k) => `${String(k.stelle ?? "")}=${String(k.email ?? "")}`).join("\n"));
  }
  werte.push(a.betreff, a.anschreiben, a.datum, a.gesendetAn, zeitpunktKanonisch(a.gesendetAm));
  werte.push(dokumente.length);
  for (const d of dokumente) werte.push(d.art, d.dateiname, d.sha256);
  const notizen = (a.notizen ?? [])
    .filter((n) => n.fest === true || n.fest === "true")
    .map((n, i) => ({ n, i, ms: zeitpunktMs(n.erstelltAm) ?? 0, id: Number(n.id) }))
    .sort((x, y) => x.ms - y.ms || (Number.isFinite(x.id) && Number.isFinite(y.id) ? x.id - y.id : 0) || x.i - y.i)
    .map((x) => x.n);
  werte.push(notizen.length);
  for (const n of notizen) werte.push(zeitpunktKanonisch(n.erstelltAm), n.text);
  if (verfahren === 2) {
    const k = a.kettenkopf;
    if (k) werte.push(k.anzahl, k.hash, zeitpunktKanonisch(k.zeitpunkt));
    else werte.push("", "", "");
  }
  return felder(werte);
}

export interface GespraechRoh {
  id?: unknown;
  art?: unknown;
  zeitpunkt?: unknown;
  dauerMinuten?: unknown;
  partner?: unknown;
  anwesende?: unknown;
  anlass?: unknown;
  inhalt?: unknown;
  zusagen?: unknown;
  frist?: unknown;
  erfasstAm?: unknown;
}

/** Eingabe der Inhaltsprüfsumme einer Gesprächsnotiz (5.1). */
export function gespraechEingabe(g: GespraechRoh): string {
  return felder([
    g.id,
    g.art,
    zeitpunktKanonisch(g.zeitpunkt),
    g.dauerMinuten,
    g.partner,
    g.anwesende,
    g.anlass,
    g.inhalt,
    g.zusagen,
    g.frist,
    zeitpunktKanonisch(g.erfasstAm),
  ]);
}

/** Eingabe der Inhaltsprüfsumme eines Nachtrags zu einer Gesprächsnotiz (5.1). */
export function nachtragEingabe(n: { id?: unknown; text?: unknown; erfasstAm?: unknown }, notizId: unknown): string {
  return felder([n.id, notizId, n.text, zeitpunktKanonisch(n.erfasstAm)]);
}

function jsonText(wert: unknown): string {
  return wert === undefined ? "null" : JSON.stringify(wert);
}

/** Kanonische Form eines Eintrags für die Bestandsprüfsumme (4.6). */
export function bestandEintragEingabe(e: Record<string, unknown>): string {
  const z = (w: unknown): unknown => (w === null || w === undefined ? null : zeitpunktKanonisch(w));
  const teile: [string, unknown][] = [
    ["id", e.id ?? null],
    ["tag", e.tag ?? null],
    ["kategorieId", e.kategorieId ?? null],
    ["unterkategorieId", e.unterkategorieId ?? null],
    ["beginn", z(e.beginn)],
    ["ende", z(e.ende)],
    ["dauerMinuten", e.dauerMinuten ?? null],
    ["notiz", e.notiz ?? null],
    ["quelle", e.quelle ?? null],
    ["planRef", e.planRef ?? null],
    ["erfasstAm", z(e.erfasstAm)],
    ["geaendertAm", z(e.geaendertAm)],
    ["fach", e.fach ?? ""],
    ["klasse", e.klasse ?? ""],
  ];
  return "{" + teile.map(([k, v]) => `${JSON.stringify(k)}:${jsonText(v)}`).join(",") + "}";
}

/** Kanonische Form einer Abwesenheit für die Bestandsprüfsumme (4.6). */
export function bestandAbwesenheitEingabe(a: Record<string, unknown>): string {
  const z = (w: unknown): unknown => (w === null || w === undefined ? null : zeitpunktKanonisch(w));
  const teile: [string, unknown][] = [
    ["tag", a.tag ?? null],
    ["art", a.art ?? null],
    ["beginn", z(a.beginn)],
    ["ende", z(a.ende)],
  ];
  return "{" + teile.map(([k, v]) => `${JSON.stringify(k)}:${jsonText(v)}`).join(",") + "}";
}

/**
 * Eingabe der Prüfsumme des Datenbestands beim Neubeginn (4.6): der Klartext ohne Protokoll,
 * ohne Schlüssel und Signaturen, mit exportiertAm 1970-01-01T00:00:00Z und leerer appVersion,
 * vier Leerzeichen Einzug, LF, ohne Zeilenumbruch am Ende.
 */
export function bestandDatenEingabe(datei: Record<string, unknown>): string {
  const kopie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datei)) {
    if (k === "kettenschluessel" || k === "kettensignaturen") continue;
    if (k === "exportiertAm") kopie[k] = "1970-01-01T00:00:00Z";
    else if (k === "appVersion") kopie[k] = "";
    else if (k === "protokoll") kopie[k] = [];
    else kopie[k] = v;
  }
  return JSON.stringify(kopie, null, 4);
}
