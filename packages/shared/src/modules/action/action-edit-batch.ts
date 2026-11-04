import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { logger } from "../app/logger";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches, verifyByReading } from "../transactions/batch-hold";
import {
  type BatchBudget,
  type BatchOperations,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
  type VerifyBatchItems,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";
import {
  ACTION_EDIT_WRITES,
  type ActionEditChain,
  type ActionEditChange,
  type ActionEditField,
  type ActionWindow,
  actionEditArgs,
  orderActionEdit,
  readAction,
  refusedWindowWrite,
} from "./action-edit";

/**
 * Ceilings for one save, on the chains they were sized for. Its calls are at most four string and
 * time setters on one contract, so garden settings' Arbitrum sizing covers them: a Green Goods
 * passkey UserOperation quoted 1.59M gas at 0.029 gwei, and a string setter used 135k from a
 * wallet. These come from those receipts, not a run of this save; past them a save goes one field
 * at a time, and the first live batch on each rail confirms them before that rail is listed.
 */
const ARBITRUM_CEILINGS = {
  maxCalls: 4,
  maxCalldataBytes: 8_192,
  maxFeePerGas: "1000000000",
  maxFee: "1000000000000000",
};
const ACTION_EDIT_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "6000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "3000000", sponsorship: "wallet" },
  },
};

export function actionEditBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return ACTION_EDIT_BUDGETS[chainId]?.[rail] ?? null;
}

export const actionEditDomain = (chainId: number, actionUID: bigint) =>
  `action-edit:${getNetworkContracts(chainId).actionRegistry.toLowerCase()}:${actionUID}`;

export function prepareActionEditBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  actionUID: bigint;
  rail: BatchRail;
  changes: readonly ActionEditChange[];
  /** What the registry holds for the window now, which sets the order. */
  window: ActionWindow;
}): PreparedBatch {
  const budget = actionEditBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  const registry = getNetworkContracts(input.chainId).actionRegistry;
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: actionEditDomain(input.chainId, input.actionUID),
    mode: "atomic",
    budget,
    items: orderActionEdit(input.changes, input.window).map((change) => ({
      id: change.field,
      call: {
        address: registry,
        abi: onlyFunction(ActionRegistryABI, ACTION_EDIT_WRITES[change.field]),
        functionName: ACTION_EDIT_WRITES[change.field],
        args: actionEditArgs(input.actionUID, change),
      },
    })),
  });
}

/** Every call in a save goes to one registry and names one action first. */
function targetOf(prepared: PreparedBatch) {
  const { address, args } = prepared.items[0].call;
  return { registry: address, actionUID: args[0] as bigint };
}

function changeFrom(field: ActionEditField, raw: unknown): ActionEditChange {
  return field === "startTime" || field === "endTime"
    ? { field, value: Number(raw) }
    : { field, value: String(raw) };
}

const changesOf = (items: PreparedBatch["items"]) =>
  items.map((item) => changeFrom(item.id as ActionEditField, item.call.args[1]));

/** A field is saved when the action holds what the save wrote. */
function verifyActionEdit(
  prepared: PreparedBatch,
  options: Pick<ActionEditBatchInput, "chain" | "retryMs">
): VerifyBatchItems {
  const { registry, actionUID } = targetOf(prepared);
  return verifyByReading(async (itemId) => {
    const item = prepared.items.find((candidate) => candidate.id === itemId);
    const action = await readAction(registry, actionUID, options.chain);
    return (
      item !== undefined && String(action[itemId as ActionEditField]) === String(item.call.args[1])
    );
  }, options.retryMs);
}

/**
 * The first call runs as the sender against the state it will meet, so an account that does not
 * own the action stops with the registry's own reason. The second window write meets the first
 * one's value and cannot be simulated alone, so the window writes are checked in order against
 * the window the chain holds now.
 */
async function checkActionEdit(prepared: PreparedBatch, chain: ActionEditChain) {
  const { registry, actionUID } = targetOf(prepared);
  const [first] = prepared.items;
  const [action] = await Promise.all([
    readAction(registry, actionUID, chain),
    chain.simulate({
      address: registry,
      // The whole ABI, so a revert names its reason.
      abi: ActionRegistryABI,
      functionName: first.call.functionName,
      args: first.call.args,
      account: prepared.account,
    }),
  ]);
  const refused = refusedWindowWrite(action, changesOf(prepared.items));
  if (refused) throw new Error(refused);
}

