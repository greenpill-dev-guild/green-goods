/**
 * Setup for the Shared Node files that share one module graph (`isolate: false`). The project
 * config restores mocks, stubbed globals and stubbed env after each test. What that leaves could
 * reach every later file in the worker, so this file stops it at the file that causes it:
 * - each file loads fresh copies of the Shared and test modules it imports, so module state such
 *   as a counter, a cache or a singleton cannot carry over. Dependencies that Vitest leaves to Node,
 *   which hold most of the import time, stay loaded;
 * - a global, or a `navigator` property, that the file's tests add, replace or remove fails the
 *   file and is put back. What loading does is not compared: a dependency that registers a global
 *   when it loads (zod, tslib, lit) does so for every file that imports it, and a test helper that
 *   writes one on import keeps its importers in their own graph (scripts/lib/vitest-shared-graph.mjs);
 * - fake timers left installed fail the test;
 * - a changed built-in, such as the `BigInt.prototype.toJSON` that `@hypercerts-org/sdk` sets when
 *   it loads, fails the file. Node keeps that dependency loaded, so the change would stay.
 */

import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { setupCoreTestEnvironment } from "./setupTests.core";

// Setup files run before Vitest imports each test file, so the file imports fresh modules.
vi.resetModules();

afterEach(() => {
  if (!vi.isFakeTimers()) return;
  vi.useRealTimers();
  throw new Error("This test left fake timers installed; restore them with vi.useRealTimers().");
});

const GUARDED_BUILTINS: Record<string, object> = {
  "Object.prototype": Object.prototype,
  "Array.prototype": Array.prototype,
  "String.prototype": String.prototype,
  "Number.prototype": Number.prototype,
  "BigInt.prototype": BigInt.prototype,
  "Boolean.prototype": Boolean.prototype,
  "Symbol.prototype": Symbol.prototype,
  "Function.prototype": Function.prototype,
  "Promise.prototype": Promise.prototype,
  "Date.prototype": Date.prototype,
  "RegExp.prototype": RegExp.prototype,
  "Error.prototype": Error.prototype,
  "Map.prototype": Map.prototype,
  "Set.prototype": Set.prototype,
  JSON,
};

function ownDescriptors(target: object): Map<PropertyKey, PropertyDescriptor> {
  return new Map(
    Reflect.ownKeys(target).map((key) => [key, Object.getOwnPropertyDescriptor(target, key)!])
  );
}

function sameDescriptor(before: PropertyDescriptor, after: PropertyDescriptor): boolean {
  return (
    Object.is(before.value, after.value) &&
    before.get === after.get &&
    before.set === after.set &&
    before.writable === after.writable &&
    before.enumerable === after.enumerable &&
    before.configurable === after.configurable
  );
}

function restore(target: object, key: PropertyKey, original: PropertyDescriptor | undefined) {
  try {
    return original
      ? Reflect.defineProperty(target, key, original)
      : Reflect.deleteProperty(target, key);
  } catch {
    return false;
  }
}

// Vitest runs setup files before it imports each test file, so this predates the file's imports.
const baseline = new Map(
  Object.entries(GUARDED_BUILTINS).map(([name, target]) => [name, ownDescriptors(target)])
);

afterAll(() => {
  const changes: string[] = [];
  for (const [name, target] of Object.entries(GUARDED_BUILTINS)) {
    const before = baseline.get(name)!;
    const after = ownDescriptors(target);
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const original = before.get(key);
      const current = after.get(key);
      if (original && current && sameDescriptor(original, current)) continue;
      // Put the built-in back so only this file fails.
      const restored = restore(target, key, original);
      changes.push(
        `${name}.${String(key)} ${original ? (current ? "replaced" : "removed") : "added"}` +
          (restored ? "" : " (could not be restored; later files may fail too)")
      );
    }
  }
  if (changes.length === 0) return;
  throw new Error(
    `This file changed built-ins that every later file in the shared graph would see: ${changes.join(", ")}. ` +
      "If a dependency changes them when it loads, keep the file in its own graph with a " +
      '"// @shared-graph isolate: <reason>" comment; otherwise undo the change in the test.'
  );
});

// Globals are compared by name; symbol-keyed entries belong to Node's own lazy internals.
interface GlobalsSnapshot {
  navigator: object | undefined;
  globals: Map<string, PropertyDescriptor>;
  navigatorProperties: Map<string, PropertyDescriptor>;
}

function namedDescriptors(target: object | undefined): Map<string, PropertyDescriptor> {
  if (!target) return new Map();
  return new Map(
    Object.getOwnPropertyNames(target).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(target, key)!,
    ])
  );
}

function snapshotGlobals(): GlobalsSnapshot {
  const navigator = (globalThis as { navigator?: object }).navigator;
  return {
    navigator,
    globals: namedDescriptors(globalThis),
    navigatorProperties: namedDescriptors(navigator),
  };
}

// Setup hooks run after Vitest imports the test file. The core setup replaces `fetch`,
// `performance`, storage and similar globals for every file between these two snapshots, so a
// change it makes is expected; any later change is the file's own.
let beforeCore: GlobalsSnapshot | undefined;
let afterCore: GlobalsSnapshot | undefined;
beforeAll(() => {
  beforeCore = snapshotGlobals();
});
setupCoreTestEnvironment();
beforeAll(() => {
  afterCore = snapshotGlobals();
});

function globalChanges(
  label: string,
  target: object,
  current: Map<string, PropertyDescriptor>,
  pick: (snapshot: GlobalsSnapshot) => Map<string, PropertyDescriptor>
): string[] {
  const changes: string[] = [];
  const original = pick(beforeCore!);
  for (const key of new Set([...original.keys(), ...current.keys()])) {
    const setBefore = original.get(key);
    const setAfter = pick(afterCore!).get(key);
    const coreChanged =
      setBefore === undefined || setAfter === undefined
        ? setBefore !== setAfter
        : !sameDescriptor(setBefore, setAfter);
    const expected = coreChanged ? setAfter : original.get(key);
    const now = current.get(key);
    if (expected && now ? sameDescriptor(expected, now) : expected === now) continue;
    const restored = restore(target, key, expected);
    changes.push(
      `${label}${key} ${expected ? (now ? "replaced" : "removed") : "added"}` +
        (restored ? "" : " (could not be restored; later files may fail too)")
    );
  }
  return changes;
}

afterAll(() => {
  // A file whose collection failed runs no setup hooks, so it has nothing to compare.
  if (!beforeCore || !afterCore) return;
  // restoreMocks restores spies before each test, and the spy registry outlives the file, so a spy
  // left behind would otherwise put its stale original back at the next file's first test. Restore
  // them here, where the comparison below sees what they put back.
  vi.restoreAllMocks();
  const now = snapshotGlobals();
  const changes = globalChanges("", globalThis, now.globals, (snapshot) => snapshot.globals);
  // A replaced navigator is reported above; compare its properties only while it is the same one.
  const navigator = afterCore.navigator;
  if (navigator && now.navigator === navigator) {
    changes.push(
      ...globalChanges(
        "navigator.",
        navigator,
        now.navigatorProperties,
        (snapshot) => snapshot.navigatorProperties
      )
    );
  }
  if (changes.length === 0) return;
  throw new Error(
    `This file changed globals that every later file in the shared graph would see: ${changes.join(", ")}. ` +
      "Stub them with vi.stubGlobal, restore them in the test, or keep the file in its own graph " +
      'with a "// @shared-graph isolate: <reason>" comment.'
  );
});
