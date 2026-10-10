/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - These real-hook DOM timer cases cover exact and consecutive deadlines; the console tests cover rerenders and long waits.

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useExpiryClock } from "../../../hooks/commitment-pooling/useExpiryClock";
import { selectDueLiveCommitments } from "../../../modules/commitment-pooling/steward-selectors";

const cycleEndTimes = new Map<string, bigint | null>();
const live = (dueDate: bigint) => ({
  onchainState: "ACCEPTED" as const,
  cycleId: null,
  dueDate,
});

afterEach(() => vi.useRealTimers());

describe("useExpiryClock", () => {
  it("offers expiry after mounting during the exact due second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const commitments = [live(1000n)];
    const { result } = renderHook(() => useExpiryClock({ commitments, cycleEndTimes }));

    expect(
      selectDueLiveCommitments({ commitments, cycleEndTimes, now: result.current })
    ).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(
      selectDueLiveCommitments({ commitments, cycleEndTimes, now: result.current })
    ).toHaveLength(1);
  });

  it("advances through consecutive due seconds while the review stays open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(999_000);
    const commitments = [live(1000n), live(1001n)];
    const { result } = renderHook(() => useExpiryClock({ commitments, cycleEndTimes }));

    act(() => vi.advanceTimersByTime(2000));
    expect(
      selectDueLiveCommitments({ commitments, cycleEndTimes, now: result.current })
    ).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(
      selectDueLiveCommitments({ commitments, cycleEndTimes, now: result.current })
    ).toHaveLength(2);
  });
});
