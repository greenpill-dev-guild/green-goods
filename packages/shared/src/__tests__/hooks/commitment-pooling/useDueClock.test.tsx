/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDueClock } from "../../../hooks/commitment-pooling/useDueClock";

type CycleRow = { cycleId: bigint; endTime: bigint | null };

const mocks = vi.hoisted(() => ({
  cycles: undefined as CycleRow[] | undefined,
  isError: false,
  /** Whether each render asked for the cycles at all. */
  enabled: [] as boolean[],
  refetch: vi.fn(),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentCycles: (_input: unknown, options?: { enabled?: boolean }) => {
    mocks.enabled.push(options?.enabled ?? true);
    return { data: mocks.cycles, isError: mocks.isError, refetch: mocks.refetch };
  },
}));

type Clocked = Parameters<typeof useDueClock>[0]["commitments"][number];

/** An Open ask that falls due with cycle 7, unless told otherwise. */
const promise = (over: Partial<Clocked> = {}): Clocked => ({
  onchainState: "OFFERED",
  cycleId: 7n,
  dueDate: null,
  ...over,
});

const render = (commitments: readonly Clocked[]) =>
  renderHook(() => useDueClock({ chainId: 11155111, poolId: 3n, commitments }));

beforeEach(() => {
  mocks.cycles = undefined;
  mocks.isError = false;
  mocks.enabled = [];
  mocks.refetch.mockReset();
});

describe("useDueClock", () => {
  it("knows the clock without reading cycles when every open promise has its own due date", () => {
    const { result } = render([promise({ dueDate: 1_700_000_000n })]);

    expect(result.current.known).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(mocks.enabled).not.toContain(true);
  });

  it("reads the cycles only for promises still open to take up", () => {
    // A settled undated promise never falls due again, so its cycle's end is not needed.
    const { result } = render([
      promise({ onchainState: "FULFILLED" }),
      promise({ onchainState: "EXPIRED" }),
    ]);

    expect(result.current.known).toBe(true);
    expect(mocks.enabled).not.toContain(true);
  });

  it("is unknown while an open undated promise's cycle is unread, and known once it is read", () => {
    const { result, rerender } = render([promise()]);
    expect(mocks.enabled).toContain(true);
    expect(result.current.known).toBe(false);
    expect(result.current.isError).toBe(false);

    mocks.cycles = [{ cycleId: 7n, endTime: 1_800_000_000n }];
    rerender();
    expect(result.current.known).toBe(true);
    expect(result.current.clock.cycleEndTimes.get("7")).toBe(1_800_000_000n);
  });

  it("stays unknown, with an error, when the read lacks the cycle a promise falls due with", () => {
    mocks.cycles = [{ cycleId: 8n, endTime: 1_800_000_000n }];
    const { result } = render([promise()]);

    expect(result.current.known).toBe(false);
    expect(result.current.isError).toBe(true);
    result.current.retry();
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("reports a failed cycles read as unknown", () => {
    mocks.isError = true;
    const { result } = render([promise()]);

    expect(result.current.known).toBe(false);
    expect(result.current.isError).toBe(true);
  });
});
