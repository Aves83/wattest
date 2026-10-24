// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P2 Arbeitszeitkette, P4 Zeit, P9 besondere Glieder.

import { anzahl, bereiche, zahl, type Detail } from "./befund.js";
import { GRENZE } from "./grenzen.js";
import { gliedEingabe } from "./kanonisch.js";
import { gliedName, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { sha256Hex } from "./sha.js";
import { berlinTagesende, deutsch, zeitpunktMs } from "./zeit.js";

const UHR = new Set(["uhr_ruecksprung", "uhr_abweichung", "uhr_verstellt"]);

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
  let sieben = 0;
  let neun = 0;
  for (let i = 0; i < g.length; i++) {
    const x = g[i]!;
    k.berechnet[i] = await sha256Hex(gliedEingabe(x.roh));
    if (i % 256 === 0) k.melde((0.4 * i) / g.length, `Prüfsummen der Kette: ${zahl(i)} von ${zahl(g.length)}`);
    const name = gliedName(x);
    if (x.form === "bruch") brueche.push({ index: i, text: `${name}: nur eines der Felder neustarts und autoZeit ist vorhanden.` });
    else if (x.form === "neun") neun++;
    else sieben++;
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
  if (brueche.length === 0) {
    k.ersterBruch = null;
    const formen = [sieben ? anzahl(sieben, "Glied mit sieben Feldern", "Glieder mit sieben Feldern") : "", neun ? anzahl(neun, "Glied mit Uhrstand (neun Felder)", "Glieder mit Uhrstand (neun Felder)") : ""].filter(Boolean);
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
    const details: Detail[] = brueche.slice(0, 200).map((b) => ({ text: b.text }));
    if (brueche.length > 200) details.push({ text: `… und ${brueche.length - 200} weitere Befunde.` });
    sage(
      k,
      "P2",
      "widerlegt",
      `Die Kette ist ab ${gliedName(erster)} unterbrochen.`,
      `WATTest hat die Prüfsummen nach 4.2 neu berechnet und die Verkettung geprüft. ${anzahl(brueche.length, "Befund passt", "Befunde passen")} nicht zu einer unveränderten Kette. Ein früherer Eintrag wurde verändert, gelöscht oder eingefügt, oder die Datei ist beschädigt.`,
      { fundstelle: dateiFundstelle(k, `Glied ${bereiche(brueche.map((b) => g[b.index]!.seq ?? b.index + 1))}`), grenze: GRENZE.kette, details },
    );
  }
}

/** P4: Zeitstempel, Vermerke zur Uhr, Neustarts, automatische Uhrzeit. */
export function pruefeZeit(k: Kontext): void {
  const g = k.kt.glieder;
  if (g.length === 0) return;
  const unvermerkt: Detail[] = [];
  let kleine = 0;
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
      kleine++;
      continue;
    }
    const naechstes = g[i + 1];
    const erklaert =
      (b.objektArt === "uhr_ruecksprung" && (b.objektId === "timer" || b.objektId === "nachweis")) ||
      (naechstes?.objektArt === "uhr_ruecksprung" && naechstes.objektId === String(b.seq)) ||
      b.objektArt === "uhr_verstellt" ||
      a.objektArt === "uhr_verstellt";
    if (!erklaert) {
      unvermerkt.push({ text: `${gliedText(b)} liegt ${minuten(zurueck)} vor ${gliedText(a)}; es folgt kein Glied uhr_ruecksprung, und kein Glied uhr_verstellt erklärt den Sprung.` });
    }
  }
  const fund = dateiFundstelle(k);
  if (unvermerkt.length) {
    sage(k, "P4", "widerlegt", `Die Uhr sprang ${anzahl(unvermerkt.length, "Mal", "Mal")} um mehr als 2 Minuten zurück, ohne dass die Kette es vermerkt.`, "WATT hängt nach jedem Rücksprung der Geräteuhr um mehr als 2 Minuten ein Glied uhr_ruecksprung an bzw. vermerkt die Verstellung als uhr_verstellt (Technische Erläuterung 4.1, 4.7 und 8., Schritt 5). Hier fehlt dieser Vermerk.", {
      fundstelle: fund,
      grenze: GRENZE.zeit,
      details: unvermerkt,
    });
  } else {
    sage(
      k,
      "P4",
      "bestaetigt",
      "Die Zeitstempel steigen; jeder Rücksprung der Uhr um mehr als 2 Minuten ist vermerkt.",
      `Die Zeitpunkte der ${anzahl(g.length, "Glieds", "Glieder")} steigen mit der laufenden Nummer${kleine ? `, abgesehen von ${anzahl(kleine, "Rücksprung", "Rücksprüngen")} bis 2 Minuten, die WATT nicht vermerkt` : ""}; nach Rücksprüngen um mehr als 2 Minuten folgt der Vermerk, den 8., Schritt 5 verlangt.`,
      { fundstelle: fund, grenze: GRENZE.zeit },
    );
  }

  const vermerke = g.filter((x) => UHR.has(x.objektArt));
  const mitUhrstand = g.filter((x) => x.form === "neun");
  if (vermerke.length === 0) {
    const neu = mitUhrstand.length === g.length;
    sage(
      k,
      "P4",
      "bestaetigt",
      neu ? "Die Uhr des Geräts wurde nicht verstellt." : "Die Kette vermerkt keinen Rücksprung und keine Verstellung der Geräteuhr.",
      neu
        ? "Alle Glieder tragen den Uhrstand (4.7), und die Kette enthält kein Glied uhr_verstellt, uhr_ruecksprung oder uhr_abweichung."
        : "Die Kette enthält kein Glied uhr_ruecksprung, uhr_abweichung oder uhr_verstellt.",
      { fundstelle: fund, grenze: neu ? GRENZE.zeit : GRENZE.zeitAlt },
    );
  } else {
    const details = vermerke.map((x) => ({ text: `${gliedText(x)}: ${uhrBeschreibung(x)}` }));
    sage(k, "P4", "hinweis", `Die Kette vermerkt ${anzahl(vermerke.length, "Vorgang", "Vorgänge")} an der Geräteuhr.`, "WATT vermerkt Rücksprünge (uhr_ruecksprung), Abweichungen beim Timer (uhr_abweichung) und Verstellungen der Uhr (uhr_verstellt) als eigene Glieder (4.1, 4.7). Sie zeigen, dass die Uhr des Geräts nicht durchgehend gleichmäßig lief; die Zeitpunkte dieser Abschnitte stammen von der verstellten Uhr.", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(vermerke.map((x) => x.seq ?? 0))}`),
      grenze: GRENZE.zeit,
      details,
    });
  }

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
      summe === 1 ? "Das Gerät wurde einmal neu gestartet." : `Das Gerät wurde ${zahl(summe)}-mal neu gestartet.`,
      `Summe der Neustarts (neustarts) aus ${anzahl(mitUhrstand.length, "Glied", "Gliedern")} mit Uhrstand (4.7)${ohneBezug.length ? `; bei ${anzahl(ohneBezug.length, "Glied", "Gliedern")} fehlte der Bezug (-1), etwa nach dem Update oder einer Wiederherstellung: Glied ${bereiche(ohneBezug)}` : ""}. Über einen Neustart hinweg prüft WATT die Uhr nicht gegen die Monotonuhr.`,
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

function uhrBeschreibung(x: Glied): string {
  const d = x.json ?? {};
  if (x.objektArt === "uhr_ruecksprung") {
    const v = zeitpunktMs(d["vorher"]);
    const n = zeitpunktMs(d["nachher"]);
    const anlass = x.objektId === "timer" ? "beim Start eines Timers" : x.objektId === "nachweis" ? "beim Festhalten eines Nachweises" : `nach Glied ${x.objektId}`;
    return `Rücksprung der Uhr ${anlass}${v !== null && n !== null ? ` von ${deutsch(v)} auf ${deutsch(n)}` : ""}`;
  }
  if (x.objektArt === "uhr_abweichung") {
    if (d["art"] === "neustart") return "Neustart des Geräts während eines Timer-Laufs";
    const s = typeof d["abweichungSekunden"] === "number" ? (d["abweichungSekunden"] as number) : null;
    return `Beginn eines Timer-Laufs nach der Monotonuhr korrigiert${s !== null ? ` (Abweichung ${zahl(Math.round(s / 60))} Minuten)` : ""}`;
  }
  const s = typeof d["abweichungSekunden"] === "number" ? (d["abweichungSekunden"] as number) : null;
  const richtung = d["richtung"] === "vor" ? "vorgestellt" : d["richtung"] === "zurueck" ? "zurückgestellt" : "verstellt";
  const anlass: Record<string, string> = { glied: "vor einem neuen Glied", zeitsignal: "Zeitsignal von Android", timer: "beim Start eines Timers", nachweis: "beim Festhalten eines Nachweises", start: "beim Start der App" };
  return `Uhr ${richtung}${s !== null ? ` um ${zahl(Math.round(Math.abs(s) / 60))} Minuten` : ""} (${anlass[x.objektId] ?? x.objektId}${d["schritte"] !== undefined ? ", in kleinen Schritten" : ""})`;
}

function abstand(ms: number): string {
  const h = ms / 3600000;
  if (h < 48) return `ca. ${zahl(Math.round(h))} Stunden`;
  return `ca. ${zahl(Math.round(h / 24))} Tage`;
}

/** P9: Neubeginne, Wiederherstellungen, Löschungen, Änderungen mit Kommentar, Nachträge, eingelesene Buchungen. */
export function pruefeBesondere(k: Kontext): void {
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
      details.push({ text: `Bestand zum Neubeginn: ${anzahl(e, "Eintrag", "Einträge")} und ${anzahl(a, "Abwesenheit", "Abwesenheiten")} mit Bestandsprüfsumme.` });
    } else {
      details.push({ text: "Älterer Neubeginn (vor dem 19.10.2026): Er nennt nur die Prüfsumme des Bestands, nicht die alte Kette." });
    }
    details.push({ text: `Prüfsumme des Datenbestands (4.6): ${String(d["bestand"] ?? "fehlt")}.` });
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
      details.push({ text: `Signaturen der Datei laut WATT: ${s === "GEPRUEFT" ? "geprüft, alle gültig" : s === "UNGUELTIG" ? `ungültig ab Glied ${String(d["signaturenUngueltigAb"] ?? "?")}` : s === "KEINE" ? "keine" : s}.` });
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
    sage(k, "P9", "hinweis", `${anzahl(kommentiert.length, "Änderung trägt", "Änderungen tragen")} einen Kommentar.`, "Seit dem 23.10.2026 kann eine Änderung einen Kommentar (begruendung) tragen; er geht in die Prüfsumme ein (4.1).", {
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

  // Nachträge nach 4.5 über die Einträge der Datei.
  const nachtraege: Detail[] = [];
  const nachtragIds = new Set<string>();
  const eintraege = Array.isArray(k.kt.daten["eintraege"]) ? (k.kt.daten["eintraege"] as Record<string, unknown>[]) : [];
  for (const e of eintraege) {
    if (!e || typeof e !== "object") continue;
    let ende = zeitpunktMs(e["ende"]);
    if (ende === null && typeof e["tag"] === "string") ende = berlinTagesende(e["tag"] as string);
    if (ende === null) continue;
    const kenn = `Eintrag ${String(e["id"])} vom ${String(e["tag"])}`;
    const vorher = nachtraege.length;
    const imp = zeitpunktMs(e["importiertAm"]);
    const erf = zeitpunktMs(e["erfasstAm"]);
    const geae = zeitpunktMs(e["geaendertAm"]);
    if (imp !== null && imp - ende > 86400000) nachtraege.push({ text: `${kenn}: eingelesen ${abstand(imp - ende)} nach Ende` });
    if (erf !== null && erf - ende > 86400000) nachtraege.push({ text: `${kenn}: erfasst ${abstand(erf - ende)} nach Ende${imp !== null ? " (laut Datei)" : ""}` });
    else if (geae !== null && geae - ende > 86400000) nachtraege.push({ text: `${kenn}: zuletzt geändert ${abstand(geae - ende)} nach Ende${imp !== null ? " (laut Datei)" : ""}` });
    if (nachtraege.length > vorher) nachtragIds.add(String(e["id"]));
  }
  if (nachtraege.length) {
    sage(k, "P9", "hinweis", `${anzahl(nachtragIds.size, "Eintrag ist ein Nachtrag", "Einträge sind Nachträge")} (mehr als 24 Stunden nach Ende erfasst oder geändert).`, "Nach 4.5 kennzeichnet WATT Einträge, die mehr als 24 Stunden nach dem Ende der Tätigkeit erfasst oder zuletzt geändert wurden; bei Tagesblöcken zählt das Ende des Tages (Datenformat, eintraege).", {
      fundstelle: fund,
      details: nachtraege,
    });
  }

  const importe = g.filter((x) => x.aktion === "ANGELEGT" && typeof x.json?.["importDatei"] === "string");
  if (importe.length) {
    const nachDatei = new Map<string, number[]>();
    for (const x of importe) {
      const h = String(x.json!["importDatei"]);
      nachDatei.set(h, [...(nachDatei.get(h) ?? []), x.seq ?? 0]);
    }
    sage(k, "P9", "hinweis", `${anzahl(importe.length, "Buchung wurde", "Buchungen wurden")} aus ${anzahl(nachDatei.size, "Datei", "Dateien")} eingelesen.`, "Eingelesene Buchungen tragen im Anlage-Glied importDatei, die SHA-256 der eingelesenen Datei (4.1, 7.1). Ihre Erfassungs- und Änderungszeitpunkte stammen aus der Datei des anderen Geräts.", {
      fundstelle: dateiFundstelle(k, `Glied ${bereiche(importe.map((x) => x.seq ?? 0))}`),
      grenze: GRENZE.besondere,
      details: [...nachDatei].map(([h, s]) => ({ text: `Datei mit SHA-256 ${h}: Glied ${bereiche(s)}` })),
    });
  }

  const alt = g.filter((x) => ["profil", "funktion", "ferien", "sondertag", "kategorie", "unterkategorie", "stundenplan"].includes(x.objektArt));
  if (alt.length) {
    sage(k, "P9", "hinweis", `Die Kette enthält ${anzahl(alt.length, "älteres Glied", "ältere Glieder")} zu Einstellungen.`, "Protokolle bis zum 08.10.2026 können Glieder zu Profil, Ferien, Kategorien und Stundenplan enthalten; sie werden wie alle anderen geprüft, gehen aber nicht in den Abgleich der Daten ein (4.1).", {
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
