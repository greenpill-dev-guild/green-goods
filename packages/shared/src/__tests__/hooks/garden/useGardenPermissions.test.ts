/**
 * useGardenPermissions Tests
 *
 * Tests role-based permission checks: canManageGarden, canReviewGarden,
 * isOperatorOfGarden, isOwnerOfGarden, isEvaluatorOfGarden, canAddMembers,
 * canRemoveMembers, and canViewGarden.
 *
 * Uses dual auth (wagmi address + passkey smart account) with address normalization.
 */

/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks (must be before imports)
// ============================================

const mockPrimaryAddress = vi.fn();
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockPrimaryAddress(),
}));

// ============================================
// Import after mocks
// ============================================

import { useGardenPermissions } from "../../../hooks/garden/useGardenPermissions";
import type { Garden } from "../../../types/domain";

// ============================================
// Test Helpers
// ============================================

const USER_ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER_ADDRESS = "0x2222222222222222222222222222222222222222";
const SMART_ACCOUNT = "0x3333333333333333333333333333333333333333";

function createGarden(overrides: Partial<Garden> = {}): Garden {
  return {
    id: "garden-1",
    chainId: 11155111,
    tokenAddress: "0x0000000000000000000000000000000000000000",
    tokenID: BigInt(1),
    name: "Test Garden",
    description: "Test",
    location: "Test",
    bannerImage: "",
    createdAt: Date.now(),
    gardeners: [],
    operators: [],
    owners: [],
    evaluators: [],
    funders: [],
    assessments: [],
    works: [],
    ...overrides,
  } as Garden;
}

// ============================================
// Tests
// ============================================

describe("useGardenPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress.mockReturnValue(USER_ADDRESS);
  });

  // ------------------------------------------
  // Wallet mode (wagmi address)
  // ------------------------------------------

  describe("wallet mode", () => {
    it("isOperatorOfGarden returns true when user is operator", () => {
      const garden = createGarden({ operators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOperatorOfGarden(garden)).toBe(true);
    });

    it("isOwnerOfGarden returns true when user is owner", () => {
      const garden = createGarden({ owners: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOwnerOfGarden(garden)).toBe(true);
    });

    it("isEvaluatorOfGarden returns true when user is evaluator", () => {
      const garden = createGarden({ evaluators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isEvaluatorOfGarden(garden)).toBe(true);
    });

    it("isOperatorOfGarden returns false when user is not operator", () => {
      const garden = createGarden({ operators: [OTHER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOperatorOfGarden(garden)).toBe(false);
    });
  });

  // ------------------------------------------
  // Passkey mode (smart account address)
  // ------------------------------------------

  describe("passkey mode", () => {
    it("uses smart account address for passkey users", () => {
      mockPrimaryAddress.mockReturnValue(SMART_ACCOUNT);

      const garden = createGarden({ operators: [SMART_ACCOUNT] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOperatorOfGarden(garden)).toBe(true);
    });

    it("uses primary address from usePrimaryAddress (single source of truth)", () => {
      // usePrimaryAddress resolves the correct address based on authMode
      mockPrimaryAddress.mockReturnValue(SMART_ACCOUNT);

      const garden = createGarden({ operators: [SMART_ACCOUNT] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOperatorOfGarden(garden)).toBe(true);
    });
  });

  // ------------------------------------------
  // canManageGarden (owner OR operator)
  // ------------------------------------------

  describe("canManageGarden", () => {
    it("returns true for owners", () => {
      const garden = createGarden({ owners: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canManageGarden(garden)).toBe(true);
    });

    it("returns true for operators", () => {
      const garden = createGarden({ operators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canManageGarden(garden)).toBe(true);
    });

    it("returns false for gardeners", () => {
      const garden = createGarden({ gardeners: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canManageGarden(garden)).toBe(false);
    });

    it("returns false for evaluators", () => {
      const garden = createGarden({ evaluators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canManageGarden(garden)).toBe(false);
    });
  });

  // ------------------------------------------
  // canReviewGarden (manage + evaluator)
  // ------------------------------------------

  describe("canReviewGarden", () => {
    it("returns true for evaluators", () => {
      const garden = createGarden({ evaluators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canReviewGarden(garden)).toBe(true);
    });

    it("returns true for operators (via canManage)", () => {
      const garden = createGarden({ operators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canReviewGarden(garden)).toBe(true);
    });

    it("returns false for gardeners only", () => {
      const garden = createGarden({ gardeners: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canReviewGarden(garden)).toBe(false);
    });
  });

  // ------------------------------------------
  // canViewGarden
  // ------------------------------------------

  describe("canViewGarden", () => {
    it("returns true for everyone", () => {
      const garden = createGarden();
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canViewGarden(garden)).toBe(true);
    });

    it("returns true even when user has no address", () => {
      mockPrimaryAddress.mockReturnValue(null);

      const garden = createGarden();
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canViewGarden(garden)).toBe(true);
    });
  });

  // ------------------------------------------
  // canAddMembers / canRemoveMembers
  // ------------------------------------------

  describe("member management", () => {
    it("canAddMembers returns true for owners", () => {
      const garden = createGarden({ owners: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canAddMembers(garden)).toBe(true);
    });

    it("canRemoveMembers returns true for operators", () => {
      const garden = createGarden({ operators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canRemoveMembers(garden)).toBe(true);
    });

    it("canAddMembers returns false for evaluators", () => {
      const garden = createGarden({ evaluators: [USER_ADDRESS] as any[] });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.canAddMembers(garden)).toBe(false);
    });
  });

  // ------------------------------------------
  // No user connected
  // ------------------------------------------

  describe("no user connected", () => {
    it("all role checks return false", () => {
      mockPrimaryAddress.mockReturnValue(null);

      const garden = createGarden({
        operators: [OTHER_ADDRESS] as any[],
        owners: [OTHER_ADDRESS] as any[],
      });
      const { result } = renderHook(() => useGardenPermissions());

      expect(result.current.isOperatorOfGarden(garden)).toBe(false);
      expect(result.current.isOwnerOfGarden(garden)).toBe(false);
      expect(result.current.isEvaluatorOfGarden(garden)).toBe(false);
      expect(result.current.canManageGarden(garden)).toBe(false);
      expect(result.current.canReviewGarden(garden)).toBe(false);
      expect(result.current.canAddMembers(garden)).toBe(false);
      expect(result.current.canRemoveMembers(garden)).toBe(false);
    });
  });
});
