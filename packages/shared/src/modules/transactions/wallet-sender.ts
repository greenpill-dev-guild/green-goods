/** Wallet single-call and explicit atomic-batch adapters, scoped to the connected signer. */

import {
  signTypedData as defaultSignTypedData,
  ConnectorNotConnectedError,
  getAccount as defaultGetAccount,
  getCapabilities as defaultGetCapabilities,
  getCallsStatus as defaultGetCallsStatus,
  getPublicClient as defaultGetPublicClient,
  sendCalls as defaultSendCalls,
  waitForCallsStatus as defaultWaitForCallsStatus,
  waitForTransactionReceipt as defaultWaitForReceipt,
  type Config,
} from "@wagmi/core";
import type { Abi, Hex } from "viem";
import {
  BatchConfirmationPendingError,
  BatchNotSubmittedError,
  type BatchBudget,
  type BatchQuote,
  type BatchCapability,
  type BatchExecution,
  type BatchReference,
  type BatchScope,
} from "./batch-types";
import type { Address } from "../../types/domain";
import { isCanonicalTransactionHash } from "./confirmation";
import { reconcileWalletBroadcast } from "./wallet-reconciliation";
import { quoteWalletBatch } from "./wallet-batch-preflight";
import { walletBatchExecution, type WalletBatchStatus } from "./wallet-batch-status";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { WalletNetworkSwitchReason } from "../app/walletNetworkSwitchAnalytics";
import {
  assertWalletAccount,
  ensureWagmiWalletChain,
  retryOnWalletChainMismatch,
} from "./chain-guard";
import { assertLocalArbitrumForkWallet } from "./local-fork-safety";
import {
  type AtomicBatchOptions,
  TransactionReplacementError,
  assertTypedDataChain,
  TransactionRevertedError,
  type AccountTypedDataRequest,
  type ContractCall,
  type TransactionSender,
  type TransactionSendOptions,
  type TxResult,
} from "./types";

/** How long a wallet may take to say what it can do before we assume it can't batch. */
const CAPABILITY_TIMEOUT_MS = 4_000;
/** How long an accepted batch may take to reach a receipt before its outcome is unknown. */
const BATCH_STATUS_TIMEOUT_MS = 180_000;

async function withinMs<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("wallet-capabilities-timeout")), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Injectable dependency for testability */
export interface WalletSenderDeps {
  preflightBatch?: (calls: readonly ContractCall[], budget: BatchBudget) => Promise<BatchQuote>;
  reconcileBroadcast?: TransactionSender["reconcileBroadcast"];
  signTypedData?: (config: Config, request: AccountTypedDataRequest) => Promise<Hex>;
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
  ensureWalletChain?: (
    chainId: number,
    reason?: WalletNetworkSwitchReason,
    beforeSwitch?: () => void | Promise<void>
  ) => Promise<void>;
  getCapabilities?: (
    config: Config,
    params: { chainId: number; account?: Address }
  ) => Promise<{ atomic?: { status?: string } } | undefined>;
  sendCalls?: (
    config: Config,
    params: {
      account?: Address;
      chainId: number;
      forceAtomic: true;
      calls: readonly {
        to: Address;
        abi: Abi;
        functionName: string;
        args: readonly unknown[];
        value?: bigint;
      }[];
    }
  ) => Promise<{ id: string }>;
  getCallsStatus?: (config: Config, params: { id: string }) => Promise<WalletBatchStatus>;
  waitForCallsStatus?: (
    config: Config,
    params: { id: string; timeout: number; throwOnFailure: false }
  ) => Promise<WalletBatchStatus>;
}

export class WalletSender implements TransactionSender {
  readonly supportsSponsorship = false;
  readonly supportsBatching = false;
  readonly authMode = "wallet" as const;

