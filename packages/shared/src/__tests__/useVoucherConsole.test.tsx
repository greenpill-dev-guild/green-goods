/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - Protect persisted pre-adoption cache migration, rehearsal isolation and the clock's tick at a visit's start through the real hook's scheduling.
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitmentPoolingKeys } from "../config/query-keys/commitment-pooling";
import { useVoucherConsole } from "../hooks/admin-ui/pool/useVoucherConsole";
import {
  UNAVAILABLE_VOUCHER_CONSOLE,
  type VoucherConsoleSnapshot,
} from "../modules/commitment-pooling/voucher-console";
import { createTestQueryClient } from "./test-utils/query-client";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const edge = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../modules/commitment-pooling/voucher-console-live", () => ({
  readLiveVoucherConsole: edge.read,
  prepareVoucherSafeFile: vi.fn(),
}));
const input = { chainId: 42161, garden: "0x0000000000000000000000000000000000000001" as const };
const key = commitmentPoolingKeys.voucherConsole(input.chainId, input.garden);
const observed: VoucherConsoleSnapshot = {
  ...UNAVAILABLE_VOUCHER_CONSOLE,
  status: "observed",
  evidence: "onchain",
  observedAt: 100,
};

describe("live voucher console query lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    edge.read.mockResolvedValue(observed);
  });
  afterEach(() => vi.useRealTimers());
  it("replaces a persisted pre-adoption unavailable result with live observations", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, UNAVAILABLE_VOUCHER_CONSOLE, { updatedAt: Date.now() - 60_000 });
    const hook = renderHookWithProviders(() => useVoucherConsole(input), { queryClient });
    await waitFor(() => expect(hook.result.current.snapshot.status).toBe("observed"));
    expect(edge.read).toHaveBeenCalledWith(input);
    expect(hook.result.current.snapshot.evidence).toBe("onchain");
    hook.unmount();
    queryClient.clear();
  });
  it("keeps explicitly labeled rehearsal seeds isolated from background live reads", async () => {
    vi.useFakeTimers();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, { ...observed, evidence: "local-rehearsal" });
    const hook = renderHookWithProviders(() => useVoucherConsole(input), { queryClient });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(edge.read).not.toHaveBeenCalled();
    expect(hook.result.current.snapshot.evidence).toBe("local-rehearsal");
    hook.unmount();
    queryClient.clear();
  });
  // A visit's report waits in Review Promises from the visit's start (PR #1740, Codex).
  it("ticks its clock when a booked visit starts, so the visit's report comes due on screen", async () => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    const startsAt = 1_800_000_060;
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, {
      ...observed,
      evidence: "local-rehearsal",
      observedAt: 1_800_000_000,
      bookings: [
        {
          commitmentId: 43n,
          holder: "0x0000000000000000000000000000000000000002",
          setupId: `0x${"a4".repeat(32)}`,
          issuer: {
            kind: "individual",
            name: "Teo",
            chainId: 100,
            account: "0x0000000000000000000000000000000000000003",
            decimals: 6,
          },
          voucherUnits: 1_000_000n,
          service: {
            kind: "visit",
            startsAt,
            endsAt: startsAt + 14_400,
            report: { checkedIn: true, usableHours: 4, ofHours: 4, photos: 2 },
          },
          stage: { kind: "in-progress" },
        },
      ],
    } satisfies VoucherConsoleSnapshot);
    const hook = renderHookWithProviders(() => useVoucherConsole(input), { queryClient });
    expect(hook.result.current.now).toBeLessThan(startsAt);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(hook.result.current.now).toBeGreaterThanOrEqual(startsAt);
    hook.unmount();
    queryClient.clear();
  });
});
