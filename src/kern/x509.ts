// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// X.509-Zertifikate lesen und Signaturen über WebCrypto prüfen.

import { ausBase64, gleich, hex, puffer } from "./bytes.js";
import { DerFehler, T, bitString, bool, erwarte, ganz, inhalt, kinder, oid, teil, wurzel, zeit, type Tlv } from "./der.js";
import { GRENZWERTE, grenzeText } from "./grenzen.js";
import { subtle } from "./sha.js";

export interface Erweiterung {
  oid: string;
  kritisch: boolean;
  wert: Uint8Array;
}

export interface Zertifikat {
  der: Uint8Array;
  tbs: Uint8Array;
  signaturAlgorithmus: string;
  signatur: Uint8Array;
  /** Seriennummer hexadezimal, klein, ohne führende Nullen */
  seriennummer: string;
  aussteller: Uint8Array;
  inhaber: Uint8Array;
  ausstellerText: string;
  inhaberText: string;
  nichtVor: number;
  nichtNach: number;
  spki: Uint8Array;
  schluesselAlgorithmus: string;
  kurve: string | null;
  erweiterungen: Erweiterung[];
}

const NAMEN: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.5": "serialNumber",
  "2.5.4.6": "C",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.12": "T",
};

function nameText(t: Tlv): string {
  const teile: string[] = [];
  for (const rdn of kinder(t)) {
    for (const atv of kinder(rdn)) {
      const [typ, wert] = kinder(atv);
      if (!typ || !wert) continue;
      const name = NAMEN[oid(typ)] ?? oid(typ);
      let text: string;
      try {
        text = new TextDecoder("utf-8").decode(inhalt(wert));
      } catch {
        text = hex(inhalt(wert));
      }
      teile.push(`${name}=${text}`);
    }
  }
  return teile.join(", ");
}

function seriennummerHex(t: Tlv): string {
  let s = hex(inhalt(t));
  s = s.replace(/^0+/, "");
  return s === "" ? "0" : s;
}

export function leseZertifikat(der: Uint8Array): Zertifikat {
  if (der.length > GRENZWERTE.zertifikatBytes) throw new DerFehler(`Zertifikat größer als die Grenze von ${grenzeText(GRENZWERTE.zertifikatBytes, "bytes")}`);
  const zert = erwarte(wurzel(der), T.SEQUENCE);
  const aussen = kinder(zert);
  if (aussen.length !== 3) throw new DerFehler("Zertifikat besteht nicht aus genau drei Teilen");
  const [tbsT, algT, sigT] = aussen as [Tlv, Tlv, Tlv];
  const tbsTeile = kinder(erwarte(tbsT, T.SEQUENCE));
  let i = 0;
  if (tbsTeile[0] && tbsTeile[0].klasse === 2 && tbsTeile[0].tag === 0) i++;
  const serialT = erwarte(teil(tbsTeile, i++, "Seriennummer"), T.INTEGER);
  teil(tbsTeile, i++, "Signaturverfahren im Zertifikat");
  const ausstellerT = erwarte(teil(tbsTeile, i++, "Aussteller"), T.SEQUENCE);
  const gueltigT = kinder(erwarte(teil(tbsTeile, i++, "Gültigkeit"), T.SEQUENCE));
  if (gueltigT.length !== 2) throw new DerFehler("Gültigkeit besteht nicht aus zwei Zeitpunkten");
  const inhaberT = erwarte(teil(tbsTeile, i++, "Inhaber"), T.SEQUENCE);
  const spkiT = erwarte(teil(tbsTeile, i++, "öffentlicher Schlüssel"), T.SEQUENCE);
  const erweiterungen: Erweiterung[] = [];
  for (; i < tbsTeile.length; i++) {
    const t = tbsTeile[i]!;
    if (t.klasse === 2 && t.tag === 3) {
      const liste = kinder(t)[0];
      if (!liste) continue;
      for (const ext of kinder(erwarte(liste, T.SEQUENCE))) {
        const k = kinder(erwarte(ext, T.SEQUENCE));
        const id = oid(erwarte(teil(k, 0, "Kennung der Erweiterung"), T.OID));
        let kritisch = false;
        let w = teil(k, 1, "Wert der Erweiterung");
        if (w.tag === T.BOOLEAN) {
          kritisch = bool(w);
          w = teil(k, 2, "Wert der Erweiterung");
        }
        erweiterungen.push({ oid: id, kritisch, wert: inhalt(erwarte(w, T.OCTET_STRING)) });
      }
    }
  }
  const spkiTeile = kinder(spkiT);
  const algTeile = kinder(erwarte(teil(spkiTeile, 0, "Verfahren des Schlüssels"), T.SEQUENCE));
  const schluesselAlgorithmus = oid(erwarte(teil(algTeile, 0, "Verfahren des Schlüssels"), T.OID));
  const kurve = algTeile[1] && algTeile[1].tag === T.OID ? oid(algTeile[1]) : null;
  const sigAlg = oid(erwarte(teil(kinder(erwarte(algT, T.SEQUENCE)), 0, "Signaturverfahren"), T.OID));
  return {
    der,
    tbs: ganz(tbsT),
    signaturAlgorithmus: sigAlg,
    signatur: bitString(erwarte(sigT, T.BIT_STRING)),
    seriennummer: seriennummerHex(serialT),
    aussteller: ganz(ausstellerT),
    inhaber: ganz(inhaberT),
    ausstellerText: nameText(ausstellerT),
    inhaberText: nameText(inhaberT),
    nichtVor: zeit(gueltigT[0]!),
    nichtNach: zeit(gueltigT[1]!),
    spki: ganz(spkiT),
    schluesselAlgorithmus,
    kurve,
    erweiterungen,
  };
}

