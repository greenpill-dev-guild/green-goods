import { waitForTransactionReceipt } from "@wagmi/core";
import { type Abi, encodeFunctionData } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import { useUser } from "../auth/useUser";

export interface SendContractTxRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

function isCanonicalTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Hook that returns a function to send contract transactions.
 * Handles passkey vs wallet auth branching with encodeFunctionData.
 *
 * For passkey mode: bundler waits for UserOp inclusion (tx is mined).
 * For wallet mode: writeContractAsync returns hash immediately, so we
 * explicitly wait for the receipt to ensure the tx is confirmed before
 * the caller's onSuccess fires.
 */
export function useContractTxSender() {
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

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

    const hash = await writeContractAsync({
      address: request.address,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args as unknown[],
    });

    // Some Safe-style wallets can return a non-canonical hash-like identifier here.
    // waitForTransactionReceipt only accepts canonical tx hashes, so skip waiting
    // and treat this as successfully submitted for off-chain Safe execution flow.
    if (!isCanonicalTxHash(hash)) {
      logger.info("Skipping receipt wait for non-canonical wallet transaction hash", {
        source: "useContractTxSender",
        functionName: request.functionName,
        address: request.address,
        hashPreview: hash.slice(0, 18),
        hashLength: hash.length,
      });
      return hash;
    }

    // Wait for on-chain confirmation and verify the tx was not reverted
    const receipt = await waitForTransactionReceipt(config, { hash });
    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted on-chain");
    }

    return hash;
  };
}
