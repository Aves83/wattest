// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P3: Die Kette nachspielen (Technische Erläuterung 7.) und den Stand mit eintraege und abwesenheiten vergleichen.

import { anzahl, type Detail } from "./befund.js";
import { GRENZE } from "./grenzen.js";
import { bestandAbwesenheitEingabe, bestandEintragEingabe } from "./kanonisch.js";
import { gliedName, liste, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { sha256Hex } from "./sha.js";
import { deutsch, zeitpunktMs } from "./zeit.js";

/** Abwesenheiten mit Gutschrift; DIENSTFREI steht nicht in der Kette (4.1, Datenformat Version 13). */
const MIT_GUTSCHRIFT = new Set(["KRANKHEIT", "SONDERURLAUB", "DIENSTBEFREIUNG", "ARZTBESUCH"]);

const EINTRAG_FELDER = ["tag", "kategorieId", "unterkategorieId", "beginn", "ende", "dauerMinuten", "notiz", "quelle", "planRef", "erfasstAm", "geaendertAm", "fach", "klasse"] as const;
const ABWESENHEIT_FELDER = ["tag", "art", "beginn", "ende"] as const;
const ZEITFELDER = new Set(["beginn", "ende", "erfasstAm", "geaendertAm", "importiertAm"]);

interface Objekt {
  /** Stand laut letztem Glied; null, wenn nur aus dem Bestand des Neubeginns bekannt */
  daten: Record<string, unknown> | null;
  bestand: string | null;
  /** Zeitpunkt des Anlage-Glieds mit importDatei, sonst null */
  importiertAm: string | null;
  letztes: Glied | null;
}

function normal(feld: string, w: unknown): string {
  if (feld === "fach" || feld === "klasse") return w === undefined || w === null ? "" : String(w);
  if (w === undefined || w === null) return "null";
  if (ZEITFELDER.has(feld)) {
    const ms = zeitpunktMs(w);
    if (ms !== null) return `t${ms}`;
  }
  return typeof w === "string" ? `s${w}` : `w${String(w)}`;
}

function vergleiche(felder: readonly string[], kette: Record<string, unknown>, datei: Record<string, unknown>): string[] {
  const abw: string[] = [];
  for (const f of felder) {
    let a = normal(f, kette[f]);
    let b = normal(f, datei[f]);
    // Zahlen und Wahrheitswerte stehen im XML als Text; deshalb ohne Typpräfix vergleichen, wenn einer Text ist.
    if (a !== b && a.slice(1) === b.slice(1) && (a[0] === "s" || b[0] === "s")) a = b;
    if (a !== b) abw.push(f);
  }
  return abw;
}

function objektName(art: "eintrag" | "abwesenheit", id: string): string {
  return art === "eintrag" ? `Eintrag ${id}` : `Abwesenheit am ${id}`;
}

export async function pruefeDaten(k: Kontext): Promise<void> {
  const g = k.kt.glieder;
  const fund = dateiFundstelle(k);
  const version = k.kt.version ?? 0;
  const eintraege = new Map<string, Objekt>();
  const abwesenheiten = new Map<string, Objekt>();
  const probleme: Detail[] = [];
  const nurBestand: string[] = [];
  let neubeginnAlt: Glied | null = null;
  let nachgespielt = 0;

  for (const x of g) {
    if (x.objektArt === "neubeginn") {
      const d = x.json;
      if (d && d["eintraege"] && typeof d["eintraege"] === "object") {
        for (const [id, h] of Object.entries(d["eintraege"] as Record<string, unknown>)) eintraege.set(id, { daten: null, bestand: String(h), importiertAm: null, letztes: null });
        for (const [tag, h] of Object.entries((d["abwesenheiten"] ?? {}) as Record<string, unknown>)) abwesenheiten.set(tag, { daten: null, bestand: String(h), importiertAm: null, letztes: null });
      } else neubeginnAlt = x;
      continue;
    }
    if (x.objektArt !== "eintrag" && x.objektArt !== "abwesenheit") continue;
    nachgespielt++;
    const karte = x.objektArt === "eintrag" ? eintraege : abwesenheiten;
    const name = `${gliedName(x)}: ${objektName(x.objektArt, x.objektId)}`;
    if (!x.json) {
      probleme.push({ text: `${name}: daten ist kein lesbares JSON; der Stand lässt sich nicht nachspielen.` });
      continue;
    }
    const vorhanden = karte.get(x.objektId);
    if (x.aktion === "ANGELEGT") {
      if (vorhanden) probleme.push({ text: `${name}: wird angelegt, besteht aber schon.` });
      karte.set(x.objektId, { daten: x.json, bestand: null, importiertAm: typeof x.json["importDatei"] === "string" ? x.zeitpunkt : null, letztes: x });
    } else if (x.aktion === "GEAENDERT") {
      if (!vorhanden) probleme.push({ text: `${name}: wird geändert, besteht aber nicht.` });
      karte.set(x.objektId, { daten: x.json, bestand: null, importiertAm: vorhanden?.importiertAm ?? null, letztes: x });
    } else if (x.aktion === "GELOESCHT") {
      if (!vorhanden) probleme.push({ text: `${name}: wird gelöscht, besteht aber nicht.` });
      karte.delete(x.objektId);
    } else probleme.push({ text: `${name}: unbekannte Aktion ${x.aktion}.` });
  }
  k.melde(0.55, "Daten mit der Kette abgeglichen");

  const abweichungen: Detail[] = [];
  const pruefeImport = version >= 18;
  const neubeginnMs = neubeginnAlt?.ms ?? null;

  const dateiEintraege = liste(k.kt.daten["eintraege"]);
  const gesehen = new Set<string>();
  for (const e of dateiEintraege) {
    const id = String(e["id"] ?? "");
    gesehen.add(id);
    const o = eintraege.get(id);
    if (!o) {
      const erf = zeitpunktMs(e["erfasstAm"]);
      const geae = zeitpunktMs(e["geaendertAm"]);
      if (neubeginnMs !== null && erf !== null && erf <= neubeginnMs && (geae === null || geae <= neubeginnMs)) {
        nurBestand.push(id);
        continue;
      }
      abweichungen.push({ text: `${objektName("eintrag", id)}: steht in den Daten, aber in keinem Glied der Kette.` });
      continue;
    }
    if (o.daten === null) {
      const h = (await sha256Hex(bestandEintragEingabe(e))).slice(0, 32);
      if (h !== o.bestand) abweichungen.push({ text: `${objektName("eintrag", id)}: passt nicht zur Bestandsprüfsumme im Neubeginn (4.6).` });
      continue;
    }
    const felder = vergleiche(EINTRAG_FELDER, o.daten, e);
    if (pruefeImport && normal("importiertAm", e["importiertAm"]) !== normal("importiertAm", o.importiertAm)) felder.push("importiertAm");
    if (felder.length) abweichungen.push({ text: `${objektName("eintrag", id)} (zuletzt ${gliedName(o.letztes!)}): abweichend in ${felder.join(", ")}.` });
  }
  for (const [id, o] of eintraege) {
    if (!gesehen.has(id)) abweichungen.push({ text: `${objektName("eintrag", id)}: besteht laut Kette (${o.letztes ? gliedName(o.letztes) : "Bestand des Neubeginns"}), fehlt aber in den Daten.` });
  }

  const dateiAbw = liste(k.kt.daten["abwesenheiten"]).filter((a) => MIT_GUTSCHRIFT.has(String(a["art"])));
  const gesehenA = new Set<string>();
  let dienstfrei = 0;
  for (const a of liste(k.kt.daten["abwesenheiten"])) if (!MIT_GUTSCHRIFT.has(String(a["art"]))) dienstfrei++;
  for (const a of dateiAbw) {
    const tag = String(a["tag"] ?? "");
    if (gesehenA.has(tag)) {
      abweichungen.push({ text: `${objektName("abwesenheit", tag)}: steht doppelt in den Daten.` });
      continue;
    }
    gesehenA.add(tag);
    const o = abwesenheiten.get(tag);
    if (!o) {
      if (neubeginnMs !== null) {
        nurBestand.push(tag);
        continue;
      }
      abweichungen.push({ text: `${objektName("abwesenheit", tag)}: steht in den Daten, aber in keinem Glied der Kette.` });
      continue;
    }
    if (o.daten === null) {
      const h = (await sha256Hex(bestandAbwesenheitEingabe(a))).slice(0, 32);
      if (h !== o.bestand) abweichungen.push({ text: `${objektName("abwesenheit", tag)}: passt nicht zur Bestandsprüfsumme im Neubeginn (4.6).` });
      continue;
    }
    const felder = vergleiche(ABWESENHEIT_FELDER, o.daten, a);
    if (pruefeImport && normal("importiertAm", a["importiertAm"]) !== normal("importiertAm", o.importiertAm)) felder.push("importiertAm");
    if (felder.length) abweichungen.push({ text: `${objektName("abwesenheit", tag)} (zuletzt ${gliedName(o.letztes!)}): abweichend in ${felder.join(", ")}.` });
  }
  for (const [tag, o] of abwesenheiten) {
    if (o.daten && !MIT_GUTSCHRIFT.has(String(o.daten["art"]))) continue;
    if (!gesehenA.has(tag)) abweichungen.push({ text: `${objektName("abwesenheit", tag)}: besteht laut Kette (${o.letztes ? gliedName(o.letztes) : "Bestand des Neubeginns"}), fehlt aber in den Daten.` });
  }

  const zahlen = `${anzahl(dateiEintraege.length, "Eintrag", "Einträgen")} und ${anzahl(dateiAbw.length, "Abwesenheit", "Abwesenheiten")} mit Gutschrift`;
  const nebenbei = dienstfrei ? ` Dienstfreie Tage (${dienstfrei}) stehen nicht in der Kette und bleiben außen vor.` : "";
  if (abweichungen.length || probleme.length) {
    sage(k, "P3", "widerlegt", "Die Daten entsprechen nicht der Kette.", `WATTest hat ${anzahl(nachgespielt, "Glied", "Glieder")} der Arten eintrag und abwesenheit nachgespielt (7.) und den Stand Feld für Feld mit ${zahlen} der Datei verglichen. ${anzahl(abweichungen.length + probleme.length, "Abweichung", "Abweichungen")}: Die Daten wurden nach dem Export bearbeitet, oder Kette und Daten gehören nicht zusammen.${nebenbei}`, {
      fundstelle: fund,
      grenze: GRENZE.daten,
      details: [...probleme, ...abweichungen].slice(0, 300),
    });
  } else {
    sage(k, "P3", "bestaetigt", "Die Daten entsprechen der Kette.", `WATTest hat ${anzahl(nachgespielt, "Glied", "Glieder")} der Arten eintrag und abwesenheit nachgespielt (7.); der entstehende Stand stimmt Feld für Feld mit ${zahlen} der Datei überein.${nebenbei}`, {
      fundstelle: fund,
      grenze: GRENZE.daten,
    });
  }
  if (nurBestand.length && neubeginnAlt) {
    sage(k, "P3", "offen", `${anzahl(nurBestand.length, "Datensatz ist", "Datensätze sind")} nur über die Prüfsumme des Neubeginns belegt.`, `Der Neubeginn am ${neubeginnAlt.ms !== null ? deutsch(neubeginnAlt.ms) : neubeginnAlt.zeitpunkt} entstand vor dem 19.10.2026 und nennt keinen Bestand je Eintrag. Einträge ohne Glied seither gelten nach 7. als Bestand, wenn sie davor erfasst und zuletzt geändert wurden; ihr Inhalt lässt sich nur über die Prüfsumme des Datenbestands (4.6) belegen, die einen Export unmittelbar nach dem Neubeginn braucht.`, {
      fundstelle: dateiFundstelle(k, gliedName(neubeginnAlt)),
      grenze: GRENZE.daten,
      details: nurBestand.slice(0, 100).map((id) => ({ text: id })),
    });
  }
}
