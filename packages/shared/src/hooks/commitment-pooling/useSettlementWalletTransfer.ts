import { useMutation, useQueryClient } from "@tanstack/react-query";

import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { isGardenerDeliveryEnabled } from "../../modules/commitment-pooling/account-profiles";
import type { Address } from "../../types/domain";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useTransactionSender } from "../blockchain/useTransactionSender";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface SettlementWalletTransferInput {
  token: Address;
  to: Address;
  amount: bigint;
}

/**
 * Online-only Celo wallet delivery. This action never enters the offline queue and
 * remains unavailable until the indexed production flag and separately recorded
 * Kernel 0.3.1 mainnet evidence are both true.
 */
export function useSettlementWalletTransfer(options: {
  primaryChainId: number;
  chainId: number;
  indexedGardenerDeliveryEnabled: boolean | null;
  mainnetEvidenceReady: boolean;
}) {
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const enabled = isGardenerDeliveryEnabled({
    sourceChainId: options.primaryChainId,
    chainId: options.chainId,
    indexed: options.indexedGardenerDeliveryEnabled,
    mainnetEvidenceReady: options.mainnetEvidenceReady,
  });
  const handleError = createMutationErrorHandler({
    source: "useSettlementWalletTransfer",
    toastContext: "wallet transfer",
  });

  const mutation = useMutation({
    mutationFn: async (input: SettlementWalletTransferInput) => {
      if (!enabled) throw new Error("Gardener delivery is unavailable");
      if (!sender) throw new Error("Transaction sender is unavailable");
      if (input.amount <= 0n) throw new Error("Transfer amount must be positive");
      const result = await sender.sendContractCall({
        address: input.token,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [input.to, input.amount],
        chainId: options.chainId,
      });
      return result.hash;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: commitmentPoolingKeys.settlementConfiguration(options.chainId),
      });
    },
    onError: (error, input) => {
      const parsed = parseContractError(error);
      handleError(error, {
        metadata: {
          action: "transfer",
          chainId: options.chainId,
          token: input.token,
          parsedErrorName: parsed.name,
        },
      });
    },
  });

  return { ...mutation, enabled };
}
