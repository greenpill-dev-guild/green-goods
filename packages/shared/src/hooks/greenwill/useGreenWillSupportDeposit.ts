import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";
import { useCallback, useRef } from "react";
import { getWagmiConfig } from "../../config/appkit";
import { INDEXER_LAG_SCHEDULE_MS, queryInvalidation, queryKeys } from "../../config/query-keys";
import type { GreenWillSupportDepositParams } from "../../types/greenwill";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import {
  ERC20_ALLOWANCE_ABI,
  getNetworkContracts,
  GreenWillSupportRouterABI,
} from "../../utils/blockchain/contracts";
import { normalizeAddress, ZERO_ADDRESS } from "../../utils/blockchain/address";

export function useGreenWillSupportDeposit() {
  const queryClient = useQueryClient();
  const sender = useTransactionSender();
  const { primaryAddress } = useUser();
  const chainId = useCurrentChain();
  const routerAddress = getNetworkContracts(chainId).greenWillSupportRouter;
  const lastGardenRef = useRef<string>("");
  const invalidate = useCallback(
    (gardenAddress?: string) => {
      if (gardenAddress) {
        queryInvalidation
          .onVaultDeposit(
            normalizeAddress(gardenAddress),
            primaryAddress ? normalizeAddress(primaryAddress) : undefined,
            chainId
          )
          .forEach((queryKey) => {
            void queryClient.invalidateQueries({ queryKey });
          });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.greenWill.all });
      if (primaryAddress) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.greenWill.ownership(normalizeAddress(primaryAddress), chainId),
        });
      }
    },
    [chainId, primaryAddress, queryClient]
  );
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    () => invalidate(lastGardenRef.current || undefined),
    INDEXER_LAG_SCHEDULE_MS
  );

  const mutation = useMutation({
    mutationFn: async (params: GreenWillSupportDepositParams) => {
      if (!sender) throw new Error("TransactionSender not available — auth not initialized");
      if (!primaryAddress) throw new Error("Connected account required");
      if (!routerAddress || routerAddress === ZERO_ADDRESS) {
        throw new Error("GreenWill support router not configured for this network");
      }

      const allowanceResult = await readContract(getWagmiConfig(), {
        address: params.assetAddress,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [primaryAddress, routerAddress],
      });
      const allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;

      if (allowance < params.amount) {
        await sender.sendContractCall({
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "approve",
          args: [routerAddress, params.amount],
        });
      }

      const result = await sender.sendContractCall({
        address: routerAddress,
        abi: GreenWillSupportRouterABI,
        functionName: "fundVault",
        args: [params.gardenAddress, params.assetAddress, params.amount],
      });

      return { hash: result.hash, gardenAddress: params.gardenAddress };
    },
    onSuccess: (result) => {
      lastGardenRef.current = result.gardenAddress;
      invalidate(result.gardenAddress);
      scheduleFollowUp();
    },
  });

  return useSafeMutation(mutation);
}
