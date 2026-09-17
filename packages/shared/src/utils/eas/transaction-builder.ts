/**
 * EAS Transaction Builder
 *
 * Shared utilities for building EAS attestation transactions.
 * Used by both passkey and wallet submission modules.
 *
 * @module utils/eas/transaction-builder
 */

import { encodeFunctionData, type Hex } from "viem";
import type { EASConfig } from "../../config/blockchain";
import type { ContractCall } from "../../modules/transactions/types";
import { EASABI } from "../blockchain/contracts";
import { NO_EXPIRATION, ZERO_BYTES32 } from "./constants";

/**
 * EAS attestation request structure (internal)
 */
interface AttestationRequest {
  schema: Hex;
  data: {
    recipient: `0x${string}`;
    expirationTime: bigint;
    revocable: boolean;
    refUID: Hex;
    data: Hex;
    value: bigint;
  };
}

/**
 * Build an EAS attestation request
 */
function buildAttestationRequest(
  recipient: `0x${string}`,
  schemaUID: Hex,
  attestationData: Hex
): AttestationRequest {
  return {
    schema: schemaUID,
    data: {
      recipient,
      expirationTime: NO_EXPIRATION,
      revocable: false,
      refUID: ZERO_BYTES32 as Hex,
      data: attestationData,
      value: 0n,
    },
  };
}

/**
 * Build transaction parameters for an EAS attestation (internal helper)
 */
function buildAttestTxParams(
  easAddress: `0x${string}`,
  request: AttestationRequest
): { to: `0x${string}`; data: Hex; value: bigint } {
  return {
    to: easAddress,
    data: encodeFunctionData({
      abi: EASABI,
      functionName: "attest",
      args: [request],
    }),
    value: 0n,
  };
}

/**
 * Build work attestation transaction params
 *
 * @param easConfig - EAS configuration for the chain
 * @param gardenAddress - Garden address receiving the attestation
 * @param attestationData - Encoded attestation data
 * @returns Transaction parameters (to, data, value)
 */
export function buildWorkAttestTx(
  easConfig: EASConfig,
  gardenAddress: `0x${string}`,
  attestationData: Hex
): { to: `0x${string}`; data: Hex; value: bigint } {
  const request = buildAttestationRequest(
    gardenAddress,
    easConfig.WORK.uid as Hex,
    attestationData
  );
  return buildAttestTxParams(easConfig.EAS.address as `0x${string}`, request);
}

/**
 * Build approval attestation transaction params
 *
 * @param easConfig - EAS configuration for the chain
 * @param gardenAddress - Garden address (EAS recipient - must match work attestation recipient)
 * @param attestationData - Encoded attestation data
 * @returns Transaction parameters (to, data, value)
 */
export function buildApprovalAttestTx(
  easConfig: EASConfig,
  gardenAddress: `0x${string}`,
  attestationData: Hex
): { to: `0x${string}`; data: Hex; value: bigint } {
  const request = buildAttestationRequest(
    gardenAddress,
    easConfig.WORK_APPROVAL.uid as Hex,
    attestationData
  );
  return buildAttestTxParams(easConfig.EAS.address as `0x${string}`, request);
}

/**
 * Multi-attestation request structure for batch operations
 */
interface MultiAttestationRequest {
  schema: Hex;
  data: Array<{
    recipient: `0x${string}`;
    expirationTime: bigint;
    revocable: boolean;
    refUID: Hex;
    data: Hex;
    value: bigint;
  }>;
}

/**
 * Build batch approval attestation transaction params using EAS multiAttest
 *
 * This batches multiple approval attestations into a single transaction,
 * significantly improving UX when approving/rejecting multiple works.
 *
 * @param easConfig - EAS configuration for the chain
 * @param approvals - Array of { gardenAddress, attestationData } pairs
 * @returns Transaction parameters (to, data, value)
 * @throws Error if approvals array is empty
 */
