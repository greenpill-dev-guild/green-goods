import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import type { AllocateYieldParams } from "../../types/gardens-community";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis";
import { normalizeAddress } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryInvalidation } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

/**
 * Mutation hook to trigger yield allocation via YieldSplitter.splitYield().
 * This is permissionless -- anyone can trigger it, not just operators.
 * Resolves the YieldSplitter address from deployment config automatically.
 */
export function useAllocateYield() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const yieldSplitterAddress = getNetworkContracts(chainId).yieldSplitter as Address;
  const handleError = createMutationErrorHandler({
    source: "useAllocateYield",
    toastContext: "yield allocation",
  });

  const lastGardenRef = useRef<string>("");
  const lastAssetRef = useRef<string>("");
  const { start: scheduleFollowUp } = useDelayedInvalidation(
    useCallback(() => {
      if (lastGardenRef.current && lastAssetRef.current) {
        queryInvalidation
          .onYieldAllocated(lastGardenRef.current, lastAssetRef.current, chainId)
          .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async (params: AllocateYieldParams) => {
      return sendContractTx({
        address: yieldSplitterAddress,
        abi: YIELD_SPLITTER_ABI,
        functionName: "splitYield",
        args: [params.gardenAddress, params.assetAddress, params.vaultAddress],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.yield.allocating" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.yield.allocateSuccess" }),
      });

      const normalizedGarden = normalizeAddress(params.gardenAddress);
      const normalizedAsset = normalizeAddress(params.assetAddress);
      lastGardenRef.current = normalizedGarden;
      lastAssetRef.current = normalizedAsset;
      queryInvalidation
        .onYieldAllocated(normalizedGarden, normalizedAsset, chainId)
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
}
