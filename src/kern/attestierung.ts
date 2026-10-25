// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erweiterung 1.3.6.1.4.1.11129.2.1.17 (KeyDescription) der Android Key Attestation lesen.

import { hex, textAus } from "./bytes.js";
import { DerFehler, T, bool, erwarte, ganzzahl, inhalt, kinder, teil, wurzel, type Tlv } from "./der.js";

export const ATTESTIERUNG_OID = "1.3.6.1.4.1.11129.2.1.17";

export type Sicherheitsstufe = "SOFTWARE" | "TEE" | "STRONGBOX" | "UNBEKANNT";
export type Bootzustand = "VERIFIED" | "SELF_SIGNED" | "UNVERIFIED" | "FAILED" | "UNBEKANNT";

export interface Paket {
  name: string;
  version: number;
}

export interface RootOfTrust {
  verifiedBootKey: string;
  deviceLocked: boolean;
  verifiedBootState: Bootzustand;
}

export interface Schluesselbeschreibung {
  attestationVersion: number;
  attestationSecurityLevel: Sicherheitsstufe;
  keyMintVersion: number;
  keyMintSecurityLevel: Sicherheitsstufe;
  challenge: Uint8Array;
  pakete: Paket[];
  signaturDigests: string[];
  rootOfTrust: RootOfTrust | null;
  osVersion: number | null;
  osPatchLevel: number | null;
  erzeugtAm: number | null;
  /** Felder, die vorhanden, aber nicht lesbar sind */
  unlesbar: string[];
}

function stufe(n: number): Sicherheitsstufe {
  return n === 0 ? "SOFTWARE" : n === 1 ? "TEE" : n === 2 ? "STRONGBOX" : "UNBEKANNT";
}

function boot(n: number): Bootzustand {
  return (["VERIFIED", "SELF_SIGNED", "UNVERIFIED", "FAILED"][n] as Bootzustand | undefined) ?? "UNBEKANNT";
}

function enumWert(t: Tlv): number {
  if (t.tag !== T.ENUMERATED && t.tag !== T.INTEGER) throw new DerFehler("ENUMERATED erwartet");
  return ganzzahl(t);
}

/** Die Felder einer AuthorizationList nach Tag-Nummer, jeweils das explizit getaggte innere Element. */
function autorisierung(t: Tlv): Map<number, Tlv> {
  const m = new Map<number, Tlv>();
  for (const k of kinder(erwarte(t, T.SEQUENCE))) {
    if (k.klasse !== 2) continue;
    const innen = kinder(k)[0];
    if (innen) m.set(k.tag, innen);
  }
  return m;
}

function leseAppId(oktette: Uint8Array): { pakete: Paket[]; digests: string[] } {
  const t = erwarte(wurzel(oktette), T.SEQUENCE);
  const [infos, digests] = kinder(t);
  const pakete: Paket[] = [];
  for (const p of kinder(erwarte(infos, T.SET))) {
    const [name, version] = kinder(erwarte(p, T.SEQUENCE));
    const nameT = erwarte(name, T.OCTET_STRING);
    let n: string;
    try {
      n = textAus(inhalt(nameT));
    } catch {
      n = hex(inhalt(nameT));
    }
    pakete.push({ name: n, version: version ? ganzzahl(version) : 0 });
  }
  const ds: string[] = [];
  if (digests) for (const d of kinder(erwarte(digests, T.SET))) ds.push(hex(inhalt(erwarte(d, T.OCTET_STRING))));
  return { pakete, digests: ds };
}

export function leseSchluesselbeschreibung(wert: Uint8Array): Schluesselbeschreibung {
  const k = kinder(erwarte(wurzel(wert), T.SEQUENCE));
  if (k.length < 8) throw new DerFehler("KeyDescription unvollständig");
  const sw = autorisierung(k[6]!);
  const hw = autorisierung(k[7]!);
  const feld = (tag: number): Tlv | undefined => hw.get(tag) ?? sw.get(tag);

  let pakete: Paket[] = [];
  let digests: string[] = [];
  const appId = feld(709);
  if (appId) {
    const r = leseAppId(inhalt(erwarte(appId, T.OCTET_STRING)));
    pakete = r.pakete;
    digests = r.digests;
  }
  let rootOfTrust: RootOfTrust | null = null;
  const rot = hw.get(704) ?? sw.get(704);
  if (rot) {
    const r = kinder(erwarte(rot, T.SEQUENCE));
    rootOfTrust = {
      verifiedBootKey: hex(inhalt(teil(r, 0, "verifiedBootKey"))),
      deviceLocked: bool(erwarte(r[1], T.BOOLEAN)),
      verifiedBootState: boot(enumWert(teil(r, 2, "verifiedBootState"))),
    };
  }
  // Nicht lesbare Zahlen (etwa über Number.MAX_SAFE_INTEGER) werden nicht still übergangen, sondern genannt.
  const unlesbar: string[] = [];
  const zahl = (tag: number, name: string): number | null => {
    const t = feld(tag);
    if (!t) return null;
    try {
      return ganzzahl(t);
    } catch (e) {
      unlesbar.push(`${name} (Tag ${tag}): ${(e as Error).message}`);
      return null;
    }
  };
  return {
    attestationVersion: ganzzahl(erwarte(k[0]!, T.INTEGER)),
    attestationSecurityLevel: stufe(enumWert(k[1]!)),
    keyMintVersion: ganzzahl(erwarte(k[2]!, T.INTEGER)),
    keyMintSecurityLevel: stufe(enumWert(k[3]!)),
    challenge: inhalt(erwarte(k[4]!, T.OCTET_STRING)),
    pakete,
    signaturDigests: digests,
    rootOfTrust,
    osVersion: zahl(705, "osVersion"),
    osPatchLevel: zahl(706, "osPatchLevel"),
    erzeugtAm: zahl(701, "creationDateTime"),
    unlesbar,
  };
}
