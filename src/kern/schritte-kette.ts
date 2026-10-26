// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P2 Arbeitszeitkette, P4 Zeit, P9 besondere Glieder.

import { anzahl, bereiche, zahl, type Detail } from "./befund.js";
import { GRENZE, GRENZE_HAERTUNG } from "./grenzen.js";
import { bestandDatenEingabe, gliedEingabe } from "./kanonisch.js";
import { gliedName, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { sha256Hex } from "./sha.js";
import { berlinTagesende, deutsch, zeitpunktMs } from "./zeit.js";

const UHR = new Set(["uhr_ruecksprung", "uhr_abweichung", "uhr_verstellt"]);
/** objektId eines uhr_ruecksprung, der ohne eigenes auslösendes Glied entsteht (4.7, 8., Schritt 5). */
const OHNE_EIGENES_GLIED = new Set(["timer", "nachweis", "start", "zeitsignal"]);
/** objektId eines uhr_verstellt außer der laufenden Nummer eines Glieds neubeginn bzw. wiederherstellung (4.7). */
const VERSTELLT_ANLAESSE = new Set(["glied", "zeitsignal", "timer", "nachweis", "start"]);
/** Glieder, nach denen die Prüfregel für den ersten Teil der Zerlegung noch nicht gilt (4.7). */
const GRENZE_DER_KETTE = new Set(["neubeginn", "wiederherstellung"]);

function wann(g: Glied): string {
  return g.ms === null ? g.zeitpunkt : deutsch(g.ms);
}

function gliedText(g: Glied): string {
  return `${gliedName(g)} (${wann(g)})`;
}

/** P2: Prüfsummen neu berechnen, Verkettung, laufende Nummern, Neubeginn. */
export async function pruefeKette(k: Kontext): Promise<void> {
  const g = k.kt.glieder;
  const fund = dateiFundstelle(k);
  if (g.length === 0) {
    sage(k, "P2", "offen", "Die Datei enthält keine Arbeitszeitkette.", "Die Liste protokoll ist leer; es gibt nichts nachzurechnen.", { fundstelle: fund });
    return;
  }
  const brueche: { index: number; text: string }[] = [];
  // Glieder mit seq oder neustarts außerhalb des genau darstellbaren Bereichs: Die Prüfsumme lässt sich nicht
  // nachrechnen, ohne die Zahl still zu runden; das ist „?“, kein Bruch.
  const ungenau: Glied[] = [];
  let sieben = 0;
  let neun = 0;
  // Glieder ohne Uhrstand nach dem ersten Glied mit Uhrstand: kein Bruch, wenn die Prüfsumme stimmt, aber
  // „nicht bestätigbar“, weil WATT sie so nie schreibt (4.2, 4.8).
  let ersterMitUhrstand: number | null = null;
  const ohneUhrstand: Glied[] = [];
  for (let i = 0; i < g.length; i++) {
    const x = g[i]!;
    k.berechnet[i] = await sha256Hex(gliedEingabe(x.roh));
    if (i % 256 === 0) k.melde((0.4 * i) / g.length, `Prüfsummen der Kette: ${zahl(i)} von ${zahl(g.length)}`);
    const name = gliedName(x);
    if (x.form === "bruch") brueche.push({ index: i, text: `${name}: nur eines der Felder neustarts und autoZeit ist vorhanden.` });
    else if (x.form === "neun") {
      neun++;
      ersterMitUhrstand ??= i;
    } else {
      sieben++;
      if (ersterMitUhrstand !== null && !x.ungenau && x.hash === k.berechnet[i]) ohneUhrstand.push(x);
    }
    if (x.ungenau) {
      ungenau.push(x);
      if (i === 0 && x.prev !== "0") brueche.push({ index: i, text: `${name}: Das erste Glied muss als Vorgänger 0 nennen.` });
      if (i > 0 && x.prev !== g[i - 1]!.hash) brueche.push({ index: i, text: `${name}: Der Vorgänger (prev) ist nicht die Prüfsumme von ${gliedName(g[i - 1]!)}.` });
      continue;
    }
    const erwartet = i === 0 ? 1 : (g[i - 1]!.seq ?? i) + 1;
    if (x.seq === null) brueche.push({ index: i, text: `Glied an Stelle ${i + 1}: seq ist keine ganze Zahl.` });
    else if (x.seq !== erwartet) {
      if (i === 0) brueche.push({ index: i, text: `Die Kette beginnt mit Glied ${x.seq} statt mit Glied 1.` });
      else if (x.seq > erwartet) brueche.push({ index: i, text: `Nach Glied ${erwartet - 1} folgt Glied ${x.seq}; ${erwartet === x.seq - 1 ? `Glied ${erwartet} fehlt` : `die Glieder ${erwartet} bis ${x.seq - 1} fehlen`}.` });
      else brueche.push({ index: i, text: `Nach Glied ${erwartet - 1} folgt noch einmal Glied ${x.seq}.` });
    }
    if (i === 0 && x.prev !== "0") brueche.push({ index: i, text: `${name}: Das erste Glied muss als Vorgänger 0 nennen.` });
    if (i > 0 && x.prev !== g[i - 1]!.hash) brueche.push({ index: i, text: `${name}: Der Vorgänger (prev) ist nicht die Prüfsumme von ${gliedName(g[i - 1]!)}.` });
    if (x.hash !== k.berechnet[i]) brueche.push({ index: i, text: `${name}: Die gespeicherte Prüfsumme passt nicht zum Inhalt des Glieds.` });
    if (x.objektArt === "neubeginn" && i > 0) brueche.push({ index: i, text: `${name}: Ein Neubeginn darf nur das erste Glied sein.` });
  }
  k.melde(0.4, "Prüfsummen der Kette berechnet");
  const letzter = g[g.length - 1]!;
  if (ungenau.length) {
    sage(
      k,
      "P2",
      "offen",
      `${ungenau.length === 1 ? "Ein Glied lässt" : `${zahl(ungenau.length)} Glieder lassen`} sich nicht nachrechnen.`,
      "seq oder neustarts liegen über 9.007.199.254.740.991 (Number.MAX_SAFE_INTEGER). Solche Zahlen stellt der Browser nicht genau dar; WATTest rundet sie nicht still, sondern lässt die Prüfsumme dieser Glieder offen. Die Verkettung über prev ist trotzdem geprüft.",
      { fundstelle: dateiFundstelle(k, `Glied an Stelle ${bereiche(ungenau.map((x) => x.index + 1))}`), grenze: GRENZE_HAERTUNG, details: ungenau.map((x) => ({ text: `Glied an Stelle ${x.index + 1}: seq ${String(x.roh.seq)}, neustarts ${String(x.roh.neustarts ?? "fehlt")}` })) },
    );
  }
  if (brueche.length === 0 && ungenau.length) {
    k.ersterBruch = null;
  } else if (brueche.length === 0) {
    k.ersterBruch = null;
    const formen = [sieben ? `${zahl(sieben)} mit sieben Feldern` : "", neun ? `${zahl(neun)} mit neun Feldern, also mit Uhrstand` : ""].filter(Boolean);
    sage(
      k,
      "P2",
      "bestaetigt",
      "Die Kette ist lückenlos und unverändert.",
      `WATTest hat die Prüfsumme aller ${anzahl(g.length, "Glieds", "Glieder")} nach 4.2 neu berechnet (${formen.join(", ")}); jede stimmt mit der gespeicherten überein, jedes Glied nennt die Prüfsumme seines Vorgängers, und die Nummern laufen ohne Lücke von 1 bis ${letzter.seq}. Kopf: Glied ${letzter.seq}, ${wann(letzter)}, SHA-256 ${letzter.hash}.`,
      { fundstelle: dateiFundstelle(k, `Glied 1 bis ${letzter.seq}`), grenze: GRENZE.kette },
    );
  } else {
    k.ersterBruch = brueche[0]!.index;
    const erster = g[k.ersterBruch]!;
    const details: Detail[] = brueche.map((b) => ({ text: b.text }));
    sage(
      k,
      "P2",
      "widerlegt",
      `Die Kette ist ab ${gliedName(erster)} unterbrochen.`,
      `WATTest hat die Prüfsummen nach 4.2 neu berechnet und die Verkettung geprüft. ${anzahl(brueche.length, "Befund passt", "Befunde passen")} nicht zu einer unveränderten Kette. Ein früherer Eintrag wurde verändert, gelöscht oder eingefügt, oder die Datei ist beschädigt.`,
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(brueche.map((b) => g[b.index]!.seq ?? b.index + 1))}`), grenze: GRENZE.kette, details },
    );
  }
  if (ohneUhrstand.length) {
    const erster = ohneUhrstand[0]!;
    sage(
      k,
      "P2",
      "offen",
      `${ohneUhrstand.length === 1 ? `Ein Glied ohne Uhrstand folgt` : `${zahl(ohneUhrstand.length)} Glieder ohne Uhrstand folgen`} auf ein Glied mit Uhrstand (erstes: ${gliedName(erster)}).`,
      `Seit dem ersten Glied mit Uhrstand (${gliedName(g[ersterMitUhrstand!]!)}) schreibt WATT nur noch die Form mit neun Feldern (4.2). Ein späteres Glied mit sieben Feldern bricht die Kette nicht, wenn seine Prüfsumme stimmt, wie hier; WATT schreibt es so aber nie. Nach 4.8 ist das „nicht bestätigbar“, kein Beleg einer Manipulation; die Stelle braucht eine Erklärung von außen.`,
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(ohneUhrstand.map((x) => x.seq ?? x.index + 1))}`), grenze: GRENZE.kette, details: ohneUhrstand.map((x) => ({ text: `${gliedText(x)}: sieben Felder, ohne neustarts und autoZeit` })) },
    );
  }
}

