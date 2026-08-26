/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OCTANT_MODULE_ABI } from "../../../utils/blockchain/abis/octant";
import { YIELD_SPLITTER_ABI } from "../../../utils/blockchain/abis/yield";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const ASSET = "0x2222222222222222222222222222222222222222" as const;
const VAULT = "0x3333333333333333333333333333333333333333" as const;
const OCTANT = "0x4444444444444444444444444444444444444444" as const;
const SPLITTER = "0x5555555555555555555555555555555555555555" as const;
const HARVEST_HASH = `0x${"a".repeat(64)}` as const;
const SPLIT_HASH = `0x${"b".repeat(64)}` as const;

const mockSendContractCall = vi.fn();
const mockReadContract = vi.fn();
const mockGetReceipt = vi.fn();
const mockErrorHandler = vi.fn();
const mockTrackStarted = vi.fn();
const mockTrackHarvest = vi.fn();
const mockTrackDistribution = vi.fn();

const sender = {
  sendContractCall: mockSendContractCall,
  supportsSponsorship: false,
  supportsBatching: false,
  authMode: "wallet" as const,
};

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sender,
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("wagmi", () => ({
  useConfig: () => ({ chains: [] }),
}));

vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
  getTransactionReceipt: (...args: unknown[]) => mockGetReceipt(...args),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({ octantModule: OCTANT, yieldSplitter: SPLITTER }),
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockErrorHandler,
}));

vi.mock("../../../modules/app/harvestDistributionAnalytics", () => ({
  trackHarvestDistributionStarted: (...args: unknown[]) => mockTrackStarted(...args),
  trackHarvestDistributionHarvest: (...args: unknown[]) => mockTrackHarvest(...args),
  trackHarvestDistributionOutcome: (...args: unknown[]) => mockTrackDistribution(...args),
}));

const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

vi.mock("../../../components/toast", () => ({ toastService }));

const messages = {
  "app.yield.harvestDistribution.inProgress": "Completing yield distribution",
  "app.yield.harvestDistribution.success": "Yield distributed",
  "app.yield.harvestDistribution.waiting": "Yield harvested and waiting",
  "app.yield.harvestDistribution.submitted": "Transaction submitted",
  "app.yield.harvestDistribution.pending": "Distribution still pending",
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
}

function configureSnapshot({ shares = 10n, pending = 0n, converted = 10n, threshold = 7n } = {}) {
  mockReadContract.mockImplementation((_config: unknown, request: { functionName: string }) => {
    switch (request.functionName) {
      case "gardenShares":
        return shares;
      case "pendingYield":
        return pending;
      case "assetYieldThresholds":
        return 0n;
      case "minYieldThreshold":
        return threshold;
      case "gardenVaults":
        return VAULT;
      case "convertToAssets":
        return converted;
      default:
        throw new Error(`Unexpected read ${request.functionName}`);
    }
  });
}

function yieldSplitLog() {
  return {
    address: SPLITTER,
    topics: encodeEventTopics({
      abi: YIELD_SPLITTER_ABI,
      eventName: "YieldSplit",
      args: { garden: GARDEN, asset: ASSET },
    }),
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [4n, 4n, 2n, 10n]
    ),
  };
}

function yieldAccumulatedLog(totalPending: bigint) {
  return {
    address: SPLITTER,
    topics: encodeEventTopics({
      abi: YIELD_SPLITTER_ABI,
      eventName: "YieldAccumulated",
      args: { garden: GARDEN, asset: ASSET },
    }),
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [totalPending, totalPending]
    ),
  };
}

function harvestReportFailedLog() {
  return {
    address: OCTANT,
    topics: encodeEventTopics({
      abi: OCTANT_MODULE_ABI,
      eventName: "HarvestReportFailed",
      args: { garden: GARDEN, asset: ASSET },
    }),
    data: encodeAbiParameters([{ type: "address" }], [VAULT]),
  };
}

