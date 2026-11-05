import type { Hex } from "viem";
import type { Address, Domain } from "../../types/domain";
import {
  ActionRegistryABI,
  createClients,
  GardenAccountABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { domainMaskOf, expandDomainMask } from "../../utils/domain";
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
import type { ContractCall } from "../transactions/types";

/** One garden setting a save changes, and the value it writes. */
export type GardenSettingsChange =
  | { field: "name" | "description" | "location" | "banner"; value: string }
  | { field: "openJoining"; value: boolean }
  | { field: "maxGardeners"; value: number }
  | { field: "domains"; value: readonly Domain[] };

type GardenSettingsField = GardenSettingsChange["field"];

type ChainCall = Pick<ContractCall, "address" | "abi" | "functionName"> &
  Partial<Pick<ContractCall, "args">>;

/** How a settings batch reads the chain; `simulate` rejects with the contract's own reason. */
export interface GardenSettingsChain {
  read(call: ChainCall): Promise<unknown>;
  simulate(call: ChainCall & { account: Address }): Promise<unknown>;
}

export function createGardenSettingsChain(chainId: number): GardenSettingsChain {
  const { publicClient } = createClients(chainId);
  return {
    read: (call) => publicClient.readContract(call),
    simulate: (call) => publicClient.simulateContract(call),
  };
}

const ACCOUNT_SETTINGS = {
  name: { write: "updateName", read: "name" },
  description: { write: "updateDescription", read: "description" },
  location: { write: "updateLocation", read: "location" },
  banner: { write: "updateBannerImage", read: "bannerImage" },
  openJoining: { write: "setOpenJoining", read: "openJoining" },
  maxGardeners: { write: "setMaxGardeners", read: "maxGardeners" },
} as const;

/**
 * Ceilings for one save, on the chains they were sized for. A passkey quote counts every limit in
 * its UserOperation; a wallet quote counts what the calls simulate to use. Sized from Arbitrum
 * receipts, not a fork run: a Green Goods passkey UserOperation quoted 1.59M gas at 0.029 gwei,
 * and `updateBannerImage` used 135k from a wallet. Past them a save goes one field at a time.
 * The first live batch on each rail confirms them before that rail is listed.
 */
const ARBITRUM_CEILINGS = {
  maxCalls: 7,
  maxCalldataBytes: 8_192,
  maxFeePerGas: "1000000000",
  maxFee: "1000000000000000",
};
const GARDEN_SETTINGS_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "6000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "3000000", sponsorship: "wallet" },
  },
};

export function gardenSettingsBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return GARDEN_SETTINGS_BUDGETS[chainId]?.[rail] ?? null;
}

export const gardenSettingsDomain = (gardenAddress: Address) =>
  `garden-settings:${gardenAddress.toLowerCase()}`;

function callFor(change: GardenSettingsChange, gardenAddress: Address, chainId: number) {
  if (change.field === "domains")
    return {
      address: getNetworkContracts(chainId).actionRegistry,
      abi: onlyFunction(ActionRegistryABI, "setGardenDomains"),
      functionName: "setGardenDomains",
      args: [gardenAddress, domainMaskOf(change.value)],
    };
  const functionName = ACCOUNT_SETTINGS[change.field].write;
  return {
    address: gardenAddress,
    abi: onlyFunction(GardenAccountABI, functionName),
    functionName,
    args: [change.field === "maxGardeners" ? BigInt(change.value) : change.value],
  };
}

export function prepareGardenSettingsBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  gardenAddress: Address;
  rail: BatchRail;
  changes: readonly GardenSettingsChange[];
}): PreparedBatch {
  const budget = gardenSettingsBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: gardenSettingsDomain(input.gardenAddress),
    mode: "atomic",
    budget,
    items: input.changes.map((change) => ({
      id: change.field,
      call: callFor(change, input.gardenAddress, input.chainId),
    })),
  });
}

function changeFrom(field: GardenSettingsField, raw: unknown): GardenSettingsChange {
  switch (field) {
    case "domains":
      return { field, value: expandDomainMask(Number(raw)) };
    case "maxGardeners":
      return { field, value: Number(raw) };
    case "openJoining":
      return { field, value: Boolean(raw) };
    default:
      return { field, value: String(raw) };
  }
}

/** Every setting call writes its value as its last argument. */
const writtenBy = (item: PreparedBatch["items"][number]) => item.call.args.at(-1);

function readSetting(
  field: GardenSettingsField,
  gardenAddress: Address,
  chainId: number,
  chain: GardenSettingsChain
) {
  return field === "domains"
    ? chain.read({
        address: getNetworkContracts(chainId).actionRegistry,
        abi: ActionRegistryABI,
        functionName: "gardenDomains",
        args: [gardenAddress],
      })
    : chain.read({
        address: gardenAddress,
        abi: GardenAccountABI,
        functionName: ACCOUNT_SETTINGS[field].read,
      });
}

