/**
 * useOctantVaultWithdraw Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";

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

const messages = {
  "app.treasury.withdraw": "Withdraw",
  "app.treasury.withdrawSuccess": "Withdraw successful",
} as const;

const { useOctantVaultWithdraw } = await import("../../../hooks/vault/useOctantVaultWithdraw");

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("hooks/vault/useOctantVaultWithdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.primaryAddress = OWNER;
    mockSendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: false });
    mockTransactionSender = { sendContractCall: mockSendContractCall, authMode: "wallet" };
  });

  it("pre-checks maxWithdraw with chainId, then sends withdraw with the 1% maxLoss and invalidates positions", async () => {
    mockReadContract.mockResolvedValueOnce(1_000n); // maxWithdraw
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useOctantVaultWithdraw(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        chainId: OCTANT_CHAIN_ID,
        vaultAddress: VAULT,
        amount: 400n,
      });
    });

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: VAULT,
        functionName: "maxWithdraw",
        args: [OWNER, 100n, []],
        chainId: OCTANT_CHAIN_ID,
      })
    );
    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT,
        functionName: "withdraw",
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

  it("rejects when the amount exceeds the withdrawable balance and never signs", async () => {
    mockReadContract.mockResolvedValueOnce(100n); // maxWithdraw below requested amount
    const { result } = renderHook(() => useOctantVaultWithdraw(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: OCTANT_CHAIN_ID, vaultAddress: VAULT, amount: 400n })
      ).rejects.toThrow(/exceeds/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects a non-mainnet chain before any read", async () => {
    const { result } = renderHook(() => useOctantVaultWithdraw(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: 42161, vaultAddress: VAULT, amount: 400n })
      ).rejects.toThrow(/Ethereum mainnet/i);
    });
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects when the session is not a connected wallet", async () => {
    mockUser.authMode = "passkey";
    mockTransactionSender = { sendContractCall: mockSendContractCall, authMode: "passkey" };
    const { result } = renderHook(() => useOctantVaultWithdraw(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ chainId: OCTANT_CHAIN_ID, vaultAddress: VAULT, amount: 400n })
      ).rejects.toThrow(/connected wallet/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects when the owner is not the connected wallet", async () => {
    const { result } = renderHook(() => useOctantVaultWithdraw(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          chainId: OCTANT_CHAIN_ID,
          vaultAddress: VAULT,
          amount: 400n,
          owner: OTHER,
        })
      ).rejects.toThrow(/connected wallet/i);
    });
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });
});
