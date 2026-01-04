/**
 * Direct wallet submission module
 *
 * Enables wallet-authenticated users to submit work and approvals directly
 * via blockchain transactions, bypassing the job queue system.
 *
 * Use for:
 * - Wallet (EOA) authentication mode
 * - Online-only operations
 * - Traditional web3 UX (sign transaction, wait for confirmation)
 *
 * @module modules/work/wallet-submission
 */

import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { getPublicClient, getWalletClient, waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { queryClient } from "../../config/react-query";
import { queryKeys } from "../../hooks/query-keys";
import type { EASWork, EASWorkApproval } from "../../types/eas-responses";
import { ANALYTICS_EVENTS, trackWalletSubmissionTiming } from "../../modules/app/analytics-events";
import { track } from "../../modules/app/posthog";
import { EASABI } from "../../utils/blockchain/contracts";
import { pollQueriesAfterTransaction } from "../../utils/blockchain/polling";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData, simulateWorkData } from "../../utils/eas/encoders";
import { buildApprovalAttestTx, buildWorkAttestTx } from "../../utils/eas/transaction-builder";
import { parseContractError } from "../../utils/errors/contract-errors";
import { formatWalletError } from "../../utils/errors/user-messages";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress stages for wallet submission
 */
export type WalletSubmissionStage =
  | "validating"
  | "uploading"
  | "confirming"
  | "syncing"
  | "complete";

/**
 * Progress callback for real-time submission updates
 */
export type OnProgressCallback = (stage: WalletSubmissionStage, message: string) => void;

/**
 * Options for wallet submission
 */
export interface WalletSubmissionOptions {
  /** Callback for progress updates */
  onProgress?: OnProgressCallback;
  /** Transaction timeout in milliseconds (default: 60000) */
  txTimeout?: number;
}

// ============================================================================
// SIMULATION CACHE
// ============================================================================

interface SimulationCacheEntry {
  success: boolean;
  timestamp: number;
  hash: string;
}

const SIMULATION_CACHE_TTL = 60_000; // 60 seconds
const simulationCache = new Map<string, SimulationCacheEntry>();

/**
 * Generate a cache key for simulation results
 */
function getSimulationCacheKey(gardenAddress: string, actionUID: number, account: string): string {
  return `${gardenAddress}-${actionUID}-${account}`;
}

/**
 * Check if a cached simulation result is valid
 */
function getCachedSimulation(key: string): SimulationCacheEntry | null {
  const cached = simulationCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > SIMULATION_CACHE_TTL) {
    simulationCache.delete(key);
    return null;
  }

  return cached;
}

/**
 * Cache a successful simulation result
 */
function cacheSimulation(key: string): void {
  simulationCache.set(key, {
    success: true,
    timestamp: Date.now(),
    hash: key,
  });
}

// ============================================================================
// TRANSACTION TIMEOUT UTILITY
// ============================================================================

/**
 * Wait for transaction receipt with timeout
 * @throws Error if timeout is reached
 */
async function waitForReceiptWithTimeout(
  hash: `0x${string}`,
  chainId: number,
  timeoutMs: number = 60_000
): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
        )
      );
    }, timeoutMs);
  });

  const receiptPromise = waitForTransactionReceipt(wagmiConfig, { hash, chainId });

  await Promise.race([receiptPromise, timeoutPromise]);
}

