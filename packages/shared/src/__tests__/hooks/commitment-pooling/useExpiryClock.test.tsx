/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - These real-hook DOM timer cases cover exact and consecutive deadlines and the chain's clock against a skewed device; the console tests cover rerenders and long waits.

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Config, WagmiContext } from "wagmi";

import {
  useChainClockReader,
  useExpiryClock,
} from "../../../hooks/commitment-pooling/useExpiryClock";
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
function providers({
  wallet,
  client = createTestQueryClient(),
}: {
  wallet: boolean;
  client?: QueryClient;
}) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      wallet ? createElement(WagmiContext.Provider, { value: {} as Config }, children) : children
    );
}

// A block body: a function returned from `beforeEach` runs as its teardown, and `mockReset`
// returns the mock itself.
beforeEach(() => {
  mocks.getBlock.mockReset();
});
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

  // A booking's acceptance deadline is no promise's due date, and an act that judges one reads
  // the chain's time as it starts, not the time a page last drew (Codex on #1320).
  it("ticks past other deadlines on the chain's clock, and reads that clock when an act asks", async () => {
    vi.useFakeTimers();
    const chainNow = 1_800_000_000;
    vi.setSystemTime((chainNow + 3_600) * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow) });
    const deadlines = [BigInt(chainNow + 1)];
    const { result } = renderHook(
      () => ({
        now: useExpiryClock({ chainId: CHAIN_ID, commitments: [], cycleEndTimes, deadlines }),
        read: useChainClockReader(CHAIN_ID),
      }),
      { wrapper: providers({ wallet: true }) }
    );
    await vi.waitFor(() => expect(result.current.now).toBe(BigInt(chainNow)));
    expect(result.current.read()).toBe(BigInt(chainNow));

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.now).toBe(BigInt(chainNow + 2));
    expect(result.current.read()).toBe(BigInt(chainNow + 2));
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

  // A clock surface closed while the device's clock was corrected heard no return, so the next one
  // to open reads the chain's time again rather than reuse the cached offset (Codex on #1341).
  it("reads the chain's time again when a clock surface opens on a cached offset", async () => {
    vi.useFakeTimers();
    const chainNow = 1_800_000_000;
    vi.setSystemTime((chainNow + 3_600) * 1000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow) });
    const commitments = [live(BigInt(chainNow + 1_800))];
    // The app keeps an unobserved read for minutes; the test client would drop it at once.
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
    const wrapper = providers({ wallet: true, client });
    const clock = () => useExpiryClock({ chainId: CHAIN_ID, commitments, cycleEndTimes });
    const first = renderHook(clock, { wrapper });
    await vi.waitFor(() => expect(first.result.current).toBe(BigInt(chainNow)));
    first.unmount();

    // Corrected while no clock surface is open, well inside the offset's 30 minutes.
    vi.setSystemTime(chainNow * 1000 + 60_000);
    mocks.getBlock.mockResolvedValue({ timestamp: BigInt(chainNow + 60) });
    const second = renderHook(clock, { wrapper });
    await vi.waitFor(() => expect(mocks.getBlock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(second.result.current).toBe(BigInt(chainNow + 60)));
  });

  // A failed read keeps TanStack's last answer, and that offset would carry the old skew onto a
  // corrected device clock (Codex on #1341): while the chain's time can't be read, the device's
  // clock stands in.
  it("drops an earlier offset when the chain's time can't be read again", async () => {
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

    // The device's clock is corrected while the app is away, and the RPC fails on return.
    vi.setSystemTime(chainNow * 1000 + 60_000);
    mocks.getBlock.mockRejectedValue(new Error("RPC unavailable"));
    act(() => window.dispatchEvent(new Event("focus")));
    // The read and its one retry, a second apart.
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    await vi.waitFor(() => expect(mocks.getBlock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(result.current).toBeGreaterThanOrEqual(BigInt(chainNow + 60)));
    expect(result.current).toBeLessThan(BigInt(chainNow + 70));
    expect(dueAt(commitments, result.current)).toHaveLength(0);
  });
});
