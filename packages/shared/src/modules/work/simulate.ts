import { getPublicClient } from "@wagmi/core";
import type { Address } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { EASABI } from "../../utils/blockchain/contracts";
import { debugError, debugLog } from "../../utils/debug";
import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { encodeWorkApprovalData, simulateWorkData } from "../../utils/eas/encoders";
import { parseContractError } from "../../utils/errors/contract-errors";

export interface SimulateWorkSubmissionParams {
  draft: WorkDraft;
  gardenAddress: Address;
  actionUID: number;
  actionTitle: string;
  chainId: number;
  images: File[];
  accountAddress: Address;
}

export interface SimulateApprovalSubmissionParams {
  draft: WorkApprovalDraft;
  gardenAddress: Address;
  chainId: number;
  accountAddress: Address;
}

interface SimulationCacheEntry {
  timestamp: number;
}

const SIMULATION_CACHE_TTL_MS = 60_000;
const MAX_SIMULATION_CACHE_SIZE = 50;
const simulationCache = new Map<string, SimulationCacheEntry>();

function getSimulationCacheKey(
  gardenAddress: string,
  actionUID: number,
  accountAddress: string
): string {
  return `${gardenAddress}-${actionUID}-${accountAddress.toLowerCase()}`;
}

function hasValidCachedSimulation(cacheKey: string): boolean {
  const cached = simulationCache.get(cacheKey);
  if (!cached) return false;

  if (Date.now() - cached.timestamp > SIMULATION_CACHE_TTL_MS) {
    simulationCache.delete(cacheKey);
    return false;
  }

  return true;
}

function cacheSuccessfulSimulation(cacheKey: string): void {
  // Evict oldest entry if at capacity (Map preserves insertion order)
  if (simulationCache.size >= MAX_SIMULATION_CACHE_SIZE) {
    const oldestKey = simulationCache.keys().next().value;
    if (oldestKey) simulationCache.delete(oldestKey);
  }
  simulationCache.set(cacheKey, { timestamp: Date.now() });
}

/**
 * Simulate a work attestation transaction before uploading media.
 * Caches successful simulations for 60s to avoid duplicate checks.
 */
export async function simulateWorkSubmission({
  draft,
  gardenAddress,
  actionUID,
  actionTitle,
  chainId,
  images,
  accountAddress,
}: SimulateWorkSubmissionParams): Promise<void> {
  const cacheKey = getSimulationCacheKey(gardenAddress, actionUID, accountAddress);
  if (hasValidCachedSimulation(cacheKey)) {
    debugLog("[simulateWorkSubmission] Using cached simulation result");
    return;
  }

  const publicClient = getPublicClient(wagmiConfig, { chainId });
  if (!publicClient) {
    return;
  }

  try {
    debugLog("[simulateWorkSubmission] Simulating transaction before upload...");
    const easConfig = getEASConfig(chainId);

    const simulationData = simulateWorkData(
      {
        ...draft,
        title: `${actionTitle} - ${new Date().toISOString()}`,
        actionUID,
        media: images,
      },
      chainId
    );

    await publicClient.simulateContract({
      address: easConfig.EAS.address as `0x${string}`,
      abi: EASABI,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK.uid,
          data: {
            recipient: gardenAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: false,
            refUID: ZERO_BYTES32,
            data: simulationData,
            value: 0n,
          },
        },
      ],
      account: accountAddress,
    });

    cacheSuccessfulSimulation(cacheKey);
    debugLog("[simulateWorkSubmission] Simulation successful");
  } catch (err: unknown) {
    debugError("[simulateWorkSubmission] Simulation failed", err);

    const parsed = parseContractError(err);
    if (parsed.isKnown) {
      throw new Error(
        `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`
      );
    }

    const errorLike = err as { message?: string; cause?: { reason?: string } };
    const messageLower = errorLike.message?.toLowerCase() || "";

    if (
      messageLower.includes("notgardener") ||
      messageLower.includes("not a gardener") ||
      messageLower.includes("notgardenmember") ||
      messageLower.includes("not a member")
    ) {
      throw new Error("You're not a member of this garden. Please join the garden first.");
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw new Error("Transaction would fail. Make sure you're a member of the selected garden.");
    }

    if (errorLike.cause?.reason) {
      throw new Error(`Transaction check failed: ${errorLike.cause.reason}`);
    }

    throw new Error(
      `Transaction check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`
    );
  }
}

/**
 * Simulate a work approval attestation transaction before wallet confirmation.
 * Mirrors simulateWorkSubmission but for the WORK_APPROVAL schema.
 * Caches successful simulations for 60s to avoid duplicate checks.
 */
export async function simulateApprovalSubmission({
  draft,
  gardenAddress,
  chainId,
  accountAddress,
}: SimulateApprovalSubmissionParams): Promise<void> {
  const cacheKey = `approval-${gardenAddress}-${draft.workUID}-${accountAddress.toLowerCase()}`;
  if (hasValidCachedSimulation(cacheKey)) {
    debugLog("[simulateApprovalSubmission] Using cached simulation result");
    return;
  }

  const publicClient = getPublicClient(wagmiConfig, { chainId });
  if (!publicClient) {
    return;
  }

  try {
    debugLog("[simulateApprovalSubmission] Simulating approval transaction...");
    const easConfig = getEASConfig(chainId);
    const attestationData = encodeWorkApprovalData(draft, chainId);

    await publicClient.simulateContract({
      address: easConfig.EAS.address as `0x${string}`,
      abi: EASABI,
      functionName: "attest",
      args: [
        {
          schema: easConfig.WORK_APPROVAL.uid,
          data: {
            recipient: gardenAddress as `0x${string}`,
            expirationTime: NO_EXPIRATION,
            revocable: false,
            refUID: ZERO_BYTES32,
            data: attestationData,
            value: 0n,
          },
        },
      ],
      account: accountAddress,
    });

    cacheSuccessfulSimulation(cacheKey);
    debugLog("[simulateApprovalSubmission] Simulation successful");
  } catch (err: unknown) {
    debugError("[simulateApprovalSubmission] Simulation failed", err);

    const parsed = parseContractError(err);
    if (parsed.isKnown) {
      throw new Error(
        `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`
      );
    }

    const errorLike = err as { message?: string; cause?: { reason?: string } };
    const messageLower = errorLike.message?.toLowerCase() || "";

    if (
      messageLower.includes("notoperator") ||
      messageLower.includes("not an operator") ||
      messageLower.includes("notauthorized") ||
      messageLower.includes("not authorized")
    ) {
      throw new Error("You're not authorized to approve work for this garden.");
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw new Error(
        "Transaction would fail. Make sure you're an operator of the selected garden."
      );
    }

    if (errorLike.cause?.reason) {
      throw new Error(`Approval check failed: ${errorLike.cause.reason}`);
    }

    throw new Error(
      `Approval check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`
    );
  }
}
