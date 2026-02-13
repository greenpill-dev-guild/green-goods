import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { SetConvictionStrategiesParams } from "../../types/conviction";
import { HATS_MODULE_CONVICTION_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

export function useSetConvictionStrategies() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetConvictionStrategies",
    toastContext: "conviction strategies",
  });

  const lastGardenRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryInvalidation
          .onConvictionStrategiesUpdated(lastGardenRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: SetConvictionStrategiesParams) => {
      const normalizedGarden = normalizeAddress(params.gardenAddress);
      const hatsModule = await fetchHatsModuleAddress(normalizedGarden, chainId);
      if (!hatsModule) {
        throw new Error("Hats module is not configured for this garden");
      }

      const normalizedStrategies = params.strategies.map(normalizeAddress);

      return sendContractTx({
        address: hatsModule,
        abi: HATS_MODULE_CONVICTION_ABI,
        functionName: "setConvictionStrategies",
        args: [normalizedGarden, normalizedStrategies],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.conviction.saving" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.conviction.saveSuccess" }),
      });

      const normalizedGarden = normalizeAddress(params.gardenAddress);
      lastGardenRef.current = normalizedGarden;
      queryInvalidation
        .onConvictionStrategiesUpdated(normalizedGarden, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          strategies: params?.strategies,
        },
      });
    },
  });
}
