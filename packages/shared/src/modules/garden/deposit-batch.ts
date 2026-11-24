import { readContract, getTransactionReceipt } from "@wagmi/core";
import { type Abi, type Hex, type Log, parseAbi, parseEventLogs } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { isRecoverableAllowanceReadError } from "../../utils/errors/tx-error-classifier";
import { COOKIE_JAR_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { ERC20_ALLOWANCE_ABI } from "../../utils/blockchain/abis/erc20";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches, verifyByReading } from "../transactions/batch-hold";
import {
  type BatchOperations,
  type BatchReceipt,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
  type VerifyBatchItems,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";
import { depositBudget } from "./deposit-route";

/** Where a deposit goes. A vault credits its receiver; a jar holds one pot with no receiver. */
export type DepositTarget =
  | { kind: "vault"; address: Address; asset: Address; receiver: Address }
  | { kind: "jar"; address: Address; asset: Address };

/** How a deposit reads the chain. */
export interface DepositChain {
  allowance(account: Address, target: DepositTarget): Promise<bigint>;
  logsOf(transactionHash: Hex): Promise<readonly Log[]>;
  /** What the chain holds for this target now, in the asset: what a person decides from. */
  held(account: Address, target: DepositTarget): Promise<bigint>;
}

export function createDepositChain(chainId: number): DepositChain {
  const read = (request: { address: Address; abi: Abi; functionName: string; args: unknown[] }) =>
    readContract(getWagmiConfig(), { ...request, chainId }) as Promise<bigint>;
  return {
    allowance: (account, target) =>
      read({
        address: target.asset,
        abi: ERC20_ALLOWANCE_ABI as Abi,
        functionName: "allowance",
        args: [account, target.address],
      }).catch((error: unknown) => {
        if (!isRecoverableAllowanceReadError(error)) throw error;
        return 0n;
      }),
    logsOf: async (hash) => (await getTransactionReceipt(getWagmiConfig(), { hash, chainId })).logs,
    held: async (_account, target) => {
      if (target.kind === "jar") {
        return read({
          address: target.address,
          abi: COOKIE_JAR_ABI as Abi,
          functionName: "currencyHeldByJar",
          args: [],
        });
      }
      const vault = { address: target.address, abi: OCTANT_VAULT_ABI as Abi };
      const shares = await read({ ...vault, functionName: "balanceOf", args: [target.receiver] });
      return read({ ...vault, functionName: "convertToAssets", args: [shares] });
    },
  };
}

export const depositDomain = (target: Pick<DepositTarget, "kind" | "address">) =>
  `${target.kind}-deposit:${target.address.toLowerCase()}`;

/** Every attempt on a target shares these IDs, which is what makes an unknown one hold the next. */
const DEPOSIT_ITEM = "deposit";

const approveCall = (target: DepositTarget, value: bigint) => ({
  address: target.asset,
  abi: onlyFunction(ERC20_ALLOWANCE_ABI as Abi, "approve"),
  functionName: "approve",
  args: [target.address, value],
});

const depositCall = (target: DepositTarget, amount: bigint) =>
  target.kind === "vault"
    ? {
        address: target.address,
        abi: onlyFunction(OCTANT_VAULT_ABI as Abi, "deposit"),
        functionName: "deposit",
        args: [amount, target.receiver],
      }
    : {
        address: target.address,
        abi: onlyFunction(COOKIE_JAR_ABI as Abi, "deposit"),
        functionName: "deposit",
        args: [amount],
      };

/**
 * Freezes the calls one attempt needs, for the exact amount and never more. Only a vault resets, and
 * only an allowance that is nonzero and too low, which USDT-style tokens require.
 */
export function prepareDepositBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  rail: BatchRail;
  /** One request for the whole group. Otherwise each step is its own signature. */
  atomic: boolean;
  target: DepositTarget;
  amount: bigint;
  allowance: bigint;
}): PreparedBatch {
  const { target, amount, allowance } = input;
  const budget = depositBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  const needsApproval = allowance < amount;
  const needsReset = needsApproval && allowance > 0n && target.kind === "vault";
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: depositDomain(target),
    mode: input.atomic ? "atomic" : "sequential",
    budget,
    items: [
      ...(needsReset ? [{ id: "reset", call: approveCall(target, 0n) }] : []),
      ...(needsApproval ? [{ id: "approve", call: approveCall(target, amount) }] : []),
      { id: DEPOSIT_ITEM, call: depositCall(target, amount) },
    ],
  });
}

