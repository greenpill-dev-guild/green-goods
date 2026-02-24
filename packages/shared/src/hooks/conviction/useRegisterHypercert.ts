import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { RegisterHypercertParams } from "../../types/conviction";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

export function useRegisterHypercert() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useRegisterHypercert",
    toastContext: "register hypercert",
  });

  const lastPoolRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastPoolRef.current) {
        queryInvalidation
          .onHypercertRegistrationChanged(lastPoolRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: RegisterHypercertParams) => {
      return sendContractTx({
        address: params.poolAddress,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "registerHypercert",
        args: [params.hypercertId],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.signal.registering" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.signal.registerSuccess" }),
      });

      const normalizedPool = normalizeAddress(params.poolAddress);
      lastPoolRef.current = normalizedPool;
      queryInvalidation
        .onHypercertRegistrationChanged(normalizedPool, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          poolAddress: params?.poolAddress,
          hypercertId: params?.hypercertId?.toString(),
        },
      });
    },
  });
}
