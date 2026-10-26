// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P8: Nachweiskette, Inhaltsprüfsummen (Technische Erläuterung 5., 5.1) und Aktenauszug mit SHA256SUMS.txt.

import { anzahl, type Aussage, type Detail } from "./befund.js";
import { ausBase64, textAus } from "./bytes.js";
import { GRENZE } from "./grenzen.js";
import { anzeigeEingabe, gespraechEingabe, nachtragEingabe, nachweisgliedEingabe, type AnzeigeRoh, type DokumentFeld } from "./kanonisch.js";
import { liste, objekt } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { sha256Hex } from "./sha.js";

export interface AktenDatei {
  pfad: string;
  groesse: number;
  sha256: string;
  /** Änderungszeit im ZIP (DOS-Datum · 65536 + Uhrzeit) */
  zeit?: number;
  /** Bytes von PRUEFEN.txt und SHA256SUMS.txt für die Prüfung des Aufbaus (6.3) */
  roh?: Uint8Array;
}

export interface Aktenauszug {
  name: string;
  dateien: AktenDatei[];
  summenPfad: string;
  summenText: string;
}

/** Prüfsummen der Dokumente, die über eine bestätigte Anzeige an die Nachweiskette gebunden sind. */
export type Dokumentbindung = Map<string, { anzeige: string; dateiname: string; glied: number }>;

