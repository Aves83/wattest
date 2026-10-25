// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P6 Signaturen und P7 Attestierung (Technische Erläuterung 4.7, Prüfverfahren für die Signaturen).

import { ATTESTIERUNG_OID, leseSchluesselbeschreibung, type Schluesselbeschreibung } from "./attestierung.js";
import { anzahl, bereiche, zahl, type Detail, type Zeichen } from "./befund.js";
import { ausBase64, ausHex, gleich, hex, utf8, verbinde } from "./bytes.js";
import { GRENZE, GRENZE_HAERTUNG, GRENZWERTE, grenzeText } from "./grenzen.js";
import { gliedName, liste, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext, type SignaturStatus } from "./kontext.js";
import { sha256Hex } from "./sha.js";
import { ecdsaLesbar, istSigniertVon, leseZertifikat, pruefeSignatur, type Zertifikat } from "./x509.js";
import { deutsch, deutschTag } from "./zeit.js";

const ECDSA_SHA256 = "1.2.840.10045.4.3.2";

interface Schluessel {
  fingerabdruck: string;
  /** alle Zertifikate, nur wenn alle lesbar sind */
  zertifikate: Zertifikat[];
  /** Blattzertifikat, wenn es lesbar ist; genügt für die Signaturen */
  blatt: Zertifikat | null;
  /** DER aller Zertifikate, null, wenn eines kein Base64 ist oder über der Grenze liegt */
  der: Uint8Array[] | null;
  /** Lesefehler oder überschrittene Grenze: „?“, nie ✗ */
  unlesbar: string | null;
  /** echter Widerspruch (Fingerabdruck passt nicht zum Blattzertifikat): ✗ */
  widerspruch: string | null;
}

function kurz(fp: string): string {
  return fp.slice(0, 16) + "…";
}

/** Längste Base64-Darstellung von n Bytes, mit etwas Raum für Zeilenumbrüche. */
function base64Laenge(n: number): number {
  return Math.ceil(n / 3) * 4 + 256;
}

async function leseSchluessel(k: Kontext): Promise<Map<string, Schluessel>> {
  const out = new Map<string, Schluessel>();
  for (const e of liste(k.kt.daten["kettenschluessel"])) {
    const fp = String(e["fingerabdruck"] ?? "").slice(0, 200);
    const s: Schluessel = { fingerabdruck: fp, zertifikate: [], blatt: null, der: null, unlesbar: null, widerspruch: null };
    out.set(fp, s);
    const z = Array.isArray(e["zertifikate"]) ? (e["zertifikate"] as unknown[]) : [];
    if (!z.length) {
      s.unlesbar = `Zum Schlüssel ${kurz(fp)} stehen keine Zertifikate in kettenschluessel.`;
      continue;
    }
    if (z.length > GRENZWERTE.zertifikateJeSchluessel) {
      s.unlesbar = `Zum Schlüssel ${kurz(fp)} stehen ${zahl(z.length)} Zertifikate, mehr als die Grenze von ${GRENZWERTE.zertifikateJeSchluessel}.`;
      continue;
    }
    const der: Uint8Array[] = [];
    const fehler: string[] = [];
    const max = base64Laenge(GRENZWERTE.zertifikatBytes);
    for (const [i, b] of z.entries()) {
      const t = typeof b === "string" ? b : "";
      const d = t.length > max ? null : ausBase64(t);
      if (t.length > max || (d && d.length > GRENZWERTE.zertifikatBytes)) fehler.push(`Zertifikat ${i + 1} ist größer als die Grenze von ${grenzeText(GRENZWERTE.zertifikatBytes, "bytes")}`);
      else if (!d) fehler.push(`Zertifikat ${i + 1} ist kein Base64`);
      else der.push(d);
    }
    if (fehler.length) {
      s.unlesbar = `Die Zertifikate zum Schlüssel ${kurz(fp)} sind nicht lesbar: ${fehler.join("; ")}.`;
      continue;
    }
    s.der = der;
    const gelesen: (Zertifikat | null)[] = der.map((d, i) => {
      try {
        return leseZertifikat(d);
      } catch (err) {
        fehler.push(`Zertifikat ${i + 1}: ${(err as Error).message}`);
        return null;
      }
    });
    s.blatt = gelesen[0] ?? null;
    if (fehler.length) s.unlesbar = `Die Zertifikate zum Schlüssel ${kurz(fp)} sind nicht lesbar (${fehler.join("; ")}). Ein Lesefehler ist kein Befund über die Herkunft.`;
    else s.zertifikate = gelesen as Zertifikat[];
    if (s.blatt) {
      const blattFp = await sha256Hex(s.blatt.spki);
      if (blattFp !== fp) s.widerspruch = `Der Fingerabdruck ${kurz(fp)} passt nicht zum öffentlichen Schlüssel des Blattzertifikats (${kurz(blattFp)}).`;
    }
  }
  return out;
}

