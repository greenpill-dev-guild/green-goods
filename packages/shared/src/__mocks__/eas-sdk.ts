/**
 * Mock for @ethereum-attestation-service/eas-sdk
 *
 * This mock prevents the EAS SDK from loading, which avoids the
 * multiformats dependency chain that causes issues in bun's nested
 * package resolution during tests.
 */

import { vi } from "vitest";

// Re-export our local constants
export const NO_EXPIRATION = 0n;
export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Mock SchemaEncoder class
export class SchemaEncoder {
  constructor(_schema: string) {}
  encodeData(_data: Array<{ name: string; value: unknown; type: string }>) {
    return "0x" as `0x${string}`;
  }
}

// Mock EAS class
export class EAS {
  constructor(_address: string) {}
  connect(_signer: unknown) {
    return this;
  }
  attest(_params: unknown) {
    return Promise.resolve({ wait: vi.fn() });
  }
}

// Default export for compatibility
export default { EAS, SchemaEncoder, NO_EXPIRATION, ZERO_BYTES32 };
