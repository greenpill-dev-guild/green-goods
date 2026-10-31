import type { Abi, Hex } from "viem";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import { fetchHatsModuleAddress } from "../../utils/blockchain/garden-hats";
import { readGardenRoleHat } from "../../utils/blockchain/garden-role-reads";
import { GARDEN_ROLE_IDS, type GardenRole } from "../../utils/blockchain/garden-roles";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches, verifyByReading } from "../transactions/batch-hold";
import {
  type BatchBudget,
  type BatchOperations,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";

/** One person and the role they are getting. */
export interface GardenMemberRow {
  address: Address;
  role: GardenRole;
}

interface HatsCall {
  address: Address;
  functionName: string;
  args: readonly unknown[];
}

/** How an add reads the chain. */
export interface GardenMembersChain {
  hatsModule(): Promise<Address | undefined>;
  /** Whether this person wears the role's exact hat: what `grantRole` checks before it mints. */
  wearsRole(row: GardenMemberRow): Promise<boolean>;
  /** Why the chain would refuse this call from `account`, or null when it would go through. */
  refusal(call: HatsCall, account: Address): Promise<string | null>;
}

export function createGardenMembersChain(
  gardenAddress: Address,
  chainId: number
): GardenMembersChain {
  let module: Promise<Address | undefined> | undefined;
  const hatsModule = () => {
    module ??= fetchHatsModuleAddress(gardenAddress, chainId);
    return module;
  };
  return {
    hatsModule,
    wearsRole: async ({ address, role }) =>
      readGardenRoleHat(gardenAddress, address, role, chainId, await hatsModule()),
    refusal: async ({ address, functionName, args }, account) => {
      const { success, error } = await simulateTransaction(
        address,
        HATS_MODULE_ABI as Abi,
        functionName,
        [...args],
        account,
        chainId
      );
      return success ? null : (error?.message ?? "Transaction simulation failed");
    },
  };
}

/** The most people one signature carries. Past it, the list takes another signature. */
const MAX_MEMBERS_PER_SIGNATURE = 10;

export const signaturesForMembers = (count: number) => Math.ceil(count / MAX_MEMBERS_PER_SIGNATURE);

const ARBITRUM_CEILINGS = {
  maxCalls: 1,
  maxCalldataBytes: 2_048,
  maxFeePerGas: "1000000000",
  maxFee: "2000000000000000",
};

/**
 * Ceilings for one signature, on the chains they were sized for. Sized from Arbitrum receipts, not
 * a fork run: `grantRole` used 253k to 463k gas, so ten people come to about 5M, and a Green Goods
 * passkey UserOperation adds about 730k for validation and sponsorship. Past them a list goes one
 * person at a time. The first live batch on each rail confirms them before that rail is listed.
 */
const GARDEN_MEMBERS_BUDGETS: Partial<Record<number, Record<BatchRail, BatchBudget>>> = {
  42161: {
    passkey: { ...ARBITRUM_CEILINGS, maxGas: "8000000", sponsorship: "required" },
    wallet: { ...ARBITRUM_CEILINGS, maxGas: "7000000", sponsorship: "wallet" },
  },
};

export function gardenMembersBudget(rail: BatchRail, chainId: number): BatchBudget | null {
  return GARDEN_MEMBERS_BUDGETS[chainId]?.[rail] ?? null;
}

export const addMembersDomain = (gardenAddress: Address) =>
  `add-members:${gardenAddress.toLowerCase()}`;

const rowId = ({ address, role }: GardenMemberRow) => `${address.toLowerCase()}:${role}`;

function rowFrom(itemId: string): GardenMemberRow {
  const [address, role] = itemId.split(":");
  return { address: address as Address, role: role as GardenRole };
}

const rowsOf = (items: PreparedBatch["items"]) => items.map((item) => rowFrom(item.id));

function grantRolesCall(
  moduleAddress: Address,
  gardenAddress: Address,
  rows: readonly GardenMemberRow[]
): HatsCall {
  return {
    address: moduleAddress,
    functionName: "grantRoles",
    args: [
      gardenAddress,
      rows.map((row) => row.address),
      rows.map((row) => GARDEN_ROLE_IDS[row.role]),
    ],
  };
}

export function prepareAddMembersBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  gardenAddress: Address;
  moduleAddress: Address;
  rail: BatchRail;
  rows: readonly GardenMemberRow[];
}): PreparedBatch {
  const budget = gardenMembersBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  const call = {
    ...grantRolesCall(input.moduleAddress, input.gardenAddress, input.rows),
    abi: onlyFunction(HATS_MODULE_ABI as Abi, "grantRoles"),
  };
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: addMembersDomain(input.gardenAddress),
    mode: "single-call",
    budget,
    items: input.rows.map((row) => ({ id: rowId(row), call })),
  });
}