/** P4: Zeitstempel, Vermerke zur Uhr, Neustarts, automatische Uhrzeit. */
export function pruefeZeit(k: Kontext): void {
  const g = k.kt.glieder;
  if (g.length === 0) return;
  const unvermerkt: Detail[] = [];
  const kleine: number[] = [];
  const minuten = (ms: number): string => {
    const m = Math.round(ms / 60000);
    return m >= 120 ? `ca. ${zahl(Math.round(m / 60))} Stunden` : `${zahl(m)} Minuten`;
  };
  for (let i = 1; i < g.length; i++) {
    const a = g[i - 1]!;
    const b = g[i]!;
    if (a.ms === null || b.ms === null) continue;
    const zurueck = a.ms - b.ms;
    if (zurueck <= 0) continue;
    if (zurueck <= 120000) {
      kleine.push(b.seq ?? b.index + 1);
      continue;
    }
    // 8., Schritt 5: Es folgt uhr_ruecksprung, oder das Glied ist selbst ein Vermerk zur Uhr, der seinen eigenen
    // Rücksprung erklärt: uhr_ruecksprung gleich mit welcher objektId oder uhr_verstellt mit richtung zurueck.
    const naechstes = g[i + 1];
    const erklaert =
      (naechstes?.objektArt === "uhr_ruecksprung" && naechstes.objektId === String(b.seq)) ||
      b.objektArt === "uhr_ruecksprung" ||
      (b.objektArt === "uhr_verstellt" && b.json?.["richtung"] === "zurueck");
    if (!erklaert) {
      unvermerkt.push({ text: `${gliedText(b)} liegt ${minuten(zurueck)} vor ${gliedText(a)}; es folgt kein Glied uhr_ruecksprung, und das Glied ist selbst kein Vermerk zur Uhr (uhr_ruecksprung oder uhr_verstellt mit richtung zurueck).` });
    }
  }
  const fund = dateiFundstelle(k);
  const vermerke = g.filter((x) => UHR.has(x.objektArt));
  // Rücksprünge und Verstellungen der Geräteuhr; uhr_abweichung betrifft den Timer (4.1, 4.7).
  const spruenge = vermerke.filter((x) => x.objektArt !== "uhr_abweichung");
  const mitUhrstand = g.filter((x) => x.form === "neun");
  const neu = mitUhrstand.length === g.length;
  const vermerkDetails = (): Detail[] => vermerke.map((x) => ({ text: `${gliedText(x)}: ${uhrBeschreibung(x)}` }));
  // Genau eine Aussage zu Zeitstempeln und Vermerken, je nach Lage (Auftrag 0.1.5, B2).
  if (unvermerkt.length) {
    sage(k, "P4", "offen", `Die Uhr sprang ${anzahl(unvermerkt.length, "Mal", "Mal")} um mehr als 2 Minuten zurück, ohne dass die Kette es vermerkt.`, "Liegt ein Glied mehr als 2 Minuten vor seinem Vorgänger, folgt unmittelbar danach ein Glied uhr_ruecksprung, oder das Glied ist selbst ein Vermerk zur Uhr: uhr_ruecksprung, gleich mit welcher objektId, bzw. uhr_verstellt mit richtung zurueck (Technische Erläuterung 4.1, 4.7 und 8., Schritt 5). Hier fehlt dieser Vermerk. WATT schreibt das so nie; nach 4.8 ist die Stelle „nicht bestätigbar“, kein Beleg einer Manipulation, und braucht eine Erklärung von außen. Eine nachträglich geänderte Zeit fiele dagegen als Bruch der Kette auf (P2).", {
      fundstelle: fund,
      grenze: GRENZE.zeit,
      details: unvermerkt,
    });
    if (vermerke.length) {
      sage(k, "P4", "hinweis", `Die Kette vermerkt ${anzahl(vermerke.length, "Vorgang", "Vorgänge")} an der Geräteuhr.`, "WATT vermerkt Rücksprünge (uhr_ruecksprung), Abweichungen beim Timer (uhr_abweichung) und Verstellungen der Uhr (uhr_verstellt) als eigene Glieder (4.1, 4.7). Sie zeigen, dass die Uhr des Geräts nicht durchgehend gleichmäßig lief; die Zeitpunkte dieser Abschnitte stammen von der verstellten Uhr.", {
        fundstelle: dateiFundstelle(k, `Glied ${bereiche(vermerke.map((x) => x.seq ?? 0))}`),
        grenze: GRENZE.zeit,
        details: vermerkDetails(),
      });
    }
  } else if (!spruenge.length) {
    const abw = vermerke.length ? ` Sie vermerkt ${anzahl(vermerke.length, "Abweichung", "Abweichungen")} beim Timer (uhr_abweichung, 4.7); das betrifft den Timer, nicht die Geräteuhr.` : "";
    sage(
      k,
      "P4",
      "bestaetigt",
      "Die Zeitstempel steigen an; die Kette enthält keinen Rücksprung und keine Verstellung der Geräteuhr.",
      `Die Zeitpunkte der ${anzahl(g.length, "Glieds", "Glieder")} steigen mit der laufenden Nummer${kleine.length ? " bis auf Rücksprünge bis 2 Minuten, die WATT nicht vermerkt (8., Schritt 5)" : ""}, und die Kette enthält kein Glied uhr_ruecksprung oder uhr_verstellt${neu ? "; alle Glieder tragen den Uhrstand (4.7)" : ""}.${abw}`,
      { fundstelle: fund, grenze: neu ? GRENZE.zeit : GRENZE.zeitAlt, ...(vermerke.length ? { details: vermerkDetails() } : {}) },
    );
  } else {
    const n = spruenge.length;
    sage(
      k,
      "P4",
      "bestaetigt",
      `Die Zeitstempel steigen an. Die Geräteuhr wurde ${n === 1 ? "einmal" : `${zahl(n)}-mal`} verstellt oder sprang zurück; jeder Fall ist vermerkt (Glied ${bereiche(spruenge.map((x) => x.seq ?? 0))}).`,
      `Liegt ein Glied mehr als 2 Minuten vor seinem Vorgänger, folgt unmittelbar ein Glied uhr_ruecksprung, oder das Glied ist selbst ein Vermerk zur Uhr (8., Schritt 5); Verstellungen der Uhr stehen als uhr_verstellt in der Kette (4.7). Alle Sprünge dieser Kette sind so vermerkt; die Zeitpunkte danach stammen von der verstellten Uhr. Ein Vermerk uhr_verstellt hat oft gewöhnliche Ursachen, etwa eine falsche Netzzeit, eine nach langer Zeit ohne Netz korrigierte Uhr oder eine nach einer Reise von Hand gestellte Uhrzeit; nach 4.8 ist er ein Hinweis, kein Beleg einer Manipulation.`,
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(vermerke.map((x) => x.seq ?? 0))}`), grenze: GRENZE.zeit, details: vermerkDetails() },
    );
  }

  if (kleine.length) {
    sage(k, "P4", "hinweis", `Die Uhr sprang ${kleine.length === 1 ? "einmal" : `${zahl(kleine.length)}-mal`} um höchstens 2 Minuten zurück.`, "Rücksprünge bis 2 Minuten vermerkt WATT nicht (8., Schritt 5); bei Gliedern mit Uhrstand liegt eine noch nicht vermerkte Änderung des Versatzes zwischen −2 und +2 Minuten (4.7). Nach 4.8 ist das ein Hinweis, kein Beleg einer Manipulation.", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(kleine)}`),
      grenze: neu ? GRENZE.zeit : GRENZE.zeitAlt,
    });
  }

  pruefeVerstellungen(k);

  pruefeBezug(k);

  if (mitUhrstand.length) {
    let summe = 0;
    const ohneBezug: number[] = [];
    for (const x of mitUhrstand) {
      if ((x.neustarts ?? 0) > 0) summe += x.neustarts!;
      if (x.neustarts === -1) ohneBezug.push(x.seq ?? 0);
    }
    sage(
      k,
      "P4",
      "hinweis",
      summe === 0 ? "Das Gerät wurde nicht neu gestartet." : summe === 1 ? "Das Gerät wurde einmal neu gestartet." : `Das Gerät wurde ${zahl(summe)}-mal neu gestartet.`,
      `Summe der Neustarts (neustarts) aus ${anzahl(mitUhrstand.length, "Glied", "Gliedern")} mit Uhrstand (4.7)${ohneBezug.length ? `; bei ${anzahl(ohneBezug.length, "Glied", "Gliedern")} fehlte der Bezug (-1), etwa nach dem Update oder einer Wiederherstellung: Glied ${bereiche(ohneBezug)}` : ""}. Über einen Neustart hinweg prüft WATT die Uhr nur daran, ob der neue Gerätestart nach dem alten beginnt (4.7); Zeitsprünge über einen Neustart hinweg sind nach 4.8 ein Hinweis.`,
      { fundstelle: fund, grenze: GRENZE.zeit },
    );
    const aus = mitUhrstand.filter((x) => x.autoZeit === false).map((x) => x.seq ?? 0);
    sage(
      k,
      "P4",
      "hinweis",
      aus.length ? `Bei ${anzahl(aus.length, "Glied", "Gliedern")} war „Datum und Uhrzeit automatisch“ ausgeschaltet.` : "„Datum und Uhrzeit automatisch“ war bei allen Gliedern mit Uhrstand eingeschaltet.",
      aus.length ? `Abschnitte mit autoZeit false: Glied ${bereiche(aus, 30)}. In diesen Abschnitten stellte die Lehrkraft die Uhr selbst; WATT summiert dann auch kleine Verstellungen (4.7).` : `Alle ${anzahl(mitUhrstand.length, "Glied", "Glieder")} mit Uhrstand tragen autoZeit true.`,
      { fundstelle: fund },
    );
  }
}

