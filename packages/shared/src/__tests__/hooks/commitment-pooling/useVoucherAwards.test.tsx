import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoucherAwards } from "../../../hooks/commitment-pooling/useVoucherAwards";
import { createTestQueryClient } from "../../test-utils/query-client";
import { logger } from "../../../modules/app/logger";

const mocks = vi.hoisted(() => ({
  user: {
    primaryAddress: "0x4444444444444444444444444444444444444444",
    authMode: "wallet",
    passkeyAccountProfile: null,
  },
  sender: {} as object,
  sign: vi.fn(async () => "0x1234"),
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => mocks.user }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("wagmi", () => ({ useSignMessage: () => ({ signMessageAsync: mocks.sign }) }));
const account = "0x4444444444444444444444444444444444444444";
const reserve = "0x1111111111111111111111111111111111111111";
function fixture() {
  const cache = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  return { cache, wrapper };
}
beforeEach(() => {
  mocks.user.primaryAddress = account;
  mocks.sender = {};
  mocks.sign.mockReset().mockResolvedValue("0x1234");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("award account lifecycle", () => {
  it("never prompts on mount; receipt loading is an explicit signed action", async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true, records: [], limit: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useVoucherAwards(), fixture());
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.load.mutateAsync();
    });
    expect(mocks.sign).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("reports an offline error immediately and never queues a later wallet prompt", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const log = vi.spyOn(logger, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useVoucherAwards(reserve), fixture());
    await act(async () => {
      await expect(result.current.load.mutateAsync()).rejects.toThrow("connection unavailable");
    });
    await waitFor(() => expect(result.current.load.isError).toBe(true));
    expect(result.current.load.isPaused).toBe(false);
    expect(log).toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it.each([
    "account-return",
    "sender-replacement",
  ])("abandons an in-flight signature after %s", async (change) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(logger, "error").mockImplementation(() => {});
    let resolve!: (value: string) => void;
    mocks.sign.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        })
    );
    const { result, rerender } = renderHook(() => useVoucherAwards(reserve), fixture());
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.load.mutateAsync().catch((error: unknown) => error);
    });
    await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce());
    if (change === "account-return") {
      mocks.user = { ...mocks.user, primaryAddress: "0x5555555555555555555555555555555555555555" };
      rerender();
      mocks.user = { ...mocks.user, primaryAddress: account };
      rerender();
    } else {
      mocks.sender = {};
      rerender();
    }
    let error: unknown;
    await act(async () => {
      resolve("0x1234");
      error = await pending;
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("account changed");
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.records).toEqual([]);
  });
});
