/**
 * useCreateHypercertWorkflow Hook Tests
 * @vitest-environment jsdom
 *
 * Tests wizard step navigation and per-step validation logic
 * for the 4-step hypercert creation workflow.
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

let mockStoreState = {
  currentStep: 1,
  selectedAttestationIds: [] as string[],
  title: "",
  workScopes: [] as string[],
  workTimeframeStart: 0,
  workTimeframeEnd: 0,
  allowlist: [] as Array<{ address: string; units: bigint }>,
};

const mockNextStep = vi.fn();
const mockPreviousStep = vi.fn();
const mockSetStep = vi.fn();
const mockReset = vi.fn();

vi.mock("../../../stores/useHypercertWizardStore", () => ({
  useHypercertWizardStore: (
    selector: (
      state: typeof mockStoreState & {
        nextStep: typeof mockNextStep;
        previousStep: typeof mockPreviousStep;
        setStep: typeof mockSetStep;
        reset: typeof mockReset;
      }
    ) => unknown
  ) =>
    selector({
      ...mockStoreState,
      nextStep: mockNextStep,
      previousStep: mockPreviousStep,
      setStep: mockSetStep,
      reset: mockReset,
    }),
}));

// Mock validateAllowlist from lib/hypercerts
vi.mock("../../../lib/hypercerts", () => ({
  validateAllowlist: (entries: Array<{ units: bigint }>) => {
    if (entries.length === 0) return { valid: false, error: "Allowlist is empty" };
    const total = entries.reduce((sum, e) => sum + e.units, 0n);
    // TOTAL_UNITS = 10000000000000000n
    if (total !== 10000000000000000n) return { valid: false, error: "Wrong total" };
    const invalid = entries.find((e) => e.units <= 0n);
    if (invalid) return { valid: false, error: "Non-positive units" };
    return { valid: true };
  },
}));

import { useCreateHypercertWorkflow } from "../../../hooks/hypercerts/useCreateHypercertWorkflow";

// ============================================
// Test Suite
// ============================================

describe("useCreateHypercertWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      currentStep: 1,
      selectedAttestationIds: [],
      title: "",
      workScopes: [],
      workTimeframeStart: 0,
      workTimeframeEnd: 0,
      allowlist: [],
    };
  });

  // ============================================
  // Navigation
  // ============================================

  describe("navigation", () => {
    it("exposes current step from store", () => {
      mockStoreState.currentStep = 2;
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.currentStep).toBe(2);
    });

    it("delegates nextStep to store", () => {
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      act(() => result.current.nextStep());
      expect(mockNextStep).toHaveBeenCalled();
    });

    it("delegates previousStep to store", () => {
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      act(() => result.current.previousStep());
      expect(mockPreviousStep).toHaveBeenCalled();
    });

    it("delegates setStep to store", () => {
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      act(() => result.current.setStep(3));
      expect(mockSetStep).toHaveBeenCalledWith(3);
    });

    it("delegates reset to store", () => {
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      act(() => result.current.reset());
      expect(mockReset).toHaveBeenCalled();
    });
  });

  // ============================================
  // Step 1 Validation: Attestations
  // ============================================

  describe("canProceed - step 1 (attestations)", () => {
    it("returns false when no attestations selected", () => {
      mockStoreState.currentStep = 1;
      mockStoreState.selectedAttestationIds = [];

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(false);
    });

    it("returns true when attestations are selected", () => {
      mockStoreState.currentStep = 1;
      mockStoreState.selectedAttestationIds = ["0xAtt1"];

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(true);
    });
  });

  // ============================================
  // Step 2 Validation: Metadata
  // ============================================

  describe("canProceed - step 2 (metadata)", () => {
    it("returns false when title is empty", () => {
      mockStoreState.currentStep = 2;
      mockStoreState.title = "";
      mockStoreState.workScopes = ["gardening"];
      mockStoreState.workTimeframeStart = 1000;
      mockStoreState.workTimeframeEnd = 2000;

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(false);
    });

    it("returns false when workScopes are empty", () => {
      mockStoreState.currentStep = 2;
      mockStoreState.title = "My Cert";
      mockStoreState.workScopes = [];
      mockStoreState.workTimeframeStart = 1000;
      mockStoreState.workTimeframeEnd = 2000;

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(false);
    });

    it("returns false when timeframe is missing", () => {
      mockStoreState.currentStep = 2;
      mockStoreState.title = "My Cert";
      mockStoreState.workScopes = ["gardening"];
      mockStoreState.workTimeframeStart = 0;
      mockStoreState.workTimeframeEnd = 2000;

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(false);
    });

    it("returns true when all metadata fields are valid", () => {
      mockStoreState.currentStep = 2;
      mockStoreState.title = "My Cert";
      mockStoreState.workScopes = ["gardening"];
      mockStoreState.workTimeframeStart = 1000;
      mockStoreState.workTimeframeEnd = 2000;

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(true);
    });
  });

  // ============================================
  // Step 3 Validation: Distribution
  // ============================================

  describe("canProceed - step 3 (distribution)", () => {
    it("returns false when allowlist is empty", () => {
      mockStoreState.currentStep = 3;
      mockStoreState.allowlist = [];

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(false);
    });

    it("returns true when allowlist is valid", () => {
      mockStoreState.currentStep = 3;
      mockStoreState.allowlist = [
        { address: "0x1111111111111111111111111111111111111111", units: 5000000000000000n },
        { address: "0x2222222222222222222222222222222222222222", units: 5000000000000000n },
      ];

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(true);
    });
  });

  // ============================================
  // Step 4: Preview & Mint
  // ============================================

  describe("canProceed - step 4 (preview)", () => {
    it("always returns true for preview step", () => {
      mockStoreState.currentStep = 4;

      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed()).toBe(true);
    });
  });

  // ============================================
  // Explicit step parameter
  // ============================================

  describe("canProceed with explicit step", () => {
    it("validates a specific step regardless of currentStep", () => {
      mockStoreState.currentStep = 1;
      mockStoreState.selectedAttestationIds = ["0xAtt1"];
      mockStoreState.title = "My Cert";
      mockStoreState.workScopes = ["gardening"];
      mockStoreState.workTimeframeStart = 1000;
      mockStoreState.workTimeframeEnd = 2000;

      const { result } = renderHook(() => useCreateHypercertWorkflow());

      // Step 1 should be valid (attestations selected)
      expect(result.current.canProceed(1)).toBe(true);
      // Step 2 should be valid (metadata filled)
      expect(result.current.canProceed(2)).toBe(true);
      // Step 3 should be invalid (empty allowlist)
      expect(result.current.canProceed(3)).toBe(false);
    });

    it("returns false for unknown step numbers", () => {
      const { result } = renderHook(() => useCreateHypercertWorkflow());
      expect(result.current.canProceed(99)).toBe(false);
      expect(result.current.canProceed(0)).toBe(false);
    });
  });
});
