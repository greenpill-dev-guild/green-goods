/**
 * useOctantVaultRedeem Hook Tests
 * @vitest-environment happy-dom
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;
const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const OCTANT_CHAIN_ID = 1;

const mockSendContractCall = vi.fn();
const mockReadContract = vi.fn();
const mockErrorHandler = vi.fn();
const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

const mockUser: { authMode: string; primaryAddress: string | null } = {
  authMode: "wallet",
  primaryAddress: OWNER,
};

let mockTransactionSender: {
  sendContractCall: typeof mockSendContractCall;
  authMode: string;
} | null = null;

vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => mockUser }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockTransactionSender,
}));
vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../components/toast", () => ({ toastService }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mockErrorHandler,
}));

const { useOctantVaultRedeem } = await import("../../../hooks/vault/useOctantVaultWithdraw");

describe("hooks/vault/useOctantVaultRedeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.primaryAddress = OWNER;
    mockSendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: false });
    mockTransactionSender = { sendContractCall: mockSendContractCall, authMode: "wallet" };
  });

  it("pre-checks maxRedeem with chainId, then sends redeem and invalidates positions", async () => {
    mockReadContract.mockResolvedValueOnce(1_000n); // maxRedeem
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useOctantVaultRedeem(), { queryClient });

    await act(async () => {
      await result.current.mutateAsync({
        chainId: OCTANT_CHAIN_ID,
        vaultAddress: VAULT,
        shares: 400n,
      });
    });

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: VAULT,
        functionName: "maxRedeem",
        args: [OWNER, 100n, []],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT,
        functionName: "redeem",
        args: [400n, OWNER, OWNER, 100n, []],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["greengoods", "vaults", "octantPositions", OWNER.toLowerCase(), OCTANT_CHAIN_ID],
      })
    );
  });

  it("falls back to the TokenizedStrategy redeem overload when multistrategy maxRedeem is unavailable", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("selector unavailable"));
    mockReadContract.mockResolvedValueOnce(1_000n);
    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await result.current.mutateAsync({
        chainId: OCTANT_CHAIN_ID,
        vaultAddress: VAULT,
        shares: 400n,
      });
    });

    expect(mockReadContract).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        functionName: "maxRedeem",
        args: [OWNER, 100n, []],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(mockReadContract).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        functionName: "maxRedeem",
        args: [OWNER, 100n],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT,
        functionName: "redeem",
        args: [400n, OWNER, OWNER, 100n],
        chainId: OCTANT_CHAIN_ID,
      })
    );
  });

  it("falls back to the plain ERC-4626 redeem overload when maxLoss overloads are unavailable", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("multistrategy selector unavailable"));
    mockReadContract.mockRejectedValueOnce(new Error("tokenized selector unavailable"));
    mockReadContract.mockResolvedValueOnce(1_000n);

    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await result.current.mutateAsync({
        chainId: OCTANT_CHAIN_ID,
        vaultAddress: VAULT,
        shares: 400n,
      });
    });

    expect(mockReadContract).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        functionName: "maxRedeem",
        args: [OWNER],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT,
        functionName: "redeem",
        args: [400n, OWNER, OWNER],
        chainId: OCTANT_CHAIN_ID,
      })
    );
  });

  it("rejects when shares exceed maxRedeem and never signs", async () => {
    mockReadContract.mockResolvedValueOnce(100n); // maxRedeem below requested shares
    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: OCTANT_CHAIN_ID, vaultAddress: VAULT, shares: 400n })
      ).rejects.toThrow(/exceed/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects a non-mainnet chain before any read", async () => {
    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: 42161, vaultAddress: VAULT, shares: 400n })
      ).rejects.toThrow(/Ethereum mainnet/i);
    });
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects when the session is not a connected wallet", async () => {
    mockUser.authMode = "passkey";
    mockTransactionSender = { sendContractCall: mockSendContractCall, authMode: "passkey" };
    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: OCTANT_CHAIN_ID, vaultAddress: VAULT, shares: 400n })
      ).rejects.toThrow(/connected wallet/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects when the owner is not the connected wallet", async () => {
    const { result } = renderHookWithProviders(() => useOctantVaultRedeem());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          chainId: OCTANT_CHAIN_ID,
          vaultAddress: VAULT,
          shares: 400n,
          owner: OTHER,
        })
      ).rejects.toThrow(/connected wallet/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });
});
