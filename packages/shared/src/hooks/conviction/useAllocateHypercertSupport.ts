import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { AllocateHypercertSupportParams } from "../../types/conviction";
import { HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useUser } from "../auth/useUser";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

export function useAllocateHypercertSupport() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useAllocateHypercertSupport",
    toastContext: "conviction support",
  });

  const lastParamsRef = useRef<{ pool: string; voter: string }>({ pool: "", voter: "" });
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      const { pool, voter } = lastParamsRef.current;
      if (pool && voter) {
        queryInvalidation
          .onSupportAllocated(pool, voter, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      } else if (pool) {
        queryInvalidation
          .onHypercertRegistrationChanged(pool, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: AllocateHypercertSupportParams) => {
      const signals = params.signals.map((s) => ({
        hypercertId: s.hypercertId,
        deltaSupport: s.deltaSupport,
      }));

      return sendContractTx({
        address: params.poolAddress,
        abi: HYPERCERT_SIGNAL_POOL_ABI,
        functionName: "allocateSupport",
        args: [signals],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.signal.allocating" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.signal.allocateSuccess" }),
      });

      const normalizedPool = normalizeAddress(params.poolAddress);
      if (primaryAddress) {
        const normalizedVoter = normalizeAddress(primaryAddress);
        lastParamsRef.current = { pool: normalizedPool, voter: normalizedVoter };
        queryInvalidation
          .onSupportAllocated(normalizedPool, normalizedVoter, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      } else {
        lastParamsRef.current = { pool: normalizedPool, voter: "" };
        // Fallback: invalidate pool-level weights when no voter address available
        queryInvalidation
          .onHypercertRegistrationChanged(normalizedPool, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          poolAddress: params?.poolAddress,
          signalCount: params?.signals?.length,
        },
      });
    },
  });
}