export async function pruefeNachweise(k: Kontext): Promise<Dokumentbindung> {
  const bindung: Dokumentbindung = new Map();
  const nw = objekt(k.kt.daten["nachweise"]);
  const fund = dateiFundstelle(k);
  if (!nw) {
    sage(k, "P8", "offen", "Die Datei enthält keine Nachweise.", "Das Feld nachweise fehlt oder ist null; es gibt keine Nachweiskette zu prüfen.", { fundstelle: fund, grenze: GRENZE.nachweis });
    return bindung;
  }
  const kette = liste(nw["kette"]);
  const anzeigen = liste(nw["anzeigen"]);
  const gespraeche = liste(nw["gespraeche"]);

  // Verkettung
  const brueche: Detail[] = [];
  let vorher: Record<string, unknown> | null = null;
  for (let i = 0; i < kette.length; i++) {
    const x = kette[i]!;
    const h = await sha256Hex(nachweisgliedEingabe(x as never));
    const seq = x["seq"];
    if (seq !== i + 1) brueche.push({ text: `Nachweisglied an Stelle ${i + 1} hat die Nummer ${String(seq)} statt ${i + 1}.` });
    if (i === 0 && x["prev"] !== "0") brueche.push({ text: "Nachweisglied 1: Das erste Glied muss als Vorgänger 0 nennen." });
    if (vorher && x["prev"] !== vorher["hash"]) brueche.push({ text: `Nachweisglied ${String(seq)}: Der Vorgänger passt nicht zu Nachweisglied ${String(vorher["seq"])}.` });
    if (x["hash"] !== h) brueche.push({ text: `Nachweisglied ${String(seq)}: Die gespeicherte Prüfsumme passt nicht zum Inhalt.` });
    vorher = x;
  }
  if (!kette.length) {
    sage(k, "P8", "bestaetigt", "Die Nachweiskette ist leer.", "Die Datei enthält kein Glied der Nachweiskette.", { fundstelle: fund, grenze: GRENZE.nachweis });
  } else if (brueche.length) {
    sage(k, "P8", "widerlegt", "Die Nachweiskette ist unterbrochen.", `WATTest hat die Prüfsummen der ${anzahl(kette.length, "Nachweisglieds", "Nachweisglieder")} nach 5.1 neu berechnet und die Verkettung geprüft.`, { fundstelle: fund, grenze: GRENZE.nachweis, details: brueche });
  } else {
    sage(k, "P8", "bestaetigt", "Die Nachweiskette ist lückenlos und unverändert.", `WATTest hat die Prüfsumme aller ${anzahl(kette.length, "Nachweisglieds", "Nachweisglieder")} nach 5.1 neu berechnet; jede stimmt, und jedes Glied nennt seinen Vorgänger.`, {
      fundstelle: dateiFundstelle(k, `Nachweisglied 1 bis ${kette.length}`),
      grenze: GRENZE.nachweis,
    });
  }

  // Inhalte
  const abw: Detail[] = [];
  const hinweise: string[] = [];
  const inhalt = new Map<string, { art: string; pruefsumme: string | null; berechnet: string; dokumente?: DokumentFeld[] }>();
  let dokumente = 0;
  for (const a of anzeigen) {
    const id = String(a["id"] ?? "");
    if (a["pruefsumme"] === null || a["pruefsumme"] === undefined) continue; // Entwurf
    const docs: DokumentFeld[] = [];
    let lesbar = true;
    for (const d of liste(a["dokumente"])) {
      const b = ausBase64(String(d["inhalt"] ?? ""));
      if (!b) {
        lesbar = false;
        abw.push({ text: `Anzeige ${id}: Das Dokument ${String(d["dateiname"])} ist kein gültiges Base64.` });
        continue;
      }
      docs.push({ art: d["art"], dateiname: d["dateiname"], sha256: await sha256Hex(b) });
    }
    dokumente += docs.length;
    const berechnet = await sha256Hex(anzeigeEingabe(a as AnzeigeRoh, docs));
    if (lesbar && berechnet !== a["pruefsumme"]) abw.push({ text: `Anzeige ${id}: Die gespeicherte Prüfsumme passt nicht zum Inhalt der Anzeige (Verfahren ${String(a["pruefverfahren"] ?? 1)}).` });
    inhalt.set(id, { art: "anzeige", pruefsumme: a["pruefsumme"] as string, berechnet, dokumente: docs });
  }
  let nachtraege = 0;
  for (const gs of gespraeche) {
    const id = String(gs["id"] ?? "");
    const h = await sha256Hex(gespraechEingabe(gs));
    if (h !== gs["pruefsumme"]) abw.push({ text: `Gesprächsnotiz ${id}: Die gespeicherte Prüfsumme passt nicht zum Inhalt.` });
    inhalt.set(id, { art: "gespraech", pruefsumme: String(gs["pruefsumme"]), berechnet: h });
    for (const n of liste(gs["nachtraege"])) {
      nachtraege++;
      const nid = String(n["id"] ?? "");
      const nh = await sha256Hex(nachtragEingabe(n, gs["id"]));
      if (nh !== n["pruefsumme"]) abw.push({ text: `Nachtrag ${nid}: Die gespeicherte Prüfsumme passt nicht zum Inhalt.` });
      inhalt.set(nid, { art: "nachtrag", pruefsumme: String(n["pruefsumme"]), berechnet: nh });
    }
  }

  // Bindung zwischen Gliedern und Inhalten
  const geloescht = new Map<string, number>();
  const eingetragen = new Map<string, { seq: number; pruefsumme: string }>();
  const loeschDetails: Detail[] = [];
  const wiederDetails: Detail[] = [];
  for (const x of kette) {
    const ref = String(x["referenzId"] ?? "");
    const ps = String(x["pruefsumme"] ?? "");
    const seq = Number(x["seq"]);
    const ev = String(x["ereignis"] ?? "");
    if (ev === "ANZEIGE_GESENDET" || ev === "GESPRAECHSNOTIZ_GESPEICHERT" || ev === "NACHTRAG") eingetragen.set(ref, { seq, pruefsumme: ps });
    else if (ev === "ANZEIGE_GELOESCHT" || ev === "GESPRAECHSNOTIZ_GELOESCHT") {
      geloescht.set(ref, seq);
      const e = eingetragen.get(ref);
      if (!e) abw.push({ text: `Nachweisglied ${seq}: Löschvermerk für ${ref}, aber kein früheres Glied trägt diesen Nachweis ein.` });
      else if (e.pruefsumme !== ps) abw.push({ text: `Nachweisglied ${seq}: Der Löschvermerk nennt eine andere Prüfsumme als Nachweisglied ${e.seq}.` });
      loeschDetails.push({ text: `Nachweisglied ${seq}: ${ev === "ANZEIGE_GELOESCHT" ? "Anzeige" : "Gesprächsnotiz"} ${ref} gelöscht (eingetragen in Nachweisglied ${e?.seq ?? "?"}).` });
    } else if (ev === "WIEDERHERSTELLUNG" || ev === "WIEDERHERSTELLUNG_UNTERBROCHEN") {
      wiederDetails.push({ text: `Nachweisglied ${seq}: ${ev === "WIEDERHERSTELLUNG" ? "Wiederherstellung" : "Wiederherstellung mit unterbrochener Kette in der Datei"} (Referenz ${ref}, SHA-256 der eingespielten Datei ${ps}).` });
    } else abw.push({ text: `Nachweisglied ${seq}: unbekanntes Ereignis ${ev}.` });
  }
  for (const [id, v] of inhalt) {
    const e = eingetragen.get(id);
    if (!e) {
      abw.push({ text: `${v.art === "anzeige" ? "Anzeige" : v.art === "gespraech" ? "Gesprächsnotiz" : "Nachtrag"} ${id} steht in keinem Glied der Nachweiskette.` });
      continue;
    }
    if (e.pruefsumme !== v.berechnet) abw.push({ text: `${v.art === "anzeige" ? "Anzeige" : v.art === "gespraech" ? "Gesprächsnotiz" : "Nachtrag"} ${id}: Nachweisglied ${e.seq} nennt eine andere Prüfsumme als der Inhalt ergibt.` });
    else if (geloescht.has(id)) hinweise.push(`${id}: Inhalt vorhanden, obwohl Nachweisglied ${geloescht.get(id)} die Löschung vermerkt.`);
    else if (v.dokumente) for (const d of v.dokumente) bindung.set(d.sha256, { anzeige: id, dateiname: String(d.dateiname), glied: e.seq });
  }
  for (const [ref, e] of eingetragen) {
    if (!inhalt.has(ref) && !geloescht.has(ref)) {
      // Nachträge gelöschter Gesprächsnotizen verschwinden mit ihr.
      const notiz = ref.includes(":") ? ref.slice(0, ref.indexOf(":")) : null;
      if (notiz && geloescht.has(notiz)) continue;
      abw.push({ text: `Nachweisglied ${e.seq}: Der Nachweis ${ref} fehlt in der Datei, ohne dass seine Löschung vermerkt ist.` });
    }
  }
  const zahlen = `${anzahl([...inhalt.values()].filter((v) => v.art === "anzeige").length, "gesendete Anzeige", "gesendete Anzeigen")} mit ${anzahl(dokumente, "Dokument", "Dokumenten")}, ${anzahl(gespraeche.length, "Gesprächsnotiz", "Gesprächsnotizen")} und ${anzahl(nachtraege, "Nachtrag", "Nachträgen")}`;
  if (abw.length) {
    sage(k, "P8", "widerlegt", "Die Nachweise entsprechen nicht der Nachweiskette.", `WATTest hat die Inhaltsprüfsummen von ${zahlen} nach 5.1 neu berechnet und mit der Nachweiskette verglichen.`, {
      fundstelle: fund,
      grenze: GRENZE.nachweis,
      details: [...abw, ...hinweise.map((t) => ({ text: t }))],
    });
  } else if (inhalt.size) {
    sage(k, "P8", "bestaetigt", "Die Nachweise entsprechen der Nachweiskette.", `WATTest hat die Inhaltsprüfsummen von ${zahlen} nach 5.1 neu berechnet; jede stimmt mit der gespeicherten und mit dem Glied der Nachweiskette überein.`, {
      fundstelle: fund,
      grenze: GRENZE.nachweis,
      ...(hinweise.length ? { details: hinweise.map((t) => ({ text: t })) } : {}),
    });
  }
  if (loeschDetails.length) {
    sage(k, "P8", "hinweis", `Die Nachweiskette vermerkt ${anzahl(loeschDetails.length, "Löschung", "Löschungen")}.`, "Gesendete Anzeigen und Gesprächsnotizen lassen sich löschen; ihr Inhalt verschwindet, der Vermerk ihrer Existenz bleibt in der Kette (5.).", { fundstelle: fund, details: loeschDetails });
  }
  if (wiederDetails.length) {
    sage(k, "P8", "hinweis", `Die Nachweiskette vermerkt ${anzahl(wiederDetails.length, "Wiederherstellung", "Wiederherstellungen")}.`, "Eine Wiederherstellung ersetzt die Nachweiskette des Geräts durch die der Datei und hängt ein Glied an (5., 7.).", { fundstelle: fund, details: wiederDetails });
  }

  const mitAnhang = anzeigen.filter((a) => liste(a["anhaenge"]).length);
  if (mitAnhang.length || k.kt.anhaenge) {
    const details: Detail[] = [];
    const vorhanden = new Map((k.kt.anhaenge ?? []).map((a) => [a.pfad.replace(/^.*?anhaenge\//, ""), a]));
    for (const a of mitAnhang) {
      for (const h of liste(a["anhaenge"])) {
        const dn = typeof h["dateiname"] === "string" ? (h["dateiname"] as string).replace(/^anhaenge\//, "") : null;
        const datei = dn ? vorhanden.get(dn) : undefined;
        details.push({
          text: `Anzeige ${String(a["id"])}, Anhang ${String(h["id"])} (${String(h["art"])}, ${String(h["groesse"])} Bytes): ${datei ? (datei.groesse === h["groesse"] ? "Kopie im ZIP, Größe passt" : `Kopie im ZIP mit anderer Größe (${datei.groesse} Bytes)`) : dn ? "Kopie fehlt im ZIP" : "ohne Kopie im Export"}`,
          inhalt: `Name: ${String(h["name"])}`,
        });
        if (dn) vorhanden.delete(dn);
      }
    }
    for (const [p, a] of vorhanden) details.push({ text: `anhaenge/${p} (${a.groesse} Bytes): keinem Anhang zugeordnet` });
    sage(k, "P8", "hinweis", `Die Datei nennt ${anzahl(details.length, "Anhang", "Anhänge")} zu Anzeigen; Anhänge prüft WATTest nicht.`, "Anhänge an Anzeigen sind kein Teil des Nachweises: Sie gehen weder in die Inhaltsprüfsumme der Anzeige noch in die Nachweiskette ein (5.1). WATTest listet sie nur auf.", {
      fundstelle: fund,
      grenze: GRENZE.nachweis,
      details,
    });
  }
  return bindung;
}

/** Liest SHA256SUMS.txt: je Zeile Prüfsumme, zwei Leerzeichen, Pfad. */
export function leseSummen(text: string): { summen: Map<string, string>; fehler: string[] } {
  const summen = new Map<string, string>();
  const fehler: string[] = [];
  text.split(/\r?\n/).forEach((z, i) => {
    if (!z.trim()) return;
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(z);
    if (!m) fehler.push(`Zeile ${i + 1} hat nicht die Form „Prüfsumme, zwei Leerzeichen, Pfad“.`);
    else summen.set(m[2]!.replace(/^\.\//, ""), m[1]!.toLowerCase());
  });
  return { summen, fehler };
}

/** Bereinigt den Dateinamen eines Dokuments wie WATT im ZIP des Aktenauszugs (6.3, Schritte 1 bis 6). */
export function bereinigeDateiname(name: string): string {
  let s = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_");
  s = s.replaceAll("..", "_");
  s = s.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  s = s.replace(/^\.+/, "");
  s = s.slice(0, 120);
  return /^\p{White_Space}*$/u.test(s) ? "dokument" : s;
}

const BOM = (b: Uint8Array): boolean => b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
const ORDNER = /^Eintrag_(0[1-9]|[1-9]\d+)\/([^/]+)$/;
const WURZEL = ["Technische-Erlaeuterung.pdf", "PRUEFEN.txt", "SHA256SUMS.txt"];

/**
 * Aufbau des ZIP-Archivs nach 6.3: Ordner Eintrag_NN mit bereinigten Dateinamen, in der Wurzel nur die Technische
 * Erläuterung, PRUEFEN.txt (CRLF, ohne BOM) und als letzte Datei SHA256SUMS.txt (LF, ohne BOM, eine Zeile je anderer
 * Datei in Archivreihenfolge), alle Einträge mit derselben Änderungszeit. Liefert die Abweichungen.
 */
function pruefeAufbau(az: Aktenauszug, relativ: (pfad: string) => string | null): Detail[] {
  const abw: Detail[] = [];
  const pfade = az.dateien.map((d) => relativ(d.pfad));
  let rang = -1;
  let vorher = "";
  az.dateien.forEach((d, i) => {
    const p = pfade[i];
    if (p === null) {
      abw.push({ text: `${d.pfad}: liegt außerhalb des Ordners von SHA256SUMS.txt.` });
      return;
    }
    let r: number;
    const m = ORDNER.exec(p);
    if (m) {
      r = Math.min(Number(m[1]), Number.MAX_SAFE_INTEGER - 2 * WURZEL.length);
      if (bereinigeDateiname(m[2]!) !== m[2]) abw.push({ text: `${d.pfad}: Der Dateiname ist nicht nach 6.3 bereinigt (bereinigt: „${bereinigeDateiname(m[2]!)}“).` });
    } else if (WURZEL.includes(p)) {
      r = Number.MAX_SAFE_INTEGER - WURZEL.length + WURZEL.indexOf(p);
    } else {
      abw.push({ text: p.includes("/") ? `${d.pfad}: liegt nicht in einem Ordner Eintrag_NN (mindestens zwei Ziffern, ab 01).` : `${d.pfad}: In der Wurzel stehen nach 6.3 nur ${WURZEL.join(", ")}.` });
      return;
    }
    if (r < rang) abw.push({ text: `${d.pfad}: steht im Archiv nach ${vorher}; 6.3 legt die Reihenfolge Eintrag_01, Eintrag_02, …, Technische-Erlaeuterung.pdf, PRUEFEN.txt, SHA256SUMS.txt fest.` });
    else {
      rang = r;
      vorher = d.pfad;
    }
  });
  if (!pfade.includes("Technische-Erlaeuterung.pdf")) abw.push({ text: "Technische-Erlaeuterung.pdf fehlt in der Wurzel." });
  const zeiten = new Set(az.dateien.map((d) => d.zeit));
  if (zeiten.size > 1) abw.push({ text: `Die Einträge tragen ${zeiten.size} verschiedene Änderungszeiten; nach 6.3 tragen alle den Zeitpunkt der Erstellung.` });

  const pruefen = az.dateien.find((_, i) => pfade[i] === "PRUEFEN.txt");
  if (pruefen?.roh) {
    const b = pruefen.roh;
    if (BOM(b)) abw.push({ text: "PRUEFEN.txt beginnt mit einem BOM." });
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(b);
    } catch {
      abw.push({ text: "PRUEFEN.txt ist kein gültiges UTF-8." });
    }
    let lf = 0;
    let cr = 0;
    for (let j = 0; j < b.length; j++) {
      if (b[j] === 0x0a && b[j - 1] !== 0x0d) lf++;
      if (b[j] === 0x0d && b[j + 1] !== 0x0a) cr++;
    }
    if (lf || cr) abw.push({ text: `PRUEFEN.txt hat ${lf ? `${anzahl(lf, "Zeilenende", "Zeilenenden")} LF` : ""}${lf && cr ? " und " : ""}${cr ? `${anzahl(cr, "einzelnes", "einzelne")} CR` : ""}; nach 6.3 endet jede Zeile mit CRLF.` });
  }

  const letzte = az.dateien.length - 1;
  const summen = az.dateien.find((d) => d.pfad === az.summenPfad);
  if (az.dateien[letzte]?.pfad !== az.summenPfad) abw.push({ text: "SHA256SUMS.txt ist nicht die letzte Datei im Archiv." });
  if (summen?.roh) {
    const b = summen.roh;
    if (BOM(b)) abw.push({ text: "SHA256SUMS.txt beginnt mit einem BOM." });
    const text = textAus(BOM(b) ? b.subarray(3) : b, false);
    if (text.includes("\r")) abw.push({ text: "SHA256SUMS.txt enthält CR; nach 6.3 endet jede Zeile mit LF." });
    if (text.length && !text.endsWith("\n")) abw.push({ text: "SHA256SUMS.txt endet nicht mit einem Zeilenende." });
    const zeilen = text.replace(/\r/g, "").split("\n");
    if (zeilen.at(-1) === "") zeilen.pop();
    const genannt: string[] = [];
    zeilen.forEach((z, j) => {
      const m = /^[0-9a-f]{64} {2}(.+)$/.exec(z);
      if (!m) abw.push({ text: `SHA256SUMS.txt, Zeile ${j + 1}: nicht in der Form „64 Zeichen Hexadezimal in Kleinbuchstaben, zwei Leerzeichen, Pfad“.` });
      else genannt.push(m[1]!);
    });
    if (genannt.includes("SHA256SUMS.txt")) abw.push({ text: "SHA256SUMS.txt nennt sich selbst." });
    const andere = genannt.filter((p) => p !== "SHA256SUMS.txt");
    const erwartet = az.dateien.flatMap((d, i) => (d.pfad === az.summenPfad || pfade[i] === null ? [] : [pfade[i]!]));
    if (andere.length !== erwartet.length || andere.some((p, j) => p !== erwartet[j])) abw.push({ text: "SHA256SUMS.txt nennt nicht genau die übrigen Dateien des Archivs in seiner Reihenfolge, je eine Zeile." });
  }
  return abw;
}

export function pruefeAktenauszug(az: Aktenauszug, bindungen: { name: string; bindung: Dokumentbindung }[], aussagen: Aussage[]): void {
  const k = { aussagen, datei: az.name };
  const fund = `Datei „${az.name}“`;
  const { summen, fehler } = leseSummen(az.summenText);
  const basis = az.summenPfad.includes("/") ? az.summenPfad.slice(0, az.summenPfad.lastIndexOf("/") + 1) : "";
  const nachPfad = new Map(az.dateien.map((d) => [d.pfad, d]));
  const abw: Detail[] = fehler.map((t) => ({ text: `SHA256SUMS.txt: ${t}` }));
  const geprueft: AktenDatei[] = [];
  for (const [pfad, h] of summen) {
    const d = nachPfad.get(basis + pfad) ?? nachPfad.get(pfad);
    if (!d) {
      abw.push({ text: `${pfad}: in SHA256SUMS.txt genannt, fehlt aber im ZIP.` });
      continue;
    }
    nachPfad.delete(d.pfad);
    if (d.sha256 !== h) abw.push({ text: `${pfad}: Die SHA-256 der Datei (${d.sha256}) ist nicht die in SHA256SUMS.txt.` });
    else geprueft.push(d);
  }
  nachPfad.delete(az.summenPfad);
  const uebrig = [...nachPfad.values()];
  if (!summen.size && !fehler.length) abw.push({ text: "SHA256SUMS.txt ist leer." });
  if (abw.length) {
    sage(k, "P8", "widerlegt", "Die Dokumente im Aktenauszug sind nicht unverändert.", `WATTest hat die SHA-256 jeder Datei im ZIP berechnet und mit SHA256SUMS.txt verglichen (5.1, 8., Schritt 8).`, { fundstelle: fund, grenze: GRENZE.aktenauszug, details: abw });
  } else {
    sage(k, "P8", "bestaetigt", "Die Dokumente im Aktenauszug sind unverändert.", `Die SHA-256 aller ${anzahl(geprueft.length, "Datei", "Dateien")} stimmt mit SHA256SUMS.txt überein (5.1, 8., Schritt 8).`, {
      fundstelle: fund,
      grenze: GRENZE.aktenauszug,
      details: geprueft.map((d) => ({ text: `${d.pfad}: ${d.sha256}` })),
    });
  }
  if (uebrig.length) {
    sage(k, "P8", "hinweis", `${anzahl(uebrig.length, "Datei im ZIP steht", "Dateien im ZIP stehen")} nicht in SHA256SUMS.txt.`, "Diese Dateien deckt die Liste der Prüfsummen nicht ab; WATTest prüft sie nicht.", { fundstelle: fund, details: uebrig.map((d) => ({ text: `${d.pfad}: ${d.sha256}` })) });
  }
  // Aufbau nach 6.3 (U-26): PRUEFEN.txt gibt es ab Formatversion 19; ohne sie kann das ZIP aus einer älteren Fassung
  // stammen, deren Aufbau die TE nicht festlegt. Eine Abweichung belegt keine Veränderung der Dokumente (das zeigen
  // die Prüfsummen), aber so schreibt WATT das Archiv nie: „nicht bestätigbar“ (4.8).
  const innen = (pfad: string): string | null => (pfad.startsWith(basis) ? pfad.slice(basis.length) : null);
  if (az.dateien.some((d) => innen(d.pfad) === "PRUEFEN.txt")) {
    const aufbau = pruefeAufbau(az, innen);
    if (aufbau.length) {
      sage(k, "P8", "offen", "Der Aufbau des ZIP-Archivs weicht von 6.3 ab.", "WATT schreibt das ZIP zum Aktenauszug ab Formatversion 19 immer nach 6.3: Ordner Eintrag_NN mit bereinigten Dateinamen, in der Wurzel nur Technische-Erlaeuterung.pdf, PRUEFEN.txt und als letzte Datei SHA256SUMS.txt mit einer Zeile je anderer Datei, alle Einträge mit derselben Änderungszeit. Ein anderer Aufbau belegt keine Veränderung der Dokumente; dass das Archiv so aus WATT stammt, lässt sich aber nicht bestätigen (4.8).", { fundstelle: fund, grenze: GRENZE.aktenauszug, details: aufbau });
    } else {
      sage(k, "P8", "bestaetigt", "Der Aufbau des ZIP-Archivs entspricht 6.3.", "Ordner Eintrag_NN mit bereinigten Dateinamen, in der Wurzel nur Technische-Erlaeuterung.pdf, PRUEFEN.txt (UTF-8 ohne BOM, CRLF) und als letzte Datei SHA256SUMS.txt (ohne BOM, LF, eine Zeile je anderer Datei in Archivreihenfolge), alle Einträge mit derselben Änderungszeit.", { fundstelle: fund, grenze: GRENZE.aktenauszug });
    }
  } else {
    sage(k, "P8", "hinweis", "Das ZIP enthält keine PRUEFEN.txt; seinen Aufbau prüft WATTest nicht.", "PRUEFEN.txt liegt ab Formatversion 19 im ZIP des Aktenauszugs; erst dafür legt die Technische Erläuterung den Aufbau fest (6.3). WATTest prüft hier nur die Dateien gegen SHA256SUMS.txt.", { fundstelle: fund });
  }
  // Seit Formatversion 19 liegen die Originaldokumente in Ordnern Eintrag_NN; daneben stehen die Technische
  // Erläuterung als PDF und PRUEFEN.txt (6.3). Sie sind keine Nachweise und gehen nicht in die Nachweiskette ein.
  const relativ = (pfad: string): string => (basis && pfad.startsWith(basis) ? pfad.slice(basis.length) : pfad);
  const inOrdner = (d: AktenDatei): boolean => /^Eintrag_\d+\//.test(relativ(d.pfad));
  const pdfs = geprueft.filter((d) => /\.pdf$/i.test(d.pfad));
  const mitOrdnern = geprueft.some(inOrdner);
  const dokumente = mitOrdnern ? pdfs.filter(inOrdner) : pdfs;
  const beigaben = geprueft.filter((d) => !dokumente.includes(d));
  if (beigaben.length) {
    sage(k, "P8", "hinweis", `${anzahl(beigaben.length, "Datei im Aktenauszug ist", "Dateien im Aktenauszug sind")} kein Nachweis.`, "Neben den Originaldokumenten (Ordner Eintrag_NN) enthält das ZIP des Aktenauszugs die Technische Erläuterung als PDF und die Anleitung PRUEFEN.txt zur unabhängigen Prüfung (6.3). Sie stehen in SHA256SUMS.txt und sind damit geprüft, gehören aber zu keiner Anzeige und nicht zur Nachweiskette.", {
      fundstelle: fund,
      details: beigaben.map((d) => ({ text: `${d.pfad}${/(^|\/)PRUEFEN\.txt$/.test(d.pfad) ? " (Anleitung zur unabhängigen Prüfung)" : ""}` })),
    });
  }
  if (!bindungen.length) {
    sage(k, "P8", "offen", "Die Dokumente im Aktenauszug sind nicht mit einer Nachweiskette abgeglichen.", "Ohne zugleich geladenen Klartext-Export lässt sich nicht prüfen, ob die Dokumente zu den Nachweisen in der Nachweiskette gehören. Dazu lässt sich der Klartext-Export derselben Person hinzufügen.", { fundstelle: fund, grenze: GRENZE.aktenauszug });
    return;
  }
  const treffer: Detail[] = [];
  const ohne: Detail[] = [];
  for (const d of dokumente) {
    const b = bindungen.map((x) => ({ name: x.name, t: x.bindung.get(d.sha256) })).find((x) => x.t);
    if (b) treffer.push({ text: `${d.pfad}: Dokument ${b.t!.dateiname} der Anzeige ${b.t!.anzeige}, Nachweisglied ${b.t!.glied} (Datei „${b.name}“)` });
    else ohne.push({ text: `${d.pfad}: in keiner Anzeige der Nachweiskette` });
  }
  if (!dokumente.length) return;
  if (ohne.length) {
    sage(k, "P8", "offen", `${anzahl(ohne.length, "Dokument im Aktenauszug findet", "Dokumente im Aktenauszug finden")} sich nicht in der Nachweiskette.`, "WATTest hat die SHA-256 jedes PDF mit den Dokumenten der gesendeten Anzeigen verglichen, deren Prüfsumme die Nachweiskette bestätigt. Für diese Dokumente gibt es keinen Treffer, etwa weil die Anzeige gelöscht wurde oder das Dokument nicht aus einer Anzeige stammt.", {
      fundstelle: fund,
      grenze: GRENZE.aktenauszug,
      details: [...ohne, ...treffer],
    });
  } else {
    sage(k, "P8", "bestaetigt", "Die Dokumente im Aktenauszug gehören zu Nachweisen in der Nachweiskette.", `Jedes der ${anzahl(dokumente.length, "PDF", "PDFs")} ist ein Dokument einer gesendeten Anzeige, deren Prüfsumme die Nachweiskette bestätigt (5.1).`, {
      fundstelle: fund,
      grenze: GRENZE.nachweis,
      details: treffer,
    });
  }
}
