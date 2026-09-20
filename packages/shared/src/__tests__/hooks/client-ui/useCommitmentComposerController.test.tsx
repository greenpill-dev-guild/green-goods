/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentComposerController } from "../../../hooks/client-ui/commitment/useCommitmentComposerController";
import type { CommitmentJobInput } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import {
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "../../../stores/useCommitmentComposerDraftStore";
import type { Address } from "../../../types/domain";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import { cycleFixture, poolFixture } from "../../test-utils/commitment-pooling-fixtures";

type Enqueue = (input: CommitmentJobInput) => Promise<string>;

const mocks = vi.hoisted(() => ({
  viewer: null as Address | null,
  isOnline: true,
  pools: [] as ReturnType<typeof poolFixture>[],
  cycles: [] as ReturnType<typeof cycleFixture>[],
  steward: { hasRole: false, isLoading: false },
  owner: { hasRole: false, isLoading: false },
  enqueue: vi.fn<Enqueue>(),
  pending: false,
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mocks.isOnline,
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: () => ({ pools: mocks.pools }),
  useCommitmentCycles: () => ({ cycles: mocks.cycles }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentCycleNames", () => ({
  useCommitmentCycleNames: () => ({ byCycleId: new Map(), isLoading: false }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: mocks.pending,
    error: null,
    viewer: mocks.viewer,
  }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
  useGardens: () => ({ data: [{ id: DEMO_GARDEN, name: "Green Goods Garden" }] }),
}));

vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (_garden: Address | undefined, _viewer: Address | undefined, role: string) =>
    role === "steward" ? mocks.steward : mocks.owner,
}));

