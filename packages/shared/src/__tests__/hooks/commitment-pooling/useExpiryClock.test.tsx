/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - These real-hook DOM timer cases cover exact and consecutive deadlines and the chain's clock against a skewed device; the console tests cover rerenders and long waits.

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Config, WagmiContext } from "wagmi";

import { useExpiryClock } from "../../../hooks/commitment-pooling/useExpiryClock";
import { selectDueLiveCommitments } from "../../../modules/commitment-pooling/steward-selectors";
import { createTestQueryClient } from "../../test-utils/query-client";

const mocks = vi.hoisted(() => ({ getBlock: vi.fn() }));

// The chain's latest block is the edge; the clock's query and timers run for real.
vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  getBlock: mocks.getBlock,
}));

const CHAIN_ID = 11155111;
const cycleEndTimes = new Map<string, bigint | null>();
const live = (dueDate: bigint) => ({
  onchainState: "ACCEPTED" as const,
  cycleId: null,
  dueDate,
});
const dueAt = (commitments: ReturnType<typeof live>[], now: bigint) =>
  selectDueLiveCommitments({ commitments, cycleEndTimes, now });

/** The app's providers: a query client, and, where the wallet runtime mounts, its wagmi client. */
function providers({ wallet }: { wallet: boolean }) {
  const client = createTestQueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      wallet ? createElement(WagmiContext.Provider, { value: {} as Config }, children) : children
    );
}

beforeEach(() => mocks.getBlock.mockReset());
afterEach(() => vi.useRealTimers());

describe("useExpiryClock", () => {
  it("offers expiry after mounting during the exact due second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const commitments = [live(1000n)];
    const { result } = renderHook(
      () => useExpiryClock({ chainId: CHAIN_ID, commitments, cycleEndTimes }),
      { wrapper: providers({ wallet: false }) }
    );

    expect(dueAt(commitments, result.current)).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(dueAt(commitments, result.current)).toHaveLength(1);
    // A page without the wallet runtime reads the device's clock and asks the chain nothing.
    expect(mocks.getBlock).not.toHaveBeenCalled();
  });

  it("advances through consecutive due seconds while the review stays open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(999_000);
    const commitments = [live(1000n), live(1001n)];
    const { result } = renderHook(
      () => useExpiryClock({ chainId: CHAIN_ID, commitments, cycleEndTimes }),
      { wrapper: providers({ wallet: false }) }
    );

    act(() => vi.advanceTimersByTime(2000));
    expect(dueAt(commitments, result.current)).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(dueAt(commitments, result.current)).toHaveLength(2);
  });

  // The chain's `block.timestamp` decides when anyone may expire a promise, not the device: a
  // device an hour fast would hide a promise still open for half an hour (Codex on #1331).
  it("reads due dates on the chain's clock while the device runs an hour fast, and ticks on it", async () => {
    vi.useFakeTimers();
    const chainNow = 1_800_000_000;
    vi.setSystemTime((chainNow + 3_600) * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow) });
    const commitments = [live(BigInt(chainNow + 1_800))];
    const { result } = renderHook(
      () => useExpiryClock({ chainId: CHAIN_ID, commitments, cycleEndTimes }),
      { wrapper: providers({ wallet: true }) }
    );

    // On the device's clock alone it is already half an hour past due.
    expect(dueAt(commitments, result.current)).toHaveLength(1);
    await vi.waitFor(() => expect(result.current).toBe(BigInt(chainNow)));
    expect(dueAt(commitments, result.current)).toHaveLength(0);
    expect(mocks.getBlock).toHaveBeenCalledExactlyOnceWith({}, { chainId: CHAIN_ID });

    // It falls due on the chain's due second, not the device's.
    await act(async () => vi.advanceTimersByTimeAsync(1_799_000));
    expect(dueAt(commitments, result.current)).toHaveLength(0);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(dueAt(commitments, result.current)).toHaveLength(1);
  });

  // An offset read against a device clock that is later corrected would carry the old error
  // (Codex on #1341): the app reads the chain's time again as it comes back.
  it("reads the chain's time again when the app comes back after the device clock was corrected", async () => {
    vi.useFakeTimers();
    const chainNow = 1_800_000_000;
    vi.setSystemTime((chainNow + 3_600) * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow) });
    const commitments = [live(BigInt(chainNow + 1_800))];
    const { result } = renderHook(
      () => useExpiryClock({ chainId: CHAIN_ID, commitments, cycleEndTimes }),
      { wrapper: providers({ wallet: true }) }
    );
    await vi.waitFor(() => expect(result.current).toBe(BigInt(chainNow)));

    // The device's clock is corrected to the chain's while the app is away.
    vi.setSystemTime(chainNow * 1000 + 60_000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow + 60) });
    act(() => window.dispatchEvent(new Event("focus")));
    await vi.waitFor(() => expect(mocks.getBlock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current).toBe(BigInt(chainNow + 60)));
    expect(dueAt(commitments, result.current)).toHaveLength(0);
  });
});
