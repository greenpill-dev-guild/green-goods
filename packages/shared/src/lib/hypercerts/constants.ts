/**
 * Total number of fraction units for a hypercert.
 * Represents 100% ownership when divided among allowlist entries.
 * Uses bigint for precise arithmetic without floating-point errors.
 */
export const TOTAL_UNITS = 100_000_000n;

/**
 * Default protocol version for hypercert metadata.
 * Should match the version expected by the Hypercerts SDK.
 */
export const DEFAULT_PROTOCOL_VERSION = "1.0.0";
