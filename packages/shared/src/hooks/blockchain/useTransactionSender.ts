import { ConnectorNotConnectedError, getAccount } from "@wagmi/core";
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
import { isChainSupported } from "../../config/chains";
import { ENV } from "../../lib/env";
import { useConfig, useWriteContract } from "wagmi";
import { refuseWithoutWallet } from "../../modules/auth/wallet-reconnect";
import {
  createTransactionSender,
  type TransactionSenderOptions,
} from "../../modules/transactions/factory";
import type { TransactionSender } from "../../modules/transactions/types";
import { WalletReconnectRequiredError } from "../../utils/errors/unsent-failures";
import { useUser } from "../auth/useUser";

/**
 * A wallet account whose wallet has not answered can read but not sign
 * (PRD-1499). Every way into a signature refuses before anything starts and
 * asks the person to reconnect. The ownership check refuses too, but asks
 * nobody: the job queue also runs it to recheck a send already on record, which
 * waits quietly for the wallet. The wallet's answer is read when the act starts,
 * not when the sender was made, so a wallet that came back meanwhile sends.
 */
function refuseUntilWalletAnswers(sender: TransactionSender, unanswered: () => boolean): void {
  const guard = () => {
    if (unanswered()) refuseWithoutWallet();
  };
  const { assertOwnership, sendContractCall, sendAtomicBatch, submitAtomicBatch, signTypedData } =
    sender;
  sender.assertReadyToSign = guard;
  sender.readyToSign = () => !unanswered();
  sender.assertOwnership = async (address, chainId) => {
    if (unanswered()) throw new WalletReconnectRequiredError(false);
    await assertOwnership?.(address, chainId);
  };
  // Each send runs on the sender it was called on: the job queue calls them on a
  // sender of its own made from this one, whose ownership check adds its claim.
  sender.sendContractCall = async function (this: TransactionSender, call, options) {
    guard();
    return sendContractCall.call(this, call, options);
  };
  if (sendAtomicBatch)
    sender.sendAtomicBatch = async function (this: TransactionSender, calls, options) {
      guard();
      return sendAtomicBatch.call(this, calls, options);
    };
  if (submitAtomicBatch)
    sender.submitAtomicBatch = async function (this: TransactionSender, calls, options) {
      guard();
      return submitAtomicBatch.call(this, calls, options);
    };
  if (signTypedData)
    sender.signTypedData = async function (this: TransactionSender, request, options) {
      guard();
      return signTypedData.call(this, request, options);
    };
}

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
  const {
    authMode,
    smartAccountClient,
    resolveSmartAccountClient,
    primaryAddress,
    passkeyAccountProfile,
    walletRestore,
  } = useUser();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  const walletUnanswered = useRef(false);
  walletUnanswered.current = authMode === "wallet" && Boolean(walletRestore);

  const erc7677ProxyUrl = ENV.VITE_ERC7677_PROXY_URL as string | undefined;

  const session = useRef({
    authMode,
    smartAccountClient,
    resolveSmartAccountClient,
    primaryAddress,
    generation: 0,
  });
  if (
    session.current.authMode !== authMode ||
    session.current.smartAccountClient !== smartAccountClient ||
    session.current.resolveSmartAccountClient !== resolveSmartAccountClient ||
    session.current.primaryAddress !== primaryAddress
  )
    session.current = {
      authMode,
      smartAccountClient,
      resolveSmartAccountClient,
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
        resolveSmartAccountClient,
        passkeyAccountProfile,
        wagmiConfig: config,
        writeContractAsync:
          writeContractAsync as unknown as TransactionSenderOptions["writeContractAsync"],
        erc7677ProxyUrl,
      });
      sender.assertOwnership = async (address, chainId) => {
        if (
          !primaryAddress ||
          address.toLowerCase() !== primaryAddress.toLowerCase() ||
          !isChainSupported(chainId) ||
          generation !== session.current.generation
        )
          throw new Error("submission-ownership-changed");
        if (authMode === "passkey") {
          const client =
            smartAccountClient?.chain?.id === chainId
              ? smartAccountClient
              : await resolveSmartAccountClient?.(chainId);
          if (
            client?.account?.address.toLowerCase() !== address.toLowerCase() ||
            client?.chain?.id !== chainId
          )
            throw new Error("submission-ownership-changed");
        } else {
          // This checks who signs. The network is the sender's job: its chain
          // guard moves the wallet to `chainId` just before writing, and the
          // write refuses any other network. Asking wagmi for a wallet client
          // on `chainId` here refused every queued wallet act while the wallet
          // sat on another network, before the guard could switch it
          // (2026-10-01). The connection's account is what that client would
          // have signed with.
          const wallet = getAccount(config);
          // A wallet that dropped while the member stays signed in, or one wagmi
          // is still reconnecting (its connector is a stored stub), fails the
          // way the wallet client did: as a wallet to reconnect, not as someone
          // else's job to skip quietly.
          if (!wallet.address || typeof wallet.connector?.getChainId !== "function")
            throw new ConnectorNotConnectedError();
          if (wallet.address.toLowerCase() !== address.toLowerCase())
            throw new Error("submission-ownership-changed");
        }
        if (generation !== session.current.generation)
          throw new Error("submission-ownership-changed");
      };
      if (authMode === "wallet") refuseUntilWalletAnswers(sender, () => walletUnanswered.current);
      return sender;
    } catch {
      // If required deps aren't available yet (e.g., smartAccountClient
      // loading during passkey init), return null gracefully.
      return null;
    }
  }, [
    authMode,
    smartAccountClient,
    resolveSmartAccountClient,
    primaryAddress,
    passkeyAccountProfile,
    writeContractAsync,
    config,
    erc7677ProxyUrl,
  ]);
}
