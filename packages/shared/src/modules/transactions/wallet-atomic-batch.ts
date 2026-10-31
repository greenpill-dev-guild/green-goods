/**
 * A wallet's EIP-5792 batches: what it can do, one atomic request, and reading that request back.
 *
 * Only a wallet that reports `atomic: supported` is asked. A later call estimated before an
 * earlier one has run would be priced against the wrong state, so a wallet that merely sends
 * calls one after another is not offered this path.
 *
 * @module modules/transactions/wallet-atomic-batch
 */

import { ConnectorNotConnectedError, type Config } from "@wagmi/core";
import type { Abi, Hex } from "viem";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { Address } from "../../types/domain";
import type { WalletNetworkSwitchReason } from "../app/walletNetworkSwitchAnalytics";
import {
  BatchNotSubmittedError,
  type BatchBudget,
  type BatchCapability,
  type BatchExecution,
  type BatchQuote,
  type BatchReference,
  type BatchScope,
} from "./batch-types";
import { assertWalletAccount } from "./chain-guard";
import type { AtomicBatchOptions, ContractCall, TransactionSender } from "./types";
import { walletBatchExecution, type WalletBatchStatus } from "./wallet-batch-status";

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

export interface WalletBatchDeps {
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

/** What these batches need from their sender. */
export interface WalletBatchPort {
  config: Config;
  deps: WalletBatchDeps;
  /** Asked when it is needed, because the sender's own check is assigned after construction. */
  assertOwnership: (address: Address, chainId: number) => void | Promise<void>;
  preflightBatch: (calls: readonly ContractCall[], budget: BatchBudget) => Promise<BatchQuote>;
  reconcileBroadcast: NonNullable<TransactionSender["reconcileBroadcast"]>;
}

export async function readWalletBatchCapability(
  { config, deps, assertOwnership }: WalletBatchPort,
  scope: BatchScope
): Promise<BatchCapability> {
  const connected = deps.getAccount?.().address;
  if (!connected || connected.toLowerCase() !== scope.account.toLowerCase())
    return { ...scope, atomic: "unknown" };
  if (!deps.getCapabilities) return { ...scope, atomic: "unsupported" };
  try {
    await assertOwnership(scope.account, scope.chainId);
    const capabilities = await withinMs(
      deps.getCapabilities(config, { chainId: scope.chainId, account: scope.account }),
      CAPABILITY_TIMEOUT_MS
    );
    if (deps.getAccount?.().address?.toLowerCase() !== scope.account.toLowerCase())
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
    // Most wallets without EIP-5792 answer "method not supported". That is the
    // ordinary case, not a fault: the caller sends one call at a time.
    return { ...scope, atomic: "unknown" };
  }
}

export async function sendWalletAtomicBatch(
  port: WalletBatchPort,
  calls: readonly ContractCall[],
  options: AtomicBatchOptions = {}
): Promise<BatchExecution> {
  const { config, deps } = port;
  if (calls.length === 0) throw new Error("Cannot send empty batch");
  const chainId = calls[0]!.chainId ?? DEFAULT_CHAIN_ID;
  if (calls.some((call) => (call.chainId ?? DEFAULT_CHAIN_ID) !== chainId))
    throw new Error("An atomic batch runs on one chain");
  // A batch is for one address, as a single send is: the one its calls name,
  // or else the one connected when it starts. With nobody connected it is
  // refused here.
  const account = calls.find((call) => call.account)?.account ?? deps.getAccount?.().address;
  if (!account) throw new ConnectorNotConnectedError();
  const assertSigner = async () => {
    await port.assertOwnership(account, chainId);
    await options.assertOwnership?.();
    const connected = deps.getAccount?.().address;
    for (const expected of [account, ...calls.map((call) => call.account)])
      if (expected) assertWalletAccount(expected, connected);
  };
  try {
    await assertSigner();
    if (
      !deps.sendCalls ||
      !deps.waitForCallsStatus ||
      (await readWalletBatchCapability(port, { account, chainId })).atomic !== "supported"
    )
      throw new Error("batch-atomic-unavailable");
    await deps.ensureWalletChain?.(chainId, "write", assertSigner);
    await deps.assertWriteSafety?.();
    if (options.batchBudget)
      await port.preflightBatch(
        calls.map((call) => ({ ...call, account, chainId })),
        options.batchBudget
      );
    await assertSigner();
    await options.onBeforeBroadcast?.();
    await assertSigner();
  } catch (error) {
    throw new BatchNotSubmittedError(error);
  }
  const { id } = await deps.sendCalls!(config, {
    account,
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
  const reference: BatchReference = { kind: "wallet-calls", id, account, chainId };
  try {
    if (typeof id !== "string" || !id) throw new Error("batch-invalid-wallet-id");
    await options.onBatchReference?.(reference);
    await options.onAccepted?.();
    // A timeout throws here, and the outcome is then unknown: the caller must
    // read the chain before sending anything again.
    const result = await deps.waitForCallsStatus!(config, {
      id,
      timeout: BATCH_STATUS_TIMEOUT_MS,
      throwOnFailure: false,
    });
    return walletBatchExecution(reference, result);
  } catch {
    return { status: "unresolved", reference, receipts: [], sponsored: false };
  }
}

export async function reconcileWalletBatch(
  { config, deps, assertOwnership, reconcileBroadcast }: WalletBatchPort,
  reference: BatchReference
): Promise<BatchExecution> {
  const unresolved: BatchExecution = {
    status: "unresolved",
    reference,
    receipts: [],
    sponsored: false,
  };
  if (reference.account.toLowerCase() !== deps.getAccount?.().address?.toLowerCase())
    return unresolved;
  await assertOwnership(reference.account, reference.chainId);
  if (reference.kind === "user-operation") return unresolved;
  try {
    if (reference.kind === "wallet-calls") {
      if (!deps.getCallsStatus) return unresolved;
      return walletBatchExecution(
        reference,
        await deps.getCallsStatus(config, { id: reference.id })
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
    const result = await reconcileBroadcast(broadcast);
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
