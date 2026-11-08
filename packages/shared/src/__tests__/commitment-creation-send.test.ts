/**
 * Sending a set's creations, over the real queue.
 *
 * `createJobQueue` runs for real here: identity dedupe, claims, `processJob`,
 * `retryJob` and `discardJob`. Only the edges are fakes: the executor stands in
 * for the commitment executor (recover from the chain first, wait once a send
 * is on record, otherwise send), and the wallet or passkey records what reached
 * a fake chain, keyed by each copy's creation id.
 */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import {
  type CreationCopy,
  creationBudget,
  sendCreationCopies,
} from "../modules/commitment-pooling/creation-send";
import {
  copiesToRetry,
  mintSeedSet,
  seedSetClearableAfter,
  seedSetLocked,
} from "../modules/commitment-pooling/seed-sets";
import type { JobExecution, JobQueueHandle } from "../modules/job-queue/ports";
import { createJobQueue } from "../modules/job-queue/queue";
import { MAX_RETRIES } from "../modules/job-queue/queue-policy";
import type { AtomicBatchAction } from "../modules/transactions/batch-enablement";
import { BatchConfirmationPendingError } from "../modules/transactions/batch-types";
import type {
  AtomicBatchOptions,
  ContractCall,
  TransactionSender,
  TransactionSendOptions,
} from "../modules/transactions/types";
import type { Job } from "../types/job-queue";
import type { Address } from "../types/domain";
import {
  createInMemoryJobQueueStore,
  createJobQueueDependencies,
} from "./test-utils/job-queue-fakes";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const MODULE = "0x9999999999999999999999999999999999999999" as Address;
const TX = `0x${"ab".repeat(32)}` as const;
const DECLINED = () => new Error("User rejected the request.");

/** What reached the chain: each creation id once, as the contract's creation key allows. */
function fakeChain() {
  const created = new Map<string, bigint>();
  return {
    created,
    land(calls: readonly ContractCall[]) {
      for (const call of calls) {
        const id = (call.args[0] as { clientCommitmentId: string }).clientCommitmentId;
        if (!created.has(id)) created.set(id, BigInt(created.size + 1));
      }
    },
  };
}

function wallet(
  chain: ReturnType<typeof fakeChain>,
  options: { bundles: boolean; refuse?: (calls: readonly ContractCall[]) => Error | null }
) {
  const answer = async (calls: readonly ContractCall[]) => {
    const refusal = options.refuse?.(calls) ?? null;
    if (refusal) throw refusal;
    chain.land(calls);
    return { hash: TX, sponsored: false };
  };
  return {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: false,
    canSendAtomicBatch: vi.fn(async () => options.bundles),
    sendAtomicBatch: vi.fn((calls: ContractCall[]) => answer(calls)),
    // A wallet asks and broadcasts in one step, so it reaches the boundary just before asking.
    sendContractCall: vi.fn(async (call: ContractCall, sendOptions?: TransactionSendOptions) => {
      await sendOptions?.onBeforeBroadcast?.();
      return answer([call]);
    }),
  } satisfies TransactionSender;
}

/** The prompt a passkey closes without answering, as the browser names it. */
const promptClosed = () =>
  Object.assign(new Error("Failed to request credential."), {
    cause: Object.assign(new Error("The operation either timed out or was not allowed."), {
      name: "NotAllowedError",
    }),
  });

/**
 * A passkey asks for its signature before anything can go out, so a refusal of
 * its own (a closed prompt, a bundle past its ceilings) leaves nothing on chain,
 * and a bundle groups only for an action listed for it.
 */
