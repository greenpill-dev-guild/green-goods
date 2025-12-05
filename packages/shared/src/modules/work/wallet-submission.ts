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
import { encodeFunctionData } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { queryKeys } from "../../hooks/query-keys";
import { EASABI } from "../../utils/blockchain/contracts";
import { pollQueriesAfterTransaction } from "../../utils/blockchain/polling";
import { DEBUG_ENABLED, debugError, debugLog } from "../../utils/debug";
import { encodeWorkApprovalData, encodeWorkData, simulateWorkData } from "../../utils/eas/encoders";
import { buildApprovalAttestTx, buildWorkAttestTx } from "../../utils/eas/transaction-builder";
import { parseContractError } from "../../utils/errors/contract-errors";
import { formatWalletError } from "../../utils/errors/user-messages";

/**
 * Submit work directly using wallet client (no job queue)
 *
 * Process:
 * 1. Get wallet client from wagmi
 * 2. Encode work data (uploads media to IPFS)
 * 3. Prepare EAS attestation transaction
 * 4. Send transaction via wallet
 * 5. Wait for transaction receipt
 *
 * @param draft - Work form data
 * @param gardenAddress - Target garden address
 * @param actionUID - Action type identifier
 * @param actionTitle - Action title for metadata
 * @param chainId - Target chain ID
 * @param images - Work media files
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitWorkDirectly(
  draft: WorkDraft,
  gardenAddress: string,
  actionUID: number,
  actionTitle: string,
  chainId: number,
  images: File[]
): Promise<`0x${string}`> {
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
    } catch (err: any) {
      debugError("[WalletSubmission] Simulation failed", err);

      const parsed = parseContractError(err);
      if (parsed.isKnown) {
        // Include error name so the UI provider can recognize it as a known error
        throw new Error(
          `[${parsed.name}] ${parsed.message}${parsed.action ? ` ${parsed.action}` : ""}`
        );
      }

      // Check for common simulation failures and provide specific messages
      const errMessage = err.message?.toLowerCase() || "";

      // Not a gardener in the garden
      if (errMessage.includes("notgardener") || errMessage.includes("not a gardener")) {
        throw new Error(
          "You're not a member of this garden. Please join the garden first from your profile."
        );
      }

      // Reverted without reason (common for access control)
      if (errMessage.includes("reverted") && !err.cause?.reason) {
        throw new Error(
          "Transaction would fail. Make sure you're a member of the selected garden."
        );
      }

      // Fallback to cause reason if available
      if (err.cause?.reason) {
        throw new Error(`Transaction check failed: ${err.cause.reason}`);
      }

      throw new Error(
        `Transaction check failed: ${parsed.message || err.message || "Please verify you're a member of the selected garden."}`
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

    // 5. Wait for transaction receipt
    await waitForTransactionReceipt(wagmiConfig, { hash, chainId });

    debugLog("[WalletSubmission] Transaction confirmed", { hash });

    // 6. Poll for indexer updates (account for 2-6s indexer lag)
    await pollQueriesAfterTransaction({
      queryKeys: [
        queryKeys.works.online(gardenAddress, chainId),
        queryKeys.works.merged(gardenAddress, chainId),
      ],
      onAttempt: (attempt, delay) => {
        debugLog(`[WalletSubmission] Polling indexer (attempt ${attempt}, waited ${delay}ms)`);
      },
    });

    debugLog("[WalletSubmission] Work submission complete with indexer sync", { hash });
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
 * 5. Wait for transaction receipt
 *
 * @param draft - Approval form data
 * @param gardenerAddress - Gardener receiving the approval
 * @param chainId - Target chain ID
 * @returns Transaction hash
 * @throws Error if wallet not connected or transaction fails
 */
export async function submitApprovalDirectly(
  draft: WorkApprovalDraft,
  gardenerAddress: string,
  chainId: number
): Promise<`0x${string}`> {
  debugLog("[WalletSubmission] Starting direct approval submission", { gardenerAddress });

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
      gardenerAddress as `0x${string}`,
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

    // 5. Wait for transaction receipt
    await waitForTransactionReceipt(wagmiConfig, { hash, chainId });

    debugLog("[WalletSubmission] Approval transaction confirmed", { hash });

    // 6. Poll for indexer updates (account for 2-6s indexer lag)
    // Note: gardenerAddress is the recipient of the approval attestation
    await pollQueriesAfterTransaction({
      queryKeys: [
        queryKeys.workApprovals.all,
        // Invalidate works to update approval status
        queryKeys.works.all,
      ],
      onAttempt: (attempt, delay) => {
        debugLog(
          `[WalletSubmission] Polling indexer for approval (attempt ${attempt}, waited ${delay}ms)`
        );
      },
    });

    debugLog("[WalletSubmission] Approval submission complete with indexer sync", { hash });
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