const renderController = (
  overrides: Partial<{ garden: Address; direction: "OFFER" | "REQUEST" }> = {}
) =>
  renderHook(() =>
    useCommitmentComposerController({
      chainId: DEMO_CHAIN_ID,
      garden: overrides.garden ?? DEMO_GARDEN,
      direction: overrides.direction ?? "OFFER",
      defaultUnitLabel: "hours",
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useCommitmentComposerDraftStore.setState({ drafts: {} });
  mocks.viewer = TUNDE;
  mocks.isOnline = true;
  mocks.pools = [poolFixture()];
  mocks.cycles = [];
  mocks.steward = { hasRole: false, isLoading: false };
  mocks.owner = { hasRole: false, isLoading: false };
  mocks.pending = false;
  mocks.enqueue.mockResolvedValue("job-1");
});

describe("useCommitmentComposerController", () => {
  it("resumes a saved draft or clears it when starting fresh", () => {
    const key = commitmentComposerDraftKey({
      chainId: DEMO_CHAIN_ID,
      viewer: TUNDE,
      garden: DEMO_GARDEN,
      direction: "OFFER",
    });
    useCommitmentComposerDraftStore.getState().saveDraft(
      key,
      {
        values: { title: "Saved commitment", kind: "SERVICE" },
        clientCommitmentId: "saved-id",
      },
      10
    );
    const { result, unmount } = renderController();

    expect(result.current).toMatchObject({
      draftDecision: "pending",
      clientCommitmentId: "saved-id",
    });
    act(() => result.current.resumeDraft());
    expect(result.current.form.getValues("title")).toBe("Saved commitment");
    expect(result.current.draftDecision).toBe("decided");
    unmount();

    const second = renderController();
    const priorId = second.result.current.clientCommitmentId;
    act(() => second.result.current.startFresh());
    expect(useCommitmentComposerDraftStore.getState().drafts[key]).toBeUndefined();
    expect(second.result.current.clientCommitmentId).not.toBe(priorId);
    expect(second.result.current.draftDecision).toBe("decided");
  });

  it("re-resolves the saved draft when the identity key changes", () => {
    const otherGarden = MARIA;
    for (const [garden, title, clientCommitmentId] of [
      [DEMO_GARDEN, "First garden", "first-id"],
      [otherGarden, "Second garden", "second-id"],
    ] as const) {
      useCommitmentComposerDraftStore.getState().saveDraft(
        commitmentComposerDraftKey({
          chainId: DEMO_CHAIN_ID,
          viewer: TUNDE,
          garden,
          direction: "OFFER",
        }),
        { values: { title }, clientCommitmentId }
      );
    }
    const { result, rerender } = renderHook(
      ({ garden }) =>
        useCommitmentComposerController({
          chainId: DEMO_CHAIN_ID,
          garden,
          direction: "OFFER",
          defaultUnitLabel: "hours",
        }),
      { initialProps: { garden: DEMO_GARDEN } }
    );
    expect(result.current.clientCommitmentId).toBe("first-id");

    rerender({ garden: otherGarden });
    expect(result.current.savedDraft?.values.title).toBe("Second garden");
    expect(result.current.clientCommitmentId).toBe("second-id");
    expect(result.current.draftDecision).toBe("pending");
  });

  it("autosaves only after the real form becomes dirty", async () => {
    const { result } = renderController();
    expect(Object.keys(useCommitmentComposerDraftStore.getState().drafts)).toHaveLength(0);

    act(() => result.current.form.setValue("title", "A local draft", { shouldDirty: true }));

    await waitFor(() => {
      const saved = Object.values(useCommitmentComposerDraftStore.getState().drafts)[0];
      expect(saved?.values.title).toBe("A local draft");
      expect(saved?.clientCommitmentId).toBe(result.current.clientCommitmentId);
    });
  });

  it("falls back to no cycle when a selected cycle closes", async () => {
    mocks.cycles = [cycleFixture({ cycleId: 7n, cycleType: "CAMPAIGN" })];
    const { result, rerender } = renderController();
    act(() => result.current.form.setValue("cycleId", "7", { shouldDirty: true }));
    expect(result.current.form.getValues("cycleId")).toBe("7");

    mocks.cycles = [];
    rerender();
    await waitFor(() => expect(result.current.form.getValues("cycleId")).toBe("0"));
  });

  it("places one payload with a stable client id across queue retries", async () => {
    mocks.enqueue
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce("job-1");
    const { result } = renderController();
    act(() => {
      result.current.form.setValue("title", "Compost workshop", { shouldDirty: true });
      result.current.form.setValue("kind", "SERVICE", { shouldDirty: true });
      result.current.form.setValue("unitLabel", "sessions", { shouldDirty: true });
    });
    const clientId = result.current.clientCommitmentId;

    await act(async () => expect(result.current.place()).resolves.toBe(false));
    expect(result.current.placed).toBe(false);
    await act(async () => expect(result.current.place()).resolves.toBe(true));

    expect(mocks.enqueue).toHaveBeenCalledTimes(2);
    expect(
      mocks.enqueue.mock.calls.map(([job]) =>
        job.act === "create" ? job.payload.clientCommitmentId : null
      )
    ).toEqual([clientId, clientId]);
    expect(result.current.placed).toBe(true);
  });

  it.each([
    ["no pool", null, true],
    ["paused pool", poolFixture({ state: "PAUSED" }), true],
    ["no viewer", poolFixture(), false],
  ])("does not enqueue with %s", async (_label, pool, hasViewer) => {
    mocks.pools = pool ? [pool] : [];
    mocks.viewer = hasViewer ? TUNDE : null;
    const { result } = renderController();

    await act(async () => expect(result.current.place()).resolves.toBe(false));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("bars protocol access only after both role reads finish", () => {
    mocks.pools = [poolFixture({ poolType: "PROTOCOL" })];
    mocks.steward = { hasRole: false, isLoading: true };
    mocks.owner = { hasRole: false, isLoading: false };
    const { result, rerender } = renderController();
    expect(result.current.access).toBe("loading");

    mocks.steward = { hasRole: false, isLoading: false };
    rerender();
    expect(result.current.access).toBe("barred");

    mocks.owner = { hasRole: true, isLoading: false };
    rerender();
    expect(result.current.access).toBe("allowed");
  });

  it("sorts the season before campaigns and exposes pool state", () => {
    mocks.cycles = [
      cycleFixture({ cycleId: 9n, cycleType: "CAMPAIGN" }),
      cycleFixture({ cycleId: 8n, cycleType: "SEASON" }),
    ];
    const { result } = renderController();

    expect(result.current.openCycles.map((cycle) => cycle.cycleId)).toEqual([8n, 9n]);
    expect(result.current).toMatchObject({ poolOpen: true, gardenName: "Green Goods Garden" });
  });
});
