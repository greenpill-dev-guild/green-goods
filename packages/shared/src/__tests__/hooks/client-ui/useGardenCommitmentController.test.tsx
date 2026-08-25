/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGardenCommitmentController } from "../../../hooks/client-ui/commitment/useGardenCommitmentController";
import type { CommitmentJobInput } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import type { CommitmentMutationInput } from "../../../hooks/commitment-pooling/useCommitmentMutations";
import { CommitmentReasonPinError } from "../../../modules/commitment-pooling/reasons";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type {
  CommitmentClaimRequestRecord,
  CommitmentDetail,
  CommitmentPoolRecord,
} from "../../../modules/commitment-pooling/types";
import type { Action, Address, Work } from "../../../types/domain";
import {
  availableCapability,
  claimFixture,
  commitmentDetailFixture,
  commitmentFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobInput) => Promise<string>;
type Mutate = (input: CommitmentMutationInput) => Promise<`0x${string}`>;

const work = (overrides: Partial<Work> = {}): Work => ({
  id: "0xaaaa",
  title: "Restore the tool shed",
  actionUID: 1,
  gardenerAddress: TUNDE,
  gardenAddress: DEMO_GARDEN,
  feedback: "Repaired the roof",
  metadata: "bafy-work",
  media: [],
  createdAt: 1,
  status: "approved",
  ...overrides,
});

const detail = commitmentDetailFixture({
  commitment: commitmentFixture({
    derivedState: "ACTIVE",
    contributorPolicy: "OPEN",
    commitmentType: "DOMAIN_IMPACT",
    providerGarden: DEMO_GARDEN,
    leadProvider: TUNDE,
    counterpartyKind: "GARDEN",
    counterparty: MARIA,
  }),
});

const mocks = vi.hoisted(() => ({
  isOnline: true,
  viewer: null as Address | null,
  commitmentQuery: {
    detail: null as CommitmentDetail | null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(async () => undefined),
    availability: { status: "unknown-chain" } as {
      status: "available" | "unknown-chain";
      capability?: typeof availableCapability;
    },
  },
  enqueue: vi.fn<Enqueue>(),
  jobsPending: false,
  queue: {
    pendingCommitmentIds: new Set<string>(),
    failedCount: 0,
    failedCommitmentIds: new Set<string>(),
    failedJobs: new Map(),
    hasPendingCreate: false,
    pendingCreates: [],
    isUnavailable: false,
    refresh: vi.fn(),
  },
  metadata: null as CommitmentMetadataV1 | null,
  mutate: vi.fn<Mutate>(),
  mutationPending: false,
  mutationError: null as unknown,
  works: [] as Work[],
  pool: null as CommitmentPoolRecord | null,
  roleAnswers: new Map<string, boolean>(),
  gardens: [] as Array<{
    id: string;
    name: string;
    gardeners: Address[];
    stewards: Address[];
  }>,
  managedGardens: new Set<string>(),
  claimRequests: [] as CommitmentClaimRequestRecord[],
  actions: [] as Action[],
  linked: new Set<string>(),
  worksGarden: null as string | null,
}));

vi.mock("../../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: mocks.isOnline }),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: mocks.actions }),
  useGardens: () => ({ data: mocks.gardens }),
}));

vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (garden: string | undefined, _viewer: string | undefined, role: string) => ({
    hasRole: garden ? (mocks.roleAnswers.get(`${garden.toLowerCase()}:${role}`) ?? false) : false,
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({
    canManageGarden: (garden: { id: string }) => mocks.managedGardens.has(garden.id.toLowerCase()),
  }),
}));

vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: (garden: string) => {
    mocks.worksGarden = garden;
    return { works: mocks.works };
  },
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitment: () => mocks.commitmentQuery,
  useCommitmentPool: () => ({ pool: mocks.pool }),
  useCommitmentClaimRequests: () => ({ claimRequests: mocks.claimRequests }),
  useLinkedWorkUIDs: () => ({ linked: mocks.linked }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentWorkDecisions", () => ({
  useCommitmentWorkDecisions: () => ({
    decisions: [],
    byWorkUID: new Map(),
    reconciliationCandidates: [],
    readAvailable: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(async () => undefined),
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: mocks.jobsPending,
    error: null,
    viewer: mocks.viewer,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => mocks.queue,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => mocks.metadata,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMutations", () => ({
  useCommitmentMutation: () => ({
    mutateAsync: mocks.mutate,
    isPending: mocks.mutationPending,
    error: mocks.mutationError,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isOnline = true;
  mocks.viewer = TUNDE;
  mocks.commitmentQuery.detail = detail;
  mocks.commitmentQuery.isLoading = false;
  mocks.commitmentQuery.isError = false;
  mocks.commitmentQuery.availability = { status: "available", capability: availableCapability };
  mocks.jobsPending = false;
  mocks.queue.pendingCommitmentIds = new Set();
  mocks.queue.failedCommitmentIds = new Set();
  mocks.queue.failedJobs = new Map();
  mocks.queue.isUnavailable = false;
  mocks.worksGarden = null;
  mocks.mutationPending = false;
  mocks.mutationError = null;
  mocks.metadata = { version: 1, title: "Restore the tool shed" };
  mocks.works = [work(), work({ id: "0xbbbb", status: "rejected" })];
  mocks.linked = new Set();
  mocks.pool = poolFixture({ poolType: "PROTOCOL" });
  mocks.roleAnswers = new Map([[`${DEMO_GARDEN.toLowerCase()}:steward`, true]]);
  mocks.gardens = [
    {
      id: DEMO_GARDEN,
      name: "Host Garden",
      gardeners: [TUNDE],
      stewards: [],
    },
    {
      id: MARIA,
      name: "Provider Garden",
      gardeners: [TUNDE],
      stewards: [],
    },
  ];
  mocks.managedGardens = new Set();
  mocks.claimRequests = [
    claimFixture({ requestedBy: TUNDE, claimant: TUNDE, requestedAt: 1, state: "DECLINED" }),
    claimFixture({ requestedBy: TUNDE, claimant: TUNDE, requestedAt: 2, state: "DECLINED" }),
    claimFixture({ requestedBy: MARIA, claimant: MARIA, requestedAt: 3, state: "PENDING" }),
  ];
  mocks.enqueue.mockResolvedValue("job-123");
  mocks.mutate.mockResolvedValue("0x123");
});

describe("useGardenCommitmentController", () => {
  it("resolves availability, invalid-id, loading, error, and ready in precedence order", () => {
    mocks.commitmentQuery.availability = { status: "unknown-chain" };
    const { result, rerender } = renderHook(
      ({ commitmentId }) =>
        useGardenCommitmentController({
          chainId: DEMO_CHAIN_ID,
          commitmentId,
          routeGarden: DEMO_GARDEN,
        }),
      { initialProps: { commitmentId: 1001n as bigint | null } }
    );
    expect(result.current.status).toBe("unavailable");

    mocks.commitmentQuery.availability = { status: "available", capability: availableCapability };
    rerender({ commitmentId: null });
    expect(result.current.status).toBe("notFound");

    mocks.commitmentQuery.isLoading = true;
    rerender({ commitmentId: 1001n });
    expect(result.current.status).toBe("loading");

    mocks.commitmentQuery.isLoading = false;
    mocks.commitmentQuery.isError = true;
    rerender({ commitmentId: 1001n });
    expect(result.current.status).toBe("error");

    mocks.commitmentQuery.isError = false;
    rerender({ commitmentId: 1001n });
    expect(result.current.status).toBe("ready");
  });

  it("derives the seat, act, claim state, and eligible unlinked work with real selectors", () => {
    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
      })
    );

    expect(result.current).toMatchObject({
      status: "ready",
      seat: "provider",
      actGarden: DEMO_GARDEN,
      actKind: "addProof",
      joinable: false,
      linkable: true,
      claimNeedsContext: true,
      canAskAgain: false,
    });
    expect(result.current.ownRequest?.state).toBe("DECLINED");
    expect(result.current.pendingClaimRequests.map((request) => request.claimant)).toEqual([MARIA]);
    expect(result.current.linkableWorks.map((entry) => entry.id)).toEqual(["0xaaaa"]);
    expect(result.current.roles).toMatchObject({
      stewardsPoolGarden: true,
      counterpartyGarden: MARIA,
      claimGardens: { member: [{ address: MARIA, name: "Provider Garden" }] },
    });
  });

  it("loads and links Work in the provider garden while preserving the route garden", async () => {
    const routeGarden = MARIA;
    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden,
      })
    );

    expect(result.current.routeGarden).toBe(routeGarden);
    expect(result.current.workGarden).toBe(DEMO_GARDEN);
    expect(result.current.actGarden).toBe(DEMO_GARDEN);
    expect(mocks.worksGarden).toBe(DEMO_GARDEN);

    await act(async () => {
      await result.current.acts.linkWork("0xaaaa", 0, "cross-garden-operation");
    });
    expect(mocks.enqueue).toHaveBeenLastCalledWith({
      act: "workLink",
      payload: {
        clientOperationId: "cross-garden-operation",
        commitmentId: 1001n,
        workUID: "0xaaaa",
        requirementIndex: 0,
        gardenAddress: DEMO_GARDEN,
      },
    });
  });

  it("suppresses duplicate acts when the queue is pending or unreadable and exposes failures", () => {
    const key = detail.commitment.commitmentId.toString();
    mocks.queue.pendingCommitmentIds = new Set([key]);
    mocks.queue.failedCommitmentIds = new Set([key]);
    mocks.queue.failedJobs = new Map([
      [
        key,
        {
          jobId: "failed-1",
          discardable: true,
          reason: "membershipLost" as const,
          retryable: false,
        },
      ],
    ]);
    mocks.queue.isUnavailable = true;

    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
      })
    );

    expect(result.current.actKind).toBeNull();
    expect(result.current.queue).toEqual({
      hasPendingJob: true,
      sendFailed: true,
      failedJob: {
        jobId: "failed-1",
        discardable: true,
        reason: "membershipLost",
        retryable: false,
      },
      isUnavailable: true,
      refresh: mocks.queue.refresh,
    });
  });

  it("maps queue and online acts to their authoritative arguments and returns their promises", async () => {
    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
      })
    );

    await act(async () => {
      await expect(result.current.acts.claimPersonal()).resolves.toBe("job-123");
      await expect(result.current.acts.claim({ kind: "garden", garden: MARIA })).resolves.toBe(
        "job-123"
      );
      await expect(result.current.acts.linkWork("0xaaaa", 2, "operation-1")).resolves.toBe(
        "job-123"
      );
      await expect(result.current.acts.sendForConfirmation()).resolves.toBe("job-123");
      await expect(result.current.acts.confirm()).resolves.toBe("job-123");
      await expect(result.current.acts.join()).resolves.toBe("0x123");
      await expect(result.current.acts.withdraw("No longer available")).resolves.toBe("0x123");
      await expect(result.current.acts.acceptClaim(MARIA)).resolves.toBe("0x123");
      await expect(result.current.acts.declineClaim(MARIA, "Missing context")).resolves.toBe(
        "0x123"
      );
      await expect(result.current.acts.notYet("Needs more evidence")).resolves.toBe("0x123");
    });

    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "claim",
      payload: {
        commitmentId: 1001n,
        kind: 1,
        gardenContext: DEMO_GARDEN,
        gardenAddress: DEMO_GARDEN,
      },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "workLink",
      payload: {
        clientOperationId: "operation-1",
        commitmentId: 1001n,
        workUID: "0xaaaa",
        requirementIndex: 2,
        gardenAddress: DEMO_GARDEN,
      },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "confirm",
      commitmentId: 1001n,
      gardenAddress: MARIA,
      membershipNotRequired: false,
    });
    expect(mocks.mutate).toHaveBeenCalledWith({
      action: "declineClaim",
      commitmentId: 1001n,
      claimant: MARIA,
      reason: "Missing context",
      gardenAddress: DEMO_GARDEN,
    });
  });

  it("marks named confirmers as membership-free and reports reason pin failures", async () => {
    mocks.commitmentQuery.detail = commitmentDetailFixture({
      commitment: commitmentFixture({
        onchainState: "READY_FOR_CONFIRMATION",
        confirmers: [TUNDE],
        direction: "OFFER",
        counterpartyKind: "GARDEN",
        counterparty: MARIA,
      }),
    });
    mocks.mutationError = new CommitmentReasonPinError("Could not pin reason");

    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
      })
    );

    expect(result.current.confirmation).toMatchObject({
      phase: "ask",
      canNotYet: true,
      gardenAddress: MARIA,
      membershipNotRequired: true,
    });
    expect(result.current.pinFailed).toBe(true);

    await act(async () => {
      await result.current.acts.confirm();
    });
    expect(mocks.enqueue).toHaveBeenLastCalledWith({
      act: "confirm",
      commitmentId: 1001n,
      gardenAddress: MARIA,
      membershipNotRequired: true,
    });
  });

  it("rejects an act when the record is no longer ready", () => {
    mocks.commitmentQuery.detail = null;
    const { result } = renderHook(() =>
      useGardenCommitmentController({
        chainId: DEMO_CHAIN_ID,
        commitmentId: 1001n,
        routeGarden: DEMO_GARDEN,
      })
    );

    expect(() => result.current.acts.join()).toThrow("The commitment is not ready");
  });
});
