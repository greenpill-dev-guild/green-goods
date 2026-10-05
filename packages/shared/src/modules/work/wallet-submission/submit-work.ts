import {
  AwaitingWorkConfirmation,
  WorkTransactionReverted,
  reconcileWorkTransaction,
} from "../work-confirmation";
import { type Address, type Log, parseEventLogs } from "viem";
import { getAccount, getWalletClient } from "@wagmi/core";
import type { WorkDraft } from "../../../types/domain";
import type { EASWork } from "../../../types/eas-responses";
import { getWagmiConfig } from "../../../config/appkit";
import { getEASConfig } from "../../../config/blockchain";
import { getChain } from "../../../config/chains";
import { queryClient } from "../../../config/react-query";
import { worksKeys } from "../../../config/query-keys/work";
import { trackWalletSubmissionTiming } from "../../../modules/app/analytics-events";
import { ensureWagmiWalletChain } from "../../../modules/transactions/chain-guard";
import { assertLocalArbitrumForkWallet } from "../../../modules/transactions/local-fork-safety";
import type { WorkUploadCheckpoint } from "../../../types/work-media";
import { createSendChainReads, intentHead } from "../../job-queue/send-chain-reads";
import { logger } from "../../app/logger";
import { EASABI } from "../../../utils/blockchain/contracts";
import { DEBUG_ENABLED, debugError, debugLog } from "../../../utils/debug";
import { encodeWorkData } from "../../../utils/eas/encoders";
import { buildWorkAttestTx } from "../../../utils/eas/transaction-builder";
import { extractErrorMessage } from "../../../utils/errors/extract-message";
import { resolveWorkSubmissionTitle } from "../../../utils/work/workTitles";
import {
  pollQueriesAfterTransaction,
  TX_RECEIPT_TIMEOUT_MS,
} from "../../../utils/blockchain/polling";
import { simulateWorkSubmission } from "../simulate";
import { WorkSubmissionError, type WalletSubmissionOptions } from "./types";
import { TransactionRevertedError, waitForReceiptWithTimeout } from "./receipt";

