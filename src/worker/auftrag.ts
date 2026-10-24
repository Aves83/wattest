// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Auftrag an den Worker und seine Meldungen; ohne Worker läuft dieselbe Funktion auf der Seite.

import type { Anker } from "../kern/anker.js";
import type { Befund } from "../kern/befund.js";
import { pemZuDer } from "../kern/x509.js";
import type { Sperrliste } from "../kern/kontext.js";
import { pruefe, type Eingabedatei } from "../kern/pruefung.js";

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
  | { art: "fehler"; text: string };

export async function auftragAusfuehren(a: Auftrag, melde: (m: Meldung) => void): Promise<void> {
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
      },
      { version: a.version, commit: a.commit },
    );
    melde({ art: "ergebnis", befund });
  } catch (e) {
    melde({ art: "fehler", text: (e as Error).message });
  }
}
