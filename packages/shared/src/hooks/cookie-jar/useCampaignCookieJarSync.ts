import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import { toastService } from "../../components/toast";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { batchKeys } from "../../config/query-keys/garden";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import {
  type CampaignJarSync,
  type CampaignJarSyncHold,
  campaignJarSyncCalls,
  campaignJarSyncDomain,
  createCampaignJarSyncChain,
  moveOnFromCampaignJarSyncHold,
  type ProvenCampaignJarSync,
  readCampaignJarSyncHold,
  sendCampaignJarSyncBatch,
} from "../../modules/garden/campaign-jar-sync-batch";
import { campaignJarSyncRoute } from "../../modules/garden/campaign-jar-sync-route";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import { assertBatchCapabilityKnown } from "../../modules/transactions/batch-types";
import {
  TransactionConfirmationPendingError,
  type TransactionSender,
  type TxResult,
} from "../../modules/transactions/types";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { classifyTxError } from "../../utils/errors/tx-error-classifier";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useHeldBatches } from "../garden/useHeldBatches";
import { useProgressiveInvalidation } from "../utils/useTimeout";

export type { CampaignJarSync } from "../../modules/garden/campaign-jar-sync-batch";

/** What makes two syncs the same send, so one that came back past its ceilings is known again. */
const syncKey = ({ jarAddress, grant, revoke, metadata }: CampaignJarSync) =>
  JSON.stringify([jarAddress.toLowerCase(), grant, revoke, metadata?.value ?? null]);

/**
 * Today's flow: one signature per step. A Safe proposes each step to run later, and no step needs
 * another to land, so every proposal still goes out, but a proposal never counts as landed.
 */
async function sendStepByStep(
  sender: TransactionSender,
  sync: CampaignJarSync,
  chainId: number,
  onStep: (step: number, total: number) => void
): Promise<Hex> {
  const calls = campaignJarSyncCalls(sync);
  let proposed: TxResult | undefined;
  let landed: Hex | undefined;
  for (const [index, { call }] of calls.entries()) {
    onStep(index + 1, calls.length);
    const result = await sender.sendContractCall({ ...call, chainId });
    if (result.confirmation === "pending") proposed ??= result;
    else landed = result.hash;
  }
  if (proposed) throw new TransactionConfirmationPendingError(proposed);
  if (!landed) throw new Error("Nothing to sync");
  return landed;
}

/**
 * Sync a campaign jar's allowlist and metadata, and settle a sync whose outcome is unknown. On a
 * listed rail the grant, revoke, and metadata go as one request, all or nothing; elsewhere each is
 * its own signature, as before. Recovery does not depend on the listing, so a held sync still shows
 * after its rail comes off the list. Errors stay on the mutation for the dialog to show.
 */
