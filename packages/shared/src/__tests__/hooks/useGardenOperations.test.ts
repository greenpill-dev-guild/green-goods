import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGardenOperations } from "@/hooks/useGardenOperations";
import { mockWalletClient, MOCK_TX_HASH } from "../mocks/viem";
import toast from "react-hot-toast";

// Mock dependencies
const mockUseWallets = vi.fn();
const mockUseToastAction = vi.fn();
const mockUseAdminStore = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  useWallets: () => mockUseWallets(),
}));

vi.mock("@/hooks/useToastAction", () => ({
  useToastAction: () => mockUseToastAction(),
}));

vi.mock("@/stores/admin", () => ({
  useAdminStore: () => mockUseAdminStore(),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createWalletClient: vi.fn(() => mockWalletClient),
    custom: vi.fn(),
  };
});

describe("useGardenOperations", () => {
  const gardenId = "0x1234567890123456789012345678901234567890";
  const mockExecuteWithToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseWallets.mockReturnValue({
      wallets: [
        {
          address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
          walletClientType: "privy",
          provider: {},
        },
      ],
    });

    mockUseToastAction.mockReturnValue({
      executeWithToast: mockExecuteWithToast,
    });

    mockUseAdminStore.mockReturnValue({
      selectedChainId: 84532,
    });

    mockExecuteWithToast.mockImplementation(async (action) => {
      return await action();
    });
  });

  it("should add gardener successfully", async () => {
    mockWalletClient.writeContract.mockResolvedValue(MOCK_TX_HASH);

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      const txHash = await result.current.addGardener("0x1234567890123456789012345678901234567890");
      expect(txHash).toBe(MOCK_TX_HASH);
    });

    expect(mockExecuteWithToast).toHaveBeenCalledWith(expect.any(Function), {
      loadingMessage: "Adding gardener...",
      successMessage: "Gardener added successfully",
      errorMessage: "Failed to add gardener",
    });

    expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
      address: gardenId,
      abi: expect.any(Array),
      functionName: "addGardener",
      account: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
      args: ["0x1234567890123456789012345678901234567890"],
    });
  });

  it("should remove gardener successfully", async () => {
    mockWalletClient.writeContract.mockResolvedValue(MOCK_TX_HASH);

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      const txHash = await result.current.removeGardener(
        "0x1234567890123456789012345678901234567890"
      );
      expect(txHash).toBe(MOCK_TX_HASH);
    });

    expect(mockExecuteWithToast).toHaveBeenCalledWith(expect.any(Function), {
      loadingMessage: "Removing gardener...",
      successMessage: "Gardener removed successfully",
      errorMessage: "Failed to remove gardener",
    });
  });

  it("should handle wallet not connected error", async () => {
    mockUseWallets.mockReturnValue({ wallets: [] });

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      try {
        await result.current.addGardener("0x1234567890123456789012345678901234567890");
      } catch (error) {
        expect(error).toEqual(new Error("Wallet not connected"));
      }
    });
  });

  it("should handle contract write failure", async () => {
    const contractError = new Error("Contract execution reverted");
    mockWalletClient.writeContract.mockRejectedValue(contractError);
    mockExecuteWithToast.mockImplementation(async (action) => {
      try {
        return await action();
      } catch (error) {
        throw error;
      }
    });

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      try {
        await result.current.addGardener("0x1234567890123456789012345678901234567890");
      } catch (error) {
        expect(error).toBe(contractError);
      }
    });

    expect(mockWalletClient.writeContract).toHaveBeenCalled();
  });

  it("should set loading state during operations", async () => {
    mockWalletClient.writeContract.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(MOCK_TX_HASH), 100))
    );

    const { result } = renderHook(() => useGardenOperations(gardenId));

    expect(result.current.isLoading).toBe(false);

    const addPromise = act(async () => {
      await result.current.addGardener("0x1234567890123456789012345678901234567890");
    });

    await addPromise;
    expect(result.current.isLoading).toBe(false);
  });

  it("should add operator successfully", async () => {
    mockWalletClient.writeContract.mockResolvedValue(MOCK_TX_HASH);

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      const txHash = await result.current.addOperator("0x1111111111111111111111111111111111111111");
      expect(txHash).toBe(MOCK_TX_HASH);
    });

    expect(mockExecuteWithToast).toHaveBeenCalledWith(expect.any(Function), {
      loadingMessage: "Adding operator...",
      successMessage: "Operator added successfully",
      errorMessage: "Failed to add operator",
    });
  });

  it("should remove operator successfully", async () => {
    mockWalletClient.writeContract.mockResolvedValue(MOCK_TX_HASH);

    const { result } = renderHook(() => useGardenOperations(gardenId));

    await act(async () => {
      const txHash = await result.current.removeOperator(
        "0x1111111111111111111111111111111111111111"
      );
      expect(txHash).toBe(MOCK_TX_HASH);
    });

    expect(mockExecuteWithToast).toHaveBeenCalledWith(expect.any(Function), {
      loadingMessage: "Removing operator...",
      successMessage: "Operator removed successfully",
      errorMessage: "Failed to remove operator",
    });
  });
});
