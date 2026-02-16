/**
 * Conviction Voting Mutation Hook Tests
 * @vitest-environment jsdom
 *
 * Tests mutation hooks (write operations) and error paths for query hooks.
 * Covers: useSetConvictionStrategies, useAllocateHypercertSupport,
 * useRegisterHypercert, useDeregisterHypercert, useSetDecay,
 * useSetPointsPerVoter, useSetRoleHatIds, plus error paths for
 * the subgraph-backed query hooks.
 *
 * After the RPC → subgraph refactor:
 * - Mutation hooks still use contract writes (wagmi writeContractAsync)
 * - Query hooks now delegate to modules/data/gardens.ts (subgraph queries)
 * - Query invalidation after mutations triggers subgraph refetch
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_POOL = "0x1111111111111111111111111111111111111111";
const TEST_VOTER = "0x2222222222222222222222222222222222222222";
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_HATS_MODULE = "0x4444444444444444444444444444444444444444";
const TEST_STRATEGY = "0x5555555555555555555555555555555555555555";
const TEST_COMMUNITY = "0x7777777777777777777777777777777777777777";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

// --- Mocks ---

const mockWriteContractAsync = vi.fn();
const mockCreateMutationErrorHandler = vi.fn();
const mockErrorHandler = vi.fn();
const mockFetchHatsModuleAddress = vi.fn();

// Mock subgraph data functions (used by query hooks imported here)
const mockGetMemberPower = vi.fn();
const mockGetConvictionWeights = vi.fn();
const mockGetRegisteredHypercerts = vi.fn();
const mockGetConvictionStrategies = vi.fn();

vi.mock("../../../modules/data/gardens", () => ({
  getMemberPowerFromSubgraph: (...args: unknown[]) => mockGetMemberPower(...args),
  getConvictionWeightsFromSubgraph: (...args: unknown[]) => mockGetConvictionWeights(...args),
  getRegisteredHypercertsFromSubgraph: (...args: unknown[]) => mockGetRegisteredHypercerts(...args),
  getConvictionStrategiesFromSubgraph: (...args: unknown[]) => mockGetConvictionStrategies(...args),
}));

const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

const mockUser = {
  authMode: "wallet" as string,
  smartAccountClient: null as unknown,
  primaryAddress: TEST_VOTER,
};

vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
  }),
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => mockUser,
}));

vi.mock("../../../components/toast", () => ({
  toastService,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: (...args: unknown[]) => {
    mockCreateMutationErrorHandler(...args);
    return mockErrorHandler;
  },
}));

vi.mock("../../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: (...args: unknown[]) => mockFetchHatsModuleAddress(...args),
}));

vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender:
    () => (request: { address: string; abi: unknown; functionName: string; args: unknown[] }) => {
      // Respect passkey auth mode for passkey path testing
      if (mockUser.authMode === "passkey" && mockUser.smartAccountClient) {
        const client = mockUser.smartAccountClient as {
          account: { address: string };
          chain: { id: number };
          sendTransaction: (...args: unknown[]) => Promise<string>;
        };
        return client.sendTransaction({
          account: client.account,
          chain: client.chain,
          to: request.address,
          value: 0n,
          data: "0xencoded",
        });
      }
      return mockWriteContractAsync({
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
      });
    },
}));

vi.mock("../../../utils/blockchain/address", () => ({
  normalizeAddress: (addr: string) => addr.toLowerCase(),
}));

// i18n messages used by conviction hooks
const messages: Record<string, string> = {
  "app.conviction.saving": "Updating strategies...",
  "app.conviction.saveSuccess": "Conviction strategies updated",
  "app.conviction.settingDecay": "Updating decay rate...",
  "app.conviction.setDecaySuccess": "Decay rate updated",
  "app.conviction.settingPointsPerVoter": "Updating points per voter...",
  "app.conviction.setPointsPerVoterSuccess": "Points per voter updated",
  "app.conviction.settingRoleHatIds": "Updating role hat IDs...",
  "app.conviction.setRoleHatIdsSuccess": "Role hat IDs updated",
  "app.signal.allocating": "Allocating support...",
  "app.signal.allocateSuccess": "Support allocation updated",
  "app.signal.registering": "Registering hypercert...",
  "app.signal.registerSuccess": "Hypercert registered",
  "app.signal.removing": "Removing hypercert...",
  "app.signal.removeSuccess": "Hypercert removed",
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
  };
}

// Dynamic imports after mocks
const { useSetConvictionStrategies } = await import(
  "../../../hooks/conviction/useSetConvictionStrategies"
);
const { useAllocateHypercertSupport } = await import(
  "../../../hooks/conviction/useAllocateHypercertSupport"
);
const { useRegisterHypercert } = await import("../../../hooks/conviction/useRegisterHypercert");
const { useDeregisterHypercert } = await import("../../../hooks/conviction/useDeregisterHypercert");
const { useSetDecay } = await import("../../../hooks/conviction/useSetDecay");
const { useSetPointsPerVoter } = await import("../../../hooks/conviction/useSetPointsPerVoter");
const { useSetRoleHatIds } = await import("../../../hooks/conviction/useSetRoleHatIds");
const { useMemberVotingPower } = await import("../../../hooks/conviction/useMemberVotingPower");
const { useHypercertConviction } = await import("../../../hooks/conviction/useHypercertConviction");
const { useRegisteredHypercerts } = await import(
  "../../../hooks/conviction/useRegisteredHypercerts"
);
const { useConvictionStrategies } = await import(
  "../../../hooks/conviction/useConvictionStrategies"
);

import type { Address } from "../../../types/domain";

// ============================================
// Mutation Hook Tests
// ============================================

describe("useSetConvictionStrategies", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends setConvictionStrategies tx through HatsModule", async () => {
    mockFetchHatsModuleAddress.mockResolvedValueOnce(TEST_HATS_MODULE);
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useSetConvictionStrategies(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        strategies: [TEST_STRATEGY as Address],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify it looked up the HatsModule
    expect(mockFetchHatsModuleAddress).toHaveBeenCalledWith(
      TEST_GARDEN.toLowerCase(),
      TEST_CHAIN_ID
    );

    // Verify the contract call targeted the HatsModule
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_HATS_MODULE,
        functionName: "setConvictionStrategies",
      })
    );

    // Verify toast lifecycle
    expect(toastService.loading).toHaveBeenCalled();
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(toastService.success).toHaveBeenCalled();
  });

  it("throws when garden has no HatsModule configured", async () => {
    mockFetchHatsModuleAddress.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useSetConvictionStrategies(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        strategies: [TEST_STRATEGY as Address],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Hats module is not configured for this garden");
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("normalizes garden and strategy addresses", async () => {
    const mixedCaseGarden = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const mixedCaseStrategy = "0x9876543210aBcDeF9876543210aBcDeF98765432";

    mockFetchHatsModuleAddress.mockResolvedValueOnce(TEST_HATS_MODULE);
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useSetConvictionStrategies(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: mixedCaseGarden as Address,
        strategies: [mixedCaseStrategy as Address],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // HatsModule lookup should use normalized address
    expect(mockFetchHatsModuleAddress).toHaveBeenCalledWith(
      mixedCaseGarden.toLowerCase(),
      TEST_CHAIN_ID
    );

    // Contract call args include normalized (lowercased) addresses
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setConvictionStrategies",
        args: [mixedCaseGarden.toLowerCase(), [mixedCaseStrategy.toLowerCase()]],
      })
    );
  });

  it("invalidates conviction strategy queries on success", async () => {
    mockFetchHatsModuleAddress.mockResolvedValueOnce(TEST_HATS_MODULE);
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetConvictionStrategies(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        strategies: [TEST_STRATEGY as Address],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction", "strategies"]),
      })
    );
  });
});

describe("useAllocateHypercertSupport", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends allocateSupport tx to pool address", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useAllocateHypercertSupport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        poolAddress: TEST_POOL as Address,
        signals: [{ hypercertId: 1n, deltaSupport: 50n }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_POOL,
        functionName: "allocateSupport",
        args: [[{ hypercertId: 1n, deltaSupport: 50n }]],
      })
    );
  });

  it("invalidates voter-level queries when primaryAddress is available", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAllocateHypercertSupport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        poolAddress: TEST_POOL as Address,
        signals: [{ hypercertId: 1n, deltaSupport: 50n }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should invalidate voter-level keys (convictionWeights, memberPower)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction", "memberPower"]),
      })
    );
  });

  it("still invalidates conviction queries when primaryAddress is null", async () => {
    mockUser.primaryAddress = null as unknown as string;
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAllocateHypercertSupport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        poolAddress: TEST_POOL as Address,
        signals: [{ hypercertId: 1n, deltaSupport: 50n }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should still invalidate conviction queries (convictionWeights and memberPower)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction"]),
      })
    );
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("user rejected"));

    const { result } = renderHook(() => useAllocateHypercertSupport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        poolAddress: TEST_POOL as Address,
        signals: [{ hypercertId: 1n, deltaSupport: 50n }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        metadata: expect.objectContaining({ poolAddress: TEST_POOL }),
      })
    );
  });

  it("routes through smartAccountClient when authMode is passkey", async () => {
    const mockSendTransaction = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockUser.authMode = "passkey";
    mockUser.smartAccountClient = {
      account: { address: TEST_VOTER },
      chain: { id: TEST_CHAIN_ID },
      sendTransaction: mockSendTransaction,
    };

    const { result } = renderHook(() => useAllocateHypercertSupport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        poolAddress: TEST_POOL as Address,
        signals: [{ hypercertId: 1n, deltaSupport: 100n }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should NOT use writeContractAsync (wallet path)
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
    // Should route through smart account
    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_POOL,
        value: 0n,
      })
    );
  });
});

describe("useRegisterHypercert", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends registerHypercert tx", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useRegisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hypercertId: 42n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_POOL,
        functionName: "registerHypercert",
        args: [42n],
      })
    );
  });

  it("passes pool address through to cache invalidation", async () => {
    const poolAddress = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf99";
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRegisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: poolAddress as Address, hypercertId: 1n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify invalidation uses lowercase address
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([poolAddress.toLowerCase()]),
      })
    );
  });

  it("calls error handler on failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("tx failed"));

    const { result } = renderHook(() => useRegisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hypercertId: 1n });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockErrorHandler).toHaveBeenCalled();
  });
});

describe("useDeregisterHypercert", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends deregisterHypercert tx", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useDeregisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hypercertId: 99n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deregisterHypercert",
        args: [99n],
      })
    );
  });

  it("passes pool address through to cache invalidation", async () => {
    const poolAddress = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf88";
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeregisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: poolAddress as Address, hypercertId: 1n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify invalidation uses lowercase address
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([poolAddress.toLowerCase()]),
      })
    );
  });
});

describe("useSetDecay", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends setDecay tx and invalidates pool config queries", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetDecay(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, newDecay: 950000n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setDecay",
        args: [950000n],
      })
    );

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction", "convictionWeights"]),
      })
    );
  });
});

describe("useSetPointsPerVoter", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends setPointsPerVoter tx", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useSetPointsPerVoter(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, newPoints: 500n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setPointsPerVoter",
        args: [500n],
      })
    );
  });
});

describe("useSetRoleHatIds", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends setRoleHatIds tx", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useSetRoleHatIds(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hatIds: [1n, 2n, 3n] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setRoleHatIds",
        args: [[1n, 2n, 3n]],
      })
    );
  });
});

// ============================================
// Query Hook Error Path Tests (subgraph-based)
// ============================================

describe("Query hooks — subgraph error paths", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("useMemberVotingPower returns isError when subgraph query fails", async () => {
    mockGetMemberPower.mockRejectedValueOnce(new Error("Subgraph unavailable"));

    const { result } = renderHook(
      () => useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.power).toEqual({
      totalStake: 0n,
      pointsBudget: 0n,
      isEligible: false,
      allocations: [],
    });
  });

  it("useHypercertConviction returns isError when subgraph query fails", async () => {
    mockGetConvictionWeights.mockRejectedValueOnce(new Error("Subgraph timeout"));

    const { result } = renderHook(() => useHypercertConviction(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.weights).toEqual([]);
  });

  it("useRegisteredHypercerts returns isError when subgraph query fails", async () => {
    mockGetRegisteredHypercerts.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRegisteredHypercerts(TEST_POOL as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hypercertIds).toEqual([]);
  });

  it("useConvictionStrategies returns isError when subgraph query fails", async () => {
    mockGetConvictionStrategies.mockRejectedValueOnce(new Error("Subgraph error"));

    const { result } = renderHook(
      () => useConvictionStrategies(TEST_GARDEN as Address, TEST_COMMUNITY as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.strategies).toEqual([]);
  });

  it("useMemberVotingPower returns correct data on success", async () => {
    mockGetMemberPower.mockResolvedValueOnce({
      totalStake: 100n,
      pointsBudget: 500n,
      isEligible: true,
      allocations: [],
    });

    const { result } = renderHook(
      () => useMemberVotingPower(TEST_POOL as Address, TEST_VOTER as Address),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.power.isEligible).toBe(true);
    expect(result.current.power.totalStake).toBe(100n);
  });
});

// ============================================
// Additional Mutation Error/Invalidation Tests
// ============================================

describe("useSetDecay — error path", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("tx reverted"));

    const { result } = renderHook(() => useSetDecay(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, newDecay: 950000n });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        metadata: expect.objectContaining({ poolAddress: TEST_POOL }),
      })
    );
  });
});

describe("useSetPointsPerVoter — error path and invalidation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("gas estimation failed"));

    const { result } = renderHook(() => useSetPointsPerVoter(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, newPoints: 500n });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("invalidates pool config queries on success", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetPointsPerVoter(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, newPoints: 1000n });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction", "convictionWeights"]),
      })
    );
  });
});

describe("useSetRoleHatIds — error path and invalidation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("unauthorized"));

    const { result } = renderHook(() => useSetRoleHatIds(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hatIds: [1n, 2n] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("invalidates pool config queries on success", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetRoleHatIds(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hatIds: [10n, 20n] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "conviction"]),
      })
    );
  });
});

describe("useDeregisterHypercert — error path", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    mockUser.primaryAddress = TEST_VOTER;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("tx failed"));

    const { result } = renderHook(() => useDeregisterHypercert(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ poolAddress: TEST_POOL as Address, hypercertId: 42n });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        metadata: expect.objectContaining({ poolAddress: TEST_POOL }),
      })
    );
  });
});
