// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Schreibt ein JSON von watt-daten als XML nach der Abbildung im Datenformat (Abschnitt „XML-Darstellung“).
// Nur für die Tests; die Namen im Singular stammen aus dem Datenformat, nicht aus der XSD.

const SINGULAR: Record<string, string> = {
  kategorien: "kategorie",
  unterkategorien: "unterkategorie",
  ferien: "ferienabschnitt",
  sonderTage: "sonderTag",
  eintraege: "eintrag",
  abwesenheiten: "abwesenheit",
  protokoll: "glied",
  funktionen: "funktion",
  kalenderZuordnungen: "kalenderZuordnung",
  kalenderEntscheidungen: "kalenderEntscheidung",
  beschaeftigung: "abschnitt",
  regionaleFeiertage: "feiertag",
  gdbAenderungen: "gdbAenderung",
  unterrichtVd: "abschnitt",
  deputatAusgleiche: "deputatAusgleich",
  anzeigen: "anzeige",
  gespraeche: "gespraech",
  kette: "glied",
  kopien: "kopie",
  dokumente: "dokument",
  notizen: "notiz",
  nachtraege: "nachtrag",
  raster: "stunde",
  bloecke: "block",
  zeitraeume: "zeitraum",
  ausgesetzteTage: "tag",
  verworfen: "verwerfung",
  unterkategorienEingeblendet: "kategorieId",
  schlagworteEingeblendet: "art",
  kettenschluessel: "schluessel",
  zertifikate: "zertifikat",
  kettensignaturen: "signatur",
  anhaenge: "anhang",
};

function maske(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\r/g, "&#13;");
}

function element(name: string, wert: unknown, einzug: string): string {
  if (wert === null) return `${einzug}<${name} xsi:nil="true"/>\n`;
  if (Array.isArray(wert)) {
    if (!wert.length) return `${einzug}<${name}/>\n`;
    const kind = SINGULAR[name];
    if (!kind) throw new Error(`Kein Singular für ${name}`);
    return `${einzug}<${name}>\n${wert.map((w) => element(kind, w, einzug + "  ")).join("")}${einzug}</${name}>\n`;
  }
  if (typeof wert === "object") {
    if (name === "antworten") {
      const e = Object.entries(wert as Record<string, unknown>);
      if (!e.length) return `${einzug}<${name}/>\n`;
      return `${einzug}<${name}>\n${e.map(([k, v]) => `${einzug}  <antwort schluessel="${maske(k)}">${String(v)}</antwort>\n`).join("")}${einzug}</${name}>\n`;
    }
    const e = Object.entries(wert as Record<string, unknown>);
    return `${einzug}<${name}>\n${e.map(([k, v]) => element(k, v, einzug + "  ")).join("")}${einzug}</${name}>\n`;
  }
  return `${einzug}<${name}>${maske(String(wert))}</${name}>\n`;
}

export function alsXml(daten: Record<string, unknown>): string {
  const innen = Object.entries(daten)
    .map(([k, v]) => element(k, v, "  "))
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<wattDaten xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${innen}</wattDaten>\n`;
}