function keineSignatur(v: number | null): string {
  return `Diese Fassung von WATT (Datenformat ${v ?? "unbekannt"}) signiert noch nicht; die Herkunft lässt sich deshalb nicht bestätigen.`;
}

export async function pruefeSignaturen(k: Kontext): Promise<void> {
  const g = k.kt.glieder;
  const version = k.kt.version;
  const fund = dateiFundstelle(k);
  if (version === null || version < 19) {
    // Vor Datenformat 19 nur ein „?“ in P6; P7 entfällt als Hinweis (Auftrag 0.1.5, B4).
    sage(k, "P6", "offen", keineSignatur(version), `Die Datei hat das Datenformat ${version ?? "unbekannt"}. Signaturen und Schlüssel der Kette gibt es erst ab Datenformat 19; ohne Signatur bleibt offen, ob die Kette in WATT entstand. Das ist kein negativer Befund über diese Datei.`, {
      fundstelle: fund,
      grenze: GRENZE.signatur,
      ...(version !== null ? { kennung: "ohne-signatur" as const } : {}),
    });
    sage(k, "P7", "hinweis", "Entfällt (keine Signatur).", "Ohne Signatur gibt es keinen Schlüssel der Kette, dessen Bestätigung durch Android sich prüfen ließe (4.7).", { fundstelle: fund });
    return;
  }
  const schluesselListe = liste(k.kt.daten["kettenschluessel"]);
  if (schluesselListe.length > GRENZWERTE.schluessel) {
    const begr = `Die Datei nennt ${zahl(schluesselListe.length)} Schlüssel in kettenschluessel, mehr als die Grenze von ${GRENZWERTE.schluessel}. WATTest prüft Signaturen und Attestierung dann nicht; das ist kein Befund über die Datei.`;
    sage(k, "P6", "offen", "Die Signaturen lassen sich nicht prüfen: zu viele Schlüssel.", begr, { fundstelle: fund, grenze: GRENZE_HAERTUNG });
    sage(k, "P7", "offen", "Die Attestierung lässt sich nicht prüfen: zu viele Schlüssel.", begr, { fundstelle: fund, grenze: GRENZE_HAERTUNG });
    return;
  }
  const schluessel = await leseSchluessel(k);
  const schluesselGlieder = g.filter((x) => x.objektArt === "schluessel");
  const alleSignaturen = liste(k.kt.daten["kettensignaturen"]);
  const zuViele = alleSignaturen.length > GRENZWERTE.signaturen;
  const sigListe = zuViele ? [] : alleSignaturen;
  if (zuViele) {
    sage(k, "P6", "offen", "Die Signaturen lassen sich nicht prüfen: zu viele Signaturen.", `Die Datei enthält ${zahl(alleSignaturen.length)} Signaturen, mehr als die Grenze von ${grenzeText(GRENZWERTE.signaturen)}. WATTest prüft sie nicht; das ist kein Befund über die Datei.`, { fundstelle: fund, grenze: GRENZE_HAERTUNG });
  }

  // Abschnitte: vom Glied schluessel bis vor das nächste (4.7, Schritt 7).
  // Ein Glied schluessel, dessen daten über der Grenze liegt, ergibt einen nicht lesbaren Abschnitt (UNLESBAR).
  const UNLESBAR = "?";
  const abschnitt: (string | null)[] = [];
  let aktuell: string | null = null;
  for (const x of g) {
    if (x.objektArt === "schluessel") aktuell = x.datenUeberGrenze ? UNLESBAR : x.json?.["status"] === "verfuegbar" ? String(x.json?.["fingerabdruck"] ?? x.objektId) : null;
    abschnitt.push(aktuell);
  }
  const indexVon = new Map<number, number>();
  g.forEach((x, i) => x.seq !== null && !indexVon.has(x.seq) && indexVon.set(x.seq, i));
  const letzteSeq = g.length ? g[g.length - 1]!.seq : null;

  const ungueltig: Detail[] = [];
  const unpruefbar: { text: string; seq: number | null }[] = [];
  const gueltigSeq: number[] = [];
  const anzahlJeSeq = new Map<number, number>();
  const setze = (seq: number, s: SignaturStatus): void => {
    const vorher = k.signaturen.get(seq);
    if (vorher === "ungueltig" || (vorher === "gueltig" && s === "unpruefbar")) return;
    k.signaturen.set(seq, s);
  };
  const maxSig = base64Laenge(GRENZWERTE.signaturBytes);
  let n = 0;
  for (const s of sigListe) {
    n++;
    if (n % 128 === 0) k.melde(0.6 + (0.2 * n) / sigListe.length, `Signaturen: ${zahl(n)} von ${zahl(sigListe.length)}`);
    const roh = s["seq"];
    const fp = String(s["fingerabdruck"] ?? "").slice(0, 200);
    // seq nicht genau lesbar, außerhalb der Kette oder doppelt: „?“ mit Fundstelle (Auftrag 0.1.5, A6).
    if (typeof roh !== "number" || !Number.isSafeInteger(roh)) {
      unpruefbar.push({ text: `Signatur Nr. ${zahl(n)} in kettensignaturen nennt keine Gliednummer, die WATTest genau lesen kann (${String(roh).slice(0, 40)}).`, seq: null });
      continue;
    }
    const seq = roh;
    anzahlJeSeq.set(seq, (anzahlJeSeq.get(seq) ?? 0) + 1);
    const i = indexVon.get(seq);
    if (i === undefined) {
      const ausserhalb = letzteSeq !== null && (seq < 1 || seq > letzteSeq);
      unpruefbar.push({ text: `Signatur zu Glied ${seq}: Dieses Glied gibt es in der Kette nicht${ausserhalb ? ` (sie reicht von Glied 1 bis ${letzteSeq})` : ""}.`, seq: null });
      setze(seq, "unpruefbar");
      continue;
    }
    const glied = g[i]!;
    if (abschnitt[i] === UNLESBAR) {
      unpruefbar.push({ text: `Signatur zu ${gliedName(glied)}: Das Glied schluessel dieses Abschnitts ist nicht lesbar (daten über der Grenze der Verschachtelung).`, seq });
      setze(seq, "unpruefbar");
      continue;
    }
    if (abschnitt[i] !== fp) {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)}: Sie nennt den Schlüssel ${kurz(fp)}, das Glied liegt aber im Abschnitt ${abschnitt[i] ? `des Schlüssels ${kurz(abschnitt[i]!)}` : "ohne Schlüssel"}.` });
      setze(seq, "ungueltig");
      continue;
    }
    const sch = schluessel.get(fp);
    if (sch?.widerspruch) {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)}: Der Schlüssel ${kurz(fp)} passt nicht zu seinem Blattzertifikat.` });
      setze(seq, "ungueltig");
      continue;
    }
    if (!sch || !sch.blatt) {
      unpruefbar.push({ text: `Signatur zu ${gliedName(glied)}: ${!sch ? `Der Schlüssel ${kurz(fp)} fehlt in kettenschluessel.` : (sch.unlesbar ?? `Der Schlüssel ${kurz(fp)} ist nicht lesbar.`)}`, seq });
      setze(seq, "unpruefbar");
      continue;
    }
    const text = String(s["signatur"] ?? "");
    const sig = text.length > maxSig ? null : ausBase64(text);
    if (text.length > maxSig || (sig && sig.length > GRENZWERTE.signaturBytes)) {
      unpruefbar.push({ text: `Signatur zu ${gliedName(glied)} ist länger als die Grenze von ${GRENZWERTE.signaturBytes} Bytes.`, seq });
      setze(seq, "unpruefbar");
      continue;
    }
    if (!sig || !ecdsaLesbar(sig)) {
      unpruefbar.push({ text: `Signatur zu ${gliedName(glied)} ist nicht lesbar (${!sig ? "kein Base64" : "keine ECDSA-Signatur in DER"}).`, seq });
      setze(seq, "unpruefbar");
      continue;
    }
    let ok: boolean;
    try {
      ok = await pruefeSignatur(sch.blatt.spki, ECDSA_SHA256, sig, utf8(`watt-kopf-1:${glied.hash}`));
    } catch (err) {
      unpruefbar.push({ text: `Signatur zu ${gliedName(glied)} lässt sich nicht prüfen (${(err as Error).message}).`, seq });
      setze(seq, "unpruefbar");
      continue;
    }
    if (ok) {
      gueltigSeq.push(seq);
      setze(seq, "gueltig");
    } else {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)} ist ungültig: Sie passt nicht zu watt-kopf-1:<hash des Glieds> und dem öffentlichen Schlüssel ${kurz(fp)}.` });
      setze(seq, "ungueltig");
    }
  }
  for (const [seq, m] of anzahlJeSeq) if (m > 1 && indexVon.has(seq)) unpruefbar.push({ text: `Zu Glied ${seq} stehen ${m} Signaturen; nach 4.7 signiert WATT einen noch unsignierten Kopf (U-23).`, seq });
  k.melde(0.8, "Signaturen geprüft");

  for (const s of schluessel.values()) {
    if (s.widerspruch) ungueltig.unshift({ text: s.widerspruch });
  }

  if (!schluesselGlieder.length && !alleSignaturen.length) {
    sage(k, "P6", "offen", "Die Kette ist nicht signiert.", "Die Kette enthält kein Glied schluessel und keine Signaturen (kettensignaturen). Einträge ohne gültige Signatur bleiben ohne Nachweis der Herkunft aus WATT (Technische Erläuterung, Abschnitt 9).", { fundstelle: fund, grenze: GRENZE.signatur });
    sage(k, "P7", "offen", "Die Kette nennt keinen bestätigten Schlüssel.", "Ohne Glied schluessel und ohne kettenschluessel gibt es keine Attestierung zu prüfen.", { fundstelle: fund, grenze: GRENZE.attestierung });
    return;
  }

  const nichtVerfuegbar = schluesselGlieder.filter((x) => x.json?.["status"] !== "verfuegbar");
  if (ungueltig.length) {
    sage(k, "P6", "widerlegt", ungueltig.length === 1 ? "Eine Signatur der Kette ist ungültig." : `${anzahl(ungueltig.length, "Signatur ist", "Signaturen sind")} ungültig oder passen nicht zur Kette.`, "WATTest hat jede Signatur in kettensignaturen mit dem öffentlichen Schlüssel aus dem Blattzertifikat ihres Abschnitts über die ASCII-Nachricht watt-kopf-1:<hash> geprüft (4.7, Schritt 7). Eine ungültige Signatur zeigt, dass Kette, Signatur oder Schlüssel nachträglich verändert wurden.", {
      fundstelle: fund,
      grenze: GRENZE.signatur,
      details: ungueltig,
    });
  }
  if (unpruefbar.length) {
    const nummern = unpruefbar.flatMap((u) => (u.seq !== null ? [u.seq] : []));
    sage(
      k,
      "P6",
      "offen",
      `${anzahl(unpruefbar.length, "Signatur lässt", "Signaturen lassen")} sich nicht prüfen.`,
      `WATTest prüft nur Signaturen, die es vollständig lesen kann: zu einem Glied dieser Kette, eine je Glied, höchstens ${GRENZWERTE.signaturBytes} Bytes, als ECDSA-Signatur in DER, mit einem lesbaren Schlüssel aus kettenschluessel (4.7, Schritt 7). Diese Signaturen sind weder bestätigt noch widerlegt; ein Lesefehler ist kein Befund über die Kette.`,
      { fundstelle: nummern.length ? dateiFundstelle(k, `Glied ${bereiche(nummern)}`) : fund, grenze: GRENZE_HAERTUNG, details: unpruefbar.map((u) => ({ text: u.text })) },
    );
  }

  let hoechste: number | null = null;
  for (const s of gueltigSeq) if (hoechste === null || s > hoechste) hoechste = s;
  const hi = hoechste !== null ? indexVon.get(hoechste)! : -1;
  if (hoechste !== null) {
    const kopf = g[hi]!;
    const bruch = k.ersterBruch !== null && k.ersterBruch <= hi;
    sage(
      k,
      "P6",
      bruch ? "widerlegt" : "bestaetigt",
      bruch ? `Die Signatur von Glied ${hoechste} deckt einen veränderten Inhalt.` : `Der Stand bis Glied ${hoechste} ist mit dem Schlüssel der Kette signiert.`,
      bruch
        ? `Die Signatur von Glied ${hoechste} ist gültig, aber die Kette ist vorher unterbrochen (${gliedName(g[k.ersterBruch!]!)}); der Inhalt passt nicht mehr zum signierten Kopf.`
        : `${anzahl(gueltigSeq.length, "Signatur ist", "Signaturen sind")} gültig, die jüngste über Glied ${hoechste} (${kopf.ms !== null ? deutsch(kopf.ms) : kopf.zeitpunkt}). Über die Hash-Kette deckt sie alle Glieder davor mit: Der Stand bis dahin lag zu diesem Zeitpunkt in einer App mit diesem Schlüssel (4.7). Ob der Schlüssel zu WATT auf einem bestätigten Gerät gehört, zeigt P7.`,
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(gueltigSeq, 8)}`), grenze: GRENZE.signatur },
    );
  }
  if (hi < g.length - 1) {
    const ab = g[hi + 1]!;
    const bis = g[g.length - 1]!;
    sage(
      k,
      "P6",
      "offen",
      hoechste === null ? "Kein Glied der Kette trägt eine gültige Signatur." : `${ab.seq === bis.seq ? `Glied ${ab.seq} ist` : `Die Glieder ${ab.seq} bis ${bis.seq} sind`} nicht signiert.`,
      `Nach ${hoechste === null ? "keinem Glied" : `Glied ${hoechste}`} folgt keine gültige Signatur mehr; für diese Glieder fehlt der Nachweis, dass sie in WATT entstanden.${nichtVerfuegbar.length ? ` Die Kette vermerkt, dass kein Schlüssel verfügbar war: ${nichtVerfuegbar.map((x) => `${gliedName(x)}${x.json?.["grund"] ? ` (Grund: ${String(x.json["grund"])})` : ""}`).join("; ")}.` : ""}`,
      { fundstelle: dateiFundstelle(k, ab.seq === bis.seq ? `Glied ${ab.seq}` : `Glied ${ab.seq} bis ${bis.seq}`), grenze: GRENZE.signatur },
    );
  }

  // Übersicht der Abschnitte, eingespielte Glieder und Befund der Wiederherstellungen.
  const letzteWiederh = g.map((x) => x.objektArt).lastIndexOf("wiederherstellung");
  const teile: Detail[] = [];
  let start = 0;
  let abschnitte = 0;
  for (let i = 1; i <= g.length; i++) {
    if (i < g.length && abschnitt[i] === abschnitt[start] && !(letzteWiederh >= 0 && i === letzteWiederh)) continue;
    const von = g[start]!.seq;
    const bis = g[i - 1]!.seq;
    const fp = abschnitt[start];
    const sigs = gueltigSeq.filter((s) => s >= (von ?? 0) && s <= (bis ?? 0));
    const eingespielt = letzteWiederh >= 0 && i - 1 < letzteWiederh;
    abschnitte++;
    teile.push({
      text: `Glied ${von}${von !== bis ? `–${bis}` : ""}: ${fp ? `Schlüssel ${kurz(fp)}, ${anzahl(sigs.length, "gültige Signatur", "gültige Signaturen")}${sigs.length ? `, jüngste bei Glied ${sigs.reduce((a, b) => (b > a ? b : a))}` : ""}` : "ohne Schlüssel (nicht einzeln signiert; eine spätere Signatur deckt sie über die Hash-Kette mit)"}${eingespielt ? "; eingespielt mit der Wiederherstellung, ihre Herkunft zeigen nur ihre eigenen Signaturen" : ""}.`,
    });
    start = i;
  }
  for (const x of g.filter((y) => y.objektArt === "wiederherstellung")) {
    const s = x.json?.["signaturen"];
    if (s !== undefined) teile.push({ text: `${gliedName(x)}: WATT vermerkte beim Einspielen „${String(s)}“${s === "UNGUELTIG" ? ` ab Glied ${String(x.json?.["signaturenUngueltigAb"] ?? "?")}` : ""}.` });
  }
  sage(k, "P6", "hinweis", `Die Kette hat ${anzahl(abschnitte, "Abschnitt", "Abschnitte")} nach Schlüsseln.`, "Ein Abschnitt reicht vom Glied schluessel bis vor das nächste (4.7). Glieder vor einem Glied wiederherstellung wurden eingespielt; ihre Herkunft zeigen nur ihre eigenen, mitgelieferten Signaturen, nicht spätere.", {
    fundstelle: fund,
    details: teile,
  });

  await pruefeAttestierung(k, schluessel, schluesselGlieder);
}

