/**
 * EAS Transaction Builder
 *
 * Shared utilities for building EAS attestation transactions.
 * Used by both passkey and wallet submission modules.
 *
 * @module utils/eas/transaction-builder
 */

import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { encodeFunctionData, type Hex } from "viem";
import type { EASConfig } from "../../config/blockchain";
import { EASABI } from "../blockchain/contracts";

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
 * Build an EAS attestation request (internal helper)
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
      revocable: true,
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
