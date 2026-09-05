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
import type { SmartAccountClientResolver } from "../../types/auth";
import {
  assertSmartAccountClient,
  assertSmartAccountClientResolverActive,
  SmartAccountClientError,
} from "../auth/smartAccountClientResolver";
import { logger } from "../app/logger";
import { assertLocalArbitrumForkSmartAccountsDisabled } from "./local-fork-safety";
import type { ContractCall, TransactionSender, TxResult } from "./types";

export interface PasskeySenderDeps {
  resolveSmartAccountClient?: SmartAccountClientResolver | null;
  assertWriteSafety?: () => Promise<void>;
}

export class PasskeySender implements TransactionSender {
  readonly supportsSponsorship = true;
  readonly supportsBatching = false;
  readonly authMode = "passkey" as const;

  private client: SmartAccountClient;
  private deps: PasskeySenderDeps;

  constructor(smartAccountClient: SmartAccountClient, deps?: PasskeySenderDeps) {
    this.client = smartAccountClient;
    this.deps = deps ?? {
      assertWriteSafety: async () => assertLocalArbitrumForkSmartAccountsDisabled(),
    };
    this.deps.assertWriteSafety ??= async () => assertLocalArbitrumForkSmartAccountsDisabled();
  }

  async sendContractCall(call: ContractCall): Promise<TxResult> {
    await this.deps.assertWriteSafety?.();

    const chainId = call.chainId ?? this.client.chain?.id;
    if (chainId === undefined) throw new SmartAccountClientError("chain_mismatch");
    if (call.chainId !== undefined && !this.deps.resolveSmartAccountClient) {
      throw new SmartAccountClientError("resolver_unavailable");
    }
    const client = this.deps.resolveSmartAccountClient
      ? await this.deps.resolveSmartAccountClient(chainId)
      : this.client;
    if (!this.client.account) throw new SmartAccountClientError("address_mismatch");
    assertSmartAccountClient(client, chainId, this.client.account.address);
    if (call.account) assertSmartAccountClient(client, chainId, call.account);

    const data = encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as unknown[],
    });

    assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
    const hash = await client.sendTransaction({
      account: client.account!,
      chain: client.chain,
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
