/** @vitest-environment happy-dom */

/**
 * useCommitmentJobs — the member's whole write path.
 *
 * Every view mocks this hook, so nothing has ever checked that an act name
 * reaches the queue as the right job. The views assert they called
 * `enqueue({act: "confirm"})`; if `confirm` and `sendForConfirmation` swapped
 * the payload they produce, every suite would stay green and the wrong thing
 * would go on chain.
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  retryQueuedCommitmentJob,
  useCommitmentJobs,
} from "../hooks/commitment-pooling/useCommitmentJobs";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

// Hoisted factories run before the consts above them, so the address is inline.
const mocks = vi.hoisted(() => ({
  addJob: vi.fn(),
  processJob: vi.fn(),
  retryJob: vi.fn(),
  discardJob: vi.fn(),
  viewer: "0x1111111111111111111111111111111111111111" as string | null,
  sender: null as { authMode: "wallet" | "passkey" | "embedded" } | null,
}));

vi.mock("../modules/job-queue/default-instance", () => ({
  jobQueue: {
    addJob: mocks.addJob,
    processJob: mocks.processJob,
    retryJob: mocks.retryJob,
    discardJob: mocks.discardJob,
  },
}));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => mocks.viewer }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));

function jobs() {
  return renderHookWithProviders(() => useCommitmentJobs()).result;
}

describe("useCommitmentJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewer = VIEWER;
    mocks.sender = null;
    mocks.addJob.mockResolvedValue("job-1");
    mocks.processJob.mockResolvedValue({ success: true, txHash: "0xabc" });
  });

  it("sends a claim as its own job kind", async () => {
    const payload = { commitmentId: 9n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN };
    await jobs().current.enqueue({ act: "claim", payload });

    expect(mocks.addJob).toHaveBeenCalledWith("claim", payload, VIEWER, { chainId: 42161 });
  });

  it("keeps sending and confirming distinct, which nothing else checks", async () => {
    // The two acts share one job kind and differ only by an action string. A
    // swap here would put a confirmation on chain where a submission belonged.
    // Both carry the garden whose membership the executor checks before the
    // first send, so a member still waiting for their hat waits instead of
    // spending retries on a revert.
    await jobs().current.enqueue({
      act: "sendForConfirmation",
      commitmentId: 9n,
      gardenAddress: GARDEN,
    });
    expect(mocks.addJob).toHaveBeenLastCalledWith(
      "confirmation",
      { action: "submit", commitmentId: 9n, gardenAddress: GARDEN },
      VIEWER,
      { chainId: 42161 }
    );

    await jobs().current.enqueue({ act: "confirm", commitmentId: 9n, gardenAddress: GARDEN });
    expect(mocks.addJob).toHaveBeenLastCalledWith(
      "confirmation",
      { action: "confirm", commitmentId: 9n, gardenAddress: GARDEN },
      VIEWER,
      { chainId: 42161 }
    );
  });

  it("routes proof, work links and creation to their own kinds", async () => {
    await jobs().current.enqueue({
      act: "evidence",
      payload: {
        clientEvidenceId: "proof-1",
        commitmentId: 9n,
        cid: "bafy",
        creditedContributors: [],
        gardenAddress: GARDEN,
      },
    });
    expect(mocks.addJob.mock.calls.at(-1)?.[0]).toBe("evidence");

    await jobs().current.enqueue({
      act: "workLink",
      payload: {
        clientOperationId: "op-1",
        commitmentId: 9n,
        workUID: "0x1",
        requirementIndex: 0,
        gardenAddress: GARDEN,
      },
    });
    expect(mocks.addJob.mock.calls.at(-1)?.[0]).toBe("workLink");

    await jobs().current.enqueue({ act: "create", payload: { clientCommitmentId: "d1" } as never });
    expect(mocks.addJob.mock.calls.at(-1)?.[0]).toBe("commitment");
  });

  it("refuses to queue anything for nobody", async () => {
    mocks.viewer = null;
    const result = jobs();

    await expect(
      result.current.enqueue({ act: "confirm", commitmentId: 9n, gardenAddress: GARDEN })
    ).rejects.toThrow(/sign in/i);
    expect(mocks.addJob).not.toHaveBeenCalled();
  });

  it("surfaces a queue refusal rather than reporting success", async () => {
    mocks.addJob.mockRejectedValue(new Error("offline_job_identity_conflict:abc"));
    const result = jobs();

    await expect(
      result.current.enqueue({ act: "confirm", commitmentId: 9n, gardenAddress: GARDEN })
    ).rejects.toThrow(/identity_conflict/);
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  // What the queue then does with a sent, waiting, or failed act is proven
  // against the real queue in `commitment-jobs-hook.composed.test.tsx`.
  describe("sending", () => {
    const confirm = { act: "confirm", commitmentId: 9n, gardenAddress: GARDEN } as const;

    it("sends a wallet reader's act from their own tap, because nothing else will", async () => {
      // The background flush only runs for passkey and embedded sign-in, and the
      // admin mounts no queue provider at all. Without this send a steward's
      // seeded commitment stays Queued forever and no wallet prompt ever opens.
      mocks.sender = { authMode: "wallet" };

      await expect(jobs().current.enqueue(confirm)).resolves.toBe("job-1");

      expect(mocks.processJob).toHaveBeenCalledWith("job-1", {
        transactionSender: mocks.sender,
        explicit: true,
      });
    });

    it.each([
      { authMode: "passkey" },
      { authMode: "embedded" },
      null,
    ] as const)("leaves the send to the background flush for %o", async (sender) => {
      mocks.sender = sender;

      await expect(jobs().current.enqueue(confirm)).resolves.toBe("job-1");

      expect(mocks.processJob).not.toHaveBeenCalled();
    });

    it("tells whoever asked where the send stands, then how it ended", async () => {
      mocks.sender = { authMode: "wallet" };
      mocks.processJob.mockImplementation(async (_jobId, context) => {
        context.onPhase?.({ stage: "wallet" });
        context.onPhase?.({ stage: "confirming", txHash: "0xabc" });
        return { success: true, txHash: "0xabc" };
      });
      const report = vi.fn();

      await jobs().current.enqueue({ ...confirm, report });

      // The queue holds the act before any prompt opens, so a view can tell a
      // durable act from one that never got that far.
      expect(report.mock.calls.map(([event]) => event)).toEqual([
        { stage: "admitted", jobId: "job-1" },
        { stage: "wallet" },
        { stage: "confirming", txHash: "0xabc" },
        { stage: "landed", txHash: "0xabc" },
      ]);
    });

    it("keeps a declined proof for the person to send, where any other act is dropped", async () => {
      mocks.sender = { authMode: "wallet" };
      mocks.processJob.mockResolvedValue({ success: false, error: "User rejected the request" });
      const proof = {
        act: "evidence",
        payload: {
          clientEvidenceId: "proof-1",
          commitmentId: 9n,
          creditedContributors: [],
          gardenAddress: GARDEN,
        },
      } as const;
      const report = vi.fn();

      // The composer has let go of its draft by now: the queue is the proof's home.
      await expect(jobs().current.enqueue({ ...proof, report })).resolves.toBe("job-1");
      expect(report).toHaveBeenLastCalledWith({ stage: "declined" });
      expect(mocks.discardJob).not.toHaveBeenCalled();

      await expect(jobs().current.enqueue(confirm)).rejects.toThrow(/rejected/i);
      expect(mocks.discardJob).toHaveBeenCalledWith("job-1");
    });

    it.each([
      ["a sign-in the wallet never asks", { authMode: "passkey" }, null],
      ["a send that has to wait", { authMode: "wallet" }, { success: false, skipped: true }],
    ] as const)("reports %s as queued to send later", async (_case, sender, result) => {
      mocks.sender = sender;
      if (result) mocks.processJob.mockResolvedValue(result);
      const report = vi.fn();

      await expect(jobs().current.enqueue({ ...confirm, report })).resolves.toBe("job-1");

      expect(report).toHaveBeenLastCalledWith({ stage: "queued" });
    });

    it.each([
      ["landed", { success: true, txHash: "0xabc" }, { stage: "landed", txHash: "0xabc" }],
      ["has to wait", { success: false, skipped: true }, { stage: "queued" }],
    ] as const)("says how a queued row sent again ended when it %s", async (_case, result, last) => {
      mocks.processJob.mockResolvedValue(result);
      const report = vi.fn();

      await retryQueuedCommitmentJob("job-1", { authMode: "wallet" } as never, report);

      expect(mocks.retryJob).toHaveBeenCalledWith("job-1");
      expect(report).toHaveBeenLastCalledWith(last);
    });

    describe("Add and Send", () => {
      const proof = {
        act: "evidence",
        payload: {
          clientEvidenceId: "proof-1",
          commitmentId: 9n,
          creditedContributors: [],
          gardenAddress: GARDEN,
        },
        sendToo: true,
      } as const;

      it("queues the send with the proof, to go after it, before any prompt opens", async () => {
        mocks.sender = { authMode: "wallet" };
        mocks.addJob.mockResolvedValueOnce("job-1").mockResolvedValueOnce("job-2");
        const report = vi.fn();

        await jobs().current.enqueue({ ...proof, report });

        expect(mocks.addJob).toHaveBeenLastCalledWith(
          "confirmation",
          {
            action: "submit",
            commitmentId: 9n,
            gardenAddress: GARDEN,
            afterEvidenceJobId: "job-1",
          },
          VIEWER,
          { chainId: 42161 }
        );
        expect(report.mock.calls[0]?.[0]).toEqual({
          stage: "admitted",
          jobId: "job-1",
          followUpJobId: "job-2",
        });
        // Only the proof goes from this tap.
        expect(mocks.processJob).toHaveBeenCalledOnce();
        expect(mocks.processJob).toHaveBeenCalledWith("job-1", expect.anything());
      });

      it.each([
        // That send stands, so there is nothing to take back.
        [
          "the queue already holds another send for the promise",
          "offline_job_identity_conflict:confirmation:submit:9",
          0,
        ],
        ["the proof is already on its way and can't be taken back", "QuotaExceededError", 1],
      ] as const)("still adds the proof alone when %s", async (_case, refusal, takeBacks) => {
        mocks.addJob.mockResolvedValueOnce("job-1").mockRejectedValueOnce(new Error(refusal));
        mocks.discardJob.mockResolvedValue(false);
        const report = vi.fn();

        await expect(jobs().current.enqueue({ ...proof, report })).resolves.toBe("job-1");
        expect(report.mock.calls[0]?.[0]).toEqual({ stage: "admitted", jobId: "job-1" });
        expect(mocks.discardJob).toHaveBeenCalledTimes(takeBacks);
      });

      it("takes the proof back out when its send can't be queued, so Add and Send never quietly becomes Add", async () => {
        mocks.addJob
          .mockResolvedValueOnce("job-1")
          .mockRejectedValueOnce(new Error("QuotaExceededError"));
        mocks.discardJob.mockResolvedValue(true);
        const report = vi.fn();

        await expect(jobs().current.enqueue({ ...proof, report })).rejects.toThrow(
          "QuotaExceededError"
        );
        // Never admitted: the form keeps its draft.
        expect(mocks.discardJob).toHaveBeenCalledWith("job-1");
        expect(report).not.toHaveBeenCalled();
        expect(mocks.processJob).not.toHaveBeenCalled();
      });

      it.each([
        [{ authMode: "wallet" }, "landed", 1],
        [{ authMode: "passkey" }, "queued", 0],
      ] as const)("sends the queued send as a %o tap", async (sender, outcome, sends) => {
        mocks.sender = sender;

        await expect(jobs().current.sendQueued({ jobId: "job-2", commitmentId: 9n })).resolves.toBe(
          outcome
        );
        expect(mocks.processJob).toHaveBeenCalledTimes(sends);
      });
    });

    it("never lets a report that throws turn an act that landed into a failure", async () => {
      mocks.sender = { authMode: "wallet" };
      const report = vi.fn(() => {
        throw new Error("the view is gone");
      });

      await expect(jobs().current.enqueue({ ...confirm, report })).resolves.toBe("job-1");
      expect(report).toHaveBeenCalledWith({ stage: "landed", txHash: "0xabc" });
    });
  });
});
