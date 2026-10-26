// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P3: Die Kette nachspielen (Technische Erläuterung 7.) und den Stand mit eintraege und abwesenheiten vergleichen.

import { anzahl, bereiche, type Detail } from "./befund.js";
import { GRENZE, GRENZE_HAERTUNG, GRENZWERTE } from "./grenzen.js";
import { bestandAbwesenheitEingabe, bestandEintragEingabe, bestandsform } from "./kanonisch.js";
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
  /** Form der Bestandsprüfsumme (4.6), nur bei Objekten aus dem Bestand eines Neubeginns */
  form: 1 | 2;
  /** „Importiert am“ laut Kette (7.1): Zeitpunkt des Anlage-Glieds mit importDatei bzw. importiertAm des letzten Änderungs-Glieds mit Uhrstand, sonst null */
  importiertAm: string | null;
  /** Die Kette belegt „Importiert am“ nicht; es gilt der Wert der Datei (7.1, 9.), mit Grund */
  importUnbelegt: string | null;
  letztes: Glied | null;
}

/**
 * „Importiert am“ nach einem Glied GEAENDERT (4.1, 7.1): Mit Uhrstand trägt das Glied den Wert selbst als
 * importiertAm am Ende von daten; fehlt das Feld, gilt kein Vermerk, auch nach einem Neubeginn. Ohne Uhrstand
 * (bis Formatversion 18) erbt es den Wert des vorigen Stands; ändert es einen Datensatz aus dem Bestand eines
 * Neubeginns, belegt die Kette den Wert nicht.
 */