export function useCampaignCookieJarSync(jarAddress: Address | undefined) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const { connector } = useAccount();
  const handleError = createMutationErrorHandler({
    source: "useCampaignCookieJarSync",
    toastContext: "campaign cookie jar sync",
    formatMessage,
  });

  const batches = sender?.batches;
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const walletListed =
    rail === "wallet" &&
    isBatchEnabled({ action: "campaign-jar-sync", rail, profile: "eip-5792", chainId });
  // Asked only once a wallet is listed: until then no wallet hears from this hook.
  const { data: capability } = useQuery({
    queryKey: batchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => {
      const { atomic } = await sender!.getBatchCapability!({ account: account!, chainId });
      return atomic;
    },
    enabled: walletListed && Boolean(jarAddress && account && sender?.getBatchCapability),
    retry: false,
  });
  const routeFor = (walletAtomic: boolean) =>
    batches
      ? campaignJarSyncRoute({ rail, passkeyProfile: passkeyAccountProfile, walletAtomic, chainId })
      : null;
  // Past its ceilings a sync sends nothing. It was promised one signature, so going step by step
  // takes another press.
  const [overCeilings, setOverCeilings] = useState<string | null>(null);

  const refreshJar = useCallback(() => {
    if (!jarAddress) return;
    for (const queryKey of queryInvalidation.onCampaignCookieJarChanged(
      jarAddress,
      account ?? undefined,
      chainId
    ))
      void queryClient.invalidateQueries({ queryKey });
  }, [jarAddress, account, chainId, queryClient]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    refreshJar,
    INDEXER_LAG_SCHEDULE_MS
  );
  const refresh = () => {
    refreshJar();
    scheduleFollowUp();
  };

  const domain = jarAddress ? campaignJarSyncDomain(jarAddress) : "";
  const holdKey = batchKeys.hold(domain, account ?? "", chainId);
  const batchInput = () => ({
    batches: batches!,
    chain: createCampaignJarSyncChain(chainId),
    jarAddress: jarAddress!,
    scope: { account: account!, chainId },
  });
  const activeToastId = useRef<string | undefined>(undefined);
  const syncTitle = (sync: CampaignJarSync) =>
    formatMessage({
      id:
        sync.grant.length + sync.revoke.length > 0
          ? "app.campaignCookieJar.sync.title"
          : "app.campaignCookieJar.metadata.title",
    });

  const mutation = useMutation({
    onMutate: async (sync: CampaignJarSync) => {
      await queryClient.cancelQueries({ queryKey: holdKey });
      const toastId = toastService.loading({
        title: syncTitle(sync),
        message: formatMessage({ id: "app.campaignCookieJar.sync.pending" }),
      });
      activeToastId.current = toastId;
      return { toastId };
    },
    mutationFn: async (sync: CampaignJarSync): Promise<Hex> => {
      if (!sender || !account) throw new Error("Connected account required");
      let walletAtomic = false;
      // Asked again at the send, so a stale answer never picks the route.
      if (walletListed) {
        const answer = await sender.getBatchCapability?.({ account, chainId });
        assertBatchCapabilityKnown(answer);
        walletAtomic = answer?.atomic === "supported";
      }
      const batchRail = routeFor(walletAtomic);
      if (batchRail && overCeilings !== syncKey(sync)) {
        const outcome = await sendCampaignJarSyncBatch({
          ...batchInput(),
          rail: batchRail,
          sync,
        });
        switch (outcome.status) {
          case "synced":
            return outcome.transactionHash;
          case "unknown":
            throw new TransactionConfirmationPendingError();
          case "declined":
            throw new Error("Transaction cancelled");
          case "reverted":
            throw new Error("The sync reverted on chain, so nothing in it changed.");
          case "not-batchable":
            setOverCeilings(syncKey(sync));
            throw new Error("batch-budget-exceeded");
        }
      }
      return sendStepByStep(sender, sync, chainId, (step, total) => {
        if (total < 2 || !activeToastId.current) return;
        toastService.loading({
          id: activeToastId.current,
          title: syncTitle(sync),
          message: formatMessage({ id: "app.campaignCookieJar.sync.step" }, { step, total }),
        });
      });
    },
    onSuccess: (_hash, sync, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: syncTitle(sync),
        message: formatMessage({
          id:
            sync.grant.length + sync.revoke.length > 0
              ? "app.campaignCookieJar.sync.success"
              : "app.campaignCookieJar.metadata.success",
        }),
      });
      refresh();
    },
    onError: (error, sync, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      const { kind } = classifyTxError(error);
      // It may have landed, so what the jar holds is worth reading again.
      if (kind === "unconfirmed") refresh();
      if (kind === "unconfirmed" || kind === "overCeilings") return;
      handleError(error, {
        authMode: rail,
        metadata: {
          jarAddress: sync.jarAddress,
          grantCount: sync.grant.length,
          revokeCount: sync.revoke.length,
          writesMetadata: sync.metadata !== null,
        },
        showToast: false,
      });
    },
    // A read follows every send, since that is what locks the dialog and can settle the send itself.
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  const held = useHeldBatches<CampaignJarSyncHold, ProvenCampaignJarSync>({
    domain,
    account,
    chainId,
    enabled: Boolean(batches && account && jarAddress) && !mutation.isPending,
    read: (shown) => readCampaignJarSyncHold(batchInput(), shown),
    moveOn: (hold) => moveOnFromCampaignJarSyncHold(batchInput(), hold),
    onSaved: (saved) => {
      if (saved.some((sync) => sync.whole)) {
        toastService.success({
          title: formatMessage({ id: "app.campaignCookieJar.sync.title" }),
          message: formatMessage({ id: "app.campaignCookieJar.sync.success" }),
        });
      }
      refresh();
    },
    onError: (error) => handleError(error, { authMode: rail, metadata: { jarAddress } }),
  });

  const { hold } = held;
  const capabilityUnread =
    walletListed && capability !== "supported" && capability !== "unsupported";
  return {
    send: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    /** How many signatures this sync takes now, or null until the wallet has answered. */
    signaturesFor: (sync: CampaignJarSync) =>
      capabilityUnread
        ? null
        : routeFor(capability === "supported") && overCeilings !== syncKey(sync)
          ? 1
          : campaignJarSyncCalls(sync).length,
    isHeld: hold !== null,
    isSettlingHold: held.isSettlingHold,
    /** What the dialog shows while held. Spread it onto `TxHoldFeedback`. */
    holdFeedback: hold
      ? {
          title: formatMessage({ id: "cockpit.community.cookies.hold.title" }),
          message: formatMessage({ id: "cockpit.community.cookies.hold.body" }),
          detail: hold.onChain
            ? formatMessage(
                { id: "cockpit.community.cookies.hold.onChain" },
                {
                  granted: hold.onChain.granted,
                  grantTotal: hold.grant.length,
                  revoked: hold.onChain.revoked,
                  revokeTotal: hold.revoke.length,
                  metadata: !hold.writesMetadata
                    ? "none"
                    : hold.onChain.metadataWritten
                      ? "updated"
                      : "pending",
                }
              ).trim()
            : undefined,
          hasUnreadValues: hold.onChain === null,
          isSettling: held.isSettlingHold,
          onCheckAgain: () => void held.checkAgain(),
          onMoveOn: () => void held.moveOn(),
        }
      : null,
  };
}
