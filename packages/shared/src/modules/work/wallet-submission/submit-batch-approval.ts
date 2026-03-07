import type { Address } from "viem";
import { getWalletClient } from "@wagmi/core";
import type { WorkApprovalDraft } from "../../../types/domain";
import type { EASWorkApproval } from "../../../types/eas-responses";
import { wagmiConfig } from "../../../config/appkit";
import { getEASConfig } from "../../../config/blockchain";
import { queryClient } from "../../../config/react-query";
import { queryKeys } from "../../../hooks/query-keys";
import { ANALYTICS_EVENTS } from "../../../modules/app/analytics-events";
import { track } from "../../../modules/app/posthog";
import { logger } from "../../app/logger";
import { DEBUG_ENABLED, debugError, debugLog } from "../../../utils/debug";
import { encodeWorkApprovalData } from "../../../utils/eas/encoders";
import { buildBatchApprovalAttestTx } from "../../../utils/eas/transaction-builder";
import { formatWalletError } from "../../../utils/errors/user-messages";
import {
  pollQueriesAfterTransaction,
  TX_RECEIPT_TIMEOUT_MS,
} from "../../../utils/blockchain/polling";
import type { BatchApprovalOptions } from "./types";
import { waitForReceiptWithTimeout } from "./receipt";

export async function submitBatchApprovalsDirectly(
  approvals: Array<{
    draft: WorkApprovalDraft;
    gardenAddress: Address;
    gardenerAddress: Address;
  }>,
  chainId: number,
  options: BatchApprovalOptions = {}
): Promise<`0x${string}`> {
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

  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient) {
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  const operatorAddress = walletClient.account?.address;
  if (!operatorAddress) {
    throw new Error("Wallet account address not available");
  }

  try {
    const encodedApprovals = approvals.map(({ draft, gardenAddress }) => ({
      gardenAddress: gardenAddress as `0x${string}`,
      attestationData: encodeWorkApprovalData(draft, chainId),
    }));

    const easConfig = getEASConfig(chainId);
    const txParams = buildBatchApprovalAttestTx(easConfig, encodedApprovals);

    onProgress?.("confirming", `Confirm ${approvals.length} approvals in your wallet...`);
    debugLog("[WalletSubmission] Sending batch approval transaction", {
      to: txParams.to,
      count: approvals.length,
    });

    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Batch approval transaction sent", { hash });

    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Batch approval confirmed", { hash });
    } catch {
      debugLog("[WalletSubmission] Batch approval timeout, continuing...", { hash });
    }

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

    queryClient.setQueryData<EASWorkApproval[]>(queryKeys.workApprovals.all, (old) => [
      ...optimisticApprovals,
      ...(old || []),
    ]);

    onProgress?.("syncing", "Syncing with blockchain...");

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
