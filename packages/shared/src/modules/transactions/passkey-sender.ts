/**
 * Passkey Transaction Sender
 *
 * Persists the UserOperation identity before waiting for execution. Only an
 * explicitly successful operation establishes the returned transaction hash.
 *
 * @module modules/transactions/passkey-sender
 */

import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData } from "viem";
import { logger } from "../app/logger";
import { assertLocalArbitrumForkSmartAccountsDisabled } from "./local-fork-safety";
import {
  TransactionRevertedError,
  type BroadcastConfirmation,
  type BroadcastReference,
  type ContractCall,
  type TransactionSender,
  type TransactionSendOptions,
  type TxResult,
} from "./types";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";

export interface PasskeySenderDeps {
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

  async sendContractCall(
    call: ContractCall,
    options: TransactionSendOptions = {}
  ): Promise<TxResult> {
    await this.deps.assertWriteSafety?.();

    const data = encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as unknown[],
    });

    await options.assertOwnership?.();
    const operationHash = await this.client.sendUserOperation({
      account: this.client.account!,
      calls: [{ to: call.address, value: call.value ?? 0n, data }],
    });
    await options.onBroadcastReference?.({ kind: "user-operation", hash: operationHash });
    const receipt = await this.client.waitForUserOperationReceipt({
      hash: operationHash,
      timeout: TX_RECEIPT_TIMEOUT_MS,
    });
    if (!receipt.success)
      throw new TransactionRevertedError(operationHash, "UserOperation execution reverted");
    const hash = receipt.receipt.transactionHash;
    await options.onBroadcast?.(hash);

    logger.debug("Passkey transaction sent", {
      source: "PasskeySender",
      functionName: call.functionName,
      address: call.address,
      hash,
    });

    return { hash, sponsored: true };
  }

  async reconcileBroadcast(reference: BroadcastReference): Promise<BroadcastConfirmation> {
    if (reference.kind !== "user-operation") return { status: "unresolved" };
    try {
      const receipt = await this.client.getUserOperationReceipt({ hash: reference.hash });
      if (!receipt) return { status: "unresolved" };
      return receipt.success
        ? { status: "confirmed", transactionHash: receipt.receipt.transactionHash }
        : { status: "reverted" };
    } catch {
      return { status: "unresolved" };
    }
  }

  async sendBatch(calls: ContractCall[]): Promise<TxResult> {
    if (calls.length === 0) {
      throw new Error("Cannot send empty batch");
    }

    // This sender advertises no atomic batching; preserve sequential call semantics.
    let lastResult: TxResult | null = null;
    for (const call of calls) {
      lastResult = await this.sendContractCall(call);
    }

    return lastResult!;
  }
}
