/**
 * Cookie Jar Hook Tests
 * @vitest-environment jsdom
 *
 * A garden jar only accepts setting changes from the garden account, so the per-claim limit
 * and cooldown hooks must send `GardenAccount.execute(jar, 0, calldata, 0)`, never a call
 * straight to the jar (that reverts on chain for every wallet).
 */

import { QueryClient, QueryClientProvider, type UseMutationResult } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { encodeFunctionData } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_JAR_ABI } from "../../../utils/blockchain/abis/cookie-jar";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_JAR = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const TEST_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// ============================================
// Mocks
// ============================================

const mocks = await vi.hoisted(async () => ({
  senderAvailable: true,
  sender: (await import("@green-goods/shared/testing")).createMockTransactionSender({
    result: {
      hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      sponsored: true,
    },
  }),
  mutationErrorHandler: vi.fn(),
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => (mocks.senderAvailable ? mocks.sender : null),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
}));

const mockToastLoading = vi.fn().mockReturnValue("toast-1");
const mockToastSuccess = vi.fn();
const mockToastDismiss = vi.fn();

vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: (...args: unknown[]) => mockToastLoading(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    dismiss: (...args: unknown[]) => mockToastDismiss(...args),
    error: vi.fn(),
  },
}));

vi.mock("../../../utils/blockchain/abis", () => ({
  COOKIE_JAR_ABI: [],
  COOKIE_JAR_MODULE_ABI: [],
  ERC20_ALLOWANCE_ABI: [],
  ERC20_DECIMALS_ABI: [],
}));

vi.mock("../../../config/query-keys", () => ({
  queryInvalidation: {
    onCookieJarAdminAction: () => [["greengoods", "cookieJar"]],
    onCookieJarDeposit: () => [["greengoods", "cookieJar"]],
    onCookieJarWithdraw: () => [["greengoods", "cookieJar"]],
  },
  INDEXER_LAG_SCHEDULE_MS: [2000, 5000, 15000],
  queryKeys: {
    cookieJar: {
      all: ["greengoods", "cookieJar"],
      byGarden: () => ["greengoods", "cookieJar", "garden"],
    },
  },
  STALE_TIME_MEDIUM: 30000,
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useProgressiveInvalidation: (callback: () => void) => ({
    start: vi.fn(callback),
    cancel: vi.fn(),
  }),
}));

vi.mock("../../../hooks/utils/useSafeMutation", () => ({
  useSafeMutation: (mutation: unknown) => mutation,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: "0x2222222222222222222222222222222222222222",
  }),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn().mockResolvedValue(1000000n),
}));

import {
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
} from "../../../hooks/cookie-jar/useCookieJarAdmin";

// Minimal i18n messages for tests
const messages: Record<string, string> = {
  "app.cookieJar.limitUpdating": "Updating limit…",
  "app.cookieJar.limitUpdated": "Limit updated",
  "app.cookieJar.cooldownUpdating": "Updating cooldown…",
  "app.cookieJar.cooldownUpdated": "Cooldown updated",
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      IntlProvider,
      { locale: "en", messages },
      createElement(QueryClientProvider, { client: queryClient }, children)
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

async function expectRejectedMutation<TVariables>(
  queryClient: QueryClient,
  useHook: () => UseMutationResult<`0x${string}`, Error, TVariables, { toastId: string }>,
  params: TVariables
) {
  mocks.sender.sendContractCall.mockRejectedValue(new Error("Reverted"));
  const { result } = renderHook(useHook, { wrapper: createWrapper(queryClient) });

  await act(async () => {
    result.current.mutate(params);
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Reverted" }),
    { metadata: { gardenAddress: TEST_GARDEN, jarAddress: TEST_JAR } }
  );
}

// ============================================
// Jar setting hooks
// ============================================

describe("cookie jar setting hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mocks.senderAvailable = true;
    mocks.sender.sendContractCall.mockResolvedValue({
      hash: TEST_TX_HASH as `0x${string}`,
      sponsored: true,
    });
  });

  it("asks the garden account to change the jar's per-claim limit", async () => {
    const { result } = renderHook(() => useCookieJarUpdateMaxWithdrawal(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ jarAddress: TEST_JAR, maxWithdrawal: 10n ** 19n });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GARDEN,
        functionName: "execute",
        args: [
          TEST_JAR,
          0n,
          encodeFunctionData({
            abi: COOKIE_JAR_ABI,
            functionName: "updateMaxWithdrawalAmount",
            args: [10n ** 19n],
          }),
          0,
        ],
        chainId: TEST_CHAIN_ID,
      })
    );
    expect(mockToastLoading).toHaveBeenCalledWith({ title: "Updating limit…" });
    expect(mockToastSuccess).toHaveBeenCalledWith({ title: "Limit updated" });
  });

  it("asks the garden account to change the jar's cooldown", async () => {
    const { result } = renderHook(() => useCookieJarUpdateInterval(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ jarAddress: TEST_JAR, withdrawalInterval: 604800n });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GARDEN,
        functionName: "execute",
        args: [
          TEST_JAR,
          0n,
          encodeFunctionData({
            abi: COOKIE_JAR_ABI,
            functionName: "updateWithdrawalInterval",
            args: [604800n],
          }),
          0,
        ],
      })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith({ title: "Cooldown updated" });
  });

  it("reports a revert, as a wallet that cannot sign for the garden gets", async () => {
    await expectRejectedMutation(queryClient, () => useCookieJarUpdateMaxWithdrawal(TEST_GARDEN), {
      jarAddress: TEST_JAR,
      maxWithdrawal: 5000n,
    });
    expect(mockToastDismiss).toHaveBeenCalledWith("toast-1");

    await expectRejectedMutation(queryClient, () => useCookieJarUpdateInterval(TEST_GARDEN), {
      jarAddress: TEST_JAR,
      withdrawalInterval: 86400n,
    });
  });

  it("reports an unavailable sender while authentication is offline", async () => {
    mocks.senderAvailable = false;

    const { result } = renderHook(() => useCookieJarUpdateMaxWithdrawal(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ jarAddress: TEST_JAR, maxWithdrawal: 5000n });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Transaction sender is unavailable");
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
  });
});
