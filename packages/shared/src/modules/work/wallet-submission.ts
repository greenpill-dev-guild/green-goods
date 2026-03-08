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

import { getWalletClient, waitForTransactionReceipt } from "@wagmi/core";
import type { Address } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { queryClient } from "../../config/react-query";
import { queryKeys } from "../../hooks/query-keys";
import { ANALYTICS_EVENTS, trackWalletSubmissionTiming } from "../../modules/app/analytics-events";
import { track } from "../../modules/app/posthog";
import type { WorkApprovalDraft, WorkDraft } from "../../types/domain";
import type { EASWork, EASWorkApproval } from "../../types/eas-responses";
import { pollQueriesAfterTransaction, TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData } from "../../utils/eas/encoders";
import {
  buildApprovalAttestTx,
  buildBatchApprovalAttestTx,
  buildWorkAttestTx,
} from "../../utils/eas/transaction-builder";
import { formatWalletError } from "../../utils/errors/user-messages";
import { logger } from "../app/logger";
import { simulateWorkSubmission } from "./simulate";

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
  /** Transaction timeout in milliseconds (default: TX_RECEIPT_TIMEOUT_MS) */
  txTimeout?: number;
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
  timeoutMs: number = TX_RECEIPT_TIMEOUT_MS
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Transaction confirmation timeout after ${timeoutMs / 1000}s. The transaction may still be processing.`
        )
      );
    }, timeoutMs);
  });

  const receiptPromise = waitForTransactionReceipt(wagmiConfig, { hash, chainId });

  try {
    await Promise.race([receiptPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Submit work directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Simulate contract
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
  gardenAddress: Address,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[],
  options: WalletSubmissionOptions = {}
): Promise<`0x${string}`> {
  const { onProgress, txTimeout = TX_RECEIPT_TIMEOUT_MS } = options;
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
      logger.error(message);
    }
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  // 2. Simulate contract interaction (includes internal short-lived cache)
  if (walletClient.account?.address) {
    try {
      debugLog("[WalletSubmission] Simulating transaction before upload...");

      await simulateWorkSubmission({
        draft,
        gardenAddress,
        actionUID,
        actionTitle,
        chainId,
        images,
        accountAddress: walletClient.account.address as `0x${string}`,
      });
    } catch (err: unknown) {
      debugError("[WalletSubmission] Simulation failed", err);
      throw err;
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
      chainId,
      {
        gardenAddress,
        authMode: "wallet",
        onFileProgress: ({ completed, total }) => {
          if (total <= 0) return;
          const noun = total === 1 ? "photo" : "photos";
          onProgress?.("uploading", `Uploading ${completed}/${total} ${noun}...`);
        },
      }
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
    } catch {
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
      metadata: "{}",
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
      logger.error(logMessage, { error: err });
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
  gardenAddress: Address,
  gardenerAddress: Address,
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
      logger.error(message);
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
    } catch {
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
      confidence: 0,
      verificationMethod: 0,
      reviewNotesCID: "",
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
      logger.error(logMessage, { error: err });
    }

    // Use centralized error formatting
    throw new Error(formatWalletError(err));
  }
}

/**
 * Options for batch approval submission
 */
export interface BatchApprovalOptions {
  /** Callback for progress updates */
  onProgress?: OnProgressCallback;
  /** Transaction timeout in milliseconds (default: TX_RECEIPT_TIMEOUT_MS for batch) */
  txTimeout?: number;
}

/**
 * Submit multiple work approvals in a single transaction using EAS multiAttest.
 * Dramatically improves UX when operators approve/reject multiple works at once.
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode all approval data
 * 3. Build batch EAS multiAttest transaction
 * 4. Send single transaction via wallet
 * 5. Wait for transaction receipt
 * 6. Optimistically update cache for all works
 * 7. Poll for indexer updates
 *
 * @param approvals - Array of approval drafts with work metadata
 * @param chainId - Target chain ID
 * @param options - Optional configuration
 * @returns Transaction hash
 */
export async function submitBatchApprovalsDirectly(
  approvals: Array<{
    draft: WorkApprovalDraft;
    gardenAddress: Address;
    gardenerAddress: Address;
  }>,
  chainId: number,
  options: BatchApprovalOptions = {}
): Promise<`0x${string}`> {
  // Guard against empty approvals array
  if (approvals.length === 0) {
    const logMessage = "[WalletSubmission] Empty approvals array - rejecting";
    if (DEBUG_ENABLED) {
      debugError(logMessage);
    } else {
      logger.error(logMessage);
    }
    throw new Error("No approvals provided. At least one approval is required.");
  }

  const { onProgress, txTimeout = TX_RECEIPT_TIMEOUT_MS } = options;
  const startTime = Date.now();

  debugLog("[WalletSubmission] Starting batch approval submission", {
    count: approvals.length,
    chainId,
  });
  onProgress?.("validating", `Preparing ${approvals.length} approvals...`);

  // 1. Get wallet client and validate address upfront
  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  // Validate operator address before any transaction work
  const operatorAddress = walletClient.account?.address;
  if (!operatorAddress) {
    throw new Error("Wallet account address not available");
  }

  try {
    // 2. Encode all approvals
    const encodedApprovals = approvals.map(({ draft, gardenAddress }) => ({
      gardenAddress: gardenAddress as `0x${string}`,
      attestationData: encodeWorkApprovalData(draft, chainId),
    }));

    // 3. Build batch transaction
    const easConfig = getEASConfig(chainId);
    const txParams = buildBatchApprovalAttestTx(easConfig, encodedApprovals);

    onProgress?.("confirming", `Confirm ${approvals.length} approvals in your wallet...`);
    debugLog("[WalletSubmission] Sending batch approval transaction", {
      to: txParams.to,
      count: approvals.length,
    });

    // 4. Send transaction
    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Batch approval transaction sent", { hash });

    // 5. Wait for receipt
    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Batch approval confirmed", { hash });
    } catch {
      debugLog("[WalletSubmission] Batch approval timeout, continuing...", { hash });
    }

    // 6. Optimistically update cache for all works
    // (operatorAddress was validated at the start of the function)

    // Build all optimistic approvals first
    const optimisticApprovals = approvals.map(({ draft, gardenerAddress }) => ({
      id: `optimistic-batch-${hash}-${draft.workUID}`,
      operatorAddress,
      gardenerAddress,
      actionUID: draft.actionUID,
      workUID: draft.workUID,
      approved: draft.approved,
      feedback: draft.feedback || "",
      confidence: 0,
      verificationMethod: 0,
      reviewNotesCID: "",
      createdAt: Math.floor(Date.now() / 1000),
    }));

    // Single setQueryData call for better performance
    queryClient.setQueryData<EASWorkApproval[]>(queryKeys.workApprovals.all, (old) => [
      ...optimisticApprovals,
      ...(old || []),
    ]);

    onProgress?.("syncing", "Syncing with blockchain...");

    // 7. Poll for indexer updates - collect unique garden addresses
    const uniqueGardenAddresses = [...new Set(approvals.map((a) => a.gardenAddress))];
    const pollKeys = [
      queryKeys.workApprovals.all,
      queryKeys.works.all,
      ...uniqueGardenAddresses.flatMap((addr) => [
        queryKeys.works.online(addr, chainId),
        queryKeys.works.merged(addr, chainId),
      ]),
    ];

    await pollQueriesAfterTransaction({
      queryKeys: pollKeys,
      initialDelayMs: 0,
      baseDelay: 500,
      maxDelay: 4000,
      maxAttempts: 4,
    });

    onProgress?.("complete", `${approvals.length} approvals submitted!`);

    // Track success
    const totalTime = Date.now() - startTime;
    track(ANALYTICS_EVENTS.WORK_APPROVAL_SUCCESS, {
      batch_size: approvals.length,
      tx_hash: hash,
      auth_mode: "wallet",
      total_time_ms: totalTime,
      is_batch: true,
    });

    debugLog("[WalletSubmission] Batch approval complete", {
      hash,
      count: approvals.length,
      totalTimeMs: totalTime,
    });

    return hash;
  } catch (err: unknown) {
    const logMessage = "[WalletSubmission] Batch approval failed";
    if (DEBUG_ENABLED) {
      debugError(logMessage, err);
    } else {
      logger.error(logMessage, { error: err });
    }
    throw new Error(formatWalletError(err));
  }
}
