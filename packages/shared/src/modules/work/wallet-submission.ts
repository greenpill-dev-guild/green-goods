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
import { queryKeys } from "../../hooks/query-keys";
import { EASABI } from "../../utils/blockchain/contracts";
import { pollQueriesAfterTransaction } from "../../utils/blockchain/polling";
import { DEBUG_ENABLED, debugError, debugLog, debugWarn } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData, simulateWorkData } from "../../utils/eas/encoders";
import { getBlockExplorerTxUrl } from "../../utils/eas/explorers";
import { buildApprovalAttestTx, buildWorkAttestTx } from "../../utils/eas/transaction-builder";
import { parseContractError } from "../../utils/errors/contract-errors";
import { formatWalletError } from "../../utils/errors/user-messages";

/** Default timeout for transaction receipt confirmation (60 seconds) */
const RECEIPT_TIMEOUT_MS = 60_000;

/**
 * Wait for transaction receipt with timeout
 *
 * Wraps waitForTransactionReceipt with a timeout to prevent indefinite hanging
 * (especially on iOS WalletConnect where the bridge can be unreliable).
 *
 * @param hash - Transaction hash
 * @param chainId - Chain ID
 * @param timeoutMs - Timeout in milliseconds (default: 60s)
 * @returns Receipt if confirmed within timeout, null if timed out
 */
async function waitForReceiptWithTimeout(
  hash: `0x${string}`,
  chainId: number,
  timeoutMs: number = RECEIPT_TIMEOUT_MS
): Promise<{ confirmed: boolean; timedOut: boolean }> {
  try {
    const receipt = await Promise.race([
      waitForTransactionReceipt(wagmiConfig, { hash, chainId }).then(() => ({ confirmed: true })),
      new Promise<{ timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), timeoutMs)
      ),
    ]);

    if ("timedOut" in receipt) {
      debugWarn("[WalletSubmission] Receipt wait timed out", { hash, timeoutMs });
      return { confirmed: false, timedOut: true };
    }

    return { confirmed: true, timedOut: false };
  } catch (err) {
    // Receipt fetch failed but tx may still be pending/confirmed
    debugWarn("[WalletSubmission] Receipt wait error (tx may still succeed)", { hash, err });
    return { confirmed: false, timedOut: false };
  }
}

/**
 * Submission result with explorer link support
 */
export interface WalletSubmissionResult {
  /** Transaction hash */
  hash: `0x${string}`;
  /** Whether transaction was confirmed */
  confirmed: boolean;
  /** Whether we timed out waiting for confirmation */
  timedOut: boolean;
  /** Block explorer URL for the transaction */
  explorerUrl: string;
}

/**
 * Submit work directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode work data (uploads media to IPFS)
 * 3. Prepare EAS attestation transaction
 * 4. Send transaction via wallet
 * 5. Wait for transaction receipt (with timeout to prevent indefinite hanging)
 * 6. Return result with explorer link
 *
 * @param draft - Work form data
 * @param gardenAddress - Target garden address
 * @param actionUID - Action type identifier
 * @param actionTitle - Action title for metadata
 * @param chainId - Target chain ID
 * @param images - Work media files
 * @returns Submission result with hash, confirmation status, and explorer URL
 * @throws Error if wallet not connected or transaction send fails
 */
