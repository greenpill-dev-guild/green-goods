/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../config/query-keys/registry";
import { useCampaignCookieJarDeposit } from "../../../hooks/cookie-jar/useCampaignCookieJar";
import { useCookieJarDeposit } from "../../../hooks/cookie-jar/useCookieJarDeposit";

const mocks = vi.hoisted(() => ({
  userAddress: "0x1111111111111111111111111111111111111111" as Address | undefined,
  readContract: vi.fn(),
  sendContractTx: vi.fn(),
  handleError: vi.fn(),
  toastLoading: vi.fn(() => "deposit-toast"),
  toastSuccess: vi.fn(),
  toastDismiss: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@wagmi/core", () => ({
  readContract: mocks.readContract,
  waitForTransactionReceipt: vi.fn(),
}));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mocks.userAddress }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));
vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => mocks.sendContractTx,
}));
vi.mock("../../../hooks/utils/useSafeMutation", () => ({
  useSafeMutation: (mutation: unknown) => mutation,
}));
vi.mock("../../../hooks/utils/useTimeout", () => ({
  useProgressiveInvalidation: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.handleError,
}));
vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: mocks.toastLoading,
    success: mocks.toastSuccess,
    dismiss: mocks.toastDismiss,
  },
}));
vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: mocks.warn },
}));

const GARDEN = "0x2222222222222222222222222222222222222222" as Address;
const JAR = "0x3333333333333333333333333333333333333333" as Address;
const TOKEN = "0x4444444444444444444444444444444444444444" as Address;
const TX_HASH = `0x${"a".repeat(64)}` as `0x${string}`;
const params = { jarAddress: JAR, assetAddress: TOKEN, amount: 10n };

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      createElement(QueryClientProvider, { client: queryClient }, children)
    );
  };
}

function renderMutation<TResult>(useHook: () => TResult) {
  // TEST-QUALITY: allow-local-query-setup - the exact client is spied on, and blank Intl context is intentional.
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const hook = renderHook(useHook, {
    wrapper: wrapperFor(queryClient),
  });
  return { ...hook, invalidateQueries };
}

function renderDeposit() {
  return renderMutation(() => useCookieJarDeposit(GARDEN));
}

describe("useCookieJarDeposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userAddress = "0x1111111111111111111111111111111111111111";
    mocks.sendContractTx.mockResolvedValue(TX_HASH);
    mocks.readContract.mockImplementation(
      async (_config: unknown, request: { functionName: string }) =>
        request.functionName === "balanceOf" ? 20n : 0n
    );
  });

  it("approves the token before depositing and refreshes the jar after success", async () => {
    const { result, invalidateQueries } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(params);
    });

    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: TOKEN,
        functionName: "balanceOf",
        args: [mocks.userAddress],
      })
    );
    expect(mocks.sendContractTx).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: TOKEN,
        functionName: "approve",
        args: [JAR, 10n],
      })
    );
    expect(mocks.sendContractTx).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: JAR,
        functionName: "deposit",
        args: [10n],
      })
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.cookieJar.jarDetail(JAR, 11155111),
    });
    expect(mocks.toastDismiss).toHaveBeenCalledWith("deposit-toast");
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("does not request approval when allowance already covers the deposit", async () => {
    mocks.readContract.mockImplementation(
      async (_config: unknown, request: { functionName: string }) =>
        request.functionName === "balanceOf" ? 20n : 10n
    );
    const { result } = renderDeposit();

    await act(async () => {
      await result.current.mutateAsync(params);
    });

    expect(mocks.sendContractTx).toHaveBeenCalledTimes(1);
    expect(mocks.sendContractTx).toHaveBeenCalledWith(
      expect.objectContaining({ address: JAR, functionName: "deposit", args: [10n] })
    );
  });

  it("rejects an insufficient balance before any transaction", async () => {
    mocks.readContract.mockResolvedValue(5n);
    const { result, invalidateQueries } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(params)).rejects.toThrow(
        "Insufficient token balance for deposit"
      );
    });

    expect(mocks.sendContractTx).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("rejects a disconnected account before reading or sending", async () => {
    mocks.userAddress = undefined;
    const { result } = renderDeposit();

    await act(async () => {
      await expect(result.current.mutateAsync(params)).rejects.toThrow(
        "Connected account required"
      );
    });

    expect(mocks.readContract).not.toHaveBeenCalled();
    expect(mocks.sendContractTx).not.toHaveBeenCalled();
  });

  it("refreshes the member's campaign after a campaign jar deposit", async () => {
    mocks.readContract.mockImplementation(
      async (_config: unknown, request: { functionName: string }) =>
        request.functionName === "balanceOf" ? 20n : 10n
    );
    const { result, invalidateQueries } = renderMutation(() => useCampaignCookieJarDeposit());

    await act(async () => {
      await result.current.mutateAsync(params);
    });

    expect(mocks.sendContractTx).toHaveBeenCalledTimes(1);
    expect(mocks.sendContractTx).toHaveBeenCalledWith(
      expect.objectContaining({ address: JAR, functionName: "deposit", args: [10n] })
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.cookieJar.campaign(JAR, mocks.userAddress, 11155111),
    });
  });
});
