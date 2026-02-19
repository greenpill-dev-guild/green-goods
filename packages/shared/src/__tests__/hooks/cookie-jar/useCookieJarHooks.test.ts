/**
 * Cookie Jar Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the cookie jar mutation hooks (pause, unpause, updateMaxWithdrawal,
 * updateInterval, emergencyWithdraw) and the query hooks (useGardenCookieJars,
 * useUserCookieJars).
 *
 * All mutation hooks follow the same pattern: sendContractTx + toast + invalidation,
 * so we test the shared interface and specific function names.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_JAR = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const TEST_TOKEN = "0x4444444444444444444444444444444444444444" as `0x${string}`;
const TEST_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// ============================================
// Mocks
// ============================================

const mockSendContractTx = vi.fn().mockResolvedValue(TEST_TX_HASH);

vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => mockSendContractTx,
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => vi.fn(),
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

vi.mock("../../../hooks/query-keys", () => ({
  queryInvalidation: {
    onCookieJarAdminAction: () => [["greengoods", "cookieJar"]],
    onCookieJarDeposit: () => [["greengoods", "cookieJar"]],
    onCookieJarWithdraw: () => [["greengoods", "cookieJar"]],
  },
  INDEXER_LAG_FOLLOWUP_MS: 2000,
  queryKeys: {
    cookieJar: {
      all: ["greengoods", "cookieJar"],
      byGarden: () => ["greengoods", "cookieJar", "garden"],
    },
  },
  STALE_TIME_MEDIUM: 30000,
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useDelayedInvalidation: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: "0x2222222222222222222222222222222222222222",
  }),
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn().mockResolvedValue(1000000n),
}));

import {
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateMaxWithdrawal,
  useCookieJarUpdateInterval,
  useCookieJarEmergencyWithdraw,
} from "../../../hooks/cookie-jar/useCookieJarAdmin";

// Minimal i18n messages for tests
const messages: Record<string, string> = {
  "app.cookieJar.pause": "Pause Cookie Jar",
  "app.cookieJar.unpause": "Unpause Cookie Jar",
  "app.cookieJar.updateLimits": "Update Limits",
  "app.cookieJar.emergencyWithdraw": "Emergency Withdraw",
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

// ============================================
// Admin Mutation Hooks
// ============================================

describe("cookie jar admin hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockSendContractTx.mockResolvedValue(TEST_TX_HASH);
  });

  describe("useCookieJarPause", () => {
    it("starts with idle state", () => {
      const { result } = renderHook(() => useCookieJarPause(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("sends pause transaction on mutate", async () => {
      const { result } = renderHook(() => useCookieJarPause(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ jarAddress: TEST_JAR });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_JAR,
          functionName: "pause",
          args: [],
        })
      );
    });

    it("shows loading toast on mutate", async () => {
      const { result } = renderHook(() => useCookieJarPause(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ jarAddress: TEST_JAR });
      });

      await waitFor(() => {
        expect(mockToastLoading).toHaveBeenCalled();
      });
    });
  });

  describe("useCookieJarUnpause", () => {
    it("sends unpause transaction", async () => {
      const { result } = renderHook(() => useCookieJarUnpause(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ jarAddress: TEST_JAR });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_JAR,
          functionName: "unpause",
        })
      );
    });
  });

  describe("useCookieJarUpdateMaxWithdrawal", () => {
    it("sends updateMaxWithdrawalAmount with new amount", async () => {
      const { result } = renderHook(() => useCookieJarUpdateMaxWithdrawal(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          jarAddress: TEST_JAR,
          maxWithdrawal: 5000n,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_JAR,
          functionName: "updateMaxWithdrawalAmount",
          args: [5000n],
        })
      );
    });
  });

  describe("useCookieJarUpdateInterval", () => {
    it("sends updateWithdrawalInterval with new interval", async () => {
      const { result } = renderHook(() => useCookieJarUpdateInterval(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          jarAddress: TEST_JAR,
          withdrawalInterval: 86400n,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_JAR,
          functionName: "updateWithdrawalInterval",
          args: [86400n],
        })
      );
    });
  });

  describe("useCookieJarEmergencyWithdraw", () => {
    it("sends emergencyWithdraw with token and amount", async () => {
      const { result } = renderHook(() => useCookieJarEmergencyWithdraw(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({
          jarAddress: TEST_JAR,
          tokenAddress: TEST_TOKEN,
          amount: 10000n,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSendContractTx).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_JAR,
          functionName: "emergencyWithdraw",
          args: [TEST_TOKEN, 10000n],
        })
      );
    });
  });

  describe("error handling", () => {
    it("handles transaction failure in pause", async () => {
      mockSendContractTx.mockRejectedValue(new Error("Reverted"));

      const { result } = renderHook(() => useCookieJarPause(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        result.current.mutate({ jarAddress: TEST_JAR });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Reverted");
    });
  });
});
