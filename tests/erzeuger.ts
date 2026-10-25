// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeuger für Testdateien im Datenformat 19 mit Schlüssel, Attestierung und Signaturen nach der
// Technischen Erläuterung (4.2, 4.7). Eigene Test-Wurzel, eigenes Zwischen- und Blattzertifikat;
// echte ECDSA-Signaturen über WebCrypto. Die Prüfsummen rechnet der Erzeuger selbst, nicht mit dem Kern.

import { base64, hex, puffer, utf8, verbinde } from "../src/kern/bytes.js";
import { bits, bool, enumWert, explizit, int, intRoh, name, nul, oid, oktette, seq, set, zeit } from "./der-schreiber.js";
import { liesText } from "./hilfen.js";

const subtle = globalThis.crypto.subtle;

export interface Paar {
  art: "ec256" | "ec384" | "rsa";
  privat: CryptoKey;
  spki: Uint8Array;
}

export async function schluessel(art: Paar["art"]): Promise<Paar> {
  const alg =
    art === "rsa"
      ? { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }
      : { name: "ECDSA", namedCurve: art === "ec256" ? "P-256" : "P-384" };
  const p = (await subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  return { art, privat: p.privateKey, spki: new Uint8Array(await subtle.exportKey("spki", p.publicKey)) };
}

/** Wandelt r‖s in eine DER-Signatur. */
export function derSignatur(roh: Uint8Array): Uint8Array {
  const h = roh.length / 2;
  return seq(intRoh(roh.subarray(0, h)), intRoh(roh.subarray(h)));
}

export async function signiere(p: Paar, daten: Uint8Array): Promise<Uint8Array> {
  if (p.art === "rsa") return new Uint8Array(await subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, p.privat, puffer(daten)));
  const roh = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: p.art === "ec256" ? "SHA-256" : "SHA-384" }, p.privat, puffer(daten)));
  return derSignatur(roh);
}

function algId(p: Paar): Uint8Array {
  if (p.art === "rsa") return seq(oid("1.2.840.113549.1.1.11"), nul());
  return seq(oid(p.art === "ec256" ? "1.2.840.10045.4.3.2" : "1.2.840.10045.4.3.3"));
}

export interface ZertAngaben {
  seriennummer: bigint;
  aussteller: Uint8Array;
  inhaber: Uint8Array;
  nichtVor: number;
  nichtNach: number;
  spki: Uint8Array;
  signierer: Paar;
  erweiterungen?: { oid: string; wert: Uint8Array }[];
}

export async function zertifikat(z: ZertAngaben): Promise<Uint8Array> {
  const ext = z.erweiterungen?.length ? [explizit(3, seq(...z.erweiterungen.map((e) => seq(oid(e.oid), oktette(e.wert)))))] : [];
  const tbs = seq(explizit(0, int(2)), int(z.seriennummer), algId(z.signierer), z.aussteller, seq(zeit(z.nichtVor), zeit(z.nichtNach)), z.inhaber, z.spki, ...ext);
  return seq(tbs, algId(z.signierer), bits(await signiere(z.signierer, tbs)));
}

export interface Bestaetigung {
  challenge: Uint8Array;
  sicherheitsstufe: number;
  paket: string;
  appDigest: Uint8Array;
  bootzustand: number;
  gesperrt: boolean;
  mitRootOfTrust: boolean;
  /** creationDateTime (Tag 701) in Millisekunden seit 1970; null lässt das Feld weg. */
  erzeugtAm: number | null;
}

/** KeyDescription nach ATTESTIERUNG.md (Erweiterung 1.3.6.1.4.1.11129.2.1.17). */
export function schluesselbeschreibung(b: Bestaetigung): Uint8Array {
  const appId = seq(set(seq(oktette(utf8(b.paket)), int(1234))), set(oktette(b.appDigest)));
  const sw = seq(...(b.erzeugtAm === null ? [] : [explizit(701, int(b.erzeugtAm))]), explizit(709, oktette(appId)));
  const hwTeile = [explizit(1, set(int(2))), explizit(705, int(150000)), explizit(706, int(202610))];
  if (b.mitRootOfTrust) hwTeile.splice(1, 0, explizit(704, seq(oktette(new Uint8Array(32).fill(7)), bool(b.gesperrt), enumWert(b.bootzustand), oktette(new Uint8Array(32).fill(9)))));
  const hw = seq(...hwTeile);
  return seq(int(300), enumWert(b.sicherheitsstufe), int(300), enumWert(b.sicherheitsstufe), oktette(b.challenge), oktette(new Uint8Array()), sw, hw);
}

