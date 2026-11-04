import { readContract } from "@wagmi/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { getWagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { batchKeys, gardensKeys } from "../../config/query-keys/garden";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { toastService } from "../../components/toast";
import { getKarmaGardenProjection } from "../../modules/data/karma";
import {
  type KarmaReconcileHold,
  type KarmaReconcileOutcome,
  karmaReconcileBudget,
  karmaReconcileCalls,
  karmaReconcileDomain,
  moveOnFromKarmaReconcileHold,
  readKarmaReconcileHold,
  reconcileKarmaBatch,
  type SettledKarmaSync,
  signaturesForKarmaReconcile,
} from "../../modules/garden/karma-batch";
import {
  createKarmaReconcileChain,
  type KarmaCallResult,
} from "../../modules/garden/karma-sync-records";
import type { Address, Garden } from "../../types/domain";
import type { KarmaIntegrationStatus } from "../../types/karma";
import { isValidAddressFormat, isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useAtomicBatchRoute } from "../blockchain/useAtomicBatchRoute";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useHeldBatches } from "./useHeldBatches";
import {
  deriveKarmaIntegrationAuthorization,
  deriveKarmaIntegrationStatus,
  EMPTY_KARMA_PROJECTION,
  isMissingKarmaVersionSelector,
  KARMA_ACCOUNT_READ_ABI,
  KARMA_CHAIN_ID,
  uniqueKarmaReconciliationAccounts,
} from "./karmaIntegration";

export {
  deriveKarmaIntegrationAuthorization,
  deriveKarmaProjectSlug,
  deriveKarmaIntegrationStatus,
  KARMA_SYNC_VERSION,
  type KarmaIntegrationAuthorization,
  type KarmaIntegrationAuthorizationInput,
  type KarmaIntegrationDerivationInput,
} from "./karmaIntegration";
export type {
  KarmaIntegrationProjection,
  KarmaIntegrationStatus,
  KarmaIntegrationStatusName,
  KarmaProjectionState,
} from "../../types/karma";

/** Which signature of a press is out now, counting from 1. */
interface KarmaSyncProgress {
  signature: number;
  signatures: number;
}

/** A press either went one call at a time, as it always has, or under one signature per group. */
type KarmaReconcileRun = { batched: false } | { batched: true; outcome: KarmaReconcileOutcome };

