/**
 * Passkey Transaction Sender
 *
 * Sends transactions via a SmartAccountClient (Pimlico bundler).
 * UserOps are gas-sponsored by default. The bundler waits for
 * UserOp inclusion, so the returned hash is confirmed on-chain.
 *
 * @module modules/transactions/passkey-sender
 */

import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData } from "viem";
import { logger } from "../app/logger";
import type { ContractCall, TransactionSender, TxResult } from "./types";

export class PasskeySender implements TransactionSender {
  readonly supportsSponsorship = true;
  readonly supportsBatching = false;
  readonly authMode = "passkey" as const;

  private client: SmartAccountClient;

  constructor(smartAccountClient: SmartAccountClient) {
    this.client = smartAccountClient;
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    const data = encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as unknown[],
    });

    const hash = await this.client.sendTransaction({
      account: this.client.account!,
      chain: this.client.chain,
      to: call.address,
      value: call.value ?? 0n,
      data,
    });

    logger.debug("Passkey transaction sent", {
      source: "PasskeySender",
      functionName: call.functionName,
      address: call.address,
      hash,
    });

    return { hash, sponsored: true };
  }

  async sendBatch(calls: ContractCall[]): Promise<TxResult> {
    if (calls.length === 0) {
      throw new Error("Cannot send empty batch");
    }

    // TODO: When permissionless supports sendUserOperation with multiple calls,
    // use that for atomic batching. For now, send calls sequentially.
    let lastResult: TxResult | null = null;
    for (const call of calls) {
      lastResult = await this.sendContractCall(call);
    }

    return lastResult!;
  }
}
