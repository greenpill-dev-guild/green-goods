/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import { useDraftAutoSave, useDraftSaveStatus } from "../../../hooks/work/useDraftAutoSave";

const mocks = vi.hoisted(() => ({ save: vi.fn(), persistent: vi.fn() }));
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x1111111111111111111111111111111111111111" }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 11155111 }));
vi.mock("../../../modules/job-queue/draft-db", () => ({
  draftDB: { saveSnapshot: mocks.save },
  hasMeaningfulDraftDetails: (data: object) => Object.keys(data).length > 0,
}));
vi.mock("../../../utils/storage/quota", () => ({ requestPersistentStorageOnce: mocks.persistent }));
const emptyImages: File[] = [];
const base = { gardenAddress: null, actionUID: null, feedback: "draft", details: {} };
let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.useFakeTimers();
  mocks.save.mockReset().mockResolvedValue({ id: "saved" });
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({
    draftHydrated: true,
    draftScope: "0x1111111111111111111111111111111111111111:11155111",
  });
});
afterEach(() => {
  cleanup();
  useWorkFlowStore.setState((state) => ({ draftEpoch: state.draftEpoch + 1 }));
  vi.useRealTimers();
});

describe("complete draft autosave", () => {
  it("does not write before hydration", async () => {
    useWorkFlowStore.setState({ draftHydrated: false });
    const { result } = renderHook(() => useDraftAutoSave(base, emptyImages), { wrapper });
    await act(async () => {
      await result.current.saveOnExit();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves the initial snapshot and debounces subsequent text edits", async () => {
    const { rerender } = renderHook(
      ({ feedback }) => useDraftAutoSave({ ...base, feedback }, emptyImages),
      { wrapper, initialProps: { feedback: "first" } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(useWorkFlowStore.getState().draftSaveState).toBe("saved");
    rerender({ feedback: "latest" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.save.mock.calls[1][3].feedback).toBe("latest");
    expect(mocks.save.mock.calls[0][2]).toBe(mocks.save.mock.calls[1][2]);
  });
  it("includes audio, updates the shared resumed ID, and propagates storage failure", async () => {
    useWorkFlowStore.setState({ activeDraftId: "resumed" });
    const audioNotes = [new File(["audio"], "note.webm", { type: "audio/webm" })];
    const { result } = renderHook(() => useDraftAutoSave({ ...base, audioNotes }, emptyImages), {
      wrapper,
    });
    await act(async () => {
      await result.current.saveOnExit();
    });
    expect(mocks.save.mock.calls[0][2]).toBe("resumed");
    expect(mocks.save.mock.calls[0][5]).toBe(audioNotes);
    mocks.save.mockRejectedValueOnce(new Error("quota"));
    await act(async () => {
      await expect(result.current.saveOnExit()).rejects.toThrow("quota");
    });
    expect(useWorkFlowStore.getState().draftSaveState).toBe("failed");
  });
  it("serializes overlapping snapshots instead of dropping the later save", async () => {
    let release!: () => void;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const { result, rerender } = renderHook(
      ({ feedback }) => useDraftAutoSave({ ...base, feedback }, emptyImages),
      { wrapper, initialProps: { feedback: "first" } }
    );
    let first!: Promise<string | null>;
    await act(async () => {
      first = result.current.saveOnExit();
      await Promise.resolve();
    });
    rerender({ feedback: "second" });
    await act(async () => {
      const second = result.current.saveOnExit();
      release();
      await Promise.all([first, second]);
    });
    expect(mocks.save.mock.calls.map((call) => call[3].feedback)).toEqual(["first", "second"]);
  });
  it("cancels a delayed text save after discard", async () => {
    const { rerender } = renderHook(
      ({ feedback }) => useDraftAutoSave({ ...base, feedback }, emptyImages),
      { wrapper, initialProps: { feedback: "one" } }
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    rerender({ feedback: "two" });
    act(() => {
      useWorkFlowStore.getState().reset();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});

describe("missing attachment choices", () => {
  it("reselection retains identity and order, and removal cannot revive an earlier missing entry", async () => {
    vi.useRealTimers();
    const { identifyWorkFile } = await import("../../../modules/work/work-attachments");
    const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const last = new File(["last"], "last.jpg", { type: "image/jpeg" });
    useWorkFlowStore.setState({
      images: [first, last],
      draftMissingAttachments: [
        { id: "removed", name: "missing0.jpg", order: 0, kind: "media" },
        { id: "replace", name: "missing2.jpg", order: 2, kind: "media" },
      ],
    });
    const { result } = renderHook(() => useDraftSaveStatus());
    await act(async () => {
      await result.current.reselectMissingAttachment(
        "replace",
        new File(["replacement"], "new.jpg", { type: "image/jpeg" })
      );
    });
    const state = useWorkFlowStore.getState();
    expect(state.images.map((file) => file.name)).toEqual(["first.jpg", "new.jpg", "last.jpg"]);
    expect((await identifyWorkFile(state.images[1])).id).toBe("replace");
    act(() => result.current.removeMissingAttachment("removed"));
    expect(useWorkFlowStore.getState().draftMissingAttachments).toEqual([]);
    expect(useWorkFlowStore.getState().images.map((file) => file.name)).toEqual([
      "first.jpg",
      "new.jpg",
      "last.jpg",
    ]);
  });
  it("unreadable reselection leaves existing evidence and the recovery entry intact", async () => {
    vi.useRealTimers();
    const file = new File(["old"], "old.jpg", { type: "image/jpeg" });
    useWorkFlowStore.setState({
      images: [file],
      draftMissingAttachments: [{ id: "missing", name: "lost.jpg", order: 1, kind: "media" }],
    });
    const bad = new File(["bad"], "bad.jpg", { type: "image/jpeg" });
    bad.arrayBuffer = vi.fn().mockRejectedValue(new Error("revoked"));
    const { result } = renderHook(() => useDraftSaveStatus());
    await act(async () => {
      await expect(result.current.reselectMissingAttachment("missing", bad)).rejects.toThrow(
        "revoked"
      );
    });
    expect(useWorkFlowStore.getState().images).toEqual([file]);
    expect(useWorkFlowStore.getState().draftMissingAttachments[0].id).toBe("missing");
  });
});
