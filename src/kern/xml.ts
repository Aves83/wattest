// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Kleiner XML-Leser für die XML-Darstellung von watt-daten und ihre Abbildung auf das JSON
// (Datenformat, Abschnitt „XML-Darstellung“). Ohne DTD, also ohne externe Entitäten und ohne Entitäts-Expansion;
// Verschachtelungstiefe und Attribute je Element begrenzt (GRENZWERTE).

import { GRENZWERTE } from "./grenzen.js";
import { XML_TYPEN } from "./xml-typen.js";

export class XmlFehler extends Error {}

export interface XmlElement {
  name: string;
  attribute: Record<string, string>;
  kinder: XmlElement[];
  text: string;
}

const ENTITAETEN: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function entschluessle(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (ganz, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!(n >= 1 && n <= 0x10ffff) || (n >= 0xd800 && n <= 0xdfff)) throw new XmlFehler(`Zeichenreferenz ${ganz} ist kein erlaubtes Zeichen`);
      return String.fromCodePoint(n);
    }
    const w = ENTITAETEN[e];
    if (w === undefined) throw new XmlFehler(`Unbekannte Entität ${ganz}`);
    return w;
  });
}

/** Liest ein XML-Dokument ohne DTD; Zeilenenden werden wie in XML 1.0 zu LF. */
export function leseXml(quelle: string): XmlElement {
  const s = quelle.replace(/\r\n?/g, "\n");
  let i = 0;
  const stapel: XmlElement[] = [];
  let wurzel: XmlElement | null = null;
  const fehler = (text: string): never => {
    let zeile = 1;
    for (let j = s.indexOf("\n"); j >= 0 && j < i; j = s.indexOf("\n", j + 1)) zeile++;
    throw new XmlFehler(`${text} (Zeile ${zeile})`);
  };
  if (s.charCodeAt(0) === 0xfeff) i = 1;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) {
      if (s.slice(i).trim() !== "") fehler("Text außerhalb des Wurzelelements");
      break;
    }
    if (lt > i) {
      const text = s.slice(i, lt);
      const oben = stapel[stapel.length - 1];
      if (oben) oben.text += entschluessle(text);
      else if (text.trim() !== "") fehler("Text außerhalb des Wurzelelements");
    }
    i = lt;
    if (s.startsWith("<?", i)) {
      const e = s.indexOf("?>", i);
      if (e < 0) fehler("Verarbeitungsanweisung nicht geschlossen");
      i = e + 2;
    } else if (s.startsWith("<!--", i)) {
      const e = s.indexOf("-->", i);
      if (e < 0) fehler("Kommentar nicht geschlossen");
      i = e + 3;
    } else if (s.startsWith("<![CDATA[", i)) {
      const e = s.indexOf("]]>", i);
      if (e < 0) fehler("CDATA nicht geschlossen");
      const oben = stapel[stapel.length - 1];
      if (!oben) fehler("CDATA außerhalb des Wurzelelements");
      oben!.text += s.slice(i + 9, e);
      i = e + 3;
    } else if (s.startsWith("<!", i)) {
      fehler("DTD und Entitäten werden nicht unterstützt (keine externen Entitäten, keine Entitäts-Expansion)");
    } else if (s.startsWith("</", i)) {
      const e = s.indexOf(">", i);
      if (e < 0) fehler("Endtag nicht geschlossen");
      const name = s.slice(i + 2, e).trim();
      const oben = stapel.pop();
      if (!oben || oben.name !== name) fehler(`Endtag </${name}> passt nicht`);
      i = e + 1;
    } else {
      const e = s.indexOf(">", i);
      if (e < 0) fehler("Tag nicht geschlossen");
      let inhalt = s.slice(i + 1, e);
      const leer = inhalt.endsWith("/");
      if (leer) inhalt = inhalt.slice(0, -1);
      const m = /^([^\s/>]+)\s*([\s\S]*)$/.exec(inhalt);
      if (!m) fehler("Tag ohne Namen");
      const el: XmlElement = { name: m![1]!, attribute: {}, kinder: [], text: "" };
      const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      let attribute = 0;
      while ((a = attrRe.exec(m![2]!))) {
        if (++attribute > GRENZWERTE.xmlAttribute) fehler(`Element <${el.name}> hat mehr Attribute als die Grenze von ${GRENZWERTE.xmlAttribute}`);
        if (Object.prototype.hasOwnProperty.call(el.attribute, a[1]!)) fehler(`Attribut ${a[1]} steht doppelt in <${el.name}>`);
        setze(el.attribute, a[1]!, entschluessle(a[3] ?? a[4] ?? ""));
      }
      const oben = stapel[stapel.length - 1];
      if (oben) oben.kinder.push(el);
      else if (wurzel) fehler("Mehr als ein Wurzelelement");
      else wurzel = el;
      if (!leer) {
        if (stapel.length >= GRENZWERTE.xmlTiefe) fehler(`Verschachtelung tiefer als die Grenze von ${GRENZWERTE.xmlTiefe} Ebenen`);
        stapel.push(el);
      }
      i = e + 1;
    }
  }
  if (stapel.length) fehler(`Element <${stapel[stapel.length - 1]!.name}> nicht geschlossen`);
  if (!wurzel) throw new XmlFehler("Kein Wurzelelement");
  return wurzel;
}

