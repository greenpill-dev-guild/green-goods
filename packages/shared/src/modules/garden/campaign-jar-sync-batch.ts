import type { Abi, Hex } from "viem";
import type { Address } from "../../types/domain";
import { COOKIE_JAR_ABI, COOKIE_JAR_FACTORY_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { createClients } from "../../utils/blockchain/contracts";
import type { BatchRail } from "../transactions/batch-enablement";
import { provenItems, settleOpenBatches, verifyByReading } from "../transactions/batch-hold";
import {
  type BatchOperations,
  type BatchScope,
  type PreparedBatch,
  UNKNOWN_BATCH_STATES,
  type VerifyBatchItems,
} from "../transactions/batch-types";
import { onlyFunction, prepareBatch } from "../transactions/prepared-batch";
import type { ContractCall } from "../transactions/types";
import { campaignJarSyncBudget } from "./campaign-jar-sync-route";

/**
 * One sync of a campaign jar: who joins its allowlist, who leaves it, and the campaign metadata it
 * writes. The allowlist is who can withdraw, so every write here needs the jar's owner role.
 */
export interface CampaignJarSync {
  jarAddress: Address;
  grant: readonly Address[];
  revoke: readonly Address[];
  /** The factory keeps a jar's metadata. Null leaves the metadata as it is. */
  metadata: { factoryAddress: Address; value: string } | null;
}

export type CampaignJarSyncStep = "grant" | "revoke" | "metadata";

const allowlistCall = (jarAddress: Address, functionName: string, users: readonly Address[]) => ({
  address: jarAddress,
  abi: onlyFunction(COOKIE_JAR_ABI as Abi, functionName),
  functionName,
  args: [[...users]],
});

/** The writes a sync needs, in the order they go. */
export function campaignJarSyncCalls(sync: CampaignJarSync) {
  const { jarAddress, grant, revoke, metadata } = sync;
  const steps: { id: CampaignJarSyncStep; call: ContractCall }[] = [];
  if (grant.length > 0)
    steps.push({ id: "grant", call: allowlistCall(jarAddress, "grantJarAllowlistRole", grant) });
  if (revoke.length > 0)
    steps.push({ id: "revoke", call: allowlistCall(jarAddress, "revokeJarAllowlistRole", revoke) });
  if (metadata)
    steps.push({
      id: "metadata",
      call: {
        address: metadata.factoryAddress,
        abi: onlyFunction(COOKIE_JAR_FACTORY_ABI as Abi, "updateMetadata"),
        functionName: "updateMetadata",
        args: [jarAddress, metadata.value],
      },
    });
  return steps;
}

/** A prepared sync read back from its own calls, so a reload checks what a live send would. */
function syncOf(prepared: PreparedBatch): CampaignJarSync {
  const call = (id: CampaignJarSyncStep) => prepared.items.find((item) => item.id === id)?.call;
  const users = (id: CampaignJarSyncStep) => (call(id)?.args[0] as Address[] | undefined) ?? [];
  const metadataCall = call("metadata");
  return {
    jarAddress: (call("grant")?.address ??
      call("revoke")?.address ??
      metadataCall?.args[0]) as Address,
    grant: users("grant"),
    revoke: users("revoke"),
    metadata: metadataCall
      ? { factoryAddress: metadataCall.address, value: metadataCall.args[1] as string }
      : null,
  };
}

/** How a sync reads the chain. `simulate` rejects with the contract's own reason. */
export interface CampaignJarSyncChain {
  allowlist(jarAddress: Address): Promise<readonly Address[]>;
  metadata(factoryAddress: Address, jarAddress: Address): Promise<string>;
  simulate(
    call: Pick<ContractCall, "address" | "abi" | "functionName" | "args"> & { account: Address }
  ): Promise<unknown>;
}

export function createCampaignJarSyncChain(chainId: number): CampaignJarSyncChain {
  const { publicClient } = createClients(chainId);
  return {
    allowlist: (jarAddress) =>
      publicClient.readContract({
        address: jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "getAllowlist",
      }),
    metadata: (factoryAddress, jarAddress) =>
      publicClient.readContract({
        address: factoryAddress,
        abi: COOKIE_JAR_FACTORY_ABI,
        functionName: "getMetadata",
        args: [jarAddress],
      }),
    simulate: (call) => publicClient.simulateContract(call),
  };
}

export const campaignJarSyncDomain = (jarAddress: Address) =>
  `campaign-jar-sync:${jarAddress.toLowerCase()}`;

export function prepareCampaignJarSyncBatch(input: {
  id: string;
  account: Address;
  chainId: number;
  rail: BatchRail;
  sync: CampaignJarSync;
}): PreparedBatch {
  const budget = campaignJarSyncBudget(input.rail, input.chainId);
  if (!budget) throw new Error("batch-budget-required");
  return prepareBatch({
    id: input.id,
    account: input.account,
    chainId: input.chainId,
    domain: campaignJarSyncDomain(input.sync.jarAddress),
    mode: "atomic",
    budget,
    items: campaignJarSyncCalls(input.sync),
  });
}

const lowercased = (addresses: readonly Address[]) =>
  new Set(addresses.map((address) => address.toLowerCase()));

/** Whether the chain holds what one step wrote. Only a read can say: a receipt says it ran. */
async function holds(sync: CampaignJarSync, step: string, chain: CampaignJarSyncChain) {
  if (step === "metadata")
    return (
      sync.metadata !== null &&
      (await chain.metadata(sync.metadata.factoryAddress, sync.jarAddress)) === sync.metadata.value
    );
  const allowlist = lowercased(await chain.allowlist(sync.jarAddress));
  if (step === "grant") return sync.grant.every((user) => allowlist.has(user.toLowerCase()));
  return step === "revoke" && sync.revoke.every((user) => !allowlist.has(user.toLowerCase()));
}

export function verifyCampaignJarSync(
  prepared: PreparedBatch,
  { chain, retryMs }: Pick<CampaignJarSyncInput, "chain" | "retryMs">
): VerifyBatchItems {
  const sync = syncOf(prepared);
  // A node can answer from before the receipt's block, so a failed read is another try, not a no.
  return verifyByReading((step) => holds(sync, step, chain).catch(() => false), retryMs);
}

/** The owner role can be handed on while the dialog is open, and one refused call reverts all. */
async function checkPermissions(
  prepared: PreparedBatch,
  itemIds: readonly string[],
  chain: CampaignJarSyncChain
) {
  await Promise.all(
    prepared.items
      .filter((item) => itemIds.includes(item.id))
      .map(({ id, call }) =>
        chain.simulate({
          address: call.address,
          // The whole ABI, so a revert names its reason.
          abi: (id === "metadata" ? COOKIE_JAR_FACTORY_ABI : COOKIE_JAR_ABI) as Abi,
          functionName: call.functionName,
          args: call.args,
          account: prepared.account,
        })
      )
  );
}

interface CampaignJarSyncInput {
  batches: BatchOperations;
  scope: BatchScope;
  jarAddress: Address;
  chain: CampaignJarSyncChain;
  /** How long to wait before reading again when the chain disagrees with a receipt. */
  retryMs?: number;
}

export type CampaignJarSyncOutcome =
  | { status: "synced"; transactionHash: Hex }
  /** It may have landed: the jar's next sync waits until someone reads it or moves on. */
  | { status: "unknown" }
  /** Nothing changed: the group is all or nothing. */
  | { status: "declined" }
  | { status: "reverted" }
  /** Nothing was sent, and this sync can still go step by step. */
  | { status: "not-batchable" };

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

/**
 * Rejects only when nothing was sent. Another sync of this jar whose outcome is unknown refuses it
 * with `batch-items-held`, whichever steps either has: a sync is worked out from what the chain
 * holds, so a late one could still give access back to someone this one leaves off.
 */
export async function sendCampaignJarSyncBatch(
  input: Omit<CampaignJarSyncInput, "jarAddress"> & { rail: BatchRail; sync: CampaignJarSync }
): Promise<CampaignJarSyncOutcome> {
  const { batches, scope, chain, rail, sync } = input;
  const domain = campaignJarSyncDomain(sync.jarAddress);
  const open = await batches.list(scope);
  if (
    open.some(
      (record) => record.prepared.domain === domain && UNKNOWN_BATCH_STATES.has(record.status)
    )
  )
    throw new Error("batch-items-held");
  try {
    const prepared = prepareCampaignJarSyncBatch({ ...scope, id: crypto.randomUUID(), rail, sync });
    const record = await batches.execute(prepared, {
      preflight: (reviewed, itemIds) => checkPermissions(reviewed, itemIds, chain),
      verify: verifyCampaignJarSync(prepared, input),
    });
    if (record.status === "confirmed")
      return { status: "synced", transactionHash: record.receipts[0].transactionHash };
    if (UNKNOWN_BATCH_STATES.has(record.status)) return { status: "unknown" };
    return { status: record.status === "reverted" ? "reverted" : "declined" };
  } catch (error) {
    if (error instanceof Error && NOT_BATCHABLE.has(error.message))
      return { status: "not-batchable" };
    throw error;
  }
}

/** Syncs of one jar whose outcome is unknown. The jar's next sync waits until they are settled. */
export interface CampaignJarSyncHold {
  /** The syncs this hold shows. Moving on ends only these, since a person has seen them. */
  operationIds: string[];
  grant: Address[];
  revoke: Address[];
  /** Whether the held syncs write metadata. */
  writesMetadata: boolean;
  /** What the chain holds now, or null when it could not be read. */
  onChain: { granted: number; revoked: number; metadataWritten: boolean } | null;
}

/** A sync that ended with steps proven. `whole` when every step it sent is on chain. */
export interface ProvenCampaignJarSync {
  steps: CampaignJarSyncStep[];
  whole: boolean;
}

async function readOnChain(attempted: CampaignJarSync, chain: CampaignJarSyncChain) {
  const { jarAddress, grant, revoke, metadata } = attempted;
  const [allowlist, written] = await Promise.all([
    grant.length + revoke.length > 0 ? chain.allowlist(jarAddress) : [],
    metadata ? chain.metadata(metadata.factoryAddress, jarAddress) : null,
  ]);
  const members = lowercased(allowlist);
  const listed = (users: readonly Address[]) =>
    users.filter((user) => members.has(user.toLowerCase())).length;
  return {
    granted: listed(grant),
    revoked: revoke.length - listed(revoke),
    metadataWritten: metadata !== null && written === metadata.value,
  };
}

async function settleOpenSyncs(
  input: CampaignJarSyncInput,
  settle: BatchOperations["reconcile"],
  options: { shown?: CampaignJarSyncHold | null; onlyShown?: boolean } = {}
): Promise<{ hold: CampaignJarSyncHold | null; saved: ProvenCampaignJarSync[] }> {
  const { batches, scope, jarAddress, chain } = input;
  const { held, ended } = await settleOpenBatches({
    batches,
    scope,
    domain: campaignJarSyncDomain(jarAddress),
    verifierFor: (prepared) => verifyCampaignJarSync(prepared, input),
    settle,
    shownIds: options.shown?.operationIds,
    onlyShown: options.onlyShown,
  });
  // Reported once, when a sync ends, so a later read cannot announce an old change again.
  const saved = ended.flatMap((record): ProvenCampaignJarSync[] => {
    const steps = provenItems(record).map((item) => item.id as CampaignJarSyncStep);
    return steps.length > 0
      ? [{ steps, whole: steps.length === record.prepared.items.length }]
      : [];
  });
  if (held.length === 0) return { hold: null, saved };
  // Normally one: a held sync refuses the next. The latest metadata is the one that would stand.
  const syncs = held.map((record) => syncOf(record.prepared));
  const grant = syncs.flatMap((sync) => sync.grant);
  const revoke = syncs.flatMap((sync) => sync.revoke);
  const metadata = syncs.filter((sync) => sync.metadata).at(-1)?.metadata ?? null;
  return {
    hold: {
      operationIds: held.map((record) => record.id),
      grant,
      revoke,
      writesMetadata: metadata !== null,
      onChain: await readOnChain({ jarAddress, grant, revoke, metadata }, chain).catch(() => null),
    },
    saved,
  };
}

/** `shown` is the hold this tab last showed, so a sync another tab ended still reports here. */
export function readCampaignJarSyncHold(
  input: CampaignJarSyncInput,
  shown?: CampaignJarSyncHold | null
) {
  return settleOpenSyncs(input, input.batches.reconcile, { shown });
}

/** Call only for a person who has just seen what the chain holds and chosen to move on. */
export function moveOnFromCampaignJarSyncHold(
  input: CampaignJarSyncInput,
  hold: CampaignJarSyncHold
) {
  // What could not be read has not been seen, so the hold stands until a read finds it.
  if (hold.onChain === null) return readCampaignJarSyncHold(input, hold);
  return settleOpenSyncs(input, input.batches.release, { shown: hold, onlyShown: true });
}
