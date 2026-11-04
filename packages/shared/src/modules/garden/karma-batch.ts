/**
 * Karma reconcile under as few signatures as the rail allows.
 *
 * One press repairs a garden's Karma project and each account's access to it: `reconcileProject`,
 * then one `reconcileProjectAccess` per account. Every step catches its own failure and records it,
 * so a transaction that succeeds can still carry a failed sync. Only the `KarmaSyncRecorded` events
 * say what each call did, so they are what confirms it (`karma-sync-records.ts`).
 *
 * @module modules/garden/karma-batch
 */

import type { Address } from "../../types/domain";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches } from "../transactions/batch-hold";
import {
  type BatchBudget,
  type BatchOperations,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";
import type { ContractCall } from "../transactions/types";
import {
  KARMA_MODULE_ABI,
  type KarmaCallResult,
  karmaCallId,
  type KarmaReconcileChain,
  type RecordedCall,
  verifyKarmaSync,
} from "./karma-sync-records";

/**
 * Gas, in percent over the estimate, that a reconcile call sends. Each step runs its Karma
 * attestation inside try/catch, so an estimate can stop where the attestation runs out of gas and is
 * caught, and the chain records a failed sync. Work approvals send the same headroom for the same
 * reason (`APPROVAL_GAS_HEADROOM_PERCENT`).
 */
const KARMA_GAS_HEADROOM_PERCENT = 50;

/** One call of a reconcile, with the ID the journal holds it by. */
export interface KarmaReconcileCall {
  id: string;
  call: ContractCall;
}

/** The project goes first: an account's access sync needs the project to exist. */
export function karmaReconcileCalls(input: {
  module: Address;
  garden: Address;
  chainId: number;
  accounts: readonly Address[];
}): KarmaReconcileCall[] {
  const { module, garden, chainId, accounts } = input;
  const call = (functionName: string, args: readonly unknown[]): ContractCall => ({
    address: module,
    abi: onlyFunction(KARMA_MODULE_ABI, functionName),
    functionName,
    args,
    chainId,
    gasHeadroomPercent: KARMA_GAS_HEADROOM_PERCENT,
  });
  return [
    { id: karmaCallId(null), call: call("reconcileProject", [garden]) },
    ...accounts.map((account) => ({
      id: karmaCallId(account),
      call: call("reconcileProjectAccess", [garden, account]),
    })),
  ];
}

/** The most calls one signature carries. Past it, a sync takes another signature. */
const MAX_CALLS_PER_SIGNATURE = 10;

/** How many signatures one press takes: a group per signature when the rail batches. */
export const signaturesForKarmaReconcile = (calls: number, batched: boolean) =>
  batched ? Math.ceil(calls / MAX_CALLS_PER_SIGNATURE) : calls;

const ARBITRUM_CEILINGS = {
  maxCalls: MAX_CALLS_PER_SIGNATURE,
  maxCalldataBytes: 4_096,
  maxFeePerGas: "1000000000",
  maxFee: "3000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for. They come from the contract, not
 * from receipts, since no reconcile batch has been measured: the costliest step is the project's
 * details attestation, which carries the garden's JSON, at about 1.5M gas with a new project, and an
 * account's MemberOf attestation and access sync come to about 0.5M. With the 50% headroom ten calls
 * reach about 9M, and a Green Goods passkey UserOperation adds about 730k. Past them a sync goes one
 * call at a time. The first live batch on each rail confirms them before that rail is listed.
 */
const KARMA_RECONCILE_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "12000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "12000000", sponsorship: "wallet" },
  },
};

export function karmaReconcileBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return KARMA_RECONCILE_BUDGETS[chainId]?.[rail] ?? null;
}

export const karmaReconcileDomain = (garden: Address) => `karma-reconcile:${garden.toLowerCase()}`;

function prepareKarmaReconcileBatch(
  input: BatchScope & {
    id: string;
    rail: BatchRail;
    garden: Address;
    calls: readonly KarmaReconcileCall[];
  }
): PreparedBatch {
  const budget = karmaReconcileBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: karmaReconcileDomain(input.garden),
    mode: "atomic",
    budget,
    items: input.calls,
  });
}

interface KarmaReconcileInput {
  batches: BatchOperations;
  scope: BatchScope;
  garden: Address;
  chain: KarmaReconcileChain;
  retryMs?: number;
}

export interface KarmaReconcileOutcome {
  /** What the chain recorded for each call that landed. */
  recorded: KarmaCallResult[];
  /** Calls that may have landed. They stay held until someone checks again or moves on. */
  unknown: number;
  /** Calls nothing went out for. */
  notSent: number;
  /** Why the calls in `notSent` did not go. */
  stoppedBy?: "declined" | "reverted" | "over-ceilings" | "no-project" | "error";
  failure?: unknown;
}

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/**
 * Send every call, one signature per group, in order. A group lands whole or not at all, and the
 * groups before one that stops stay landed, since each is its own transaction.
 */
