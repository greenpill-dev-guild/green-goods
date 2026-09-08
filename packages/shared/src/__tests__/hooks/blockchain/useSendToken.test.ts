/**
 * useSendToken Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokensKeys } from "../../../config/query-keys/tokens";
import type { AuthMode } from "../../../types/auth";
import type { Address } from "../../../types/domain";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN_ADDR = "0x3333333333333333333333333333333333333333" as Address;
const CHAIN = 42161;
const BALANCE_REFETCH_DELAY_MS = 3000;

const mockSendContractCall = vi.fn();
const mockReadContract = vi.fn();
const mockAddRecent = vi.fn();
const mockHandleError = vi.fn();
let mockPrimaryAddress: string | null = ACCOUNT;
let mockAuthMode: AuthMode = "passkey";

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mockPrimaryAddress, authMode: mockAuthMode }),
}));
vi.mock("../../../providers/Auth", () => ({
  useOptionalAuthContext: () => ({ authMode: mockAuthMode }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => CHAIN,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({ sendContractCall: mockSendContractCall }),
}));
vi.mock("../../../hooks/blockchain/useRecentRecipients", () => ({
  addRecentRecipient: (...args: unknown[]) => mockAddRecent(...args),
}));
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    readContract: (...args: unknown[]) => mockReadContract(...args),
  }),
}));
vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    dismiss: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockHandleError,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { useSendToken } = await import("../../../hooks/blockchain/useSendToken");
const { toastService } = await import("../../../components/toast");

const TOKEN = {
  symbol: "GOODS",
  label: "Green Goods",
  address: TOKEN_ADDR,
  decimals: 18,
  confersGovernance: true,
  supported: true,
  balance: 1000n,
  errored: false,
};

// biome-ignore lint/suspicious/noExplicitAny: test fixture token shape
const SEND_PARAMS = { token: TOKEN as any, to: RECIPIENT, amount: 100n, note: "hi" };
const BALANCES_KEY = tokensKeys.balances(ACCOUNT.toLowerCase(), CHAIN);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function makeWrapper(client: QueryClient = makeQueryClient()) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function beforeUnloadCalls(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter(
    (call: Parameters<Window["addEventListener"]>) => call[0] === "beforeunload"
  );
}

/** A wallet request that stays open until the test settles it. */
function deferredHandoff() {
  let resolve!: (value: { hash: string; sponsored: boolean }) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<{ hash: string; sponsored: boolean }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  mockSendContractCall.mockReturnValueOnce(promise);
  return { resolve, reject };
}

