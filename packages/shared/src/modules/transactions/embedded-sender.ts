/**
 * Embedded Wallet Transaction Sender
 *
 * Intended to use EIP-5792 sendCalls with paymaster capability for gas
 * sponsorship. Since wagmi experimental APIs (@wagmi/core/experimental) are
 * not available in the current wagmi version, this implementation falls back
 * to standard writeContract from @wagmi/core — meaning transactions are NOT
 * gas-sponsored yet.
 *
 * When EIP-5792 support is available, sendContractCall and sendBatch should
 * use sendCalls() with paymasterService capability and poll with
 * getCallsStatus() for completion.
 *
 * @module modules/transactions/embedded-sender
 */

import {
  getAccount as defaultGetAccount,
  waitForTransactionReceipt as defaultWaitForReceipt,
  writeContract as defaultWriteContract,
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

/** Injectable wagmi functions for testability */
export interface EmbeddedSenderDeps {
  writeContract: (config: Config, params: Record<string, unknown>) => Promise<Hex>;
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

export class EmbeddedSender implements TransactionSender {
  readonly supportsSponsorship = false;
  readonly supportsBatching = false;
  readonly authMode = "embedded" as const;

  private config: Config;
  private erc7677ProxyUrl: string | undefined;
  private deps: EmbeddedSenderDeps;

  constructor(wagmiConfig: Config, erc7677ProxyUrl?: string, deps?: EmbeddedSenderDeps) {
    this.config = wagmiConfig;
    this.erc7677ProxyUrl = erc7677ProxyUrl;
    this.deps = deps ?? {
      writeContract: defaultWriteContract as unknown as EmbeddedSenderDeps["writeContract"],
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as EmbeddedSenderDeps["waitForTransactionReceipt"],
      assertWriteSafety: assertLocalArbitrumForkWallet,
      ensureWalletChain: (chainId: number) => ensureWagmiWalletChain(this.config, chainId),
    };
    this.deps.getAccount ??= () => defaultGetAccount(this.config);
    this.deps.assertWriteSafety ??= assertLocalArbitrumForkWallet;
    this.deps.ensureWalletChain ??= (chainId: number) =>
      ensureWagmiWalletChain(this.config, chainId);
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    // TODO: Replace with EIP-5792 sendCalls + paymasterService once @wagmi/core/experimental is stable.
    const chainId = call.chainId ?? DEFAULT_CHAIN_ID;
    await this.deps.ensureWalletChain?.(chainId);
    await this.deps.assertWriteSafety?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);

    const hash = await this.deps.writeContract(this.config, {
      ...(call.account ? { account: call.account } : {}),
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as unknown[],
      chainId,
      ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
    });

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
    logger.debug("Embedded transaction sent", {
      source: "EmbeddedSender",
      functionName: call.functionName,
      address: call.address,
      hash: confirmedHash,
      erc7677ProxyUrl: this.erc7677ProxyUrl,
    });

    return { hash: confirmedHash, sponsored: false };
  }

  async sendBatch(calls: ContractCall[]): Promise<TxResult> {
    if (calls.length === 0) {
      throw new Error("Cannot send empty batch");
    }

    // TODO: Use EIP-5792 sendCalls for atomic batching when available.
    // For now, send calls sequentially.
    let lastResult: TxResult | null = null;
    for (const call of calls) {
      lastResult = await this.sendContractCall(call);
    }

    return lastResult!;
  }
}
