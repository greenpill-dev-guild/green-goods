/** @vitest-environment happy-dom */

import type { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Confidence } from "../../../types/domain";
import { createMockWork } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mocks = vi.hoisted(() => ({
  approvalDependencies: null as null | {
    onApprovalComplete?: (completion: {
      approved: boolean;
      gardenId: string;
      workUID: string;
    }) => void | Promise<void>;
  },
  jobListener: null as null | ((type: string, data: any) => void),
  mutate: vi.fn(),
  onApprovalComplete: vi.fn(),
  timeoutCallbacks: [] as Array<() => void>,
}));

vi.mock("../../../hooks/work/useWorkApproval", () => ({
  useWorkApproval: (dependencies: typeof mocks.approvalDependencies) => {
    mocks.approvalDependencies = dependencies;
    return { isPending: false, mutate: mocks.mutate };
  },
}));

vi.mock("../../../modules/job-queue/event-bus", () => ({
  useJobQueueEvents: (_events: string[], listener: (type: string, data: any) => void) => {
    mocks.jobListener = listener;
  },
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useTimeout: () => ({
    clear: vi.fn(),
    isPending: () => false,
    set: (callback: () => void) => {
      mocks.timeoutCallbacks.push(callback);
      return vi.fn();
    },
  }),
}));

vi.mock("../../../components/toast", () => ({
  toastService: { error: vi.fn(), success: vi.fn() },
}));

import { useWorkApprovalActions } from "../../../hooks/work/useWorkApprovalActions";

describe("hooks/work/useWorkApprovalActions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mocks.approvalDependencies = null;
    mocks.jobListener = null;
    mocks.timeoutCallbacks = [];
    vi.clearAllMocks();
  });

  it("uses the same completion behavior for direct-wallet and queued success", async () => {
    const work = createMockWork({ id: "work-1", status: "pending" });
    const direct = renderHookWithQueryClient(
      () =>
        useWorkApprovalActions({
          chainId: 11155111,
          gardenId: "garden-1",
          onApprovalComplete: mocks.onApprovalComplete,
          viewingMode: "steward",
          work,
        }),
      { queryClient }
    );

    let directCompletion: void | Promise<void> | undefined;
    act(() => {
      directCompletion = mocks.approvalDependencies?.onApprovalComplete?.({
        approved: true,
        gardenId: "garden-1",
        workUID: "work-1",
      });
    });

    expect(direct.result.current.optimisticStatus).toBe("approved");
    await act(async () => {
      mocks.timeoutCallbacks.shift()?.();
      await directCompletion;
    });
    expect(mocks.onApprovalComplete).toHaveBeenCalledWith("garden-1");
    direct.unmount();

    mocks.onApprovalComplete.mockClear();
    const queued = renderHookWithQueryClient(
      () =>
        useWorkApprovalActions({
          chainId: 11155111,
          gardenId: "garden-1",
          onApprovalComplete: mocks.onApprovalComplete,
          viewingMode: "steward",
          work,
        }),
      { queryClient }
    );

    await act(async () => {
      mocks.jobListener?.("job:completed", {
        job: { kind: "approval", payload: { approved: true, workUID: "work-1" } },
      });
    });

    expect(queued.result.current.optimisticStatus).toBe("approved");
    act(() => mocks.timeoutCallbacks.shift()?.());
    expect(mocks.onApprovalComplete).toHaveBeenCalledWith("garden-1");
  });

  it("keeps rejected feedback available after wallet cancellation so it can be retried", () => {
    const work = createMockWork({ id: "work-1", status: "pending" });
    const { result } = renderHookWithQueryClient(
      () =>
        useWorkApprovalActions({
          chainId: 11155111,
          gardenId: "garden-1",
          onApprovalComplete: mocks.onApprovalComplete,
          viewingMode: "steward",
          work,
        }),
      { queryClient }
    );

    act(() => {
      result.current.handleRejectPress();
      result.current.setInlineFeedback("Please add a clearer photo.");
    });
    act(() => result.current.handleSubmitApproval());

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(result.current.feedbackMode).toBe("reject");
    expect(result.current.inlineFeedback).toBe("Please add a clearer photo.");
    expect(result.current.confidence).toBe(Confidence.NONE);

    act(() => result.current.handleSubmitApproval());
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });
});
