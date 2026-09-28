/**
 * Setup for the Shared Node files that share one module graph (`isolate: false`). The project
 * config restores mocks, stubbed globals and stubbed env after each test. Two leaks have no such
 * option, so this file fails the test or file that causes them instead of a later file:
 * - fake timers left installed;
 * - a changed built-in, such as the `BigInt.prototype.toJSON` that `@hypercerts-org/sdk` sets when
 *   it loads. The graph loads each module once, so the change would reach every later file.
 */

import { afterAll, afterEach, vi } from "vitest";

import "./setupTests.node";

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
      let restored: boolean;
      try {
        restored = original
          ? Reflect.defineProperty(target, key, original)
          : Reflect.deleteProperty(target, key);
      } catch {
        restored = false;
      }
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
