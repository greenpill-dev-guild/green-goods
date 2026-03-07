import type { Address } from "viem";
import { getWalletClient } from "@wagmi/core";
import type { WorkDraft } from "../../../types/domain";
import type { EASWork } from "../../../types/eas-responses";
import { wagmiConfig } from "../../../config/appkit";
import { getEASConfig } from "../../../config/blockchain";
import { queryClient } from "../../../config/react-query";
import { queryKeys } from "../../../hooks/query-keys";
import { trackWalletSubmissionTiming } from "../../../modules/app/analytics-events";
import { logger } from "../../app/logger";
import { DEBUG_ENABLED, debugError, debugLog } from "../../../utils/debug";
import { encodeWorkData } from "../../../utils/eas/encoders";
import { buildWorkAttestTx } from "../../../utils/eas/transaction-builder";
import { formatWalletError } from "../../../utils/errors/user-messages";
import {
  pollQueriesAfterTransaction,
  TX_RECEIPT_TIMEOUT_MS,
} from "../../../utils/blockchain/polling";
import { simulateWorkSubmission } from "../simulate";
import type { WalletSubmissionOptions } from "./types";
import { waitForReceiptWithTimeout } from "./receipt";

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

    const easConfig = getEASConfig(chainId);
    const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

    onProgress?.("confirming", "Confirm in your wallet...");
    debugLog("[WalletSubmission] Sending transaction", { to: txParams.to });

    const hash = await walletClient.sendTransaction({
      ...txParams,
      chain: walletClient.chain,
      account: walletClient.account,
    });

    debugLog("[WalletSubmission] Transaction sent", { hash });

    try {
      await waitForReceiptWithTimeout(hash, chainId, txTimeout);
      debugLog("[WalletSubmission] Transaction confirmed", { hash });
    } catch {
      debugLog("[WalletSubmission] Transaction timeout, continuing...", { hash });
    }

    const optimisticWork: EASWork = {
      id: `optimistic-${hash}`,
      gardenerAddress: walletClient.account?.address || "",
      gardenAddress,
      actionUID,
      title: workTitle,
      feedback: draft.feedback || "",
      metadata: "{}",
      media: [],
      createdAt: Math.floor(Date.now() / 1000),
    };

    queryClient.setQueryData<EASWork[]>(queryKeys.works.online(gardenAddress, chainId), (old) => [
      optimisticWork,
      ...(old || []),
    ]);
    queryClient.setQueryData<EASWork[]>(queryKeys.works.merged(gardenAddress, chainId), (old) => [
      optimisticWork,
      ...(old || []),
    ]);

    const userAddress = walletClient.account?.address;
    if (userAddress) {
      queryClient.invalidateQueries({
        queryKey: ["myWorks", userAddress],
        exact: false,
      });
    }

    onProgress?.("syncing", "Syncing with blockchain...");

    await pollQueriesAfterTransaction({
      queryKeys: [
        queryKeys.works.online(gardenAddress, chainId),
        queryKeys.works.merged(gardenAddress, chainId),
      ],
      baseDelay: 1000,
      maxDelay: 4000,
      maxAttempts: 4,
      onAttempt: (attempt, delay) => {
        debugLog(`[WalletSubmission] Polling indexer (attempt ${attempt}, waited ${delay}ms)`);
      },
    });

    onProgress?.("complete", "Work submitted successfully!");

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

    throw new Error(formatWalletError(err));
  }
}