/**
 * Submit work directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Simulate contract (check cache first)
 * 3. Encode work data (uploads media to IPFS)
 * 4. Prepare EAS attestation transaction
 * 5. Send transaction via wallet
 * 6. Wait for transaction receipt (with timeout)
 * 7. Optimistically update cache
 * 8. Poll for indexer updates (smart polling with early exit)
 *
 * @param draft - Work form data
 * @param gardenAddress - Target garden address
 * @param actionUID - Action type identifier
 * @param actionTitle - Action title for metadata
 * @param chainId - Target chain ID
 * @param images - Work media files
 * @param options - Optional configuration (progress callback, timeout)
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitWorkDirectly(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[],
  options: WalletSubmissionOptions = {}
): Promise<`0x${string}`> {
  const { onProgress, txTimeout = 60_000 } = options;
  const startTime = Date.now();

  debugLog("[WalletSubmission] Starting direct work submission", { gardenAddress, actionUID });
  onProgress?.("validating", "Checking garden membership...");

  // 1. Get wallet client from wagmi
  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    const message = "[WalletSubmission] Wallet client not available";
    if (DEBUG_ENABLED) {
      debugError(message);
    } else {
      console.error(message);
    }
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  // 2. Simulate contract interaction (check cache first)
  const publicClient = getPublicClient(wagmiConfig, { chainId });
  const cacheKey = getSimulationCacheKey(
    gardenAddress,
    actionUID,
    walletClient.account?.address || ""
  );
  const cachedSim = getCachedSimulation(cacheKey);

  if (cachedSim) {
    debugLog("[WalletSubmission] Using cached simulation result");
  } else if (publicClient) {
    try {
      debugLog("[WalletSubmission] Simulating transaction before upload...");
      const easConfig = getEASConfig(chainId);

      // Prepare simulation data (dummy CIDs)
      const simulationData = simulateWorkData(
        {
          ...draft,
          title: `${actionTitle} - ${new Date().toISOString()}`,
          actionUID,
          media: images,
        },
        chainId
      );

      // Simulate the attest call
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
        account: walletClient.account,
      });

      // Cache successful simulation
      cacheSimulation(cacheKey);
      debugLog("[WalletSubmission] Simulation successful - cached for 60s");
    } catch (err: unknown) {
      debugError("[WalletSubmission] Simulation failed", err);

      const parsed = parseContractError(err);
      if (parsed.isKnown) {
        // Include error name so the UI provider can recognize it as a known error
        throw new Error(
          `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`
        );
      }

      // Check for common simulation failures and provide specific messages
      const errObj = err as { message?: string; cause?: { reason?: string } };
      const errMessage = errObj.message?.toLowerCase() || "";

      // Not a member of the garden (neither gardener nor operator)
      if (
        errMessage.includes("notgardener") ||
        errMessage.includes("not a gardener") ||
        errMessage.includes("notgardenmember") ||
        errMessage.includes("not a member")
      ) {
        throw new Error(
          "You're not a member of this garden. Please join the garden first from your profile."
        );
      }

      // Reverted without reason (common for access control)
      if (errMessage.includes("reverted") && !errObj.cause?.reason) {
        throw new Error(
          "Transaction would fail. Make sure you're a member of the selected garden."
        );
      }

      // Fallback to cause reason if available
      if (errObj.cause?.reason) {
        throw new Error(`Transaction check failed: ${errObj.cause.reason}`);
      }

      throw new Error(
        `Transaction check failed: ${parsed.message || errObj.message || "Please verify you're a member of the selected garden."}`
      );
    }
  }

  try {
    // 3. Encode work data (uploads to IPFS internally)
    onProgress?.("uploading", "Uploading media to IPFS...");
    debugLog("[WalletSubmission] Encoding work data and uploading to IPFS");

    const workTitle = `${actionTitle} - ${new Date().toISOString()}`;
    const attestationData = await encodeWorkData(
      {
        ...draft,
        title: workTitle,
        actionUID,
        media: images,
      },
      chainId
    );

    // 4. Prepare EAS attestation transaction
    const easConfig = getEASConfig(chainId);
    const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

    onProgress?.("confirming", "Confirm in your wallet...");
    debugLog("[WalletSubmission] Sending transaction", { to: txParams.to });

    // 5. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Transaction sent", { hash });

    // 6. Wait for transaction receipt with timeout
    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Transaction confirmed", { hash });
    } catch (_timeoutErr) {
      // Transaction may still succeed, continue gracefully
      debugLog("[WalletSubmission] Transaction timeout, continuing...", { hash });
    }

    // 7. Optimistically update cache immediately
    const optimisticWork: EASWork = {
      id: `optimistic-${hash}`,
      gardenerAddress: walletClient.account?.address || "",
      gardenAddress,
      actionUID,
      title: workTitle,
      feedback: draft.feedback || "",
      metadata: JSON.stringify({
        plantSelection: draft.plantSelection,
        plantCount: draft.plantCount,
      }),
      media: [], // Media URLs will be populated by indexer
      createdAt: Math.floor(Date.now() / 1000),
    };

    // Add optimistic work to cache
    queryClient.setQueryData<EASWork[]>(queryKeys.works.online(gardenAddress, chainId), (old) => [
      optimisticWork,
      ...(old || []),
    ]);
    queryClient.setQueryData<EASWork[]>(queryKeys.works.merged(gardenAddress, chainId), (old) => [
      optimisticWork,
      ...(old || []),
    ]);

    // Also invalidate user-scoped work queries so dashboard updates immediately
    const userAddress = walletClient.account?.address;
    if (userAddress) {
      queryClient.invalidateQueries({
        queryKey: ["myWorks", userAddress],
        exact: false,
      });
    }

    onProgress?.("syncing", "Syncing with blockchain...");

    // 8. Poll for indexer updates (smart polling with early exit)
    await pollQueriesAfterTransaction({
      queryKeys: [
        queryKeys.works.online(gardenAddress, chainId),
        queryKeys.works.merged(gardenAddress, chainId),
      ],
      // Smart polling: faster intervals, shorter max time
      baseDelay: 1000,
      maxDelay: 4000,
      maxAttempts: 4,
      onAttempt: (attempt, delay) => {
        debugLog(`[WalletSubmission] Polling indexer (attempt ${attempt}, waited ${delay}ms)`);
      },
    });

    onProgress?.("complete", "Work submitted successfully!");

    // Track submission timing
    const totalTime = Date.now() - startTime;
    trackWalletSubmissionTiming({
      gardenAddress,
      actionUID,
      totalTimeMs: totalTime,
      imageCount: images.length,
    });

    debugLog("[WalletSubmission] Work submission complete with indexer sync", {
      hash,
      totalTimeMs: totalTime,
    });
    return hash;
  } catch (err: unknown) {
    const logMessage = "[WalletSubmission] Work submission failed";
    if (DEBUG_ENABLED) {
      debugError(logMessage, err);
    } else {
      console.error(logMessage, err);
    }

    // Use centralized error formatting
    throw new Error(formatWalletError(err));
  }
}

/**
 * Submit work approval directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode approval data
 * 3. Prepare EAS attestation transaction
 * 4. Send transaction via wallet
 * 5. Wait for transaction receipt (with timeout)
 * 6. Optimistically update cache
 * 7. Poll for indexer updates (smart polling)
 *
 * @param draft - Approval form data
 * @param gardenerAddress - Gardener receiving the approval
 * @param chainId - Target chain ID
 * @param options - Optional configuration (progress callback, timeout)
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitApprovalDirectly(
  draft: WorkApprovalDraft,
  gardenAddress: string,
  gardenerAddress: string,
  chainId: number,
  options: WalletSubmissionOptions = {}
): Promise<`0x${string}`> {
  const { onProgress, txTimeout = 60_000 } = options;
  const startTime = Date.now();

  debugLog("[WalletSubmission] Starting direct approval submission", {
    gardenAddress,
    gardenerAddress,
  });
  onProgress?.("validating", "Preparing approval...");

  // 1. Get wallet client from wagmi
  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    const message = "[WalletSubmission] Wallet client not available";
    if (DEBUG_ENABLED) {
      debugError(message);
    } else {
      console.error(message);
    }
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  try {
    // 2. Encode approval data
    debugLog("[WalletSubmission] Encoding approval data");
    const attestationData = encodeWorkApprovalData(draft, chainId);

    // 3. Prepare EAS attestation transaction
    const easConfig = getEASConfig(chainId);
    const txParams = buildApprovalAttestTx(
      easConfig,
      gardenAddress as `0x${string}`,
      attestationData
    );

    onProgress?.("confirming", "Confirm in your wallet...");
    debugLog("[WalletSubmission] Sending approval transaction", { to: txParams.to });

    // 4. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Approval transaction sent", { hash });

    // 5. Wait for transaction receipt with timeout
    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Approval transaction confirmed", { hash });
    } catch (timeoutErr) {
      // Transaction may still succeed, continue gracefully
      debugLog("[WalletSubmission] Approval timeout, continuing...", { hash });
    }

    // 6. Optimistically update cache
    const optimisticApproval: EASWorkApproval = {
      id: `optimistic-${hash}`,
      operatorAddress: walletClient.account?.address || "",
      gardenerAddress,
      actionUID: draft.actionUID,
      workUID: draft.workUID,
      approved: draft.approved,
      feedback: draft.feedback || "",
      createdAt: Math.floor(Date.now() / 1000),
    };

    queryClient.setQueryData<EASWorkApproval[]>(queryKeys.workApprovals.all, (old) => [
      optimisticApproval,
      ...(old || []),
    ]);

    onProgress?.("syncing", "Syncing with blockchain...");

    // 7. Poll for indexer updates (smart polling)
    await pollQueriesAfterTransaction({
      queryKeys: [
        queryKeys.workApprovals.all,
        // Invalidate works to update approval status
        queryKeys.works.all,
      ],
      // Smart polling: faster intervals, shorter max time
      baseDelay: 1000,
      maxDelay: 4000,
      maxAttempts: 4,
      onAttempt: (attempt, delay) => {
        debugLog(
          `[WalletSubmission] Polling indexer for approval (attempt ${attempt}, waited ${delay}ms)`
        );
      },
    });

    onProgress?.("complete", "Approval submitted successfully!");

    // Track submission timing
    const totalTime = Date.now() - startTime;
    track(ANALYTICS_EVENTS.WORK_APPROVAL_SUCCESS, {
      work_uid: draft.workUID,
      garden_address: gardenAddress,
      tx_hash: hash,
      auth_mode: "wallet",
      total_time_ms: totalTime,
    });

    debugLog("[WalletSubmission] Approval submission complete with indexer sync", {
      hash,
      totalTimeMs: totalTime,
    });
    return hash;
  } catch (err: unknown) {
    const logMessage = "[WalletSubmission] Approval submission failed";
    if (DEBUG_ENABLED) {
      debugError(logMessage, err);
    } else {
      console.error(logMessage, err);
    }

    // Use centralized error formatting
    throw new Error(formatWalletError(err));
  }
}
