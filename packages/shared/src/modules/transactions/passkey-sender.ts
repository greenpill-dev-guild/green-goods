/**
 * Passkey Transaction Sender
 *
 * Persists the UserOperation identity before waiting for execution. Only an
 * explicitly successful operation establishes the returned transaction hash.
 *
 * @module modules/transactions/passkey-sender
 */

import type { SmartAccountClient } from "permissionless";
import { decodeFunctionData, encodeFunctionData, parseAbi, toEventSelector, type Hex } from "viem";
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
  type AtomicBatchOptions,
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
import {
  assertBatchCapabilityKnown,
  atomicBatchTxResult,
  BatchNotSubmittedError,
  type BatchBudget,
  type BatchCapability,
  type BatchExecution,
  type BatchReference,
  type BatchScope,
  type BatchSendOptions,
} from "./batch-types";
import { prepareBatch } from "./prepared-batch";
import { assertBatchCalls, quoteUserOperation } from "./batch-budget";
import { type AtomicBatchAction, isBatchEnabled } from "./batch-enablement";
import type { PasskeyAccountProfileId } from "../auth/account-profile";

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
  /** What the enablement list is keyed by. Without it, this sender groups nothing for a caller. */
  accountProfile?: PasskeyAccountProfileId | null;
}

export class PasskeySender implements TransactionSender {
  readonly supportsSponsorship = true;
  readonly supportsBatching = false;
  readonly authMode = "passkey" as const;

