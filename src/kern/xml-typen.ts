// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Erzeugt von scripts/xml-typen.mjs aus den XSDs 18 und 19 von WATT (Aves83/watt_public, schema/,
// CC BY 4.0, Hans-Joachim Steudel). Nicht von Hand ändern.

export type XmlTyp = { liste: string; von: string } | { felder: Record<string, string> };

export const XML_TYPEN: Record<string, XmlTyp> = {
  "WattDaten": {
    "felder": {
      "format": "text",
      "version": "zahl",
      "exportiertAm": "text",
      "appVersion": "text",
      "umfang": "text",
      "profil": "Profil",
      "kategorien": "Kategorien",
      "ferien": "Ferien",
      "sonderTage": "SonderTage",
      "stundenplan": "Stundenplan",
      "eintraege": "Eintraege",
      "abwesenheiten": "Abwesenheiten",
      "protokoll": "Protokoll",
      "laufenderTimer": "Timer",
      "einstellungen": "Einstellungen",
      "nachweise": "Nachweise",
      "funktionen": "Funktionen",
      "kalenderlink": "text",
      "kalenderZuordnungen": "KalenderZuordnungen",
      "kalenderEntscheidungen": "KalenderEntscheidungen",
      "kettenschluessel": "Kettenschluesselliste",
      "kettensignaturen": "Kettensignaturen"
    }
  },
  "Profil": {
    "felder": {
      "beschaeftigung": "Beschaeftigung",
      "regionaleFeiertage": "RegionaleFeiertage",
      "bundesland": "text",
      "schulart": "text",
      "unterart": "text",
      "amt": "text",
      "amtsform": "text",
      "amtBezeichnung": "text",
      "funktionenBestaetigt": "bool",
      "vorbereitungsdienstBeginn": "text",
      "vorbereitungsdienstEnde": "text",
      "geburtHalbjahr": "text",
      "geburtMonat": "text",
      "geburtTag": "text",
      "gdbAnfang": "text",
      "gdbAenderungen": "GdbAenderungen",
      "antworten": "Antworten",
      "unterrichtVd": "UnterrichtVd",
      "deputatStartwert": "zahl",
      "deputatAusgleiche": "DeputatAusgleiche"
    }
  },
  "Beschaeftigung": {
    "liste": "abschnitt",
    "von": "Beschaeftigungsabschnitt"
  },
  "Beschaeftigungsabschnitt": {
    "felder": {
      "ab": "text",
      "pflichtstunden": "zahl",
      "pflichtstundenMinuten": "zahl",
      "teilzeitStunden": "zahl",
      "altersteilzeit": "bool",
      "pflichtstundenAnderer": "bool"
    }
  },
  "RegionaleFeiertage": {
    "liste": "feiertag",
    "von": "text"
  },
  "GdbAenderungen": {
    "liste": "gdbAenderung",
    "von": "GdbAenderung"
  },
  "GdbAenderung": {
    "felder": {
      "seit": "text",
      "stufe": "text"
    }
  },
  "Antworten": {
    "felder": {}
  },
  "UnterrichtVd": {
    "liste": "abschnitt",
    "von": "UnterrichtVdAbschnitt"
  },
  "UnterrichtVdAbschnitt": {
    "felder": {
      "ab": "text",
      "stunden": "zahl"
    }
  },
  "DeputatAusgleiche": {
    "liste": "deputatAusgleich",
    "von": "DeputatAusgleich"
  },
  "DeputatAusgleich": {
    "felder": {
      "id": "text",
      "tag": "text",
      "einzelstunden": "zahl",
      "notiz": "text"
    }
  },
  "Kategorien": {
    "liste": "kategorie",
    "von": "Kategorie"
  },
  "Kategorie": {
    "felder": {
      "id": "text",
      "name": "text",
      "farbe": "text",
      "hoechstdauerMinuten": "zahl",
      "aktiv": "bool",
      "unterkategorien": "Unterkategorien",
      "symbolKey": "text",
      "vorbild": "text"
    }
  },
  "Unterkategorien": {
    "liste": "unterkategorie",
    "von": "Unterkategorie"
  },
  "Unterkategorie": {
    "felder": {
      "id": "text",
      "name": "text",
      "aktiv": "bool",
      "vorbild": "text"
    }
  },
  "Ferien": {
    "liste": "ferienabschnitt",
    "von": "Ferienabschnitt"
  },
  "Ferienabschnitt": {
    "felder": {
      "id": "zahl",
      "art": "text",
      "von": "text",
      "bis": "text",
      "name": "text",
      "quelle": "text"
    }
  },
  "SonderTage": {
    "liste": "sonderTag",
    "von": "SonderTag"
  },
  "SonderTag": {
    "felder": {
      "tag": "text",
      "art": "text",
      "name": "text",
      "grund": "text"
    }
  },
  "Stundenplan": {
    "felder": {
      "aktiv": "bool",
      "abWochenAktiv": "bool",
      "zykluslaenge": "zahl",
      "abBezugstag": "text",
      "abFerienwochenUeberspringen": "bool",
      "uebernommenBis": "text",
      "raster": "Raster",
      "eintraege": "PlanEintraege",
      "bloecke": "Bloecke",
      "ausgesetzteTage": "AusgesetzteTage",
      "verworfen": "Verworfen",
      "quelle": "text"
    }
  },
  "Raster": {
    "liste": "stunde",
    "von": "Rasterstunde"
  },
  "Rasterstunde": {
    "felder": {
      "nummer": "zahl",
      "von": "text",
      "bis": "text"
    }
  },
  "PlanEintraege": {
    "liste": "eintrag",
    "von": "PlanEintrag"
  },
  "PlanEintrag": {
    "felder": {
      "id": "text",
      "typ": "text",
      "wochentag": "zahl",
      "tag": "text",
      "stundeVon": "zahl",
      "stundeBis": "zahl",
      "beginn": "text",
      "ende": "text",
      "woche": "text",
      "blockId": "text",
      "bezeichnung": "text",
      "kategorieId": "text",
      "unterkategorieId": "text",
      "gueltigAb": "text",
      "gueltigBis": "text",
      "deaktiviert": "bool",
      "fach": "text",
      "klasse": "text",
      "raum": "text",
      "ausKalenderlink": "bool"
    }
  },
  "Bloecke": {
    "liste": "block",
    "von": "Block"
  },
  "Block": {
    "felder": {
      "id": "text",
      "name": "text",
      "zeitraeume": "Zeitraeume"
    }
  },
  "Zeitraeume": {
    "liste": "zeitraum",
    "von": "Zeitraum"
  },
  "Zeitraum": {
    "felder": {
      "von": "text",
      "bis": "text"
    }
  },
  "AusgesetzteTage": {
    "liste": "tag",
    "von": "text"
  },
  "Verworfen": {
    "liste": "verwerfung",
    "von": "Verwerfung"
  },
  "Verwerfung": {
    "felder": {
      "planRef": "text",
      "begruendung": "text",
      "zeitpunkt": "text"
    }
  },
  "Eintraege": {
    "liste": "eintrag",
    "von": "Eintrag"
  },
  "Eintrag": {
    "felder": {
      "id": "text",
      "tag": "text",
      "kategorieId": "text",
      "unterkategorieId": "text",
      "beginn": "text",
      "ende": "text",
      "dauerMinuten": "zahl",
      "notiz": "text",
      "quelle": "text",
      "planRef": "text",
      "erfasstAm": "text",
      "geaendertAm": "text",
      "fach": "text",
      "klasse": "text",
      "plausibilitaetBestaetigt": "bool",
      "importiertAm": "text"
    }
  },
  "Abwesenheiten": {
    "liste": "abwesenheit",
    "von": "Abwesenheit"
  },
  "Abwesenheit": {
    "felder": {
      "tag": "text",
      "art": "text",
      "beginn": "text",
      "ende": "text",
      "importiertAm": "text"
    }
  },
  "Protokoll": {
    "liste": "glied",
    "von": "Glied"
  },
  "Glied": {
    "felder": {
      "seq": "zahl",
      "zeitpunkt": "text",
      "aktion": "text",
      "objektArt": "text",
      "objektId": "text",
      "daten": "text",
      "prev": "text",
      "hash": "text",
      "neustarts": "zahl",
      "autoZeit": "bool"
    }
  },
  "Timer": {
    "felder": {
      "kategorieId": "text",
      "unterkategorieId": "text",
      "beginn": "text"
    }
  },
  "Einstellungen": {
    "felder": {
      "unterkategorienEingeblendet": "KategorieIds",
      "schlagworteEingeblendet": "Schlagwortarten"
    }
  },
  "KategorieIds": {
    "liste": "kategorieId",
    "von": "text"
  },
  "Schlagwortarten": {
    "liste": "art",
    "von": "text"
  },
  "Funktionen": {
    "liste": "funktion",
    "von": "Funktion"
  },
  "Funktion": {
    "felder": {
      "id": "text",
      "art": "text",
      "gueltigAb": "text",
      "gueltigBis": "text",
      "anrechnungsstunden": "zahl",
      "anzahlKlassen": "zahl",
      "fach": "text",
      "bezeichnung": "text",
      "unterkategorieId": "text",
      "instanz": "text"
    }
  },
  "KalenderZuordnungen": {
    "liste": "kalenderZuordnung",
    "von": "KalenderZuordnung"
  },
  "KalenderZuordnung": {
    "felder": {
      "fach": "text",
      "kategorieId": "text",
      "unterkategorieId": "text",
      "nurVorschlag": "bool"
    }
  },
  "KalenderEntscheidungen": {
    "liste": "kalenderEntscheidung",
    "von": "KalenderEntscheidung"
  },
  "KalenderEntscheidung": {
    "felder": {
      "ref": "text",
      "stand": "text",
      "zeitpunkt": "text",
      "tag": "text",
      "von": "text",
      "bis": "text",
      "fach": "text",
      "raum": "text"
    }
  },
  "Nachweise": {
    "felder": {
      "meineDaten": "MeineDaten",
      "anzeigen": "Anzeigen",
      "gespraeche": "Gespraeche",
      "kette": "Nachweiskette"
    }
  },
  "MeineDaten": {
    "felder": {
      "name": "text",
      "schule": "text",
      "adressat": "text",
      "empfaengerEmail": "text",
      "kopien": "KopieEinstellungen"
    }
  },
  "KopieEinstellungen": {
    "liste": "kopie",
    "von": "KopieEinstellung"
  },
  "KopieEinstellung": {
    "felder": {
      "stelle": "text",
      "aktiv": "bool",
      "email": "text"
    }
  },
  "Anzeigen": {
    "liste": "anzeige",
    "von": "Anzeige"
  },
  "Anzeige": {
    "felder": {
      "id": "text",
      "erzeugtAm": "text",
      "stufe": "text",
      "zeitraumVon": "text",
      "zeitraumBis": "text",
      "angabenArt": "text",
      "angabenEntfernt": "bool",
      "empfaenger": "text",
      "kopien": "AnzeigeKopien",
      "betreff": "text",
      "anschreiben": "text",
      "datum": "text",
      "gesendetAn": "text",
      "gesendetAm": "text",
      "pruefsumme": "text",
      "wiedervorlageAm": "text",
      "wiedervorlageErledigt": "bool",
      "wiederhergestelltAm": "text",
      "backupVom": "text",
      "dokumente": "Dokumente",
      "notizen": "Notizen",
      "pruefverfahren": "zahl",
      "kettenkopf": "Kettenkopf",
      "anhaenge": "Anhaenge"
    }
  },
  "AnzeigeKopien": {
    "liste": "kopie",
    "von": "AnzeigeKopie"
  },
  "AnzeigeKopie": {
    "felder": {
      "stelle": "text",
      "email": "text"
    }
  },
  "Kettenkopf": {
    "felder": {
      "anzahl": "zahl",
      "hash": "text",
      "zeitpunkt": "text"
    }
  },
  "Dokumente": {
    "liste": "dokument",
    "von": "Dokument"
  },
  "Dokument": {
    "felder": {
      "art": "text",
      "dateiname": "text",
      "inhalt": "text"
    }
  },
  "Notizen": {
    "liste": "notiz",
    "von": "Notiz"
  },
  "Notiz": {
    "felder": {
      "id": "zahl",
      "text": "text",
      "erstelltAm": "text",
      "fest": "bool",
      "nachVersand": "bool"
    }
  },
  "Gespraeche": {
    "liste": "gespraech",
    "von": "Gespraech"
  },
  "Gespraech": {
    "felder": {
      "id": "text",
      "art": "text",
      "zeitpunkt": "text",
      "dauerMinuten": "zahl",
      "partner": "text",
      "anwesende": "text",
      "anlass": "text",
      "inhalt": "text",
      "zusagen": "text",
      "frist": "text",
      "erfasstAm": "text",
      "pruefsumme": "text",
      "wiedervorlageAm": "text",
      "wiedervorlageErledigt": "bool",
      "wiederhergestelltAm": "text",
      "backupVom": "text",
      "nachtraege": "Nachtraege"
    }
  },
  "Nachtraege": {
    "liste": "nachtrag",
    "von": "Nachtrag"
  },
  "Nachtrag": {
    "felder": {
      "id": "text",
      "text": "text",
      "erfasstAm": "text",
      "pruefsumme": "text"
    }
  },
  "Nachweiskette": {
    "liste": "glied",
    "von": "Nachweisglied"
  },
  "Nachweisglied": {
    "felder": {
      "seq": "zahl",
      "zeitpunkt": "text",
      "ereignis": "text",
      "referenzId": "text",
      "pruefsumme": "text",
      "prev": "text",
      "hash": "text"
    }
  },
  "Kettenschluesselliste": {
    "liste": "schluessel",
    "von": "Kettenschluessel"
  },
  "Kettenschluessel": {
    "felder": {
      "fingerabdruck": "text",
      "zertifikat": "text"
    }
  },
  "Kettensignaturen": {
    "liste": "signatur",
    "von": "Kettensignatur"
  },
  "Kettensignatur": {
    "felder": {
      "seq": "zahl",
      "fingerabdruck": "text",
      "signatur": "text"
    }
  },
  "Anhaenge": {
    "liste": "anhang",
    "von": "Anhang"
  },
  "Anhang": {
    "felder": {
      "id": "zahl",
      "art": "text",
      "name": "text",
      "groesse": "zahl",
      "erstelltAm": "text",
      "dateiname": "text",
      "teil": "zahl"
    }
  }
};
