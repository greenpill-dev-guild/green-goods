import type { Address } from "viem";
import { getPublicClient } from "@wagmi/core";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { encodeWorkApprovalData, simulateWorkData } from "../../utils/eas/encoders";
import { debugError, debugLog } from "../../utils/debug";
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

interface SimulationCacheEntry {
  timestamp: number;
}

const SIMULATION_CACHE_TTL_MS = 60_000;
const MAX_SIMULATION_CACHE_SIZE = 50;
const simulationCache = new Map<string, SimulationCacheEntry>();
const approvalSimulationCache = new Map<string, SimulationCacheEntry>();

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

function hasValidCachedApprovalSimulation(cacheKey: string): boolean {
  const cached = approvalSimulationCache.get(cacheKey);
  if (!cached) return false;

  if (Date.now() - cached.timestamp > SIMULATION_CACHE_TTL_MS) {
    approvalSimulationCache.delete(cacheKey);
    return false;
  }

  return true;
}

function cacheSuccessfulApprovalSimulation(cacheKey: string): void {
  if (approvalSimulationCache.size >= MAX_SIMULATION_CACHE_SIZE) {
    const oldestKey = approvalSimulationCache.keys().next().value;
    if (oldestKey) approvalSimulationCache.delete(oldestKey);
  }
  approvalSimulationCache.set(cacheKey, { timestamp: Date.now() });
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
            revocable: true,
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

export interface SimulateApprovalSubmissionParams {
  draft: WorkApprovalDraft;
  gardenAddress: Address;
  chainId: number;
  accountAddress: Address;
}

function getApprovalSimulationCacheKey(
  draft: WorkApprovalDraft,
  gardenAddress: string,
  accountAddress: string
): string {
  return [
    gardenAddress,
    draft.workUID,
    draft.actionUID,
    draft.approved ? "approved" : "rejected",
    draft.confidence,
    draft.verificationMethod,
    accountAddress.toLowerCase(),
  ].join("-");
}

/**
 * Simulate a work approval attestation before prompting for wallet confirmation.
 * Mirrors work submission preflight so obvious contract failures surface early.
 */
export async function simulateApprovalSubmission({
  draft,
  gardenAddress,
  chainId,
  accountAddress,
}: SimulateApprovalSubmissionParams): Promise<void> {
  const cacheKey = getApprovalSimulationCacheKey(draft, gardenAddress, accountAddress);
  if (hasValidCachedApprovalSimulation(cacheKey)) {
    debugLog("[simulateApprovalSubmission] Using cached simulation result");
    return;
  }

  const publicClient = getPublicClient(wagmiConfig, { chainId });
  if (!publicClient) {
    return;
  }

  try {
    debugLog("[simulateApprovalSubmission] Simulating approval transaction before submission...");
    const easConfig = getEASConfig(chainId);
    const simulationData = encodeWorkApprovalData(draft, chainId);

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
            revocable: true,
            refUID: ZERO_BYTES32,
            data: simulationData,
            value: 0n,
          },
        },
      ],
      account: accountAddress,
    });

    cacheSuccessfulApprovalSimulation(cacheKey);
    debugLog("[simulateApprovalSubmission] Simulation successful");
  } catch (err: unknown) {
    debugError("[simulateApprovalSubmission] Simulation failed", err);

    const parsed = parseContractError(err);
    if (parsed.isKnown) {
      throw new Error(parsed.name);
    }

    const errorLike = err as { message?: string; cause?: { reason?: string } };
    const messageLower = errorLike.message?.toLowerCase() || "";

    if (
      messageLower.includes("notgardenoperator") ||
      messageLower.includes("only garden operators") ||
      messageLower.includes("not operator")
    ) {
      throw new Error("NotGardenOperator");
    }

    if (messageLower.includes("actionexpired") || messageLower.includes("action expired")) {
      throw new Error("ActionExpired");
    }

    if (messageLower.includes("actionmismatch")) {
      throw new Error("ActionMismatch");
    }

    if (messageLower.includes("notinworkregistry")) {
      throw new Error("NotInWorkRegistry");
    }

    if (messageLower.includes("invalidverificationmethod")) {
      throw new Error("InvalidVerificationMethod");
    }

    if (messageLower.includes("invalidconfidence")) {
      throw new Error("InvalidConfidence");
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw new Error(
        "Transaction would fail. Check operator access, action status, and work details before trying again."
      );
    }

    if (errorLike.cause?.reason) {
      throw new Error(`Transaction check failed: ${errorLike.cause.reason}`);
    }

    throw new Error(
      `Transaction check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`
    );
  }
}
