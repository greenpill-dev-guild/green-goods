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

/**
 * Gas, in percent over the estimate, that a Work approval sends. Its resolver runs the Karma Project
 * Update inside try/catch, so an approval sent at the bare estimate lands without its update. On
 * forks of Arbitrum the upgraded Karma module needed up to about 21% over the node's estimate.
 */
export const APPROVAL_GAS_HEADROOM_PERCENT = 50;
