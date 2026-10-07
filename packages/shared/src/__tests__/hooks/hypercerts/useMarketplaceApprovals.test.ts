/**
 * useMarketplaceApprovals Hook Tests
 * @vitest-environment happy-dom
 *
 * Covers the grant: the two one-time approvals a steward gives before listing.
 */

import { type QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders as renderHookWithQueryClient } from "../../test-utils/render-helpers";

const CHAIN = 11155111;
const STEWARD = "0x2222222222222222222222222222222222222222";
const SMART_ACCOUNT = "0x5555555555555555555555555555555555555555";
const GRANT_EXCHANGE = {
  abi: [],
  functionName: "grantApprovals",
  args: [],
  address: "0x3333333333333333333333333333333333333333",
};
const APPROVE_MINTER = {
  abi: [],
  functionName: "setApprovalForAll",
  args: [],
  address: "0x4444444444444444444444444444444444444444",
};

const mocks = vi.hoisted(() => ({
  authMode: "wallet" as "wallet" | "passkey",
  address: "0x2222222222222222222222222222222222222222",
  assertOwnership: vi.fn(),
  buildApprovalTransactions: vi.fn(),
  readyWalletClient: vi.fn(),
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  loggerError: vi.fn(),
  checkApprovals: vi.fn(),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.address,
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({
    authMode: mocks.authMode,
    assertOwnership: mocks.assertOwnership,
    sendContractCall: mocks.sendTransaction,
  }),
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number }) => unknown) =>
    selector({ selectedChainId: 11155111 }),
}));

vi.mock("../../../modules/marketplace/approvals", () => ({
  checkMarketplaceApprovals: mocks.checkApprovals,
  buildApprovalTransactions: mocks.buildApprovalTransactions,
}));

// The hook takes its wallet client from the guard when each approval is sent.
vi.mock("../../../modules/transactions/chain-guard", () => ({
  readyWalletClient: mocks.readyWalletClient,
}));

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    waitForTransactionReceipt: mocks.waitForTransactionReceipt,
  }),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.loggerError },
}));

import {
  marketplaceSubmissionScope,
  useMarketplacePendingStore,
} from "../../../stores/useMarketplacePendingStore";
import { useMarketplaceApprovals } from "../../../hooks/hypercerts/useMarketplaceApprovals";

