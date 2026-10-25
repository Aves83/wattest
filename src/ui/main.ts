// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Seite: Dateien und Anker aufnehmen, die Prüfung im Worker starten, den Befund zeigen und drucken.

import { ankerName, leseAnkerText, leseHand, type Anker } from "../kern/anker.js";
import { SCHRITTNAMEN, SYMBOL, type Aussage, type Befund, type Schritt, type Zeichen } from "../kern/befund.js";
import { GRENZWERTE } from "../kern/grenzen.js";
import { deutsch } from "../kern/zeit.js";
import { auftragAusfuehren, fehlerBefund, type Auftrag, type Daten, type Meldung } from "../worker/auftrag.js";

declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __APP_SIGNATUR__: { paketname: string; sha256: string };
declare const __WORKER_CODE__: string;
declare const __EINZELDATEI__: boolean;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

interface Geladen {
  name: string;
  groesse: number;
  bytes: Uint8Array;
}

const zustand = { dateien: [] as Geladen[], anker: [] as Anker[], laeuft: false };

const ZEICHEN_NAME: Record<Zeichen, string> = { bestaetigt: "bestätigt", offen: "nicht bestätigbar", widerlegt: "widerlegt", hinweis: "Hinweis" };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attr: Record<string, string> = {}, ...kinder: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of kinder) if (c !== null && c !== undefined) e.append(c);
  return e;
}

