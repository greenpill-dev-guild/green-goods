/**
 * @vitest-environment jsdom
 */

/**
 * useActionOperations Hook Test Suite
 *
 * Tests the action operations hook that manages ActionRegistry contract calls
 */

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionOperations } from "../../hooks/action/useActionOperations";

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useWalletClient: vi.fn(),
}));

// Mock contract utils
vi.mock("../../utils/blockchain/contracts", () => ({
  ActionRegistryABI: [],
  getNetworkContracts: vi.fn(() => ({
    actionRegistry: "0xActionRegistry123",
  })),
}));

// Mock simulation
vi.mock("../../utils/blockchain/simulation", () => ({
  simulateTransaction: vi.fn(),
}));

vi.mock("../../modules/transactions/chain-guard", () => ({
  ensureAppKitWalletChain: vi.fn(() => Promise.resolve()),
}));

// Mock error parsing
vi.mock("../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error) => ({
    name: "ContractError",
    message: error?.message || "Unknown error",
    action: undefined,
  })),
}));

// Mock toast action
vi.mock("../../hooks/app/useToastAction", () => ({
  useToastAction: vi.fn(() => ({
    executeWithToast: vi.fn(async (fn) => fn()),
  })),
}));

// Mock toast service
vi.mock("../../components/toast", () => ({
  toastService: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
  QueryClient: vi.fn(() => ({})),
}));

import { useAccount, useWalletClient } from "wagmi";
import { useToastAction } from "../../hooks/app/useToastAction";
import { ensureAppKitWalletChain } from "../../modules/transactions/chain-guard";
import { simulateTransaction } from "../../utils/blockchain/simulation";

async function runInAct<T>(callback: () => Promise<T>): Promise<T> {
  let response!: T;
  await act(async () => {
    response = await callback();
  });
  return response;
}

describe("useActionOperations", () => {
  const mockWalletClient = {
    writeContract: vi.fn(() => Promise.resolve("0xhash123")),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: wallet not connected
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
    } as any);

    vi.mocked(useWalletClient).mockReturnValue({
      data: undefined,
    } as any);
  });

  describe("when wallet is not connected", () => {
    it("returns error for registerAction when wallet not connected", async () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await result.current.registerAction({
        startTime: 1234567890,
        endTime: 1234567899,
        title: "Test Action",
        slug: "waste.repair_event",
        domain: 3,
        instructions: "Test instructions",
        capitals: [],
        media: [],
      });

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("WalletNotConnected");
    });

    it("returns error for updateActionTitle when wallet not connected", async () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await result.current.updateActionTitle("1", "New Title");

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("WalletNotConnected");
    });
  });

  describe("when wallet is connected", () => {
    beforeEach(() => {
      vi.mocked(useAccount).mockReturnValue({
        address: "0xUserAddress123",
      } as any);

      vi.mocked(useWalletClient).mockReturnValue({
        data: mockWalletClient,
      } as any);
    });

    it("simulates transaction before execution", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const mockExecuteWithToast = vi.fn(async (fn) => fn());
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(simulateTransaction).toHaveBeenCalledWith(
        "0xActionRegistry123",
        expect.any(Array),
        "updateActionTitle",
        [BigInt(1), "New Title"],
        "0xUserAddress123",
        11155111
      );
    });

    it("returns error when simulation fails", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: false,
        error: {
          name: "SimulationError",
          message: "Transaction would revert",
        },
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(response.success).toBe(false);
      expect(response.error?.name).toBe("SimulationError");
    });

    it("executes transaction when simulation succeeds", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      mockWalletClient.writeContract.mockResolvedValue("0xtxhash456");

      const mockExecuteWithToast = vi.fn(async (fn) => fn());
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "Updated Title"));

      expect(mockExecuteWithToast).toHaveBeenCalled();
    });

    it("calls registerAction with slug and domain in the expected argument order", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() =>
        result.current.registerAction({
          startTime: 1234567890,
          endTime: 1234567900,
          title: "Waste Repair Event",
          slug: "waste.repair_event",
          domain: 3,
          instructions: "bafy-test-cid",
          capitals: [1, 5],
          media: ["bafy-media-cid"],
        })
      );

      expect(simulateTransaction).toHaveBeenCalledWith(
        "0xActionRegistry123",
        expect.any(Array),
        "registerAction",
        [
          BigInt(1234567890),
          BigInt(1234567900),
          "Waste Repair Event",
          "waste.repair_event",
          "bafy-test-cid",
          [1, 5],
          ["bafy-media-cid"],
          3,
        ],
        "0xUserAddress123",
        11155111
      );
    });

    it("switches to the selected chain before executing wallet writes", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      await runInAct(() => result.current.updateActionTitle("1", "Updated Title"));

      expect(ensureAppKitWalletChain).toHaveBeenCalledWith(11155111);
    });

    it("handles contract errors during execution", async () => {
      vi.mocked(simulateTransaction).mockResolvedValue({
        success: true,
        result: undefined,
      });

      const mockExecuteWithToast = vi.fn(async () => {
        throw new Error("Contract execution failed");
      });
      vi.mocked(useToastAction).mockReturnValue({
        executeWithToast: mockExecuteWithToast,
      });

      const { result } = renderHook(() => useActionOperations(11155111));

      const response = await runInAct(() => result.current.updateActionTitle("1", "New Title"));

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain("execution failed");
    });

    it("exposes isLoading state", () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      expect(result.current.isLoading).toBe(false);
    });

    it("exposes all action operations", () => {
      const { result } = renderHook(() => useActionOperations(11155111));

      expect(result.current).toHaveProperty("registerAction");
      expect(result.current).toHaveProperty("updateActionStartTime");
      expect(result.current).toHaveProperty("updateActionEndTime");
      expect(result.current).toHaveProperty("updateActionTitle");
      expect(result.current).toHaveProperty("updateActionInstructions");
      expect(result.current).toHaveProperty("updateActionMedia");
      expect(result.current).toHaveProperty("isLoading");
    });
  });
});
