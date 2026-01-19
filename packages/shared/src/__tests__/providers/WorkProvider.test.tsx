/**
 * @vitest-environment jsdom
 *
 * WorkProvider Integration Tests
 *
 * Tests for work submission context provider, including:
 * - Context provision
 * - Garden filtering based on user membership
 * - Form validation before submission
 * - Correct payload construction
 */

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks - Must be defined before imports
// ============================================

// Mock hooks
const mockUseUser = vi.fn();
const mockUseActions = vi.fn();
const mockUseGardens = vi.fn();
const mockUseWorkMutation = vi.fn();
const mockUseWorkForm = vi.fn();
const mockUseWorkImages = vi.fn();

// Mock zustand store
const mockWorkFlowStore = {
  actionUID: null as number | null,
  gardenAddress: null as string | null,
  activeTab: 0, // WorkTab.Intro
  setActionUID: vi.fn(),
  setGardenAddress: vi.fn(),
  setActiveTab: vi.fn(),
};

vi.mock("../../hooks/auth/useUser", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => mockUseActions(),
  useGardens: () => mockUseGardens(),
}));

vi.mock("../../hooks/work/useWorkMutation", () => ({
  useWorkMutation: () => mockUseWorkMutation(),
}));

vi.mock("../../hooks/work/useWorkForm", () => ({
  useWorkForm: () => mockUseWorkForm(),
}));

vi.mock("../../hooks/work/useWorkImages", () => ({
  useWorkImages: () => mockUseWorkImages(),
}));

vi.mock("../../stores/useWorkFlowStore", () => ({
  useWorkFlowStore: (selector: (state: typeof mockWorkFlowStore) => unknown) => {
    // Handle useShallow - just call selector directly
    if (typeof selector === "function") {
      return selector(mockWorkFlowStore);
    }
    return mockWorkFlowStore;
  },
}));

