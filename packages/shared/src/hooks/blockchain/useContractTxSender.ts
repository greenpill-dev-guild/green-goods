import { type Abi, encodeFunctionData } from "viem";
import { useWriteContract } from "wagmi";
import type { Address } from "../../types/domain";
import { useUser } from "../auth/useUser";

export interface SendContractTxRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

/**
 * Hook that returns a function to send contract transactions.
 * Handles passkey vs wallet auth branching with encodeFunctionData.
 */
export function useContractTxSender() {
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();

  return async (request: SendContractTxRequest): Promise<`0x${string}`> => {
    if (authMode === "passkey" && smartAccountClient?.account) {
      const data = encodeFunctionData({
        abi: request.abi,
        functionName: request.functionName,
        args: request.args as unknown[],
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
      args: request.args as unknown[],
    });
  };
}
