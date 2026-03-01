/**
 * useHypercertDraft Hook Tests
 * @vitest-environment jsdom
 *
 * Tests IndexedDB-backed draft persistence: load, save, clear, peek,
 * and meaningful progress detection.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ============================================
// Mocks
// ============================================

const mockIdbGet = vi.fn();
const mockIdbSet = vi.fn();
const mockIdbDel = vi.fn();

vi.mock("idb-keyval", () => ({
  get: (...args: unknown[]) => mockIdbGet(...args),
  set: (...args: unknown[]) => mockIdbSet(...args),
  del: (...args: unknown[]) => mockIdbDel(...args),
}));

// Mock logger and error tracking
vi.mock("../../../modules/app/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackStorageError: vi.fn(),
}));

// Mock useTimeout hook (Rule 1 compliance)
const mockTimeoutSet = vi.fn();
const mockTimeoutClear = vi.fn();
vi.mock("../../../hooks/utils/useTimeout", () => ({
  useTimeout: () => ({
    set: mockTimeoutSet,
    clear: mockTimeoutClear,
    isPending: false,
  }),
}));

// Mock the wizard store
const mockLoadDraft = vi.fn();
const mockSetDraftMeta = vi.fn();
const mockReset = vi.fn();
const mockToDraft = vi.fn();
const mockStoreState = {
  lastSavedAt: null as number | null,
  loadDraft: mockLoadDraft,
  setDraftMeta: mockSetDraftMeta,
  reset: mockReset,
  toDraft: mockToDraft,
  title: "",
  description: "",
  selectedAttestationIds: [] as string[],
  workScopes: [] as string[],
  impactScopes: [] as string[],
  workTimeframeStart: 0,
  workTimeframeEnd: 0,
  impactTimeframeStart: 0,
  impactTimeframeEnd: 0,
  sdgs: [] as number[],
  capitals: [] as string[],
  outcomes: {},
  externalUrl: "",
  distributionMode: "equal" as const,
  allowlist: [] as Array<{ address: string; units: bigint }>,
};

// Keep track of subscriber callbacks
let subscribeFn: ((state: typeof mockStoreState) => void) | null = null;
const mockSubscribe = vi.fn((_selector: unknown, callback: unknown) => {
  subscribeFn = callback as (state: typeof mockStoreState) => void;
  return vi.fn(); // unsubscribe
});

vi.mock("../../../stores/useHypercertWizardStore", () => {
  const store = (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState);
  store.getState = () => mockStoreState;
  store.subscribe = (...args: unknown[]) => mockSubscribe(...args);
  return { useHypercertWizardStore: store };
});

import { useHypercertDraft } from "../../../hooks/hypercerts/useHypercertDraft";
import { createMockHypercertDraft, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Test Suite
// ============================================

describe("useHypercertDraft", () => {
  const gardenId = MOCK_ADDRESSES.garden;
  const operatorAddress = MOCK_ADDRESSES.operator;
  const expectedKey = `hypercert_draft_${gardenId}_${operatorAddress}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIdbGet.mockResolvedValue(undefined);
    mockIdbSet.mockResolvedValue(undefined);
    mockIdbDel.mockResolvedValue(undefined);
    mockStoreState.lastSavedAt = null;
  });

  // ============================================
  // Draft Key Generation
  // ============================================

  describe("draftKey", () => {
    it("builds key from gardenId and operatorAddress", () => {
      const { result } = renderHook(() => useHypercertDraft(gardenId, operatorAddress));
      expect(result.current.draftKey).toBe(expectedKey);
    });

    it("returns null when gardenId is missing", () => {
      const { result } = renderHook(() => useHypercertDraft(undefined, operatorAddress));
      expect(result.current.draftKey).toBeNull();
    });

    it("returns null when operatorAddress is missing", () => {
      const { result } = renderHook(() => useHypercertDraft(gardenId, undefined));
      expect(result.current.draftKey).toBeNull();
    });
  });

  // ============================================
  // peekDraft
  // ============================================

  describe("peekDraft", () => {
    it("reads from IndexedDB without loading into store", async () => {
      const draft = createMockHypercertDraft();
      mockIdbGet.mockResolvedValue(draft);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let peeked: unknown;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(mockIdbGet).toHaveBeenCalledWith(expectedKey);
      expect(peeked).toEqual(draft);
      // Should NOT load into wizard store
      expect(mockLoadDraft).not.toHaveBeenCalled();
    });

    it("returns null when no draft exists", async () => {
      mockIdbGet.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let peeked: unknown;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).toBeNull();
    });

    it("returns null and logs error on IDB failure", async () => {
      mockIdbGet.mockRejectedValue(new Error("IDB read failed"));

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let peeked: unknown;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).toBeNull();
    });

    it("returns null when disabled", async () => {
      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { enabled: false, autoLoad: false })
      );

      let peeked: unknown;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).toBeNull();
      expect(mockIdbGet).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // loadDraft
  // ============================================

  describe("loadDraft", () => {
    it("loads draft from IDB into wizard store", async () => {
      const draft = createMockHypercertDraft({ id: "draft-1", updatedAt: 1000 });
      mockIdbGet.mockResolvedValue(draft);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      await act(async () => {
        await result.current.loadDraft();
      });

      expect(mockIdbGet).toHaveBeenCalledWith(expectedKey);
      expect(mockLoadDraft).toHaveBeenCalledWith(draft);
      expect(mockSetDraftMeta).toHaveBeenCalledWith("draft-1", 1000);
    });

    it("returns null when no draft stored", async () => {
      mockIdbGet.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let loaded: unknown;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).toBeNull();
      expect(mockLoadDraft).not.toHaveBeenCalled();
    });

    it("handles IDB errors gracefully", async () => {
      mockIdbGet.mockRejectedValue(new Error("Quota exceeded"));

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let loaded: unknown;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).toBeNull();
    });
  });

  // ============================================
  // saveDraft
  // ============================================

  describe("saveDraft", () => {
    it("saves meaningful draft to IDB", async () => {
      const draft = createMockHypercertDraft({
        title: "My Regenerative Hypercert",
        attestationIds: ["0xAtt1"],
      });
      mockToDraft.mockReturnValue(draft);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(mockIdbSet).toHaveBeenCalledWith(expectedKey, draft);
      expect(mockSetDraftMeta).toHaveBeenCalledWith(draft.id, draft.updatedAt);
    });

    it("skips saving draft with no meaningful progress", async () => {
      // Default draft has empty fields = no meaningful progress
      const emptyDraft = createMockHypercertDraft({
        attestationIds: [],
        title: "",
        description: "",
        workScopes: [],
        impactScopes: [],
        allowlist: [],
      });
      mockToDraft.mockReturnValue(emptyDraft);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let saved: unknown;
      await act(async () => {
        saved = await result.current.saveDraft();
      });

      expect(saved).toBeNull();
      expect(mockIdbSet).not.toHaveBeenCalled();
    });

    it("returns null when disabled", async () => {
      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { enabled: false, autoLoad: false })
      );

      let saved: unknown;
      await act(async () => {
        saved = await result.current.saveDraft();
      });

      expect(saved).toBeNull();
    });

    it("handles IDB write errors gracefully", async () => {
      const draft = createMockHypercertDraft({ title: "Meaningful title" });
      mockToDraft.mockReturnValue(draft);
      mockIdbSet.mockRejectedValue(new Error("Write failed"));

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      let saved: unknown;
      await act(async () => {
        saved = await result.current.saveDraft();
      });

      expect(saved).toBeNull();
    });
  });

  // ============================================
  // clearDraft
  // ============================================

  describe("clearDraft", () => {
    it("deletes from IDB and resets store", async () => {
      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      await act(async () => {
        await result.current.clearDraft();
      });

      expect(mockIdbDel).toHaveBeenCalledWith(expectedKey);
      expect(mockReset).toHaveBeenCalled();
      expect(mockSetDraftMeta).toHaveBeenCalledWith(null, null);
    });

    it("handles IDB delete errors gracefully", async () => {
      mockIdbDel.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      // Should not throw
      await act(async () => {
        await result.current.clearDraft();
      });
    });

    it("no-ops when draftKey is null", async () => {
      const { result } = renderHook(() =>
        useHypercertDraft(undefined, operatorAddress, { autoLoad: false })
      );

      await act(async () => {
        await result.current.clearDraft();
      });

      expect(mockIdbDel).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // autoLoad
  // ============================================

  describe("autoLoad", () => {
    it("auto-loads draft on mount when enabled (default)", async () => {
      const draft = createMockHypercertDraft();
      mockIdbGet.mockResolvedValue(draft);

      renderHook(() => useHypercertDraft(gardenId, operatorAddress));

      await waitFor(() => {
        expect(mockIdbGet).toHaveBeenCalledWith(expectedKey);
      });
    });

    it("skips auto-load when autoLoad=false", () => {
      renderHook(() => useHypercertDraft(gardenId, operatorAddress, { autoLoad: false }));

      // idbGet should not be called for auto-load (only on explicit calls)
      expect(mockIdbGet).not.toHaveBeenCalled();
    });

    it("skips auto-load when enabled=false", () => {
      renderHook(() => useHypercertDraft(gardenId, operatorAddress, { enabled: false }));

      expect(mockIdbGet).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // hasMeaningfulProgress (via saveDraft)
  // ============================================

  describe("meaningful progress detection", () => {
    it.each([
      { field: "attestationIds", value: { attestationIds: ["0xAtt1"] } },
      { field: "title", value: { title: "My Cert" } },
      { field: "description", value: { description: "Some description" } },
      { field: "workScopes", value: { workScopes: ["gardening"] } },
      { field: "impactScopes", value: { impactScopes: ["environment"] } },
      {
        field: "allowlist",
        value: {
          allowlist: [{ address: "0x1234567890123456789012345678901234567890", units: 100n }],
        },
      },
    ])("detects meaningful progress when $field is set", async ({ value }) => {
      const draft = createMockHypercertDraft({
        // Start with all empty, then apply the one meaningful field
        attestationIds: [],
        title: "",
        description: "",
        workScopes: [],
        impactScopes: [],
        allowlist: [],
        ...value,
      });
      mockToDraft.mockReturnValue(draft);

      const { result } = renderHook(() =>
        useHypercertDraft(gardenId, operatorAddress, { autoLoad: false })
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(mockIdbSet).toHaveBeenCalled();
    });
  });
});