interface ActionEditBatchInput {
  batches: BatchOperations;
  scope: BatchScope;
  actionUID: bigint;
  chain: ActionEditChain;
  /** How long to wait before reading again when the chain disagrees with a receipt. */
  retryMs?: number;
}

export type ActionEditBatchOutcome =
  | { status: "saved"; transactionHash: Hex }
  /** Nothing landed, so the whole edit can be sent again. */
  | { status: "not-saved" }
  /** It may have landed: the edit is held until someone reads it or moves on. */
  | { status: "unknown" }
  /** Nothing was sent, and these changes can still go one at a time. */
  | { status: "not-batchable" };

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/** Rejects only for a failure before anything was sent. */
export async function sendActionEditBatch(
  input: ActionEditBatchInput & { rail: BatchRail; changes: readonly ActionEditChange[] }
): Promise<ActionEditBatchOutcome> {
  const { batches, scope, actionUID, chain } = input;
  try {
    const registry = getNetworkContracts(scope.chainId).actionRegistry;
    const prepared = prepareActionEditBatch({
      ...scope,
      id: crypto.randomUUID(),
      actionUID,
      rail: input.rail,
      changes: input.changes,
      window: await readAction(registry, actionUID, chain),
    });
    const record = await batches.execute(prepared, {
      preflight: (reviewed) => checkActionEdit(reviewed, chain),
      verify: verifyActionEdit(prepared, input),
    });
    if (record.status === "confirmed")
      return { status: "saved", transactionHash: record.receipts[0].transactionHash };
    return { status: UNKNOWN_BATCH_STATES.has(record.status) ? "unknown" : "not-saved" };
  } catch (error) {
    if (error instanceof Error && NOT_BATCHABLE.has(error.message))
      return { status: "not-batchable" };
    throw error;
  }
}

/** An edit whose outcome is unknown. Saving waits until it is settled. */
export interface ActionEditHold {
  /** The saves this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  fields: ActionEditField[];
  /** What the held saves tried to write. */
  attempted: ActionEditChange[];
  /** What the action holds now for those fields, or nothing when it could not be read. */
  onChain: ActionEditChange[];
}

interface ActionEditSettlement {
  hold: ActionEditHold | null;
  /** Changes this read proved landed. */
  saved: ActionEditChange[];
}

async function settleOpenEdits(
  input: ActionEditBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: ActionEditHold | null; onlyShown?: boolean } = {}
): Promise<ActionEditSettlement> {
  const { batches, scope, actionUID, chain } = input;
  const { held, ended } = await settleOpenBatches({
    batches,
    scope,
    domain: actionEditDomain(scope.chainId, actionUID),
    verifierFor: (prepared) => verifyActionEdit(prepared, input),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  // What a save proved is reported once, when it ends, so a later read cannot put an old value
  // back over a newer edit.
  const attempted = held.flatMap((record) => changesOf(record.prepared.items));
  const saved = ended.flatMap((record) => changesOf(provenItems(record)));
  if (attempted.length === 0) return { hold: null, saved };

  const fields = attempted.map((change) => change.field);
  const registry = getNetworkContracts(scope.chainId).actionRegistry;
  const action = await readAction(registry, actionUID, chain).catch((error: unknown) => {
    // The hold stands and shows its values as unread until a read finds them.
    logger.warn("Could not read the action for a held edit", {
      error,
      actionUID: actionUID.toString(),
    });
    return null;
  });
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      fields,
      attempted,
      onChain: action ? fields.map((field) => changeFrom(field, action[field])) : [],
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so a save another tab ended still reports here. */
export function readActionEditHold(input: ActionEditBatchInput, shown?: ActionEditHold | null) {
  return settleOpenEdits(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen the chain's values and chosen to move on. */
export function moveOnFromActionEditHold(input: ActionEditBatchInput, hold: ActionEditHold) {
  // A value that could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.onChain.length < hold.fields.length) return readActionEditHold(input, hold);
  return settleOpenEdits(input, input.batches.release, { shown: hold, onlyShown: true });
}