describe("useMarketplaceApprovals grant", () => {
  let queryClient: QueryClient;
  const grant = () => {
    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => result.current.grantApprovals());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useMarketplacePendingStore.setState({ pending: {}, active: {} });
    mocks.checkApprovals.mockResolvedValue({ exchangeApproved: false, minterApproved: false });
    queryClient = createTestQueryClient();
    mocks.authMode = "wallet";
    mocks.address = STEWARD;
    mocks.assertOwnership.mockReset();
    mocks.buildApprovalTransactions.mockResolvedValue({
      grantExchange: GRANT_EXCHANGE,
      approveMinter: APPROVE_MINTER,
    });
    mocks.readyWalletClient.mockResolvedValue({ sendTransaction: mocks.sendTransaction });
    mocks.sendTransaction.mockResolvedValue({ hash: "0xtxhash", sponsored: false });
    mocks.waitForTransactionReceipt.mockResolvedValue({});
  });

  it("sends each approval through the wallet, readied for the steward before each one", async () => {
    grant();

    await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledTimes(2));
    expect(mocks.assertOwnership).toHaveBeenCalledWith(STEWARD, CHAIN);
    expect(mocks.sendTransaction.mock.calls.map(([sent]) => sent)).toEqual([
      expect.objectContaining({ ...GRANT_EXCHANGE, account: STEWARD, chainId: CHAIN }),
      expect.objectContaining({ ...APPROVE_MINTER, account: STEWARD, chainId: CHAIN }),
    ]);
  });

  // Regression: with no wallet client at render the grant resolved without
  // sending anything, and the caller saw a success.
  it("fails, and sends nothing, when the wallet cannot be readied", async () => {
    mocks.assertOwnership.mockRejectedValueOnce(new Error("Connector not connected."));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    grant();

    await waitFor(() =>
      expect(mocks.loggerError).toHaveBeenCalledWith(
        "[useMarketplaceApprovals] Failed to grant approvals",
        expect.objectContaining({ error: "Connector not connected." })
      )
    );
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("sends only the approval that is still missing", async () => {
    mocks.buildApprovalTransactions.mockResolvedValue({ approveMinter: APPROVE_MINTER });

    grant();

    await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledOnce());
    expect(mocks.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining(APPROVE_MINTER),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
  });

  it("sends through the smart account without asking the wallet", async () => {
    mocks.authMode = "passkey";
    mocks.address = SMART_ACCOUNT;
    grant();
    await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledTimes(2));
    expect(mocks.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ account: SMART_ACCOUNT, chainId: CHAIN }),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(mocks.readyWalletClient).not.toHaveBeenCalled();
  });
  it("stops before the second approval when the first has not confirmed", async () => {
    mocks.sendTransaction.mockResolvedValueOnce({
      hash: "0xopaque",
      sponsored: false,
      confirmation: "pending",
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    grant();
    await waitFor(() =>
      expect(
        useMarketplacePendingStore.getState().pending[
          marketplaceSubmissionScope(CHAIN, STEWARD as `0x${string}`)!
        ]
      ).toMatchObject({ kind: "approval", step: "exchangeApproved" })
    );
    expect(mocks.sendTransaction).toHaveBeenCalledOnce();
    expect(mocks.loggerError).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });
  it.each([
    0, 1,
  ])("retains approval step %s across remount and only checks before retry", async (index) => {
    if (index)
      mocks.sendTransaction.mockResolvedValueOnce({ hash: "0xconfirmed", sponsored: false });
    mocks.sendTransaction.mockResolvedValueOnce({ hash: "0xproposal", confirmation: "pending" });
    const first = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => first.result.current.grantApprovals());
    await waitFor(() => expect(first.result.current.isPending).toBe(true));
    const calls = index + 1;
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(calls);
    expect(first.result.current.error).toBeNull();
    first.unmount();
    await useMarketplacePendingStore.persist.rehydrate();
    const next = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    await waitFor(() => expect(next.result.current.isPending).toBe(true));
    act(() => next.result.current.grantApprovals());
    await waitFor(() => expect(next.result.current.isGranting).toBe(false));
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(calls);
    act(() => next.result.current.checkPending());
    await waitFor(() => expect(next.result.current.isChecking).toBe(false));
    expect(next.result.current.isPending).toBe(true);
    mocks.checkApprovals.mockResolvedValue({
      exchangeApproved: true,
      minterApproved: Boolean(index),
    });
    mocks.buildApprovalTransactions.mockResolvedValue(
      index ? {} : { approveMinter: APPROVE_MINTER }
    );
    act(() => next.result.current.checkPending());
    await waitFor(() => expect(next.result.current.isPending).toBe(false));
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(calls);
    act(() => next.result.current.grantApprovals());
    if (!index) await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledTimes(2));
  });

  it("does not let an old confirmation clear a newer pending step", () => {
    const scope = marketplaceSubmissionScope(CHAIN, STEWARD as `0x${string}`)!;
    const old = { kind: "approval", step: "exchangeApproved" } as const;
    const current = { kind: "approval", step: "minterApproved" } as const;
    useMarketplacePendingStore.getState().checkpoint(scope, old);
    useMarketplacePendingStore.getState().checkpoint(scope, current);
    useMarketplacePendingStore.getState().clear(scope, old);
    expect(useMarketplacePendingStore.getState().pending[scope]).toEqual(current);
  });
  it("keeps a checkpoint after receipt lookup fails and allows another account", async () => {
    mocks.sendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBeforeBroadcast();
      await options.onBroadcastReference({ kind: "transaction", hash: "0xproposal" });
      throw new Error("receipt unavailable");
    });
    const first = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => first.result.current.grantApprovals());
    await waitFor(() => expect(first.result.current.isPending).toBe(true));
    await waitFor(() => expect(first.result.current.isGranting).toBe(false));
    act(() => first.result.current.grantApprovals());
    await waitFor(() => expect(first.result.current.isGranting).toBe(false));
    expect(mocks.sendTransaction).toHaveBeenCalledOnce();
    mocks.address = SMART_ACCOUNT;
    first.rerender();
    expect(first.result.current.isPending).toBe(false);
    act(() => first.result.current.grantApprovals());
    await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledTimes(3));
    mocks.address = STEWARD;
    first.rerender();
    expect(first.result.current.isPending).toBe(true);
  });

  it("allows retry after a rejected prompt before any accepted reference", async () => {
    mocks.sendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBeforeBroadcast();
      throw { code: 4001, message: "User rejected" };
    });
    const first = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => first.result.current.grantApprovals());
    await waitFor(() => expect(mocks.loggerError).toHaveBeenCalled());
    expect(first.result.current.isPending).toBe(false);
  });
});
