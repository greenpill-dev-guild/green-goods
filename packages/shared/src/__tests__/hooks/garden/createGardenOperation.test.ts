/**
 * createGardenOperation Tests
 *
 * Tests the factory function that creates garden member operations
 * (add/remove gardeners, operators, etc.) with transaction simulation,
 * optimistic updates, error tracking, and toast notifications.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockFetchHatsModuleAddress = vi.fn();
vi.mock("../../../utils/blockchain/garden-hats", () => ({
  fetchHatsModuleAddress: (...args: unknown[]) => mockFetchHatsModuleAddress(...args),
}));

const mockSimulateTransaction = vi.fn();
vi.mock("../../../utils/blockchain/simulation", () => ({
  simulateTransaction: (...args: unknown[]) => mockSimulateTransaction(...args),
}));

const mockParseContractError = vi.fn();
vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: (error: unknown) => mockParseContractError(error),
}));

vi.mock("../../../utils/blockchain/abis", () => ({
  HATS_MODULE_ABI: [{ type: "function", name: "grantRole" }],
}));

vi.mock("../../../utils/blockchain/garden-roles", () => ({
  GARDEN_ROLE_IDS: {
    gardener: 1n,
    operator: 2n,
    evaluator: 3n,
    owner: 4n,
    funder: 5n,
    community: 6n,
  },
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    error: vi.fn(),
  },
}));

vi.mock("../../../modules/app/analytics-events", () => ({
  trackAdminMemberAddStarted: vi.fn(),
  trackAdminMemberAddSuccess: vi.fn(),
  trackAdminMemberAddFailed: vi.fn(),
  trackAdminMemberRemoveStarted: vi.fn(),
  trackAdminMemberRemoveSuccess: vi.fn(),
  trackAdminMemberRemoveFailed: vi.fn(),
}));

// ============================================
// Import after mocks
// ============================================

import {
  createGardenOperation,
  GARDEN_OPERATIONS,
  type GardenOperationConfig,
} from "../../../hooks/garden/createGardenOperation";
import type { Address } from "../../../types/domain";

// ============================================
// Test Helpers
// ============================================

const GARDEN_ID = "0x1111111111111111111111111111111111111111" as Address;
const TARGET_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const HATS_MODULE = "0x3333333333333333333333333333333333333333";
const USER_ADDRESS = "0x4444444444444444444444444444444444444444" as `0x${string}`;
const TX_HASH = "0xabcdef" as `0x${string}`;

function createConfig(overrides: Partial<GardenOperationConfig> = {}): GardenOperationConfig {
  return {
    memberType: "gardener",
    operationType: "add",
    messages: {
      loading: "Adding gardener...",
      success: "Gardener added",
      error: "Failed to add gardener",
    },
    ...overrides,
  };
}

function createMockWalletClient() {
  return {
    writeContract: vi.fn().mockResolvedValue(TX_HASH),
    chain: { id: 11155111, name: "Sepolia" },
  } as any;
}

function createMockExecuteWithToast() {
  return vi.fn(async (action: () => Promise<any>) => {
    return await action();
  });
}

// ============================================
// Tests
// ============================================

describe("createGardenOperation", () => {
  const mockSetIsLoading = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchHatsModuleAddress.mockResolvedValue(HATS_MODULE);
    mockSimulateTransaction.mockResolvedValue({ success: true });
    mockParseContractError.mockReturnValue({
      name: "ContractError",
      message: "Something went wrong",
      action: undefined,
    });
  });

  // ------------------------------------------
  // Successful operation
  // ------------------------------------------

  describe("successful operation", () => {
    it("returns success with tx hash", async () => {
      const walletClient = createMockWalletClient();
      const executeWithToast = createMockExecuteWithToast();
      const config = createConfig();

      const operation = createGardenOperation(
        GARDEN_ID,
        config,
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading
      );

      const result = await operation(TARGET_ADDRESS);

      expect(result.success).toBe(true);
      expect(result.hash).toBe(TX_HASH);
    });

    it("calls simulation before transaction", async () => {
      const walletClient = createMockWalletClient();
      const executeWithToast = createMockExecuteWithToast();

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading
      );

      await operation(TARGET_ADDRESS);

      expect(mockSimulateTransaction).toHaveBeenCalledWith(
        HATS_MODULE,
        expect.any(Array),
        "grantRole",
        [GARDEN_ID, TARGET_ADDRESS, 1n],
        USER_ADDRESS
      );
    });

    it("manages loading state", async () => {
      const walletClient = createMockWalletClient();
      const executeWithToast = createMockExecuteWithToast();

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading
      );

      await operation(TARGET_ADDRESS);

      // Loading set to true at start, false in finally
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });

    it("calls optimistic update callback", async () => {
      const walletClient = createMockWalletClient();
      const executeWithToast = createMockExecuteWithToast();
      const onOptimisticUpdate = vi.fn();

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading,
        onOptimisticUpdate
      );

      await operation(TARGET_ADDRESS);

      expect(onOptimisticUpdate).toHaveBeenCalledWith({
        memberType: "gardener",
        operationType: "add",
        targetAddress: TARGET_ADDRESS,
      });
    });

    it("uses revokeRole for remove operations", async () => {
      const walletClient = createMockWalletClient();
      const executeWithToast = createMockExecuteWithToast();

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig({ operationType: "remove" }),
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading
      );

      await operation(TARGET_ADDRESS);

      expect(mockSimulateTransaction).toHaveBeenCalledWith(
        HATS_MODULE,
        expect.any(Array),
        "revokeRole",
        expect.any(Array),
        USER_ADDRESS
      );
    });
  });

  // ------------------------------------------
  // Failure cases
  // ------------------------------------------

  describe("failure cases", () => {
    it("returns error when wallet not connected", async () => {
      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        null as any,
        undefined as any,
        vi.fn(),
        mockSetIsLoading
      );

      const result = await operation(TARGET_ADDRESS);

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("WalletNotConnected");
    });

    it("returns error when hats module not found", async () => {
      mockFetchHatsModuleAddress.mockResolvedValue(null);

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        createMockWalletClient(),
        USER_ADDRESS,
        createMockExecuteWithToast(),
        mockSetIsLoading
      );

      const result = await operation(TARGET_ADDRESS);

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("HatsModuleNotConfigured");
    });

    it("returns error when simulation fails", async () => {
      mockSimulateTransaction.mockResolvedValue({
        success: false,
        error: { name: "SimulationFailed", message: "Reverted" },
      });

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        createMockWalletClient(),
        USER_ADDRESS,
        createMockExecuteWithToast(),
        mockSetIsLoading
      );

      const result = await operation(TARGET_ADDRESS);

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("SimulationFailed");
    });

    it("returns parsed error when transaction throws", async () => {
      const walletClient = createMockWalletClient();
      walletClient.writeContract.mockRejectedValue(new Error("Tx reverted"));

      const executeWithToast = vi.fn(async (action: () => Promise<any>) => {
        return await action();
      });

      const operation = createGardenOperation(
        GARDEN_ID,
        createConfig(),
        walletClient,
        USER_ADDRESS,
        executeWithToast,
        mockSetIsLoading
      );

      const result = await operation(TARGET_ADDRESS);

      expect(result.success).toBe(false);
      expect(mockParseContractError).toHaveBeenCalled();
    });
  });
});

// ============================================
// Pre-defined operations
// ============================================

describe("GARDEN_OPERATIONS", () => {
  it("defines all role add/remove pairs", () => {
    expect(GARDEN_OPERATIONS.addGardener).toEqual({
      memberType: "gardener",
      operationType: "add",
    });
    expect(GARDEN_OPERATIONS.removeGardener).toEqual({
      memberType: "gardener",
      operationType: "remove",
    });
    expect(GARDEN_OPERATIONS.addOperator).toEqual({
      memberType: "operator",
      operationType: "add",
    });
    expect(GARDEN_OPERATIONS.removeOperator).toEqual({
      memberType: "operator",
      operationType: "remove",
    });
    expect(GARDEN_OPERATIONS.addEvaluator).toEqual({
      memberType: "evaluator",
      operationType: "add",
    });
    expect(GARDEN_OPERATIONS.removeEvaluator).toEqual({
      memberType: "evaluator",
      operationType: "remove",
    });
  });

  it("includes owner, funder, and community roles", () => {
    expect(GARDEN_OPERATIONS.addOwner.memberType).toBe("owner");
    expect(GARDEN_OPERATIONS.addFunder.memberType).toBe("funder");
    expect(GARDEN_OPERATIONS.addCommunity.memberType).toBe("community");
  });
});
