/**
 * useOctantVaultWalletEndow Hook Tests
 *
 * Covers the fund-moving deposit mutation: the approve-reset → approve → deposit
 * ordering, the pre-flight balance gate, and the post-approval slippage guard
 * (which must fail closed when the fresh preview reads zero).
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OctantVaultWalletEndowPreparedTransaction } from "../../../modules/vault-crowdfunding";
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
const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const ASSET = "0x2222222222222222222222222222222222222222" as Address;
const OCTANT_CHAIN_ID = 1;
const AMOUNT = 1_000n;
const LARGE = 10n ** 30n;

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

const { useOctantVaultWalletEndow } = await import(
  "../../../hooks/vault/useOctantVaultWalletEndow"
);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages: {}, onError: () => {} }, children)
    );
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeTransaction(
  overrides: Partial<OctantVaultWalletEndowPreparedTransaction> = {}
): OctantVaultWalletEndowPreparedTransaction {
  return {
    intentKind: "wallet_endow",
    paymentMethod: "wallet",
    chainId: OCTANT_CHAIN_ID,
    vaultAddress: VAULT,
    assetAddress: ASSET,
    assetSymbol: "WETH",
    assetDecimals: 18,
    amount: AMOUNT,
    receiver: {
      intentKind: "wallet_endow",
      paymentMethod: "wallet",
      receiverKind: "connected_wallet",
      receiverCustody: "connected_wallet",
      receiverAddress: OWNER,
    },
    ...overrides,
  };
}

// Route reads by contract function name so the hook's conditional branches don't
// make the mock order brittle. previewDeposit is read twice (pre-approval, then
// fresh); allowance up to twice (initial, then refreshed after approve).
function setupReads(opts: {
  maxDeposit?: bigint;
  balance?: bigint;
  previews?: bigint[];
  allowances?: bigint[];
}) {
  const maxDeposit = opts.maxDeposit ?? LARGE;
  const balance = opts.balance ?? AMOUNT;
  const previewQueue = [...(opts.previews ?? [AMOUNT, AMOUNT])];
  const allowanceQueue = [...(opts.allowances ?? [AMOUNT])];
  mockReadContract.mockImplementation((_config: unknown, params: { functionName: string }) => {
    switch (params.functionName) {
      case "maxDeposit":
        return Promise.resolve(maxDeposit);
      case "balanceOf":
        return Promise.resolve(balance);
      case "previewDeposit":
        return Promise.resolve(previewQueue.shift() ?? 0n);
      case "allowance":
        return Promise.resolve(allowanceQueue.shift() ?? 0n);
      default:
        return Promise.resolve(0n);
    }
  });
}

describe("hooks/vault/useOctantVaultWalletEndow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.primaryAddress = OWNER;
    mockSendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: false });
    mockTransactionSender = { sendContractCall: mockSendContractCall, authMode: "wallet" };
  });

  it("resets a partial allowance to zero, re-approves the amount, then deposits — in order", async () => {
    // Existing allowance is non-zero but below the amount → must reset to 0 first
    // (USDT-style tokens reject a non-zero→non-zero approve), then approve the
    // full amount, then deposit. Refreshed allowance covers the amount.
    setupReads({ allowances: [AMOUNT / 2n, AMOUNT], previews: [AMOUNT, AMOUNT] });

    const { result } = renderHook(() => useOctantVaultWalletEndow(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await result.current.mutateAsync(makeTransaction());
    });

    const calls = mockSendContractCall.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      address: ASSET,
      functionName: "approve",
      args: [VAULT, 0n],
      chainId: OCTANT_CHAIN_ID,
    });
    expect(calls[1]).toMatchObject({
      address: ASSET,
      functionName: "approve",
      args: [VAULT, AMOUNT],
      chainId: OCTANT_CHAIN_ID,
    });
    expect(calls[2]).toMatchObject({
      address: VAULT,
      functionName: "deposit",
      args: [AMOUNT, OWNER],
      chainId: OCTANT_CHAIN_ID,
    });
  });

  it("rejects with insufficientBalance before any approval when the wallet holds too little WETH", async () => {
    setupReads({ balance: AMOUNT - 1n });

    const { result } = renderHook(() => useOctantVaultWalletEndow(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(makeTransaction())).rejects.toMatchObject({
        reason: "insufficientBalance",
      });
    });

    // Pre-flight gate must fire before any signature is requested.
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("fails closed as slippage when the post-approval preview reads zero", async () => {
    // Allowance already covers the amount (approval skipped). The pre-approval
    // preview is positive but the fresh preview reads 0n — the guard must abort,
    // not deposit blind. Regression lock for the freshShares-vs-expectedShares fix.
    setupReads({ allowances: [AMOUNT], previews: [AMOUNT, 0n] });

    const { result } = renderHook(() => useOctantVaultWalletEndow(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(makeTransaction())).rejects.toMatchObject({
        reason: "slippage",
      });
    });

    expect(mockSendContractCall).not.toHaveBeenCalled();
  });

  it("rejects a non-mainnet chain before any read or signature", async () => {
    setupReads({});

    const { result } = renderHook(() => useOctantVaultWalletEndow(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(makeTransaction({ chainId: 42161 }))).rejects.toThrow(
        /Ethereum mainnet/i
      );
    });

    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockSendContractCall).not.toHaveBeenCalled();
  });
});
