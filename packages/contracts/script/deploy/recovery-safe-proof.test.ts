import { describe, expect, it } from "vitest";

import {
  assertRecoverySafeProof,
  invalidEip1271ProbeRejectsMalformedSignature,
  type InvalidEip1271Probe,
} from "./recovery-safe-proof";

function validSafe(probe: InvalidEip1271Probe = { reverted: true, data: "0x" }) {
  return {
    proxyRuntimeHashMatchesOfficialFactory: true,
    liveStateChecks: { version141: true, noModules: true, noGuard: true },
    invalidEip1271Probe: probe,
  };
}

describe("recovery Safe proof validation", () => {
  it("rejects a malformed signature that returns the EIP-1271 magic value", () => {
    const probe = { reverted: false, data: `0x1626ba7e${"00".repeat(28)}` };
    expect(invalidEip1271ProbeRejectsMalformedSignature(probe)).toBe(false);
    expect(() => assertRecoverySafeProof({ safeL2: { matches: true } }, { protocol: validSafe(probe) })).toThrow(
      "accepted the malformed EIP-1271 signature probe",
    );
  });

  it("accepts a revert or a successful non-magic response and rejects missing successful data", () => {
    expect(invalidEip1271ProbeRejectsMalformedSignature({ reverted: true, data: "0x" })).toBe(true);
    expect(invalidEip1271ProbeRejectsMalformedSignature({ reverted: false, data: "0xffffffff" })).toBe(true);
    expect(invalidEip1271ProbeRejectsMalformedSignature({ reverted: false, data: null })).toBe(false);
  });

  it("fails closed on official code, proxy runtime, and live state mismatches", () => {
    expect(() => assertRecoverySafeProof({ safeL2: { matches: false } }, { protocol: validSafe() })).toThrow(
      "Official safeL2 code identity does not match",
    );
    expect(() =>
      assertRecoverySafeProof(
        { safeL2: { matches: true } },
        { protocol: { ...validSafe(), proxyRuntimeHashMatchesOfficialFactory: false } },
      ),
    ).toThrow("proxy runtime does not match");
    expect(() =>
      assertRecoverySafeProof(
        { safeL2: { matches: true } },
        { protocol: { ...validSafe(), liveStateChecks: { version141: false } } },
      ),
    ).toThrow("failed live state check: version141");
  });

  it("fails closed when the proof carries no evidence to validate", () => {
    expect(() => assertRecoverySafeProof({}, {})).toThrow("Recovery Safe proof received no official code checks");
    expect(() => assertRecoverySafeProof({}, { protocol: validSafe() })).toThrow(
      "Recovery Safe proof received no official code checks",
    );
    expect(() => assertRecoverySafeProof({ safeL2: { matches: true } }, {})).toThrow(
      "Recovery Safe proof received no recovery Safes",
    );
    expect(() =>
      assertRecoverySafeProof({ safeL2: { matches: true } }, { protocol: { ...validSafe(), liveStateChecks: {} } }),
    ).toThrow("protocol reported no live state checks");
  });
});
