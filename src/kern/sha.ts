// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// SHA-256 über WebCrypto (im Browser und in Node über globalThis.crypto).

import { hex, puffer, utf8 } from "./bytes.js";

export function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) throw new Error("WebCrypto (crypto.subtle) ist nicht verfügbar.");
  return c.subtle;
}

export async function sha256(daten: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof daten === "string" ? utf8(daten) : daten;
  return new Uint8Array(await subtle().digest("SHA-256", puffer(bytes)));
}

export async function sha256Hex(daten: Uint8Array | string): Promise<string> {
  return hex(await sha256(daten));
}