/** `setMaxGardeners` emits nothing, so what the chain holds is what proves a field. */
export function verifyGardenSettings(
  prepared: PreparedBatch,
  options: Pick<GardenSettingsBatchInput, "gardenAddress" | "chain" | "retryMs">
): VerifyBatchItems {
  const { gardenAddress, chain, retryMs } = options;
  return verifyByReading(async (itemId) => {
    const item = prepared.items.find((candidate) => candidate.id === itemId);
    const onChain = await readSetting(
      itemId as GardenSettingsField,
      gardenAddress,
      prepared.chainId,
      chain
    );
    return item !== undefined && String(onChain) === String(writtenBy(item));
  }, retryMs);
}

/** Roles can lapse while a form is open, and one stale role would revert the whole group. */
async function checkPermissions(
  prepared: PreparedBatch,
  itemIds: readonly string[],
  chain: GardenSettingsChain
) {
  await Promise.all(
    prepared.items
      .filter((item) => itemIds.includes(item.id))
      .map(({ id, call }) =>
        chain.simulate({
          address: call.address,
          // The whole ABI, so a revert names its reason.
          abi: id === "domains" ? ActionRegistryABI : GardenAccountABI,
          functionName: call.functionName,
          args: call.args,
          account: prepared.account,
        })
      )
  );
}

interface GardenSettingsBatchInput {
  batches: BatchOperations;
  scope: BatchScope;
  gardenAddress: Address;
  chain: GardenSettingsChain;
  /** How long to wait before reading again when the chain disagrees with a receipt. */
  retryMs?: number;
}

export type GardenSettingsBatchOutcome =
  | { status: "saved"; transactionHash: Hex }
  /** Nothing landed, so the whole draft can be sent again. */
  | { status: "not-saved" }
  /** It may have landed: its fields are held until someone reads it or moves on. */
  | { status: "unknown" }
  /** Nothing was sent, and these changes can still go one at a time. */
  | { status: "not-batchable" };

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/** Rejects only for a failure before anything was sent. */
export async function sendGardenSettingsBatch(
  input: GardenSettingsBatchInput & { rail: BatchRail; changes: readonly GardenSettingsChange[] }
): Promise<GardenSettingsBatchOutcome> {
  const { batches, scope, gardenAddress, chain } = input;
  try {
    const prepared = prepareGardenSettingsBatch({
      ...scope,
      id: crypto.randomUUID(),
      gardenAddress,
      rail: input.rail,
      changes: input.changes,
    });
    const record = await batches.execute(prepared, {
      preflight: (reviewed, itemIds) => checkPermissions(reviewed, itemIds, chain),
      verify: verifyGardenSettings(prepared, input),
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

/** Fields whose last save has an unknown outcome. They stay locked until it is settled. */
export interface GardenSettingsHold {
  /** The saves this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  fields: GardenSettingsField[];
  /** What the held saves tried to write. */
  attempted: GardenSettingsChange[];
  /** What the chain holds now, for each field that could be read. */
  onChain: GardenSettingsChange[];
}

interface GardenSettingsSettlement {
  hold: GardenSettingsHold | null;
  /** Changes this read proved landed. */
  saved: GardenSettingsChange[];
}

const changesOf = (items: PreparedBatch["items"]) =>
  items.map((item) => changeFrom(item.id as GardenSettingsField, writtenBy(item)));

async function settleOpenSaves(
  input: GardenSettingsBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: GardenSettingsHold | null; onlyShown?: boolean } = {}
): Promise<GardenSettingsSettlement> {
  const { batches, scope, gardenAddress, chain } = input;
  const { held, ended } = await settleOpenBatches({
    batches,
    scope,
    domain: gardenSettingsDomain(gardenAddress),
    verifierFor: (prepared) => verifyGardenSettings(prepared, input),
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
  const reads = await Promise.allSettled(
    fields.map((field) => readSetting(field, gardenAddress, scope.chainId, chain))
  );
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      fields,
      attempted,
      onChain: reads.flatMap((read, index) =>
        read.status === "fulfilled" ? [changeFrom(fields[index], read.value)] : []
      ),
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so a save another tab ended still reports here. */
export function readGardenSettingsHold(
  input: GardenSettingsBatchInput,
  shown?: GardenSettingsHold | null
) {
  return settleOpenSaves(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen the chain's values and chosen to move on. */
export function moveOnFromGardenSettingsHold(
  input: GardenSettingsBatchInput,
  hold: GardenSettingsHold
) {
  // A value that could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.onChain.length < hold.fields.length) return readGardenSettingsHold(input, hold);
  return settleOpenSaves(input, input.batches.release, { shown: hold, onlyShown: true });
}