export async function reconcileKarmaBatch(
  input: KarmaReconcileInput & {
    rail: BatchRail;
    calls: readonly KarmaReconcileCall[];
    /** Hears each signature before it is asked for, counting from 1. */
    onSignature?: (signature: number, signatures: number) => void;
  }
): Promise<KarmaReconcileOutcome> {
  const { batches, scope, garden, rail, calls, onSignature } = input;
  const groups = Array.from(
    { length: signaturesForKarmaReconcile(calls.length, true) },
    (_, index) =>
      calls.slice(index * MAX_CALLS_PER_SIGNATURE, (index + 1) * MAX_CALLS_PER_SIGNATURE)
  );
  const outcome: KarmaReconcileOutcome = { recorded: [], unknown: 0, notSent: 0 };
  for (const [index, group] of groups.entries()) {
    const remaining = groups.slice(index).flat().length;
    const stop = (stoppedBy: KarmaReconcileOutcome["stoppedBy"], failure?: unknown) => ({
      ...outcome,
      notSent: remaining,
      stoppedBy,
      ...(failure === undefined ? {} : { failure }),
    });
    onSignature?.(index + 1, groups.length);
    const recorded = new Map<string, RecordedCall>();
    try {
      const prepared = prepareKarmaReconcileBatch({
        ...scope,
        id: crypto.randomUUID(),
        rail,
        garden,
        calls: group,
      });
      const record = await batches.execute(prepared, {
        // Nothing here can refuse a group: each step records its own failure instead of
        // reverting, so the sender's estimate of the exact group is the whole check.
        preflight: async () => undefined,
        verify: verifyKarmaSync(prepared, input, recorded),
      });
      if (record.status === "confirmed") {
        const landed = group.flatMap(({ id }) => recorded.get(id) ?? []);
        outcome.recorded.push(...landed.map(({ noProject: _, ...call }) => call));
        if (landed.some((call) => call.noProject) && index < groups.length - 1)
          return { ...stop("no-project"), notSent: remaining - group.length };
        continue;
      }
      if (UNKNOWN_BATCH_STATES.has(record.status))
        return { ...outcome, unknown: group.length, notSent: remaining - group.length };
      return stop(record.status === "reverted" ? "reverted" : "declined");
    } catch (error) {
      if (error instanceof Error && NOT_BATCHABLE.has(error.message)) return stop("over-ceilings");
      return stop("error", error);
    }
  }
  return outcome;
}

/** Karma syncs whose outcome is unknown. They hold the next sync of this garden until settled. */
export interface KarmaReconcileHold {
  /** The syncs this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  /** How many calls they carry. */
  calls: number;
}

/** A held sync that ended. Its calls' results come only from the tab that read them, once. */
export interface SettledKarmaSync {
  recorded: KarmaCallResult[];
}

async function settleOpenSyncs(
  input: KarmaReconcileInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: KarmaReconcileHold | null; onlyShown?: boolean } = {}
): Promise<{ hold: KarmaReconcileHold | null; saved: SettledKarmaSync[] }> {
  const recordedBy = new Map<string, Map<string, RecordedCall>>();
  const { held, ended } = await settleOpenBatches({
    batches: input.batches,
    scope: input.scope,
    domain: karmaReconcileDomain(input.garden),
    verifierFor: (prepared) => {
      const recorded = new Map<string, RecordedCall>();
      recordedBy.set(prepared.id, recorded);
      return verifyKarmaSync(prepared, input, recorded);
    },
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  const saved = ended.map((record) => ({
    recorded: provenItems(record).flatMap(({ id }) => {
      const call = recordedBy.get(record.id)?.get(id);
      return call ? [{ account: call.account, synced: call.synced, reason: call.reason }] : [];
    }),
  }));
  if (held.length === 0) return { hold: null, saved };
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      calls: held.reduce((total, record) => total + record.prepared.items.length, 0),
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so a sync another tab ended still reports here. */
export function readKarmaReconcileHold(
  input: KarmaReconcileInput,
  shown?: KarmaReconcileHold | null
) {
  return settleOpenSyncs(input, input.batches.reconcile, { shown });
}

/**
 * Call only for a person who has just seen the garden's Karma status and chosen to move on. A
 * reconcile repeats safely, so moving on and syncing again costs at most a second transaction.
 */
export function moveOnFromKarmaReconcileHold(input: KarmaReconcileInput, hold: KarmaReconcileHold) {
  return settleOpenSyncs(input, input.batches.release, { shown: hold, onlyShown: true });
}
