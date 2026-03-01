import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import type { Address } from "../../types/domain";
import { GardenTokenABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";

/**
 * Read the current `openMinting` state from the GardenToken contract.
 */
export function useOpenMinting() {
  const chainId = useCurrentChain();
  const contracts = getNetworkContracts(chainId);

  return useReadContract({
    address: contracts.gardenToken as Address,
    abi: GardenTokenABI,
    functionName: "openMinting",
    query: { enabled: !!contracts.gardenToken },
  });
}

/**
 * Toggle the `openMinting` flag on the GardenToken contract.
 * Calls `setOpenMinting(bool)` — owner-only.
 */
export function useSetOpenMinting() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sendContractTx = useContractTxSender();
  const handleError = createMutationErrorHandler({
    source: "useSetOpenMinting",
    toastContext: "set open minting",
  });

  const contracts = getNetworkContracts(chainId);

  return useMutation({
    mutationFn: async (open: boolean) => {
      return sendContractTx({
        address: contracts.gardenToken as Address,
        abi: GardenTokenABI,
        functionName: "setOpenMinting",
        args: [open],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({
          id: "app.deployment.openMinting.updating",
          defaultMessage: "Updating minting access...",
        }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, open, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage(
          {
            id: "app.deployment.openMinting.success",
            defaultMessage: "Minting is now {status}",
          },
          { status: open ? "open" : "restricted" }
        ),
      });
      queryClient.invalidateQueries({
        queryKey: ["readContract", { functionName: "openMinting" }],
      });
    },
    onError: (error, _open, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {});
    },
  });
}
