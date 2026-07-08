import { useMutation } from "@tanstack/react-query";
import { getAddress } from "viem";
import type { Address } from "../../types/domain";
import { WETH_DEPOSIT_ABI } from "../../utils/blockchain/abis";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { shouldShowErrorToast, type VaultMutationOptions } from "./vault-helpers";

const OCTANT_V2_ETHEREUM_CHAIN_ID = 1;
const CANONICAL_MAINNET_WETH_ADDRESS = getAddress(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
) as Address;

export interface WrapEthToWethParams {
  chainId: number;
  wethAddress: Address;
  amount: bigint;
}

export function useWrapEthToWeth(options: VaultMutationOptions = {}) {
  const { authMode, primaryAddress } = useUser();
  const sender = useTransactionSender();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useWrapEthToWeth",
    toastContext: "Octant ETH to WETH",
  });

  const mutation = useMutation({
    mutationFn: async (params: WrapEthToWethParams) => {
      if (params.chainId !== OCTANT_V2_ETHEREUM_CHAIN_ID) {
        throw new Error("ETH to WETH conversion requires Ethereum mainnet chain ID 1");
      }
      if (params.amount <= 0n) {
        throw new Error("Wrap amount must be greater than zero");
      }
      const wethAddress = getAddress(params.wethAddress) as Address;
      if (wethAddress !== CANONICAL_MAINNET_WETH_ADDRESS) {
        throw new Error("ETH to WETH conversion requires canonical Ethereum mainnet WETH");
      }
      if (!sender) {
        throw new Error("TransactionSender not available — auth not initialized");
      }
      if (authMode !== "wallet" || sender.authMode !== "wallet" || !primaryAddress) {
        throw new Error("ETH to WETH conversion requires a connected wallet");
      }

      const result = await sender.sendContractCall({
        address: wethAddress,
        abi: WETH_DEPOSIT_ABI,
        functionName: "deposit",
        args: [],
        chainId: params.chainId,
        value: params.amount,
      });

      return result.hash;
    },
    onError: (error, params) => {
      handleError(error, {
        metadata: {
          chainId: params?.chainId,
          wethAddress: params?.wethAddress,
          amount: params?.amount?.toString(),
        },
        showToast: showErrorToast,
      });
    },
  });

  return useSafeMutation(mutation);
}
