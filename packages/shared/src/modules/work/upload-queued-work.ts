/**
 * Upload all: send every prepared job in one call
 *
 * The person's tap confirms the connection and holds background preparation
 * back. Ready items are claimed, turned into attestations from what preparation
 * saved, and sent as one EAS call per chunk, so a passkey signs one
 * UserOperation and a wallet approves one transaction. The send is recorded on
 * every item before it can reach the network: a lost answer is confirmed later,
 * never sent twice. A call the chain would refuse is split to find the items it
 * refuses; those are flagged and the rest stay ready. The call holds each item's
 * send lock until its answer (`send-guards`), and an item another tab holds is
 * left to that tab.
 *
 * Nothing here knows what a work or a decision is. Each kind says what
 * attestation it becomes (upload-kinds.ts) and where it keeps its send record
 * (job-queue/queue-policy.ts).
 *
 * @module modules/work/upload-queued-work
 */

import type { Hex } from "viem";
import type { EASConfig } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { Job, SendCheckpoint } from "../../types/job-queue";
import {
  buildQueuedAttestationsCall,
  type QueuedAttestation,
} from "../../utils/eas/transaction-builder";
import { logger } from "../app/logger";
import type { ProcessJobContext, ProcessJobResult } from "../job-queue/ports";
import { sendCheckpointOf, writeSendCheckpoint } from "../job-queue/queue-policy";
import { holdingSends } from "../job-queue/send-guards";
import type { saveUnderClaim, WorkClaim } from "../job-queue/work-claims";
import type { ContractCall, TransactionSender } from "../transactions/types";
import { sendWithCheckpoint } from "./send-with-checkpoint";
import { SimulationRejected } from "./simulation-rejected";
import { isUploadJob, queuedUploadStatus } from "./upload-state";
import { forgetWorkBroadcast } from "./work-confirmation";

/**
 * Items per call. Placeholders until scripts/simulate-upload-all.ts is run against
 * the bundler. It cannot measure an account that is not deployed yet, whose first
 * UserOperation also pays for the deployment, so that case needs a device check.
 */
const MAX_ITEMS_PER_USER_OPERATION = 5;
const MAX_ITEMS_PER_WALLET_CALL = 10;

export type UploadOutcome =
  | { status: "connection-unconfirmed" }
  | { status: "nothing-ready" }
  /** The tap ended without a send: every ready item was refused, or is held elsewhere. */
  | { status: "nothing-sent"; flagged: number }
  /** Sent; items whose receipt has not arrived are confirmed by the queue. */
  | { status: "uploaded"; sent: number; flagged: number }
  | { status: "declined" | "reverted" | "send-unconfirmed"; sent: number; flagged: number }
  | { status: "failed"; sent: number; flagged: number; error: unknown };

export interface UploadQueuedWorkPorts {
  confirmOnline(): Promise<boolean>;
  suspendPreparation(): Promise<() => void>;
  listJobs(userAddress: Address): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  acquire(ids: string[]): Promise<Map<string, WorkClaim>>;
  hold(claims: WorkClaim[]): () => void;
  save: typeof saveUnderClaim;
  /** The attestation a claimed job becomes, from what preparation saved for it. */
  attestation(
    job: Job,
    context: { chainId: number; claim: WorkClaim; authMode: TransactionSender["authMode"] }
  ): Promise<QueuedAttestation>;
  easConfig(chainId: number): EASConfig;
  simulate(call: ContractCall, chainId: number, account: Address): Promise<void>;
  processJob(jobId: string, context: ProcessJobContext): Promise<ProcessJobResult>;
  now(): number;
  /** The nonce a transaction used, read off it while the network holds it; null once it does not. */
  readTransactionNonce?(hash: Hex, chainId: number): Promise<number | null>;
  /** The chain's latest block and its time, in seconds. */
  readChainHead?(chainId: number): Promise<{ number: bigint; timestamp: number }>;
}

interface ChunkItem {
  job: Job;
  claim: WorkClaim;
  attestation: QueuedAttestation;
}

type ChunkStop = Exclude<
  UploadOutcome["status"],
  "connection-unconfirmed" | "nothing-ready" | "nothing-sent"
>;

/**
 * A refusal that belongs to one item rather than to the run. The queue has
 * already retired it, so the rest of the batch still goes out; anything else
 * means the sender could not send, and asking again would only fail again.
 */
function refusesOneItem(error: string | undefined): boolean {
  return Boolean(error?.startsWith("unavailable:") || error?.startsWith("identity_conflict:"));
}

