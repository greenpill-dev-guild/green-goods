import type { Abi } from "viem";
import type { Address } from "../../types/domain";
import { useTransactionSender } from "./useTransactionSender";

export interface SendContractTxRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

/**
 * Hook that returns a function to send contract transactions.
 *
 * @deprecated Use `useTransactionSender()` instead, which returns a
 * `TransactionSender` with richer capabilities (batching, sponsorship
 * detection, typed results). This wrapper is kept for backward compatibility.
 */
export function useContractTxSender() {
  const sender = useTransactionSender();

  return async (request: SendContractTxRequest): Promise<`0x${string}`> => {
    if (!sender) {
      throw new Error("TransactionSender not available — auth not initialized");
    }

    const result = await sender.sendContractCall({
      address: request.address,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args,
    });

    return result.hash;
  };
}
