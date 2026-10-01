/** @vitest-environment happy-dom */

/**
 * A group's page in the app (PRD-1029): how the controller wires a take-up to
 * the context it goes through, Try Again to the same copy, and a failed pool
 * lookup to a retryable error. The choice of copy itself is proven in
 * `commitment-group-browsing` and the send in `useGroupTakeUp`.
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePromiseGroupController } from "../../../hooks/client-ui/pool/usePromiseGroupController";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type {
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import {
  commitmentDetailFixture,
  commitmentFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const LINA = "0x2222222222222222222222222222222222222222" as Address;
const ROUTE = "0x4444444444444444444444444444444444444444" as Address;
const HER_GARDEN = "0x5555555555555555555555555555555555555555" as Address;
const SHE_STEWARDS = "0x6666666666666666666666666666666666666666" as Address;

const copy = (id: number) =>
  commitmentFixture({
    commitmentId: BigInt(id),
    direction: "REQUEST",
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    creator: STEWARD,
    leadProvider: null,
    metadataCID: "cid-set",
  });

const mocks = vi.hoisted(() => ({
  pools: {
    pools: [] as CommitmentPoolRecord[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  commitments: [] as CommitmentReadModel[],
  refetchCommitments: vi.fn(),
  memberHere: true,
  claimGardens: {
    member: [] as Array<{ address: Address; name: string }>,
    stewarded: [] as Array<{ address: Address; name: string }>,
  },
  detail: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => LINA }));
vi.mock("../../../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: () => mocks.pools,
  useCommitmentPool: () => ({ pool: null, detail: null }),
  useCommitments: () => ({
    commitments: mocks.commitments,
    isLoading: false,
    isError: false,
    refetch: mocks.refetchCommitments,
    availability: { status: "available" },
  }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadata: () => ({
    byCID: new Map<string, CommitmentMetadataV1>([
      ["cid-set", { version: 1, title: "Water survey", displayGroup: { version: 1, id: "set-1" } }],
    ]),
    isLoading: false,
  }),
}));
vi.mock("../../../hooks/commitment-pooling/usePoolClaimRequests", () => ({
  usePoolClaimRequests: () => ({ rows: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => ({
    pendingCommitmentIds: new Set<string>(),
    isUnavailable: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentViewerRoles", () => ({
  useCommitmentViewerRoles: () => ({
    claimGardens: mocks.claimGardens,
    claimGardensKnown: true,
    isMemberHere: mocks.memberHere,
    garden: null,
  }),
}));
vi.mock("../../../modules/commitment-pooling/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/commitment-pooling/data")>()),
  getCommitmentDetail: (_chainId: number, id: bigint) => mocks.detail(id),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({ enqueue: mocks.enqueue }),
}));

const render = () =>
  renderHookWithProviders(() =>
    usePromiseGroupController({ chainId: 42161, routeGarden: ROUTE, displayGroupId: "set-1" })
  );

describe("usePromiseGroupController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pools.pools = [poolFixture({ garden: ROUTE })];
    mocks.pools.isError = false;
    mocks.commitments = [copy(11), copy(12)];
    mocks.memberHere = true;
    mocks.claimGardens = { member: [], stewarded: [] };
    mocks.detail.mockImplementation(async (id: bigint) =>
      commitmentDetailFixture({ commitment: copy(Number(id)) })
    );
    mocks.enqueue.mockResolvedValue("job-1");
  });

  it("reads a failed pool lookup as an error to retry, never a missing group", () => {
    mocks.pools.pools = [];
    mocks.pools.isError = true;
    const { result } = render();

    expect(result.current.status).toBe("error");
    act(() => result.current.refresh());
    expect(mocks.pools.refetch).toHaveBeenCalledTimes(1);
  });

  it("takes up one on a garden pool as the person, through the route garden", async () => {
    const { result } = render();
    expect(result.current.claimNeedsContext).toBe(false);

    await act(async () => result.current.takeUp.start());

    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    expect(mocks.enqueue.mock.calls[0]?.[0].payload).toEqual({
      commitmentId: 11n,
      kind: 1,
      gardenContext: ROUTE,
      gardenAddress: ROUTE,
    });
  });

  it("on the protocol pool, sends nothing until the person chooses who takes it up", async () => {
    mocks.pools.pools = [poolFixture({ garden: ROUTE, poolType: "PROTOCOL" })];
    mocks.claimGardens = {
      member: [{ address: HER_GARDEN, name: "Her garden" }],
      stewarded: [{ address: SHE_STEWARDS, name: "The garden she runs" }],
    };
    const { result } = render();
    expect(result.current.claimNeedsContext).toBe(true);
    expect(result.current.bar?.act).toBe("takeUp");

    await act(async () => result.current.takeUp.start());
    expect(mocks.enqueue).not.toHaveBeenCalled();

    await act(async () => result.current.takeUp.start({ kind: "garden", garden: SHE_STEWARDS }));

    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    expect(mocks.enqueue.mock.calls[0]?.[0].payload).toMatchObject({
      commitmentId: 11n,
      kind: 0,
      gardenContext: SHE_STEWARDS,
    });
  });

  it("tries the same copy again after a declined send, in the same context", async () => {
    mocks.enqueue.mockRejectedValueOnce(new Error("User rejected the request."));
    const { result, rerender } = render();

    await act(async () => result.current.takeUp.start());
    await waitFor(() => expect(result.current.takeUp.state.step).toBe("failed"));
    // The list moved on meanwhile: a fresh choice would now be another copy.
    mocks.commitments = [copy(10), copy(11), copy(12)];
    rerender();

    await act(async () => result.current.takeUp.retry());

    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(2));
    expect(mocks.enqueue.mock.calls[1]?.[0].payload).toEqual(
      mocks.enqueue.mock.calls[0]?.[0].payload
    );
    expect(mocks.enqueue.mock.calls[1]?.[0].payload.commitmentId).toBe(11n);
  });
});