function sharesRegistrationFailedLog() {
  return {
    address: OCTANT,
    topics: encodeEventTopics({
      abi: OCTANT_MODULE_ABI,
      eventName: "SharesRegistrationFailed",
      args: { garden: GARDEN, vault: VAULT, resolver: SPLITTER },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [10n]),
  };
}

const { useHarvestDistribution } = await import("../../../hooks/yield/useHarvestDistribution");

describe("useHarvestDistribution", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps queued once-values; reset the queue so no test
    // depends on how many queued sends the previous test consumed.
    mockSendContractCall.mockReset();
    mockGetReceipt.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    configureSnapshot();
    mockSendContractCall
      .mockResolvedValueOnce({ hash: HARVEST_HASH, sponsored: false })
      .mockResolvedValueOnce({ hash: SPLIT_HASH, sponsored: false });
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      Promise.resolve(hash === HARVEST_HASH ? { logs: [] } : { logs: [yieldSplitLog()] })
    );
  });

  it("confirms harvest before sending splitYield and returns exact event amounts", async () => {
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ address: OCTANT, functionName: "harvest" })
    );
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: SPLITTER, functionName: "splitYield" })
    );
    expect(result.current.data).toEqual(
      expect.objectContaining({
        status: "distributed",
        amounts: {
          cookieJarAmount: 4n,
          fractionsAmount: 4n,
          treasuryAmount: 2n,
          totalAmount: 10n,
        },
      })
    );
    expect(mockTrackStarted).toHaveBeenCalledWith({
      chainId: 42161,
      assetSymbol: "DAI",
      authMode: "wallet",
      startedWithHarvest: true,
      hadPendingYield: false,
      thresholdMetBefore: false,
    });
    expect(JSON.stringify(mockTrackStarted.mock.calls)).not.toContain(GARDEN);
    expect(JSON.stringify(mockTrackStarted.mock.calls)).not.toContain(ASSET);
  });

  it("does not split when harvest fails", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockRejectedValueOnce(new Error("user rejected"));
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: GARDEN,
          assetAddress: ASSET,
          vaultAddress: VAULT,
          assetSymbol: "DAI",
          harvestFirst: true,
          hadPendingYield: false,
          thresholdMetBefore: false,
        })
      ).rejects.toThrow("user rejected");
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(mockErrorHandler).toHaveBeenCalled();
    // Workflow telemetry and error tracking must stay address-free.
    expect(JSON.stringify(mockErrorHandler.mock.calls)).not.toContain(GARDEN);
    expect(JSON.stringify(mockErrorHandler.mock.calls)).not.toContain(ASSET);
  });

  it("stops after a non-canonical Safe harvest submission", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockResolvedValueOnce({ hash: "safe-proposal-123", sponsored: false });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(result.current.data?.status).toBe("harvest_submitted");
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("stops after a non-canonical Safe distribution submission", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockResolvedValueOnce({ hash: "safe-proposal-456", sponsored: false });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: false,
        hadPendingYield: true,
        thresholdMetBefore: true,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "splitYield" })
    );
    expect(result.current.data?.status).toBe("distribution_submitted");
  });

  it("treats a standalone split failure as an error, not confirmed-harvest partial success", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockRejectedValueOnce(new Error("split reverted"));
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: GARDEN,
          assetAddress: ASSET,
          vaultAddress: VAULT,
          assetSymbol: "DAI",
          harvestFirst: false,
          hadPendingYield: true,
          thresholdMetBefore: true,
        })
      ).rejects.toThrow("split reverted");
    });

    expect(result.current.data).toBeUndefined();
    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("reports waiting and does not split below the effective threshold", async () => {
    configureSnapshot({ shares: 2n, converted: 2n, threshold: 7n });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(
      expect.objectContaining({ status: "waiting", availableAmount: 2n, threshold: 7n })
    );
  });

  it("preserves partial success and retries distribution without harvesting again", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall
      .mockResolvedValueOnce({ hash: HARVEST_HASH, sponsored: false })
      .mockRejectedValueOnce(new Error("split reverted"))
      .mockResolvedValueOnce({ hash: SPLIT_HASH, sponsored: false });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });
    const base = {
      gardenAddress: GARDEN,
      assetAddress: ASSET,
      vaultAddress: VAULT,
      assetSymbol: "DAI",
      hadPendingYield: false,
      thresholdMetBefore: false,
    };

    await act(async () => {
      await result.current.mutateAsync({ ...base, harvestFirst: true });
    });
    expect(result.current.data?.status).toBe("distribution_pending");

    await act(async () => {
      await result.current.mutateAsync({ ...base, harvestFirst: false });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(3);
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ functionName: "splitYield" })
    );
    await waitFor(() => expect(result.current.data?.status).toBe("distributed"));
  });

  it("reports waiting when the split accumulates below the threshold instead of splitting", async () => {
    // splitYield() emits YieldAccumulated (no YieldSplit) when redemption
    // limits leave the total below the threshold; that is not a distribution.
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      Promise.resolve(hash === HARVEST_HASH ? { logs: [] } : { logs: [yieldAccumulatedLog(5n)] })
    );
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(result.current.data).toEqual(
      expect.objectContaining({
        status: "waiting",
        availableAmount: 5n,
        threshold: 7n,
        harvested: true,
      })
    );
    expect(mockTrackDistribution).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "waiting" })
    );
  });

  it("preserves a confirmed split when the receipt cannot be read after harvesting", async () => {
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      hash === HARVEST_HASH
        ? Promise.resolve({ logs: [] })
        : Promise.reject(new Error("rpc unavailable"))
    );
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(result.current.data).toEqual({
      status: "split_unverified",
      hash: SPLIT_HASH,
      harvested: true,
    });
  });

  it("preserves a confirmed standalone split when the receipt cannot be read", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockResolvedValueOnce({ hash: SPLIT_HASH, sponsored: false });
    mockGetReceipt.mockRejectedValue(new Error("rpc unavailable"));
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: false,
        hadPendingYield: true,
        thresholdMetBefore: true,
      });
    });

    // The split confirmed on-chain, so this must not become a retryable
    // distribution_pending (a retry could double-submit the split).
    expect(result.current.data).toEqual({
      status: "split_unverified",
      hash: SPLIT_HASH,
      harvested: false,
    });
  });

  it("surfaces a swallowed harvest report failure instead of distributing", async () => {
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      Promise.resolve(
        hash === HARVEST_HASH ? { logs: [harvestReportFailedLog()] } : { logs: [yieldSplitLog()] }
      )
    );
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({
      status: "harvest_incomplete",
      hash: HARVEST_HASH,
      failure: "report_failed",
    });
    expect(mockTrackHarvest).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", errorCategory: "harvest_report_failed" })
    );
  });

  it("stops as harvest_incomplete when the harvest receipt cannot be inspected", async () => {
    // Failure events are the only signal a harvest silently failed, so an
    // unreadable receipt must stop the workflow rather than proceed fail-open.
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      hash === HARVEST_HASH
        ? Promise.reject(new Error("rpc unavailable"))
        : Promise.resolve({ logs: [yieldSplitLog()] })
    );
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({
      status: "harvest_incomplete",
      hash: HARVEST_HASH,
      failure: "unverifiable",
    });
  });

  it("keeps an eventless confirmed split retryable after a confirmed harvest", async () => {
    // A readable receipt with neither YieldSplit nor YieldAccumulated means
    // the inner call reverted (e.g. inside a successful UserOperation). The
    // empty harvest receipt carries no failure events, so the harvest stage
    // still confirms.
    mockGetReceipt.mockResolvedValue({ logs: [] });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(result.current.data).toEqual(
      expect.objectContaining({ status: "distribution_pending", harvested: true })
    );
  });

  it("treats an eventless standalone split as a failure, not an unverified success", async () => {
    mockSendContractCall.mockReset();
    mockSendContractCall.mockResolvedValueOnce({ hash: SPLIT_HASH, sponsored: false });
    mockGetReceipt.mockResolvedValue({ logs: [] });
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          gardenAddress: GARDEN,
          assetAddress: ASSET,
          vaultAddress: VAULT,
          assetSymbol: "DAI",
          harvestFirst: false,
          hadPendingYield: true,
          thresholdMetBefore: true,
        })
      ).rejects.toThrow(/splitYield did not execute/);
    });

    expect(result.current.data).toBeUndefined();
    expect(mockErrorHandler).toHaveBeenCalled();
  });

  it("surfaces a swallowed shares registration failure instead of distributing", async () => {
    mockGetReceipt.mockImplementation((_config: unknown, { hash }: { hash: string }) =>
      Promise.resolve(
        hash === HARVEST_HASH
          ? { logs: [sharesRegistrationFailedLog()] }
          : { logs: [yieldSplitLog()] }
      )
    );
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({
      status: "harvest_incomplete",
      hash: HARVEST_HASH,
      failure: "registration_failed",
    });
  });

  it("invalidates direct reads plus vault, yield, and Cookie Jar state", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useHarvestDistribution(), {
      wrapper: wrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: GARDEN,
        assetAddress: ASSET,
        vaultAddress: VAULT,
        assetSymbol: "DAI",
        harvestFirst: true,
        hadPendingYield: false,
        thresholdMetBefore: false,
      });
    });

    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["readContract"] })
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["readContracts"] })
    );
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["balance"] }));
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(["greengoods", "yield"]) })
    );
  });
});
