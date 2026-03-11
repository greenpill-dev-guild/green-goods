/**
 * External Wallet Transaction Sender
 *
 * Sends transactions via wagmi's writeContractAsync (from useWriteContract).
 * The user pays gas directly. Handles Safe wallet non-canonical hashes
 * by skipping the receipt wait.
 *
 * Future enhancement: try EIP-5792 sendCalls with paymasterService first,
 * falling back to direct writeContractAsync when the wallet doesn't support it.
 *
 * @module modules/transactions/wallet-sender
 */

import { waitForTransactionReceipt as defaultWaitForReceipt, type Config } from "@wagmi/core";
import type { Hex } from "viem";
import { logger } from "../app/logger";
import type { ContractCall, TransactionSender, TxResult } from "./types";

/**
 * Check whether a hash is a canonical 66-char tx hash (0x + 64 hex chars).
 * Safe-style wallets can return longer or non-standard identifiers.
 */
function isCanonicalTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/** Injectable dependency for testability */
export interface WalletSenderDeps {
  waitForTransactionReceipt: (config: Config, params: { hash: Hex }) => Promise<{ status: string }>;
}

export class WalletSender implements TransactionSender {
  readonly supportsSponsorship = false;
  readonly supportsBatching = false;
  readonly authMode = "wallet" as const;

  private config: Config;
  private writeContractAsync: (params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) => Promise<`0x${string}`>;
  private erc7677ProxyUrl?: string;
  private deps: WalletSenderDeps;

  constructor(
    wagmiConfig: Config,
    writeContractAsync: (params: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) => Promise<`0x${string}`>,
    erc7677ProxyUrl?: string,
    deps?: WalletSenderDeps
  ) {
    this.config = wagmiConfig;
    this.writeContractAsync = writeContractAsync;
    this.erc7677ProxyUrl = erc7677ProxyUrl;
    this.deps = deps ?? {
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as WalletSenderDeps["waitForTransactionReceipt"],
    };
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    // TODO: Try EIP-5792 sendCalls with paymasterService first when available.
    // Fall back to direct writeContractAsync if the wallet doesn't support it.

    // Cast to string to allow non-canonical hash detection (Safe wallets
    // can return identifiers that don't match `0x${string}` at runtime).
    const hash: string = await this.writeContractAsync({
      address: call.address as `0x${string}`,
      abi: call.abi as readonly unknown[],
      functionName: call.functionName,
      args: call.args,
    });

    // Some Safe-style wallets return a non-canonical hash-like identifier.
    // waitForTransactionReceipt only accepts canonical tx hashes, so skip
    // waiting and treat this as successfully submitted for off-chain Safe
    // execution flow.
    if (!isCanonicalTxHash(hash)) {
      logger.info("Skipping receipt wait for non-canonical wallet transaction hash", {
        source: "WalletSender",
        functionName: call.functionName,
        address: call.address,
        hashPreview: hash.slice(0, 18),
        hashLength: hash.length,
      });
      return { hash: hash as Hex, sponsored: false };
    }

    // Wait for on-chain confirmation and verify the tx was not reverted
    const receipt = await this.deps.waitForTransactionReceipt(this.config, { hash });
    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted on-chain");
    }

    logger.debug("Wallet transaction confirmed", {
      source: "WalletSender",
      functionName: call.functionName,
      address: call.address,
      hash,
    });

    return { hash, sponsored: false };
  }

  // sendBatch is intentionally not implemented for wallet mode.
  // External wallets don't natively support atomic batching.
  // The interface's optional sendBatch? property allows this.
}