export async function uploadQueuedWork(
  input: {
    userAddress: Address;
    chainId: number;
    sender: TransactionSender;
    /** When present, send only these jobs through the same checked upload path. */
    jobIds?: readonly string[];
  },
  ports: UploadQueuedWorkPorts
): Promise<UploadOutcome> {
  if (!(await ports.confirmOnline())) return { status: "connection-unconfirmed" };
  const resumePreparation = await ports.suspendPreparation();
  let sent = 0;
  let flagged = 0;
  const { chainId, sender } = input;
  const explicitSend: ProcessJobContext = { transactionSender: sender, explicit: true };
  const callOf = (chunk: ChunkItem[]) =>
    buildQueuedAttestationsCall(
      ports.easConfig(chainId).EAS.address as `0x${string}`,
      chunk.map(({ attestation }) => attestation)
    );

  const recordAll = async (
    items: ChunkItem[],
    next: (current: SendCheckpoint) => SendCheckpoint | undefined
  ) => {
    for (const item of items) {
      await ports.save(item.claim, item.job.id, (stored) =>
        writeSendCheckpoint(stored, next(sendCheckpointOf(stored) ?? {}))
      );
      writeSendCheckpoint(item.job, next(sendCheckpointOf(item.job) ?? {}));
    }
  };

  const flag = async (item: ChunkItem, reason: string) => {
    const preparation = {
      status: "blocked",
      reason,
      checkedAt: new Date(ports.now()).toISOString(),
    };
    await ports.save(item.claim, item.job.id, (stored) => {
      stored.meta = { ...stored.meta, preparation };
    });
    flagged += 1;
  };

  /** Simulate each item alone and flag the ones the chain refuses. */
  const flagRefused = async (items: ChunkItem[]): Promise<ChunkItem[]> => {
    const accepted: ChunkItem[] = [];
    for (const item of items) {
      try {
        await ports.simulate(callOf([item]), chainId, input.userAddress);
        accepted.push(item);
      } catch (error) {
        if (!(error instanceof SimulationRejected && error.definitive)) throw error;
        await flag(item, error.reason);
      }
    }
    return accepted;
  };

  /**
   * Keep the nonce the call's transaction used on every item it carries, read
   * off the transaction while the network holds it. Only that nonce can later
   * show another transaction took it, and a lost call waits without it.
   */
  const keepTransactionNonce = async (items: ChunkItem[]) => {
    const hash = sendCheckpointOf(items[0].job)?.transactionHash;
    if (!hash || !ports.readTransactionNonce) return;
    try {
      const nonce = await ports.readTransactionNonce(hash, chainId);
      if (nonce === null) return;
      for (const item of items) {
        await ports.save(item.claim, item.job.id, (stored) => {
          const send = sendCheckpointOf(stored);
          if (send?.transactionHash === hash)
            writeSendCheckpoint(stored, { ...send, transactionNonce: { hash, nonce } });
        });
      }
    } catch (error) {
      logger.warn("[UploadAll] Could not keep the nonce the call's transaction used", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const sendChunk = async (ids: string[]): Promise<{ stop?: ChunkStop; error?: unknown }> => {
    const claims = await ports.acquire(ids);
    const stopHolding = ports.hold([...claims.values()]);
    let confirmedItems: ChunkItem[] = [];
    try {
      // Each item's send is held from here until its answer. One another tab
      // holds is mid-send there, perhaps frozen with its prompt open, so it is
      // left to that tab.
      return await holdingSends([...claims.keys()], (held) => sendHeld(held));
    } finally {
      stopHolding();
      await Promise.allSettled([...claims.values()].map((claim) => claim.release()));
      // The queue confirms each sent item and finishes it the way every send finishes.
      // One it cannot finish now keeps its recorded send for the next confirmation pass.
      for (const { job } of confirmedItems) {
        await ports.processJob(job.id, explicitSend).catch((error: unknown) => {
          logger.warn("[UploadAll] Sent item will be confirmed later", {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    async function sendHeld(
      held: readonly string[]
    ): Promise<{ stop?: ChunkStop; error?: unknown }> {
      let items: ChunkItem[] = [];
      for (const id of held) {
        const claim = claims.get(id);
        if (!claim) continue;
        const job = await ports.getJob(id);
        if (!job || queuedUploadStatus(job).state !== "ready") continue;
        try {
          const attestation = await ports.attestation(job, {
            chainId,
            claim,
            authMode: sender.authMode,
          });
          items.push({ job, claim, attestation });
        } catch (error) {
          logger.warn("[UploadAll] Queued item is not ready after all", {
            jobId: id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Its uploads could not be read back: preparation uploads them again.
          // Losing the claim here is the same answer, so it never ends the run.
          await ports
            .save(claim, id, (stored) => {
              const { preparation: _preparation, ...meta } = stored.meta ?? {};
              stored.meta = meta;
            })
            .catch(() => undefined);
        }
      }
      if (items.length === 0) return {};

      try {
        await ports.simulate(callOf(items), chainId, input.userAddress);
      } catch (error) {
        if (!(error instanceof SimulationRejected && error.definitive))
          return { stop: "failed", error };
        let accepted: ChunkItem[];
        try {
          accepted = await flagRefused(items);
        } catch (isolationError) {
          return { stop: "failed", error: isolationError };
        }
        // The whole call is refused but no single item is: nothing is sent blind.
        if (accepted.length === items.length) return { stop: "failed", error };
        items = accepted;
        if (items.length === 0) return {};
      }

      const { readChainHead } = ports;
      const result = await sendWithCheckpoint({
        sender,
        call: { ...callOf(items), chainId },
        jobIds: items.map(({ job }) => job.id),
        // Read just before the intent, after any prompt, and again if the answer
        // is lost: every item the call carries is then timed on the chain's clock.
        readChainHead: readChainHead && (() => readChainHead(chainId)),
        record: (next) => recordAll(items, next),
        now: ports.now,
      });
      switch (result.status) {
        case "sent":
          sent += items.length;
          confirmedItems = items;
          return {};
        case "may-have-sent":
          // Its receipt did not come: keep the nonce the transaction used while
          // the network still holds it.
          await keepTransactionNonce(items);
          return { stop: "send-unconfirmed" };
        case "not-sent":
          return result.cancelled ? { stop: "declined" } : { stop: "failed", error: result.error };
        case "reverted": {
          // Nothing landed: one call carries every item, so the chain took all or none.
          await recordAll(items, () => undefined);
          for (const { job } of items) forgetWorkBroadcast(job.id);
          const accepted = await flagRefused(items).catch(() => items);
          // No single item explains the revert, so every one is flagged: the
          // same call must not stay ready and go out again unchanged.
          if (accepted.length === items.length)
            for (const item of accepted) await flag(item, "reverted").catch(() => undefined);
          return { stop: "reverted", error: result.error };
        }
      }
    }
  };

  /** A tap that ended without a send says so, instead of reporting an upload of nothing. */
  const finished = (): UploadOutcome =>
    sent === 0 ? { status: "nothing-sent", flagged } : { status: "uploaded", sent, flagged };

  try {
    const selected = input.jobIds ? new Set(input.jobIds) : undefined;
    const ready = (await ports.listJobs(input.userAddress)).filter(
      (job) =>
        (!selected || selected.has(job.id)) &&
        isUploadJob(job) &&
        (job.chainId ?? chainId) === chainId &&
        queuedUploadStatus(job).state === "ready"
    );
    if (ready.length === 0) return { status: "nothing-ready" };

    // An embedded wallet has no batching: the queue sends its items one at a time.
    if (sender.authMode === "embedded") {
      for (const job of ready) {
        const result = await ports.processJob(job.id, explicitSend);
        if (result.success && !result.skipped) sent += 1;
        if (result.error === "send-cancelled") return { status: "declined", sent, flagged };
        if (result.success || result.skipped) continue;
        // One item the queue retired is that item's answer: it is counted for
        // the person and the rest still go. A send that failed outright ends
        // the run, since carrying on would report the remainder as uploaded.
        if (!refusesOneItem(result.error))
          return { status: "failed", sent, flagged, error: result.error };
        flagged += 1;
      }
      return finished();
    }

    const limit =
      sender.authMode === "wallet" ? MAX_ITEMS_PER_WALLET_CALL : MAX_ITEMS_PER_USER_OPERATION;
    // Work goes first, as it does inside the call: a decision never precedes work in a chunk.
    const ordered = [
      ...ready.filter((job) => job.kind === "work"),
      ...ready.filter((job) => job.kind !== "work"),
    ].map((job) => job.id);
    for (let start = 0; start < ordered.length; start += limit) {
      const { stop, error } = await sendChunk(ordered.slice(start, start + limit));
      if (stop === "failed") return { status: "failed", sent, flagged, error };
      if (stop) return { status: stop, sent, flagged };
    }
    return finished();
  } finally {
    resumePreparation();
  }
}