  assertOwnership?: TransactionSender["assertOwnership"];

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
    // Injected deps (tests) opt in to batching explicitly; only the real wallet
    // path defaults the EIP-5792 actions. They are reached lazily, when a batch
    // is actually asked for, so constructing a sender never touches them.
    this.deps = deps ?? {
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as WalletSenderDeps["waitForTransactionReceipt"],
      assertWriteSafety: assertLocalArbitrumForkWallet,
      getCapabilities: (config, params) =>
        (defaultGetCapabilities as unknown as NonNullable<WalletSenderDeps["getCapabilities"]>)(
          config,
          params
        ),
      getCallsStatus: (config, params) => defaultGetCallsStatus(config, params),
      preflightBatch: (calls, budget) => {
        const reader = defaultGetPublicClient(wagmiConfig, { chainId: calls[0].chainId });
        if (!reader) throw new Error("batch-preflight-unavailable");
        return quoteWalletBatch(reader, calls, budget);
      },
      sendCalls: (config, params) =>
        (defaultSendCalls as unknown as NonNullable<WalletSenderDeps["sendCalls"]>)(config, params),
      waitForCallsStatus: (config, params) =>
        (
          defaultWaitForCallsStatus as unknown as NonNullable<
            WalletSenderDeps["waitForCallsStatus"]
          >
        )(config, params),
    };
    this.deps.signTypedData ??= (config, request) =>
      defaultSignTypedData(config, { ...request.data, account: request.account } as Parameters<
        typeof defaultSignTypedData
      >[1]);
    this.deps.getAccount ??= () => defaultGetAccount(this.config);
    this.deps.assertWriteSafety ??= assertLocalArbitrumForkWallet;
    this.deps.ensureWalletChain ??= (chainId, reason, beforeSwitch) =>
      ensureWagmiWalletChain(this.config, chainId, reason, beforeSwitch);
    this.deps.reconcileBroadcast ??= (reference) =>
      reconcileWalletBroadcast(this.config, reference, this.deps.getAccount?.().address);
  }

  reconcileBroadcast: NonNullable<TransactionSender["reconcileBroadcast"]> = (reference) =>
    this.deps.reconcileBroadcast!(reference);

  /** Bind a call to the connected signer before any asynchronous preparation. */
  private forSigner(call: ContractCall): ContractCall {
    const account = call.account ?? this.deps.getAccount?.().address;
    if (!account) throw new ConnectorNotConnectedError();
    return { ...call, account };
  }

  /** Recheck the action owner, then read the connected signer last. */
  private async assertSigner(call: ContractCall, options: TransactionSendOptions): Promise<void> {
    await options.assertOwnership?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);
  }

  /** Check network, local-fork safety, and ownership again after any switch prompt. */
  private async readyWallet(
    call: ContractCall,
    chainId: number,
    options: TransactionSendOptions,
    reason: WalletNetworkSwitchReason
  ): Promise<void> {
    await this.deps.ensureWalletChain?.(chainId, reason, () => this.assertSigner(call, options));
    await this.deps.assertWriteSafety?.();
    await this.assertSigner(call, options);
  }

  async signTypedData(
    request: AccountTypedDataRequest,
    options: TransactionSendOptions = {}
  ): Promise<Hex> {
    assertTypedDataChain(request);
    const assertSigner = async () => {
      await options.assertOwnership?.();
      assertWalletAccount(request.account, this.deps.getAccount?.().address);
    };
    await assertSigner();
    await this.deps.ensureWalletChain?.(request.chainId, "write", assertSigner);
    await assertSigner();
    const signature = await this.deps.signTypedData!(this.config, request);
    await assertSigner();
    return signature;
  }

  async sendContractCall(
    named: ContractCall,
    options: TransactionSendOptions = {}
  ): Promise<TxResult> {
    const call = this.forSigner(named);
    // Cast to string to allow non-canonical hash detection (Safe wallets
    // can return identifiers that don't match `0x${string}` at runtime).
    const chainId = call.chainId ?? DEFAULT_CHAIN_ID;
    await this.readyWallet(call, chainId, options, "write");
    if (options.batchBudget) {
      await this.preflightBatch([{ ...call, chainId }], options.batchBudget);
      await this.assertSigner(call, options);
    }
    // The wallet approves and broadcasts in one step, so the intent is recorded
    // before asking. A rejected prompt is recognised and clears it.
    await options.onBeforeBroadcast?.();

    // A wallet can change network between the guard and the write. viem then
    // refuses before the wallet is asked to sign, so every check runs again and
    // one more attempt cannot send twice.
    const hash: string = await retryOnWalletChainMismatch(
      () =>
        this.writeContractAsync({
          ...(call.account ? { account: call.account } : {}),
          address: call.address as `0x${string}`,
          abi: call.abi as readonly unknown[],
          functionName: call.functionName,
          args: call.args,
          chainId,
          ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
        }),
      () => this.readyWallet(call, chainId, options, "retry")
    );

    await options.onBroadcastReference?.({ kind: "transaction", hash: hash as `0x${string}` });
    await options.onBroadcast?.(hash as `0x${string}`);

    // Some Safe-style wallets return a non-canonical hash-like identifier.
    // waitForTransactionReceipt only accepts canonical tx hashes, so skip
    // waiting and preserve a pending result for the off-chain Safe flow.
    if (!isCanonicalTransactionHash(hash)) {
      // No address or hash material in the log context: aggregated logs must
      // stay free of identifying transaction data (short Safe identifiers
      // would otherwise be logged in full via a "preview").
      logger.info("Skipping receipt wait for non-canonical wallet transaction hash", {
        source: "WalletSender",
        functionName: call.functionName,
        hashLength: hash.length,
      });
      return { hash: hash as Hex, sponsored: false, confirmation: "pending" };
    }

    // Wait for on-chain confirmation and verify the tx was not reverted
    let invalidReplacement: "cancelled" | "replaced" | undefined;
    let receipt: Awaited<ReturnType<WalletSenderDeps["waitForTransactionReceipt"]>>;
    try {
      receipt = await this.deps.waitForTransactionReceipt(this.config, {
        hash,
        chainId,
        onReplaced: ({ reason }) => {
          if (reason !== "repriced") invalidReplacement = reason;
        },
      });
    } catch (error) {
      if (invalidReplacement) throw new TransactionReplacementError(invalidReplacement);
      throw error;
    }
    if (invalidReplacement) throw new TransactionReplacementError(invalidReplacement);
    if (receipt.status === "reverted") {
      throw new TransactionRevertedError(hash, "Transaction reverted on-chain");
    }

    const confirmedHash = receipt.transactionHash ?? hash;
    if (confirmedHash.toLowerCase() !== hash.toLowerCase()) {
      await options.onBroadcastReference?.({ kind: "transaction", hash: confirmedHash });
      await options.onBroadcast?.(confirmedHash);
    }
    logger.debug("Wallet transaction confirmed", {
      source: "WalletSender",
      functionName: call.functionName,
      address: call.address,
      hash: confirmedHash,
    });

    return { hash: confirmedHash, sponsored: false };
  }

  preflightBatch(calls: readonly ContractCall[], budget: BatchBudget): Promise<BatchQuote> {
    if (!this.deps.preflightBatch) throw new Error("batch-preflight-unavailable");
    return this.deps.preflightBatch(calls, budget);
  }

  async getBatchCapability(scope: BatchScope): Promise<BatchCapability> {
    const connected = this.deps.getAccount?.().address;
    if (!connected || connected.toLowerCase() !== scope.account.toLowerCase())
      return { ...scope, atomic: "unknown" };
    if (!this.deps.getCapabilities) return { ...scope, atomic: "unsupported" };
    try {
      await this.assertOwnership?.(scope.account, scope.chainId);
      const capabilities = await withinMs(
        this.deps.getCapabilities(this.config, { chainId: scope.chainId, account: scope.account }),
        CAPABILITY_TIMEOUT_MS
      );
      if (this.deps.getAccount?.().address?.toLowerCase() !== scope.account.toLowerCase())
        return { ...scope, atomic: "unknown" };
      const status = capabilities?.atomic?.status;
      return {
        ...scope,
        atomic:
          status === "supported" || status === "ready" || status === "unsupported"
            ? status
            : "unknown",
      };
    } catch {
      return { ...scope, atomic: "unknown" };
    }
  }

  async canSendAtomicBatch(chainId: number): Promise<boolean> {
    const account = this.deps.getAccount?.().address;
    return (
      !!account && (await this.getBatchCapability({ account, chainId })).atomic === "supported"
    );
  }

  async submitAtomicBatch(
    calls: readonly ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<BatchExecution> {
    if (!options.batchBudget) throw new BatchNotSubmittedError(new Error("batch-budget-required"));
    return this.executeAtomicBatch(calls, options);
  }

  private async executeAtomicBatch(
    calls: readonly ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<BatchExecution> {
    if (calls.length === 0) throw new Error("Cannot send empty batch");
    const chainId = calls[0]!.chainId ?? DEFAULT_CHAIN_ID;
    if (calls.some((call) => (call.chainId ?? DEFAULT_CHAIN_ID) !== chainId))
      throw new Error("An atomic batch runs on one chain");
    const account = calls.find((call) => call.account)?.account ?? this.deps.getAccount?.().address;
    if (!account) throw new ConnectorNotConnectedError();
    const assertSigner = async () => {
      await this.assertOwnership?.(account, chainId);
      await options.assertOwnership?.();
      const connected = this.deps.getAccount?.().address;
      for (const expected of [account, ...calls.map((call) => call.account)])
        if (expected) assertWalletAccount(expected, connected);
    };
    try {
      await assertSigner();
      if (
        !this.deps.sendCalls ||
        !this.deps.waitForCallsStatus ||
        (await this.getBatchCapability({ account, chainId })).atomic !== "supported"
      )
        throw new Error("batch-atomic-unavailable");
      await this.deps.ensureWalletChain?.(chainId, "write", assertSigner);
      await this.deps.assertWriteSafety?.();
      if (options.batchBudget)
        await this.preflightBatch(
          calls.map((call) => ({ ...call, account, chainId })),
          options.batchBudget
        );
      await assertSigner();
      await options.onBeforeBroadcast?.();
      await assertSigner();
    } catch (error) {
      throw new BatchNotSubmittedError(error);
    }
    const { id } = await this.deps.sendCalls!(this.config, {
      account,
      chainId,
      forceAtomic: true,
      calls: calls.map((call) => ({
        to: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
        ...(call.value !== undefined ? { value: call.value } : {}),
      })),
    });
    const reference: BatchReference = { kind: "wallet-calls", id, account, chainId };
    try {
      if (typeof id !== "string" || !id) throw new Error("batch-invalid-wallet-id");
      await options.onBatchReference?.(reference);
      await options.onAccepted?.();
      const result = await this.deps.waitForCallsStatus(this.config, {
        id,
        timeout: BATCH_STATUS_TIMEOUT_MS,
        throwOnFailure: false,
      });
      return walletBatchExecution(reference, result);
    } catch {
      return { status: "unresolved", reference, receipts: [], sponsored: false };
    }
  }

  async reconcileBatch(reference: BatchReference): Promise<BatchExecution> {
    const unresolved: BatchExecution = {
      status: "unresolved",
      reference,
      receipts: [],
      sponsored: false,
    };
    if (reference.account.toLowerCase() !== this.deps.getAccount?.().address?.toLowerCase())
      return unresolved;
    await this.assertOwnership?.(reference.account, reference.chainId);
    if (reference.kind === "user-operation") return unresolved;
    try {
      if (reference.kind === "wallet-calls") {
        if (!this.deps.getCallsStatus) return unresolved;
        return walletBatchExecution(
          reference,
          await this.deps.getCallsStatus(this.config, { id: reference.id })
        );
      }
      const broadcast =
        reference.kind === "wallet-transaction"
          ? {
              kind: "transaction" as const,
              hash: reference.id as Hex,
              account: reference.account,
              chainId: reference.chainId,
            }
          : reference;
      const result = await this.reconcileBroadcast(broadcast);
      return result.status === "confirmed"
        ? {
            ...unresolved,
            status: "confirmed",
            receipts: [{ transactionHash: result.transactionHash, status: "success" }],
          }
        : { ...unresolved, status: result.status };
    } catch {
      return unresolved;
    }
  }

  /** Preserve the confirmed-hash API for existing callers without selecting an arbitrary receipt. */
  async sendAtomicBatch(
    calls: ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<TxResult> {
    let execution: BatchExecution;
    try {
      execution = await this.executeAtomicBatch(calls, options);
    } catch (error) {
      if (error instanceof BatchNotSubmittedError) throw error.cause;
      throw error;
    }
    const receipt = execution.receipts[0];
    if (execution.status === "confirmed" && execution.receipts.length === 1)
      return { hash: receipt.transactionHash, sponsored: false };
    if (execution.status === "reverted" && receipt)
      throw new TransactionRevertedError(
        receipt.transactionHash,
        "The batch reverted on chain. Nothing in it was recorded."
      );
    throw new BatchConfirmationPendingError(execution);
  }
}
