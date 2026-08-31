/** @vitest-environment jsdom */

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueStats: vi.fn(),
  updateState: vi.fn(),
}));

vi.mock("@green-goods/shared/providers/JobQueue", () => ({
  useQueueStats: mocks.queueStats,
}));

vi.mock("@green-goods/shared/hooks/app/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: mocks.updateState,
}));

import { PwaBadgeCoordinator } from "../../components/Communication/PwaBadgeCoordinator";

describe("PwaBadgeCoordinator", () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const clearAppBadge = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperties(navigator, {
      setAppBadge: { configurable: true, value: setAppBadge },
      clearAppBadge: { configurable: true, value: clearAppBadge },
    });
  });

  it("shows the unresolved job count before an update badge", async () => {
    mocks.queueStats.mockReturnValue({ pending: 2, failed: 1 });
    mocks.updateState.mockReturnValue({ phase: "waiting" });

    render(<PwaBadgeCoordinator />);

    await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(3));
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it("shows a dot for a waiting update when no jobs are unresolved", async () => {
    mocks.queueStats.mockReturnValue({ pending: 0, failed: 0 });
    mocks.updateState.mockReturnValue({ phase: "waiting" });

    render(<PwaBadgeCoordinator />);

    await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith());
  });

  it("clears the badge when neither condition applies", async () => {
    mocks.queueStats.mockReturnValue({ pending: 0, failed: 0 });
    mocks.updateState.mockReturnValue({ phase: "idle" });

    render(<PwaBadgeCoordinator />);

    await waitFor(() => expect(clearAppBadge).toHaveBeenCalledTimes(1));
  });
});
