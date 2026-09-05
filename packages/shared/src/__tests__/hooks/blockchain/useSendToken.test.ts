/**
 * useSendToken Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
const mockWaitForReceipt = vi.fn();
const mockClientForChain = vi.fn();
const mockDelivery = vi.fn();
const mockHandleError = vi.fn();
let mockPrimaryAddress: string | null = ACCOUNT;
const mockSender = { sendContractCall: mockSendContractCall };

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mockPrimaryAddress }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => CHAIN,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockSender,
}));
vi.mock("../../../hooks/blockchain/useRecentRecipients", () => ({
  addRecentRecipient: (...args: unknown[]) => mockAddRecent(...args),
}));
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: (chainId: number) => {
    mockClientForChain(chainId);
    return {
      readContract: (...args: unknown[]) => mockReadContract(...args),
      waitForTransactionReceipt: (...args: unknown[]) => mockWaitForReceipt(...args),
    };
  },
}));
vi.mock("../../../modules/commitment-pooling/data-settlement", () => ({
  getGardenerDeliveryEnabled: () => mockDelivery(),
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

const TOKEN = {
  chainId: CHAIN,
  symbol: "GOODS",
  label: "Green Goods",
  address: TOKEN_ADDR,
  decimals: 18,
  confersGovernance: true,
  supported: true,
  balance: 1000n,
  errored: false,
};

let queryClient: QueryClient;
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient = client;
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("hooks/blockchain/useSendToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = ACCOUNT;
    mockSendContractCall.mockResolvedValue({ hash: "0xhash", sponsored: true });
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) =>
      Promise.resolve(functionName === "getFees" ? [10n, true] : 1000n)
    );
    mockDelivery.mockResolvedValue(true);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
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

const CELO_TOKEN = {
  ...TOKEN,
  chainId: 42220,
  symbol: "G$",
  confersGovernance: false,
  address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
};
const reviewedFee = {
  amount: 100n,
  fee: 10n,
  senderPays: true,
  totalDebit: 110n,
  recipientAmount: 100n,
};

describe("Celo send safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = ACCOUNT;
    mockSendContractCall.mockResolvedValue({ hash: `0x${"a".repeat(64)}`, sponsored: true });
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) =>
      Promise.resolve(functionName === "getFees" ? [10n, true] : 1000n)
    );
    mockDelivery.mockResolvedValue(true);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });
  const input = { token: CELO_TOKEN, to: RECIPIENT, amount: 100n, reviewedFee };

  it("reads, sends, confirms and invalidates only the selected Celo chain", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await result.current.mutateAsync(input);
    expect(mockClientForChain.mock.calls.every(([chain]) => chain === 42220)).toBe(true);
    expect(mockSendContractCall).toHaveBeenCalledWith(expect.objectContaining({ chainId: 42220 }));
    expect(mockWaitForReceipt).toHaveBeenCalled();
    expect(invalidate.mock.calls).toContainEqual([
      { queryKey: ["greengoods", "tokens", "celoBalance", ACCOUNT.toLowerCase(), 42220] },
    ]);
    expect(invalidate.mock.calls).not.toContainEqual([{ queryKey: ["greengoods", "tokens"] }]);
  });

  it("requires balance for amount plus sender-paid fee", async () => {
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) =>
      Promise.resolve(functionName === "getFees" ? [10n, true] : 105n)
    );
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/insufficient/i);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockHandleError).toHaveBeenCalled();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("blocks missing review and a changed fee before signing", async () => {
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync({ ...input, reviewedFee: undefined })).rejects.toThrow(
      /fee/i
    );
    await expect(
      result.current.mutateAsync({ ...input, reviewedFee: { ...reviewedFee, fee: 9n } })
    ).rejects.toThrow(/fee/i);
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it.each([null, false])("blocks indexed delivery %s", async (enabled) => {
    mockDelivery.mockResolvedValue(enabled);
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/delivery/i);
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it.each(["getFees", "balanceOf"])("blocks a failed %s read", async (failedRead) => {
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) =>
      functionName === failedRead
        ? Promise.reject(new Error("unavailable"))
        : Promise.resolve(functionName === "getFees" ? [10n, true] : 1000n)
    );
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects an account change while the balance read is pending", async () => {
    let finishBalance!: (balance: bigint) => void;
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) =>
      functionName === "getFees"
        ? Promise.resolve([10n, true])
        : new Promise<bigint>((resolve) => {
            finishBalance = resolve;
          })
    );
    const { result, rerender } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    const pending = result.current.mutateAsync(input);
    const failure = expect(pending).rejects.toThrow(/session changed/i);
    await waitFor(() => expect(finishBalance).toBeDefined());
    mockPrimaryAddress = RECIPIENT;
    rerender();
    finishBalance(1000n);
    await failure;
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("never queues an offline send", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/online/i);
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("does not claim success or invalidate balance for reverted inclusion", async () => {
    mockWaitForReceipt.mockResolvedValue({ status: "reverted" });
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/revert/i);
    expect(mockAddRecent).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each([
    "cancelled",
    "replaced",
  ])("does not report a %s transaction as confirmed", async (reason) => {
    mockWaitForReceipt.mockImplementation(async ({ onReplaced }) => {
      onReplaced({ reason });
      return { status: "success" };
    });
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/cancelled or replaced/i);
    expect(mockAddRecent).not.toHaveBeenCalled();
  });
  it("accepts repricing and returns the confirmed replacement hash", async () => {
    const hash = `0x${"b".repeat(64)}`;
    mockWaitForReceipt.mockImplementation(async ({ onReplaced }) => {
      onReplaced({ reason: "repriced" });
      return { status: "success", transactionHash: hash };
    });
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).resolves.toMatchObject({ hash });
  });

  it("allows an explicit retry after rejection and does not retry automatically", async () => {
    mockSendContractCall.mockRejectedValueOnce(new Error("User rejected"));
    const { result } = renderHook(() => useSendToken(), { wrapper: makeWrapper() });
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/rejected/i);
    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    await result.current.mutateAsync(input);
    expect(mockSendContractCall).toHaveBeenCalledTimes(2);
  });
});