/**
 * uhr_ruecksprung bei Gliedern mit Uhrstand (4.7, „uhr_ruecksprung bei Einträgen mit Uhrstand“; 8., Schritt 5):
 * WATT schreibt ihn nur ohne Bezug. Bei objektId mit laufender Nummer hat das auslösende Glied unmittelbar davor
 * neustarts größer als 0 oder -1 und der Vermerk selbst 0; bei timer, nachweis, start und zeitsignal hat der
 * Vermerk selbst neustarts größer als 0 oder -1. Einzige Ausnahme: nachweis als erstes Glied einer leeren Kette
 * (seq 1, prev 0, neustarts 0). Eingespielte Glieder vor einer wiederherstellung folgen derselben Regel; ohne
 * Uhrstand entfällt sie. Ein Verstoß ist „?“, nie ✗ (U-18, E-36).
 */
function pruefeBezug(k: Kontext): void {
  const g = k.kt.glieder;
  const geprueft: Glied[] = [];
  const abweichend: { x: Glied; text: string }[] = [];
  const ohneBezug = (n: number | null): boolean => n !== null && (n > 0 || n === -1);
  for (let j = 0; j < g.length; j++) {
    const x = g[j]!;
    if (x.objektArt !== "uhr_ruecksprung" || x.form !== "neun") continue;
    const probleme: string[] = [];
    if (/^\d+$/.test(x.objektId)) {
      const ausloeser = g[j - 1];
      if (!ausloeser || ausloeser.form !== "neun") continue;
      geprueft.push(x);
      if (ausloeser.seq !== Number(x.objektId)) probleme.push(`objektId nennt Glied ${x.objektId}, unmittelbar davor steht ${gliedName(ausloeser)}`);
      if (!ohneBezug(ausloeser.neustarts)) probleme.push(`das auslösende ${gliedName(ausloeser)} nennt neustarts ${String(ausloeser.neustarts)}, also einen Bezug`);
      if (x.neustarts !== 0) probleme.push(`der Vermerk selbst nennt neustarts ${String(x.neustarts)} statt 0`);
    } else if (OHNE_EIGENES_GLIED.has(x.objektId)) {
      geprueft.push(x);
      const ersterDerKette = x.objektId === "nachweis" && j === 0 && x.seq === 1 && x.prev === "0" && x.neustarts === 0;
      if (!ohneBezug(x.neustarts) && !ersterDerKette) probleme.push(`der Vermerk selbst nennt neustarts ${String(x.neustarts)}, also einen Bezug`);
    } else {
      // Andere objektId schreibt WATT bei Gliedern mit Uhrstand nicht (4.1, 4.7); der Vermerk erklärt seinen
      // Rücksprung trotzdem (8., Schritt 5), entspricht aber nicht der Beschreibung.
      geprueft.push(x);
      probleme.push(`objektId ${x.objektId.slice(0, 40)} ist weder eine laufende Nummer noch timer, nachweis, start oder zeitsignal`);
    }
    if (probleme.length) abweichend.push({ x, text: `${gliedText(x)} mit objektId ${x.objektId}: ${probleme.join("; ")}.` });
  }
  if (!geprueft.length) return;
  if (abweichend.length) {
    sage(
      k,
      "P4",
      "offen",
      `${abweichend.length === 1 ? "Ein Glied uhr_ruecksprung passt" : `${zahl(abweichend.length)} Glieder uhr_ruecksprung passen`} nicht zur Regel für den Bezug in 4.7.`,
      "Bei Gliedern mit Uhrstand schreibt WATT uhr_ruecksprung nur, wenn vor der Messung kein Anker bestand (erste Messung nach einem Neustart oder nach dem Update); sonst steht eine Verstellung als uhr_verstellt in der Kette (4.7, 8., Schritt 5). Ohne Bezug heißt: Bei objektId mit laufender Nummer hat das auslösende Glied unmittelbar davor neustarts größer als 0 oder -1 und der Vermerk selbst 0; bei objektId timer, nachweis, start oder zeitsignal hat der Vermerk selbst neustarts größer als 0 oder -1. Einzige Ausnahme ist ein uhr_ruecksprung mit objektId nachweis als erstes Glied einer leeren Kette (neustarts 0). Die Datei entspricht an dieser Stelle nicht der Beschreibung der Technischen Erläuterung; nach 4.8 ist das „nicht bestätigbar“, kein Beleg einer Manipulation.",
      {
        fundstelle: dateiFundstelle(k, `Glied ${bereiche(abweichend.map(({ x }) => x.seq ?? 0))}`),
        grenze: GRENZE.zeit,
        details: abweichend.map(({ text }) => ({ text })),
      },
    );
  } else {
    sage(
      k,
      "P4",
      "bestaetigt",
      `${geprueft.length === 1 ? "Das Glied uhr_ruecksprung mit Uhrstand entstand" : `Die ${zahl(geprueft.length)} Glieder uhr_ruecksprung mit Uhrstand entstanden`} ohne Bezug, wie 4.7 es beschreibt.`,
      "Bei objektId mit laufender Nummer nennt das auslösende Glied neustarts größer als 0 oder -1 und der Vermerk selbst 0; bei timer, nachweis, start und zeitsignal nennt der Vermerk selbst neustarts größer als 0 oder -1, ausgenommen nachweis als erstes Glied einer leeren Kette (4.7, 8., Schritt 5).",
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(geprueft.map((x) => x.seq ?? 0))}`), grenze: GRENZE.zeit },
    );
  }
}

/**
 * Zerlegung eines Zeitsprungs bis zu einem Glied uhr_verstellt (4.7):
 * zeitpunkt(uhr_verstellt) − zeitpunkt(voriges) = (vorher − zeitpunkt(voriges)) + (nachher − vorher).
 * Der zweite Teil gleicht abweichungSekunden mit Vorzeichen, mit und ohne schritte (U-14, U-21); passt er nicht,
 * „?“ (E-27). Liegt der erste Teil unter −120 Sekunden, nur ein Hinweis (U-15, U-22, E-28); nach einem Glied
 * neubeginn oder wiederherstellung gilt diese Regel nicht.
 */
function pruefeVerstellungen(k: Kontext): void {
  const g = k.kt.glieder;
  const verstellt = g.map((x, i) => ({ x, i })).filter(({ x }) => x.objektArt === "uhr_verstellt");
  if (!verstellt.length) return;
  const abweichend: Detail[] = [];
  const ersterTeil: { x: Glied; text: string }[] = [];
  for (const { x, i } of verstellt) {
    const d = x.json ?? {};
    const vorher = zeitpunktMs(d["vorher"]);
    const nachher = zeitpunktMs(d["nachher"]);
    const schritte = d["schritte"];
    const probleme: string[] = [];
    // objektId: Anlass (glied, zeitsignal, timer, nachweis, start) oder die laufende Nummer eines Glieds neubeginn
    // bzw. wiederherstellung, dem der Vermerk folgt; dazwischen stehen höchstens weitere Vermerke zur Uhr (4.7).
    if (/^\d+$/.test(x.objektId)) {
      let j = i - 1;
      while (j >= 0 && UHR.has(g[j]!.objektArt)) j--;
      const bezug = g[j];
      if (!bezug || String(bezug.seq) !== x.objektId || !GRENZE_DER_KETTE.has(bezug.objektArt)) probleme.push(`objektId ${x.objektId} nennt kein Glied neubeginn oder wiederherstellung, dem der Vermerk folgt`);
    } else if (!VERSTELLT_ANLAESSE.has(x.objektId)) probleme.push(`objektId ${x.objektId.slice(0, 40)} ist kein Anlass aus 4.7`);
    if (schritte !== undefined && !(typeof schritte === "number" && Number.isSafeInteger(schritte) && schritte > 1)) probleme.push(`schritte (${String(schritte).slice(0, 40)}) ist keine ganze Zahl größer als 1`);
    if (vorher === null || nachher === null) probleme.push("vorher oder nachher fehlt");
    else {
      // zeitpunkt ist der Zeitpunkt des Vorgangs und liegt höchstens um dessen Dauer vor nachher (4.7).
      if (x.ms !== null && x.ms > nachher) probleme.push(`zeitpunkt (${deutsch(x.ms)}) liegt nach nachher (${deutsch(nachher)})`);
      // Erster Teil: nicht unter −120 Sekunden (Grenze eingeschlossen), mit und ohne schritte; erst ab dem ersten
      // Glied des Geräts nach einer Wiederherstellung bzw. einem Neubeginn.
      const voriges = g[i - 1];
      if (voriges && voriges.ms !== null && !GRENZE_DER_KETTE.has(voriges.objektArt) && vorher - voriges.ms < -120000) {
        ersterTeil.push({ x, text: `${gliedText(x)}: vorher (${deutsch(vorher)}) liegt ${zahl(Math.trunc((voriges.ms - vorher) / 1000))} Sekunden vor ${gliedText(voriges)}${schritte !== undefined ? " (mit schritte)" : ""}; autoZeit ${x.autoZeit === null ? "fehlt" : String(x.autoZeit)}.` });
      }
      // Zweiter Teil: nachher − vorher in ganzen Sekunden, zur Null hin gekürzt; gleicht abweichungSekunden.
      const sprung = Math.trunc((nachher - vorher) / 1000);
      const ab = d["abweichungSekunden"];
      if (typeof ab !== "number" || !Number.isSafeInteger(ab)) probleme.push("abweichungSekunden fehlt oder ist keine ganze Zahl im genau darstellbaren Bereich");
      else {
        if (Math.abs(ab) < 120) probleme.push(`der Betrag von abweichungSekunden (${zahl(ab)}) ist kleiner als 120`);
        const richtung = d["richtung"];
        if (richtung !== (ab > 0 ? "vor" : "zurueck")) probleme.push(`richtung ${String(richtung)} passt nicht zu abweichungSekunden ${zahl(ab)}`);
        if (sprung !== ab) probleme.push(`nachher − vorher sind ${zahl(sprung)} Sekunden, abweichungSekunden nennt ${zahl(ab)}`);
      }
    }
    if (probleme.length) abweichend.push({ text: `${gliedText(x)}: ${probleme.join("; ")}.` });
  }
  const fund = dateiFundstelle(k, `Glied ${bereiche(verstellt.map(({ x }) => x.seq ?? 0))}`);
  if (abweichend.length) {
    sage(k, "P4", "offen", `${anzahl(abweichend.length, "Vermerk uhr_verstellt passt", "Vermerke uhr_verstellt passen")} nicht zur Rechnung in 4.7.`, "Nach 4.7 liegt zeitpunkt des Glieds uhr_verstellt nicht nach nachher, und abweichungSekunden ist nachher − vorher in ganzen Sekunden, zur Null hin gekürzt, mit Vorzeichen: positiv bei richtung vor, negativ bei richtung zurueck, im Betrag mindestens 120, mit und ohne schritte. schritte ist, wenn vorhanden, die Zahl der Messungen, eine ganze Zahl größer als 1. objektId nennt den Anlass (glied, zeitsignal, timer, nachweis, start) oder die laufende Nummer des Glieds neubeginn bzw. wiederherstellung, dem der Vermerk folgt. Die Prüfsummen der Glieder prüft P2; hier erklärt der Vermerk den Zeitsprung nicht so, wie die Technische Erläuterung es beschreibt. WATT schreibt das so nicht; ein Beleg einer Manipulation ist es nicht.", { fundstelle: fund, grenze: GRENZE.zeit, details: abweichend });
  } else {
    sage(k, "P4", "bestaetigt", `${verstellt.length === 1 ? "Der Vermerk uhr_verstellt erklärt seinen Zeitsprung" : `Die ${zahl(verstellt.length)} Vermerke uhr_verstellt erklären ihre Zeitsprünge`} nach der Rechnung in 4.7.`, "zeitpunkt(uhr_verstellt) − zeitpunkt(voriges Glied) = (vorher − zeitpunkt(voriges Glied)) + (nachher − vorher): Der erste Teil ist die verstrichene Zeit nach der Monotonuhr plus die noch nicht vermerkte Änderung des Versatzes, der zweite die Verstellung seit dem letzten Vermerk; sie gleicht abweichungSekunden mit Vorzeichen, mit und ohne schritte (4.7). Jeder Vermerk nennt einen Anlass aus 4.7 (Einzelheiten).", { fundstelle: fund, grenze: GRENZE.zeit, details: verstellt.map(({ x }) => ({ text: `${gliedText(x)}: ${uhrBeschreibung(x)}` })) });
  }
  if (ersterTeil.length) {
    sage(
      k,
      "P4",
      "hinweis",
      `${ersterTeil.length === 1 ? "Bei einem Vermerk uhr_verstellt liegt" : `Bei ${zahl(ersterTeil.length)} Vermerken uhr_verstellt liegt`} vorher weiter vor dem vorigen Glied, als 4.7 es vorsieht.`,
      "Nach 4.7 ist der erste Teil der Zerlegung (vorher − zeitpunkt des vorigen Glieds) nicht kleiner als −120 Sekunden, die Grenze eingeschlossen, mit und ohne schritte; ausgenommen sind nur nachgeführte Korrekturen der Netzzeit zurück bei eingeschalteter automatischer Uhrzeit, jede unter 5 Sekunden. Nach einer Wiederherstellung oder einem Neubeginn gilt die Regel erst ab dem ersten Glied des Geräts danach. Nach 4.8 ist das ein Hinweis, kein Beleg einer Manipulation; autoZeit des Glieds uhr_verstellt zeigt, ob die automatische Uhrzeit bei der Erkennung eingeschaltet war.",
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(ersterTeil.map(({ x }) => x.seq ?? 0))}`), grenze: GRENZE.zeit, details: ersterTeil.map(({ text }) => ({ text })) },
    );
  }
}

