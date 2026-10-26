// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Ablauf der Prüfung: Eingaben erkennen, P1 Format, dann P2 bis P9 je Klartext und P8 für Aktenauszüge.

import { anzahl, gesamt, gesamtText, zahl, type Aussage, type Befund, type GeprueftDatei, type Schritt } from "./befund.js";
import { textAus } from "./bytes.js";
import { GRENZE_HAERTUNG, GRENZWERTE, grenzeText } from "./grenzen.js";
import { leseJson } from "./json.js";
import { glieder, objekt, type Klartext } from "./klartext.js";
import { Abbruch, dateiFundstelle, sage, type Kontext, type Optionen } from "./kontext.js";
import { bekannteVersion, pruefeSchema } from "./schema.js";
import { SCHEMA_VORABFASSUNG } from "./schema-auszug.js";
import { pruefeAnker } from "./schritte-anker.js";
import { pruefeDaten } from "./schritte-daten.js";
import { pruefeBesondere, pruefeKette, pruefeZeit } from "./schritte-kette.js";
import { pruefeAktenauszug, pruefeNachweise, type AktenDatei, type Aktenauszug, type Dokumentbindung } from "./schritte-nachweis.js";
import { pruefeSignaturen } from "./schritte-signatur.js";
import { sha256Hex } from "./sha.js";
import { leseXml, xmlZuJson } from "./xml.js";
import { istZip, leseZip, ZipFehler } from "./zip.js";
import { isoWatt } from "./zeit.js";

export interface Eingabedatei {
  name: string;
  bytes: Uint8Array;
  /** Größe laut Dateisystem, wenn die Seite die Datei wegen ihrer Größe nicht gelesen hat */
  groesse?: number;
}

export interface Programminfo {
  version: string;
  commit: string;
}

type Erkannt =
  | { art: "klartext"; kt: Klartext }
  | { art: "aktenauszug"; az: Aktenauszug }
  | { art: "hinweis"; text: string; begruendung: string; grenze?: string };