function importNachAenderung(x: Glied, vorhanden: Objekt | undefined): Pick<Objekt, "importiertAm" | "importUnbelegt"> {
  if (x.form === "neun") {
    const w = x.json?.["importiertAm"];
    return { importiertAm: w === undefined || w === null ? null : String(w), importUnbelegt: null };
  }
  if (vorhanden && vorhanden.daten === null) return { importiertAm: null, importUnbelegt: `${gliedName(x)} ohne Uhrstand ändert einen Datensatz aus dem Bestand des Neubeginns; der Bestand trägt nur Prüfsummen` };
  return { importiertAm: vorhanden?.importiertAm ?? null, importUnbelegt: vorhanden?.importUnbelegt ?? null };
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

function zeitText(w: string): string {
  const ms = zeitpunktMs(w);
  return ms === null ? w : deutsch(ms);
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
  // Neubeginn mit einem Wert von bestandsform, den WATTest nicht kennt: Bestandsprüfsummen nicht nachrechenbar, „?“.
  let formUnbekannt: Glied | null = null;
  // Objekte mit einem Glied, dessen daten über der Grenze der Verschachtelung liegt: nicht nachspielbar, „?“.
  const ueberGrenze: Glied[] = [];
  const offen = new Set<string>();
  let neubeginnAlt: Glied | null = null;
  let nachgespielt = 0;

  for (const x of g) {
    if (x.objektArt === "neubeginn") {
      const d = x.json;
      if (d && d["eintraege"] && typeof d["eintraege"] === "object") {
        const form = bestandsform(d);
        if (form === null) formUnbekannt = x;
        const neu = (h: unknown): Objekt => ({ daten: null, bestand: String(h), form: form ?? 1, importiertAm: null, importUnbelegt: null, letztes: null });
        for (const [id, h] of Object.entries(d["eintraege"] as Record<string, unknown>)) {
          eintraege.set(id, neu(h));
          if (form === null) offen.add(`eintrag:${id}`);
        }
        for (const [tag, h] of Object.entries((d["abwesenheiten"] ?? {}) as Record<string, unknown>)) {
          abwesenheiten.set(tag, neu(h));
          if (form === null) offen.add(`abwesenheit:${tag}`);
        }
      } else neubeginnAlt = x;
      continue;
    }
    if (x.objektArt !== "eintrag" && x.objektArt !== "abwesenheit") continue;
    nachgespielt++;
    const karte = x.objektArt === "eintrag" ? eintraege : abwesenheiten;
    const name = `${gliedName(x)}: ${objektName(x.objektArt, x.objektId)}`;
    if (offen.has(`${x.objektArt}:${x.objektId}`)) continue;
    if (!x.json && x.datenUeberGrenze) {
      ueberGrenze.push(x);
      offen.add(`${x.objektArt}:${x.objektId}`);
      continue;
    }
    if (!x.json) {
      probleme.push({ text: `${name}: daten ist kein lesbares JSON; der Stand lässt sich nicht nachspielen.` });
      continue;
    }
    const vorhanden = karte.get(x.objektId);
    if (x.aktion === "ANGELEGT") {
      if (vorhanden) probleme.push({ text: `${name}: wird angelegt, besteht aber schon.` });
      // Anlage: „Importiert am“ ist der Zeitpunkt des Glieds mit importDatei; ohne importDatei beginnt sie ohne (7.1).
      karte.set(x.objektId, { daten: x.json, bestand: null, form: 1, importiertAm: typeof x.json["importDatei"] === "string" ? x.zeitpunkt : null, importUnbelegt: null, letztes: x });
    } else if (x.aktion === "GEAENDERT") {
      if (!vorhanden) probleme.push({ text: `${name}: wird geändert, besteht aber nicht.` });
      karte.set(x.objektId, { daten: x.json, bestand: null, form: 1, ...importNachAenderung(x, vorhanden), letztes: x });
    } else if (x.aktion === "GELOESCHT") {
      if (!vorhanden) probleme.push({ text: `${name}: wird gelöscht, besteht aber nicht.` });
      karte.delete(x.objektId);
    } else probleme.push({ text: `${name}: unbekannte Aktion ${x.aktion}.` });
  }
  k.melde(0.55, "Daten mit der Kette abgeglichen");

  const abweichungen: Detail[] = [];
  const pruefeImport = version >= 18;
  // „Importiert am“ fehlt in der Datei, obwohl die Kette das Einlesen belegt: Hinweis, keine Abweichung (4.8, 7.1).
  const importFehlt: Detail[] = [];
  const importUnbelegt: Detail[] = [];
  /** Vergleicht „Importiert am“ aus Kette und Datei; ergibt true bei einer Abweichung. */
  const importAbweichend = (name: string, o: Objekt, datei: Record<string, unknown>): boolean => {
    if (!pruefeImport) return false;
    const inDatei = normal("importiertAm", datei["importiertAm"]);
    if (o.importUnbelegt) {
      importUnbelegt.push({ text: `${name}: ${o.importUnbelegt}; in der Datei ${inDatei === "null" ? "ohne „Importiert am“" : `„Importiert am“ ${String(datei["importiertAm"])}`}.` });
      return false;
    }
    const inKette = normal("importiertAm", o.importiertAm);
    if (inDatei === inKette) return false;
    if (inDatei === "null") {
      importFehlt.push({ text: `${name} (${gliedName(o.letztes!)}): Die Kette belegt das Einlesen am ${zeitText(o.importiertAm!)}, die Datei nennt kein „Importiert am“.` });
      return false;
    }
    return true;
  };
  const neubeginnMs = neubeginnAlt?.ms ?? null;

  const dateiEintraege = liste(k.kt.daten["eintraege"]);
  const gesehen = new Set<string>();
  for (const e of dateiEintraege) {
    const id = String(e["id"] ?? "");
    gesehen.add(id);
    if (offen.has(`eintrag:${id}`)) continue;
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
      const h = (await sha256Hex(bestandEintragEingabe(e, o.form))).slice(0, 32);
      if (h !== o.bestand) abweichungen.push({ text: `${objektName("eintrag", id)}: passt nicht zur Bestandsprüfsumme im Neubeginn (4.6, Form ${o.form}).` });
      else if (o.form === 1 && pruefeImport && e["importiertAm"] !== undefined && e["importiertAm"] !== null) importUnbelegt.push({ text: `${objektName("eintrag", id)}: Bestand eines Neubeginns in Form 1 ohne Glied seither; „Importiert am“ ${String(e["importiertAm"])} steht nur in der Datei.` });
      continue;
    }
    const felder = vergleiche(EINTRAG_FELDER, o.daten, e);
    if (importAbweichend(objektName("eintrag", id), o, e)) felder.push("importiertAm");
    if (felder.length) abweichungen.push({ text: `${objektName("eintrag", id)} (zuletzt ${gliedName(o.letztes!)}): abweichend in ${felder.join(", ")}.` });
  }
  for (const [id, o] of eintraege) {
    if (!gesehen.has(id) && !offen.has(`eintrag:${id}`)) abweichungen.push({ text: `${objektName("eintrag", id)}: besteht laut Kette (${o.letztes ? gliedName(o.letztes) : "Bestand des Neubeginns"}), fehlt aber in den Daten.` });
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
    if (offen.has(`abwesenheit:${tag}`)) continue;
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
      const h = (await sha256Hex(bestandAbwesenheitEingabe(a, o.form))).slice(0, 32);
      if (h !== o.bestand) abweichungen.push({ text: `${objektName("abwesenheit", tag)}: passt nicht zur Bestandsprüfsumme im Neubeginn (4.6, Form ${o.form}).` });
      else if (o.form === 1 && pruefeImport && a["importiertAm"] !== undefined && a["importiertAm"] !== null) importUnbelegt.push({ text: `${objektName("abwesenheit", tag)}: Bestand eines Neubeginns in Form 1 ohne Glied seither; „Importiert am“ ${String(a["importiertAm"])} steht nur in der Datei.` });
      continue;
    }
    const felder = vergleiche(ABWESENHEIT_FELDER, o.daten, a);
    if (importAbweichend(objektName("abwesenheit", tag), o, a)) felder.push("importiertAm");
    if (felder.length) abweichungen.push({ text: `${objektName("abwesenheit", tag)} (zuletzt ${gliedName(o.letztes!)}): abweichend in ${felder.join(", ")}.` });
  }
  for (const [tag, o] of abwesenheiten) {
    if (o.daten && !MIT_GUTSCHRIFT.has(String(o.daten["art"]))) continue;
    if (!gesehenA.has(tag) && !offen.has(`abwesenheit:${tag}`)) abweichungen.push({ text: `${objektName("abwesenheit", tag)}: besteht laut Kette (${o.letztes ? gliedName(o.letztes) : "Bestand des Neubeginns"}), fehlt aber in den Daten.` });
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
  if (importFehlt.length) {
    sage(k, "P3", "hinweis", `Bei ${anzahl(importFehlt.length, "Datensatz", "Datensätzen")} fehlt „Importiert am“ in der Datei, obwohl die Kette das Einlesen belegt.`, "Bis WATT 0.8 „Cherimoya“ verlor eine bearbeitete eingelesene Abwesenheit den Vermerk „Importiert am“; WATT ergänzt ihn beim Einspielen aus dem Protokoll (7.1). Nach 4.8 ist das ein Hinweis, keine Abweichung der Daten. Ein abweichender Zeitpunkt bliebe eine Abweichung.", {
      fundstelle: fund,
      grenze: GRENZE.daten,
      details: importFehlt,
    });
  }
  if (importUnbelegt.length) {
    sage(k, "P3", "hinweis", `Bei ${anzahl(importUnbelegt.length, "Datensatz", "Datensätzen")} belegt die Kette „Importiert am“ nicht; es gilt der Wert der Datei.`, "Änderungs-Glieder ohne Uhrstand (bis Formatversion 18) erben „Importiert am“ vom vorigen Stand. Ändert ein solches Glied nach einem Neubeginn einen Datensatz des Bestands, belegt das Protokoll den geerbten Wert nicht, weil der Bestand nur Prüfsummen trägt; ebenso bei Datensätzen aus einem Neubeginn in Form 1 ohne Glied seither (7.1).", {
      fundstelle: fund,
      grenze: GRENZE.importiertAm,
      details: importUnbelegt,
    });
  }
  if (formUnbekannt) {
    sage(k, "P3", "offen", "Die Bestandsprüfsummen des Neubeginns lassen sich nicht nachrechnen.", `${gliedName(formUnbekannt)} nennt bestandsform ${String(formUnbekannt.json?.["bestandsform"]).slice(0, 40)}. Die Technische Erläuterung kennt nur Form 1 (ohne das Feld) und Form 2 (4.6); die Datensätze des Bestands ohne Glied seither bleiben beim Abgleich außen vor.`, {
      fundstelle: dateiFundstelle(k, gliedName(formUnbekannt)),
      grenze: GRENZE.daten,
    });
  }
  if (ueberGrenze.length) {
    sage(k, "P3", "offen", `${anzahl(ueberGrenze.length, "Glied lässt", "Glieder lassen")} sich nicht nachspielen.`, `Das Feld daten dieser Glieder ist tiefer verschachtelt als die Grenze von ${GRENZWERTE.jsonTiefe} Ebenen; WATTest liest es nicht. Die betroffenen Einträge und Abwesenheiten bleiben beim Abgleich außen vor; über sie sagt P3 nichts.`, {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(ueberGrenze.map((x) => x.seq ?? x.index + 1))}`),
      grenze: GRENZE_HAERTUNG,
      details: ueberGrenze.map((x) => ({ text: `${gliedName(x)}: ${objektName(x.objektArt === "abwesenheit" ? "abwesenheit" : "eintrag", x.objektId)}` })),
    });
  }
  if (nurBestand.length && neubeginnAlt) {
    sage(k, "P3", "offen", `${anzahl(nurBestand.length, "Datensatz ist", "Datensätze sind")} nur über die Prüfsumme des Neubeginns belegt.`, `Der Neubeginn am ${neubeginnAlt.ms !== null ? deutsch(neubeginnAlt.ms) : neubeginnAlt.zeitpunkt} entstand vor Formatversion 18 und nennt keinen Bestand je Eintrag. Einträge ohne Glied seither gelten nach 7. als Bestand, wenn sie davor erfasst und zuletzt geändert wurden; ihr Inhalt lässt sich nur über die Prüfsumme des Datenbestands (4.6) belegen, die einen Export unmittelbar nach dem Neubeginn braucht.`, {
      fundstelle: dateiFundstelle(k, gliedName(neubeginnAlt)),
      grenze: GRENZE.daten,
      details: nurBestand.slice(0, 100).map((id) => ({ text: id })),
    });
  }
}