function groesse(n: number): string {
  if (n < 1024) return `${n} Bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function aktualisiereKnopf(): void {
  $<HTMLButtonElement>("pruefen").disabled = zustand.laeuft || zustand.dateien.length === 0;
}

function zeigeDateien(): void {
  const ul = $("dateiliste");
  ul.replaceChildren(
    ...zustand.dateien.map((d, i) => {
      const weg = el("button", { type: "button", class: "knopf zweit klein", "aria-label": `${d.name} entfernen` }, "Entfernen");
      weg.addEventListener("click", () => {
        zustand.dateien.splice(i, 1);
        zeigeDateien();
      });
      return el("li", {}, el("span", {}, `${d.name} (${groesse(d.groesse)})`), weg);
    }),
  );
  aktualisiereKnopf();
}

async function nimmDateien(liste: FileList | File[]): Promise<void> {
  const nichtLesbar: string[] = [];
  for (const f of Array.from(liste)) {
    // Dateien über der Grenze liest die Seite nicht ein; der Befund nennt sie mit „?“ und der Grenze.
    if (f.size > GRENZWERTE.dateiBytes) {
      zustand.dateien.push({ name: f.name, groesse: f.size, bytes: new Uint8Array(0) });
      continue;
    }
    try {
      zustand.dateien.push({ name: f.name, groesse: f.size, bytes: new Uint8Array(await f.arrayBuffer()) });
    } catch {
      nichtLesbar.push(f.name);
    }
  }
  zeigeDateien();
  $("fortschritt-text").textContent =
    `${zustand.dateien.length} ${zustand.dateien.length === 1 ? "Datei" : "Dateien"} ausgewählt.` +
    (nichtLesbar.length ? ` Nicht lesbar: ${nichtLesbar.map((n) => `„${n}“`).join(", ")}.` : "");
}

function zeigeAnker(): void {
  const ul = $("ankerliste");
  ul.replaceChildren(
    ...zustand.anker.map((a, i) => {
      const weg = el("button", { type: "button", class: "knopf zweit klein", "aria-label": `Anker vom ${ankerName(a)} entfernen` }, "Entfernen");
      weg.addEventListener("click", () => {
        zustand.anker.splice(i, 1);
        zeigeAnker();
      });
      const quelle = a.quelle === "qr" ? "QR-Code" : a.quelle === "vermerk" ? "Prüfvermerk" : "von Hand";
      return el("li", {}, el("span", {}, `Anker vom ${ankerName(a)}, Glied ${a.n}, `, el("span", { class: "hash" }, a.sha256.slice(0, 16) + "…"), ` (${quelle})`), weg);
    }),
  );
}

function setzeFehler(feld: string, text: string): void {
  const f = $(`${feld}-fehler`);
  f.textContent = text;
  const eingabe = $(feld);
  if (text) eingabe.setAttribute("aria-invalid", "true");
  else eingabe.removeAttribute("aria-invalid");
}

function ankerAusText(): void {
  const t = $<HTMLTextAreaElement>("ankertext");
  if (!t.value.trim()) {
    setzeFehler("ankertext", "Bitte den Inhalt eines QR-Codes oder den Prüfvermerk einfügen.");
    return;
  }
  const r = leseAnkerText(t.value);
  if (!r.ok) {
    setzeFehler("ankertext", r.fehler);
    t.focus();
    return;
  }
  setzeFehler("ankertext", "");
  zustand.anker.push(r.anker);
  t.value = "";
  zeigeAnker();
  $("fortschritt-text").textContent = `Anker vom ${ankerName(r.anker)} hinzugefügt.`;
}

function ankerVonHand(): void {
  const felder = { anzahl: "hand-anzahl", stand: "hand-stand", pruefsumme: "hand-pruefsumme" } as const;
  const r = leseHand({
    anzahl: $<HTMLInputElement>(felder.anzahl).value,
    stand: $<HTMLInputElement>(felder.stand).value,
    pruefsumme: $<HTMLInputElement>(felder.pruefsumme).value,
  });
  for (const [k, id] of Object.entries(felder)) setzeFehler(id, r.ok ? "" : (r.fehler[k as keyof typeof felder] ?? ""));
  if (!r.ok) {
    const erster = Object.keys(r.fehler)[0] as keyof typeof felder;
    $(felder[erster]).focus();
    return;
  }
  zustand.anker.push(r.anker);
  for (const id of Object.values(felder)) $<HTMLInputElement>(id).value = "";
  zeigeAnker();
  $("fortschritt-text").textContent = `Anker vom ${ankerName(r.anker)} hinzugefügt.`;
}

// Kamera: nur, wo der Browser BarcodeDetector anbietet.
interface Detektor {
  detect(quelle: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
let strom: MediaStream | null = null;

function scannenEnde(): void {
  strom?.getTracks().forEach((t) => t.stop());
  strom = null;
  $("kamera").hidden = true;
  $("scannen").hidden = false;
}

async function scannen(): Promise<void> {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detektor }).BarcodeDetector;
  if (!BD) return;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch {
    setzeFehler("ankertext", "Die Kamera ließ sich nicht öffnen. Der Inhalt des QR-Codes lässt sich auch einfügen.");
    return;
  }
  const video = $<HTMLVideoElement>("video");
  video.srcObject = strom;
  $("kamera").hidden = false;
  $("scannen").hidden = true;
  await video.play();
  const d = new BD({ formats: ["qr_code"] });
  const runde = async (): Promise<void> => {
    if (!strom) return;
    try {
      const treffer = (await d.detect(video)).find((c) => c.rawValue.startsWith("watt-pruef:"));
      if (treffer) {
        $<HTMLTextAreaElement>("ankertext").value = treffer.rawValue;
        scannenEnde();
        ankerAusText();
        return;
      }
    } catch {
      /* nächstes Bild */
    }
    setTimeout(() => void runde(), 250);
  };
  void runde();
}

async function ladeDaten(): Promise<Daten> {
  const eingebettet = document.getElementById("wattest-daten");
  if (eingebettet) return JSON.parse(eingebettet.textContent ?? "{}") as Daten;
  const hole = async <T>(pfad: string): Promise<T | null> => {
    try {
      const r = await fetch(pfad, { cache: "no-cache" });
      return r.ok ? ((await r.json()) as T) : null;
    } catch {
      return null;
    }
  };
  const [wurzeln, sperrliste] = await Promise.all([hole<Daten["wurzeln"]>("daten/wurzeln.json"), hole<Daten["sperrliste"]>("daten/sperrliste.json")]);
  return { wurzeln, sperrliste, appSignatur: __APP_SIGNATUR__ };
}

function fortschritt(anteil: number, text: string): void {
  $<HTMLProgressElement>("balken").value = anteil;
  $("fortschritt-text").textContent = `${text} (${Math.round(anteil * 100)} %)`;
}

async function pruefen(): Promise<void> {
  if (zustand.laeuft || !zustand.dateien.length) return;
  zustand.laeuft = true;
  aktualisiereKnopf();
  $("fortschritt").hidden = false;
  fortschritt(0, "Prüfung beginnt");
  const abbrechen = $<HTMLButtonElement>("abbrechen");
  abbrechen.hidden = false;
  const auftrag: Auftrag = {
    dateien: zustand.dateien.map((d) => ({ name: d.name, bytes: d.bytes, groesse: d.groesse })),
    anker: zustand.anker,
    daten: await ladeDaten(),
    jetzt: Date.now(),
    version: __VERSION__,
    commit: __COMMIT__,
  };
  let abgebrochen = false;
  let beendet = false;
  let worker: Worker | null = null;
  const fertig = (m: Meldung): void => {
    if (beendet) return;
    if (m.art === "fortschritt") {
      fortschritt(m.anteil, m.text);
      return;
    }
    beendet = true;
    zustand.laeuft = false;
    aktualisiereKnopf();
    $("fortschritt").hidden = true;
    abbrechen.hidden = true;
    abbrechen.onclick = null;
    if (m.art === "abgebrochen") {
      $("fortschritt-text").textContent = "Prüfung abgebrochen.";
      $("pruefen").focus();
      return;
    }
    zeigeBefund(m.befund);
    $("fortschritt-text").textContent = `Prüfung abgeschlossen: ${ZEICHEN_NAME[m.befund.gesamt]}.`;
  };
  // Abbrechen beendet den Worker sofort; ohne Worker prüft die Prüfung selbst zwischen den Teilschritten.
  abbrechen.onclick = (): void => {
    abgebrochen = true;
    worker?.terminate();
    fertig({ art: "abgebrochen" });
  };
  try {
    const url = URL.createObjectURL(new Blob([__WORKER_CODE__], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch {
    worker = null;
  }
  if (worker) {
    const w = worker;
    let gestartet = false;
    w.onmessage = (e: MessageEvent<Meldung>) => {
      gestartet = true;
      fertig(e.data);
      if (e.data.art !== "fortschritt") w.terminate();
    };
    w.onerror = (e: ErrorEvent) => {
      w.terminate();
      if (abgebrochen || beendet) return;
      // Startet der Worker nicht, läuft die Prüfung auf der Seite; bricht er mitten in der Prüfung ab, ein „?“.
      if (!gestartet) {
        worker = null;
        void auftragAusfuehren(auftrag, fertig, () => abgebrochen);
      } else fertig({ art: "ergebnis", befund: fehlerBefund(auftrag, e.message || "Die Prüfung im Hintergrund brach ab.") });
    };
    w.postMessage(auftrag);
  } else {
    await auftragAusfuehren(auftrag, fertig, () => abgebrochen);
  }
}

function zeichenEl(z: Zeichen): HTMLElement {
  return el("span", { class: `zeichen z-${z}`, role: "img", "aria-label": ZEICHEN_NAME[z] }, SYMBOL[z]);
}

function aussageEl(a: Aussage): HTMLElement {
  const dl = el("dl");
  const zeile = (titel: string, inhalt: Node | string): void => {
    dl.append(el("dt", {}, titel), el("dd", {}, inhalt));
  };
  zeile("Begründung", a.begruendung);
  if (a.fundstelle) zeile("Fundstelle", a.fundstelle);
  if (a.details?.length) {
    const ul = el("ul");
    for (const d of a.details) ul.append(el("li", {}, d.text, d.inhalt ? el("span", { class: "inhalt" }, ` – ${d.inhalt}`) : null));
    zeile("Einzelheiten", ul);
  }
  if (a.grenze) zeile("Grenze", a.grenze);
  const summary = el("summary", {}, zeichenEl(a.zeichen), el("span", { class: "aussage-text" }, el("span", { class: "unsichtbar" }, `${ZEICHEN_NAME[a.zeichen]}: `), a.text));
  return el("details", { class: "aussage" }, summary, el("div", { class: "erlaeuterung" }, dl));
}

function druckkopf(b: Befund): HTMLElement {
  const zeilen: [string, string][] = [
    ["Prüfdatum", deutsch(Date.parse(b.geprueftAm))],
    ["WATTest", `${b.wattestVersion} (Commit ${b.commit})`],
    ...b.dateien.map((d): [string, string] => [`Datei „${d.name}“`, `${d.art}, ${groesse(d.groesse)}, ${d.sha256 ? `SHA-256 ${d.sha256}` : "SHA-256 nicht berechnet"}`]),
    ["Sperrliste", b.sperrliste ? `${b.sperrliste.anzahl} Einträge, Stand ${b.sperrliste.abgerufen ? deutsch(Date.parse(b.sperrliste.abgerufen)) : "unbekannt"}` : "nicht verfügbar"],
    ["Wurzeln", b.wurzeln ? `${b.wurzeln.anzahl} Wurzelzertifikate von Google, Stand ${b.wurzeln.abgerufen ? deutsch(Date.parse(b.wurzeln.abgerufen)) : "unbekannt"}` : "nicht verfügbar"],
  ];
  return el("table", {}, el("tbody", {}, ...zeilen.map(([k, v]) => el("tr", {}, el("th", { scope: "row" }, k), el("td", { class: k.startsWith("Datei") ? "hash" : "" }, v)))));
}

function zeigeBefund(b: Befund): void {
  $("druckkopf").replaceChildren(druckkopf(b));
  $("gesamt").replaceChildren(zeichenEl(b.gesamt), el("span", {}, `Gesamt: ${b.gesamtText}`));
  const wurzel = $("aussagen");
  wurzel.replaceChildren();
  const gruppen = new Map<string, Aussage[]>();
  for (const a of b.aussagen) {
    const g = a.schritt === "E" ? "" : (a.datei ?? "");
    gruppen.set(g, [...(gruppen.get(g) ?? []), a]);
  }
  for (const [datei, liste] of gruppen) {
    if (datei) wurzel.append(el("h3", { class: "datei-titel" }, `Datei „${datei}“`));
    const nachSchritt = new Map<Schritt, Aussage[]>();
    for (const a of liste) nachSchritt.set(a.schritt, [...(nachSchritt.get(a.schritt) ?? []), a]);
    for (const [s, aus] of nachSchritt) {
      const titel = s === "E" ? SCHRITTNAMEN.E : `${s} · ${SCHRITTNAMEN[s]}`;
      wurzel.append(el("div", { class: "schritt" }, el("h4", { class: "schritt-titel" }, titel), el("ul", { class: "aussagen" }, ...aus.map((a) => el("li", {}, aussageEl(a))))));
    }
  }
  const sektion = $("befund");
  sektion.hidden = false;
  $("h-befund").focus();
}

function alleAufklappen(offen: boolean): void {
  document.querySelectorAll<HTMLDetailsElement>("details.aussage").forEach((d) => (d.open = offen));
}

function start(): void {
  $<HTMLInputElement>("datei").addEventListener("change", (e) => {
    const f = (e.target as HTMLInputElement).files;
    if (f) void nimmDateien(f).then(() => ((e.target as HTMLInputElement).value = ""));
  });
  const ablage = $("ablage");
  const ueber = (an: boolean) => (e: DragEvent): void => {
    e.preventDefault();
    ablage.classList.toggle("ueber", an);
  };
  document.addEventListener("dragover", ueber(true));
  document.addEventListener("dragleave", ueber(false));
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    ablage.classList.remove("ueber");
    if (e.dataTransfer?.files.length) void nimmDateien(e.dataTransfer.files);
  });
  $("ankertext-ok").addEventListener("click", ankerAusText);
  $("hand-ok").addEventListener("click", ankerVonHand);
  for (const id of ["hand-anzahl", "hand-stand", "hand-pruefsumme"]) {
    $(id).addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") ankerVonHand();
    });
  }
  $("pruefen").addEventListener("click", () => void pruefen());
  $("drucken").addEventListener("click", () => window.print());
  let gedruckt: boolean[] = [];
  window.addEventListener("beforeprint", () => {
    gedruckt = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.aussage")).map((d) => d.open);
    alleAufklappen(true);
  });
  window.addEventListener("afterprint", () => {
    document.querySelectorAll<HTMLDetailsElement>("details.aussage").forEach((d, i) => (d.open = gedruckt[i] ?? false));
  });
  let offen = false;
  $("aufklappen").addEventListener("click", () => {
    offen = !offen;
    alleAufklappen(offen);
    $("aufklappen").textContent = offen ? "Alle Begründungen schließen" : "Alle Begründungen zeigen";
  });
  if ("BarcodeDetector" in globalThis && "mediaDevices" in navigator) {
    $("scannen").hidden = false;
    $("scannen").addEventListener("click", () => void scannen());
    $("scannen-ende").addEventListener("click", scannenEnde);
  }
  if (!__EINZELDATEI__ && "serviceWorker" in navigator && location.protocol === "https:") {
    void navigator.serviceWorker.register("sw.js").catch(() => undefined);
  }
  aktualisiereKnopf();
}

start();