interface GardenMembersBatchInput {
  batches: BatchOperations;
  scope: BatchScope;
  gardenAddress: Address;
  chain: GardenMembersChain;
  retryMs?: number;
}

/** `RoleGranted` fires only on a new mint, so wearing the hat is what proves a row. */
const verifyMembers = ({ chain, retryMs }: Pick<GardenMembersBatchInput, "chain" | "retryMs">) =>
  verifyByReading((itemId) => chain.wearsRole(rowFrom(itemId)), retryMs);

export interface AddMembersOutcome {
  added: (GardenMemberRow & { transactionHash: Hex })[];
  /** The chain already had these, so nobody was asked to sign for them. */
  alreadyHeld: GardenMemberRow[];
  /** The chain would refuse these. Nothing is sent until the person changes the list. */
  refused: (GardenMemberRow & { reason: string })[];
  /** Nothing went out for these, and they can go again as they are. */
  notSent: GardenMemberRow[];
  /** Nothing went out for these: past the ceilings, they need more signatures than promised. */
  notBatchable: GardenMemberRow[];
  /** They may have landed: held until someone reads them or moves on. */
  unknown: GardenMemberRow[];
  /** Why a send stopped before going out, when that is more than a declined signature. */
  failure?: unknown;
}

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/**
 * Add every row, one signature per group. Everything is checked before anything is signed, because
 * one row the chain refuses would revert its whole call. Earlier groups stay added when a later one
 * stops, since each is its own transaction.
 */
