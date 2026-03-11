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
  waitForTransactionReceipt as defaultWaitForReceipt,
  writeContract as defaultWriteContract,
  type Config,
} from "@wagmi/core";
import type { Hex } from "viem";
import { logger } from "../app/logger";
import type { ContractCall, TransactionSender, TxResult } from "./types";

/** Injectable wagmi functions for testability */
export interface EmbeddedSenderDeps {
  writeContract: (config: Config, params: Record<string, unknown>) => Promise<Hex>;
  waitForTransactionReceipt: (config: Config, params: { hash: Hex }) => Promise<{ status: string }>;
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
    };
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    // TODO: Use EIP-5792 sendCalls with paymasterService capability when
    // @wagmi/core/experimental becomes available:
    //
    // const id = await sendCalls(this.config, {
    //   calls: [{ to: call.address, data: encodeFunctionData(...), value: call.value }],
    //   capabilities: {
    //     paymasterService: { url: this.erc7677ProxyUrl },
    //   },
    // });
    // const status = await getCallsStatus(this.config, { id });
    // return { hash: status.receipts[0].transactionHash, sponsored: true };

    const hash = await this.deps.writeContract(this.config, {
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as unknown[],
      ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
    });

    const receipt = await this.deps.waitForTransactionReceipt(this.config, { hash });
    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted on-chain");
    }

    logger.debug("Embedded transaction sent", {
      source: "EmbeddedSender",
      functionName: call.functionName,
      address: call.address,
      hash,
      erc7677ProxyUrl: this.erc7677ProxyUrl,
    });

    return { hash, sponsored: false };
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
