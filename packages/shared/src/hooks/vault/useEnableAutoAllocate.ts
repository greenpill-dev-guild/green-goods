import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import type { EnableAutoAllocateParams } from "../../types/vaults";
import { OCTANT_MODULE_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { queryInvalidation } from "../../config/query-keys";
import { useSafeMutation } from "../utils/useSafeMutation";
import { getOctantModuleAddress } from "./vault-helpers";

export function useEnableAutoAllocate() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sender = useTransactionSender();
  const handleError = createMutationErrorHandler({
    source: "useEnableAutoAllocate",
    toastContext: "vault configure",
  });
  const mutation = useMutation({
    mutationFn: async (params: EnableAutoAllocateParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      const octantModule = getOctantModuleAddress(chainId);

      const ownerResult = await readContract(getWagmiConfig(), {
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "owner",
        args: [],
      });
      const moduleOwner = typeof ownerResult === "string" ? ownerResult : "";
      if (moduleOwner.toLowerCase() !== primaryAddress?.toLowerCase()) {
        throw new Error("Only the OctantModule owner can enable auto-allocate");
      }

      const result = await sender.sendContractCall({
        address: octantModule,
        abi: OCTANT_MODULE_ABI,
        functionName: "enableAutoAllocate",
        args: [params.gardenAddress, params.assetAddress],
      });
      return result.hash;
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.treasury.enableAutoAllocate" }),
        message: formatMessage({ id: "app.treasury.enablingAutoAllocate" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.treasury.enableAutoAllocate" }),
        message: formatMessage({ id: "app.treasury.enableAutoAllocateSuccess" }),
      });

      queryInvalidation
        .onVaultDeposit(params.gardenAddress, undefined, chainId)
        .forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

      // Also invalidate all wagmi contract reads (useReadContracts, useReadContract)
      // so that useVaultPreview and diagnostic reads refetch with new vault state.
      // This is an infrequent admin action, so broad invalidation is acceptable.
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && typeof key[0] === "string" && key[0] === "readContracts";
        },
      });
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