/** Anlässe der Vermerke zur Uhr nach 4.7 (objektId). */
const ANLASS: Record<string, string> = {
  timer: "bei einem Timer (Start, Stopp, Wechsel, Vorverlegen oder Höchstdauer)",
  nachweis: "beim Festhalten eines Nachweises",
  start: "beim Öffnen der App oder einer Seite",
  zeitsignal: "nach einer von Android gemeldeten Änderung der Uhrzeit",
};

function uhrBeschreibung(x: Glied): string {
  const d = x.json ?? {};
  if (x.objektArt === "uhr_ruecksprung") {
    const v = zeitpunktMs(d["vorher"]);
    const n = zeitpunktMs(d["nachher"]);
    const anlass = ANLASS[x.objektId] ?? `nach Glied ${x.objektId}`;
    return `Rücksprung der Uhr ${anlass}${v !== null && n !== null ? ` von ${deutsch(v)} auf ${deutsch(n)}` : ""}`;
  }
  if (x.objektArt === "uhr_abweichung") {
    if (d["art"] === "neustart") return "Neustart des Geräts während eines Timer-Laufs";
    const s = typeof d["abweichungSekunden"] === "number" ? (d["abweichungSekunden"] as number) : null;
    return `Beginn eines Timer-Laufs nach der Monotonuhr korrigiert${s !== null ? ` (Abweichung ${zahl(Math.round(s / 60))} Minuten)` : ""}`;
  }
  const s = typeof d["abweichungSekunden"] === "number" ? (d["abweichungSekunden"] as number) : null;
  const richtung = d["richtung"] === "vor" ? "vorgestellt" : d["richtung"] === "zurueck" ? "zurückgestellt" : "verstellt";
  const anlass = x.objektId === "glied" ? "vor dem folgenden Glied" : /^\d+$/.test(x.objektId) ? `nach Glied ${x.objektId} (Neubeginn oder Wiederherstellung)` : (ANLASS[x.objektId] ?? `objektId ${x.objektId.slice(0, 40)}`);
  const schritte = typeof d["schritte"] === "number" ? `, aus ${zahl(d["schritte"] as number)} Messungen` : d["schritte"] !== undefined ? ", aus mehreren Messungen" : "";
  return `Uhr ${richtung}${s !== null ? ` um ${zahl(Math.round(Math.abs(s) / 60))} Minuten` : ""} (${anlass}${schritte})`;
}

