/**
 * External Wallet Transaction Sender
 *
 * Sends transactions via wagmi's writeContractAsync (from useWriteContract).
 * The user pays gas directly. Handles Safe wallet non-canonical hashes
 * by skipping the receipt wait.
 *
 * A wallet that reports EIP-5792 atomic support can also take several calls
 * as one approval and one transaction; `wallet-atomic-batch.ts` owns that path.
 *
 * Future enhancement: try EIP-5792 sendCalls with paymasterService first,
 * falling back to direct writeContractAsync when the wallet doesn't support it.
 *
 * @module modules/transactions/wallet-sender
 */

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
import type { Hex } from "viem";
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
import {
  readWalletBatchCapability,
  reconcileWalletBatch,
  sendWalletAtomicBatch,
  type WalletBatchDeps,
  type WalletBatchPort,
} from "./wallet-atomic-batch";
import type { Address } from "../../types/domain";
import { isCanonicalTransactionHash } from "./confirmation";
import { reconcileWalletBroadcast } from "./wallet-reconciliation";
import { quoteWalletBatch } from "./wallet-batch-preflight";
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

/** Injectable dependency for testability */
export interface WalletSenderDeps extends WalletBatchDeps {
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

  /**
   * The call with the address it is for: the one it names, or else the one
   * connected when its send starts. The send belongs to that address from then
   * on, so a wallet that takes the connection over is asked neither to change
   * network nor to sign it. A send that starts with no wallet connected is for
   * nobody, and is refused here: waiting to see who connects would let that
   * wallet sign it.
   */
  private forSigner(call: ContractCall): ContractCall {
    const account = call.account ?? this.deps.getAccount?.().address;
    if (!account) throw new ConnectorNotConnectedError();
    return { ...call, account };
  }

  /**
   * Who signs: the act's own ownership check, then the account the call is
   * for. The account is read last, with nothing awaited after it.
   */
  private async assertSigner(call: ContractCall, options: TransactionSendOptions): Promise<void> {
    await options.assertOwnership?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);
  }

  /**
   * What must hold before the wallet is asked: its network, the fork check, and
   * who signs. The guard asks who signs right before it asks the wallet to
   * change network, so a wallet that took the connection over while the act
   * was being prepared is refused, not switched. Who signs is asked again once
   * the wallet is on the network, because a switch prompt can stay open long
   * enough for the account to change.
   */
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
    // TODO: Try EIP-5792 sendCalls with paymasterService first when available.
    // Fall back to direct writeContractAsync if the wallet doesn't support it.

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

  // sendBatch (one call after another) is intentionally not implemented for
  // wallet mode. The atomic path below is the only batch a wallet is offered.

  private batchPort(): WalletBatchPort {
    return {
      config: this.config,
      deps: this.deps,
      assertOwnership: (address, chainId) => this.assertOwnership?.(address, chainId),
      preflightBatch: (calls, budget) => this.preflightBatch(calls, budget),
      reconcileBroadcast: this.reconcileBroadcast,
    };
  }

  preflightBatch(calls: readonly ContractCall[], budget: BatchBudget): Promise<BatchQuote> {
    if (!this.deps.preflightBatch) throw new Error("batch-preflight-unavailable");
    return this.deps.preflightBatch(calls, budget);
  }

  getBatchCapability(scope: BatchScope): Promise<BatchCapability> {
    return readWalletBatchCapability(this.batchPort(), scope);
  }

  async canSendAtomicBatch(chainId: number): Promise<boolean> {
    const account = this.deps.getAccount?.().address;
    // "ready" means the wallet would first ask to upgrade the account to a
    // smart account. A pool setup is not the place to start that, so only an
    // account that already runs batches counts.
    return (
      !!account && (await this.getBatchCapability({ account, chainId })).atomic === "supported"
    );
  }

  async submitAtomicBatch(
    calls: readonly ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<BatchExecution> {
    if (!options.batchBudget) throw new BatchNotSubmittedError(new Error("batch-budget-required"));
    return sendWalletAtomicBatch(this.batchPort(), calls, options);
  }

  reconcileBatch(reference: BatchReference): Promise<BatchExecution> {
    return reconcileWalletBatch(this.batchPort(), reference);
  }

  /** Preserve the confirmed-hash API for existing callers without selecting an arbitrary receipt. */
  async sendAtomicBatch(
    calls: ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<TxResult> {
    let execution: BatchExecution;
    try {
      execution = await sendWalletAtomicBatch(this.batchPort(), calls, options);
    } catch (error) {
      if (error instanceof BatchNotSubmittedError) throw error.cause;
      throw error;
    }
    const receipt = execution.receipts[0];
    if (execution.status === "confirmed" && execution.receipts.length === 1) {
      logger.debug("Wallet atomic batch confirmed", {
        source: "WalletSender",
        calls: calls.map((call) => call.functionName),
        hash: receipt.transactionHash,
      });
      return { hash: receipt.transactionHash, sponsored: false };
    }
    if (execution.status === "reverted" && receipt)
      throw new TransactionRevertedError(
        receipt.transactionHash,
        "The batch reverted on chain. Nothing in it was recorded."
      );
    throw new BatchConfirmationPendingError(execution);
  }
}
