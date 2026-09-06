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

import {
  getAccount as defaultGetAccount,
  waitForTransactionReceipt as defaultWaitForReceipt,
  type Config,
} from "@wagmi/core";
import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { assertWalletAccount, ensureWagmiWalletChain } from "./chain-guard";
import { assertLocalArbitrumForkWallet } from "./local-fork-safety";
import {
  TransactionReplacementError,
  type ContractCall,
  type TransactionSender,
  type TxResult,
} from "./types";

/**
 * Check whether a hash is a canonical 66-char tx hash (0x + 64 hex chars).
 * Safe-style wallets can return longer or non-standard identifiers.
 */
function isCanonicalTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/** Injectable dependency for testability */
export interface WalletSenderDeps {
  waitForTransactionReceipt: (
    config: Config,
    params: {
      hash: Hex;
      chainId?: number;
      onReplaced?: (replacement: { reason: "cancelled" | "replaced" | "repriced" }) => void;
    }
  ) => Promise<{ status: string; transactionHash?: Hex }>;
  getAccount?: () => { address?: Address };
  assertWriteSafety?: () => Promise<void>;
  ensureWalletChain?: (chainId: number) => Promise<void>;
}

export class WalletSender implements TransactionSender {
  readonly supportsSponsorship = false;
  readonly supportsBatching = false;
  readonly authMode = "wallet" as const;

  private config: Config;
  private writeContractAsync: (params: {
    address: `0x${string}`;
    account?: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    chainId?: number;
    value?: bigint;
  }) => Promise<`0x${string}`>;
  private deps: WalletSenderDeps;

  constructor(
    wagmiConfig: Config,
    writeContractAsync: (params: {
      address: `0x${string}`;
      account?: Address;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
      chainId?: number;
      value?: bigint;
    }) => Promise<`0x${string}`>,
    _erc7677ProxyUrl?: string,
    deps?: WalletSenderDeps
  ) {
    this.config = wagmiConfig;
    this.writeContractAsync = writeContractAsync;
    this.deps = deps ?? {
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as WalletSenderDeps["waitForTransactionReceipt"],
      assertWriteSafety: assertLocalArbitrumForkWallet,
      ensureWalletChain: (chainId: number) => ensureWagmiWalletChain(this.config, chainId),
    };
    this.deps.getAccount ??= () => defaultGetAccount(this.config);
    this.deps.assertWriteSafety ??= assertLocalArbitrumForkWallet;
    this.deps.ensureWalletChain ??= (chainId: number) =>
      ensureWagmiWalletChain(this.config, chainId);
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    // TODO: Try EIP-5792 sendCalls with paymasterService first when available.
    // Fall back to direct writeContractAsync if the wallet doesn't support it.

    // Cast to string to allow non-canonical hash detection (Safe wallets
    // can return identifiers that don't match `0x${string}` at runtime).
    const chainId = call.chainId ?? DEFAULT_CHAIN_ID;
    await this.deps.ensureWalletChain?.(chainId);
    await this.deps.assertWriteSafety?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);

    const hash: string = await this.writeContractAsync({
      ...(call.account ? { account: call.account } : {}),
      address: call.address as `0x${string}`,
      abi: call.abi as readonly unknown[],
      functionName: call.functionName,
      args: call.args,
      chainId,
      ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
    });

    // Some Safe-style wallets return a non-canonical hash-like identifier.
    // waitForTransactionReceipt only accepts canonical tx hashes, so skip
    // waiting and treat this as successfully submitted for off-chain Safe
    // execution flow.
    if (!isCanonicalTxHash(hash)) {
      // No address or hash material in the log context: aggregated logs must
      // stay free of identifying transaction data (short Safe identifiers
      // would otherwise be logged in full via a "preview").
      logger.info("Skipping receipt wait for non-canonical wallet transaction hash", {
        source: "WalletSender",
        functionName: call.functionName,
        hashLength: hash.length,
      });
      return { hash: hash as Hex, sponsored: false };
    }

    // Wait for on-chain confirmation and verify the tx was not reverted
    let invalidReplacement: "cancelled" | "replaced" | undefined;
    const receipt = await this.deps.waitForTransactionReceipt(this.config, {
      hash,
      chainId,
      onReplaced: ({ reason }) => {
        if (reason !== "repriced") invalidReplacement = reason;
      },
    });
    if (invalidReplacement) throw new TransactionReplacementError(invalidReplacement);
    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted on-chain");
    }

    const confirmedHash = receipt.transactionHash ?? hash;
    logger.debug("Wallet transaction confirmed", {
      source: "WalletSender",
      functionName: call.functionName,
      address: call.address,
      hash: confirmedHash,
    });

    return { hash: confirmedHash, sponsored: false };
  }

  // sendBatch is intentionally not implemented for wallet mode.
  // External wallets don't natively support atomic batching.
  // The interface's optional sendBatch? property allows this.
}
