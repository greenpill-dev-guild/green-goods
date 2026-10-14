import { getAddress, isAddress } from "viem";
import type { EASAttestationRaw } from "../../types/eas-responses";
import { logger } from "../app/logger";
import { parseEasAttestationRecord } from "./eas-parse";

/**
 * Spell an address the way EAS stores it.
 *
 * EAS stores addresses checksummed, and its GraphQL `equals` and `in` filters
 * compare strings exactly. A lowercase garden or gardener address therefore
 * matches nothing: the read succeeds with zero rows, and a list shows "no
 * work" for a garden that has some. Garden ids reach these reads in both
 * spellings (checksummed from the gardens list, lowercase from indexed rows
 * and normalized cache keys), so every address filter goes through here. A
 * value that is not an address passes through and keeps matching nothing.
 */
export function easStoredAddress(address: string): string {
  return isAddress(address, { strict: false }) ? getAddress(address) : address;
}

/** Custom error for EAS fetch failures - allows React Query to properly retry/error */
export class EASFetchError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "EASFetchError";
  }
}

export function validatedAttestations(
  attestations: unknown,
  operation: string
): EASAttestationRaw[] {
  if (!Array.isArray(attestations)) return [];

  return attestations.flatMap((attestation) => {
    try {
      return [parseEasAttestationRecord(attestation)];
    } catch (error) {
      logger.warn("Skipping malformed EAS attestation", {
        source: "eas",
        operation,
        attestationId:
          attestation && typeof attestation === "object" && "id" in attestation
            ? String(attestation.id)
            : undefined,
        error,
      });
      return [];
    }
  });
}
