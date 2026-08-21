/** @vitest-environment jsdom */

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

import { useCommitmentJobs } from "../hooks/commitment-pooling/useCommitmentJobs";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

// Hoisted factories run before the consts above them, so the address is inline.
const mocks = vi.hoisted(() => ({
  addJob: vi.fn(),
  viewer: "0x1111111111111111111111111111111111111111" as string | null,
}));

vi.mock("../modules/job-queue", () => ({ jobQueue: { addJob: mocks.addJob } }));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => mocks.viewer }));
vi.mock("../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));

function jobs() {
  return renderHookWithProviders(() => useCommitmentJobs()).result;
}

describe("useCommitmentJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewer = VIEWER;
    mocks.addJob.mockResolvedValue("job-1");
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
      payload: { commitmentId: 9n, cid: "bafy", creditedContributors: [], gardenAddress: GARDEN },
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
});
