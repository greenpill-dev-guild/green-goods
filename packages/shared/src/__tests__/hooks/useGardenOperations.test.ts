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

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

vi.mock("../../hooks/app/useToastAction", () => ({
  useToastAction: () => mockUseToastAction(),
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../hooks/query-keys", () => ({
  queryKeys: {
    gardens: {
      byChain: vi.fn(() => ["gardens", 11155111]),
    },
  },
}));

vi.mock("../../hooks/garden/createGardenOperation", () => ({
  createGardenOperation: (...args: unknown[]) => mockCreateGardenOperation(...args),
  GARDEN_OPERATIONS: {
    addGardener: {
      functionName: "addGardener",
      memberType: "gardener",
      operationType: "add",
    },
    removeGardener: {
      functionName: "removeGardener",
      memberType: "gardener",
      operationType: "remove",
    },
    addOperator: {
      functionName: "addOperator",
      memberType: "operator",
      operationType: "add",
    },
    removeOperator: {
      functionName: "removeOperator",
      memberType: "operator",
      operationType: "remove",
    },
    addEvaluator: {
      memberType: "evaluator",
      operationType: "add",
    },
    removeEvaluator: {
      memberType: "evaluator",
      operationType: "remove",
    },
    addOwner: {
      memberType: "owner",
      operationType: "add",
    },
    removeOwner: {
      memberType: "owner",
      operationType: "remove",
    },
    addFunder: {
      memberType: "funder",
      operationType: "add",
    },
    removeFunder: {
      memberType: "funder",
      operationType: "remove",
    },
    addCommunity: {
      memberType: "community",
      operationType: "add",
    },
    removeCommunity: {
      memberType: "community",
      operationType: "remove",
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

    // Factory should be called 12 times (add/remove for all roles)
    expect(mockCreateGardenOperation).toHaveBeenCalledTimes(12);
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
    expect(typeof result.current.addEvaluator).toBe("function");
    expect(typeof result.current.removeEvaluator).toBe("function");
    expect(typeof result.current.addOwner).toBe("function");
    expect(typeof result.current.removeOwner).toBe("function");
    expect(typeof result.current.addFunder).toBe("function");
    expect(typeof result.current.removeFunder).toBe("function");
    expect(typeof result.current.addCommunity).toBe("function");
    expect(typeof result.current.removeCommunity).toBe("function");
  });
});