export function buildBatchApprovalAttestTx(
  easConfig: EASConfig,
  approvals: Array<{ gardenAddress: `0x${string}`; attestationData: Hex }>
): { to: `0x${string}`; data: Hex; value: bigint } {
  // Guard against empty approvals array
  if (approvals.length === 0) {
    throw new Error("Approvals array must not be empty");
  }

  // Group attestations by schema (all approvals use the same schema)
  const multiRequest: MultiAttestationRequest = {
    schema: easConfig.WORK_APPROVAL.uid as Hex,
    data: approvals.map(({ gardenAddress, attestationData }) => ({
      recipient: gardenAddress,
      expirationTime: NO_EXPIRATION,
      revocable: false,
      refUID: ZERO_BYTES32 as Hex,
      data: attestationData,
      value: 0n,
    })),
  };

  return {
    to: easConfig.EAS.address as `0x${string}`,
    data: encodeFunctionData({
      abi: EASABI,
      functionName: "multiAttest",
      args: [[multiRequest]],
    }),
    value: 0n,
  };
}

// ============================================================================
// ContractCall Builders (for use with TransactionSender)
// ============================================================================

/**
 * Build a ContractCall for a work attestation via TransactionSender.
 *
 * @param easConfig - EAS configuration for the chain
 * @param gardenAddress - Garden address receiving the attestation
 * @param attestationData - Encoded attestation data
 * @returns ContractCall suitable for TransactionSender.sendContractCall()
 */
export function buildWorkAttestContractCall(
  easConfig: EASConfig,
  gardenAddress: `0x${string}`,
  attestationData: Hex
): ContractCall {
  const request = buildAttestationRequest(
    gardenAddress,
    easConfig.WORK.uid as Hex,
    attestationData
  );
  return {
    address: easConfig.EAS.address as `0x${string}`,
    abi: EASABI,
    functionName: "attest",
    args: [request],
  };
}

/**
 * Build a ContractCall for an approval attestation via TransactionSender.
 *
 * @param easConfig - EAS configuration for the chain
 * @param gardenAddress - Garden address (must match work attestation recipient)
 * @param attestationData - Encoded attestation data
 * @returns ContractCall suitable for TransactionSender.sendContractCall()
 */
export function buildApprovalAttestContractCall(
  easConfig: EASConfig,
  gardenAddress: `0x${string}`,
  attestationData: Hex
): ContractCall {
  const request = buildAttestationRequest(
    gardenAddress,
    easConfig.WORK_APPROVAL.uid as Hex,
    attestationData
  );
  return {
    address: easConfig.EAS.address as `0x${string}`,
    abi: EASABI,
    functionName: "attest",
    args: [request],
  };
}

/** One queued attestation: the garden it is about and its encoded data. */
export interface QueuedAttestation {
  gardenAddress: `0x${string}`;
  attestationData: Hex;
}

/**
 * Build one ContractCall that sends every queued attestation at once.
 *
 * A single item is a plain `attest`. Several are one `multiAttest` with one
 * request group per schema, work first and decisions second, so a passkey
 * signs one UserOperation and a wallet approves one transaction. EAS returns
 * the new UIDs in the order of the requests it was given.
 *
 * @throws Error when nothing is queued
 */
export function buildQueuedAttestationsCall(
  easConfig: EASConfig,
  queued: { works: QueuedAttestation[]; approvals: QueuedAttestation[] }
): ContractCall {
  const groups = [
    { schema: easConfig.WORK.uid as Hex, items: queued.works },
    { schema: easConfig.WORK_APPROVAL.uid as Hex, items: queued.approvals },
  ].filter(({ items }) => items.length > 0);
  if (groups.length === 0) throw new Error("Nothing is queued to send");

  const address = easConfig.EAS.address as `0x${string}`;
  if (groups.length === 1 && groups[0].items.length === 1) {
    const [{ gardenAddress, attestationData }] = groups[0].items;
    return {
      address,
      abi: EASABI,
      functionName: "attest",
      args: [buildAttestationRequest(gardenAddress, groups[0].schema, attestationData)],
    };
  }
  const requests: MultiAttestationRequest[] = groups.map(({ schema, items }) => ({
    schema,
    data: items.map(
      ({ gardenAddress, attestationData }) =>
        buildAttestationRequest(gardenAddress, schema, attestationData).data
    ),
  }));
  return { address, abi: EASABI, functionName: "multiAttest", args: [requests] };
}