export function useKarmaIntegration(garden?: Garden | null) {
  const { formatMessage } = useIntl();
  const { primaryAddress, passkeyAccountProfile } = useUser();
  const queryClient = useQueryClient();
  const transactionSender = useTransactionSender();
  const chainId = garden?.chainId ?? DEFAULT_CHAIN_ID;
  const gardenAddress = garden?.id as Address | undefined;
  const karmaModule = getNetworkContracts(chainId).karmaGAPModule;
  const supported =
    chainId === KARMA_CHAIN_ID && isValidAddressFormat(karmaModule) && !isZeroAddress(karmaModule);
  const [progress, setProgress] = useState<KarmaSyncProgress | null>(null);

  const projectionQuery = useQuery({
    queryKey: gardensKeys.karmaStatus(gardenAddress ?? "", chainId),
    queryFn: () => getKarmaGardenProjection(gardenAddress!, chainId),
    enabled: Boolean(gardenAddress) && supported,
  });
  const versionQuery = useQuery({
    queryKey: gardensKeys.karmaVersion(gardenAddress ?? "", chainId),
    queryFn: async (): Promise<number | null> => {
      try {
        return Number(
          await readContract(getWagmiConfig(), {
            address: gardenAddress!,
            abi: KARMA_ACCOUNT_READ_ABI,
            functionName: "karmaSyncVersion",
            chainId,
          })
        );
      } catch (error) {
        if (isMissingKarmaVersionSelector(error)) return null;
        throw error;
      }
    },
    enabled: Boolean(gardenAddress) && supported,
  });
  const slugQuery = useQuery({
    queryKey: gardensKeys.karmaSlug(gardenAddress ?? "", chainId),
    queryFn: () =>
      readContract(getWagmiConfig(), {
        address: gardenAddress!,
        abi: KARMA_ACCOUNT_READ_ABI,
        functionName: "slug",
        chainId,
      }),
    enabled: Boolean(gardenAddress) && supported,
  });
  const projection = projectionQuery.data ?? EMPTY_KARMA_PROJECTION;
  const authorization = deriveKarmaIntegrationAuthorization({
    primaryAddress,
    owners: garden?.owners ?? [],
    stewards: garden?.stewards ?? [],
  });
  const statusReadError = projectionQuery.error ?? versionQuery.error ?? slugQuery.error;
  const canReconcile = supported && authorization.canReconcile && !statusReadError;
  const calls =
    garden && gardenAddress
      ? karmaReconcileCalls({
          module: karmaModule,
          garden: gardenAddress,
          chainId,
          accounts: uniqueKarmaReconciliationAccounts(garden, projection),
        })
      : [];

  const batches = transactionSender?.batches;
  const route = useAtomicBatchRoute({
    action: "karma-reconcile",
    sender: transactionSender,
    account: primaryAddress,
    passkeyProfile: passkeyAccountProfile,
    chainId,
    budgeted: (rail) => Boolean(karmaReconcileBudget(rail, chainId)),
    enabled: supported,
  });
  const domain = gardenAddress ? karmaReconcileDomain(gardenAddress) : "";
  const holdKey = batchKeys.hold(domain, primaryAddress ?? "", chainId);
  const overCeilingsKey = batchKeys.overCeilings(
    domain,
    primaryAddress ?? "",
    chainId,
    String(calls.length)
  );
  const { data: overCeilings = false } = useQuery<boolean>({
    queryKey: overCeilingsKey,
    // Written by the send: nothing to fetch.
    queryFn: () => false,
    enabled: false,
  });
  const inBatches = Boolean(batches) && route.atomic && !overCeilings;
  const signatures =
    calls.length === 0 || route.unread
      ? null
      : signaturesForKarmaReconcile(calls.length, inBatches);

  const invalidateKarma = useCallback(() => {
    if (!gardenAddress) return;
    for (const queryKey of queryInvalidation.invalidateGardenKarma(gardenAddress, chainId)) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [chainId, gardenAddress, queryClient]);
  const { start: scheduleIndexerRefresh } = useProgressiveInvalidation(
    invalidateKarma,
    INDEXER_LAG_SCHEDULE_MS
  );
  const handleReconcileError = createMutationErrorHandler({
    source: "useKarmaIntegration.reconcile",
    toastContext: "Karma reconciliation",
  });
  const announceFailure = (description: string) =>
    toastService.error({
      title: formatMessage({ id: "cockpit.garden.karma.toast.reconcileError" }),
      description,
    });
  /** Only what the chain recorded counts: a landed transaction can still carry a failed sync. */
  const announceRecorded = (recorded: readonly KarmaCallResult[], notSent = 0) => {
    const failed = recorded.filter((call) => !call.synced).length;
    if (failed === 0 && notSent === 0) {
      toastService.success({
        title: formatMessage({ id: "cockpit.garden.karma.toast.reconcileComplete" }),
      });
      return;
    }
    announceFailure(
      formatMessage(
        { id: "cockpit.garden.karma.toast.recordedFailures" },
        { failed: failed + notSent }
      )
    );
  };
  const announce = (outcome: KarmaReconcileOutcome) => {
    // The panel shows a send nobody can confirm yet, with a way to settle it.
    if (outcome.unknown > 0) return;
    switch (outcome.stoppedBy) {
      case "over-ceilings":
        queryClient.setQueryData(overCeilingsKey, true);
        toastService.info({
          title: formatMessage({ id: "app.txFeedback.overCeilings.title" }),
          message: formatMessage({ id: "cockpit.garden.karma.toast.needsMoreSignatures" }),
        });
        return;
      case "declined":
        announceFailure(formatMessage({ id: "app.txFeedback.cancelled.title" }));
        return;
      case "reverted":
        announceFailure(formatMessage({ id: "app.txFeedback.failed.title" }));
        return;
      case "error":
        announceFailure(
          handleReconcileError(outcome.failure, { gardenAddress, showToast: false }).message
        );
        return;
      default:
        announceRecorded(outcome.recorded, outcome.notSent);
    }
  };

  const reconcileMutation = useMutation({
    mutationFn: async (): Promise<KarmaReconcileRun> => {
      if (!garden || !gardenAddress) throw new Error("Garden is required");
      if (!canReconcile) throw new Error("Garden Owner or Steward role is required");
      if (!supported) throw new Error("Karma reconciliation is not supported on this chain");
      if (!transactionSender) throw new Error("Transaction sender is not available");
      const onSignature = (signature: number, total: number) =>
        setProgress({ signature, signatures: total });
      try {
        if (inBatches && route.rail) {
          const outcome = await reconcileKarmaBatch({
            batches: batches!,
            scope: { account: primaryAddress!, chainId },
            garden: gardenAddress,
            chain: createKarmaReconcileChain(chainId),
            rail: route.rail,
            calls,
            onSignature,
          });
          return { batched: true, outcome };
        }
        // Today's path: one signature per call, each waiting for the one before it.
        for (const [index, { call }] of calls.entries()) {
          onSignature(index + 1, calls.length);
          await transactionSender.sendContractCall(call);
        }
        return { batched: false };
      } finally {
        setProgress(null);
      }
    },
    onMutate: async () => {
      // A hold read still in flight would find this send's own record and call it held.
      await queryClient.cancelQueries({ queryKey: holdKey });
      return {
        toastId: toastService.loading({
          title: formatMessage({ id: "cockpit.garden.karma.toast.reconciling" }),
        }),
      };
    },
    onSuccess: (run, _variables, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      if (run.batched) announce(run.outcome);
      else
        toastService.success({
          title: formatMessage({ id: "cockpit.garden.karma.toast.reconcileSuccess" }),
        });
      invalidateKarma();
      scheduleIndexerRefresh();
    },
    onError: (error, _variables, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      const parsed = handleReconcileError(error, { gardenAddress, showToast: false });
      toastService.error({
        title: formatMessage({ id: "cockpit.garden.karma.toast.reconcileError" }),
        description: parsed.message,
      });
      invalidateKarma();
      scheduleIndexerRefresh();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  // Recovery does not depend on `batched`, so a hold still shows after the rail comes off the list.
  const holdInput = () => ({
    batches: batches!,
    scope: { account: primaryAddress!, chainId },
    garden: gardenAddress!,
    chain: createKarmaReconcileChain(chainId),
  });
  const held = useHeldBatches<KarmaReconcileHold, SettledKarmaSync>({
    domain,
    account: primaryAddress,
    chainId,
    enabled:
      Boolean(batches && primaryAddress && gardenAddress) &&
      supported &&
      !reconcileMutation.isPending,
    read: (shown) => readKarmaReconcileHold(holdInput(), shown),
    moveOn: (hold) => moveOnFromKarmaReconcileHold(holdInput(), hold),
    onSaved: (saved) => {
      const recorded = saved.flatMap((sync) => sync.recorded);
      if (recorded.length > 0) announceRecorded(recorded);
      invalidateKarma();
      scheduleIndexerRefresh();
    },
    onError: (error) => handleReconcileError(error, { gardenAddress }),
  });

  const isLoading = projectionQuery.isLoading || versionQuery.isLoading || slugQuery.isLoading;
  const isRetrying = reconcileMutation.isPending;
  const derivedStatus = useMemo(
    () =>
      deriveKarmaIntegrationStatus({
        chainId,
        gardenAddress: gardenAddress ?? ("0x0000000000000000000000000000000000000000" as Address),
        gardenName: garden?.name ?? null,
        gardenSlug: slugQuery.data ?? null,
        supported,
        syncVersion: versionQuery.data ?? null,
        readErrorReason: statusReadError ? "karma_status_read_unavailable" : null,
        isRetrying,
        projection,
      }),
    [
      chainId,
      gardenAddress,
      garden?.name,
      isRetrying,
      projection,
      slugQuery.data,
      statusReadError,
      supported,
      versionQuery.data,
    ]
  );
  const status: KarmaIntegrationStatus = isLoading
    ? { ...derivedStatus, profileUrl: null }
    : derivedStatus;
  const error =
    projectionQuery.error ??
    versionQuery.error ??
    slugQuery.error ??
    reconcileMutation.error ??
    null;

  return {
    status,
    profileUrl: status.profileUrl,
    canReconcile,
    isLoading,
    isFetching: projectionQuery.isFetching || versionQuery.isFetching || slugQuery.isFetching,
    isReconciling: reconcileMutation.isPending,
    isPending: isRetrying,
    error,
    reconcile: async (): Promise<void> => {
      await reconcileMutation.mutateAsync();
    },
    /** How many signatures one press asks for, or null until that can be said. */
    signatures,
    progress,
    /** An earlier sync of this garden whose outcome is unknown. It pauses the next one. */
    hold: held.hold,
    isSettlingHold: held.isSettlingHold,
    checkHoldAgain: held.checkAgain,
    moveOnFromHold: held.moveOn,
  };
}

export type KarmaIntegrationController = ReturnType<typeof useKarmaIntegration>;
