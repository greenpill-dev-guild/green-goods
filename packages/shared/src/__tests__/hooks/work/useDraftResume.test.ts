/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftResume } from "../../../hooks/work/useDraftResume";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  clear: vi.fn(),
  active: vi.fn(),
  legacy: vi.fn(),
  removeLegacy: vi.fn(),
  save: vi.fn(),
  draft: vi.fn(),
  marker: undefined as unknown,
  user: "0x1111111111111111111111111111111111111111" as string | null,
}));
vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({ resumeDraft: mocks.resume, clearActiveDraft: mocks.clear }),
}));
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mocks.user }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 11155111 }));
vi.mock("../../../modules/job-queue/draft-db", () => ({
  draftDB: {
    getActiveDraft: mocks.active,
    getDraft: mocks.draft,
    saveSnapshot: mocks.save,
    getDraftsForUser: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("idb-keyval", () => ({
  get: (key: string) =>
    key === "work_images_draft" ? mocks.legacy() : Promise.resolve(mocks.marker),
  set: async (_key: string, marker: unknown) => {
    mocks.marker = marker;
  },
  delMany: async (keys: string[]) => {
    await mocks.removeLegacy(keys);
    mocks.marker = undefined;
  },
}));
const options = () => ({
  formState: {
    images: [],
    gardenAddress: null,
    actionUID: null,
    feedback: "",
    timeSpentMinutes: 0,
  },
  isOnIntroTab: true,
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
  restoreForm: vi.fn(),
});
beforeEach(() => {
  mocks.marker = undefined;
  mocks.user = "0x1111111111111111111111111111111111111111";
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({ draftScope: null, draftHydrated: false });
  mocks.resume.mockReset().mockResolvedValue("intro");
  mocks.clear.mockReset().mockResolvedValue(undefined);
  mocks.active.mockReset().mockResolvedValue(null);
  mocks.draft.mockReset().mockResolvedValue(undefined);
  mocks.legacy.mockReset().mockResolvedValue(undefined);
  mocks.removeLegacy.mockReset().mockResolvedValue(undefined);
  mocks.save
    .mockReset()
    .mockImplementation(
      async (userAddress, chainId, id, data, _files, _audio, _current, missing) => ({
        userAddress,
        chainId,
        id,
        ...data,
        missingAttachments: missing,
      })
    );
});
describe("draft hydration and recovery", () => {
  it("restores the account's active draft before enabling autosave", async () => {
    mocks.active.mockResolvedValue("saved-id");
    const { result } = renderHook(() => useDraftResume(options()));
    expect(useWorkFlowStore.getState().draftHydrated).toBe(false);
    await waitFor(() => expect(result.current.showDraftDialog).toBe(true));
    expect(mocks.resume).toHaveBeenCalledWith(
      "saved-id",
      expect.objectContaining({ restoreForm: expect.any(Function) })
    );
    expect(useWorkFlowStore.getState().draftHydrated).toBe(true);
  });
  it("retains an explicit URL and blocks writes when restoration fails", async () => {
    mocks.resume.mockRejectedValue(new Error("unreadable-media"));
    const input = { ...options(), searchParams: new URLSearchParams("draftId=broken") };
    renderHook(() => useDraftResume(input));
    await waitFor(() => expect(useWorkFlowStore.getState().draftSaveState).toBe("failed"));
    expect(input.setSearchParams).not.toHaveBeenCalled();
    expect(useWorkFlowStore.getState().draftHydrated).toBe(false);
  });
  it("does not import unscoped legacy photos without an explicit choice", async () => {
    mocks.legacy.mockResolvedValue([new File(["photo"], "photo.jpg", { type: "image/jpeg" })]);
    const { result } = renderHook(() => useDraftResume(options()));
    await waitFor(() => expect(result.current.legacyRecovery).toBe(true));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.removeLegacy).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.handleStartFresh();
    });
    expect(mocks.removeLegacy).toHaveBeenCalledWith([
      "work_images_draft",
      "work_images_draft_recovery",
    ]);
  });
  it("preserves legacy data when a photo is unreadable", async () => {
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    file.arrayBuffer = async () => {
      throw new DOMException("revoked", "NotReadableError");
    };
    mocks.legacy.mockResolvedValue([file]);
    const { result } = renderHook(() => useDraftResume(options()));
    await waitFor(() => expect(result.current.legacyRecovery).toBe(true));
    await act(async () => {
      await result.current.handleContinueDraft();
    });
    expect(mocks.removeLegacy).not.toHaveBeenCalled();
    expect(mocks.save.mock.calls[0][7]).toEqual([
      expect.objectContaining({ name: "photo.jpg", kind: "media" }),
    ]);
  });
  it("propagates discard failure instead of clearing the visible draft", async () => {
    mocks.active.mockResolvedValue("saved-id");
    mocks.clear.mockRejectedValue(new Error("quota"));
    mocks.resume.mockImplementation(async () => {
      useWorkFlowStore.setState({ activeDraftId: "saved-id" });
      return "intro";
    });
    const { result } = renderHook(() => useDraftResume(options()));
    await waitFor(() => expect(result.current.showDraftDialog).toBe(true));
    await act(async () => {
      await expect(result.current.handleStartFresh()).rejects.toThrow("quota");
    });
    expect(result.current.showDraftDialog).toBe(true);
  });
  it("clears the visible form on logout before another account can hydrate", async () => {
    const input = options();
    const { rerender } = renderHook(() => useDraftResume(input));
    await waitFor(() => expect(useWorkFlowStore.getState().draftHydrated).toBe(true));
    act(() => useWorkFlowStore.setState({ feedback: "private work", activeDraftId: "private" }));
    mocks.user = null;
    rerender();
    await waitFor(() => expect(useWorkFlowStore.getState().activeDraftId).toBeNull());
    expect(useWorkFlowStore.getState().feedback).toBe("");
    expect(input.restoreForm).toHaveBeenCalledWith({ feedback: "" });
  });
  it("reuses the recovery ID when cleanup fails after a committed recovery", async () => {
    mocks.legacy.mockResolvedValue([new File(["photo"], "photo.jpg", { type: "image/jpeg" })]);
    mocks.removeLegacy
      .mockRejectedValueOnce(new Error("cleanup failed"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useDraftResume(options()));
    await waitFor(() => expect(result.current.legacyRecovery).toBe(true));
    await act(async () => {
      await expect(result.current.handleContinueDraft()).rejects.toThrow("cleanup failed");
    });
    await act(async () => {
      await result.current.handleContinueDraft();
    });
    expect(mocks.save.mock.calls[0][2]).toBe(mocks.save.mock.calls[1][2]);
  });
});

it("one unreadable legacy photo must not block readable recovery", async () => {
  const good = new File(["photo"], "good.jpg", { type: "image/jpeg" });
  const bad = new File(["photo"], "bad.jpg", { type: "image/jpeg" });
  bad.arrayBuffer = async () => {
    throw new DOMException("revoked", "NotReadableError");
  };
  mocks.legacy.mockResolvedValue([good, bad]);
  const { result } = renderHook(() => useDraftResume(options()));
  await waitFor(() => expect(result.current.legacyRecovery).toBe(true));
  await act(async () => {
    await result.current.handleContinueDraft().catch(() => undefined);
  });
  expect(mocks.save).toHaveBeenCalled();
});

it("resumes the canonical recovery after cleanup failure without re-importing removed or replaced entries", async () => {
  const file = new File(["photo"], "old.jpg", { type: "image/jpeg" });
  mocks.legacy.mockResolvedValue([file]);
  mocks.removeLegacy.mockRejectedValueOnce(new Error("cleanup failed"));
  const first = renderHook(() => useDraftResume(options()));
  await waitFor(() => expect(first.result.current.legacyRecovery).toBe(true));
  await act(async () => {
    await expect(first.result.current.handleContinueDraft()).rejects.toThrow("cleanup failed");
  });
  const saved = await mocks.save.mock.results[0].value;
  mocks.draft.mockResolvedValue(saved);
  // The original handle is now unreadable; its entry may have been removed/replaced in the draft.
  file.arrayBuffer = vi.fn().mockRejectedValue(new Error("revoked"));
  first.unmount();
  useWorkFlowStore.setState({ draftHydrated: false });
  const second = renderHook(() => useDraftResume(options()));
  await waitFor(() => expect(second.result.current.legacyRecovery).toBe(true));
  await act(async () => {
    await second.result.current.handleContinueDraft();
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(file.arrayBuffer).not.toHaveBeenCalled();
  expect(mocks.resume).toHaveBeenLastCalledWith(saved.id, expect.anything());
});

it.each([
  "quota",
  "draft-limit",
])("keeps legacy data and stable entry identities after %s failure", async (failure) => {
  mocks.legacy.mockResolvedValue([new File(["photo"], "proof.jpg", { type: "image/jpeg" })]);
  mocks.save.mockRejectedValue(new Error(failure));
  const { result } = renderHook(() => useDraftResume(options()));
  await waitFor(() => expect(result.current.legacyRecovery).toBe(true));
  await act(async () => {
    await expect(result.current.handleContinueDraft()).rejects.toThrow(failure);
  });
  const marker = mocks.marker;
  await act(async () => {
    await expect(result.current.handleContinueDraft()).rejects.toThrow(failure);
  });
  expect(mocks.marker).toBe(marker);
  expect(mocks.save.mock.calls[0][2]).toBe(mocks.save.mock.calls[1][2]);
  expect(mocks.removeLegacy).not.toHaveBeenCalled();
});
