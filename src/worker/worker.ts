// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Web Worker: führt die Prüfung aus und meldet den Fortschritt, damit die Seite nicht blockiert.

import { auftragAusfuehren, type Auftrag, type Meldung } from "./auftrag.js";

const scope = self as unknown as { onmessage: ((e: MessageEvent<Auftrag>) => void) | null; postMessage(m: Meldung): void };

scope.onmessage = (e) => {
  void auftragAusfuehren(e.data, (m) => scope.postMessage(m));
};
