import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import type { SetConvictionStrategiesParams } from "../../types/conviction";
import { HATS_MODULE_CONVICTION_ABI } from "../../utils/blockchain/abis";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useUser } from "../auth/useUser";
import { queryInvalidation } from "../query-keys";

export function useSetConvictionStrategies() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();
  const handleError = createMutationErrorHandler({
    source: "useSetConvictionStrategies",
    toastContext: "conviction strategies",
  });

  return useMutation({
    mutationFn: async (params: SetConvictionStrategiesParams) => {
      const normalizedGarden = params.gardenAddress.toLowerCase() as Address;
      const hatsModule = await fetchHatsModuleAddress(normalizedGarden, chainId);
      if (!hatsModule) {
        throw new Error("Hats module is not configured for this garden");
      }

      const request = {
        address: hatsModule,
        abi: HATS_MODULE_CONVICTION_ABI,
        functionName: "setConvictionStrategies" as const,
        args: [params.gardenAddress, params.strategies] as const,
      };

      if (authMode === "passkey" && smartAccountClient?.account) {
        const data = encodeFunctionData({
          abi: request.abi,
          functionName: request.functionName,
          args: request.args,
        });

        return smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: request.address,
          value: 0n,
          data,
        });
      }

      return writeContractAsync({
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
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

      const normalizedGarden = params.gardenAddress.toLowerCase();
      queryInvalidation
        .onConvictionStrategiesUpdated(normalizedGarden, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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
