import { getWalletClient } from "@wagmi/core";
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

import { useMemo, useRef } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { ENV } from "../../lib/env";
import { useConfig, useWriteContract } from "wagmi";
import {
  createTransactionSender,
  type TransactionSenderOptions,
} from "../../modules/transactions/factory";
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
  const { authMode, smartAccountClient, primaryAddress } = useUser();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const erc7677ProxyUrl = ENV.VITE_ERC7677_PROXY_URL as string | undefined;

  const session = useRef({ authMode, smartAccountClient, primaryAddress, generation: 0 });
  if (
    session.current.authMode !== authMode ||
    session.current.smartAccountClient !== smartAccountClient ||
    session.current.primaryAddress !== primaryAddress
  )
    session.current = {
      authMode,
      smartAccountClient,
      primaryAddress,
      generation: session.current.generation + 1,
    };
  return useMemo(() => {
    if (!authMode) return null;

    try {
      const generation = session.current.generation;
      const sender = createTransactionSender({
        authMode,
        smartAccountClient,
        wagmiConfig: config,
        writeContractAsync:
          writeContractAsync as unknown as TransactionSenderOptions["writeContractAsync"],
        erc7677ProxyUrl,
      });
      sender.assertOwnership = async (address, chainId) => {
        if (
          !primaryAddress ||
          address.toLowerCase() !== primaryAddress.toLowerCase() ||
          chainId !== DEFAULT_CHAIN_ID ||
          generation !== session.current.generation
        )
          throw new Error("submission-ownership-changed");
        const wallet = authMode === "passkey" ? null : await getWalletClient(config, { chainId });
        const account = authMode === "passkey" ? smartAccountClient?.account : wallet?.account;
        if (
          account?.address.toLowerCase() !== address.toLowerCase() ||
          (wallet?.chain?.id !== undefined && wallet.chain.id !== chainId) ||
          (authMode === "passkey" && smartAccountClient?.chain?.id !== chainId)
        )
          throw new Error("submission-ownership-changed");
      };
      return sender;
    } catch {
      // If required deps aren't available yet (e.g., smartAccountClient
      // loading during passkey init), return null gracefully.
      return null;
    }
  }, [authMode, smartAccountClient, primaryAddress, writeContractAsync, config, erc7677ProxyUrl]);
}
