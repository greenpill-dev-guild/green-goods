import type { Address } from "viem";
import { getWalletClient } from "@wagmi/core";
import type { WorkApprovalDraft } from "../../../types/domain";
import type { EASWorkApproval } from "../../../types/eas-responses";
import { getWagmiConfig } from "../../../config/appkit";
import { getEASConfig } from "../../../config/blockchain";
import { getChain } from "../../../config/chains";
import { queryClient } from "../../../config/react-query";
import { workApprovalsKeys } from "../../../config/query-keys/work";
import { ensureWagmiWalletChain } from "../../../modules/transactions/chain-guard";
import { assertLocalArbitrumForkWallet } from "../../../modules/transactions/local-fork-safety";
import { logger } from "../../app/logger";
import { DEBUG_ENABLED, debugError, debugLog } from "../../../utils/debug";
import { encodeWorkApprovalData } from "../../../utils/eas/encoders";
import { buildApprovalAttestTx } from "../../../utils/eas/transaction-builder";
import { extractErrorMessage } from "../../../utils/errors/extract-message";
import { simulateApprovalSubmission } from "../simulate";
import type { ApprovalSubmissionOptions } from "./types";
import { TransactionReceiptTimeoutError, waitForReceiptWithTimeout } from "./receipt";

export async function submitApprovalDirectly(
  draft: WorkApprovalDraft,
  gardenAddress: Address,
  gardenerAddress: Address,
  chainId: number,
  options: ApprovalSubmissionOptions = {}
): Promise<{ hash: `0x${string}`; confirmed: boolean }> {
  const { onLifecycle, onProgress, txTimeout = 60_000 } = options;
  const startTime = Date.now();

  debugLog("[WalletSubmission] Starting direct approval submission", {
    gardenAddress,
    gardenerAddress,
  });
  onProgress?.("validating", "Preparing approval...");

  const wagmiConfig = getWagmiConfig();
  await ensureWagmiWalletChain(wagmiConfig, chainId);
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
    onLifecycle?.({ stage: "handoff" });
    debugLog("[WalletSubmission] Sending approval transaction", { to: txParams.to });
    await assertLocalArbitrumForkWallet();

    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: getChain(chainId),
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Approval transaction sent", { hash });
    onLifecycle?.({ stage: "broadcast", txHash: hash });

    let confirmed = false;
    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      confirmed = true;
      onLifecycle?.({ stage: "confirmed", txHash: hash });
      debugLog("[WalletSubmission] Approval transaction confirmed", { hash });
    } catch (err: unknown) {
      if (!(err instanceof TransactionReceiptTimeoutError)) {
        throw err;
      }
      onLifecycle?.({ stage: "broadcast", txHash: hash, reason: "receipt-timeout" });
      debugLog("[WalletSubmission] Approval timeout, continuing...", { hash });
    }

    const optimisticApproval: EASWorkApproval = {
      id: `optimistic-${hash}`,
      stewardAddress: walletClient.account?.address || "",
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

    queryClient.setQueryData<EASWorkApproval[]>(workApprovalsKeys.all, (old) => [
      optimisticApproval,
      ...(old || []),
    ]);

    if (confirmed) onProgress?.("complete", "Approval submitted successfully!");

    const totalTime = Date.now() - startTime;
    debugLog("[WalletSubmission] Approval submission returned to the application", {
      hash,
      totalTimeMs: totalTime,
    });
    return { hash, confirmed };
  } catch (err: unknown) {
    const logMessage = "[WalletSubmission] Approval submission failed";
    if (DEBUG_ENABLED) {
      debugError(logMessage, err);
    } else {
      logger.error(logMessage, { error: err });
    }

    // Re-throw preserving the original error so downstream parseContractError
    // sees the canonical message. `Error.cause` keeps the original for tracking.
    const wrapped = new Error(extractErrorMessage(err));
    if (err instanceof Error) {
      (wrapped as Error & { cause?: unknown }).cause = err;
    }
    throw wrapped;
  }
}
