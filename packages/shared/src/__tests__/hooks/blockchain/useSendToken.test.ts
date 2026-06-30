/**
 * useSendToken Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN_ADDR = "0x3333333333333333333333333333333333333333" as Address;
const CHAIN = 42161;

const mockSendContractCall = vi.fn();
const mockReadContract = vi.fn();
const mockAddRecent = vi.fn();
let mockPrimaryAddress: string | null = ACCOUNT;

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mockPrimaryAddress }),
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
  createMutationErrorHandler: () => vi.fn(),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const { useSendToken } = await import("../../../hooks/blockchain/useSendToken");

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

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("hooks/blockchain/useSendToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = ACCOUNT;
    mockSendContractCall.mockResolvedValue({ hash: "0xhash", sponsored: true });
    mockReadContract.mockResolvedValue(1000n);
  });

  it("sends an ERC-20 transfer with the right args and records the recipient", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    // biome-ignore lint/suspicious/noExplicitAny: test fixture token shape
    await result.current.mutateAsync({
      token: TOKEN as any,
      to: RECIPIENT,
      amount: 100n,
      note: "hi",
    });

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
});
