/**
 * What Karma's own records say each reconcile call did.
 *
 * The module emits `KarmaSyncRecorded` for every step: a project call records its project and, once
 * the project exists, its details; an account call records its access and its membership. Each step
 * catches its own failure and records it there, so the transaction succeeds either way and only these
 * records can tell a synced call from a failed one.
 *
 * @module modules/garden/karma-sync-records
 */

import { getTransactionReceipt } from "@wagmi/core";
import { type Abi, type Hex, type Log, parseEventLogs } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { verifyByReading } from "../transactions/batch-hold";
import type { PreparedBatch, VerifyBatchItems } from "../transactions/batch-types";

export const KARMA_MODULE_ABI = [
  {
    type: "function",
    name: "reconcileProject",
    stateMutability: "nonpayable",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "projectUID", type: "bytes32" }],
  },
  {
    type: "function",
    name: "reconcileProjectAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [
      { name: "roleActive", type: "bool" },
      { name: "changed", type: "bool" },
    ],
  },
  /** `IKarmaGAPModule.KarmaSyncRecorded`; its two enums are `uint8` on the wire. */
  {
    type: "event",
    name: "KarmaSyncRecorded",
    inputs: [
      { name: "garden", type: "address", indexed: true },
      { name: "projectUID", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "operation", type: "uint8", indexed: false },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "sourceUID", type: "bytes32", indexed: false },
      { name: "resultUID", type: "bytes32", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** `IKarmaGAPModule.KarmaSyncOperation` and `KarmaSyncOutcome`, by ordinal. */
const OPERATION = { project: 0, details: 1, membership: 2, access: 3 } as const;
const FAILED = 2;

const PROJECT_CALL = "project";
const ACCOUNT_CALL = "account:";
const NO_ACCOUNT = "0x0000000000000000000000000000000000000000";

/** The ID a call is held by: the project's, or the account's whose access it syncs. */
export const karmaCallId = (account: Address | null) =>
  account === null ? PROJECT_CALL : `${ACCOUNT_CALL}${account.toLowerCase()}`;

const accountOf = (callId: string) =>
  callId === PROJECT_CALL ? null : (callId.slice(ACCOUNT_CALL.length) as Address);

/** How a reconcile reads the chain. */
export interface KarmaReconcileChain {
  logsOf(transactionHash: Hex): Promise<readonly Log[]>;
}

export function createKarmaReconcileChain(chainId: number): KarmaReconcileChain {
  return {
    logsOf: async (hash) => (await getTransactionReceipt(getWagmiConfig(), { hash, chainId })).logs,
  };
}

/** What the chain recorded for one call that landed. */
export interface KarmaCallResult {
  /** The account an access call reconciled; null for the project call. */
  account: Address | null;
  /** False when the call's transaction landed but the chain recorded a failed sync. */
  synced: boolean;
  /** The chain's reason for a failed sync, such as `attestation_failed`. */
  reason: string | null;
}

export interface RecordedCall extends KarmaCallResult {
  /** The project could not be made, so every access sync after it records `project_not_found`. */
  noProject: boolean;
}

interface SyncRecord {
  account: Address;
  operation: number;
  outcome: number;
  reason: string;
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function syncRecords(logs: readonly Log[], module: Address, garden: Address): SyncRecord[] {
  return parseEventLogs({ abi: KARMA_MODULE_ABI, eventName: "KarmaSyncRecorded", logs: [...logs] })
    .filter((log) => same(log.address, module) && same(log.args.garden, garden))
    .map(({ args }) => ({
      account: args.account,
      operation: args.operation,
      outcome: args.outcome,
      reason: args.reason,
    }));
}

/** A call is recorded once every step it always records is there, whatever they say. */
function recordedCall(callId: string, records: readonly SyncRecord[]): RecordedCall | null {
  const account = accountOf(callId);
  const steps = (operation: number) =>
    records.filter(
      (record) => record.operation === operation && same(record.account, account ?? NO_ACCOUNT)
    );
  const failure = (found: readonly SyncRecord[]) => found.find((r) => r.outcome === FAILED);
  const result = (found: readonly SyncRecord[], noProject = false): RecordedCall => {
    const failed = failure(found);
    return { account, synced: !failed, reason: failed?.reason || null, noProject };
  };
  if (account === null) {
    const project = steps(OPERATION.project);
    if (project.length === 0) return null;
    if (failure(project)) return result(project, true);
    const details = steps(OPERATION.details);
    return details.length > 0 ? result([...project, ...details]) : null;
  }
  const access = steps(OPERATION.access);
  const membership = steps(OPERATION.membership);
  return access.length > 0 && membership.length > 0 ? result([...access, ...membership]) : null;
}

/**
 * Confirms a call once its records are in the receipts, whatever they say, and keeps what they say
 * in `recorded`. A receipt alone cannot tell a synced call from one the chain recorded as failed.
 */
export function verifyKarmaSync(
  prepared: PreparedBatch,
  { chain, retryMs }: { chain: KarmaReconcileChain; retryMs?: number },
  recorded: Map<string, RecordedCall>
): VerifyBatchItems {
  const { address: module, args } = prepared.items[0].call;
  const garden = args[0] as Address;
  return (execution) => {
    // Every call in one try shares one read of the receipts.
    let read: Promise<SyncRecord[]> | undefined;
    const records = () =>
      (read ??= Promise.all(execution.receipts.map((r) => chain.logsOf(r.transactionHash)))
        .then((logs) => syncRecords(logs.flat(), module, garden))
        // A node can answer from before the receipt's block, so a failed read is another try.
        .catch(() => [])
        .finally(() => {
          read = undefined;
        }));
    return verifyByReading(async (callId) => {
      const call = recordedCall(callId, await records());
      if (call) recorded.set(callId, call);
      return call !== null;
    }, retryMs)(execution);
  };
}
