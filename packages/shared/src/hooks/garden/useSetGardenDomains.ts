import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { Address, Domain } from "../../types/domain";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { gardensKeys } from "../../config/query-keys/garden";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";

export interface SetGardenDomainsParams {
  gardenAddress: Address;
  domains: Domain[];
}

/**
 * Mutation hook to update a garden's active domains.
 *
 * Calls `setGardenDomains(address, uint8)` on the ActionRegistry contract.
 * Requires the caller to be a steward of the garden (enforced on-chain).
 *
 * Bit mapping: bit 0 = SOLAR, bit 1 = AGRO, bit 2 = EDU, bit 3 = WASTE.
 */
export function useSetGardenDomains() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetGardenDomains",
    toastContext: "set garden domains",
  });

  const contracts = getNetworkContracts(chainId);

  return useMutation({
    mutationFn: async (params: SetGardenDomainsParams) => {
      if (params.domains.length === 0) {
        throw new Error("At least one domain is required");
      }
      const domainMask = params.domains.reduce((mask, d) => mask | (1 << d), 0);

      return sendContractTx({
        address: contracts.actionRegistry,
        abi: ActionRegistryABI,
        functionName: "setGardenDomains",
        args: [params.gardenAddress, domainMask],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({
          id: "app.garden.domains.updating",
          defaultMessage: "Updating domains...",
        }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({
          id: "app.garden.domains.updateSuccess",
          defaultMessage: "Domains updated",
        }),
      });

      // Invalidate the gardenDomains read query so the UI refreshes
      queryClient.invalidateQueries({
        queryKey: ["readContract", { functionName: "gardenDomains", args: [params.gardenAddress] }],
      });
      // Also refresh the gardens list so consumers that read garden.domainMask
      // (the settings dialog's inline domain selector) re-baseline after a save.
      queryClient.invalidateQueries({ queryKey: gardensKeys.all });
    },
    onError: (error, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}
