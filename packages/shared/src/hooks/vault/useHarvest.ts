import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { HarvestParams } from "../../types/vaults";
import { OCTANT_MODULE_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { INDEXER_LAG_SCHEDULE_MS, queryInvalidation } from "../../config/query-keys";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { getOctantModuleAddress } from "./vault-helpers";

export function useHarvest() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: "useHarvest",
    toastContext: "vault harvest",
  });
  const lastGardenRef = useRef<string>("");
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      if (lastGardenRef.current) {
        queryInvalidation
          .onVaultHarvest(lastGardenRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: HarvestParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      const octantModule = getOctantModuleAddress(chainId);

      const result = await sender.sendContractCall({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "harvest",
        args: [params.gardenAddress, params.assetAddress],
      });
      return result.hash;
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.harvest" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.harvest" }),
        message: formatMessage({ id: "app.treasury.harvestSuccess" }),
      });

      lastGardenRef.current = params.gardenAddress;
      queryInvalidation
        .onVaultHarvest(params.gardenAddress, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          gardenAddress: params?.gardenAddress,
          assetAddress: params?.assetAddress,
        },
      });
    },
  });

  return useSafeMutation(mutation);
}
