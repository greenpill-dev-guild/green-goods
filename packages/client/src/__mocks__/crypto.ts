import { webcrypto } from "crypto";

// Vitest in Node lacks subtle crypto by default.
if (!globalThis.crypto || typeof globalThis.crypto.subtle === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: true,
    value: webcrypto,
  });
}
