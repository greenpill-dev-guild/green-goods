import type { Address } from "viem";
import { getWalletClient } from "@wagmi/core";
import type { WorkApprovalDraft } from "../../../types/domain";
import type { EASWorkApproval } from "../../../types/eas-responses";
import { getWagmiConfig } from "../../../config/appkit";
import { getEASConfig } from "../../../config/blockchain";
import { queryClient } from "../../../config/react-query";
import { queryKeys } from "../../../hooks/query-keys";
import { ANALYTICS_EVENTS } from "../../../modules/app/analytics-events";
import { track } from "../../../modules/app/posthog";
import { logger } from "../../app/logger";
import { DEBUG_ENABLED, debugError, debugLog } from "../../../utils/debug";
import { encodeWorkApprovalData } from "../../../utils/eas/encoders";
import { buildApprovalAttestTx } from "../../../utils/eas/transaction-builder";
import { formatWalletError } from "../../../utils/errors/user-messages";
import { pollQueriesAfterTransaction } from "../../../utils/blockchain/polling";
import { simulateApprovalSubmission } from "../simulate";
import type { WalletSubmissionOptions } from "./types";
import { waitForReceiptWithTimeout } from "./receipt";

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

  const walletClient = await getWalletClient(getWagmiConfig(), { chainId });
  if (!walletClient) {
    const message = "[WalletSubmission] Wallet client not available";
    if (DEBUG_ENABLED) {
      debugError(message);
    } else {
      logger.error(message);
    }
    throw new Error("Wallet not connected. Please connect your wallet and try again.");
  }

  if (walletClient.account?.address) {
    try {
      debugLog("[WalletSubmission] Simulating approval before wallet confirmation...");
      await simulateApprovalSubmission({
        draft,
        gardenAddress,
        chainId,
        accountAddress: walletClient.account.address as `0x${string}`,
      });
    } catch (err: unknown) {
      debugError("[WalletSubmission] Approval simulation failed", err);
      throw err;
    }
  }

  try {
    debugLog("[WalletSubmission] Encoding approval data");
    const attestationData = encodeWorkApprovalData(draft, chainId);

    const easConfig = getEASConfig(chainId);
    const txParams = buildApprovalAttestTx(
      easConfig,
      gardenAddress as `0x${string}`,
      attestationData
    );

    onProgress?.("confirming", "Confirm in your wallet...");
    debugLog("[WalletSubmission] Sending approval transaction", { to: txParams.to });

    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Approval transaction sent", { hash });

    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Approval transaction confirmed", { hash });
    } catch {
      debugLog("[WalletSubmission] Approval timeout, continuing...", { hash });
    }

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

    await pollQueriesAfterTransaction({
      queryKeys: [queryKeys.workApprovals.all, queryKeys.works.all],
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

    throw new Error(formatWalletError(err));
  }
}