function passkey(
  chain: ReturnType<typeof fakeChain>,
  options: {
    listed?: readonly AtomicBatchAction[];
    /** The prompt for this send closes, or the bundle is past its ceilings, before anything goes out. */
    unsent?: (calls: readonly ContractCall[]) => "prompt-closed" | "past-ceilings" | null;
    /** The send went out and landed, but its answer never came back. */
    lost?: boolean;
  } = {}
) {
  return {
    authMode: "passkey",
    supportsBatching: false,
    supportsSponsorship: true,
    canSendAtomicBatch: vi.fn(async (_chainId: number, action?: AtomicBatchAction) =>
      Boolean(action && options.listed?.includes(action))
    ),
    sendAtomicBatch: vi.fn(async (calls: ContractCall[], batch?: AtomicBatchOptions) => {
      const unsent = options.unsent?.(calls);
      if (unsent) {
        batch?.onNeverSent?.();
        throw unsent === "past-ceilings" ? new Error("batch-budget-exceeded") : promptClosed();
      }
      chain.land(calls);
      if (options.lost) {
        throw new BatchConfirmationPendingError({
          status: "unresolved",
          receipts: [],
          sponsored: true,
        });
      }
      return { hash: TX, sponsored: true };
    }),
    // A single send has no ceilings of its own; only its prompt can close.
    sendContractCall: vi.fn(async (call: ContractCall, sendOptions?: TransactionSendOptions) => {
      if (options.unsent?.([call]) === "prompt-closed") throw promptClosed();
      await sendOptions?.onBeforeBroadcast?.();
      chain.land([call]);
      return { hash: TX, sponsored: true };
    }),
  } satisfies TransactionSender;
}

/**
 * The commitment executor's order: read the chain first, wait on a send on record, refuse one the
 * chain can no longer keep (`refuses`), else send.
 */
function executorOver(chain: ReturnType<typeof fakeChain>, refuses = false) {
  return {
    execute: vi.fn(async (_jobId: string, job: Job, chainId: number, sender: TransactionSender) => {
      const payload = job.payload as { clientCommitmentId: string };
      if (chain.created.has(payload.clientCommitmentId)) {
        return { status: "complete" } satisfies JobExecution;
      }
      if (typeof job.meta?.submittedTxHash === "string") {
        return { status: "waiting", reason: "pending-first-send" } satisfies JobExecution;
      }
      if (refuses) return { status: "unavailable", reason: "action-closed" } satisfies JobExecution;
      const { hash } = await sender.sendContractCall({
        address: MODULE,
        abi: [],
        functionName: "createCommitment",
        args: [payload],
        chainId,
      });
      return { status: "submitted", txHash: hash } satisfies JobExecution;
    }),
  };
}

function setUp({ refuses = false } = {}) {
  const chain = fakeChain();
  const store = createInMemoryJobQueueStore();
  const executors = executorOver(chain, refuses);
  const queue: JobQueueHandle = createJobQueue(createJobQueueDependencies({ store, executors }));
  return { chain, store, queue };
}

let nextId = 0;
const newId = () => `copy-${String(++nextId).padStart(6, "0")}`;

/** A set's copies as the seeding flow freezes them at Create. */
function setOf(count: number, setId = "row-1"): CreationCopy[] {
  const set = mintSeedSet({ count, dueInDays: 14, nowSeconds: 1_790_000_000, newId });
  return set.copyIds.map((clientCommitmentId) => ({
    clientCommitmentId,
    setId,
    payload: {
      clientCommitmentId,
      dueDate: set.dueDate,
      metadata: {
        version: 1,
        title: "Household water survey",
        displayGroup: { version: 1, id: set.displayGroupId },
      },
    } as unknown as CreationCopy["payload"],
  }));
}

const creationIds = (calls: readonly ContractCall[]) =>
  calls.map((call) => (call.args[0] as { clientCommitmentId: string }).clientCommitmentId);

