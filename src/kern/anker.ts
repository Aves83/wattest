// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Anker: QR-Code watt-pruef:1 (Technische Erläuterung 6.2) und Prüfvermerk von Hand (6.1).

export interface Anker {
  quelle: "qr" | "hand" | "vermerk";
  /** WATT-Version laut Anker, falls angegeben */
  version: string | null;
  n: number;
  /** Zeitpunkt in deutscher Zeit auf Minuten, JJJJ-MM-TTTHH:MM */
  t: string;
  sha256: string;
  r: number | null;
  w: number | null;
  wa: number | null;
  i: number | null;
  s: boolean | null;
  unbekannt: string[];
}

export type AnkerErgebnis = { ok: true; anker: Anker } | { ok: false; fehler: string };

const HASH = /^[0-9a-fA-F]{64}$/;

function zahlFeld(name: string, wert: string): number | string {
  if (!/^\d+$/.test(wert)) return `${name} muss eine ganze Zahl sein, nicht „${wert}“.`;
  return Number(wert);
}

function pruefeT(t: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) return "t muss die Form JJJJ-MM-TTTHH:MM haben.";
  const [mo, tag, h, mi] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  if (mo < 1 || mo > 12 || tag < 1 || tag > 31 || h > 23 || mi > 59) return "t enthält kein gültiges Datum.";
  return null;
}

/** Liest den Text eines QR-Codes watt-pruef:1;… */
export function leseQr(text: string): AnkerErgebnis {
  const roh = text.trim();
  if (!roh.startsWith("watt-pruef:")) return { ok: false, fehler: "Der Text beginnt nicht mit „watt-pruef:“." };
  const teile = roh.split(";");
  if (teile[0] !== "watt-pruef:1") return { ok: false, fehler: `Unbekannte Fassung „${teile[0]}“; WATTest kennt „watt-pruef:1“.` };
  const f = new Map<string, string>();
  for (const t of teile.slice(1)) {
    const i = t.indexOf("=");
    if (i <= 0) return { ok: false, fehler: `Feld „${t}“ hat keine Form name=wert.` };
    const k = t.slice(0, i);
    if (f.has(k)) return { ok: false, fehler: `Feld „${k}“ steht doppelt.` };
    f.set(k, t.slice(i + 1));
  }
  for (const pflicht of ["v", "n", "t", "sha256"]) if (!f.has(pflicht)) return { ok: false, fehler: `Feld „${pflicht}“ fehlt.` };
  const n = zahlFeld("n", f.get("n")!);
  if (typeof n === "string") return { ok: false, fehler: n };
  if (n < 1) return { ok: false, fehler: "n muss mindestens 1 sein; bei leerem Protokoll gibt es keinen QR-Code." };
  const t = f.get("t")!;
  const tf = pruefeT(t);
  if (tf) return { ok: false, fehler: tf };
  const sha = f.get("sha256")!;
  if (!HASH.test(sha)) return { ok: false, fehler: "sha256 muss aus 64 Hexadezimalzeichen bestehen." };
  const optional = (k: string): number | null | string => {
    const w = f.get(k);
    if (w === undefined) return null;
    return zahlFeld(k, w);
  };
  const werte: Record<string, number | null> = {};
  for (const k of ["r", "w", "wa", "i"]) {
    const w = optional(k);
    if (typeof w === "string") return { ok: false, fehler: w };
    werte[k] = w;
  }
  let s: boolean | null = null;
  if (f.has("s")) {
    if (f.get("s") !== "1") return { ok: false, fehler: "s darf nur 1 sein." };
    s = true;
  }
  const bekannt = new Set(["v", "n", "t", "sha256", "r", "w", "wa", "i", "s"]);
  return {
    ok: true,
    anker: {
      quelle: "qr",
      version: f.get("v")!,
      n,
      t,
      sha256: sha.toLowerCase(),
      r: werte["r"]!,
      w: werte["w"]!,
      wa: werte["wa"]!,
      i: werte["i"]!,
      s,
      unbekannt: [...f.keys()].filter((k) => !bekannt.has(k)),
    },
  };
}

/** Stand „TT.MM.JJJJ HH:MM“ (auch mit Komma und „Uhr“) in JJJJ-MM-TTTHH:MM. */
export function leseStand(text: string): string | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(\d{1,2}):(\d{2})(?:\s*Uhr)?\s*$/.exec(text);
  if (!m) return null;
  const t = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}T${m[4]!.padStart(2, "0")}:${m[5]}`;
  return pruefeT(t) ? null : t;
}

export interface HandFelder {
  anzahl: string;
  stand: string;
  pruefsumme: string;
}

export type HandErgebnis = { ok: true; anker: Anker } | { ok: false; fehler: Partial<Record<keyof HandFelder, string>> };

/** Anker von Hand aus Anzahl, Stand und Prüfsumme des Prüfvermerks. */
export function leseHand(f: HandFelder): HandErgebnis {
  const fehler: Partial<Record<keyof HandFelder, string>> = {};
  const anzahl = f.anzahl.trim();
  if (!/^\d+$/.test(anzahl)) fehler.anzahl = "Bitte die Anzahl der Einträge als ganze Zahl eingeben.";
  const t = leseStand(f.stand);
  if (!t) fehler.stand = "Bitte den Stand als TT.MM.JJJJ HH:MM eingeben, z. B. 12.03.2026 14:32.";
  const sha = f.pruefsumme.replace(/\s+/g, "");
  const n = Number(anzahl);
  if (!(HASH.test(sha) || (sha === "0" && n === 0))) fehler.pruefsumme = "Die Prüfsumme hat 64 Hexadezimalzeichen (0–9, a–f).";
  if (Object.keys(fehler).length) return { ok: false, fehler };
  return {
    ok: true,
    anker: { quelle: "hand", version: null, n, t: t!, sha256: sha.toLowerCase(), r: null, w: null, wa: null, i: null, s: null, unbekannt: [] },
  };
}

/** Liest den Wortlaut eines Prüfvermerks (6.2) aus eingefügtem Text. */
export function leseVermerk(text: string): AnkerErgebnis | null {
  const m =
    /Prüfvermerk WATT\s+(\S+):\s*Arbeitszeitprotokoll mit\s+(\d+)\s+Einträgen?,\s*Stand\s+(\d{1,2}\.\d{1,2}\.\d{4}),\s*(\d{1,2}:\d{2})\s*Uhr,\s*SHA-256:\s*([0-9a-fA-F]{64}|0)\b/.exec(
      text,
    );
  if (!m) return null;
  const h = leseHand({ anzahl: m[2]!, stand: `${m[3]} ${m[4]}`, pruefsumme: m[5]! });
  if (!h.ok) return { ok: false, fehler: Object.values(h.fehler).join(" ") };
  return { ok: true, anker: { ...h.anker, quelle: "vermerk", version: m[1]!.replace(/:$/, "") } };
}

/** Liest eingefügten Text: QR-Inhalt oder Wortlaut des Prüfvermerks. */
export function leseAnkerText(text: string): AnkerErgebnis {
  if (text.trim().startsWith("watt-pruef:")) return leseQr(text);
  const v = leseVermerk(text);
  if (v) return v;
  return { ok: false, fehler: "Das ist weder der Inhalt eines QR-Codes „watt-pruef:1;…“ noch der Wortlaut eines Prüfvermerks." };
}

export function ankerName(a: Anker): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(a.t)!;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}