export async function submitWorkDirectly(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[]
): Promise<WalletSubmissionResult> {
  debugLog("[WalletSubmission] Starting direct work submission", { gardenAddress, actionUID });

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

  // 1.5. Simulate contract interaction before uploading
  const publicClient = getPublicClient(wagmiConfig, { chainId });
  if (publicClient) {
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
      debugLog("[WalletSubmission] Simulation successful - proceeding to upload");
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
      const errMessage = (err as Error).message?.toLowerCase() || "";

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
      if (
        errMessage.includes("reverted") &&
        !(err as Error & { cause?: { reason?: string } }).cause?.reason
      ) {
        throw new Error(
          "Transaction would fail. Make sure you're a member of the selected garden."
        );
      }

      // Fallback to cause reason if available
      const causeReason = (err as Error & { cause?: { reason?: string } }).cause?.reason;
      if (causeReason) {
        throw new Error(`Transaction check failed: ${causeReason}`);
      }

      throw new Error(
        `Transaction check failed: ${parsed.message || (err as Error).message || "Please verify you're a member of the selected garden."}`
      );
    }
  }

  try {
    // 2. Encode work data (uploads to IPFS internally)
    debugLog("[WalletSubmission] Encoding work data and uploading to IPFS");
    const attestationData = await encodeWorkData(
      {
        ...draft,
        title: `${actionTitle} - ${new Date().toISOString()}`,
        actionUID,
        media: images,
      },
      chainId
    );

    // 3. Prepare EAS attestation transaction
    const easConfig = getEASConfig(chainId);
    const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

    debugLog("[WalletSubmission] Sending transaction", { to: txParams.to });

    // 4. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Transaction sent", { hash });

    // Build explorer URL immediately so we can return it even if receipt times out
    const explorerUrl = getBlockExplorerTxUrl(chainId, hash);

    // 5. Wait for transaction receipt with timeout (don't block indefinitely)
    const receiptResult = await waitForReceiptWithTimeout(hash, chainId);

    if (receiptResult.confirmed) {
      debugLog("[WalletSubmission] Transaction confirmed", { hash });
    } else if (receiptResult.timedOut) {
      debugLog("[WalletSubmission] Confirmation timed out, tx may still succeed", {
        hash,
        explorerUrl,
      });
    }

    // 6. Poll for indexer updates in background (don't block on this)
    // Only poll if we got confirmation - otherwise user can check explorer
    if (receiptResult.confirmed) {
      pollQueriesAfterTransaction({
        queryKeys: [
          queryKeys.works.online(gardenAddress, chainId),
          queryKeys.works.merged(gardenAddress, chainId),
        ],
        onAttempt: (attempt, delay) => {
          debugLog(`[WalletSubmission] Polling indexer (attempt ${attempt}, waited ${delay}ms)`);
        },
      }).catch((err) => {
        // Non-critical: indexer polling failed but tx is confirmed
        debugWarn("[WalletSubmission] Indexer polling failed after work submission", { hash, err });
      });
    }

    debugLog("[WalletSubmission] Work submission complete", {
      hash,
      confirmed: receiptResult.confirmed,
      timedOut: receiptResult.timedOut,
    });

    return {
      hash,
      confirmed: receiptResult.confirmed,
      timedOut: receiptResult.timedOut,
      explorerUrl,
    };
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
 * 5. Wait for transaction receipt (with timeout to prevent indefinite hanging)
 * 6. Return result with explorer link
 *
 * @param draft - Approval form data
 * @param gardenAddress - Garden address (EAS attestation recipient - must match work recipient)
 * @param chainId - Target chain ID
 * @returns Submission result with hash, confirmation status, and explorer URL
 * @throws Error if wallet not connected or transaction send fails
 */
export async function submitApprovalDirectly(
  draft: WorkApprovalDraft,
  gardenAddress: string,
  chainId: number
): Promise<WalletSubmissionResult> {
  debugLog("[WalletSubmission] Starting direct approval submission", { gardenAddress });

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

    debugLog("[WalletSubmission] Sending approval transaction", { to: txParams.to });

    // 4. Send transaction directly via wallet
    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Approval transaction sent", { hash });

    // Build explorer URL immediately so we can return it even if receipt times out
    const explorerUrl = getBlockExplorerTxUrl(chainId, hash);

    // 5. Wait for transaction receipt with timeout (don't block indefinitely)
    const receiptResult = await waitForReceiptWithTimeout(hash, chainId);

    if (receiptResult.confirmed) {
      debugLog("[WalletSubmission] Approval transaction confirmed", { hash });
    } else if (receiptResult.timedOut) {
      debugLog("[WalletSubmission] Approval confirmation timed out, tx may still succeed", {
        hash,
        explorerUrl,
      });
    }

    // 6. Poll for indexer updates in background (don't block on this)
    // Only poll if we got confirmation - otherwise user can check explorer
    if (receiptResult.confirmed) {
      pollQueriesAfterTransaction({
        queryKeys: [queryKeys.workApprovals.all, queryKeys.works.all],
        onAttempt: (attempt, delay) => {
          debugLog(
            `[WalletSubmission] Polling indexer for approval (attempt ${attempt}, waited ${delay}ms)`
          );
        },
      }).catch((err) => {
        // Non-critical: indexer polling failed but tx is confirmed
        debugWarn("[WalletSubmission] Indexer polling failed after approval", { hash, err });
      });
    }

    debugLog("[WalletSubmission] Approval submission complete", {
      hash,
      confirmed: receiptResult.confirmed,
      timedOut: receiptResult.timedOut,
    });

    return {
      hash,
      confirmed: receiptResult.confirmed,
      timedOut: receiptResult.timedOut,
      explorerUrl,
    };
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
