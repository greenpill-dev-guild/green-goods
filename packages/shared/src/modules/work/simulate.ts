import { getPublicClient } from "@wagmi/core";
import type { Address } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { EASABI } from "../../utils/blockchain/contracts";
import { debugError, debugLog } from "../../utils/debug";
import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { encodeWorkApprovalData, simulateWorkData } from "../../utils/eas/encoders";
import { parseContractError } from "../../utils/errors/contract-errors";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";

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

const SIMULATION_CACHE_TTL_MS = 60_000;
const MAX_SIMULATION_CACHE_SIZE = 50;

type SimulationPublicClient = Pick<
  NonNullable<ReturnType<typeof getPublicClient>>,
  "simulateContract"
>;

export interface SimulationCache {
  hasValid(key: string, timestamp?: number): boolean;
  record(key: string, timestamp?: number): void;
  clear(): void;
}

export interface CreateSimulationCacheOptions {
  now?: () => number;
  ttlMs?: number;
  maxSize?: number;
}

export interface SimulationDeps {
  getPublicClient?: (chainId: number) => SimulationPublicClient | undefined;
  now?: () => number;
  cache?: SimulationCache;
  easConfig?: EASConfig;
}

export function createSimulationCache({
  now = Date.now,
  ttlMs = SIMULATION_CACHE_TTL_MS,
  maxSize = MAX_SIMULATION_CACHE_SIZE,
}: CreateSimulationCacheOptions = {}): SimulationCache {
  const entries = new Map<string, number>();

  return {
    hasValid(key, timestamp = now()) {
      const cachedAt = entries.get(key);
      if (cachedAt === undefined) return false;
      if (timestamp - cachedAt > ttlMs) {
        entries.delete(key);
        return false;
      }
      return true;
    },
    record(key, timestamp = now()) {
      if (entries.size >= maxSize) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey !== undefined) entries.delete(oldestKey);
      }
      entries.set(key, timestamp);
    },
    clear() {
      entries.clear();
    },
  };
}

const defaultSimulationCache = createSimulationCache();

export function clearSimulationCache(): void {
  defaultSimulationCache.clear();
}

function getSimulationCacheKey(
  gardenAddress: string,
  actionUID: number,
  accountAddress: string
): string {
  return `${gardenAddress}-${actionUID}-${accountAddress.toLowerCase()}`;
}

function resolveSimulationDeps(deps: SimulationDeps, chainId: number) {
  return {
    now: deps.now ?? Date.now,
    cache: deps.cache ?? defaultSimulationCache,
    easConfig: deps.easConfig ?? getEASConfig(chainId),
    publicClient:
      deps.getPublicClient?.(chainId) ??
      (deps.getPublicClient
        ? undefined
        : getPublicClient(getWagmiConfig(), {
            chainId,
          })),
  };
}

/**
 * Simulate a work attestation transaction before uploading media.
 * Caches successful simulations for 60s to avoid duplicate checks.
 */
export async function simulateWorkSubmission(
  {
    draft,
    gardenAddress,
    actionUID,
    actionTitle,
    chainId,
    images,
    accountAddress,
  }: SimulateWorkSubmissionParams,
  deps: SimulationDeps = {}
): Promise<void> {
  const resolved = resolveSimulationDeps(deps, chainId);
  const cacheKey = getSimulationCacheKey(gardenAddress, actionUID, accountAddress);
  if (resolved.cache.hasValid(cacheKey, resolved.now())) {
    debugLog("[simulateWorkSubmission] Using cached simulation result");
    return;
  }

  const publicClient = resolved.publicClient;
  if (!publicClient) {
    return;
  }

  try {
    debugLog("[simulateWorkSubmission] Simulating transaction before upload...");
    const easConfig = resolved.easConfig;

    const simulationData = simulateWorkData(
      {
        ...draft,
        title: resolveWorkSubmissionTitle({ draftTitle: draft.title, actionTitle, actionUID }),
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

    resolved.cache.record(cacheKey, resolved.now());
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
export async function simulateApprovalSubmission(
  { draft, gardenAddress, chainId, accountAddress }: SimulateApprovalSubmissionParams,
  deps: SimulationDeps = {}
): Promise<void> {
  const resolved = resolveSimulationDeps(deps, chainId);
  const cacheKey = `approval-${gardenAddress}-${draft.workUID}-${accountAddress.toLowerCase()}`;
  if (resolved.cache.hasValid(cacheKey, resolved.now())) {
    debugLog("[simulateApprovalSubmission] Using cached simulation result");
    return;
  }

  const publicClient = resolved.publicClient;
  if (!publicClient) {
    return;
  }

  try {
    debugLog("[simulateApprovalSubmission] Simulating approval transaction...");
    const easConfig = resolved.easConfig;
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

    resolved.cache.record(cacheKey, resolved.now());
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
      // These match the chain's own revert text, which still says "operator".
      messageLower.includes("notoperator") ||
      messageLower.includes("not an operator") ||
      messageLower.includes("notauthorized") ||
      messageLower.includes("not authorized")
    ) {
      throw new Error("You're not authorized to approve work for this garden.");
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw new Error("Transaction would fail. Make sure you're a steward of the selected garden.");
    }

    if (errorLike.cause?.reason) {
      throw new Error(`Approval check failed: ${errorLike.cause.reason}`);
    }

    throw new Error(
      `Approval check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`
    );
  }
}
