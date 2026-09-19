import type { EASAttestationRaw } from "../../types/eas-responses";
import { logger } from "../app/logger";
import { parseEasAttestationRecord } from "./eas-parse";

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