export interface Testzertifikate {
  wurzel: Paar;
  wurzelDer: Uint8Array;
  zwischen: Paar;
  zwischenDer: Uint8Array;
  zwischenSeriennummer: bigint;
}

const WURZEL_NAME = name("WATTest Test-Wurzel");
const ZWISCHEN_NAME = name("WATTest Test-Zwischenzertifikat");

export async function testzertifikate(art: Paar["art"] = "ec384"): Promise<Testzertifikate> {
  const wurzel = await schluessel(art);
  const wurzelDer = await zertifikat({ seriennummer: 0x5a17n, aussteller: WURZEL_NAME, inhaber: WURZEL_NAME, nichtVor: Date.parse("2025-07-17T00:00:00Z"), nichtNach: Date.parse("2035-07-15T00:00:00Z"), spki: wurzel.spki, signierer: wurzel });
  const zwischen = await schluessel("ec256");
  const zwischenSeriennummer = 0x1c12256c52e2e0dbn;
  const zwischenDer = await zertifikat({ seriennummer: zwischenSeriennummer, aussteller: WURZEL_NAME, inhaber: ZWISCHEN_NAME, nichtVor: Date.parse("2026-10-01T00:00:00Z"), nichtNach: Date.parse("2026-12-31T00:00:00Z"), spki: zwischen.spki, signierer: wurzel });
  return { wurzel, wurzelDer, zwischen, zwischenDer, zwischenSeriennummer };
}

// Eigene Berechnung der Prüfsumme nach 4.2, unabhängig vom Kern.
function L(w: unknown): string {
  const t = w === null || w === undefined ? "" : String(w);
  return `${utf8(t).length}:${t}`;
}

export async function gliedHash(g: Record<string, unknown>): Promise<string> {
  let s = L(g["seq"]) + L(g["zeitpunkt"]) + L(g["aktion"]) + L(g["objektArt"]) + L(g["objektId"]) + L(g["daten"]) + L(g["prev"]);
  if ("neustarts" in g || "autoZeit" in g) s += ("neustarts" in g ? L(g["neustarts"]) : "") + ("autoZeit" in g ? L(g["autoZeit"]) : "");
  return hex(new Uint8Array(await subtle.digest("SHA-256", puffer(utf8(s)))));
}

/** Rechnet prev und hash aller Glieder neu (für manipulierte, aber in sich stimmige Ketten). */
export async function neuVerketten(protokoll: Record<string, unknown>[]): Promise<void> {
  let prev = "0";
  for (const g of protokoll) {
    g["prev"] = prev;
    g["hash"] = await gliedHash(g);
    prev = g["hash"] as string;
  }
}

export interface KettenAngaben {
  eintraege: number;
  /** Zertifikate; ohne: Kette ohne Schlüssel */
  zertifikate?: Testzertifikate | null;
  bestaetigung?: Partial<Bestaetigung>;
  /** jedes wievielte Glied signiert wird (1 = jedes) */
  signiereJedes?: number;
  /** die letzten n Glieder bleiben unsigniert */
  ohneSignaturAmEnde?: number;
  beginn?: number;
  /** Anzahl der Einträge vor dem Glied schluessel; 0 (Vorgabe): leere Kette, Schlüssel ist Glied 1 mit Zufalls-Challenge */
  schluesselNach?: number;
  /** zwischen dem Kopf und dem Glied schluessel ein Glied uhr_verstellt mit objektId glied (4.7) */
  verstelltVorSchluessel?: boolean;
  /**
   * vor dem Eintrag mit Index vorEintrag springt die Uhr um 10 Minuten zurück, vermerkt mit uhr_ruecksprung (4.7):
   * bei anlass glied nach dem auslösenden Eintrag (objektId dessen seq, neustarts des Eintrags wie angegeben,
   * Vermerk 0), sonst als eigenes Glied mit objektId anlass und den angegebenen neustarts. Bei vorEintrag gleich
   * schluesselNach steht ein solcher Vermerk vor dem Glied schluessel; bei 0 ist er das erste Glied der Kette.
   */
  ruecksprung?: { anlass: "glied" | "timer" | "nachweis" | "start" | "zeitsignal"; vorEintrag: number; neustarts: number };
}

function ausHexTest(h: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));
}

export const APP_DIGEST = new Uint8Array(32).map((_, i) => i * 7 + 3);
export const APP_DIGEST_HEX = hex(APP_DIGEST);