async function pruefeAttestierung(k: Kontext, schluessel: Map<string, Schluessel>, schluesselGlieder: Glied[]): Promise<void> {
  const g = k.kt.glieder;
  const verfuegbar = schluesselGlieder.filter((x) => x.json?.["status"] === "verfuegbar");
  if (!verfuegbar.length) {
    sage(k, "P7", "offen", "Die Kette nennt keinen bestätigten Schlüssel.", "Kein Glied schluessel hat den Status verfuegbar; die Bestätigung durch Android ist nicht gelungen (4.7).", { fundstelle: dateiFundstelle(k), grenze: GRENZE.attestierung });
    return;
  }
  const o = k.optionen;
  let wurzeln: Zertifikat[] = [];
  try {
    wurzeln = o.wurzeln.map((d) => leseZertifikat(d));
  } catch {
    wurzeln = [];
  }
  const einzeln = verfuegbar.length === 1;
  for (const x of verfuegbar) {
    const d = x.json!;
    const fp = String(d["fingerabdruck"] ?? x.objektId);
    const pruefungen: { z: Zeichen; text: string }[] = [];
    const add = (z: Zeichen, text: string): void => {
      pruefungen.push({ z, text });
    };
    const sch = schluessel.get(fp);
    const T = x.ms;
    // Fehlender Eintrag und Lesefehler sind „?“; ✗ nur bei einem Widerspruch in lesbaren Daten (E-4, Auftrag 0.1.5).
    if (!sch) add("offen", `Zum Fingerabdruck ${kurz(fp)} fehlt der Eintrag in kettenschluessel; die Attestierung lässt sich nicht prüfen.`);
    else {
      // 6. Fingerabdruck und Zertifikate im Glied
      if (x.objektId !== fp) add("widerlegt", `Die Kennung des Glieds (${kurz(x.objektId)}) ist nicht der Fingerabdruck ${kurz(fp)}.`);
      if (sch.widerspruch) add("widerlegt", sch.widerspruch);
      if (sch.der) {
        const zs = await sha256Hex(verbinde(sch.der));
        if (String(d["zertifikateSha256"] ?? "") !== zs) add("widerlegt", "zertifikateSha256 im Glied passt nicht zu den Zertifikaten in kettenschluessel.");
        else add("bestaetigt", sch.widerspruch ? "zertifikateSha256 im Glied passt zu den Zertifikaten." : "Fingerabdruck und zertifikateSha256 im Glied passen zu den Zertifikaten.");
      }
      if (sch.unlesbar) add("offen", sch.unlesbar);
    }
    if (sch && sch.zertifikate.length) {
      const z = sch.zertifikate;
      // 1. Kette bis zur Wurzel
      let kette = true;
      for (let i = 0; i + 1 < z.length; i++) {
        let ok = false;
        try {
          ok = gleich(z[i]!.aussteller, z[i + 1]!.inhaber) && (await istSigniertVon(z[i]!, z[i + 1]!.spki));
        } catch {
          ok = false;
        }
        if (!ok) {
          kette = false;
          add("widerlegt", `Zertifikat ${i + 1} ist nicht vom Zertifikat ${i + 2} der Kette signiert.`);
          break;
        }
      }
      const letztes = z[z.length - 1]!;
      if (kette) {
        if (!wurzeln.length) add("offen", "Die Wurzeln von Google sind nicht verfügbar; die Kette lässt sich nicht bis zu einer Wurzel prüfen.");
        else {
          let wurzel = wurzeln.find((w) => gleich(w.spki, letztes.spki));
          if (!wurzel) {
            for (const w of wurzeln) {
              try {
                if (gleich(letztes.aussteller, w.inhaber) && (await istSigniertVon(letztes, w.spki))) {
                  wurzel = w;
                  break;
                }
              } catch {
                /* nächste Wurzel */
              }
            }
          }
          if (wurzel) add("bestaetigt", `Die Zertifikatskette (${anzahl(z.length, "Zertifikat", "Zertifikate")}) führt zur Wurzel ${wurzel.inhaberText || wurzel.seriennummer}.`);
          else add("widerlegt", "Die Zertifikatskette führt zu keiner der Wurzeln von Google.");
        }
      }
      // Erweiterung
      const ext = z[0]!.erweiterungen.find((e) => e.oid === ATTESTIERUNG_OID);
      let kd: Schluesselbeschreibung | null = null;
      if (!ext) add("offen", "Das Blattzertifikat enthält keine Bestätigung von Android (Erweiterung 1.3.6.1.4.1.11129.2.1.17).");
      else {
        try {
          kd = leseSchluesselbeschreibung(ext.wert);
          if (kd.unlesbar.length) add("offen", `Die Bestätigung von Android enthält Angaben, die WATTest nicht genau lesen kann: ${kd.unlesbar.join("; ")}.`);
        } catch (err) {
          add("offen", `Die Bestätigung von Android ist nicht lesbar (${(err as Error).message}).`);
        }
      }
      // 1. Gültigkeit aller Zertifikate zu einem Bezugszeitpunkt, Grenzen eingeschlossen: der Zeitpunkt des Glieds
      // schluessel; beim Vorratsschlüssel der leeren Kette (Glied mit challenge) creationDateTime, ohne es der
      // Zeitpunkt des Glieds (4.7, Schritt 1; U-16).
      const erzeugt = typeof d["challenge"] === "string" && kd && kd.erzeugtAm !== null && Number.isSafeInteger(kd.erzeugtAm) ? kd.erzeugtAm : null;
      const bezug = erzeugt ?? T;
      if (bezug !== null) {
        const wann = erzeugt !== null ? `zum Zeitpunkt der Erzeugung laut creationDateTime (${deutsch(bezug)})` : `zum Zeitpunkt des Glieds (${deutsch(bezug)})`;
        const ausserhalb = z.map((c, i) => ({ c, i })).filter(({ c }) => bezug < c.nichtVor || bezug > c.nichtNach);
        if (ausserhalb.length) add("offen", `${wann[0]!.toUpperCase()}${wann.slice(1)} war ${ausserhalb.map(({ i }) => `Zertifikat ${i + 1}`).join(", ")} nicht gültig; die Uhr des Geräts ging womöglich falsch.`);
        else add("bestaetigt", `Alle Zertifikate waren ${wann} gültig.`);
        const zwischen = z[1];
        if (zwischen && bezug < zwischen.nichtVor) add("hinweis", `Der Bezugszeitpunkt liegt vor dem Beginn der Gültigkeit des Zwischenzertifikats (${deutschTag(zwischen.nichtVor)}); das ist nur eine grobe Untergrenze.`);
        else if (zwischen) add("hinweis", `Grobe Untergrenze: Der Schlüssel entstand nicht vor dem ${deutschTag(zwischen.nichtVor)} (Beginn der Gültigkeit des Zwischenzertifikats; nur bei kurzlebigen Zwischenzertifikaten aussagekräftig).`);
      }
      // 2. Sperrliste
      const sl = o.sperrliste;
      if (!sl) add("offen", "Die Sperrliste von Google ist nicht verfügbar.");
      else {
        const gesperrt = z.map((c, i) => ({ c, i, e: sl.eintraege[c.seriennummer] })).filter((v) => v.e);
        const stand = sl.abgerufen ? `Stand ${deutsch(Date.parse(sl.abgerufen))}` : "Stand unbekannt";
        if (gesperrt.length) add("widerlegt", `${gesperrt.map(({ i, e }) => `Zertifikat ${i + 1} ist gesperrt (${e!.status}${e!.reason ? `, ${e!.reason}` : ""})`).join("; ")} (Sperrliste, ${stand}).`);
        else {
          const alt = sl.abgerufen && o.jetzt - Date.parse(sl.abgerufen) > 7 * 86400000;
          add("bestaetigt", `Kein Zertifikat steht in der Sperrliste (${stand}${alt ? "; dieser Stand ist älter als eine Woche, spätere Sperrungen kennt WATTest nicht" : ""}).`);
        }
      }
      if (kd) {
        // 3. App
        const pakete = kd.pakete.map((p) => p.name);
        if (!pakete.includes(o.paketname)) add("widerlegt", `Der Schlüssel gehört zur App ${pakete.join(", ") || "ohne Namen"}, nicht zu ${o.paketname}.`);
        else add("bestaetigt", `Paketname ${o.paketname}.`);
        if (!o.appSignatur) add("offen", "Der Fingerabdruck des App-Signaturzertifikats von WATT liegt WATTest nicht vor; die Signatur der App lässt sich nicht vergleichen.");
        else if (kd.signaturDigests.includes(o.appSignatur.toLowerCase())) add("bestaetigt", "Das Signaturzertifikat der App ist das von WATT.");
        else add("widerlegt", `Die App ist mit einem anderen Zertifikat signiert (${kd.signaturDigests.map(kurz).join(", ") || "keins genannt"}) als WATT.`);
        // 5. Sicherheitsstufe
        const st = kd.attestationSecurityLevel;
        if (st === "TEE" || st === "STRONGBOX") add("bestaetigt", `Sicherheitsstufe ${st === "TEE" ? "TEE (geschützte Hardware)" : "StrongBox"}.`);
        else add("offen", `Sicherheitsstufe ${st === "SOFTWARE" ? "Software (Emulator oder sehr altes Gerät); das ist nicht bestätigt" : "unbekannt"}.`);
        if (typeof d["sicherheitsstufe"] === "string" && d["sicherheitsstufe"] !== st) add("offen", `Das Glied nennt die Sicherheitsstufe ${String(d["sicherheitsstufe"])}, das Zertifikat ${st}.`);
        // 4. RootOfTrust
        const r = kd.rootOfTrust;
        if (!r) add("offen", "Die Bestätigung enthält keinen RootOfTrust.");
        else if (r.verifiedBootState === "VERIFIED" && r.deviceLocked) add("bestaetigt", "Verifizierter Start (Verified), Bootloader gesperrt.");
        else add("offen", `Das Gerät ist nicht als unverändert bestätigt: verifiedBootState ${r.verifiedBootState}, deviceLocked ${r.deviceLocked ? "true" : "false"}.`);
        // 6. Challenge: hash des Kopfs vor dem Glied schluessel; steht dazwischen uhr_verstellt mit objektId glied,
        // der hash des Glieds davor; bei leerer Kette die Zufallsbytes in challenge (4.7).
        const i = g.indexOf(x);
        const zwischen = i > 0 && g[i - 1]!.objektArt === "uhr_verstellt" && g[i - 1]!.objektId === "glied";
        const kopf = i === 0 ? null : zwischen ? (g[i - 2] ?? null) : g[i - 1]!;
        const zufall = typeof d["challenge"] === "string" ? (d["challenge"] as string) : null;
        if (i === 0) {
          if (zufall === null || !/^[0-9a-f]{64}$/.test(zufall)) add("widerlegt", "Das Glied schluessel einer leeren Kette nennt keine Challenge mit 64 Zeichen Hexadezimal in Kleinbuchstaben.");
          else if (gleich(ausHex(zufall)!, kd.challenge)) add("bestaetigt", "Die Challenge sind die Zufallsbytes im Glied (leere Kette).");
          else add("widerlegt", `Die Challenge im Zertifikat (${kurz(hex(kd.challenge))}) passt nicht zu den Zufallsbytes im Glied.`);
        } else {
          const erwartet = kopf ? ausHex(kopf.hash) : null;
          const wessen = kopf ? `der Prüfsumme von ${gliedName(kopf)}${zwischen ? ` (vor dem Vermerk uhr_verstellt, ${gliedName(g[i - 1]!)})` : ""}` : "";
          if (!erwartet || erwartet.length !== 32) add("widerlegt", kopf ? `${gliedName(kopf)} hat keine lesbare Prüfsumme.` : "Vor dem Vermerk uhr_verstellt steht kein Glied, dessen Prüfsumme die Challenge sein könnte.");
          else if (gleich(erwartet, kd.challenge)) add("bestaetigt", `Die Challenge ist ${wessen.replace(/^der /, "die ")}.`);
          else add("widerlegt", `Die Challenge im Zertifikat (${kurz(hex(kd.challenge))}) passt nicht zu ${wessen}.`);
          if (zufall !== null) add("offen", "Das Glied nennt eine challenge, obwohl die Kette nicht leer war; nur das Glied schluessel einer leeren Kette hat dieses Feld (4.7).");
        }
        const geraet: string[] = [];
        if (kd.osVersion) geraet.push(`Android ${Math.floor(kd.osVersion / 10000)}${kd.osVersion % 10000 ? `.${Math.floor((kd.osVersion % 10000) / 100)}` : ""}`);
        if (kd.osPatchLevel) geraet.push(`Sicherheitsupdate ${String(kd.osPatchLevel).slice(0, 4)}-${String(kd.osPatchLevel).slice(4, 6)}`);
        if (geraet.length) add("hinweis", `Laut Bestätigung: ${geraet.join(", ")}.`);
      }
    }
    const schlecht = pruefungen.some((p) => p.z === "widerlegt") ? "widerlegt" : pruefungen.some((p) => p.z === "offen") ? "offen" : "bestaetigt";
    const wer = einzeln ? "Die Kette" : `Der Schlüssel aus ${gliedName(x)}`;
    const text =
      schlecht === "bestaetigt"
        ? `${wer} stammt von WATT auf einem bestätigten Gerät.`
        : schlecht === "offen"
          ? `Dass ${einzeln ? "die Kette" : `der Schlüssel aus ${gliedName(x)}`} von WATT auf einem bestätigten Gerät stammt, lässt sich nicht bestätigen.`
          : `${wer} stammt nicht von WATT auf einem bestätigten Gerät.`;
    const sym: Record<Zeichen, string> = { bestaetigt: "✓", offen: "?", widerlegt: "✗", hinweis: "i" };
    sage(k, "P7", schlecht, text, `WATTest hat den Schlüssel ${kurz(fp)} aus ${gliedName(x)} nach dem Prüfverfahren in 4.7 geprüft: Zertifikatskette bis zu einer Wurzel von Google, Sperrliste, App, RootOfTrust, Sicherheitsstufe und Challenge.`, {
      fundstelle: dateiFundstelle(k, gliedName(x)),
      grenze: GRENZE.attestierung,
      details: pruefungen.map((p) => ({ text: `${sym[p.z]} ${p.text}` })),
    });
  }
}