  assertOwnership?: TransactionSender["assertOwnership"];

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
    return this.executeCalls([call], options);
  }

  private async executeCalls(
    calls: readonly ContractCall[],
    options: TransactionSendOptions,
    atomic = false
  ): Promise<TxResult> {
    const call = calls[0];
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

    for (const current of calls) {
      if (
        (current.chainId !== undefined && current.chainId !== chainId) ||
        (current.account && current.account.toLowerCase() !== client.account!.address.toLowerCase())
      )
        throw new Error("batch-scope-mismatch");
    }
    const encoded = calls.map((current) => ({
      to: current.address as Hex,
      value: current.value ?? 0n,
      data: encodeFunctionData({
        abi: current.abi,
        functionName: current.functionName,
        args: current.args,
      }),
    }));

    if (atomic) {
      const data = await client.account!.encodeCalls(encoded);
      const decoded = decodeFunctionData({
        abi: parseAbi(["function execute(bytes32 mode, bytes executionCalldata) payable"]),
        data,
      });
      const expected = calls.length > 1 ? `0x0100${"00".repeat(30)}` : `0x${"00".repeat(32)}`;
      if (decoded.args[0].toLowerCase() !== expected) throw new Error("batch-atomic-unavailable");
    }
    assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
    await options.assertOwnership?.();
    const operationHash = await client.sendUserOperation({
      account: this.reportingAccount(client, options),
      calls: encoded,
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
      if (options.batchBudget) quoteUserOperation(userOperation, options.batchBudget);
      const signature = await account.signUserOperation(userOperation);
      if (options.batchBudget) quoteUserOperation(userOperation, options.batchBudget);
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

  async preflightBatch(calls: readonly ContractCall[], budget: BatchBudget) {
    assertBatchCalls(calls, budget);
    const account = calls[0].account ?? this.client.account!.address;
    const chainId = calls[0].chainId ?? this.client.chain!.id;
    await this.assertOwnership?.(account, chainId);
    const client = this.deps.resolveSmartAccountClient
      ? await this.deps.resolveSmartAccountClient(chainId)
      : this.client;
    assertSmartAccountClient(client, chainId, account);
    const request = await client.prepareUserOperation({
      account: client.account!,
      calls: calls.map((call) => ({
        to: call.address as Hex,
        value: call.value ?? 0n,
        data: encodeFunctionData({
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        }),
      })),
    });
    await this.assertOwnership?.(account, chainId);
    return quoteUserOperation(request, budget);
  }

  async getBatchCapability(scope: BatchScope): Promise<BatchCapability> {
    try {
      await this.assertOwnership?.(scope.account, scope.chainId);
      const client = this.deps.resolveSmartAccountClient
        ? await this.deps.resolveSmartAccountClient(scope.chainId)
        : this.client;
      assertSmartAccountClient(client, scope.chainId, scope.account);
      assertSmartAccountClientResolverActive(this.deps.resolveSmartAccountClient);
      const encoded = await client.account!.encodeCalls([
        { to: scope.account as Hex, data: "0x" as Hex, value: 0n },
        { to: scope.account as Hex, data: "0x" as Hex, value: 0n },
      ]);
      const decoded = decodeFunctionData({
        abi: parseAbi(["function execute(bytes32 mode, bytes executionCalldata) payable"]),
        data: encoded,
      });
      // ERC-7579: batch call type 01, default (revert-on-failure) execution type 00.
      return {
        ...scope,
        atomic:
          decoded.args[0].toLowerCase() === `0x0100${"00".repeat(30)}`
            ? "supported"
            : "unsupported",
      };
    } catch {
      return { ...scope, atomic: "unknown" };
    }
  }

  /** These run before a batch can reach the bundler, so a refusal here proves it was not sent. */
  private async assertBatchSendable(calls: readonly ContractCall[], budget: BatchBudget) {
    try {
      assertBatchCalls(calls, budget);
      const account = calls[0]?.account ?? this.client.account?.address;
      const chainId = calls[0]?.chainId ?? this.client.chain?.id;
      if (!account || chainId === undefined || calls.length === 0)
        throw new Error("batch-invalid-intent");
      prepareBatch({
        id: "passkey-check",
        domain: "transport",
        account,
        chainId,
        mode: "atomic",
        items: calls.map((call, index) => ({ id: String(index), call })),
      });
      const capability = await this.getBatchCapability({ account, chainId });
      assertBatchCapabilityKnown(capability);
      if (capability.atomic !== "supported") throw new Error("batch-atomic-unavailable");
      return { account, chainId };
    } catch (error) {
      throw new BatchNotSubmittedError(error);
    }
  }

  async submitAtomicBatch(
    calls: readonly ContractCall[],
    options: BatchSendOptions = {}
  ): Promise<BatchExecution> {
    if (!options.batchBudget) throw new BatchNotSubmittedError(new Error("batch-budget-required"));
    const { account, chainId } = await this.assertBatchSendable(calls, options.batchBudget);
    let reference: BatchReference | undefined;
    let beforeBroadcastFailed = false;
    try {
      const result = await this.executeCalls(
        calls,
        {
          ...options,
          assertOwnership: async () => {
            await this.assertOwnership?.(account, chainId);
            await options.assertOwnership?.();
          },
          onBeforeBroadcast: async (broadcast) => {
            try {
              if (broadcast) reference = { ...broadcast, account, chainId };
              await options.onBeforeBroadcast?.(broadcast);
            } catch (error) {
              beforeBroadcastFailed = true;
              throw error;
            }
          },
          // Only the bundler's answer proves the send was accepted; signing does not.
          onBroadcastReference: async (broadcast) => {
            const accepted = { ...broadcast, account, chainId };
            reference = accepted;
            await options.onBatchReference?.(accepted);
            await options.onBroadcastReference?.(broadcast);
          },
        },
        true
      );
      return {
        status: "confirmed",
        reference,
        receipts: [{ transactionHash: result.hash, status: "success" }],
        sponsored: true,
      };
    } catch (error) {
      if (!reference || beforeBroadcastFailed) throw new BatchNotSubmittedError(error);
      return {
        status: error instanceof TransactionRevertedError ? "reverted" : "unresolved",
        reference,
        receipts: [],
        sponsored: true,
      };
    }
  }

  async reconcileBatch(reference: BatchReference): Promise<BatchExecution> {
    const unresolved: BatchExecution = {
      status: "unresolved",
      reference,
      receipts: [],
      sponsored: true,
    };
    if (
      reference.kind !== "user-operation" ||
      reference.account.toLowerCase() !== this.client.account?.address.toLowerCase()
    )
      return unresolved;
    await this.assertOwnership?.(reference.account, reference.chainId);
    const outcome = await this.reconcileBroadcast(reference);
    return outcome.status === "confirmed"
      ? {
          status: "confirmed",
          reference,
          receipts: [{ transactionHash: outcome.transactionHash, status: "success" }],
          sponsored: true,
        }
      : { ...unresolved, status: outcome.status };
  }

  /** Callers probe for this, so an action nobody has listed still sends one call at a time. */
  async canSendAtomicBatch(chainId: number, action?: AtomicBatchAction): Promise<boolean> {
    const account = this.client.account?.address;
    const profile = this.deps.accountProfile;
    if (!account || !profile || !action) return false;
    if (!isBatchEnabled({ action, rail: "passkey", profile, chainId })) return false;
    return (await this.getBatchCapability({ account, chainId })).atomic === "supported";
  }

  /** The send a caller shares with a wallet. A passkey's also needs `batchBudget`. */
  async sendAtomicBatch(
    calls: ContractCall[],
    { onAccepted, onNeverSent, ...options }: AtomicBatchOptions = {}
  ): Promise<TxResult> {
    let execution: BatchExecution;
    try {
      execution = await this.submitAtomicBatch(calls, {
        ...options,
        onBroadcastReference: async (reference) => {
          await options.onBroadcastReference?.(reference);
          await onAccepted?.();
        },
      });
    } catch (error) {
      if (error instanceof BatchNotSubmittedError) {
        onNeverSent?.();
        throw error.cause;
      }
      throw error;
    }
    return atomicBatchTxResult(execution);
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
