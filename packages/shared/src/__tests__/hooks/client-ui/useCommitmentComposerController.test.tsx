/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentComposerController } from "../../../hooks/client-ui/commitment/useCommitmentComposerController";
import type { CommitmentJobInput } from "../../../hooks/commitment-pooling/useCommitmentJobs";
import {
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "../../../stores/useCommitmentComposerDraftStore";
import type { Action, Address } from "../../../types/domain";
import {
  DEMO_CHAIN_ID,
  DEMO_GARDEN,
  MARIA,
  TUNDE,
} from "../../../modules/commitment-pooling/demo/demo-builders";
import { cycleFixture, poolFixture } from "../../test-utils/commitment-pooling-fixtures";
import { createMockAction } from "../../test-utils/mock-factories";

type Enqueue = (input: CommitmentJobInput) => Promise<string>;

const mocks = vi.hoisted(() => ({
  actions: [] as Action[],
  actionsPending: false,
  /** What reading actions by their id returns; each call is kept, so a test sees what was asked. */
  lookedUp: [] as Action[],
  lookUp: vi.fn(),
  viewer: null as Address | null,
  isOnline: true,
  pools: [] as ReturnType<typeof poolFixture>[],
  cycles: [] as ReturnType<typeof cycleFixture>[],
  /** The chain's time, Unix seconds: the fixtures' season runs March to May 2026. */
  chainNow: 1_775_000_000n,
  steward: { hasRole: false, isLoading: false },
  owner: { hasRole: false, isLoading: false },
  enqueue: vi.fn<Enqueue>(),
  pending: false,
  again: null as Record<string, unknown> | null,
}));

vi.mock("../../../hooks/commitment-pooling/useComposeAgainValues", () => ({
  useComposeAgainValues: () => mocks.again,
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

// Time is the edge here; which cycles stay on offer is decided for real.
vi.mock("../../../hooks/commitment-pooling/useCycleClock", () => ({
  useCycleClock: () => mocks.chainNow,
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    isPending: mocks.pending,
    error: null,
    viewer: mocks.viewer,
  }),
}));

vi.mock("../../../hooks/action/useAction", () => ({
  useActionsByUID: (uids: readonly number[], chainId: number) => {
    mocks.lookUp(uids, chainId);
    return mocks.lookedUp.filter((action) => uids.some((uid) => action.id === `${chainId}-${uid}`));
  },
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({
    data: mocks.actionsPending ? undefined : mocks.actions,
    isPending: mocks.actionsPending,
  }),
  useGardens: () => ({ data: [{ id: DEMO_GARDEN, name: "Green Goods Garden" }] }),
}));

vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (_garden: Address | undefined, _viewer: Address | undefined, role: string) =>
    role === "steward" ? mocks.steward : mocks.owner,
}));

