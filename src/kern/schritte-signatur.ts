// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P6 Signaturen und P7 Attestierung (Technische Erläuterung 4.7, Prüfverfahren für die Signaturen).

import { ATTESTIERUNG_OID, leseSchluesselbeschreibung, type Schluesselbeschreibung } from "./attestierung.js";
import { anzahl, bereiche, type Detail, type Zeichen } from "./befund.js";
import { ausBase64, ausHex, gleich, hex, utf8, verbinde } from "./bytes.js";
import { GRENZE } from "./grenzen.js";
import { gliedName, liste, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { sha256Hex } from "./sha.js";
import { istSigniertVon, leseZertifikat, pruefeSignatur, type Zertifikat } from "./x509.js";
import { deutsch, deutschTag } from "./zeit.js";

const ECDSA_SHA256 = "1.2.840.10045.4.3.2";

interface Schluessel {
  fingerabdruck: string;
  zertifikate: Zertifikat[];
  der: Uint8Array[];
  fehler: string | null;
}

function kurz(fp: string): string {
  return fp.slice(0, 16) + "…";
}

async function leseSchluessel(k: Kontext): Promise<Map<string, Schluessel>> {
  const out = new Map<string, Schluessel>();
  for (const e of liste(k.kt.daten["kettenschluessel"])) {
    const fp = String(e["fingerabdruck"] ?? "");
    const s: Schluessel = { fingerabdruck: fp, zertifikate: [], der: [], fehler: null };
    try {
      const z = Array.isArray(e["zertifikate"]) ? (e["zertifikate"] as unknown[]) : [];
      if (!z.length) throw new Error("ohne Zertifikate");
      for (const [i, b] of z.entries()) {
        const der = ausBase64(String(b));
        if (!der) throw new Error(`Zertifikat ${i + 1} ist kein Base64`);
        s.der.push(der);
        s.zertifikate.push(leseZertifikat(der));
      }
      const blattFp = await sha256Hex(s.zertifikate[0]!.spki);
      if (blattFp !== fp) s.fehler = `Der Fingerabdruck ${kurz(fp)} passt nicht zum öffentlichen Schlüssel des Blattzertifikats (${kurz(blattFp)}).`;
    } catch (err) {
      s.fehler = `Die Zertifikate zu ${kurz(fp)} sind nicht lesbar (${(err as Error).message}).`;
    }
    out.set(fp, s);
  }
  return out;
}

const KEINE_SIGNATUR = "Diese Version von WATT signiert noch nicht.";

export async function pruefeSignaturen(k: Kontext): Promise<void> {
  const g = k.kt.glieder;
  const version = k.kt.version ?? 0;
  const fund = dateiFundstelle(k);
  if (version < 19) {
    const begr = `Die Datei hat das Datenformat ${version}. Signaturen und Schlüssel der Kette gibt es erst ab Datenformat 19 (WATT „D“, seit 24.10.2026).`;
    sage(k, "P6", "offen", KEINE_SIGNATUR, begr, { fundstelle: fund, grenze: GRENZE.signatur });
    sage(k, "P7", "offen", KEINE_SIGNATUR, begr, { fundstelle: fund, grenze: GRENZE.attestierung });
    return;
  }
  const schluessel = await leseSchluessel(k);
  const sigListe = liste(k.kt.daten["kettensignaturen"]);
  const schluesselGlieder = g.filter((x) => x.objektArt === "schluessel");

  // Abschnitte: vom Glied schluessel bis vor das nächste (4.7, Schritt 7).
  const abschnitt: (string | null)[] = [];
  let aktuell: string | null = null;
  for (const x of g) {
    if (x.objektArt === "schluessel") aktuell = x.json?.["status"] === "verfuegbar" ? String(x.json?.["fingerabdruck"] ?? x.objektId) : null;
    abschnitt.push(aktuell);
  }
  const indexVon = new Map<number, number>();
  g.forEach((x, i) => x.seq !== null && !indexVon.has(x.seq) && indexVon.set(x.seq, i));

  const ungueltig: Detail[] = [];
  const gueltigSeq: number[] = [];
  let n = 0;
  for (const s of sigListe) {
    n++;
    if (n % 128 === 0) k.melde(0.6 + (0.2 * n) / sigListe.length, `Signaturen: ${n} von ${sigListe.length}`);
    const seq = Number(s["seq"]);
    const fp = String(s["fingerabdruck"] ?? "");
    const i = indexVon.get(seq);
    if (i === undefined) {
      ungueltig.push({ text: `Signatur zu Glied ${seq}: Dieses Glied gibt es in der Kette nicht.` });
      k.signaturen.set(seq, "ungueltig");
      continue;
    }
    const glied = g[i]!;
    if (abschnitt[i] !== fp) {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)}: Sie nennt den Schlüssel ${kurz(fp)}, das Glied liegt aber im Abschnitt ${abschnitt[i] ? `des Schlüssels ${kurz(abschnitt[i]!)}` : "ohne Schlüssel"}.` });
      k.signaturen.set(seq, "ungueltig");
      continue;
    }
    const sch = schluessel.get(fp);
    if (!sch || sch.fehler || !sch.zertifikate.length) {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)}: Der Schlüssel ${kurz(fp)} fehlt in kettenschluessel oder ist nicht lesbar.` });
      k.signaturen.set(seq, "ungueltig");
      continue;
    }
    const sig = ausBase64(String(s["signatur"] ?? ""));
    let ok = false;
    try {
      ok = !!sig && (await pruefeSignatur(sch.zertifikate[0]!.spki, ECDSA_SHA256, sig, utf8(`watt-kopf-1:${glied.hash}`)));
    } catch {
      ok = false;
    }
    if (ok) {
      gueltigSeq.push(seq);
      k.signaturen.set(seq, "gueltig");
    } else {
      ungueltig.push({ text: `Signatur zu ${gliedName(glied)} ist ungültig: Sie passt nicht zu watt-kopf-1:<hash des Glieds> und dem öffentlichen Schlüssel ${kurz(fp)}.` });
      k.signaturen.set(seq, "ungueltig");
    }
  }
  k.melde(0.8, "Signaturen geprüft");

  for (const s of schluessel.values()) {
    if (s.fehler) ungueltig.unshift({ text: s.fehler });
  }

  if (!schluesselGlieder.length && !sigListe.length) {
    sage(k, "P6", "offen", "Die Kette ist nicht signiert.", "Die Kette enthält kein Glied schluessel und keine Signaturen (kettensignaturen). Einträge ohne gültige Signatur bleiben ohne Nachweis der Herkunft aus WATT (Technische Erläuterung, Abschnitt 9).", { fundstelle: fund, grenze: GRENZE.signatur });
    sage(k, "P7", "offen", "Die Kette nennt keinen bestätigten Schlüssel.", "Ohne Glied schluessel und ohne kettenschluessel gibt es keine Attestierung zu prüfen.", { fundstelle: fund, grenze: GRENZE.attestierung });
    return;
  }

  const nichtVerfuegbar = schluesselGlieder.filter((x) => x.json?.["status"] !== "verfuegbar");
  if (ungueltig.length) {
    sage(k, "P6", "widerlegt", ungueltig.length === 1 ? "Eine Signatur der Kette ist ungültig." : `${anzahl(ungueltig.length, "Signatur ist", "Signaturen sind")} ungültig oder passen nicht zur Kette.`, "WATTest hat jede Signatur in kettensignaturen mit dem öffentlichen Schlüssel aus dem Blattzertifikat ihres Abschnitts über die ASCII-Nachricht watt-kopf-1:<hash> geprüft (4.7, Schritt 7). Eine ungültige Signatur zeigt, dass Kette, Signatur oder Schlüssel nachträglich verändert wurden.", {
      fundstelle: fund,
      grenze: GRENZE.signatur,
      details: ungueltig.slice(0, 200),
    });
  }

  const hoechste = gueltigSeq.length ? Math.max(...gueltigSeq) : null;
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
      text: `Glied ${von}${von !== bis ? `–${bis}` : ""}: ${fp ? `Schlüssel ${kurz(fp)}, ${anzahl(sigs.length, "gültige Signatur", "gültige Signaturen")}${sigs.length ? `, jüngste bei Glied ${Math.max(...sigs)}` : ""}` : "ohne Schlüssel (nicht einzeln signiert; eine spätere Signatur deckt sie über die Hash-Kette mit)"}${eingespielt ? "; eingespielt mit der Wiederherstellung, ihre Herkunft zeigen nur ihre eigenen Signaturen" : ""}.`,
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
    if (!sch || sch.fehler || !sch.zertifikate.length) {
      add("widerlegt", sch?.fehler ?? `Zum Fingerabdruck ${kurz(fp)} fehlt der Eintrag in kettenschluessel.`);
    } else {
      const z = sch.zertifikate;
      // 6. Fingerabdruck und Zertifikate im Glied
      if (x.objektId !== fp) add("widerlegt", `Die Kennung des Glieds (${kurz(x.objektId)}) ist nicht der Fingerabdruck ${kurz(fp)}.`);
      const zs = await sha256Hex(verbinde(sch.der));
      if (String(d["zertifikateSha256"] ?? "") !== zs) add("widerlegt", "zertifikateSha256 im Glied passt nicht zu den Zertifikaten in kettenschluessel.");
      else add("bestaetigt", "Fingerabdruck und zertifikateSha256 im Glied passen zu den Zertifikaten.");
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
      // Gültigkeit zum Zeitpunkt des Glieds schluessel
      if (T !== null) {
        const ausserhalb = z.map((c, i) => ({ c, i })).filter(({ c }) => T < c.nichtVor || T > c.nichtNach);
        if (ausserhalb.length) add("offen", `Zum Zeitpunkt des Glieds (${deutsch(T)}) war ${ausserhalb.map(({ i }) => `Zertifikat ${i + 1}`).join(", ")} nicht gültig; die Uhr des Geräts ging womöglich falsch.`);
        else add("bestaetigt", `Alle Zertifikate waren zum Zeitpunkt des Glieds (${deutsch(T)}) gültig.`);
        const zwischen = z[1];
        if (zwischen && T < zwischen.nichtVor) add("hinweis", `Das Glied schluessel liegt vor dem Beginn der Gültigkeit des Zwischenzertifikats (${deutschTag(zwischen.nichtVor)}); das ist nur eine grobe Untergrenze.`);
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
      // Erweiterung
      const ext = z[0]!.erweiterungen.find((e) => e.oid === ATTESTIERUNG_OID);
      let kd: Schluesselbeschreibung | null = null;
      if (!ext) add("offen", "Das Blattzertifikat enthält keine Bestätigung von Android (Erweiterung 1.3.6.1.4.1.11129.2.1.17).");
      else {
        try {
          kd = leseSchluesselbeschreibung(ext.wert);
        } catch (err) {
          add("offen", `Die Bestätigung von Android ist nicht lesbar (${(err as Error).message}).`);
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