const DEPOSIT_EVENTS = parseAbi([
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Deposit(address indexed depositor, uint256 amount, address indexed token)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

const same = (left: unknown, right: unknown) =>
  typeof left === "string" &&
  typeof right === "string" &&
  left.toLowerCase() === right.toLowerCase();

/**
 * A receipt says a transaction ran, not what it did, so only a matching event proves a step. Read
 * from the prepared call, so a reload proves the same thing a live send would.
 */
function proves(
  item: PreparedBatch["items"][number],
  account: Address,
  logs: readonly Log[]
): boolean {
  const events = parseEventLogs({ abi: DEPOSIT_EVENTS, logs: [...logs], strict: false }).filter(
    (log) => same(log.address, item.call.address)
  );
  const [first, second] = item.call.args as readonly unknown[];
  return events.some((log) => {
    const args = log.args as Record<string, unknown>;
    if (item.id !== DEPOSIT_ITEM)
      return (
        log.eventName === "Approval" &&
        same(args.owner, account) &&
        same(args.spender, first) &&
        args.value === second
      );
    if (log.eventName !== "Deposit") return false;
    // A vault's call names its receiver, and a jar's has only the amount.
    return second === undefined
      ? same(args.depositor, account) && args.amount === first
      : same(args.sender, account) && same(args.owner, second) && args.assets === first;
  });
}

interface DepositBatchInput {
  batches: BatchOperations;
  scope: BatchScope;
  target: DepositTarget;
  chain: DepositChain;
  retryMs?: number;
}

function verifyDeposit(
  prepared: PreparedBatch,
  { chain, retryMs }: Pick<DepositBatchInput, "chain" | "retryMs">
): VerifyBatchItems {
  const proven = async (itemId: string, receipts: readonly BatchReceipt[]) => {
    const item = prepared.items.find((candidate) => candidate.id === itemId);
    if (!item) return false;
    // A node can answer from before the receipt's block, so a failed read is another try, not a no.
    const logs = await Promise.all(receipts.map((r) => chain.logsOf(r.transactionHash))).catch(
      () => []
    );
    return proves(item, prepared.account, logs.flat());
  };
  return (execution) =>
    verifyByReading((itemId) => proven(itemId, execution.receipts), retryMs)(execution);
}

export type DepositOutcome =
  | { status: "deposited"; transactionHash: Hex }
  /** It may have landed: held until someone reads it or moves on. */
  | { status: "unknown" }
  | { status: "declined" }
  | { status: "reverted" };

/**
 * Sends one attempt. Rejects only when nothing went out: the last check refused, another add still
 * holds this target (`batch-items-held`), or the group is past its ceilings (`batch-budget-exceeded`),
 * which the caller asks about before going step by step.
 */
export async function sendDepositBatch(
  input: DepositBatchInput & {
    rail: BatchRail;
    atomic: boolean;
    amount: bigint;
    /** Runs right before the deposit is signed, since the vault takes no minimum shares. */
    checkBeforeDeposit?: () => Promise<void>;
  }
): Promise<DepositOutcome> {
  const { batches, scope, target, chain, rail, atomic, amount, checkBeforeDeposit } = input;
  const prepared = prepareDepositBatch({
    ...scope,
    id: crypto.randomUUID(),
    rail,
    atomic,
    target,
    amount,
    allowance: await chain.allowance(scope.account, target),
  });
  const record = await batches.execute(prepared, {
    preflight: async (_reviewed, itemIds) => {
      if (itemIds.includes(DEPOSIT_ITEM)) await checkBeforeDeposit?.();
    },
    verify: verifyDeposit(prepared, input),
  });
  if (record.status === "confirmed") {
    const transactionHash = record.receipts.at(-1)?.transactionHash;
    if (transactionHash) return { status: "deposited", transactionHash };
    return { status: "unknown" };
  }
  if (UNKNOWN_BATCH_STATES.has(record.status)) return { status: "unknown" };
  return { status: record.status === "reverted" ? "reverted" : "declined" };
}

/** A deposit whose outcome is unknown. It holds the next one into this target until it is settled. */
export interface DepositHold {
  /** The attempts this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  amount: bigint;
  /** What the chain holds now, or null when that could not be read. */
  held: bigint | null;
}

export interface ProvenDeposit {
  amount: bigint;
  /** Comes only from the tab that ended the attempt, so it counts once. */
  transactionHash?: Hex;
}

const attemptedAmount = (prepared: PreparedBatch) => {
  const deposit = prepared.items.find((item) => item.id === DEPOSIT_ITEM);
  return (deposit?.call.args as readonly unknown[] | undefined)?.[0] as bigint;
};

async function settleOpenDeposits(
  input: DepositBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: DepositHold | null; onlyShown?: boolean } = {}
): Promise<{ hold: DepositHold | null; saved: ProvenDeposit[] }> {
  const { batches, scope, target, chain } = input;
  const { held, ended, endedHere } = await settleOpenBatches({
    batches,
    scope,
    domain: depositDomain(target),
    verifierFor: (prepared) => verifyDeposit(prepared, input),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  // An approval that landed is not a deposit, so only a proven deposit reports.
  const saved = ended.flatMap((record): ProvenDeposit[] =>
    provenItems(record).some((item) => item.id === DEPOSIT_ITEM)
      ? [
          {
            amount: attemptedAmount(record.prepared),
            transactionHash: endedHere.includes(record)
              ? record.receipts.at(-1)?.transactionHash
              : undefined,
          },
        ]
      : []
  );
  if (held.length === 0) return { hold: null, saved };
  const value = await chain.held(scope.account, target).catch(() => null);
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      amount: attemptedAmount(held[0].prepared),
      held: value,
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so an attempt another tab ended still reports here. */
export function readDepositHold(input: DepositBatchInput, shown?: DepositHold | null) {
  return settleOpenDeposits(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen what the chain holds and chosen to move on. */
export function moveOnFromDepositHold(input: DepositBatchInput, hold: DepositHold) {
  // A value that could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.held === null) return readDepositHold(input, hold);
  return settleOpenDeposits(input, input.batches.release, { shown: hold, onlyShown: true });
}