/** Kleinster Datenbestand der Version 19 aus Rechenbeispiel B3 der Technischen Erläuterung. */
function grundbestand(): Record<string, unknown> {
  const v = JSON.parse(liesText("tests/vektoren/technische-erlaeuterung.json")).vektoren.find((x: { id: string }) => x.id === "B3");
  return JSON.parse(v.eingabe);
}

export interface Erzeugt {
  daten: Record<string, unknown> & { protokoll: Record<string, unknown>[]; kettensignaturen: Record<string, unknown>[]; kettenschluessel: Record<string, unknown>[]; eintraege: Record<string, unknown>[] };
  blatt: Paar | null;
  zertifikate: Testzertifikate | null;
}

export async function erzeugeKette(a: KettenAngaben): Promise<Erzeugt> {
  const d = grundbestand() as Erzeugt["daten"];
  d["exportiertAm"] = "2026-10-25T09:00:00Z";
  d["appVersion"] = "0.9.0";
  const t0 = a.beginn ?? Date.parse("2026-10-24T08:00:00Z");
  const protokoll: Record<string, unknown>[] = [];
  const iso = (ms: number): string => new Date(ms).toISOString().replace(".000Z", "Z");
  let blatt: Paar | null = null;
  const z = a.zertifikate ?? null;
  let kettenschluessel: Record<string, unknown>[] = [];
  const eintraege: Record<string, unknown>[] = [];
  let versatz = 0;
  const r = a.ruecksprung;
  let vermerkt = false;
  const ruecksprungGlied = (objektId: string, zeitpunkt: number, neustarts: number): void => {
    const voriges = protokoll[protokoll.length - 1];
    const vorher = voriges ? String(voriges["zeitpunkt"]) : iso(t0);
    protokoll.push({ seq: protokoll.length + 1, zeitpunkt: iso(zeitpunkt), aktion: "ANGELEGT", objektArt: "uhr_ruecksprung", objektId, daten: JSON.stringify({ vorher, nachher: iso(zeitpunkt) }), neustarts, autoZeit: true });
  };
  // Vermerk ohne eigenes auslösendes Glied: 30 Sekunden vor dem nächsten Eintrag nach der zurückgestellten Uhr.
  const vermerk = (i: number): void => {
    if (!r || vermerkt || r.anlass === "glied" || i !== r.vorEintrag) return;
    vermerkt = true;
    versatz -= 600000;
    ruecksprungGlied(r.anlass, t0 + i * 60000 + 30000 + versatz, r.neustarts);
  };
  const eintrag = (i: number): void => {
    vermerk(i);
    const ausloeser = r?.anlass === "glied" && i === r.vorEintrag;
    if (ausloeser) versatz -= 600000;
    const t = t0 + (i + 1) * 60000 + versatz;
    const tag = iso(t).slice(0, 10);
    const e = {
      tag,
      kategorieId: "korrektur",
      unterkategorieId: null,
      beginn: iso(t - 45 * 60000),
      ende: iso(t - 60000),
      dauerMinuten: 0,
      notiz: `Korrektur ${i + 1} – Schulaufgabe ä`,
      quelle: "MANUELL",
      planRef: null,
      erfasstAm: iso(t),
      geaendertAm: null,
    };
    protokoll.push({
      seq: protokoll.length + 1,
      zeitpunkt: iso(t),
      aktion: "ANGELEGT",
      objektArt: "eintrag",
      objektId: `e${i + 1}`,
      daten: JSON.stringify({ ...e, begruendung: null, kategorie: "Korrektur und Bewertung", unterkategorie: null }),
      neustarts: ausloeser ? r.neustarts : i === 0 ? 0 : i % 1000 === 0 ? 1 : 0,
      autoZeit: true,
    });
    if (ausloeser) ruecksprungGlied(String(protokoll.length), t, 0);
    eintraege.push({ id: `e${i + 1}`, ...e, fach: "", klasse: "", plausibilitaetBestaetigt: false, importiertAm: null });
  };
  const vorSchluessel = z ? Math.min(a.schluesselNach ?? 0, a.eintraege) : 0;
  for (let i = 0; i < vorSchluessel; i++) eintrag(i);
  if (z) vermerk(vorSchluessel);
  if (z) {
    blatt = await schluessel("ec256");
    // Challenge (4.7): leere Kette 32 Zufallsbytes im Glied, sonst der hash des Kopfs; ein Glied uhr_verstellt
    // mit objektId glied dazwischen ändert daran nichts.
    let challenge: Uint8Array<ArrayBuffer> = new Uint8Array(32).map((_, i) => (i * 31 + 5) & 0xff);
    let zeitSchluessel = t0;
    const leer = protokoll.length === 0;
    if (!leer) {
      await neuVerketten(protokoll);
      const kopf = protokoll[protokoll.length - 1]!;
      challenge = ausHexTest(String(kopf["hash"]));
      zeitSchluessel = Date.parse(String(kopf["zeitpunkt"])) + 30000;
      if (a.verstelltVorSchluessel) {
        const vorher = zeitSchluessel;
        const nachher = vorher + 600000;
        protokoll.push({
          seq: protokoll.length + 1,
          zeitpunkt: iso(nachher),
          aktion: "ANGELEGT",
          objektArt: "uhr_verstellt",
          objektId: "glied",
          daten: JSON.stringify({ vorher: iso(vorher), nachher: iso(nachher), abweichungSekunden: 600, richtung: "vor" }),
          neustarts: 0,
          autoZeit: true,
        });
        zeitSchluessel = nachher;
        versatz += 600000;
      }
    }
    const b: Bestaetigung = { challenge, sicherheitsstufe: 1, paket: "de.achim.watt", appDigest: APP_DIGEST, bootzustand: 0, gesperrt: true, mitRootOfTrust: true, erzeugtAm: zeitSchluessel, ...a.bestaetigung };
    const blattDer = await zertifikat({
      seriennummer: 1n,
      aussteller: ZWISCHEN_NAME,
      inhaber: name("Android Keystore Key", "Android"),
      // Standardgrenzen von Android, WATT setzt keine eigenen (4.7, Schritt 1).
      nichtVor: Date.parse("1970-01-01T00:00:00Z"),
      nichtNach: Date.parse("2048-01-01T00:00:00Z"),
      spki: blatt.spki,
      signierer: z.zwischen,
      erweiterungen: [{ oid: "1.3.6.1.4.1.11129.2.1.17", wert: schluesselbeschreibung(b) }],
    });
    const der = [blattDer, z.zwischenDer, z.wurzelDer];
    const fp = hex(new Uint8Array(await subtle.digest("SHA-256", puffer(blatt.spki))));
    const zs = hex(new Uint8Array(await subtle.digest("SHA-256", puffer(verbinde(der)))));
    kettenschluessel = [{ fingerabdruck: fp, zertifikate: der.map(base64) }];
    const angaben: Record<string, unknown> = { status: "verfuegbar", fingerabdruck: fp, zertifikateSha256: zs, sicherheitsstufe: b.sicherheitsstufe === 2 ? "STRONGBOX" : b.sicherheitsstufe === 1 ? "TEE" : "SOFTWARE" };
    if (leer) angaben["challenge"] = hex(challenge);
    protokoll.push({
      seq: protokoll.length + 1,
      zeitpunkt: iso(zeitSchluessel),
      aktion: "ANGELEGT",
      objektArt: "schluessel",
      objektId: fp,
      daten: JSON.stringify(angaben),
      neustarts: 0,
      autoZeit: true,
    });
  }
  for (let i = vorSchluessel; i < a.eintraege; i++) eintrag(i);
  await neuVerketten(protokoll);
  const signaturen: Record<string, unknown>[] = [];
  if (blatt && kettenschluessel.length) {
    const jedes = a.signiereJedes ?? 1;
    const bis = protokoll.length - (a.ohneSignaturAmEnde ?? 0);
    const ab = protokoll.findIndex((x) => x["objektArt"] === "schluessel");
    for (let i = ab; i < bis; i++) {
      if ((i + 1) % jedes !== 0 && i !== bis - 1) continue;
      const g = protokoll[i]!;
      const sig = await signiere(blatt, utf8(`watt-kopf-1:${g["hash"]}`));
      signaturen.push({ seq: g["seq"], fingerabdruck: kettenschluessel[0]!["fingerabdruck"], signatur: base64(sig) });
    }
  }
  d["eintraege"] = eintraege;
  d["protokoll"] = protokoll;
  d["kettenschluessel"] = kettenschluessel;
  d["kettensignaturen"] = signaturen;
  return { daten: d, blatt, zertifikate: z };
}

export async function signiereNeu(e: Erzeugt): Promise<void> {
  if (!e.blatt) return;
  for (const s of e.daten.kettensignaturen) {
    const g = e.daten.protokoll.find((x) => x["seq"] === s["seq"])!;
    s["signatur"] = base64(await signiere(e.blatt, utf8(`watt-kopf-1:${g["hash"]}`)));
  }
}
