import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { useCallback, useRef } from "react";
import type { Address } from "viem";
import { toastService } from "../../components/toast";
import type { CookieJarWithdrawParams } from "../../types/cookie-jar";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";
import { COOKIE_JAR_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";

export function useCookieJarWithdraw(gardenAddress: Address) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCookieJarWithdraw",
    toastContext: "cookie jar withdraw",
  });

  const lastParamsRef = useRef<{
    gardenAddress: string;
    jarAddress: string;
    userAddress: string | undefined;
  }>({
    gardenAddress,
    jarAddress: "",
    userAddress: undefined,
  });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastParamsRef.current.gardenAddress && lastParamsRef.current.jarAddress) {
        queryInvalidation
          .onCookieJarWithdraw(
            lastParamsRef.current.gardenAddress,
            lastParamsRef.current.jarAddress,
            lastParamsRef.current.userAddress,
            chainId
          )
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: CookieJarWithdrawParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "withdraw",
        args: [params.amount, params.purpose],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.withdraw" }),
        message: formatMessage({ id: "app.cookieJar.withdrawing" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.withdraw" }),
        message: formatMessage({ id: "app.cookieJar.withdrawSuccess" }),
      });

      lastParamsRef.current = {
        gardenAddress,
        jarAddress: _params.jarAddress,
        userAddress: primaryAddress ?? undefined,
      };
      queryInvalidation
        .onCookieJarWithdraw(
          gardenAddress,
          _params.jarAddress,
          primaryAddress ?? undefined,
          chainId
        )
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress,
          jarAddress: params?.jarAddress,
        },
      });
    },
  });
}
