import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { toastService } from "../../components/toast";
import type {
  CookieJarUpdateIntervalParams,
  CookieJarUpdateMaxWithdrawalParams,
} from "../../types/cookie-jar";
import { COOKIE_JAR_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { GARDEN_ACCOUNT_EXECUTION_ABI } from "../../utils/blockchain/abis/garden";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { useProgressiveInvalidation } from "../utils/useTimeout";

interface GardenJarWriteConfig<TParams> {
  source: string;
  toastContext: string;
  /** Toast title while the transaction is pending. */
  titleId: string;
  /** Toast title once it lands. */
  successId: string;
  encodeCall: (params: TParams) => Hex;
}

/**
 * A garden jar names the garden account as its only owner, and nobody holds the role that could
 * add another, so a jar setting changes only when the garden account makes the call. The
 * connected account asks it to through `execute`; an account that cannot sign for the garden
 * reverts there, which is why callers gate on `useGardenAccountSigner` first.
 */
function useGardenJarWrite<TParams extends { jarAddress: Address }>(
  gardenAddress: Address,
  config: GardenJarWriteConfig<TParams>
) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: config.source,
    toastContext: config.toastContext,
  });

  const lastJarRef = useRef<Address | null>(null);
  const invalidateJar = useCallback(() => {
    if (!lastJarRef.current) return;
    queryInvalidation
      .onCookieJarAdminAction(gardenAddress, lastJarRef.current, chainId)
      .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  }, [queryClient, gardenAddress, chainId]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    invalidateJar,
    INDEXER_LAG_SCHEDULE_MS
  );

  return useMutation({
    mutationFn: async (params: TParams) => {
      if (!sender) throw new Error("Transaction sender is unavailable");
      const result = await sender.sendContractCall({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_EXECUTION_ABI,
        functionName: "execute",
        args: [params.jarAddress, 0n, config.encodeCall(params), 0],
        chainId,
      });
      return result.hash;
    },
    onMutate: () => ({
      toastId: toastService.loading({ title: formatMessage({ id: config.titleId }) }),
    }),
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({ title: formatMessage({ id: config.successId }) });

      lastJarRef.current = params.jarAddress;
      invalidateJar();
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress, jarAddress: params?.jarAddress },
      });
    },
  });
}

export function useCookieJarUpdateMaxWithdrawal(gardenAddress: Address) {
  return useGardenJarWrite<CookieJarUpdateMaxWithdrawalParams>(gardenAddress, {
    source: "useCookieJarUpdateMaxWithdrawal",
    toastContext: "cookie jar update max withdrawal",
    titleId: "app.cookieJar.limitUpdating",
    successId: "app.cookieJar.limitUpdated",
    encodeCall: (params) =>
      encodeFunctionData({
        abi: COOKIE_JAR_ABI,
        functionName: "updateMaxWithdrawalAmount",
        args: [params.maxWithdrawal],
      }),
  });
}

export function useCookieJarUpdateInterval(gardenAddress: Address) {
  return useGardenJarWrite<CookieJarUpdateIntervalParams>(gardenAddress, {
    source: "useCookieJarUpdateInterval",
    toastContext: "cookie jar update interval",
    titleId: "app.cookieJar.cooldownUpdating",
    successId: "app.cookieJar.cooldownUpdated",
    encodeCall: (params) =>
      encodeFunctionData({
        abi: COOKIE_JAR_ABI,
        functionName: "updateWithdrawalInterval",
        args: [params.withdrawalInterval],
      }),
  });
}
