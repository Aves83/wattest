// SPDX-License-Identifier: EUPL-1.2
// WATTest © 2026 Hans-Joachim Steudel

// Knappe Typen für die Teile von Node, die die Tests nutzen (ohne @types/node, damit es bei
// typescript und esbuild als einzigen Entwicklungsabhängigkeiten bleibt).

declare module "node:test" {
  type Fn = (t: unknown) => void | Promise<void>;
  export function test(name: string, fn: Fn): Promise<void>;
  export function test(name: string, opts: { timeout?: number; skip?: boolean | string }, fn: Fn): Promise<void>;
  export function describe(name: string, fn: () => void | Promise<void>): Promise<void>;
  export function it(name: string, fn: Fn): Promise<void>;
  export function before(fn: () => void | Promise<void>): void;
  export function after(fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  interface Assert {
    (wert: unknown, nachricht?: string): asserts wert;
    ok(wert: unknown, nachricht?: string): asserts wert;
    equal(a: unknown, b: unknown, nachricht?: string): void;
    notEqual(a: unknown, b: unknown, nachricht?: string): void;
    deepEqual(a: unknown, b: unknown, nachricht?: string): void;
    match(text: string, re: RegExp, nachricht?: string): void;
    doesNotMatch(text: string, re: RegExp, nachricht?: string): void;
    throws(fn: () => unknown, nachricht?: unknown): void;
    rejects(p: Promise<unknown> | (() => Promise<unknown>), nachricht?: unknown): Promise<void>;
    fail(nachricht?: string): never;
  }
  const assert: Assert;
  export default assert;
}

declare module "node:fs" {
  export function readFileSync(pfad: string): Uint8Array;
  export function readFileSync(pfad: string, kodierung: "utf8"): string;
  export function writeFileSync(pfad: string, daten: string | Uint8Array): void;
  export function existsSync(pfad: string): boolean;
  export function readdirSync(pfad: string): string[];
  export function mkdtempSync(praefix: string): string;
  export function mkdirSync(pfad: string, opts?: { recursive?: boolean }): void;
  export function rmSync(pfad: string, opts?: { recursive?: boolean; force?: boolean }): void;
  export function statSync(pfad: string): { size: number; isDirectory(): boolean };
}

declare module "node:path" {
  export function join(...teile: string[]): string;
  export function dirname(pfad: string): string;
  export function resolve(...teile: string[]): string;
  export function relative(von: string, nach: string): string;
  export const sep: string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:child_process" {
  export function execFileSync(datei: string, argumente: string[], opts?: { cwd?: string; encoding?: "utf8"; env?: Record<string, string | undefined>; stdio?: unknown }): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  execPath: string;
  platform: string;
};

interface ImportMeta {
  url: string;
}
