/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkDraftRetirement } from "../../../hooks/work/useWorkDraftRetirement";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";

beforeEach(() => {
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({ draftScope: "owner:chain", submissionCompleted: true });
});
it("does not navigate or reset a different account after retirement commits", async () => {
  let scheduled: (() => void) | undefined;
  const navigate = vi.fn();
  const clearActiveDraft = vi.fn().mockResolvedValue(undefined);
  renderHook(() =>
    useWorkDraftRetirement({
      completed: true,
      paused: false,
      attempt: 0,
      clearActiveDraft,
      navigate,
      schedule: (callback) => {
        scheduled = callback;
      },
    })
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(scheduled).toBeDefined();
  useWorkFlowStore.setState((state) => ({
    draftScope: "other:chain",
    draftEpoch: state.draftEpoch + 1,
    feedback: "other work",
  }));
  act(() => scheduled?.());
  expect(navigate).not.toHaveBeenCalled();
  expect(useWorkFlowStore.getState().feedback).toBe("other work");
});
it("keeps the composer after failed retirement and allows an explicit retry", async () => {
  const navigate = vi.fn();
  const schedule = vi.fn((callback: () => void) => callback());
  const clearActiveDraft = vi
    .fn()
    .mockRejectedValueOnce(new Error("storage"))
    .mockResolvedValue(undefined);
  const { rerender } = renderHook(
    ({ attempt }) =>
      useWorkDraftRetirement({
        completed: true,
        paused: false,
        attempt,
        clearActiveDraft,
        navigate,
        schedule,
      }),
    { initialProps: { attempt: 0 } }
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(schedule).not.toHaveBeenCalled();
  await act(async () => {
    rerender({ attempt: 1 });
  });
  expect(navigate).toHaveBeenCalledOnce();
});
