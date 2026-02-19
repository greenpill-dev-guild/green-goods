/**
 * Prefetch Utility Tests
 * @vitest-environment jsdom
 *
 * Tests the ensureBaseLists and ensureHomeData prefetch functions.
 * These use the module-level queryClient to warm the cache with
 * actions, gardens, and gardeners data.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

const mockEnsureQueryData = vi.fn();

vi.mock("../../../config/react-query", () => ({
  queryClient: {
    ensureQueryData: (...args: unknown[]) => mockEnsureQueryData(...args),
  },
}));

const mockGetActions = vi.fn();
const mockGetGardens = vi.fn();
const mockGetGardeners = vi.fn();

vi.mock("../../../modules/data/greengoods", () => ({
  getActions: () => mockGetActions(),
  getGardens: () => mockGetGardens(),
  getGardeners: () => mockGetGardeners(),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { ensureBaseLists, ensureHomeData } from "../../../hooks/blockchain/prefetch";

// ============================================
// Tests
// ============================================

describe("prefetch utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureQueryData.mockImplementation((opts: { queryFn: () => Promise<unknown> }) => {
      return opts.queryFn();
    });
  });

  // ------------------------------------------
  // ensureBaseLists
  // ------------------------------------------

  describe("ensureBaseLists", () => {
    it("calls ensureQueryData for actions, gardens, and gardeners", () => {
      ensureBaseLists();

      expect(mockEnsureQueryData).toHaveBeenCalledTimes(3);
    });

    it("uses correct query keys for default chain ID", () => {
      ensureBaseLists();

      const calls = mockEnsureQueryData.mock.calls;

      // Actions query key
      expect(calls[0][0].queryKey).toEqual(["greengoods", "actions", 11155111]);
      // Gardens query key
      expect(calls[1][0].queryKey).toEqual(["greengoods", "gardens", 11155111]);
      // Gardeners query key
      expect(calls[2][0].queryKey).toEqual(["greengoods", "gardeners"]);
    });

    it("uses provided chain ID for actions and gardens", () => {
      ensureBaseLists(42161);

      const calls = mockEnsureQueryData.mock.calls;

      expect(calls[0][0].queryKey).toEqual(["greengoods", "actions", 42161]);
      expect(calls[1][0].queryKey).toEqual(["greengoods", "gardens", 42161]);
      // Gardeners key is not chain-scoped
      expect(calls[2][0].queryKey).toEqual(["greengoods", "gardeners"]);
    });

    it("returns three promises for each data type", () => {
      mockGetActions.mockResolvedValue([]);
      mockGetGardens.mockResolvedValue([]);
      mockGetGardeners.mockResolvedValue([]);

      const result = ensureBaseLists();

      expect(result).toHaveProperty("actionsPromise");
      expect(result).toHaveProperty("gardensPromise");
      expect(result).toHaveProperty("gardenersPromise");
    });

    it("invokes the correct fetch functions", () => {
      mockGetActions.mockResolvedValue([]);
      mockGetGardens.mockResolvedValue([]);
      mockGetGardeners.mockResolvedValue([]);

      ensureBaseLists();

      expect(mockGetActions).toHaveBeenCalled();
      expect(mockGetGardens).toHaveBeenCalled();
      expect(mockGetGardeners).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // ensureHomeData
  // ------------------------------------------

  describe("ensureHomeData", () => {
    it("resolves all three data arrays", async () => {
      const actions = [{ id: "action-1" }];
      const gardens = [{ id: "garden-1" }];
      const gardeners = [{ id: "gardener-1" }];

      mockGetActions.mockResolvedValue(actions);
      mockGetGardens.mockResolvedValue(gardens);
      mockGetGardeners.mockResolvedValue(gardeners);

      const result = await ensureHomeData();

      expect(result.actions).toEqual(actions);
      expect(result.gardens).toEqual(gardens);
      expect(result.gardeners).toEqual(gardeners);
    });

    it("accepts a custom chain ID", async () => {
      mockGetActions.mockResolvedValue([]);
      mockGetGardens.mockResolvedValue([]);
      mockGetGardeners.mockResolvedValue([]);

      await ensureHomeData(42161);

      const calls = mockEnsureQueryData.mock.calls;
      expect(calls[0][0].queryKey).toEqual(["greengoods", "actions", 42161]);
      expect(calls[1][0].queryKey).toEqual(["greengoods", "gardens", 42161]);
    });

    it("propagates errors from underlying fetchers", async () => {
      mockGetActions.mockRejectedValue(new Error("Indexer down"));
      mockGetGardens.mockResolvedValue([]);
      mockGetGardeners.mockResolvedValue([]);

      await expect(ensureHomeData()).rejects.toThrow("Indexer down");
    });

    it("returns empty arrays when API returns no data", async () => {
      mockGetActions.mockResolvedValue([]);
      mockGetGardens.mockResolvedValue([]);
      mockGetGardeners.mockResolvedValue([]);

      const result = await ensureHomeData();

      expect(result.actions).toEqual([]);
      expect(result.gardens).toEqual([]);
      expect(result.gardeners).toEqual([]);
    });
  });
});