const renderController = (
  overrides: Partial<{
    garden: Address;
    direction: "OFFER" | "REQUEST";
    fromCommitmentId: bigint;
  }> = {}
) =>
  renderHook(() =>
    useCommitmentComposerController({
      chainId: DEMO_CHAIN_ID,
      garden: overrides.garden ?? DEMO_GARDEN,
      direction: overrides.direction ?? "OFFER",
      defaultUnitLabel: "hours",
      fromCommitmentId: overrides.fromCommitmentId,
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useCommitmentComposerDraftStore.setState({ drafts: {} });
  mocks.actions = [];
  mocks.actionsPending = false;
  mocks.lookedUp = [];
  mocks.viewer = TUNDE;
  mocks.isOnline = true;
  mocks.pools = [poolFixture()];
  mocks.cycles = [];
  mocks.chainNow = 1_775_000_000n;
  mocks.steward = { hasRole: false, isLoading: false };
  mocks.owner = { hasRole: false, isLoading: false };
  mocks.pending = false;
  mocks.again = null;
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

  // DL-162: the chain still takes a promise into an Open cycle past its end, past due as it is
  // made, so the composer offers none that has ended, and a chosen one falls back as it ends.
  it("offers no cycle past its end, and lets go of a chosen one the second it ends", async () => {
    mocks.cycles = [
      cycleFixture({ cycleId: 8n, cycleType: "SEASON", endTime: 100n }),
      cycleFixture({ cycleId: 9n, cycleType: "CAMPAIGN", endTime: 200n }),
    ];
    mocks.chainNow = 150n;
    const { result, rerender } = renderController();
    expect(result.current.openCycles.map((cycle) => cycle.cycleId)).toEqual([9n]);

    act(() => result.current.form.setValue("cycleId", "9", { shouldDirty: true }));
    mocks.chainNow = 201n;
    rerender();
    expect(result.current.openCycles).toEqual([]);
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

  it("flags a chosen action once its window ends, and places it only while open", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const prune = createMockAction({ id: `${DEMO_CHAIN_ID}-44`, endTime: Date.now() + 60_000 });
      mocks.actions = [prune];
      const { result, rerender } = renderController();
      act(() => {
        result.current.form.setValue("title", "Prune the north beds", { shouldDirty: true });
        result.current.form.setValue("requirements", [{ actionUID: "44", requiredCount: 1 }], {
          shouldDirty: true,
        });
      });
      expect(result.current.openActions).toEqual([prune]);
      expect(result.current.closedActionUIDs).toEqual([]);

      // Nothing re-renders the composer here: the clock ticks at the window's end.
      act(() => {
        vi.advanceTimersByTime(60_001);
      });
      expect(result.current.openActions).toEqual([]);
      expect(result.current.closedActionUIDs).toEqual(["44"]);
      await act(async () => expect(result.current.place()).resolves.toBe(false));
      expect(mocks.enqueue).not.toHaveBeenCalled();

      // The stewards extend the window, and the same commitment places.
      mocks.actions = [{ ...prune, endTime: Date.now() + 60_000 }];
      rerender();
      expect(result.current.closedActionUIDs).toEqual([]);
      await act(async () => expect(result.current.place()).resolves.toBe(true));
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds a chosen action the list doesn't hold until its window is read by its id", async () => {
    // A resumed draft names an action while the list is still loading.
    mocks.actionsPending = true;
    const { result, rerender } = renderController();
    act(() => {
      result.current.form.setValue("title", "Mulch the north beds", { shouldDirty: true });
      result.current.form.setValue("requirements", [{ actionUID: "77", requiredCount: 1 }], {
        shouldDirty: true,
      });
    });
    expect(result.current.uncheckedActionUIDs).toEqual(["77"]);
    expect(mocks.lookUp).toHaveBeenLastCalledWith([], DEMO_CHAIN_ID);
    await act(async () => expect(result.current.place()).resolves.toBe(false));

    // The list answers without it, so it is read by its id, and still waits for that read.
    mocks.actionsPending = false;
    mocks.actions = [createMockAction({ id: `${DEMO_CHAIN_ID}-44` })];
    rerender();
    expect(mocks.lookUp).toHaveBeenLastCalledWith([77], DEMO_CHAIN_ID);
    expect(result.current.uncheckedActionUIDs).toEqual(["77"]);
    await act(async () => expect(result.current.place()).resolves.toBe(false));
    expect(mocks.enqueue).not.toHaveBeenCalled();

    // Its window is known and open, so the same commitment places.
    mocks.lookedUp = [createMockAction({ id: `${DEMO_CHAIN_ID}-77` })];
    rerender();
    expect(result.current.uncheckedActionUIDs).toEqual([]);
    expect(result.current.closedActionUIDs).toEqual([]);
    await act(async () => expect(result.current.place()).resolves.toBe(true));
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
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
  describe("composing a commitment again", () => {
    const earlier = {
      direction: "OFFER",
      kind: "SERVICE",
      title: "Bike repair afternoons",
      unitLabel: "afternoons",
      targetUnits: 3,
    };

    it("opens on the earlier commitment's answers without calling that a draft", async () => {
      mocks.again = earlier;
      const { result } = renderController({ fromCommitmentId: 9n });

      await waitFor(() => expect(result.current.values.title).toBe("Bike repair afternoons"));
      expect(result.current.values).toMatchObject({ unitLabel: "afternoons", targetUnits: 3 });
      // Nothing was typed, so leaving now must not leave a draft behind.
      expect(result.current.form.formState.isDirty).toBe(false);
      expect(useCommitmentComposerDraftStore.getState().drafts).toEqual({});
    });

    it("lets a draft the person resumes win, and gives way only when they start fresh", async () => {
      const key = commitmentComposerDraftKey({
        chainId: DEMO_CHAIN_ID,
        viewer: TUNDE,
        garden: DEMO_GARDEN,
        direction: "OFFER",
      });
      const saveDraft = () =>
        useCommitmentComposerDraftStore
          .getState()
          .saveDraft(key, { values: { title: "My unfinished one" }, clientCommitmentId: "d" }, 10);
      mocks.again = earlier;

      saveDraft();
      const resumedRun = renderController({ fromCommitmentId: 9n });
      // Undecided: the form holds neither yet.
      expect(resumedRun.result.current.values.title).toBe("");
      act(() => resumedRun.result.current.resumeDraft());
      await waitFor(() => expect(resumedRun.result.current.values.title).toBe("My unfinished one"));
      resumedRun.unmount();

      saveDraft();
      const freshRun = renderController({ fromCommitmentId: 9n });
      act(() => freshRun.result.current.startFresh());
      await waitFor(() =>
        expect(freshRun.result.current.values.title).toBe("Bike repair afternoons")
      );
    });

    it("keeps what the person has already typed when the earlier answers arrive late", async () => {
      const { result, rerender } = renderController({ fromCommitmentId: 9n });
      act(() => result.current.form.setValue("title", "Typed first", { shouldDirty: true }));

      mocks.again = earlier;
      rerender();

      await waitFor(() => expect(result.current.values.unitLabel).toBe("afternoons"));
      expect(result.current.values.title).toBe("Typed first");
    });

    it("starts empty when the link names the other door", () => {
      mocks.again = { ...earlier, direction: "REQUEST" };
      const { result } = renderController({ fromCommitmentId: 9n, direction: "OFFER" });

      expect(result.current.values.title).toBe("");
    });
  });
});
