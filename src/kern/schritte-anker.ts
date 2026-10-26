// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// P5: Anker (Prüfvermerk bzw. QR-Code watt-pruef:1) gegen die Kette prüfen (Technische Erläuterung 6.1, 6.2).

import { ankerName, type Anker } from "./anker.js";
import type { Detail } from "./befund.js";
import { GRENZE } from "./grenzen.js";
import { gliedName, type Glied } from "./klartext.js";
import { dateiFundstelle, sage, type Kontext } from "./kontext.js";
import { berlinMinute, deutsch, zeitpunktMs } from "./zeit.js";

/** Handlungshinweis, wenn kein Anker vorliegt (Auftrag 0.1.5, B3; unpersönlich seit 0.1.6, E-58). */
export const HANDLUNG_ANKER = "Ein Prüfvermerk aus einem Bericht oder einer Anzeige (Text oder QR-Code) lässt sich hinzufügen, um den Stand daran zu prüfen.";

function zaehler(g: Glied[], bis: number): { r: number; w: number; wa: number; i: number } {
  let r = 0;
  let w = 0;
  let wa = 0;
  let i = 0;
  for (let j = 0; j <= bis && j < g.length; j++) {
    const x = g[j]!;
    if (x.objektArt === "uhr_ruecksprung" || x.objektArt === "uhr_abweichung" || x.objektArt === "uhr_verstellt") r++;
    if (x.objektArt === "wiederherstellung") {
      w++;
      if (x.json?.["vorgeschichte"] !== "UEBEREINSTIMMEND") wa++;
    }
    // i: Anlage-Glieder eintrag und abwesenheit mit importDatei (6.2, 4.1).
    if (x.aktion === "ANGELEGT" && (x.objektArt === "eintrag" || x.objektArt === "abwesenheit") && typeof x.json?.["importDatei"] === "string") i++;
  }
  return { r, w, wa, i };
}

function quelleText(a: Anker): string {
  return a.quelle === "qr" ? "QR-Code" : a.quelle === "vermerk" ? "Prüfvermerk (eingefügt)" : "Prüfvermerk (von Hand)";
}

/** Sucht einen früheren Kopf, den ein Neubeginn oder eine Wiederherstellung nennt. */
function frueherer(g: Glied[], a: Anker): { glied: Glied; art: "neubeginn" | "wiederherstellung" } | null {
  for (const x of g) {
    if (x.objektArt !== "neubeginn" && x.objektArt !== "wiederherstellung") continue;
    const d = x.json ?? {};
    if (Number(d["vorherAnzahl"]) === a.n && String(d["vorherLetzterHash"]) === a.sha256) return { glied: x, art: x.objektArt };
  }
  return null;
}