export async function addGardenMembersBatch(
  input: GardenMembersBatchInput & {
    rail: BatchRail;
    rows: readonly GardenMemberRow[];
    onLanded?: (rows: readonly GardenMemberRow[]) => void;
  }
): Promise<AddMembersOutcome> {
  const { batches, scope, gardenAddress, chain, rail, onLanded } = input;
  const moduleAddress = await chain.hatsModule();
  if (!moduleAddress) throw new Error("Hats module is not configured for this garden");

  const rows = [...new Map(input.rows.map((row) => [rowId(row), row])).values()];
  const outcome: AddMembersOutcome = {
    added: [],
    alreadyHeld: [],
    refused: [],
    notSent: [],
    notBatchable: [],
    unknown: [],
  };
  let wearing: boolean[];
  try {
    wearing = await Promise.all(rows.map((row) => chain.wearsRole(row)));
  } catch (failure) {
    // Unknown is not "no": a grant on a held role still costs a transaction and runs its sync steps.
    return { ...outcome, notSent: rows, failure };
  }
  outcome.alreadyHeld = rows.filter((_, index) => wearing[index]);
  const toSend = rows.filter((_, index) => !wearing[index]);
  const groups = Array.from({ length: signaturesForMembers(toSend.length) }, (_, index) =>
    toSend.slice(index * MAX_MEMBERS_PER_SIGNATURE, (index + 1) * MAX_MEMBERS_PER_SIGNATURE)
  );

  for (const group of groups) {
    const groupCall = grantRolesCall(moduleAddress, gardenAddress, group);
    const refusal = await chain.refusal(groupCall, scope.account);
    if (!refusal) continue;
    const alone = await Promise.all(
      group.map(async (row) => ({
        row,
        reason: await chain.refusal(
          {
            address: moduleAddress,
            functionName: "grantRole",
            args: [gardenAddress, row.address, GARDEN_ROLE_IDS[row.role]],
          },
          scope.account
        ),
      }))
    );
    const refused = alone.flatMap(({ row, reason }) => (reason ? [{ ...row, reason }] : []));
    // The call is refused but no single row is: nothing is sent blind.
    if (refused.length === 0) return { ...outcome, notSent: toSend, failure: new Error(refusal) };
    outcome.refused.push(...refused);
  }
  if (outcome.refused.length > 0) {
    const refusedIds = new Set(outcome.refused.map(rowId));
    return { ...outcome, notSent: toSend.filter((row) => !refusedIds.has(rowId(row))) };
  }

  for (const [index, group] of groups.entries()) {
    const remaining = groups.slice(index).flat();
    try {
      const prepared = prepareAddMembersBatch({
        ...scope,
        id: crypto.randomUUID(),
        gardenAddress,
        moduleAddress,
        rail,
        rows: group,
      });
      const record = await batches.execute(prepared, {
        // Roles can lapse while a dialog is open, and the last signature may be a while ago.
        preflight: async () => {
          const reason = await chain.refusal(
            grantRolesCall(moduleAddress, gardenAddress, group),
            scope.account
          );
          if (reason) throw new Error(reason);
        },
        verify: verifyMembers(input),
      });
      if (record.status === "confirmed") {
        const transactionHash = record.receipts[0].transactionHash;
        outcome.added.push(...group.map((row) => ({ ...row, transactionHash })));
        onLanded?.(group);
        continue;
      }
      if (UNKNOWN_BATCH_STATES.has(record.status))
        return { ...outcome, unknown: group, notSent: groups.slice(index + 1).flat() };
      return { ...outcome, notSent: remaining };
    } catch (error) {
      if (error instanceof Error && NOT_BATCHABLE.has(error.message))
        return { ...outcome, notBatchable: remaining };
      return { ...outcome, notSent: remaining, failure: error };
    }
  }
  return outcome;
}

/** People whose last add has an unknown outcome. They stay held until it is settled. */
export interface AddMembersHold {
  /** The adds this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  rows: GardenMemberRow[];
  /** What the chain says now, for each row that could be read. */
  onChain: (GardenMemberRow & { wearsRole: boolean })[];
}

/** A row a read proved landed. The hash comes only from the tab that ended it, so it counts once. */
export type ProvenMemberRow = GardenMemberRow & { transactionHash?: Hex };

interface AddMembersSettlement {
  hold: AddMembersHold | null;
  saved: ProvenMemberRow[];
}

async function settleOpenAdds(
  input: GardenMembersBatchInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: AddMembersHold | null; onlyShown?: boolean } = {}
): Promise<AddMembersSettlement> {
  const { batches, scope, gardenAddress, chain } = input;
  const { held, ended, endedHere } = await settleOpenBatches({
    batches,
    scope,
    domain: addMembersDomain(gardenAddress),
    verifierFor: () => verifyMembers(input),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  const saved = ended.flatMap((record) => {
    const here = endedHere.includes(record);
    const transactionHash = here ? record.receipts[0]?.transactionHash : undefined;
    return rowsOf(provenItems(record)).map((row) => ({ ...row, transactionHash }));
  });
  const rows = held.flatMap((record) => rowsOf(record.prepared.items));
  if (rows.length === 0) return { hold: null, saved };

  const reads = await Promise.allSettled(rows.map((row) => chain.wearsRole(row)));
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      rows,
      onChain: reads.flatMap((read, index) =>
        read.status === "fulfilled" ? [{ ...rows[index], wearsRole: read.value }] : []
      ),
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so an add another tab ended still reports here. */
export function readAddMembersHold(input: GardenMembersBatchInput, shown?: AddMembersHold | null) {
  return settleOpenAdds(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen what the chain says and chosen to move on. */
export function moveOnFromAddMembersHold(input: GardenMembersBatchInput, hold: AddMembersHold) {
  // A row that could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.onChain.length < hold.rows.length) return readAddMembersHold(input, hold);
  return settleOpenAdds(input, input.batches.release, { shown: hold, onlyShown: true });
}
