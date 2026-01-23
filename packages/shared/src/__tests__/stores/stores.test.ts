/**
 * Zustand Stores Tests
 *
 * Tests for useWorkFlowStore, useUIStore, and useAdminStore.
 * Focuses on core state management and actions.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminStore } from "../../stores/useAdminStore";
import { useUIStore } from "../../stores/useUIStore";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";

// ============================================================================
// useWorkFlowStore Tests
// ============================================================================

describe("stores/useWorkFlowStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkFlowStore.getState().reset();

    // Mock URL object methods
    global.URL.createObjectURL = vi.fn(() => "blob:test-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("has correct default values", () => {
      const state = useWorkFlowStore.getState();

      expect(state.activeTab).toBe(WorkTab.Intro);
      expect(state.submissionCompleted).toBe(false);
      expect(state.gardenAddress).toBeNull();
      expect(state.actionUID).toBeNull();
      expect(state.feedback).toBe("");
      expect(state.plantSelection).toEqual([]);
      expect(state.plantCount).toBeUndefined();
      expect(state.images).toEqual([]);
      expect(state.imageObjectUrls).toEqual([]);
    });
  });

  describe("tab navigation", () => {
    it("sets active tab", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setActiveTab(WorkTab.Media);
      });

      expect(result.current.activeTab).toBe(WorkTab.Media);
    });
  });

  describe("form data", () => {
    it("sets garden address", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setGardenAddress("0x123");
      });

      expect(result.current.gardenAddress).toBe("0x123");
    });

    it("sets action UID", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setActionUID(42);
      });

      expect(result.current.actionUID).toBe(42);
    });

    it("sets feedback", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setFeedback("Great work!");
      });

      expect(result.current.feedback).toBe("Great work!");
    });

    it("sets plant selection", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setPlantSelection(["Rose", "Tulip"]);
      });

      expect(result.current.plantSelection).toEqual(["Rose", "Tulip"]);
    });

    it("sets plant count", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.setPlantCount(5);
      });

      expect(result.current.plantCount).toBe(5);
    });

    it("sets images", () => {
      const { result } = renderHook(() => useWorkFlowStore());
      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

      act(() => {
        result.current.setImages([mockFile]);
      });

      expect(result.current.images).toHaveLength(1);
      expect(result.current.images[0]).toBe(mockFile);
    });
  });

  describe("image URL management", () => {
    it("registers and tracks image URLs", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.registerImageUrl("blob:test-url-1");
        result.current.registerImageUrl("blob:test-url-2");
      });

      expect(result.current.imageObjectUrls).toEqual(["blob:test-url-1", "blob:test-url-2"]);
    });

    it("revokes and removes image URL", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      act(() => {
        result.current.registerImageUrl("blob:test-url-1");
        result.current.registerImageUrl("blob:test-url-2");
        result.current.revokeImageUrl("blob:test-url-1");
      });

      expect(result.current.imageObjectUrls).toEqual(["blob:test-url-2"]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url-1");
    });
  });

  describe("reset", () => {
    it("resets all state to defaults and revokes URLs", () => {
      const { result } = renderHook(() => useWorkFlowStore());

      // Set some state
      act(() => {
        result.current.setActiveTab(WorkTab.Review);
        result.current.setGardenAddress("0x123");
        result.current.setActionUID(42);
        result.current.setFeedback("Test");
        result.current.setSubmissionCompleted(true);
        result.current.registerImageUrl("blob:test-url");
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.activeTab).toBe(WorkTab.Intro);
      expect(result.current.gardenAddress).toBeNull();
      expect(result.current.actionUID).toBeNull();
      expect(result.current.feedback).toBe("");
      expect(result.current.submissionCompleted).toBe(false);
      expect(result.current.imageObjectUrls).toEqual([]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    });
  });
});

// ============================================================================
// useUIStore Tests
// ============================================================================

describe("stores/useUIStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      isOfflineBannerVisible: false,
      isWorkDashboardOpen: false,
      isGardenFilterOpen: false,
      sidebarOpen: false,
      debugMode: false,
    });
  });

  describe("offline banner", () => {
    it("toggles offline banner visibility", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.isOfflineBannerVisible).toBe(false);

      act(() => {
        result.current.setOfflineBannerVisible(true);
      });

      expect(result.current.isOfflineBannerVisible).toBe(true);

      act(() => {
        result.current.setOfflineBannerVisible(false);
      });

      expect(result.current.isOfflineBannerVisible).toBe(false);
    });
  });

  describe("work dashboard", () => {
    it("opens work dashboard", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.openWorkDashboard();
      });

      expect(result.current.isWorkDashboardOpen).toBe(true);
    });

    it("closes work dashboard", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.openWorkDashboard();
        result.current.closeWorkDashboard();
      });

      expect(result.current.isWorkDashboardOpen).toBe(false);
    });
  });

  describe("sidebar", () => {
    it("sets sidebar open state", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarOpen(true);
      });

      expect(result.current.sidebarOpen).toBe(true);
    });

    it("toggles sidebar", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarOpen).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarOpen).toBe(false);
    });
  });

  describe("debug mode", () => {
    it("has debug mode disabled by default", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.debugMode).toBe(false);
    });

    it("sets debug mode on", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setDebugMode(true);
      });

      expect(result.current.debugMode).toBe(true);
    });

    it("sets debug mode off", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setDebugMode(true);
        result.current.setDebugMode(false);
      });

      expect(result.current.debugMode).toBe(false);
    });

    it("toggles debug mode", () => {
      const { result } = renderHook(() => useUIStore());

      expect(result.current.debugMode).toBe(false);

      act(() => {
        result.current.toggleDebugMode();
      });

      expect(result.current.debugMode).toBe(true);

      act(() => {
        result.current.toggleDebugMode();
      });

      expect(result.current.debugMode).toBe(false);
    });
  });
});

// ============================================================================
// useAdminStore Tests
// ============================================================================

describe("stores/useAdminStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAdminStore.setState({
      selectedChainId: 84532,
      selectedGarden: null,
      pendingTransactions: {},
      lastAttestationId: null,
    });
  });

  describe("chain management", () => {
    it("sets selected chain ID", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.setSelectedChainId(42161);
      });

      expect(result.current.selectedChainId).toBe(42161);
    });
  });

  describe("garden management", () => {
    it("sets selected garden", () => {
      const { result } = renderHook(() => useAdminStore());
      const mockGarden = {
        id: "0x123",
        chainId: 84532,
        tokenAddress: "0x456",
        tokenID: 1n,
        name: "Test Garden",
        description: "A test garden",
        location: "Test Location",
        bannerImage: "https://example.com/banner.jpg",
        createdAt: Date.now(),
        gardeners: ["0x789"],
        operators: ["0xabc"],
      };

      act(() => {
        result.current.setSelectedGarden(mockGarden);
      });

      expect(result.current.selectedGarden).toEqual(mockGarden);
    });

    it("clears selected garden", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.setSelectedGarden({
          id: "0x123",
          chainId: 84532,
          tokenAddress: "0x456",
          tokenID: 1n,
          name: "Test",
          description: "",
          location: "",
          bannerImage: "",
          createdAt: 0,
          gardeners: [],
          operators: [],
        });
        result.current.setSelectedGarden(null);
      });

      expect(result.current.selectedGarden).toBeNull();
    });
  });

  describe("transaction tracking", () => {
    it("adds pending transaction", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.addPendingTransaction("0xtx1", "addGardener");
      });

      expect(result.current.pendingTransactions["0xtx1"]).toEqual({
        type: "addGardener",
        status: "pending",
      });
    });

    it("updates transaction status", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.addPendingTransaction("0xtx1", "addGardener");
        result.current.updateTransactionStatus("0xtx1", "confirmed");
      });

      expect(result.current.pendingTransactions["0xtx1"].status).toBe("confirmed");
    });

    it("removes transaction", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.addPendingTransaction("0xtx1", "addGardener");
        result.current.addPendingTransaction("0xtx2", "removeGardener");
        result.current.removeTransaction("0xtx1");
      });

      expect(result.current.pendingTransactions["0xtx1"]).toBeUndefined();
      expect(result.current.pendingTransactions["0xtx2"]).toBeDefined();
    });

    it("clears all pending transactions", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.addPendingTransaction("0xtx1", "addGardener");
        result.current.addPendingTransaction("0xtx2", "removeGardener");
        result.current.clearPendingTransactions();
      });

      expect(result.current.pendingTransactions).toEqual({});
    });

    it("ignores status update for non-existent transaction", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.updateTransactionStatus("0xnonexistent", "confirmed");
      });

      expect(result.current.pendingTransactions["0xnonexistent"]).toBeUndefined();
    });
  });

  describe("attestation tracking", () => {
    it("sets last attestation ID", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.setLastAttestationId("0xattestation123");
      });

      expect(result.current.lastAttestationId).toBe("0xattestation123");
    });

    it("clears last attestation ID", () => {
      const { result } = renderHook(() => useAdminStore());

      act(() => {
        result.current.setLastAttestationId("0xattestation123");
        result.current.setLastAttestationId(null);
      });

      expect(result.current.lastAttestationId).toBeNull();
    });
  });
});
