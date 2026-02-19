/**
 * useGardenDraft Tests
 *
 * Tests IDB-backed garden creation draft persistence: save, load, peek, clear,
 * key generation, meaningful progress detection, and Zustand store integration.
 *
 * Uses fake-indexeddb from setupTests.base.
 */

/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { get as idbGet, clear as idbClear } from "idb-keyval";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks (must be before imports)
// ============================================

const mockFormState = {
  name: "",
  slug: "",
  description: "",
  location: "",
  bannerImage: "",
  metadata: "",
  openJoining: false,
  gardeners: [],
  operators: [],
};

let mockStoreState = {
  form: { ...mockFormState },
  currentStep: 0,
};

const mockSetState = vi.fn();
const mockGetState = vi.fn(() => mockStoreState);
const mockSubscribe = vi.fn(() => vi.fn()); // returns unsubscribe

vi.mock("../../../stores/useCreateGardenStore", () => ({
  useCreateGardenStore: Object.assign(vi.fn(), {
    setState: (...args: unknown[]) => mockSetState(...args),
    getState: () => mockGetState(),
    subscribe: (listener: any) => mockSubscribe(listener),
  }),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackStorageError: vi.fn(),
}));

// ============================================
// Import after mocks
// ============================================

import { useGardenDraft } from "../../../hooks/garden/useGardenDraft";

// ============================================
// Test Helpers
// ============================================

const OPERATOR_ADDR = "0x2222222222222222222222222222222222222222";

function withProgress() {
  mockStoreState = {
    form: {
      ...mockFormState,
      name: "My Garden",
      slug: "my-garden",
      description: "A community garden",
    },
    currentStep: 1,
  };
}

function withoutProgress() {
  mockStoreState = {
    form: { ...mockFormState },
    currentStep: 0,
  };
}

// ============================================
// Tests
// ============================================

describe("useGardenDraft", () => {
  beforeEach(async () => {
    await idbClear();
    withoutProgress();
    vi.clearAllMocks();
    mockGetState.mockImplementation(() => mockStoreState);
  });

  afterEach(async () => {
    await idbClear();
  });

  // ------------------------------------------
  // Draft key generation
  // ------------------------------------------

  describe("draftKey", () => {
    it("returns correct key when operatorAddress provided", () => {
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      expect(result.current.draftKey).toBe(`garden_draft_${OPERATOR_ADDR}`);
    });

    it("returns null when operatorAddress is missing", () => {
      const { result } = renderHook(() => useGardenDraft(undefined));

      expect(result.current.draftKey).toBeNull();
    });
  });

  // ------------------------------------------
  // Save
  // ------------------------------------------

  describe("saveDraft", () => {
    it("saves draft to IDB when form has meaningful progress", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft();
      });

      expect(savedDraft).not.toBeNull();
      expect(savedDraft.operatorAddress).toBe(OPERATOR_ADDR);
      expect(savedDraft.form.name).toBe("My Garden");
      expect(savedDraft.currentStep).toBe(1);
      expect(result.current.lastSavedAt).toBeGreaterThan(0);
    });

    it("skips saving when no meaningful progress", async () => {
      withoutProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft();
      });

      expect(savedDraft).toBeNull();
    });

    it("returns null when disabled", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR, { enabled: false }));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft();
      });

      expect(savedDraft).toBeNull();
    });

    it("returns null when operatorAddress is missing", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(undefined));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft();
      });

      expect(savedDraft).toBeNull();
    });
  });

  // ------------------------------------------
  // Load
  // ------------------------------------------

  describe("loadDraft", () => {
    it("loads draft and applies to Zustand store", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      // First save
      await act(async () => {
        await result.current.saveDraft();
      });

      // Then load
      let loaded: any;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).not.toBeNull();
      expect(loaded.form.name).toBe("My Garden");
      // Should restore state to Zustand store
      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          form: expect.objectContaining({ name: "My Garden" }),
          currentStep: 1,
        })
      );
    });

    it("returns null when no draft exists", async () => {
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let loaded: any;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).toBeNull();
    });

    it("returns null when disabled", async () => {
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR, { enabled: false }));

      let loaded: any;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).toBeNull();
    });
  });

  // ------------------------------------------
  // Peek
  // ------------------------------------------

  describe("peekDraft", () => {
    it("reads draft without applying to store", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      await act(async () => {
        await result.current.saveDraft();
      });

      // Clear mock calls from save
      mockSetState.mockClear();

      let peeked: any;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).not.toBeNull();
      expect(peeked.form.name).toBe("My Garden");
      // peekDraft should NOT call setState
      expect(mockSetState).not.toHaveBeenCalled();
    });

    it("returns null when no draft exists", async () => {
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let peeked: any;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).toBeNull();
    });
  });

  // ------------------------------------------
  // Clear
  // ------------------------------------------

  describe("clearDraft", () => {
    it("removes draft from IDB and resets lastSavedAt", async () => {
      withProgress();
      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      await act(async () => {
        await result.current.saveDraft();
      });
      expect(result.current.lastSavedAt).not.toBeNull();

      await act(async () => {
        await result.current.clearDraft();
      });

      expect(result.current.lastSavedAt).toBeNull();

      const key = `garden_draft_${OPERATOR_ADDR}`;
      const stored = await idbGet(key);
      expect(stored).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Meaningful progress detection
  // ------------------------------------------

  describe("meaningful progress", () => {
    it("name alone counts as meaningful", async () => {
      mockStoreState = {
        form: { ...mockFormState, name: "My Garden" },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).not.toBeNull();
    });

    it("slug alone counts as meaningful", async () => {
      mockStoreState = {
        form: { ...mockFormState, slug: "my-garden" },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).not.toBeNull();
    });

    it("description alone counts as meaningful", async () => {
      mockStoreState = {
        form: { ...mockFormState, description: "A garden" },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).not.toBeNull();
    });

    it("location alone counts as meaningful", async () => {
      mockStoreState = {
        form: { ...mockFormState, location: "Bogota, CO" },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).not.toBeNull();
    });

    it("planned members count as meaningful", async () => {
      mockStoreState = {
        form: {
          ...mockFormState,
          gardeners: ["0x1111111111111111111111111111111111111111"] as string[],
        },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).not.toBeNull();
    });

    it("whitespace-only fields are not meaningful", async () => {
      mockStoreState = {
        form: { ...mockFormState, name: "   ", slug: "  ", description: "  " },
        currentStep: 0,
      };

      const { result } = renderHook(() => useGardenDraft(OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft();
      });
      expect(saved).toBeNull();
    });
  });
});
