import { getPublicClient } from "@wagmi/core";
import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  type Abi,
  type Address,
} from "viem";
import { getWagmiConfig } from "../../config/appkit";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import { EASABI } from "../../utils/blockchain/contracts";
import { debugError, debugLog } from "../../utils/debug";
import { NO_EXPIRATION, ZERO_BYTES32 } from "../../utils/eas/constants";
import { encodeWorkApprovalData, simulateWorkData } from "../../utils/eas/encoders";
import { parseContractError } from "../../utils/errors/contract-errors";
import { resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import { SimulationRejected } from "./simulation-rejected";

export { SimulationRejected } from "./simulation-rejected";

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

function refusedByChain(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    Boolean(
      error.walk(
        (cause) =>
          cause instanceof ContractFunctionRevertedError || cause instanceof ExecutionRevertedError
      )
    )
  );
}

function rejection(error: unknown, message: string, reason: string): SimulationRejected {
  return new SimulationRejected(message, reason, refusedByChain(error), { cause: error });
}
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
      throw rejection(
        err,
        `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`,
        parsed.name
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
      throw rejection(
        err,
        "You're not a member of this garden. Please join the garden first.",
        "NotGardenMember"
      );
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw rejection(
        err,
        "Transaction would fail. Make sure you're a member of the selected garden.",
        "reverted"
      );
    }

    if (errorLike.cause?.reason) {
      throw rejection(err, `Transaction check failed: ${errorLike.cause.reason}`, "reverted");
    }

    throw rejection(
      err,
      `Transaction check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`,
      "unknown"
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
      throw rejection(
        err,
        `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`,
        parsed.name
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
      throw rejection(
        err,
        "You're not authorized to approve work for this garden.",
        "NotGardenOperator"
      );
    }

    if (messageLower.includes("reverted") && !errorLike.cause?.reason) {
      throw rejection(
        err,
        "Transaction would fail. Make sure you're a steward of the selected garden.",
        "reverted"
      );
    }

    if (errorLike.cause?.reason) {
      throw rejection(err, `Approval check failed: ${errorLike.cause.reason}`, "reverted");
    }

    throw rejection(
      err,
      `Approval check failed: ${parsed.message || errorLike.message || "Unknown simulation error"}`,
      "unknown"
    );
  }
}

/**
 * Simulate the one call Upload all sends, from the account that will send it.
 * It is never cached: the items a call carries change between uploads.
 */
export async function simulateQueuedAttestations(
  call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] },
  chainId: number,
  accountAddress: Address,
  deps: SimulationDeps = {}
): Promise<void> {
  const { publicClient } = resolveSimulationDeps(deps, chainId);
  // Without a client the call was never checked, which must never read as the
  // chain accepting it: Upload all refuses rather than sending a batch blind.
  if (!publicClient)
    throw new SimulationRejected("No chain client to check this upload", "unchecked", false);
  try {
    await (publicClient.simulateContract as (parameters: unknown) => Promise<unknown>)({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
      account: accountAddress,
    });
  } catch (err: unknown) {
    debugError("[simulateQueuedAttestations] Simulation failed", err);
    const parsed = parseContractError(err);
    throw parsed.isKnown
      ? rejection(err, `[${parsed.name}] ${parsed.message}`, parsed.name)
      : rejection(
          err,
          `Upload check failed: ${parsed.message || (err as Error)?.message || "Unknown simulation error"}`,
          "reverted"
        );
  }
}