vi.mock("../../components/toast", () => ({
  validationToasts: {
    formError: vi.fn(),
  },
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

vi.mock("../../modules/work/work-submission", () => ({
  validateWorkSubmissionContext: vi.fn(() => []),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

// ============================================
// Imports after mocks
// ============================================

import { validationToasts } from "../../components/toast";
import { validateWorkSubmissionContext } from "../../modules/work/work-submission";
import { useWork, WorkProvider } from "../../providers/Work";
import {
  createMockAction,
  createMockGarden,
  createMockUserContext,
  MOCK_ADDRESSES,
} from "../test-utils";

// ============================================
// Test Utilities
// ============================================

/**
 * Creates a wrapper that nests IntlProvider > WorkProvider
 * This is the correct wrapper for testing useWork()
 */
const createFullWrapper = () => {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      createElement(WorkProvider, null, children)
    );
};

/**
 * Creates mock form return value matching UseWorkFormReturn
 */
const createMockFormReturn = () => ({
  register: vi.fn(() => ({ name: "test", onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() })),
  control: { _defaultValues: {} },
  handleSubmit: vi.fn((fn) => async (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault?.();
    return fn({ feedback: "", plantSelection: [], plantCount: undefined });
  }),
  formState: { errors: {}, isSubmitting: false, isValid: true },
  watch: vi.fn(() => ({})),
  reset: vi.fn(),
  feedback: "",
  plantSelection: [] as string[],
  plantCount: undefined,
  values: {},
});

// ============================================
// Tests
// ============================================

describe("providers/WorkProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mocks
    mockWorkFlowStore.actionUID = null;
    mockWorkFlowStore.gardenAddress = null;
    mockWorkFlowStore.activeTab = 0;
    mockWorkFlowStore.setActionUID.mockClear();
    mockWorkFlowStore.setGardenAddress.mockClear();
    mockWorkFlowStore.setActiveTab.mockClear();

    // Default mock: authenticated passkey user
    mockUseUser.mockReturnValue(
      createMockUserContext({
        authMode: "passkey",
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
      })
    );

    // Default mock: one action
    mockUseActions.mockReturnValue({
      data: [createMockAction({ id: "84532-1" })],
      isLoading: false,
    });

    // Default mock: one garden where user is a gardener
    mockUseGardens.mockReturnValue({
      data: [
        createMockGarden({
          id: "garden-1",
          gardeners: [MOCK_ADDRESSES.smartAccount],
          operators: [],
        }),
      ],
      isLoading: false,
    });

    // Default mock: work mutation
    mockUseWorkMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue("0xTxHash"),
      isPending: false,
      isError: false,
    });

    // Default mock: work form
    mockUseWorkForm.mockReturnValue(createMockFormReturn());

    // Default mock: work images
    mockUseWorkImages.mockReturnValue({
      images: [],
      setImages: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Context provision", () => {
    it("provides work context to children", () => {
      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.gardens).toBeDefined();
      expect(result.current.actions).toBeDefined();
      expect(result.current.form).toBeDefined();
    });

    it("exposes form state and methods", () => {
      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.form).toBeDefined();
      expect(result.current.form.register).toBeDefined();
      expect(result.current.form.control).toBeDefined();
      expect(result.current.form.uploadWork).toBeDefined();
      expect(result.current.form.setActionUID).toBeDefined();
      expect(result.current.form.setGardenAddress).toBeDefined();
    });

    it("exposes actions from hook", () => {
      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.actions).toHaveLength(1);
      expect(result.current.actions[0].id).toBe("84532-1");
    });
  });

  describe("Garden filtering", () => {
    it("filters gardens to only user memberships", () => {
      const userAddress = MOCK_ADDRESSES.smartAccount;

      // Garden where user is a gardener
      const memberGarden = createMockGarden({
        id: "member-garden",
        gardeners: [userAddress],
        operators: [],
      });

      // Garden where user is an operator
      const operatorGarden = createMockGarden({
        id: "operator-garden",
        gardeners: [],
        operators: [userAddress],
      });

      // Garden user is NOT a member of
      const otherGarden = createMockGarden({
        id: "other-garden",
        gardeners: ["0xOtherAddress123456789012345678901234567890"],
        operators: [],
      });

      mockUseGardens.mockReturnValue({
        data: [memberGarden, operatorGarden, otherGarden],
        isLoading: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      // Should only include gardens where user is member or operator
      expect(result.current.gardens.length).toBe(2);
      expect(result.current.gardens.map((g) => g.id)).toContain("member-garden");
      expect(result.current.gardens.map((g) => g.id)).toContain("operator-garden");
      expect(result.current.gardens.map((g) => g.id)).not.toContain("other-garden");
    });

    it("returns empty array when user has no memberships", () => {
      mockUseGardens.mockReturnValue({
        data: [
          createMockGarden({
            id: "other-garden",
            gardeners: ["0xOtherAddress123456789012345678901234567890"],
            operators: [],
          }),
        ],
        isLoading: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.gardens.length).toBe(0);
    });

    it("handles case-insensitive address matching", () => {
      const userAddress = MOCK_ADDRESSES.smartAccount;

      // Garden with uppercase gardener address
      const garden = createMockGarden({
        id: "mixed-case-garden",
        gardeners: [userAddress.toUpperCase()],
        operators: [],
      });

      mockUseGardens.mockReturnValue({
        data: [garden],
        isLoading: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.gardens.length).toBe(1);
      expect(result.current.gardens[0].id).toBe("mixed-case-garden");
    });
  });

  describe("Submission validation", () => {
    it("shows validation error when context is incomplete", async () => {
      const mockValidate = validateWorkSubmissionContext as ReturnType<typeof vi.fn>;
      mockValidate.mockReturnValue(["Please select a garden"]);

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      // Call uploadWork without proper context
      await act(async () => {
        await result.current.form.uploadWork();
      });

      expect(validationToasts.formError).toHaveBeenCalledWith("Please select a garden");
    });

    it("does not show error when validation passes", async () => {
      const mockValidate = validateWorkSubmissionContext as ReturnType<typeof vi.fn>;
      mockValidate.mockReturnValue([]); // No errors

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      await act(async () => {
        await result.current.form.uploadWork();
      });

      expect(validationToasts.formError).not.toHaveBeenCalled();
    });
  });

  describe("Loading state", () => {
    it("exposes loading state when actions are loading", () => {
      mockUseActions.mockReturnValue({
        data: [],
        isLoading: true,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("exposes loading state when gardens are loading", () => {
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: true,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("is not loading when both queries complete", () => {
      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles null user address gracefully", () => {
      mockUseUser.mockReturnValue(
        createMockUserContext({
          authMode: null,
          smartAccountAddress: null,
          walletAddress: null,
        })
      );

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      // Should return empty gardens when no user
      expect(result.current.gardens).toEqual([]);
    });

    it("handles empty gardens data", () => {
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.gardens).toEqual([]);
    });

    it("handles empty actions data", () => {
      mockUseActions.mockReturnValue({
        data: [],
        isLoading: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.actions).toEqual([]);
    });
  });

  describe("Work mutation integration", () => {
    it("calls mutateAsync on successful submission", async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue("0xTxHash");
      mockUseWorkMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isError: false,
      });

      // Set up store with valid context
      mockWorkFlowStore.gardenAddress = MOCK_ADDRESSES.garden;
      mockWorkFlowStore.actionUID = 1;

      // Add images
      mockUseWorkImages.mockReturnValue({
        images: [new File(["test"], "test.jpg", { type: "image/jpeg" })],
        setImages: vi.fn(),
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      await act(async () => {
        await result.current.form.uploadWork();
      });

      expect(mockMutateAsync).toHaveBeenCalled();
    });

    it("exposes isPending from mutation", () => {
      mockUseWorkMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
      });

      const { result } = renderHook(() => useWork(), {
        wrapper: createFullWrapper(),
      });

      expect(result.current.workMutation.isPending).toBe(true);
    });
  });
});