const REIHENFOLGE: Schritt[] = ["E", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"];

interface Gelesen {
  daten: Record<string, unknown>;
  quelle: "json" | "xml";
  xmlUnbekannt: string[];
  unsicher: string[];
}

function leseText(name: string, text: string): Gelesen | { fehler: string; grenze?: string } {
  const t = text.replace(/^﻿/, "").trimStart();
  if (t.startsWith("{")) {
    try {
      const { wert, unsicher } = leseJson(t);
      if (!objekt(wert)) return { fehler: `„${name}“ ist kein JSON-Objekt.` };
      return { daten: wert as Record<string, unknown>, quelle: "json", xmlUnbekannt: [], unsicher };
    } catch (e) {
      const grenze = /Grenze/.test((e as Error).message) ? GRENZE_HAERTUNG : undefined;
      return { fehler: `„${name}“ ist kein lesbares JSON (${(e as Error).message}).`, ...(grenze ? { grenze } : {}) };
    }
  }
  if (t.startsWith("<")) {
    try {
      const { daten, unbekannt, unsicher } = xmlZuJson(leseXml(t));
      return { daten, quelle: "xml", xmlUnbekannt: unbekannt, unsicher };
    } catch (e) {
      const grenze = /Grenze|DTD/.test((e as Error).message) ? GRENZE_HAERTUNG : undefined;
      return { fehler: `„${name}“ ist kein lesbares XML von WATT (${(e as Error).message}).`, ...(grenze ? { grenze } : {}) };
    }
  }
  return { fehler: `„${name}“ ist weder JSON noch XML.` };
}

function alsKlartext(name: string, inhalt: Gelesen, anhaenge: Klartext["anhaenge"]): Erkannt {
  const d = inhalt.daten;
  if (d["format"] !== "watt-daten") {
    return { art: "hinweis", text: `„${name}“ ist keine Datei im Datenformat von WATT.`, begruendung: `Das Feld format ist ${JSON.stringify(d["format"] ?? null)?.slice(0, 80)}, nicht „watt-daten“.` };
  }
  if (d["umfang"] === "BUCHUNGEN") {
    return {
      art: "hinweis",
      text: `„${name}“ enthält nur Buchungsdaten; sie sind nicht prüfbar.`,
      begruendung: "Buchungsdaten (umfang BUCHUNGEN, Export im Überblick) enthalten nur Einträge, Abwesenheiten, Tagesmarkierungen und Ferien eines Zeitraums, aber keine Arbeitszeitkette und keine Nachweise (Datenformat, Abschnitt „Buchungsdaten“). Ohne Kette gibt es nichts nachzurechnen. Für eine Prüfung braucht es den vollständigen Klartext-Export.",
    };
  }
  const protokoll = d["protokoll"];
  if (Array.isArray(protokoll) && protokoll.length > GRENZWERTE.glieder) {
    return {
      art: "hinweis",
      text: `„${name}“ hat mehr Glieder, als WATTest prüft.`,
      begruendung: `Die Arbeitszeitkette hat ${zahl(protokoll.length)} Glieder, mehr als die Grenze von ${grenzeText(GRENZWERTE.glieder)}. WATTest prüft sie nicht, damit die Seite nicht hängt; das ist kein Befund über die Datei.`,
      grenze: GRENZE_HAERTUNG,
    };
  }
  const version = typeof d["version"] === "number" ? (d["version"] as number) : null;
  const unsicher = [...inhalt.unsicher];
  const gl = glieder(d, unsicher);
  return { art: "klartext", kt: { name, quelle: inhalt.quelle, daten: d, version, xmlUnbekannt: inhalt.xmlUnbekannt, unsicher, anhaenge, glieder: gl } };
}

async function erkenne(datei: Eingabedatei): Promise<Erkannt> {
  const b = datei.bytes;
  const groesse = Math.max(b.length, datei.groesse ?? 0);
  if (groesse > GRENZWERTE.dateiBytes) {
    return {
      art: "hinweis",
      text: `„${datei.name}“ ist größer, als WATTest prüft.`,
      begruendung: `Die Datei ist ${grenzeText(groesse, "bytes")} groß, mehr als die Grenze von ${grenzeText(GRENZWERTE.dateiBytes, "bytes")}. WATTest liest sie nicht, damit der Browser nicht hängt; das ist kein Befund über die Datei.`,
      grenze: GRENZE_HAERTUNG,
    };
  }
  let kopf = "";
  for (const x of b.subarray(0, 8)) kopf += String.fromCharCode(x);
  if (kopf === "WATTBKUP") {
    return {
      art: "hinweis",
      text: `„${datei.name}“ ist eine verschlüsselte Sicherung von WATT; sie ist nicht prüfbar.`,
      begruendung: "Eine Sicherung (.wattbak) ist mit AES-GCM verschlüsselt und lässt sich nur mit der Passphrase oder dem Notfallblatt der Lehrkraft öffnen (Technische Erläuterung 3., Datenformat „Verschlüsselte Sicherung“). WATTest fragt nicht danach. Bitte die Lehrkraft um einen vollständigen Klartext-Export (JSON oder XML).",
    };
  }
  if (istZip(b)) {
    let eintraege;
    try {
      eintraege = leseZip(b).filter((e) => !e.istOrdner);
    } catch (e) {
      if (!(e instanceof ZipFehler)) throw e;
      return { art: "hinweis", text: `„${datei.name}“ ist ein ZIP, das WATTest nicht liest.`, begruendung: `${e.message} WATTest weist solche ZIP-Dateien ab, statt sie zu entpacken; das ist kein Befund über den Inhalt.`, grenze: GRENZE_HAERTUNG };
    }
    try {
      // Die flachste SHA256SUMS.txt gilt; ein Dokument gleichen Namens in einem Ordner Eintrag_NN ist keine Liste.
      const summen = eintraege.filter((e) => /(^|\/)SHA256SUMS\.txt$/.test(e.pfad)).sort((a, b) => a.pfad.split("/").length - b.pfad.split("/").length)[0];
      if (summen) {
        // Reihenfolge, Änderungszeit und die Bytes von PRUEFEN.txt und SHA256SUMS.txt braucht die Prüfung des Aufbaus (6.3).
        const dateien: AktenDatei[] = [];
        for (const e of eintraege) {
          const inhalt = await e.lesen();
          dateien.push({ pfad: e.pfad, groesse: e.groesse, sha256: await sha256Hex(inhalt), zeit: e.zeit, ...(/(^|\/)(PRUEFEN|SHA256SUMS)\.txt$/.test(e.pfad) ? { roh: inhalt } : {}) });
        }
        return { art: "aktenauszug", az: { name: datei.name, dateien, summenPfad: summen.pfad, summenText: textAus(await summen.lesen(), false) } };
      }
      const haupt = eintraege.filter((e) => !/(^|\/)anhaenge\//.test(e.pfad) && /\.(json|xml)$/i.test(e.pfad));
      if (haupt.length === 1) {
        const anhaenge = eintraege.filter((e) => /(^|\/)anhaenge\//.test(e.pfad)).map((e) => ({ pfad: e.pfad, groesse: e.groesse }));
        const inhalt = leseText(`${datei.name}/${haupt[0]!.pfad}`, textAus(await haupt[0]!.lesen(), false));
        if ("fehler" in inhalt) return { art: "hinweis", text: inhalt.fehler, begruendung: "Die Datei im ZIP lässt sich nicht lesen.", ...(inhalt.grenze ? { grenze: inhalt.grenze } : {}) };
        return alsKlartext(datei.name, inhalt, anhaenge);
      }
    } catch (e) {
      if (!(e instanceof ZipFehler)) throw e;
      return { art: "hinweis", text: `„${datei.name}“ ließ sich nicht entpacken.`, begruendung: `${e.message} Ein Lesefehler ist kein Befund über den Inhalt.`, grenze: GRENZE_HAERTUNG };
    }
    return {
      art: "hinweis",
      text: `„${datei.name}“ ist ein ZIP, das WATTest nicht zuordnen kann.`,
      begruendung: "WATTest kennt ZIP-Dateien mit genau einem Klartext-Export (JSON oder XML) und dem Ordner anhaenge/ sowie Aktenauszüge mit SHA256SUMS.txt.",
    };
  }
  let text: string;
  try {
    text = textAus(b, true);
  } catch {
    return { art: "hinweis", text: `„${datei.name}“ ist keine Textdatei in UTF-8.`, begruendung: "Klartext-Exporte von WATT sind JSON oder XML in UTF-8." };
  }
  const inhalt = leseText(datei.name, text);
  if ("fehler" in inhalt) return { art: "hinweis", text: inhalt.fehler, begruendung: "Klartext-Exporte von WATT sind JSON oder XML in UTF-8.", ...(inhalt.grenze ? { grenze: inhalt.grenze } : {}) };
  return alsKlartext(datei.name, inhalt, null);
}

function pruefeFormat(k: Kontext): void {
  const kt = k.kt;
  const d = kt.daten;
  const v = kt.version;
  const fund = dateiFundstelle(k);
  const grenze = "WATTest prüft nicht das ganze Schema, sondern Pflichtfelder und Typen der Teile, die es liest: Arbeitszeitkette, Einträge, Abwesenheiten, Nachweise, Schlüssel und Signaturen. Andere Teile prüft es nur auf ihre Grundform.";
  if (!bekannteVersion(v)) {
    sage(k, "P1", "offen", `WATTest kennt das Datenformat ${String(v)} nicht.`, `WATTest 0.1 kennt die Formatversionen 16 bis 19. ${typeof v === "number" && v < 16 ? "Dateien vor Version 16 lassen sich nach 7. nicht abgleichen." : "Eine neuere Version braucht eine neuere Fassung von WATTest."} Die folgenden Schritte rechnen trotzdem nach den bekannten Regeln.`, { fundstelle: fund, grenze });
    return;
  }
  // Die README in schema/ von watt_public führt die Version als Vorabfassung (U-19).
  if (SCHEMA_VORABFASSUNG.includes(v)) {
    sage(k, "P1", "hinweis", `Das Schema der Formatversion ${v} ist eine Vorabfassung.`, `Die Schemas der Version ${v} (watt-daten-${v}.schema.json und watt-daten-${v}.xsd) sind als Vorabfassung veröffentlicht: Noch keine ausgelieferte Fassung von WATT schreibt diese Version, und sie kann sich bis dahin ändern (Datenformat, README der Schemas). WATTest prüft gegen diesen Stand.`, { fundstelle: fund, grenze });
  }
  // TE 8., Schritt 1: Ausgelieferte Fassungen exportieren XML ab Formatversion 18.
  const xmlVor18 = kt.quelle === "xml" && v < 18;
  if (xmlVor18) {
    sage(k, "P1", "offen", "WATT exportiert XML erst ab Formatversion 18.", `Die Datei ist XML im Datenformat ${v}. Ausgelieferte Fassungen von WATT exportieren XML ab Formatversion 18 (WATT 0.8.109 „Cherimoya“); ein XML Schema ist erst ab Version 18 veröffentlicht (Technische Erläuterung 8., Schritt 1; Datenformat, XML-Darstellung). Die übrigen Schritte rechnen trotzdem nach den bekannten Regeln.`, { fundstelle: fund, grenze });
  }
  const fehler = pruefeSchema(d, v);
  const harte = fehler.filter((f) => f.art === "fehlt" || f.art === "typ");
  const grenzen = fehler.filter((f) => f.art === "grenze");
  const unbekannt = fehler.filter((f) => f.art === "unbekannt");
  const schema = kt.quelle === "json" ? `watt-daten-${v}.schema.json` : `watt-daten-${v}.xsd (über die Abbildung auf das JSON und watt-daten-${v}.schema.json)`;
  if (harte.length) {
    sage(k, "P1", "widerlegt", `Die Datei entspricht nicht dem Datenformat ${v}.`, `${anzahl(harte.length, "Feld fehlt oder hat", "Felder fehlen oder haben")} einen falschen Typ gegenüber ${schema}. WATT schreibt alle Felder, auch leere; eine solche Datei ist nicht so von WATT exportiert.`, {
      fundstelle: fund,
      grenze,
      details: harte.slice(0, 100).map((f) => ({ text: f.text })),
    });
  } else if (!xmlVor18) {
    const exp = typeof d["exportiertAm"] === "string" ? d["exportiertAm"] : "?";
    sage(k, "P1", "bestaetigt", `Die Datei ist ein vollständiger Klartext-Export im Datenformat ${v}${kt.quelle === "xml" ? " (XML)" : ""}.`, `format watt-daten, version ${v}, exportiert am ${exp} aus WATT ${String(d["appVersion"] ?? "")}. Pflichtfelder und Typen der gelesenen Teile entsprechen ${schema}.`, { fundstelle: fund, grenze });
  }
  if (grenzen.length) {
    sage(k, "P1", "offen", "Die Datei hält Grenzen des Datenformats nicht ein.", `Das Schema ${schema} begrenzt die Zahl der Schlüssel (256) und der Zertifikate je Schlüssel (8) und verlangt für Zertifikate und Signaturen Base64 ohne Fremdzeichen (keine Zeilenumbrüche). WATT spielt eine solche Datei nicht ein (Datenformat, kettenschluessel und kettensignaturen). WATTest prüft Schlüssel über den Grenzen nicht (P6, P7); eine überschrittene Grenze ist kein Befund über die Herkunft.`, {
      fundstelle: fund,
      grenze: GRENZE_HAERTUNG,
      details: grenzen.slice(0, 100).map((f) => ({ text: f.text })),
    });
  }
  if (unbekannt.length || kt.xmlUnbekannt.length) {
    sage(k, "P1", "offen", "Die Datei enthält Felder, die das Datenformat nicht kennt.", "Das Schema der Version erlaubt keine weiteren Felder. WATTest übergeht sie; ob sie eine Bedeutung haben, lässt sich nicht sagen.", {
      fundstelle: fund,
      grenze,
      details: [...unbekannt.map((f) => f.text), ...kt.xmlUnbekannt.map((p) => `unbekanntes Element ${p}`)].slice(0, 100).map((text) => ({ text })),
    });
  }
  if (kt.unsicher.length) {
    sage(k, "P1", "offen", "Die Datei enthält Zahlen, die WATTest nicht genau lesen kann.", `Ganze Zahlen über 9.007.199.254.740.991 (Number.MAX_SAFE_INTEGER) lassen sich im Browser nicht genau darstellen. WATTest rundet sie nicht still, sondern nennt sie hier; Prüfschritte, die diese Werte brauchen (etwa seq in P2 oder Signaturen in P6), sagen über diese Stellen nichts.`, {
      fundstelle: fund,
      grenze: GRENZE_HAERTUNG,
      details: kt.unsicher.map((text) => ({ text })),
    });
  }
  const app = String(d["appVersion"] ?? "");
  if (/-debug/.test(app)) {
    sage(k, "P1", "offen", "Die Datei stammt aus der Debug-Variante von WATT.", `appVersion ist ${app}. In der Debug-Variante lassen sich beide Ketten über das Debug-Menü löschen und Beispieldaten anlegen (Technische Erläuterung, Abschnitt 9).`, { fundstelle: fund });
  }
}

/** Führt die ganze Prüfung aus. */
export async function pruefe(dateien: Eingabedatei[], optionen: Optionen, info: Programminfo): Promise<Befund> {
  const melde = (anteil: number, text: string): void => {
    if (optionen.abgebrochen?.()) throw new Abbruch("Die Prüfung wurde abgebrochen.");
    optionen.fortschritt?.(anteil, text);
  };
  const aussagen: Aussage[] = [];
  const geprueft: GeprueftDatei[] = [];
  const klartexte: Klartext[] = [];
  const auszuege: Aktenauszug[] = [];
  const e = { aussagen };
  melde(0, "Dateien werden gelesen");
  for (const d of dateien) {
    melde(0, `Datei „${d.name}“ wird gelesen`);
    const zuGross = Math.max(d.bytes.length, d.groesse ?? 0) > GRENZWERTE.dateiBytes;
    const sha = zuGross ? "" : await sha256Hex(d.bytes);
    let art = "unbekannt";
    try {
      const r = await erkenne(d);
      if (r.art === "klartext") {
        klartexte.push(r.kt);
        art = `Klartext-Export ${r.kt.quelle.toUpperCase()}${r.kt.anhaenge ? " im ZIP" : ""}, Datenformat ${String(r.kt.version)}`;
      } else if (r.art === "aktenauszug") {
        auszuege.push(r.az);
        art = "Aktenauszug (ZIP)";
      } else {
        sage({ aussagen, datei: d.name }, "E", "offen", r.text, r.begruendung, { fundstelle: `Datei „${d.name}“`, ...(r.grenze ? { grenze: r.grenze } : {}) });
        art = "nicht prüfbar";
      }
    } catch (err) {
      if (err instanceof Abbruch) throw err;
      sage({ aussagen, datei: d.name }, "E", "offen", `„${d.name}“ ließ sich nicht lesen.`, `Beim Lesen trat ein Fehler auf: ${(err as Error).message}. Ein Lesefehler ist kein Befund über den Inhalt.`, { fundstelle: `Datei „${d.name}“` });
    }
    geprueft.push({ name: d.name, groesse: Math.max(d.bytes.length, d.groesse ?? 0), sha256: sha, art });
  }
  if (!dateien.length) sage(e, "E", "offen", "Es ist keine Datei geladen.", "WATTest prüft Klartext-Exporte (JSON, XML, ZIP) und Aktenauszüge von WATT.");
  if (!klartexte.length && optionen.anker.length) {
    sage(e, "E", "offen", `${anzahl(optionen.anker.length, "Anker lässt", "Anker lassen")} sich ohne Klartext-Export nicht prüfen.`, "Ein Anker wird gegen die Arbeitszeitkette eines Klartext-Exports geprüft (6.1).");
  }

  const bindungen: { name: string; bindung: Dokumentbindung }[] = [];
  for (let n = 0; n < klartexte.length; n++) {
    const kt = klartexte[n]!;
    const k: Kontext = {
      kt,
      optionen,
      aussagen: [],
      berechnet: [],
      ersterBruch: null,
      signaturen: new Map(),
      melde: (anteil, text) => melde((n + anteil) / klartexte.length, klartexte.length > 1 ? `${kt.name}: ${text}` : text),
    };
    const schritt = async (s: Schritt, f: () => void | Promise<void>): Promise<void> => {
      try {
        await f();
      } catch (err) {
        if (err instanceof Abbruch) throw err;
        sage(k, s, "offen", `Schritt ${s} ließ sich nicht vollständig ausführen.`, `Bei der Prüfung trat ein Fehler auf: ${(err as Error).message}. Ein Prüffehler ist kein Befund über die Datei.`, { fundstelle: dateiFundstelle(k) });
      }
    };
    await schritt("P1", () => pruefeFormat(k));
    await schritt("P2", () => pruefeKette(k));
    await schritt("P3", () => pruefeDaten(k));
    await schritt("P4", () => pruefeZeit(k));
    await schritt("P6", () => pruefeSignaturen(k));
    await schritt("P5", () => pruefeAnker(k));
    await schritt("P8", async () => {
      bindungen.push({ name: kt.name, bindung: await pruefeNachweise(k) });
    });
    await schritt("P9", () => pruefeBesondere(k));
    k.aussagen.sort((a, b) => REIHENFOLGE.indexOf(a.schritt) - REIHENFOLGE.indexOf(b.schritt));
    aussagen.push(...k.aussagen);
  }
  for (const az of auszuege) {
    try {
      pruefeAktenauszug(az, bindungen, aussagen);
    } catch (err) {
      if (err instanceof Abbruch) throw err;
      sage({ aussagen, datei: az.name }, "P8", "offen", `Der Aktenauszug „${az.name}“ ließ sich nicht vollständig prüfen.`, `Fehler: ${(err as Error).message}. Ein Prüffehler ist kein Befund über die Datei.`);
    }
  }
  melde(1, "Prüfung abgeschlossen");
  const g = gesamt(aussagen);
  const stand = (s: { abgerufen: string | null; quelle: string } | null, anzahl: number): Befund["sperrliste"] => (s ? { abgerufen: s.abgerufen, quelle: s.quelle, anzahl } : null);
  return {
    wattestVersion: info.version,
    commit: info.commit,
    geprueftAm: isoWatt(optionen.jetzt),
    dateien: geprueft,
    sperrliste: stand(optionen.sperrliste, optionen.sperrliste ? Object.keys(optionen.sperrliste.eintraege).length : 0),
    wurzeln: stand(optionen.wurzelnStand, optionen.wurzeln.length),
    aussagen,
    gesamt: g,
    gesamtText: gesamtText(aussagen, klartexte.map((kt) => kt.version)),
  };
}
