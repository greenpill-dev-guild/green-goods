/** @vitest-environment happy-dom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGroupTakeUp } from "../../../hooks/client-ui/pool/useGroupTakeUp";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import {
  claimFixture,
  commitmentDetailFixture,
  commitmentFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const LINA = "0x2222222222222222222222222222222222222222" as Address;
const OMAR = "0x3333333333333333333333333333333333333333" as Address;
const GARDEN = "0x4444444444444444444444444444444444444444" as Address;

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  claims: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("../../../modules/commitment-pooling/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/commitment-pooling/data")>()),
  getCommitmentDetail: (_chainId: number, id: bigint) => mocks.detail(id),
  getCommitmentClaimRequests: (_chainId: number, id: bigint) => mocks.claims(id),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({ enqueue: mocks.enqueue }),
}));

const open = (id: number, overrides: Partial<CommitmentReadModel> = {}) =>
  commitmentFixture({
    commitmentId: BigInt(id),
    direction: "REQUEST",
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    creator: STEWARD,
    leadProvider: null,
    ...overrides,
  });
const taken = (id: number) =>
  open(id, { onchainState: "ACCEPTED", derivedState: "ACTIVE", leadProvider: OMAR });

const PERSONAL = { kind: "personal", garden: GARDEN } as const;

function renderTakeUp(reread: () => Promise<unknown>) {
  return renderHookWithProviders(() =>
    useGroupTakeUp({ chainId: 42161, viewer: LINA, queued: new Set(), reread: reread as never })
  );
}

/** The queue took the job, then its send failed with this error. */
const admittedThenRejected =
  (error: Error) =>
  async ({ report }: { report?: (event: { stage: string }) => void }) => {
    report?.({ stage: "admitted" });
    throw error;
  };

describe("useGroupTakeUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claims.mockResolvedValue([]);
    mocks.enqueue.mockResolvedValue("job-1");
  });

  it("reads the chosen copy again, then sends the take-up act for that copy alone", async () => {
    mocks.detail.mockResolvedValue(commitmentDetailFixture({ commitment: open(11) }));
    const reread = vi.fn();
    const { result } = renderTakeUp(reread);

    await act(() => result.current.takeUp(11n, PERSONAL));

    expect(mocks.detail).toHaveBeenCalledWith(11n);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        act: "claim",
        payload: { commitmentId: 11n, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
      })
    );
    expect(reread).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: "done", copyId: 11n });

    // A steward taking one up for their garden sends a garden claim in it.
    await act(() => result.current.takeUp(11n, { kind: "garden", garden: GARDEN }));
    expect(mocks.enqueue.mock.calls[1]?.[0].payload).toMatchObject({
      kind: 0,
      gardenContext: GARDEN,
    });
  });

  it("ignores a second press while the first is still reading, so only one copy is sent", async () => {
    let finishRead: () => void = () => {};
    mocks.detail.mockReturnValue(
      new Promise((resolve) => {
        finishRead = () => resolve(commitmentDetailFixture({ commitment: open(11) }));
      })
    );
    const { result } = renderTakeUp(vi.fn());

    await act(async () => {
      const first = result.current.takeUp(11n, PERSONAL);
      const second = result.current.takeUp(11n, PERSONAL);
      finishRead();
      await Promise.all([first, second]);
    });

    expect(mocks.detail).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ step: "done", copyId: 11n });
  });

  it("asks before choosing another when the chosen copy went first, and sends only on yes", async () => {
    mocks.detail.mockImplementation(async (id: bigint) =>
      commitmentDetailFixture({ commitment: id === 11n ? taken(11) : open(Number(id)) })
    );
    const reread = vi.fn().mockResolvedValue({
      // The group's read still lags and shows 11 open; it is passed over anyway.
      copies: [open(11), open(12)],
      askedFor: new Set(),
    });
    const { result } = renderTakeUp(reread);

    await act(() => result.current.takeUp(11n, PERSONAL));

    expect(result.current.state).toEqual({ step: "taken", next: 12n, context: PERSONAL });
    expect(mocks.enqueue).not.toHaveBeenCalled();

    await act(() => result.current.takeUp(12n, PERSONAL));

    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue.mock.calls[0]?.[0].payload.commitmentId).toBe(12n);
    expect(result.current.state).toEqual({ step: "done", copyId: 12n });
  });

  it("treats a reviewed copy someone just asked for as gone (D5), and says when none is left", async () => {
    mocks.detail.mockResolvedValue(
      commitmentDetailFixture({ commitment: open(11, { claimMode: "APPROVAL_GATED" }) })
    );
    mocks.claims.mockResolvedValue([claimFixture({ commitmentId: 11n, claimant: OMAR })]);
    const reread = vi.fn().mockResolvedValue({
      copies: [11, 12].map((id) => open(id, { claimMode: "APPROVAL_GATED" })),
      askedFor: new Set(["11", "12"]),
    });
    const { result } = renderTakeUp(reread);

    await act(() => result.current.takeUp(11n, PERSONAL));

    expect(result.current.state).toEqual({ step: "none" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("reads as unknown, never none, when a read fails, and sends nothing", async () => {
    mocks.detail.mockRejectedValueOnce(new Error("indexer unreachable"));
    const { result } = renderTakeUp(vi.fn());

    await act(() => result.current.takeUp(11n, PERSONAL));
    expect(result.current.state).toEqual({ step: "unknown" });

    mocks.detail.mockResolvedValue(commitmentDetailFixture({ commitment: taken(11) }));
    const failedReread = renderTakeUp(vi.fn().mockResolvedValue(null));
    await act(() => failedReread.result.current.takeUp(11n, PERSONAL));
    expect(failedReread.result.current.state).toEqual({ step: "unknown" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("holds the sheet on the same copy when nothing is queued, and hands a held job to its page", async () => {
    mocks.detail.mockResolvedValue(commitmentDetailFixture({ commitment: open(11) }));
    // Declined at the wallet: the queue drops the job, so Try Again is for this copy.
    mocks.enqueue.mockImplementationOnce(
      admittedThenRejected(new Error("User rejected the request."))
    );
    const { result } = renderTakeUp(vi.fn());

    await act(() => result.current.takeUp(11n, PERSONAL));

    await waitFor(() =>
      expect(result.current.state).toEqual({ step: "failed", copyId: 11n, context: PERSONAL })
    );

    // Any other failure keeps the job on this phone: the copy's own page carries
    // its Try Again, and nothing here may choose a second copy beside it.
    mocks.enqueue.mockImplementationOnce(admittedThenRejected(new Error("execution reverted")));
    await act(() => result.current.takeUp(11n, PERSONAL));

    await waitFor(() => expect(result.current.state).toEqual({ step: "done", copyId: 11n }));
  });
});
