import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis";
import { fetchGardensModuleAddress } from "../../utils/blockchain/garden-modules";
import { normalizeAddress } from "../../utils/blockchain/address";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { INDEXER_LAG_FOLLOWUP_MS, queryKeys } from "../query-keys";
import { useDelayedInvalidation } from "../utils/useTimeout";

/**
 * Hook for creating signal pools for a garden.
 *
 * Pools are auto-created during mint (onGardenMinted → attemptPoolCreation).
 * If automatic creation fails, operators can call GardensModule.createGardenPools(garden)
 * as a retry/fallback to create pools after the fact.
 *
 * This is idempotent on-chain: the contract reverts with PoolsAlreadyExist
 * if pools are already created.
 */
export function useCreateGardenPools(gardenAddress?: Address) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useCreateGardenPools",
    toastContext: "pool creation",
  });

  const normalizedGarden = gardenAddress ? normalizeAddress(gardenAddress) : undefined;

  const lastGardenRef = useRef<string>("");
  const { start: schedulePoolSync } = useDelayedInvalidation(
    useCallback(() => {
      const garden = lastGardenRef.current;
      if (garden) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.community.pools(garden, chainId),
        });
      }
    }, [queryClient, chainId]),
    INDEXER_LAG_FOLLOWUP_MS
  );

  return useMutation({
    mutationFn: async () => {
      if (!normalizedGarden) {
        throw new Error("Garden address is required");
      }

      const gardensModule = await fetchGardensModuleAddress(normalizedGarden as Address, chainId);
      if (!gardensModule) {
        throw new Error("GardensModule not found for this garden");
      }

      return sendContractTx({
        address: gardensModule,
        abi: GARDENS_MODULE_ABI,
        functionName: "createGardenPools",
        args: [normalizedGarden],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.pools.creating" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, _vars, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.pools.createSuccess" }),
      });

      if (normalizedGarden) {
        lastGardenRef.current = normalizedGarden;
        queryClient.invalidateQueries({
          queryKey: queryKeys.community.pools(normalizedGarden, chainId),
        });
      }
      schedulePoolSync();
    },
    onError: (error, _vars, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: { gardenAddress: normalizedGarden },
      });
    },
  });
}
