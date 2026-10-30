/**
 * Passkey Transaction Sender
 *
 * Persists the UserOperation identity before waiting for execution. Only an
 * explicitly successful operation establishes the returned transaction hash.
 *
 * @module modules/transactions/passkey-sender
 */

import type { SmartAccountClient } from "permissionless";
import { encodeFunctionData, toEventSelector, type Hex } from "viem";
import type { SmartAccountClientResolver } from "../../types/auth";
import {
  assertSmartAccountClient,
  assertSmartAccountClientResolverActive,
  SmartAccountClientError,
} from "../auth/smartAccountClientResolver";
import { getUserOperationHash } from "viem/account-abstraction";
import { logger } from "../app/logger";
import { assertLocalArbitrumForkSmartAccountsDisabled } from "./local-fork-safety";
import {
  assertTypedDataChain,
  TransactionRevertedError,
  type BroadcastConfirmation,
  type BroadcastReference,
  type AccountTypedDataRequest,
  type ContractCall,
  type TransactionSender,
  type TransactionSendOptions,
  type TxResult,
} from "./types";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import type { Address } from "../../types/domain";

const KERNEL_TRY_FAILURE = toEventSelector("TryExecuteUnsuccessful(uint256,bytes)");

function kernelCallFailed(
  logs: readonly { address: Address; topics: readonly Hex[] }[],
  account: Address
): boolean {
  if (!Array.isArray(logs)) throw new Error("UserOperation receipt is missing scoped logs");
  // These are the operation's own logs. The nested execution receipt also contains other UserOperations.
  return logs.some(
    (log) =>
      log.address.toLowerCase() === account.toLowerCase() &&
      log.topics[0]?.toLowerCase() === KERNEL_TRY_FAILURE.toLowerCase()
  );
}

interface PasskeySenderDeps {
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

  async signTypedData(
    request: AccountTypedDataRequest,
    options: TransactionSendOptions = {}
  ): Promise<Hex> {
    assertTypedDataChain(request);
    if (!this.deps.resolveSmartAccountClient)
      throw new SmartAccountClientError("resolver_unavailable");
    const client = await this.deps.resolveSmartAccountClient(request.chainId);
    assertSmartAccountClient(client, request.chainId, this.client.account!.address);
    assertSmartAccountClient(client, request.chainId, request.account);
    const assertSigner = async () => {
      assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
      await options.assertOwnership?.();
    };
    await assertSigner();
    // The account owns Kernel's ERC-1271 signature wrapping; an EOA cannot sign for it.
    const signature = await client.account!.signTypedData(request.data);
    await assertSigner();
    return signature;
  }

  async sendContractCall(
    call: ContractCall,
    options: TransactionSendOptions = {}
  ): Promise<TxResult> {
    await this.deps.assertWriteSafety?.();
    if (call.gasBuffer !== undefined && call.gasBuffer < 0n) throw new Error("Invalid gas buffer");

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

    const calls = [{ to: call.address, value: call.value ?? 0n, data }];
    const callGasLimit = call.gasBuffer
      ? (await client.estimateUserOperationGas({ calls })).callGasLimit + call.gasBuffer
      : undefined;
    assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
    await options.assertOwnership?.();
    const operationHash = await client.sendUserOperation({
      account: this.reportingAccount(client, options),
      calls,
      ...(callGasLimit !== undefined ? { callGasLimit } : {}),
    });
    await options.onBroadcastReference?.({ kind: "user-operation", hash: operationHash, chainId });
    const receipt = await client.waitForUserOperationReceipt({
      hash: operationHash,
      timeout: TX_RECEIPT_TIMEOUT_MS,
    });
    if (
      receipt.userOpHash.toLowerCase() !== operationHash.toLowerCase() ||
      receipt.sender.toLowerCase() !== client.account!.address.toLowerCase()
    ) {
      throw new Error("UserOperation receipt does not match the submitted operation");
    }
    if (
      receipt.success !== true ||
      receipt.receipt.status !== "success" ||
      kernelCallFailed(receipt.logs, client.account!.address)
    )
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

  /**
   * viem prepares the operation (estimation and sponsorship), asks the account
   * to sign it, and then broadcasts. Wrapping the signature is the one seam
   * between an approved prompt and the network: a declined prompt or a refused
   * sponsorship throws before `onBeforeBroadcast` runs.
   */
  private reportingAccount(client: SmartAccountClient, options: TransactionSendOptions) {
    const account = client.account!;
    const clientChainId = client.chain?.id;
    const signUserOperation: typeof account.signUserOperation = async (userOperation) => {
      const signature = await account.signUserOperation(userOperation);
      // A WebAuthn prompt can outlive the session that opened it. Check again
      // at the last point before viem can submit the signed operation.
      assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
      await options.assertOwnership?.();
      const chainId = userOperation.chainId ?? clientChainId;
      await options.onBeforeBroadcast?.(
        chainId === undefined
          ? undefined
          : {
              kind: "user-operation",
              chainId,
              // Hashed the way the account signs it, so it matches the bundler's return.
              hash: getUserOperationHash({
                chainId,
                entryPointAddress: account.entryPoint.address,
                entryPointVersion: account.entryPoint.version,
                userOperation: {
                  ...userOperation,
                  sender: userOperation.sender ?? account.address,
                  signature,
                } as Parameters<typeof getUserOperationHash>[0]["userOperation"],
              }),
            }
      );
      return signature;
    };
    // The account's own methods read shared state through `this`, so every
    // other lookup falls through to the real account.
    return Object.create(account, {
      signUserOperation: { value: signUserOperation, enumerable: true },
    }) as typeof account;
  }

  async reconcileBroadcast(reference: BroadcastReference): Promise<BroadcastConfirmation> {
    if (reference.kind !== "user-operation") return { status: "unresolved" };
    try {
      const chainId = reference.chainId ?? this.client.chain?.id;
      if (chainId === undefined) return { status: "unresolved" };
      const client = this.deps.resolveSmartAccountClient
        ? await this.deps.resolveSmartAccountClient(chainId)
        : this.client;
      assertSmartAccountClient(client, chainId, this.client.account!.address);
      const receipt = await client.getUserOperationReceipt({ hash: reference.hash });
      if (!receipt) return { status: "unresolved" };
      if (
        receipt.userOpHash.toLowerCase() !== reference.hash.toLowerCase() ||
        receipt.sender.toLowerCase() !== client.account!.address.toLowerCase()
      )
        return { status: "unresolved" };
      return receipt.success &&
        receipt.receipt.status === "success" &&
        !kernelCallFailed(receipt.logs, client.account!.address)
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
