import { readContract } from "@wagmi/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import type { Hex } from "viem";

import { getWagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { gardensKeys } from "../../config/query-keys/garden";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { toastService } from "../../components/toast";
import { getKarmaGardenProjection } from "../../modules/data/karma";
import type { ContractCall } from "../../modules/transactions/types";
import type { Address, Garden } from "../../types/domain";
import type { KarmaIntegrationStatus } from "../../types/karma";
import { isValidAddressFormat, isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import {
  deriveKarmaIntegrationAuthorization,
  deriveKarmaIntegrationStatus,
  EMPTY_KARMA_PROJECTION,
  isMissingKarmaVersionSelector,
  KARMA_ACCOUNT_READ_ABI,
  KARMA_CHAIN_ID,
  KARMA_MODULE_ABI,
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

export function useKarmaIntegration(garden?: Garden | null) {
  const { formatMessage } = useIntl();
  const primaryAddress = usePrimaryAddress() as Address | null;
  const queryClient = useQueryClient();
  const transactionSender = useTransactionSender();
  const chainId = garden?.chainId ?? DEFAULT_CHAIN_ID;
  const gardenAddress = garden?.id as Address | undefined;
  const karmaModule = getNetworkContracts(chainId).karmaGAPModule;
  const supported =
    chainId === KARMA_CHAIN_ID && isValidAddressFormat(karmaModule) && !isZeroAddress(karmaModule);

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
  const reconcileMutation = useMutation({
    mutationFn: async (): Promise<Hex> => {
      if (!garden || !gardenAddress) throw new Error("Garden is required");
      if (!canReconcile) throw new Error("Garden Owner or Steward role is required");
      if (!supported) throw new Error("Karma reconciliation is not supported on this chain");
      if (!transactionSender) throw new Error("Transaction sender is not available");

      const calls: ContractCall[] = [
        {
          address: karmaModule,
          abi: KARMA_MODULE_ABI,
          functionName: "reconcileProject",
          args: [gardenAddress],
          chainId,
        },
        ...uniqueKarmaReconciliationAccounts(garden, projection).map(
          (account): ContractCall => ({
            address: karmaModule,
            abi: KARMA_MODULE_ABI,
            functionName: "reconcileProjectAccess",
            args: [gardenAddress, account],
            chainId,
          })
        ),
      ];
      if (transactionSender.sendBatch) return (await transactionSender.sendBatch(calls)).hash;

      let lastHash: Hex | null = null;
      for (const call of calls) {
        lastHash = (await transactionSender.sendContractCall(call)).hash;
      }
      return lastHash!;
    },
    onMutate: () => ({
      toastId: toastService.loading({
        title: formatMessage({ id: "cockpit.garden.karma.toast.reconciling" }),
      }),
    }),
    onSuccess: (_hash, _variables, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
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
    reconcile: reconcileMutation.mutateAsync,
  };
}

export type KarmaIntegrationController = ReturnType<typeof useKarmaIntegration>;
