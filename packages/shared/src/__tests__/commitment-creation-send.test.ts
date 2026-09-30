/**
 * Sending a set's creations, over the real queue.
 *
 * `createJobQueue` runs for real here: identity dedupe, claims, `processJob`,
 * `retryJob` and `discardJob`. Only the edges are fakes: the executor stands in
 * for the commitment executor (recover from the chain first, wait once a send
 * is on record, otherwise send), and the wallet records what reached a fake
 * chain, keyed by each copy's creation id.
 */

import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

import { type CreationCopy, sendCreationCopies } from "../modules/commitment-pooling/creation-send";
import {
  copiesToRetry,
  mintSeedSet,
  seedSetClearableAfter,
  seedSetLocked,
} from "../modules/commitment-pooling/seed-sets";
import type { JobExecution, JobQueueHandle } from "../modules/job-queue/ports";
import { createJobQueue } from "../modules/job-queue/queue";
import type { ContractCall, TransactionSender } from "../modules/transactions/types";
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
    sendContractCall: vi.fn((call: ContractCall) => answer([call])),
  } satisfies TransactionSender;
}

/** The commitment executor's order: read the chain first, wait on a send on record, else send. */
function executorOver(chain: ReturnType<typeof fakeChain>) {
  return {
    execute: vi.fn(async (_jobId: string, job: Job, chainId: number, sender: TransactionSender) => {
      const payload = job.payload as { clientCommitmentId: string };
      if (chain.created.has(payload.clientCommitmentId)) {
        return { status: "complete" } satisfies JobExecution;
      }
      if (typeof job.meta?.submittedTxHash === "string") {
        return { status: "waiting", reason: "pending-first-send" } satisfies JobExecution;
      }
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

function setUp() {
  const chain = fakeChain();
  const store = createInMemoryJobQueueStore();
  const executors = executorOver(chain);
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

  it("leaves a passkey account's set to the background flush", async () => {
    const { chain, store, queue } = setUp();
    const passkey = { ...wallet(chain, { bundles: true }), authMode: "passkey" as const };

    const result = await sendCreationCopies({
      copies: setOf(3),
      queue,
      sender: passkey,
      owner: STEWARD,
      chainId: 42161,
    });

    expect(result.map((row) => row.status)).toEqual(["later", "later", "later"]);
    expect(passkey.sendAtomicBatch).not.toHaveBeenCalled();
    expect(await store.getJobs({ userAddress: STEWARD })).toHaveLength(3);
  });
});
