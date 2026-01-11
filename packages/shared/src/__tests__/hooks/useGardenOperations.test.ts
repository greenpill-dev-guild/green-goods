/**
 * useGardenOperations Hook Tests
 *
 * Tests for garden member management (gardeners and operators).
 * Uses createGardenOperation factory with simulation and optimistic updates.
 *
 * NOTE: Complex integration tests are skipped due to factory pattern
 * requiring extensive mock setup. Core functionality tested via
 * unit tests of createGardenOperation and integration tests in admin package.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockUseAccount = vi.fn();
const mockUseWalletClient = vi.fn();
const mockUseQueryClient = vi.fn();
const mockUseToastAction = vi.fn();
const mockCreateGardenOperation = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock("../../hooks/app/useToastAction", () => ({
  useToastAction: () => mockUseToastAction(),
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

vi.mock("../../hooks/query-keys", () => ({
  queryKeys: {
    gardens: {
      byChain: vi.fn(() => ["gardens", 84532]),
    },
  },
}));

vi.mock("../../hooks/garden/createGardenOperation", () => ({
  createGardenOperation: (...args: unknown[]) => mockCreateGardenOperation(...args),
  GARDEN_OPERATIONS: {
    addGardener: {
      functionName: "addGardener",
      loadingMessage: "Adding gardener...",
      successMessage: "Gardener added successfully",
      errorMessage: "Failed to add gardener",
    },
    removeGardener: {
      functionName: "removeGardener",
      loadingMessage: "Removing gardener...",
      successMessage: "Gardener removed successfully",
      errorMessage: "Failed to remove gardener",
    },
    addOperator: {
      functionName: "addOperator",
      loadingMessage: "Adding operator...",
      successMessage: "Operator added successfully",
      errorMessage: "Failed to add operator",
    },
    removeOperator: {
      functionName: "removeOperator",
      loadingMessage: "Removing operator...",
      successMessage: "Operator removed successfully",
      errorMessage: "Failed to remove operator",
    },
  },
}));

// Import after mocks
const { useGardenOperations } = await import("../../hooks/garden/useGardenOperations");

describe("useGardenOperations", () => {
  const gardenId = "0x1234567890123456789012345678901234567890";
  const mockExecuteWithToast = vi.fn();
  const mockWalletClient = { writeContract: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAccount.mockReturnValue({
      address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    });

    mockUseWalletClient.mockReturnValue({
      data: mockWalletClient,
    });

    mockUseQueryClient.mockReturnValue({
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    });

    mockUseToastAction.mockReturnValue({
      executeWithToast: mockExecuteWithToast,
    });

    // Return a mock operation function
    mockCreateGardenOperation.mockReturnValue(vi.fn());
  });

  it("should return error when wallet not connected", async () => {
    mockUseAccount.mockReturnValue({ address: undefined });
    mockUseWalletClient.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useGardenOperations(gardenId));

    const operationResult = await result.current.addGardener(
      "0x1234567890123456789012345678901234567890"
    );
    expect(operationResult.success).toBe(false);
    if (!operationResult.success) {
      expect(operationResult.error?.name).toBe("WalletNotConnected");
    }
  });

  it("should start with isLoading as false", () => {
    const { result } = renderHook(() => useGardenOperations(gardenId));
    expect(result.current.isLoading).toBe(false);
  });

  it("should call createGardenOperation factory for each operation type when wallet connected", () => {
    renderHook(() => useGardenOperations(gardenId));

    // Factory should be called 4 times (add/remove gardener, add/remove operator)
    expect(mockCreateGardenOperation).toHaveBeenCalledTimes(4);
  });

  it("should not call createGardenOperation when wallet not connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined });
    mockUseWalletClient.mockReturnValue({ data: undefined });

    renderHook(() => useGardenOperations(gardenId));

    // Factory should not be called when wallet is not connected
    expect(mockCreateGardenOperation).not.toHaveBeenCalled();
  });

  it("should expose all operation functions", () => {
    const { result } = renderHook(() => useGardenOperations(gardenId));

    expect(typeof result.current.addGardener).toBe("function");
    expect(typeof result.current.removeGardener).toBe("function");
    expect(typeof result.current.addOperator).toBe("function");
    expect(typeof result.current.removeOperator).toBe("function");
  });
});