/** The id of the work attestation a confirmed send made for this garden, read from its receipt. */
function attestedWorkUID(
  logs: Log[] | undefined,
  chainId: number,
  gardenAddress: Address
): string | undefined {
  const eas = getEASConfig(chainId);
  const attested = parseEventLogs({ abi: EASABI, eventName: "Attested", logs: logs ?? [] }).find(
    (log) => {
      const args = log.args as { recipient?: string; schemaUID?: string };
      return (
        log.address.toLowerCase() === eas.EAS.address.toLowerCase() &&
        args.schemaUID?.toLowerCase() === eas.WORK.uid.toLowerCase() &&
        args.recipient?.toLowerCase() === gardenAddress.toLowerCase()
      );
    }
  );
  return (attested?.args as { uid?: string } | undefined)?.uid?.toLowerCase();
}

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
  const uploadBatchId = crypto.randomUUID();
  if (options.checkpoint?.transactionHash) {
    const hash = options.checkpoint.transactionHash;
    const state = await reconcileWorkTransaction(hash, chainId);
    if (state === "confirmed") return hash;
    if (state === "reverted") throw new WorkTransactionReverted(hash);
    throw new AwaitingWorkConfirmation(hash);
  }

  debugLog("[WalletSubmission] Starting direct work submission", {
    gardenAddress,
    actionUID,
    uploadBatchId,
  });
  onProgress?.("validating", "Checking garden membership...");

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

  const originatingAccount = options.userAddress ?? walletClient.account?.address;
  /** Who signs, read without a wallet client, so it can be asked before the network is right. */
  const assertSigner = async () => {
    await options.assertOwnership?.();
    if (
      !originatingAccount ||
      getAccount(wagmiConfig).address?.toLowerCase() !== originatingAccount.toLowerCase()
    )
      throw new Error("submission-ownership-changed");
  };
  const assertOwnership = async () => {
    await options.assertOwnership?.();
    const current = await getWalletClient(wagmiConfig, { chainId });
    if (
      !originatingAccount ||
      current?.account?.address.toLowerCase() !== originatingAccount.toLowerCase() ||
      (current.chain?.id !== undefined && current.chain.id !== chainId)
    )
      throw new Error("submission-ownership-changed");
    return current;
  };
  await assertOwnership();
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

  // ── Phase 1: Upload media to IPFS ──────────────────────────────────
  onProgress?.("uploading", "Uploading media to IPFS...");
  debugLog("[WalletSubmission] Encoding work data and uploading to IPFS");

  const workTitle = resolveWorkSubmissionTitle({
    draftTitle: draft.title,
    actionTitle,
    actionUID,
  });
  let attestationData: `0x${string}`;
  try {
    attestationData = await encodeWorkData(
      {
        ...draft,
        title: workTitle,
        actionUID,
        media: images,
      },
      chainId,
      {
        clientWorkId: options.clientWorkId,
        checkpoint: options.checkpoint,
        onCheckpoint: options.onCheckpoint,
        gardenAddress,
        authMode: "wallet",
        uploadBatchId,
        onFileProgress: ({ completed, total }) => {
          if (total <= 0) return;
          const noun = total === 1 ? "photo" : "photos";
          onProgress?.("uploading", `Uploading ${completed}/${total} ${noun}...`);
        },
      }
    );
  } catch (err: unknown) {
    debugError("[WalletSubmission] Upload phase failed", err);
    // Preserve the original error via `cause`. Downstream (useWorkMutation.onError)
    // unwraps and classifies via parseContractError — wrapping with a pre-formatted
    // message here would be discarded.
    throw new WorkSubmissionError(extractErrorMessage(err), "upload", uploadBatchId, err);
  }

  // ── Phase 2: Build and send the transaction ────────────────────────
  onProgress?.("confirming", "Confirm in your wallet...");
  let hash: `0x${string}`;
  try {
    const easConfig = getEASConfig(chainId);
    const txParams = buildWorkAttestTx(easConfig, gardenAddress as `0x${string}`, attestationData);

    debugLog("[WalletSubmission] Sending transaction", { to: txParams.to });
    // The upload can run for minutes, long enough for the wallet to have moved
    // network or changed hands. Who signs comes first, and the guard asks again
    // right before it switches, so a wallet swapped in meanwhile is refused
    // before it is asked to change network. Checking the network again here,
    // before the send intent is recorded, switches it back instead of refusing
    // the send.
    await assertSigner();
    await ensureWagmiWalletChain(wagmiConfig, chainId, "write", assertSigner);
    await assertLocalArbitrumForkWallet();

    const currentWallet = await assertOwnership();
    // Kept with the intent, so a lost answer is timed on the chain's clock. A
    // head from an earlier try never stands in for one the chain cannot give now,
    // nor does a block an earlier recovery found it idle at.
    const head = await intentHead(createSendChainReads({ chainId }).readChainHead);
    const {
      intentBlock: _block,
      intentChainTime: _chainTime,
      idleBlock: _idleBlock,
      ...earlier
    }: Partial<WorkUploadCheckpoint> = draft.uploadCheckpoint ?? {};
    draft.uploadCheckpoint = {
      submittedAt: new Date().toISOString(),
      files: {},
      ...earlier,
      broadcastPending: true,
      broadcastPendingAt: new Date().toISOString(),
      ...head,
    };
    await options.onCheckpoint?.(draft.uploadCheckpoint);
    await options.assertOwnership?.();
    hash = await currentWallet.sendTransaction({
      ...txParams,
      chain: getChain(chainId),
      account: currentWallet.account,
    });

    draft.uploadCheckpoint = {
      ...draft.uploadCheckpoint,
      transactionHash: hash,
      broadcast: { kind: "transaction", hash },
      broadcastPending: false,
    };
    await options.onBroadcast?.(hash);
    debugLog("[WalletSubmission] Transaction sent", { hash });
  } catch (err: unknown) {
    debugError("[WalletSubmission] Transaction phase failed", err);
    throw new WorkSubmissionError(extractErrorMessage(err), "transaction", uploadBatchId, err);
  }

  // ── Phase 3: Receipt, cache, and sync ──────────────────────────────
  // Timing out is non-critical — the transaction may still land, and the
  // optimistic cache below covers the gap. A revert is not: the attestation
  // never happened, so surfacing it beats showing the gardener a submission
  // that silently went nowhere.
  let receipt: Awaited<ReturnType<typeof waitForReceiptWithTimeout>>;
  try {
    receipt = await waitForReceiptWithTimeout(hash, chainId, txTimeout);
    debugLog("[WalletSubmission] Transaction confirmed", { hash });
  } catch (err: unknown) {
    if (err instanceof TransactionRevertedError) throw new WorkTransactionReverted(hash);
    throw new AwaitingWorkConfirmation(hash);
  }

  // The row shown until the indexer has the work carries the attestation's own
  // id, so the indexed work replaces it. Under any other id the two would stay
  // listed side by side. A receipt that names no such attestation adds no row,
  // and the work appears once it is indexed.
  const workUID = attestedWorkUID(receipt.logs, chainId, gardenAddress);
  const sentWork: EASWork | undefined = workUID
    ? {
        id: workUID,
        gardenerAddress: walletClient.account?.address || "",
        gardenAddress,
        actionUID,
        title: workTitle,
        feedback: draft.feedback || "",
        metadata: JSON.stringify({ clientWorkId: options.clientWorkId }),
        media: [],
        createdAt: Math.floor(Date.now() / 1000),
      }
    : undefined;
  const readKey = worksKeys.online(gardenAddress, chainId);
  const savedKey = worksKeys.merged(gardenAddress, chainId);
  /** The read's own row for this work: the indexer has returned it. */
  const indexed = (work: EASWork) => work !== sentWork && work.id.toLowerCase() === workUID;
  if (sentWork) {
    const withSentWork = (old: EASWork[] | undefined) =>
      old?.some((work) => work.id.toLowerCase() === workUID) ? old : [sentWork, ...(old ?? [])];
    queryClient.setQueryData<EASWork[]>(readKey, withSentWork);
    queryClient.setQueryData<EASWork[]>(savedKey, withSentWork);
  } else {
    logger.warn("[WalletSubmission] The receipt names no work attestation to list until indexed");
  }

  const userAddress = walletClient.account?.address;
  if (userAddress) {
    queryClient.invalidateQueries({
      queryKey: worksKeys.mineByUser(userAddress),
      exact: false,
    });
  }

  onProgress?.("syncing", "Syncing with blockchain...");

  await pollQueriesAfterTransaction({
    queryKeys: [readKey, savedKey],
    baseDelay: 1000,
    maxDelay: 4000,
    maxAttempts: 4,
    onAttempt: (attempt, delay) => {
      debugLog(`[WalletSubmission] Polling indexer (attempt ${attempt}, waited ${delay}ms)`);
    },
    // The indexed work takes the saved row's place under the same id, so neither list
    // grows when it arrives. The read holding its own row for the work is the sign.
    ...(sentWork
      ? { until: () => queryClient.getQueryData<EASWork[]>(readKey)?.some(indexed) ?? false }
      : {}),
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
}