describe("sending a set's creations", () => {
  it("asks once for a set of ten and creates ten separate commitments", async () => {
    const { chain, store, queue } = setUp();
    const sender = wallet(chain, { bundles: true });
    const copies = setOf(10);

    const result = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(sender.sendAtomicBatch).toHaveBeenCalledTimes(1);
    expect(creationIds(sender.sendAtomicBatch.mock.calls[0]![0])).toEqual(
      copies.map((copy) => copy.clientCommitmentId)
    );
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(result.map((row) => row.status)).toEqual(Array(10).fill("created"));
    expect(chain.created.size).toBe(10);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });

  it("creates nothing when the bundle is declined, clears it, and retries with the same keys", async () => {
    const { chain, store, queue } = setUp();
    let declines = 1;
    const sender = wallet(chain, {
      bundles: true,
      refuse: () => (declines-- > 0 ? DECLINED() : null),
    });
    const copies = setOf(10);

    const declined = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });
    expect(declined.map((row) => row.miss)).toEqual(Array(10).fill("declined"));
    expect(seedSetLocked(declined)).toBe(false);
    expect(chain.created.size).toBe(0);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);

    const retried = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });
    expect(retried.map((row) => row.status)).toEqual(Array(10).fill("created"));
    expect(creationIds(sender.sendAtomicBatch.mock.calls[1]![0])).toEqual(
      creationIds(sender.sendAtomicBatch.mock.calls[0]![0])
    );
    expect([...chain.created.keys()]).toEqual(copies.map((copy) => copy.clientCommitmentId));
  });

  it("creates nothing when the queue refuses a bundled set, asks nothing, and clears it", async () => {
    // An action the set names closed before it was sent: the steward's answers come back to edit.
    const { chain, store, queue } = setUp({ refuses: true });
    const sender = wallet(chain, { bundles: true });

    const refused = await sendCreationCopies({
      copies: setOf(3),
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(refused.map((row) => row.miss)).toEqual(Array(3).fill("refused"));
    expect(seedSetLocked(refused)).toBe(false);
    expect(sender.sendAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });

  it("asks per copy when the wallet can't bundle, and a retry sends only what didn't send", async () => {
    const { chain, store, queue } = setUp();
    const copies = setOf(5);
    const skipped = new Set([copies[1]!.clientCommitmentId, copies[3]!.clientCommitmentId]);
    let declining = true;
    const sender = wallet(chain, {
      bundles: false,
      refuse: (calls) => (declining && skipped.has(creationIds(calls)[0]!) ? DECLINED() : null),
    });

    const first = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });
    expect(first.map((row) => row.status)).toEqual([
      "created",
      "not-sent",
      "created",
      "not-sent",
      "created",
    ]);
    // Some of the set exists, so its terms are fixed and the two wait in the queue.
    expect(seedSetLocked(first)).toBe(true);
    expect(await store.getJobs({ userAddress: STEWARD })).toHaveLength(2);

    const retry = copies.filter((copy) =>
      copiesToRetry(first).some((row) => row.clientCommitmentId === copy.clientCommitmentId)
    );
    // A declined Try Again leaves them waiting: the rest of their set exists.
    const sentThisPass = new Set(retry.map((copy) => copy.clientCommitmentId));
    const declinedAgain = await sendCreationCopies({
      copies: retry,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
      clearable: () => seedSetClearableAfter(first, sentThisPass),
    });
    expect(declinedAgain.map((row) => row.miss)).toEqual(["declined", "declined"]);
    expect(await store.getJobs({ userAddress: STEWARD })).toHaveLength(2);

    declining = false;
    sender.sendContractCall.mockClear();
    const second = await sendCreationCopies({
      copies: retry,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(creationIds(sender.sendContractCall.mock.calls.map(([call]) => call))).toEqual([
      ...skipped,
    ]);
    expect(second.map((row) => row.status)).toEqual(["created", "created"]);
    expect(chain.created.size).toBe(5);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });

  it("finishes the one copy left in the queue without admitting it again", async () => {
    const { chain, store, queue } = setUp();
    const copies = setOf(3);
    const [kept] = copies.slice(2);
    const sender = wallet(chain, {
      bundles: false,
      refuse: (calls) =>
        creationIds(calls)[0] === kept!.clientCommitmentId ? new Error("rpc timed out") : null,
    });
    await sendCreationCopies({ copies, queue, sender, owner: STEWARD, chainId: 42161 });
    const [queued] = await store.getJobs({ userAddress: STEWARD });
    expect(queued?.payload).toMatchObject({ clientCommitmentId: kept!.clientCommitmentId });
    // It has since run out of attempts: it is still the job that finishes.
    await store.amendJob(queued!.id, (job) => {
      job.attempts = MAX_RETRIES;
    });

    const finish = wallet(chain, { bundles: false });
    const [finished] = await sendCreationCopies({
      copies: [kept!],
      queue,
      sender: finish,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(finish.sendContractCall).toHaveBeenCalledTimes(1);
    expect(finished).toMatchObject({ status: "created", jobId: queued!.id });
    expect(chain.created.size).toBe(3);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });

  it("keeps a set queued and locked when a bundle's answer is lost", async () => {
    const { chain, store, queue } = setUp();
    const sender = wallet(chain, {
      bundles: true,
      refuse: () => new Error("The batch outcome is unknown. Read the chain before sending again."),
    });

    const result = await sendCreationCopies({
      copies: setOf(4),
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(result.map((row) => row.miss)).toEqual(Array(4).fill("failed"));
    expect(seedSetLocked(result)).toBe(true);
    expect(await store.getJobs({ userAddress: STEWARD })).toHaveLength(4);
  });

  it("asks a passkey once per copy while creations aren't listed for it", async () => {
    const { chain, queue } = setUp();
    const copies = setOf(3);
    const closed = copies[1]!.clientCommitmentId;
    const sender = passkey(chain, {
      listed: ["reward-edits"],
      unsent: (calls) => (creationIds(calls)[0] === closed ? "prompt-closed" : null),
    });

    const result = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(sender.canSendAtomicBatch).toHaveBeenCalledWith(42161, "commitment-creations");
    expect(sender.sendAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).toHaveBeenCalledTimes(3);
    // The queue keeps only an error's message; the closed prompt still reads as declined.
    expect(result.map((row) => [row.status, row.miss])).toEqual([
      ["created", undefined],
      ["not-sent", "declined"],
      ["created", undefined],
    ]);
  });

  it("asks a listed passkey once per ten, within the measured ceilings", async () => {
    const { chain, store, queue } = setUp();
    const sender = passkey(chain, { listed: ["commitment-creations"] });
    const copies = setOf(12);

    const result = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(sender.sendAtomicBatch.mock.calls.map(([calls]) => calls.length)).toEqual([10, 2]);
    for (const [, batch] of sender.sendAtomicBatch.mock.calls) {
      expect(batch?.batchBudget).toEqual(creationBudget(42161));
    }
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(result.map((row) => row.status)).toEqual(Array(12).fill("created"));
    expect(chain.created.size).toBe(12);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });

  it("creates nothing past a passkey's ceilings, and the next pass asks once per copy", async () => {
    const { chain, store, queue } = setUp();
    const sender = passkey(chain, {
      listed: ["commitment-creations"],
      unsent: () => "past-ceilings",
    });
    const copies = setOf(3);

    const past = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
    });
    // It never went out, so the set is still the steward's to edit and the queue holds none of it.
    expect(past.map((row) => row.miss)).toEqual(Array(3).fill("over-ceilings"));
    expect(seedSetLocked(past)).toBe(false);
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);

    const again = await sendCreationCopies({
      copies,
      queue,
      sender,
      owner: STEWARD,
      chainId: 42161,
      oneByOne: true,
    });
    expect(sender.sendAtomicBatch).toHaveBeenCalledTimes(1);
    expect(sender.sendContractCall).toHaveBeenCalledTimes(3);
    expect(again.map((row) => row.status)).toEqual(Array(3).fill("created"));
  });

  it("sends no copy twice after a reload, when a passkey bundle's answer was lost", async () => {
    const { chain, store, queue } = setUp();
    const copies = setOf(4);
    const lost = await sendCreationCopies({
      copies,
      queue,
      sender: passkey(chain, { listed: ["commitment-creations"], lost: true }),
      owner: STEWARD,
      chainId: 42161,
    });
    expect(lost.map((row) => row.miss)).toEqual(Array(4).fill("failed"));
    expect(seedSetLocked(lost)).toBe(true);
    expect(chain.created.size).toBe(4);

    // A reload: the same stored queue, a new queue over it, a new sender. Finish Creating
    // reads each copy back from the chain before anything could be sent again.
    const reloaded = createJobQueue(
      createJobQueueDependencies({ store, executors: executorOver(chain) })
    );
    const sender = passkey(chain, { listed: ["commitment-creations"] });
    const finished = await sendCreationCopies({
      copies,
      queue: reloaded,
      sender,
      owner: STEWARD,
      chainId: 42161,
      clearable: () => false,
    });

    expect(sender.sendAtomicBatch).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(finished.map((row) => row.status)).toEqual(Array(4).fill("created"));
    expect([...chain.created.keys()]).toEqual(copies.map((copy) => copy.clientCommitmentId));
    expect(await store.getJobs({ userAddress: STEWARD })).toEqual([]);
  });
});
