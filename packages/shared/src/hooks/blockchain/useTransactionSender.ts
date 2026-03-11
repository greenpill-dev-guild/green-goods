/**
 * React hook wrapper around the TransactionSender factory.
 *
 * Reads auth state from useUser() and wagmi config to create the
 * appropriate TransactionSender for the current authentication mode.
 *
 * @module hooks/blockchain/useTransactionSender
 *
 * @example
 * ```tsx
 * function TransferButton() {
 *   const sender = useTransactionSender();
 *
 *   const handleTransfer = async () => {
 *     const result = await sender.sendContractCall({
 *       address: contractAddress,
 *       abi: erc20Abi,
 *       functionName: "transfer",
 *       args: [to, amount],
 *     });
 *     console.log("Tx hash:", result.hash, "Sponsored:", result.sponsored);
 *   };
 * }
 * ```
 */

import { useMemo } from "react";
import { ENV } from "varlock/env";
import { useConfig, useWriteContract } from "wagmi";
import { createTransactionSender } from "../../modules/transactions/factory";
import type { TransactionSender } from "../../modules/transactions/types";
import { useUser } from "../auth/useUser";

/**
 * Returns a TransactionSender instance that matches the current auth mode.
 *
 * - passkey mode -> PasskeySender (gas-sponsored via bundler)
 * - embedded mode -> EmbeddedSender (plain writeContract until EIP-5792 paymaster is available)
 * - wallet mode -> WalletSender (user pays gas, fallback from EIP-5792)
 *
 * Returns null when authentication is not yet initialized.
 */
export function useTransactionSender(): TransactionSender | null {
  const { authMode, smartAccountClient } = useUser();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const erc7677ProxyUrl = ENV.VITE_ERC7677_PROXY_URL as string | undefined;

  return useMemo(() => {
    if (!authMode) return null;

    try {
      return createTransactionSender({
        authMode,
        smartAccountClient,
        wagmiConfig: config,
        writeContractAsync: writeContractAsync as any,
        erc7677ProxyUrl,
      });
    } catch {
      // If required deps aren't available yet (e.g., smartAccountClient
      // loading during passkey init), return null gracefully.
      return null;
    }
  }, [authMode, smartAccountClient, writeContractAsync, config, erc7677ProxyUrl]);
}