export function pruefeAnker(k: Kontext): void {
  const g = k.kt.glieder;
  const anker = k.optionen.anker;
  if (anker.length === 0) {
    sage(k, "P5", "offen", `Es liegt kein Anker vor. ${HANDLUNG_ANKER}`, "Ohne Prüfvermerk oder QR-Code aus einem weitergegebenen Dokument lässt sich nicht bestätigen, dass die Kette seit einem früheren Stand unverändert ist. Ein Anker lässt sich oben unter „Anker“ eingeben.", {
      fundstelle: dateiFundstelle(k),
      grenze: GRENZE.anker,
      kennung: "ohne-anker",
    });
    return;
  }
  for (const a of anker) {
    const name = ankerName(a);
    const fund = (x?: Glied): string => dateiFundstelle(k, x ? `${gliedName(x)}; Anker aus ${quelleText(a)}` : `Anker aus ${quelleText(a)}`);
    if (a.n === 0) {
      sage(k, "P5", "offen", `Der Anker vom ${name} nennt ein leeres Protokoll.`, "Bei leerem Protokoll nennt der Prüfvermerk 0 Einträge und die Prüfsumme 0 (6.1); er legt keinen Kopf fest, gegen den sich die Kette prüfen ließe.", { fundstelle: fund(), grenze: GRENZE.anker });
      continue;
    }
    if (a.version && /-debug/.test(a.version)) {
      sage(k, "P5", "offen", `Der Anker vom ${name} stammt aus der Debug-Variante von WATT.`, `Der Anker nennt die Version ${a.version}. In der Debug-Variante lassen sich beide Ketten über das Debug-Menü löschen und Beispieldaten anlegen (Technische Erläuterung, Abschnitt 9).`, { fundstelle: fund() });
    }
    const index = g.findIndex((x) => x.seq === a.n);
    const glied = index >= 0 ? g[index]! : null;
    if (!glied || glied.hash !== a.sha256) {
      const f = frueherer(g, a);
      if (f) {
        const d = f.glied.json ?? {};
        const z = zeitpunktMs(d["vorherZeitpunkt"]);
        const zeitOk = z === null || berlinMinute(z) === a.t;
        sage(
          k,
          "P5",
          zeitOk ? "bestaetigt" : "widerlegt",
          f.art === "neubeginn"
            ? zeitOk ? `Der Anker vom ${name} passt zum letzten Stand der Kette vor dem Neubeginn.` : `Der Anker vom ${name} passt nicht zum Zeitpunkt der Kette vor dem Neubeginn.`
            : zeitOk ? `Der Anker vom ${name} passt zum Kopf der Kette, die bei der Wiederherstellung am ${f.glied.ms !== null ? deutsch(f.glied.ms) : f.glied.zeitpunkt} ersetzt wurde.` : `Der Anker vom ${name} passt nicht zum Zeitpunkt der ersetzten Kette.`,
          `${gliedName(f.glied)} (${f.art}) nennt als letzten Stand der früheren Kette Glied ${a.n} mit der Prüfsumme ${a.sha256}${z !== null ? ` vom ${deutsch(z)}` : ""}; das ist der Kopf des Ankers. Die Glieder dieser früheren Kette stehen nicht in der Datei; das Glied selbst ist durch die Kette geschützt.`,
          { fundstelle: fund(f.glied), grenze: "Über die Glieder der früheren Kette sagt das nichts; sie sind nur über frühere Sicherungen prüfbar (Technische Erläuterung, Abschnitt 9)." },
        );
        continue;
      }
      const neubeginn = g[0]?.objektArt === "neubeginn" ? g[0] : null;
      const ankerMs = Date.UTC(Number(a.t.slice(0, 4)), Number(a.t.slice(5, 7)) - 1, Number(a.t.slice(8, 10)), Number(a.t.slice(11, 13)), Number(a.t.slice(14, 16))) - 60 * 60000;
      if (neubeginn && neubeginn.ms !== null && ankerMs < neubeginn.ms - 2 * 3600000) {
        sage(k, "P5", "offen", `Der Anker vom ${name} stammt aus der Zeit vor dem Neubeginn am ${deutsch(neubeginn.ms)}.`, `Die Kette beginnt mit einem Neubeginn; die Glieder davor stehen nicht in der Datei. Der Start-Eintrag nennt als letzten Stand der alten Kette nicht den Kopf dieses Ankers (Glied ${a.n}).`, {
          fundstelle: fund(neubeginn),
          grenze: GRENZE.anker,
        });
        continue;
      }
      const letzte = g[g.length - 1];
      const grund = !glied
        ? letzte && letzte.seq !== null && letzte.seq < a.n
          ? `Der Anker nennt Glied ${a.n}, die Kette endet bei Glied ${letzte.seq}. Die Kette wurde nach dem Anker gekürzt oder durch eine andere ersetzt (Technische Erläuterung, Abschnitt 9).`
          : `Die Kette enthält kein Glied mit der Nummer ${a.n}.`
        : `Glied ${a.n} hat die Prüfsumme ${glied.hash}, der Anker nennt ${a.sha256}. Bis zu diesem Glied wurde die Kette seit dem Anker verändert, oder sie ist eine andere Kette.`;
      sage(k, "P5", "widerlegt", `Der Anker vom ${name} gehört nicht zu dieser Kette.`, grund, { fundstelle: fund(glied ?? undefined), grenze: GRENZE.anker });
      continue;
    }
    // Prüfsumme stimmt.
    const probleme: Detail[] = [];
    if (k.ersterBruch !== null && k.ersterBruch <= index) {
      probleme.push({ text: `Die Kette ist vor dem Anker unterbrochen (${gliedName(g[k.ersterBruch]!)}); der Inhalt bis Glied ${a.n} wurde seit dem Anker verändert.` });
    }
    const stand = glied.ms !== null ? berlinMinute(glied.ms) : null;
    if (stand !== a.t) probleme.push({ text: `Zeitpunkt: Glied ${a.n} stammt vom ${glied.ms !== null ? deutsch(glied.ms) : glied.zeitpunkt}, der Anker nennt ${name}.` });
    if (a.quelle === "qr") {
      const z = zaehler(g, index);
      const pruefe = (feld: string, imAnker: number | null, inKette: number, was: string): void => {
        const erwartet = imAnker ?? 0;
        if (erwartet !== inKette) probleme.push({ text: `${feld}: Der Anker nennt ${erwartet} ${was}, die Kette bis Glied ${a.n} enthält ${inKette}.` });
      };
      pruefe("r", a.r, z.r, "Vermerke zur Geräteuhr");
      pruefe("w", a.w, z.w, "Wiederherstellungen");
      pruefe("wa", a.wa, z.wa, "Wiederherstellungen ohne übereinstimmende Vorgeschichte");
      pruefe("i", a.i, z.i, "aus einer Datei eingelesene Einträge und Abwesenheiten");
    }
    if (probleme.length) {
      sage(k, "P5", "widerlegt", `Der Anker vom ${name} passt nicht zur Kette.`, `Glied ${a.n} trägt die Prüfsumme des Ankers, aber nicht alles stimmt überein.`, { fundstelle: fund(glied), grenze: GRENZE.anker, details: probleme });
      continue;
    }
    const zusatz: string[] = [];
    if (a.quelle === "qr") zusatz.push("Die Zähler r, w, wa und i des QR-Codes stimmen mit der Kette bis zu diesem Glied überein.");
    if (a.version) zusatz.push(`Der Anker nennt WATT ${a.version}.`);
    if (a.unbekannt.length) zusatz.push(`Felder, die WATTest nicht kennt, blieben unbeachtet: ${a.unbekannt.join(", ")}.`);
    sage(
      k,
      "P5",
      "bestaetigt",
      `Der Anker vom ${name} passt zur Kette.`,
      `Glied ${a.n} hat die Prüfsumme des Ankers und den Zeitpunkt ${name} (deutsche Zeit, auf Minuten); die Kette ist bis dorthin intakt. Damit sind alle Glieder bis Glied ${a.n} seit dem Anker unverändert (6.). ${zusatz.join(" ")}`.trim(),
      { fundstelle: fund(glied), grenze: GRENZE.anker },
    );
    if (a.s === true) {
      const s = k.signaturen.get(a.n);
      if (s === undefined) {
        sage(k, "P5", "offen", `Der Anker vom ${name} nennt einen signierten Kopf, die Datei enthält keine Signatur zu Glied ${a.n}.`, "Mit ;s=1 trägt der QR-Code die Angabe, dass der festgehaltene Kopf signiert war (6.2). Die Signatur fehlt in kettensignaturen.", { fundstelle: fund(glied) });
      }
    }
  }
}