/** Eigenes Feld wie bei JSON.parse, auch für Namen wie __proto__. */
function setze<T>(o: Record<string, T>, k: string, w: T): void {
  Object.defineProperty(o, k, { value: w, enumerable: true, writable: true, configurable: true });
}

function istNil(el: XmlElement): boolean {
  for (const [k, v] of Object.entries(el.attribute)) if ((k === "xsi:nil" || k.endsWith(":nil")) && v === "true") return true;
  return false;
}

interface Abbildung {
  unbekannt: string[];
  /** Zahlen außerhalb des genau darstellbaren Bereichs */
  unsicher: string[];
}

function wert(el: XmlElement, typ: string | undefined, ab: Abbildung, pfad: string): unknown {
  if (istNil(el)) return null;
  if (el.name === "antworten") {
    const o: Record<string, unknown> = {};
    for (const k of el.kinder) setze(o, k.attribute["schluessel"] ?? "", zahl(k.text, ab, `${pfad}/${k.name}`));
    return o;
  }
  const t = typ ? XML_TYPEN[typ] : undefined;
  if (t && "liste" in t) {
    return el.kinder.map((k, i) => {
      if (k.name !== t.liste) ab.unbekannt.push(`${pfad}/${k.name}`);
      return wert(k, t.von, ab, `${pfad}[${i}]`);
    });
  }
  if (t && "felder" in t) {
    const o: Record<string, unknown> = {};
    for (const k of el.kinder) {
      const kt = Object.prototype.hasOwnProperty.call(t.felder, k.name) ? t.felder[k.name] : undefined;
      if (kt === undefined) ab.unbekannt.push(`${pfad}/${k.name}`);
      setze(o, k.name, wert(k, kt, ab, `${pfad}/${k.name}`));
    }
    return o;
  }
  if (el.kinder.length) {
    ab.unbekannt.push(pfad);
    const o: Record<string, unknown> = {};
    for (const k of el.kinder) setze(o, k.name, wert(k, undefined, ab, `${pfad}/${k.name}`));
    return o;
  }
  if (typ === "zahl") return zahl(el.text, ab, pfad);
  if (typ === "bool") return el.text === "true" ? true : el.text === "false" ? false : el.text;
  return el.text;
}

function zahl(text: string, ab: Abbildung, pfad: string): unknown {
  const t = text.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return text;
  const n = Number(t);
  if (Math.abs(n) > Number.MAX_SAFE_INTEGER) ab.unsicher.push(`${pfad} = ${t.slice(0, 40)}`);
  return n;
}

/** Bildet das XML von watt-daten auf das JSON ab; unbekannte Elemente stehen in `unbekannt`. */
export function xmlZuJson(wurzel: XmlElement): { daten: Record<string, unknown>; unbekannt: string[]; unsicher: string[] } {
  if (wurzel.name !== "wattDaten") throw new XmlFehler(`Wurzelelement ist <${wurzel.name}>, nicht <wattDaten>`);
  const ab: Abbildung = { unbekannt: [], unsicher: [] };
  const daten = wert(wurzel, "WattDaten", ab, "wattDaten") as Record<string, unknown>;
  return { daten, unbekannt: ab.unbekannt, unsicher: ab.unsicher };
}