/** Abstand nach 4.5: ganze Sekunden, bis einschließlich 96 Stunden in Stunden, darüber in Tagen, kaufmännisch gerundet. */
export function abstand(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s <= 96 * 3600) return `ca. ${zahl(Math.floor((s + 1800) / 3600))} Stunden`;
  return `ca. ${zahl(Math.floor((s + 43200) / 86400))} Tage`;
}

/** Gekennzeichnet wird erst ab mehr als 24 Stunden (4.5). */
export function istNachtrag(ms: number): boolean {
  return Math.floor(ms / 1000) > 24 * 3600;
}

/** P9: Neubeginne, Wiederherstellungen, Löschungen, Änderungen mit Kommentar, Nachträge, eingelesene Buchungen. */
export async function pruefeBesondere(k: Kontext): Promise<void> {
  const g = k.kt.glieder;
  const fund = dateiFundstelle(k);
  if (g.length === 0) return;

  const neubeginne = g.filter((x) => x.objektArt === "neubeginn");
  for (const x of neubeginne) {
    const d = x.json ?? {};
    const details: Detail[] = [];
    if ("vorherAnzahl" in d) {
      const z = zeitpunktMs(d["vorherZeitpunkt"]);
      details.push({ text: `Alte Kette: ${anzahl(Number(d["vorherAnzahl"]), "Glied", "Glieder")}, letzter Stand ${z !== null ? deutsch(z) : "ohne Zeitpunkt"}, SHA-256 ${String(d["vorherLetzterHash"])}.` });
      const e = d["eintraege"] && typeof d["eintraege"] === "object" ? Object.keys(d["eintraege"] as object).length : 0;
      const a = d["abwesenheiten"] && typeof d["abwesenheiten"] === "object" ? Object.keys(d["abwesenheiten"] as object).length : 0;
      details.push({ text: `Bestand zum Neubeginn: ${anzahl(e, "Eintrag", "Einträge")} und ${anzahl(a, "Abwesenheit", "Abwesenheiten")} mit Bestandsprüfsumme in Form ${d["bestandsform"] === undefined ? "1 (ohne bestandsform)" : String(d["bestandsform"]).slice(0, 20)} (4.6).` });
    } else {
      details.push({ text: "Älterer Neubeginn (vor Formatversion 18): Er nennt nur die Prüfsumme des Bestands, nicht die alte Kette." });
    }
    details.push({ text: `Prüfsumme des Datenbestands (4.6): ${String(d["bestand"] ?? "fehlt")}.` });
    // 4.6: bestand lässt sich nur aus einem JSON-Export unmittelbar nach dem Neubeginn nachrechnen.
    const nachgerechnet = k.kt.quelle === "json" && typeof d["bestand"] === "string" && (await sha256Hex(bestandDatenEingabe(k.kt.daten))) === d["bestand"];
    if (nachgerechnet) {
      sage(k, "P9", "bestaetigt", "Die Prüfsumme des Datenbestands im Neubeginn passt zu diesem Export.", "WATTest hat bestand nach 4.6 aus diesem Export nachgerechnet: JSON mit exportiertAm 1970-01-01T00:00:00Z, leerer appVersion, protokoll [] und ohne kettenschluessel und kettensignaturen. Der Export entstand also unmittelbar nach dem Neubeginn, bevor sich Daten, Einstellungen oder Nachweise änderten.", {
        fundstelle: dateiFundstelle(k, gliedName(x)),
        grenze: "Belegt ist der Datenbestand zum Neubeginn; über die Zeit davor sagt das nichts (Technische Erläuterung, 4.6 und 9).",
      });
    } else {
      details.push({
        text:
          k.kt.quelle === "json"
            ? "Aus diesem Export lässt sich bestand nicht nachrechnen: Das geht nur mit einem JSON-Export unmittelbar nach dem Neubeginn; jede spätere Änderung ergibt eine andere Prüfsumme, ohne dass das auf eine Manipulation hindeutet (4.6). Nachprüfbar bleiben die Bestandsprüfsummen je Eintrag und Abwesenheit (P3) und vorherAnzahl, vorherLetzterHash und vorherZeitpunkt gegen frühere Anker (P5)."
            : "bestand lässt sich nur aus einem JSON-Export nachrechnen, nicht aus XML (4.6). Nachprüfbar bleiben die Bestandsprüfsummen je Eintrag und Abwesenheit (P3) und vorherAnzahl, vorherLetzterHash und vorherZeitpunkt gegen frühere Anker (P5).",
      });
    }
    sage(k, "P9", "hinweis", `Die Kette wurde am ${wann(x)} neu begonnen.`, "Ein Neubeginn löscht alle früheren Glieder auf dem Gerät; die neue Kette beginnt mit dem Start-Eintrag neubeginn (4.4, 4.6). Die frühere Historie ist nur über früher erzeugte Anker und Sicherungen prüfbar.", {
      fundstelle: dateiFundstelle(k, gliedName(x)),
      grenze: "Über die Zeit vor dem Neubeginn sagt diese Datei nur, was der Start-Eintrag nennt (Technische Erläuterung, Abschnitt 9).",
      details,
    });
  }

  const wiederh = g.filter((x) => x.objektArt === "wiederherstellung");
  for (const x of wiederh) {
    const d = x.json ?? {};
    const vg = typeof d["vorgeschichte"] === "string" ? (d["vorgeschichte"] as string) : null;
    const art = d["verschluesselt"] === true ? "aus einer Sicherung" : d["verschluesselt"] === false ? "aus einem Klartext-Export" : "aus einer Datei";
    const vgText: Record<string, string> = {
      UEBEREINSTIMMEND: "Vorgeschichte übereinstimmend",
      ABWEICHEND: "abweichende Vorgeschichte",
      NICHT_ABGLEICHBAR: "Vorgeschichte nicht abgleichbar",
    };
    const details: Detail[] = [];
    const exp = zeitpunktMs(d["exportiertAm"]);
    if (exp !== null) details.push({ text: `Die eingespielte Datei entstand am ${deutsch(exp)}.` });
    if (d["vorherAnzahl"] !== undefined) details.push({ text: `Vorher auf dem Gerät: ${anzahl(Number(d["vorherAnzahl"]), "Glied", "Glieder")}, letzte Prüfsumme ${String(d["vorherLetzterHash"] ?? "")}.` });
    if (d["nachweisketteVorherAnzahl"] !== undefined) details.push({ text: `Nachweiskette vorher: ${anzahl(Number(d["nachweisketteVorherAnzahl"]), "Glied", "Glieder")}, letzte Prüfsumme ${String(d["nachweisketteVorherLetzterHash"] ?? "")}.` });
    if (d["signaturen"] !== undefined) {
      const s = String(d["signaturen"]);
      const st: Record<string, string> = { GEPRUEFT: "geprüft, alle rechnerisch gültig und die Prüfungen ohne Netz bestanden", WIDERLEGT: "widerlegt, ein Schlüssel bestand die Prüfungen ohne Netz nicht", NICHT_PRUEFBAR: "Prüfung nicht möglich", KEINE: "keine" };
      details.push({ text: `Signaturen der Datei laut WATT: ${s === "UNGUELTIG" ? `ungültig ab Glied ${String(d["signaturenUngueltigAb"] ?? "?")}` : (st[s] ?? s)}.` });
    }
    const ok = vg === "UEBEREINSTIMMEND";
    sage(
      k,
      "P9",
      ok ? "hinweis" : "offen",
      `Am ${wann(x)} wurde ${art} wiederhergestellt (${vg ? vgText[vg] ?? vg : "Vorgeschichte nicht abgeglichen"}).`,
      ok
        ? "Die Kette auf dem Gerät war Glied für Glied der Anfang der eingespielten oder umgekehrt (4.1, 7). Die Glieder vor diesem Glied stammen aus der eingespielten Datei."
        : "Die Kette auf dem Gerät und die der eingespielten Datei ließen sich nicht als Anfang voneinander bestätigen (4.1, 7). Was vorher auf dem Gerät lag, ist nicht in dieser Datei; die Glieder vor diesem Glied stammen aus der eingespielten Datei.",
      { fundstelle: dateiFundstelle(k, gliedName(x)), grenze: "Ein älterer Stand aus einer Sicherung fällt nur auf dem Gerät und gegen spätere Anker auf (Technische Erläuterung, Abschnitt 9).", details },
    );
  }

  const loeschungen = g.filter((x) => x.aktion === "GELOESCHT");
  if (loeschungen.length) {
    sage(k, "P9", "hinweis", `Die Kette enthält ${anzahl(loeschungen.length, "Löschung", "Löschungen")}.`, "Gelöschte Datensätze bleiben mit ihrem letzten Stand und der Begründung in der Kette (4.4).", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(loeschungen.map((x) => x.seq ?? 0))}`),
      details: loeschungen.map((x) => {
        const b = x.json?.["begruendung"];
        return { text: `${gliedText(x)}: ${x.objektArt === "abwesenheit" ? "Abwesenheit" : x.objektArt === "eintrag" ? "Eintrag" : x.objektArt} gelöscht, ${typeof b === "string" && b ? "mit Begründung" : "ohne Begründung"}`, ...(typeof b === "string" && b ? { inhalt: `Begründung: ${b}` } : {}) };
      }),
    });
  }

  const kommentiert = g.filter((x) => x.aktion === "GEAENDERT" && typeof x.json?.["begruendung"] === "string" && x.json["begruendung"] !== "");
  if (kommentiert.length) {
    sage(k, "P9", "hinweis", `${anzahl(kommentiert.length, "Änderung trägt", "Änderungen tragen")} einen Kommentar.`, "Ab Formatversion 19 kann eine Änderung einen Kommentar (begruendung) tragen; er geht in die Prüfsumme ein (4.1).", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(kommentiert.map((x) => x.seq ?? 0))}`),
      details: kommentiert.map((x) => ({ text: `${gliedText(x)}: Änderung mit Kommentar`, inhalt: `Kommentar: ${String(x.json!["begruendung"])}` })),
    });
  }

  const umgewandelt = g.filter((x) => typeof x.json?.["umgewandeltAus"] === "string");
  if (umgewandelt.length) {
    sage(k, "P9", "hinweis", `${anzahl(umgewandelt.length, "Eintrag wurde", "Einträge wurden")} in einen Tagesblock umgewandelt.`, "Das Glied der Änderung nennt die frühere Quelle als umgewandeltAus (4.1).", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(umgewandelt.map((x) => x.seq ?? 0))}`),
      details: umgewandelt.map((x) => ({ text: `${gliedText(x)}: vorher ${String(x.json!["umgewandeltAus"])}` })),
    });
  }

  // Nachträge nach 4.5 über die Einträge der Datei: Erfassung, letzte Änderung und Einlesen getrennt.
  const nachtraege: Detail[] = [];
  const eintraege = Array.isArray(k.kt.daten["eintraege"]) ? (k.kt.daten["eintraege"] as Record<string, unknown>[]) : [];
  for (const e of eintraege) {
    if (!e || typeof e !== "object") continue;
    let ende = zeitpunktMs(e["ende"]);
    if (ende === null && typeof e["tag"] === "string") ende = berlinTagesende(e["tag"] as string);
    if (ende === null) continue;
    const imp = zeitpunktMs(e["importiertAm"]);
    const erf = zeitpunktMs(e["erfasstAm"]);
    const geae = zeitpunktMs(e["geaendertAm"]);
    const laut = imp !== null ? " (laut Datei)" : "";
    const marken: string[] = [];
    if (erf !== null && istNachtrag(erf - ende)) marken.push(`Nachgetragen ${abstand(erf - ende)} nach Ende${laut}`);
    if (geae !== null && istNachtrag(geae - ende)) marken.push(`Geändert ${abstand(geae - ende)} nach Ende${laut}`);
    if (imp !== null && istNachtrag(imp - ende)) marken.push(`Eingelesen ${abstand(imp - ende)} nach Ende`);
    if (!marken.length) continue;
    if (imp !== null) marken.push(`Importiert am ${deutsch(imp)}`);
    nachtraege.push({ text: `Eintrag ${String(e["id"])} vom ${String(e["tag"])}: ${marken.join("; ")}` });
  }
  if (nachtraege.length) {
    sage(k, "P9", "hinweis", `${anzahl(nachtraege.length, "Eintrag ist", "Einträge sind")} als Nachtrag gekennzeichnet (mehr als 24 Stunden nach Ende erfasst, geändert oder eingelesen).`, "Nach 4.5 kennzeichnet WATT Erfassung und letzte Änderung getrennt, wenn sie mehr als 24 Stunden nach dem Ende der Tätigkeit liegen (bei Tagesblöcken 00:00 Uhr deutscher Zeit des folgenden Tags), bis einschließlich 96 Stunden in ganzen Stunden, darüber in ganzen Tagen, kaufmännisch gerundet. Bei eingelesenen Einträgen stammen Erfassung und Änderung aus der Datei („laut Datei“); dazu kommen der Abstand bis zum Einlesen und „Importiert am“ (4.5, 7.1).", {
      fundstelle: fund,
      details: nachtraege,
    });
  }

  const importe = g.filter((x) => x.aktion === "ANGELEGT" && typeof x.json?.["importDatei"] === "string");
  if (importe.length) {
    const nachDatei = new Map<string, number[]>();
    for (const x of importe) {
      const h = String(x.json!["importDatei"]);
      const l = nachDatei.get(h);
      if (l) l.push(x.seq ?? 0);
      else nachDatei.set(h, [x.seq ?? 0]);
    }
    sage(k, "P9", "hinweis", `${anzahl(importe.length, "Buchung wurde", "Buchungen wurden")} aus ${anzahl(nachDatei.size, "Datei", "Dateien")} eingelesen.`, "Eingelesene Buchungen tragen im Anlage-Glied importDatei, die SHA-256 der eingelesenen Datei (4.1, 7.1). Ihre Erfassungs- und Änderungszeitpunkte stammen aus der Datei des anderen Geräts.", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(importe.map((x) => x.seq ?? 0))}`),
      grenze: GRENZE.besondere,
      details: [...nachDatei].map(([h, s]) => ({ text: `Datei mit SHA-256 ${h}: Glied ${bereiche(s)}` })),
    });
  }

  const alt = g.filter((x) => ["profil", "funktion", "ferien", "sondertag", "kategorie", "unterkategorie", "stundenplan"].includes(x.objektArt));
  if (alt.length) {
    sage(k, "P9", "hinweis", `Die Kette enthält ${anzahl(alt.length, "älteres Glied", "ältere Glieder")} zu Einstellungen.`, "Protokolle vor Formatversion 13 können Glieder zu Profil, Ferien, Kategorien und Stundenplan enthalten; sie werden wie alle anderen geprüft, gehen aber nicht in den Abgleich der Daten ein (4.1).", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(alt.map((x) => x.seq ?? 0))}`),
    });
  }

  if (neubeginne.length === 0 && wiederh.length === 0) {
    sage(k, "P9", "bestaetigt", "Die Kette enthält keinen Neubeginn und keine Wiederherstellung.", "Kein Glied hat die Art neubeginn oder wiederherstellung; alle Glieder entstanden fortlaufend in dieser Kette.", {
      fundstelle: fund,
      grenze: GRENZE.kette,
    });
  }
}