const KURVEN: Record<string, { name: string; groesse: number }> = {
  "1.2.840.10045.3.1.7": { name: "P-256", groesse: 32 },
  "1.3.132.0.34": { name: "P-384", groesse: 48 },
  "1.3.132.0.35": { name: "P-521", groesse: 66 },
};

const HASHES: Record<string, { art: "ECDSA" | "RSA"; hash: string }> = {
  "1.2.840.10045.4.3.2": { art: "ECDSA", hash: "SHA-256" },
  "1.2.840.10045.4.3.3": { art: "ECDSA", hash: "SHA-384" },
  "1.2.840.10045.4.3.4": { art: "ECDSA", hash: "SHA-512" },
  "1.2.840.113549.1.1.11": { art: "RSA", hash: "SHA-256" },
  "1.2.840.113549.1.1.12": { art: "RSA", hash: "SHA-384" },
  "1.2.840.113549.1.1.13": { art: "RSA", hash: "SHA-512" },
};

const EC_OID = "1.2.840.10045.2.1";
const RSA_OID = "1.2.840.113549.1.1.1";

/** Wandelt eine DER-kodierte ECDSA-Signatur in r‖s fester Länge (IEEE P1363) für WebCrypto. */
export function ecdsaRoh(derSig: Uint8Array, groesse: number): Uint8Array | null {
  try {
    const t = wurzel(derSig);
    if (t.tag !== T.SEQUENCE) return null;
    const k = kinder(t);
    if (k.length !== 2) return null;
    const out = new Uint8Array(2 * groesse);
    for (let j = 0; j < 2; j++) {
      const z = k[j]!;
      if (z.tag !== T.INTEGER) return null;
      let b = inhalt(z);
      while (b.length > 1 && b[0] === 0) b = b.subarray(1);
      if (b.length > groesse) return null;
      out.set(b, j * groesse + (groesse - b.length));
    }
    return out;
  } catch {
    return null;
  }
}

/** Ist die Signatur als DER lesbar: eine SEQUENCE aus genau zwei INTEGER (r, s)? */
export function ecdsaLesbar(derSig: Uint8Array): boolean {
  try {
    const t = wurzel(derSig);
    if (t.tag !== T.SEQUENCE || t.klasse !== 0) return false;
    const k = kinder(t);
    return k.length === 2 && k.every((z) => z.klasse === 0 && z.tag === T.INTEGER && z.ende > z.inhaltStart);
  } catch {
    return false;
  }
}

export interface SchluesselInfo {
  art: "ECDSA" | "RSA";
  kurve?: string;
  groesse?: number;
}

export function schluesselInfo(spki: Uint8Array): SchluesselInfo | null {
  try {
    const t = wurzel(spki);
    const alg = kinder(kinder(t)[0]!);
    const a = oid(alg[0]!);
    if (a === EC_OID) {
      const k = alg[1] ? KURVEN[oid(alg[1])] : undefined;
      if (!k) return null;
      return { art: "ECDSA", kurve: k.name, groesse: k.groesse };
    }
    if (a === RSA_OID) return { art: "RSA" };
    return null;
  } catch {
    return null;
  }
}

const schluesselCache = new Map<string, Promise<CryptoKey>>();

function importiere(spki: Uint8Array, alg: EcKeyImportParams | RsaHashedImportParams): Promise<CryptoKey> {
  const id = `${JSON.stringify(alg)}:${hex(spki)}`;
  let k = schluesselCache.get(id);
  if (!k) {
    if (schluesselCache.size > 64) schluesselCache.clear();
    k = subtle().importKey("spki", puffer(spki), alg, false, ["verify"]);
    schluesselCache.set(id, k);
  }
  return k;
}

/** Prüft eine Signatur über WebCrypto. Ergibt false bei ungültiger Signatur und wirft bei nicht unterstützten Verfahren. */
export async function pruefeSignatur(spki: Uint8Array, algorithmusOid: string, signatur: Uint8Array, daten: Uint8Array): Promise<boolean> {
  const verfahren = HASHES[algorithmusOid];
  if (!verfahren) throw new Error(`Signaturverfahren ${algorithmusOid} wird nicht unterstützt.`);
  const info = schluesselInfo(spki);
  if (!info || info.art !== verfahren.art) throw new Error("Schlüssel passt nicht zum Signaturverfahren.");
  if (info.art === "ECDSA") {
    const roh = ecdsaRoh(signatur, info.groesse!);
    if (!roh) return false;
    const key = await importiere(spki, { name: "ECDSA", namedCurve: info.kurve! });
    return subtle().verify({ name: "ECDSA", hash: verfahren.hash }, key, puffer(roh), puffer(daten));
  }
  const key = await importiere(spki, { name: "RSASSA-PKCS1-v1_5", hash: verfahren.hash });
  return subtle().verify({ name: "RSASSA-PKCS1-v1_5" }, key, puffer(signatur), puffer(daten));
}

/** Prüft, ob `zert` vom Schlüssel `aussteller` signiert ist. */
export async function istSigniertVon(zert: Zertifikat, ausstellerSpki: Uint8Array): Promise<boolean> {
  return pruefeSignatur(ausstellerSpki, zert.signaturAlgorithmus, zert.signatur, zert.tbs);
}

export function gleicherName(a: Uint8Array, b: Uint8Array): boolean {
  return gleich(a, b);
}

export function pemZuDer(pem: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  const re = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pem))) {
    const b = m[1]!.replace(/\s+/g, "");
    const bin = ausBase64(b);
    if (bin) out.push(bin);
  }
  return out;
}
