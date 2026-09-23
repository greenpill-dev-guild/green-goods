/**
 * External Wallet Transaction Sender
 *
 * Sends transactions via wagmi's writeContractAsync (from useWriteContract).
 * The user pays gas directly. Handles Safe wallet non-canonical hashes
 * by skipping the receipt wait.
 *
 * A wallet that reports EIP-5792 atomic support can also take several calls
 * as one approval and one transaction (`sendAtomicBatch`). Wallets that only
 * batch one call after another are not offered it: a later call estimated
 * before an earlier one has run would be priced against the wrong state.
 *
 * Future enhancement: try EIP-5792 sendCalls with paymasterService first,
 * falling back to direct writeContractAsync when the wallet doesn't support it.
 *
 * @module modules/transactions/wallet-sender
 */

import {
  getAccount as defaultGetAccount,
  getCapabilities as defaultGetCapabilities,
  sendCalls as defaultSendCalls,
  waitForCallsStatus as defaultWaitForCallsStatus,
  waitForTransactionReceipt as defaultWaitForReceipt,
  type Config,
} from "@wagmi/core";
import type { Abi, Hex } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { assertWalletAccount, ensureWagmiWalletChain } from "./chain-guard";
import { assertLocalArbitrumForkWallet } from "./local-fork-safety";
import {
  type AtomicBatchOptions,
  TransactionReplacementError,
  TransactionRevertedError,
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
  getCapabilities?: (
    config: Config,
    params: { chainId: number }
  ) => Promise<{ atomic?: { status?: string } } | undefined>;
  sendCalls?: (
    config: Config,
    params: {
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
  waitForCallsStatus?: (
    config: Config,
    params: { id: string; timeout: number; throwOnFailure: false }
  ) => Promise<{
    status?: string;
    receipts?: readonly { status?: string; transactionHash: Hex }[];
  }>;
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
    // Injected deps (tests) opt in to batching explicitly; only the real wallet
    // path defaults the EIP-5792 actions. They are reached lazily, when a batch
    // is actually asked for, so constructing a sender never touches them.
    this.deps = deps ?? {
      waitForTransactionReceipt:
        defaultWaitForReceipt as unknown as WalletSenderDeps["waitForTransactionReceipt"],
      assertWriteSafety: assertLocalArbitrumForkWallet,
      ensureWalletChain: (chainId: number) => ensureWagmiWalletChain(this.config, chainId),
      getCapabilities: (config, params) =>
        (defaultGetCapabilities as unknown as NonNullable<WalletSenderDeps["getCapabilities"]>)(
          config,
          params
        ),
      sendCalls: (config, params) =>
        (defaultSendCalls as unknown as NonNullable<WalletSenderDeps["sendCalls"]>)(config, params),
      waitForCallsStatus: (config, params) =>
        (
          defaultWaitForCallsStatus as unknown as NonNullable<
            WalletSenderDeps["waitForCallsStatus"]
          >
        )(config, params),
    };
    this.deps.getAccount ??= () => defaultGetAccount(this.config);
    this.deps.assertWriteSafety ??= assertLocalArbitrumForkWallet;
    this.deps.ensureWalletChain ??= (chainId: number) =>
      ensureWagmiWalletChain(this.config, chainId);
  }

  async sendContractCall(
    call: ContractCall,
    options: TransactionSendOptions = {}
  ): Promise<TxResult> {
    // TODO: Try EIP-5792 sendCalls with paymasterService first when available.
    // Fall back to direct writeContractAsync if the wallet doesn't support it.

    // Cast to string to allow non-canonical hash detection (Safe wallets
    // can return identifiers that don't match `0x${string}` at runtime).
    const chainId = call.chainId ?? DEFAULT_CHAIN_ID;
    await this.deps.ensureWalletChain?.(chainId);
    await this.deps.assertWriteSafety?.();
    if (call.account) assertWalletAccount(call.account, this.deps.getAccount?.().address);

    await options.assertOwnership?.();
    // The wallet approves and broadcasts in one step, so the intent is recorded
    // before asking. A rejected prompt is recognised and clears it.
    await options.onBeforeBroadcast?.();

    const hash: string = await this.writeContractAsync({
      ...(call.account ? { account: call.account } : {}),
      address: call.address as `0x${string}`,
      abi: call.abi as readonly unknown[],
      functionName: call.functionName,
      args: call.args,
      chainId,
      ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
    });

    await options.onBroadcastReference?.({ kind: "transaction", hash: hash as `0x${string}` });
    await options.onBroadcast?.(hash as `0x${string}`);

    // Some Safe-style wallets return a non-canonical hash-like identifier.
    // waitForTransactionReceipt only accepts canonical tx hashes, so skip
    // waiting and preserve a pending result for the off-chain Safe flow.
    if (!isCanonicalTxHash(hash)) {
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

  async canSendAtomicBatch(chainId: number): Promise<boolean> {
    const getCapabilities = this.deps.getCapabilities;
    if (!getCapabilities) return false;
    try {
      const capabilities = await withinMs(
        getCapabilities(this.config, { chainId }),
        CAPABILITY_TIMEOUT_MS
      );
      // "ready" means the wallet would first ask to upgrade the account to a
      // smart account. A pool setup is not the place to start that, so only an
      // account that already runs batches counts.
      return capabilities?.atomic?.status === "supported";
    } catch {
      // Most wallets without EIP-5792 answer "method not supported". That is the
      // ordinary case, not a fault: the caller sends one call at a time.
      return false;
    }
  }

  async sendAtomicBatch(
    calls: ContractCall[],
    options: AtomicBatchOptions = {}
  ): Promise<TxResult> {
    if (calls.length === 0) throw new Error("Cannot send empty batch");
    const sendCalls = this.deps.sendCalls;
    const waitForCallsStatus = this.deps.waitForCallsStatus;
    if (!sendCalls || !waitForCallsStatus) {
      throw new Error("This wallet cannot send an atomic batch");
    }
    const chainId = calls[0]!.chainId ?? DEFAULT_CHAIN_ID;
    if (calls.some((call) => (call.chainId ?? DEFAULT_CHAIN_ID) !== chainId)) {
      throw new Error("An atomic batch runs on one chain");
    }
    await this.deps.ensureWalletChain?.(chainId);
    await this.deps.assertWriteSafety?.();
    if (calls.some((call) => call.account)) {
      const account = this.deps.getAccount?.().address;
      for (const call of calls) {
        if (call.account) assertWalletAccount(call.account, account);
      }
    }

    const { id } = await sendCalls(this.config, {
      chainId,
      forceAtomic: true,
      calls: calls.map((call) => ({
        to: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
        ...(call.value !== null && call.value !== undefined ? { value: call.value } : {}),
      })),
    });
    await options.onAccepted?.();

    // A timeout throws here, and the outcome is then unknown: the caller must
    // read the chain before sending anything again.
    const result = await waitForCallsStatus(this.config, {
      id,
      timeout: BATCH_STATUS_TIMEOUT_MS,
      throwOnFailure: false,
    });
    const receipts = result.receipts ?? [];
    const hash = receipts.at(-1)?.transactionHash;
    if (result.status === "failure" || receipts.some((receipt) => receipt.status === "reverted")) {
      if (hash) {
        throw new TransactionRevertedError(
          hash,
          "The batch reverted on chain. Nothing in it was recorded."
        );
      }
      throw new Error("The wallet could not send the batch. Nothing in it was recorded.");
    }
    if (result.status !== "success" || !hash) {
      throw new Error("The batch outcome is unknown. Read the chain before sending again.");
    }
    logger.debug("Wallet atomic batch confirmed", {
      source: "WalletSender",
      calls: calls.map((call) => call.functionName),
      hash,
    });
    return { hash, sponsored: false };
  }
}
