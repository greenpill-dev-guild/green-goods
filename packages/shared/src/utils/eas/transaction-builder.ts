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
import { EASABI } from "../contracts";

/**
 * EAS attestation request structure
 */
export interface AttestationRequest {
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
 * Build an EAS attestation request for work submission
 *
 * @param recipient - Garden address receiving the attestation
 * @param schemaUID - EAS schema UID
 * @param attestationData - Encoded attestation data
 * @returns Attestation request object
 */
export function buildWorkAttestationRequest(
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
 * Build an EAS attestation request for work approval
 *
 * @param recipient - Gardener address receiving the attestation
 * @param schemaUID - EAS schema UID
 * @param attestationData - Encoded attestation data
 * @returns Attestation request object
 */
export function buildApprovalAttestationRequest(
  recipient: `0x${string}`,
  schemaUID: Hex,
  attestationData: Hex
): AttestationRequest {
  return buildWorkAttestationRequest(recipient, schemaUID, attestationData);
}

/**
 * Encode an EAS attest function call
 *
 * @param request - The attestation request
 * @returns Encoded function data for the attest call
 */
export function encodeAttestCall(request: AttestationRequest): Hex {
  return encodeFunctionData({
    abi: EASABI,
    functionName: "attest",
    args: [request],
  });
}

/**
 * Build transaction parameters for an EAS attestation
 *
 * @param easAddress - EAS contract address
 * @param request - The attestation request
 * @returns Transaction parameters (to, data, value)
 */
export function buildAttestTxParams(
  easAddress: `0x${string}`,
  request: AttestationRequest
): { to: `0x${string}`; data: Hex; value: bigint } {
  return {
    to: easAddress,
    data: encodeAttestCall(request),
    value: 0n,
  };
}

/**
 * Helper to build work attestation transaction params in one call
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
  const request = buildWorkAttestationRequest(
    gardenAddress,
    easConfig.WORK.uid as Hex,
    attestationData
  );
  return buildAttestTxParams(easConfig.EAS.address as `0x${string}`, request);
}

/**
 * Helper to build approval attestation transaction params in one call
 *
 * @param easConfig - EAS configuration for the chain
 * @param gardenerAddress - Gardener address receiving the attestation
 * @param attestationData - Encoded attestation data
 * @returns Transaction parameters (to, data, value)
 */
export function buildApprovalAttestTx(
  easConfig: EASConfig,
  gardenerAddress: `0x${string}`,
  attestationData: Hex
): { to: `0x${string}`; data: Hex; value: bigint } {
  const request = buildApprovalAttestationRequest(
    gardenerAddress,
    easConfig.WORK_APPROVAL.uid as Hex,
    attestationData
  );
  return buildAttestTxParams(easConfig.EAS.address as `0x${string}`, request);
}
