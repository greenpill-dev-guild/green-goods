/**
 * EAS Constants
 *
 * Local definitions of constants from @ethereum-attestation-service/eas-sdk
 * to avoid triggering the multiformats dependency chain during testing.
 *
 * @see https://github.com/ethereum-attestation-service/eas-sdk
 */

/**
 * Represents no expiration time for attestations (bigint zero).
 * Used when creating attestations that should never expire.
 */
export const NO_EXPIRATION = 0n;

/**
 * 32 zero bytes, used as the refUID when there's no referenced attestation.
 */
export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