describe("hooks/blockchain/useSendToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = ACCOUNT;
    mockAuthMode = "passkey";
    mockSendContractCall.mockResolvedValue({ hash: "0xhash", sponsored: true });
    mockReadContract.mockResolvedValue(1000n);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends an ERC-20 transfer with the right args and records the recipient", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await result.current.mutateAsync(SEND_PARAMS);

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    const call = mockSendContractCall.mock.calls[0][0];
    expect(call.functionName).toBe("transfer");
    expect(call.args).toEqual([RECIPIENT, 100n]);
    expect(call.address).toBe(TOKEN_ADDR);
    expect(mockAddRecent).toHaveBeenCalledWith(RECIPIENT, "hi");
  });

  it("rejects and does not send when the balance is insufficient", async () => {
    mockReadContract.mockResolvedValue(50n);
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: test fixture token shape
      result.current.mutateAsync({ token: TOKEN as any, to: RECIPIENT, amount: 100n })
    ).rejects.toThrow(/insufficient/i);
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects a zero amount", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: test fixture token shape
      result.current.mutateAsync({ token: TOKEN as any, to: RECIPIENT, amount: 0n })
    ).rejects.toThrow();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects an unsupported token", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(
      result.current.mutateAsync({
        // biome-ignore lint/suspicious/noExplicitAny: test fixture token shape
        token: { ...TOKEN, supported: false } as any,
        to: RECIPIENT,
        amount: 100n,
      })
    ).rejects.toThrow();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  describe("leave-page guard across the wallet handoff", () => {
    let addSpy: ReturnType<typeof vi.spyOn>;
    let removeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addSpy = vi.spyOn(window, "addEventListener");
      removeSpy = vi.spyOn(window, "removeEventListener");
    });

    afterEach(() => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it("does not warn about leaving while an external wallet signs, then refreshes balances", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockAuthMode = "wallet";
      const client = makeQueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const handoff = deferredHandoff();
      const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper(client) });

      let send!: Promise<unknown>;
      act(() => {
        send = result.current.mutateAsync(SEND_PARAMS);
      });
      await waitFor(() => expect(mockSendContractCall).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // The wallet owns the request now; navigating to it is not lost work.
      expect(beforeUnloadCalls(addSpy)).toHaveLength(0);

      await act(async () => {
        handoff.resolve({ hash: "0xhash", sponsored: false });
        await send;
      });

      // Read-after-write: balances refetch now and again once the RPC catches up.
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BALANCES_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: tokensKeys.all });
      invalidate.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BALANCE_REFETCH_DELAY_MS);
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BALANCES_KEY });
      expect(beforeUnloadCalls(addSpy)).toHaveLength(0);
    });

    it("keeps the guard while an in-page signer is pending and removes it once settled", async () => {
      mockAuthMode = "passkey";
      const handoff = deferredHandoff();
      const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });

      let send!: Promise<unknown>;
      act(() => {
        send = result.current.mutateAsync(SEND_PARAMS);
      });
      await waitFor(() => expect(result.current.isPending).toBe(true));

      expect(beforeUnloadCalls(addSpy)).toHaveLength(1);
      expect(beforeUnloadCalls(removeSpy)).toHaveLength(0);

      await act(async () => {
        handoff.resolve({ hash: "0xhash", sponsored: true });
        await send;
      });

      expect(beforeUnloadCalls(removeSpy)).toHaveLength(1);
      expect(result.current.isPending).toBe(false);
    });

    it.each([
      [
        "rejects in the wallet",
        Object.assign(new Error("User rejected the request"), { code: 4001 }),
      ],
      ["fails on-chain", new Error("Transaction reverted on-chain")],
    ])("recovers when the user %s: no refetch, no guard left, and a retry sends again", async (_label, failure) => {
      mockAuthMode = "wallet";
      const client = makeQueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const handoff = deferredHandoff();
      const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper(client) });

      let send!: Promise<unknown>;
      act(() => {
        send = result.current.mutateAsync(SEND_PARAMS).catch((error: unknown) => error);
      });
      await waitFor(() => expect(result.current.isPending).toBe(true));

      let outcome: unknown;
      await act(async () => {
        handoff.reject(failure);
        outcome = await send;
      });

      expect(outcome).toBe(failure);
      expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
      expect(mockHandleError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ metadata: { to: RECIPIENT, token: "GOODS" }, showToast: true })
      );
      expect(invalidate).not.toHaveBeenCalled();
      expect(mockAddRecent).not.toHaveBeenCalled();
      expect(beforeUnloadCalls(addSpy)).toHaveLength(0);
      await waitFor(() => expect(result.current.isPending).toBe(false));

      // The lock released with the failure, so the next attempt reaches the wallet again.
      await act(async () => {
        await result.current.mutateAsync(SEND_PARAMS);
      });

      expect(mockSendContractCall).toHaveBeenCalledTimes(2);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BALANCES_KEY });
    });

    it("removes the in-page guard when the send fails", async () => {
      mockAuthMode = "passkey";
      const handoff = deferredHandoff();
      const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });

      let send!: Promise<unknown>;
      act(() => {
        send = result.current.mutateAsync(SEND_PARAMS).catch(() => undefined);
      });
      await waitFor(() => expect(beforeUnloadCalls(addSpy)).toHaveLength(1));

      await act(async () => {
        handoff.reject(new Error("Transaction reverted on-chain"));
        await send;
      });

      expect(beforeUnloadCalls(removeSpy)).toHaveLength(1);
    });
  });
});
