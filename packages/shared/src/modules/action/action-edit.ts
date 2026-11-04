import type { Address } from "../../types/domain";
import {
  ActionRegistryABI,
  createClients,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import type { ContractCall } from "../transactions/types";

/** One field an action edit changes, and the value it writes. Times are in seconds, as stored. */
export type ActionEditChange =
  | { field: "title" | "instructions"; value: string }
  | { field: "startTime" | "endTime"; value: number };

export type ActionEditField = ActionEditChange["field"];

/** The registry's setter for each field. */
export const ACTION_EDIT_WRITES = {
  title: "updateActionTitle",
  startTime: "updateActionStartTime",
  endTime: "updateActionEndTime",
  instructions: "updateActionInstructions",
} as const satisfies Record<ActionEditField, string>;

/** The arguments a field's setter takes. */
export function actionEditArgs(
  actionUID: bigint,
  change: ActionEditChange
): [bigint, bigint | string] {
  return [actionUID, typeof change.value === "number" ? BigInt(change.value) : change.value];
}

type ChainCall = Pick<ContractCall, "address" | "abi" | "functionName"> &
  Partial<Pick<ContractCall, "args">>;

/** How an action edit reads the chain; `simulate` rejects with the contract's own reason. */
export interface ActionEditChain {
  read(call: ChainCall): Promise<unknown>;
  simulate(call: ChainCall & { account: Address }): Promise<unknown>;
}

export function createActionEditChain(chainId: number): ActionEditChain {
  const { publicClient } = createClients(chainId);
  return {
    read: (call) => publicClient.readContract(call),
    simulate: (call) => publicClient.simulateContract(call),
  };
}

/** The fields of the registry's `getAction` that an edit writes. */
export interface RegisteredAction {
  startTime: bigint;
  endTime: bigint;
  title: string;
  instructions: string;
}

export type ActionWindow = Pick<RegisteredAction, "startTime" | "endTime">;

export async function readAction(
  registry: Address,
  actionUID: bigint,
  chain: ActionEditChain
): Promise<RegisteredAction> {
  return (await chain.read({
    address: registry,
    abi: ActionRegistryABI,
    functionName: "getAction",
    args: [actionUID],
  })) as RegisteredAction;
}

/**
 * The registry's error for the first window write it would refuse, applying `changes` in order.
 * Each setter checks its value against the other bound as it stands then (Action.sol): a start
 * must come before the end it meets, and an end after the start it meets.
 */
export function refusedWindowWrite(window: ActionWindow, changes: readonly ActionEditChange[]) {
  let { startTime, endTime } = window;
  for (const { field, value } of changes) {
    if (field === "startTime") {
      if (BigInt(value) >= endTime) return "StartTimeAfterEndTime";
      startTime = BigInt(value);
    } else if (field === "endTime") {
      if (BigInt(value) <= startTime) return "EndTimeBeforeStartTime";
      endTime = BigInt(value);
    }
  }
  return null;
}

const START_FIRST: readonly ActionEditField[] = ["title", "startTime", "endTime", "instructions"];
const END_FIRST: readonly ActionEditField[] = ["title", "endTime", "startTime", "instructions"];

/**
 * A window moved past its own end has to write the end first, and one moved before its own start
 * the start first, so the order follows the window the chain holds. When neither order fits, the
 * registry's own error stops the save before anyone signs.
 */
export function orderActionEdit(changes: readonly ActionEditChange[], window: ActionWindow) {
  const inOrder = (order: readonly ActionEditField[]) =>
    order.flatMap((field) => changes.filter((change) => change.field === field));
  const startFirst = inOrder(START_FIRST);
  const refused = refusedWindowWrite(window, startFirst);
  if (!refused) return startFirst;
  const endFirst = inOrder(END_FIRST);
  if (!refusedWindowWrite(window, endFirst)) return endFirst;
  throw new Error(refused);
}

/** The changes in an order the registry accepts, for a save that sends them one at a time. */
export async function orderActionEditOnChain(input: {
  chainId: number;
  actionUID: bigint;
  changes: readonly ActionEditChange[];
  chain: ActionEditChain;
}): Promise<ActionEditChange[]> {
  const registry = getNetworkContracts(input.chainId).actionRegistry;
  return orderActionEdit(input.changes, await readAction(registry, input.actionUID, input.chain));
}
