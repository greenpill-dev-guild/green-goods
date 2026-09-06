/** @vitest-environment jsdom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCeloWallet } from "../../hooks/client-ui/wallet/useCeloWallet";
import { createTestQueryClient, renderHookWithProviders } from "../test-utils";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { tokensKeys } from "../../config/query-keys/tokens";
import { CELO_G_DOLLAR_TOKEN } from "../../config/tokens";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const mocks = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  balance: vi.fn(),
  gate: vi.fn(),
  history: vi.fn(),
  resolve: vi.fn(),
  online: true,
}));
vi.mock("../../hooks/auth/useUser", () => ({ useUser: () => mocks.user }));
vi.mock("../../config/pimlico", () => ({
  createPublicClientForChain: vi.fn(() => ({ readContract: mocks.balance })),
}));
vi.mock("../../modules/commitment-pooling/data-settlement", () => ({
  getGardenerDeliveryEnabled: mocks.gate,
}));
vi.mock("../../modules/commitment-pooling/data-gardener-settlement", () => ({
  getGardenerSettlementHistory: mocks.history,
}));
vi.mock("../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadata: () => ({ byCID: new Map(), isLoading: false }),
}));
vi.mock("../../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => mocks.online }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.online = true;
  mocks.user = {
    primaryAddress: ACCOUNT,
    authMode: "passkey",
    ready: true,
    resolveSmartAccountClient: mocks.resolve,
  };
  mocks.resolve.mockResolvedValue({ chain: { id: 42220 }, account: { address: ACCOUNT } });
  mocks.gate.mockResolvedValue(true);
  mocks.balance.mockResolvedValue(123n);
  mocks.history.mockResolvedValue([
    { id: "receipt", commitmentId: 3n, delivery: { status: "confirmed" }, metadataCID: null },
  ]);
});

describe("useCeloWallet", () => {
  it("reads canonical Celo balance and source-chain history and resolves passkey identity", async () => {
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(result.current.token).toMatchObject({ chainId: 42220, balance: 123n, errored: false });
    expect(mocks.balance).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CELO_G_DOLLAR_TOKEN.address,
        functionName: "balanceOf",
        args: [ACCOUNT],
      })
    );
    expect(mocks.history).toHaveBeenCalledWith(42161, ACCOUNT);
    expect(mocks.resolve).toHaveBeenCalledWith(42220);
  });

  it.each([
    null,
    false,
  ])("blocks sending for gate %s while retaining receipt and balance reads", async (gate) => {
    mocks.gate.mockResolvedValue(gate);
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.receipts).toHaveLength(1));
    expect(result.current.deliveryEnabled).toBe(false);
    expect(result.current.canSend).toBe(false);
    expect(result.current.token.balance).toBe(123n);
  });

  it("reports a failed balance as unavailable while preserving independent receipts", async () => {
    mocks.balance.mockRejectedValue(new Error("RPC unavailable"));
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.balanceError).toBeTruthy());
    expect(result.current.token).toMatchObject({ balance: null, errored: true });
    expect(result.current.receipts).toHaveLength(1);
    expect(result.current.canSend).toBe(false);
  });

  it("retains receipts with their commitment ID when metadata words are unavailable", async () => {
    mocks.history.mockResolvedValue([
      {
        id: "receipt",
        commitmentId: 3n,
        delivery: { status: "confirmed" },
        metadataCID: "bafy-missing",
        metadataUnavailable: false,
      },
    ]);
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.receipts).toHaveLength(1));
    expect(result.current.receipts[0]).toMatchObject({
      commitmentId: 3n,
      title: null,
      metadataUnavailable: true,
      delivery: { status: "confirmed" },
    });
  });

  it.each([
    ["address_mismatch", "address-mismatch"],
    ["policy_unavailable", "policy-unavailable"],
    ["chain_mismatch", "unavailable"],
  ])("fails closed for %s and retries resolver on explicit refresh", async (code, readiness) => {
    mocks.resolve.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.readiness).toBe(readiness));
    expect(result.current.canSend).toBe(false);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.readiness).toBe("ready"));
  });

  it("rejects a returned Celo client belonging to another address", async () => {
    mocks.resolve.mockResolvedValue({
      chain: { id: 42220 },
      account: { address: "0x2222222222222222222222222222222222222222" },
    });
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.readiness).toBe("address-mismatch"));
    expect(result.current.canSend).toBe(false);
  });

  it("requires a passkey resolver and rejects a returned client on the wrong chain", async () => {
    mocks.user = { ...mocks.user, resolveSmartAccountClient: null };
    const { result, rerender } = renderHookWithProviders(() => useCeloWallet());
    expect(result.current.readiness).toBe("unavailable");
    expect(result.current.canSend).toBe(false);
    mocks.user = { ...mocks.user, resolveSmartAccountClient: mocks.resolve };
    mocks.resolve.mockResolvedValue({ chain: { id: 42161 }, account: { address: ACCOUNT } });
    rerender();
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalled());
    await waitFor(() => expect(result.current.readiness).toBe("unavailable"));
    expect(result.current.canSend).toBe(false);
  });

  it("requires a fresh gate result when mounting with an expired cached true value", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(commitmentPoolingKeys.gardenerDelivery(42161, 42220), true, {
      updatedAt: Date.now() - 60_000,
    });
    mocks.gate.mockReturnValue(new Promise(() => {}));
    const { result } = renderHookWithProviders(() => useCeloWallet(), { queryClient });
    expect(result.current.deliveryEnabled).toBe(false);
    expect(result.current.canSend).toBe(false);
  });

  it("closes an enabled gate when the mounted query's freshness window expires", async () => {
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderHookWithProviders(() => useCeloWallet());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(result.current.deliveryEnabled).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.deliveryEnabled).toBe(false);
      expect(result.current.canSend).toBe(false);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("discards readiness immediately when the credential's resolver changes", async () => {
    const { result, rerender } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.canSend).toBe(true));
    const replacement = vi.fn(() => new Promise(() => {}));
    mocks.user = { ...mocks.user, resolveSmartAccountClient: replacement };
    rerender();
    expect(result.current.readiness).toBe("loading");
    expect(result.current.canSend).toBe(false);
    expect(replacement).toHaveBeenCalledWith(42220);
  });

  it.each([
    "wallet",
    "embedded",
  ])("keeps %s sending independent of sponsored client readiness", async (authMode) => {
    mocks.user = { ...mocks.user, authMode, resolveSmartAccountClient: null };
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("keeps cached receipt/balance values with refresh errors and closes the gate", async () => {
    const { result } = renderHookWithProviders(() => useCeloWallet());
    await waitFor(() => expect(result.current.canSend).toBe(true));
    mocks.balance.mockRejectedValue(new Error("RPC down"));
    mocks.history.mockRejectedValue(new Error("indexer down"));
    mocks.gate.mockRejectedValue(new Error("indexer down"));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.deliveryError).toBeTruthy());
    expect(result.current.receipts).toHaveLength(1);
    expect(result.current.token).toMatchObject({ balance: 123n, errored: true });
    expect(result.current.historyError).toBeTruthy();
    expect(result.current.canSend).toBe(false);
  });

  it("does not enable sends from stale cached gate data while offline", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(commitmentPoolingKeys.gardenerDelivery(42161, 42220), true, {
      updatedAt: Date.now() - 60_000,
    });
    queryClient.setQueryData(tokensKeys.celoBalance(ACCOUNT), 123n);
    mocks.online = false;
    const { result } = renderHookWithProviders(() => useCeloWallet(), { queryClient });
    expect(result.current.isOffline).toBe(true);
    expect(result.current.deliveryEnabled).toBe(false);
    expect(result.current.canSend).toBe(false);
    expect(result.current.token.balance).toBe(123n);
  });
});
