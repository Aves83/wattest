// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Auftrag an den Worker und seine Meldungen; ohne Worker läuft dieselbe Funktion auf der Seite.

import type { Anker } from "../kern/anker.js";
import { gesamt, gesamtText, type Aussage, type Befund } from "../kern/befund.js";
import { pemZuDer } from "../kern/x509.js";
import { Abbruch, type Sperrliste } from "../kern/kontext.js";
import { pruefe, type Eingabedatei } from "../kern/pruefung.js";
import { isoWatt } from "../kern/zeit.js";

export interface Daten {
  wurzeln: { abgerufen: string | null; quelle: string; zertifikate: { name: string; pem: string }[] } | null;
  sperrliste: { abgerufen: string | null; quelle: string; eintraege: Sperrliste["eintraege"] } | null;
  appSignatur: { paketname: string; sha256: string };
}

export interface Auftrag {
  dateien: Eingabedatei[];
  anker: Anker[];
  daten: Daten;
  jetzt: number;
  version: string;
  commit: string;
}

export type Meldung =
  | { art: "fortschritt"; anteil: number; text: string }
  | { art: "ergebnis"; befund: Befund }
  | { art: "abgebrochen" };

/**
 * Befund, wenn die Prüfung selbst scheitert (Ausnahme, Speicher, abgestürzter Worker): eine Aussage „?“ statt einer
 * leeren Seite. Ein Prüffehler ist nie ✗.
 */
export function fehlerBefund(a: Auftrag, grund: string): Befund {
  const aussagen: Aussage[] = [
    {
      schritt: "E",
      zeichen: "offen",
      text: "Die Prüfung ließ sich nicht vollständig ausführen.",
      begruendung: `Bei der Prüfung trat ein Fehler auf: ${grund || "ohne Angabe"}. Ein Prüffehler ist kein Befund über die Dateien; über sie sagt dieser Befund nichts.`,
    },
  ];
  return {
    wattestVersion: a.version,
    commit: a.commit,
    geprueftAm: isoWatt(a.jetzt),
    dateien: (a.dateien ?? []).map((d) => ({ name: String(d?.name ?? ""), groesse: Math.max(d?.bytes?.length ?? 0, d?.groesse ?? 0), sha256: "", art: "nicht geprüft" })),
    sperrliste: null,
    wurzeln: null,
    aussagen,
    gesamt: gesamt(aussagen),
    gesamtText: gesamtText(aussagen),
  };
}

export async function auftragAusfuehren(a: Auftrag, melde: (m: Meldung) => void, abgebrochen?: () => boolean): Promise<void> {
  try {
    let letzte = 0;
    const wurzeln = (a.daten.wurzeln?.zertifikate ?? []).flatMap((z) => pemZuDer(z.pem));
    const befund = await pruefe(
      a.dateien,
      {
        anker: a.anker,
        wurzeln,
        wurzelnStand: a.daten.wurzeln ? { abgerufen: a.daten.wurzeln.abgerufen, quelle: a.daten.wurzeln.quelle } : null,
        sperrliste: a.daten.sperrliste,
        appSignatur: a.daten.appSignatur.sha256,
        paketname: a.daten.appSignatur.paketname,
        jetzt: a.jetzt,
        fortschritt: (anteil, text) => {
          const t = Date.now();
          if (t - letzte > 50 || anteil >= 1) {
            letzte = t;
            melde({ art: "fortschritt", anteil, text });
          }
        },
        ...(abgebrochen ? { abgebrochen } : {}),
      },
      { version: a.version, commit: a.commit },
    );
    melde({ art: "ergebnis", befund });
  } catch (e) {
    if (e instanceof Abbruch) melde({ art: "abgebrochen" });
    else melde({ art: "ergebnis", befund: fehlerBefund(a, (e as Error)?.message ?? String(e)) });
  }
}
