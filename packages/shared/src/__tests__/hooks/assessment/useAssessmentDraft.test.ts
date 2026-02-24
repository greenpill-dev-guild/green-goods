/**
 * useAssessmentDraft Tests
 *
 * Tests IDB-backed draft persistence: save, load, peek, clear, key generation,
 * meaningful progress detection, and disabled/missing-param edge cases.
 *
 * Uses fake-indexeddb from setupTests.base.
 */

/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { del as idbDel, get as idbGet, set as idbSet, clear as idbClear } from "idb-keyval";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssessmentDraft } from "../../../hooks/assessment/useAssessmentDraft";
import type { AssessmentWorkflowParams } from "../../../types/domain";

// ============================================
// Test Helpers
// ============================================

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
const OPERATOR_ADDR = "0x2222222222222222222222222222222222222222";

function createParams(overrides: Partial<AssessmentWorkflowParams> = {}): AssessmentWorkflowParams {
  return {
    gardenId: GARDEN_ID as any,
    title: "Test Assessment",
    description: "Test description",
    assessmentType: "biodiversity",
    capitals: ["natural"],
    metrics: '{"score": 85}',
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: 1700000000000,
    endDate: 1700086400000,
    location: "Portland, OR",
    tags: ["urban"],
    ...overrides,
  };
}

function emptyParams(): AssessmentWorkflowParams {
  return {
    gardenId: GARDEN_ID as any,
    title: "",
    description: "",
    assessmentType: "",
    capitals: [],
    metrics: "",
    evidenceMedia: [],
    reportDocuments: [],
    impactAttestations: [],
    startDate: "",
    endDate: "",
    location: "",
    tags: [],
  };
}

// ============================================
// Tests
// ============================================

describe("useAssessmentDraft", () => {
  beforeEach(async () => {
    await idbClear();
  });

  afterEach(async () => {
    await idbClear();
  });

  // ------------------------------------------
  // Draft key generation
  // ------------------------------------------

  describe("draftKey", () => {
    it("returns correct composite key when both params provided", () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      expect(result.current.draftKey).toBe(`assessment_draft_${GARDEN_ID}_${OPERATOR_ADDR}`);
    });

    it("returns null when gardenId is missing", () => {
      const { result } = renderHook(() => useAssessmentDraft(undefined, OPERATOR_ADDR));

      expect(result.current.draftKey).toBeNull();
    });

    it("returns null when operatorAddress is missing", () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, undefined));

      expect(result.current.draftKey).toBeNull();
    });
  });

  // ------------------------------------------
  // Save and load
  // ------------------------------------------

  describe("saveDraft", () => {
    it("saves draft to IDB and updates lastSavedAt", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft(createParams());
      });

      expect(savedDraft).not.toBeNull();
      expect(savedDraft.title).toBe("Test Assessment");
      expect(savedDraft.gardenId).toBe(GARDEN_ID);
      expect(savedDraft.operatorAddress).toBe(OPERATOR_ADDR);
      expect(result.current.lastSavedAt).toBeGreaterThan(0);
    });

    it("skips saving when no meaningful progress", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft(emptyParams());
      });

      expect(savedDraft).toBeNull();
    });

    it("returns null when disabled", async () => {
      const { result } = renderHook(() =>
        useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR, { enabled: false })
      );

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft(createParams());
      });

      expect(savedDraft).toBeNull();
    });

    it("returns null when gardenId is missing", async () => {
      const { result } = renderHook(() => useAssessmentDraft(undefined, OPERATOR_ADDR));

      let savedDraft: any;
      await act(async () => {
        savedDraft = await result.current.saveDraft(createParams());
      });

      expect(savedDraft).toBeNull();
    });
  });

  describe("loadDraft", () => {
    it("loads a previously saved draft", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      await act(async () => {
        await result.current.saveDraft(createParams());
      });

      let loaded: any;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).not.toBeNull();
      expect(loaded.title).toBe("Test Assessment");
      expect(result.current.lastSavedAt).toBeGreaterThan(0);
    });

    it("returns null when no draft exists", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let loaded: any;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });

      expect(loaded).toBeNull();
    });

    it("returns null when disabled", async () => {
      const { result } = renderHook(() =>
        useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR, { enabled: false })
      );

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
    it("reads draft without setting loading state", async () => {
      const key = `assessment_draft_${GARDEN_ID}_${OPERATOR_ADDR}`;
      await idbSet(key, {
        id: key,
        gardenId: GARDEN_ID,
        operatorAddress: OPERATOR_ADDR,
        title: "Peeked",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let peeked: any;
      await act(async () => {
        peeked = await result.current.peekDraft();
      });

      expect(peeked).not.toBeNull();
      expect(peeked.title).toBe("Peeked");
      // peekDraft should not change lastSavedAt
      expect(result.current.lastSavedAt).toBeNull();
    });

    it("returns null when no draft exists", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

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
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      await act(async () => {
        await result.current.saveDraft(createParams());
      });
      expect(result.current.lastSavedAt).not.toBeNull();

      await act(async () => {
        await result.current.clearDraft();
      });

      expect(result.current.lastSavedAt).toBeNull();

      // Verify it's gone from IDB
      const key = `assessment_draft_${GARDEN_ID}_${OPERATOR_ADDR}`;
      const stored = await idbGet(key);
      expect(stored).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Meaningful progress detection
  // ------------------------------------------

  describe("meaningful progress", () => {
    it("detects title as meaningful", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft(emptyParams());
      });
      expect(saved).toBeNull();

      await act(async () => {
        saved = await result.current.saveDraft({ ...emptyParams(), title: "Has title" });
      });
      expect(saved).not.toBeNull();
    });

    it("detects description as meaningful", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft({ ...emptyParams(), description: "Has desc" });
      });
      expect(saved).not.toBeNull();
    });

    it("detects object metrics as meaningful", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft({
          ...emptyParams(),
          metrics: { score: 10 },
        });
      });
      expect(saved).not.toBeNull();
    });

    it("detects location as meaningful", async () => {
      const { result } = renderHook(() => useAssessmentDraft(GARDEN_ID, OPERATOR_ADDR));

      let saved: any;
      await act(async () => {
        saved = await result.current.saveDraft({
          ...emptyParams(),
          location: "Portland",
        });
      });
      expect(saved).not.toBeNull();
    });
  });
});
