/**
 * useMarketplaceApprovals Hook Tests
 * @vitest-environment happy-dom
 *
 * Covers the grant: the two one-time approvals a steward gives before listing.
 */

import { WalletWriteNotRetriedError } from "../../../utils/errors/wallet-network-refusal";
import { BatchConfirmationPendingError } from "../../../modules/transactions/batch-types";
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
  listed: false,
  chainId: 11155111,
  sendAtomicBatch: vi.fn(),
  reconcileBatch: vi.fn(),
  assertOwnership: vi.fn(),
  buildApprovalTransactions: vi.fn(),
  readyWalletClient: vi.fn(),
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  loggerError: vi.fn(),
  checkApprovals: vi.fn(),
  getReceipt: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mocks.address, passkeyAccountProfile: "kernel-0.3.1-legacy" }),
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({
    authMode: mocks.authMode,
    assertOwnership: mocks.assertOwnership,
    sendContractCall: mocks.sendTransaction,
    sendAtomicBatch: mocks.sendAtomicBatch,
    reconcileBatch: mocks.reconcileBatch,
    getBatchCapability: async (scope: object) => ({ ...scope, atomic: "supported" }),
  }),
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ connector: undefined }) }));
// No rail lists the approvals yet; a test lists them to reach the pair.
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { action: string }) =>
    mocks.listed && query.action === "marketplace-approvals",
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number }) => unknown) =>
    selector({ selectedChainId: mocks.chainId }),
}));

vi.mock("../../../modules/marketplace/approvals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/marketplace/approvals")>()),
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
    getTransactionReceipt: mocks.getReceipt,
  }),
}));

vi.mock("../../../modules/app/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.loggerError };
  return { logger, createLogger: () => logger };
});

import {
  type MarketplacePendingSubmission,
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
    mocks.listed = false;
    mocks.chainId = CHAIN;
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
      ).toMatchObject({ kind: "approval", steps: ["exchangeApproved"] })
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
    const old: MarketplacePendingSubmission = { kind: "approval", steps: ["exchangeApproved"] };
    const current: MarketplacePendingSubmission = { kind: "approval", steps: ["minterApproved"] };
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
  it("releases a confirmed submission even if approval state subsequently changes", async () => {
    const hash = `0x${"ab".repeat(32)}`;
    mocks.getReceipt.mockResolvedValue({ status: "success", transactionHash: hash });
    mocks.sendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBroadcastReference({ kind: "transaction", hash });
      throw new Error("receipt unavailable");
    });
    const view = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => view.result.current.grantApprovals());
    await waitFor(() => expect(view.result.current.isPending).toBe(true));
    act(() => view.result.current.checkPending());
    await waitFor(() => expect(view.result.current.isPending).toBe(false));
    expect(mocks.sendTransaction).toHaveBeenCalledOnce();
    expect(mocks.getReceipt).toHaveBeenCalledWith({ hash });
  });
  it("clears a proven pre-broadcast refusal but requires explicit wallet review for an opaque cancellation", async () => {
    mocks.sendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBeforeBroadcast();
      throw new WalletWriteNotRetriedError(new Error("switch refused"));
    });
    const view = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => view.result.current.grantApprovals());
    await waitFor(() => expect(view.result.current.error).not.toBeNull());
    expect(view.result.current.isPending).toBe(false);
    mocks.sendTransaction.mockResolvedValueOnce({ hash: "0xproposal", confirmation: "pending" });
    act(() => view.result.current.grantApprovals());
    await waitFor(() => expect(view.result.current.isPending).toBe(true));
    await act(async () => {
      await expect(view.result.current.confirmWalletCancellation(false)).rejects.toThrow(
        "confirmation-required"
      );
    });
    expect(view.result.current.isPending).toBe(true);
    mocks.assertOwnership.mockRejectedValueOnce(new Error("account changed"));
    await act(async () => {
      await expect(view.result.current.confirmWalletCancellation(true)).rejects.toThrow(
        "account changed"
      );
    });
    expect(view.result.current.isPending).toBe(true);
    await act(async () => {
      await view.result.current.confirmWalletCancellation(true);
    });
    expect(view.result.current.isPending).toBe(false);
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(2);
  });
});

describe("useMarketplaceApprovals on a listed rail", () => {
  // The pair's ceilings are sized on Arbitrum only.
  const ARBITRUM = 42161;
  let queryClient: QueryClient;
  const scope = marketplaceSubmissionScope(ARBITRUM, STEWARD as `0x${string}`)!;
  const pendingRecord = () => useMarketplacePendingStore.getState().pending[scope];

  beforeEach(() => {
    vi.clearAllMocks();
    useMarketplacePendingStore.setState({ pending: {}, active: {} });
    queryClient = createTestQueryClient();
    mocks.authMode = "passkey";
    mocks.address = STEWARD;
    mocks.listed = true;
    mocks.chainId = ARBITRUM;
    mocks.checkApprovals.mockResolvedValue({ exchangeApproved: false, minterApproved: false });
    mocks.buildApprovalTransactions.mockResolvedValue({
      grantExchange: GRANT_EXCHANGE,
      approveMinter: APPROVE_MINTER,
    });
  });

  it("grants both under one signature, recording both until the approval reads show them", async () => {
    let recordedWhileSending: unknown;
    mocks.sendAtomicBatch.mockImplementation(async (_calls, options) => {
      await options.onBeforeBroadcast({ kind: "user-operation", hash: `0x${"cd".repeat(32)}` });
      recordedWhileSending = pendingRecord();
      mocks.checkApprovals.mockResolvedValue({ exchangeApproved: true, minterApproved: true });
      return { hash: `0x${"ef".repeat(32)}`, sponsored: true };
    });
    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    await waitFor(() => expect(result.current.signatures).toBe(1));

    act(() => result.current.grantApprovals());

    await waitFor(() => expect(result.current.isGranting).toBe(false));
    expect(mocks.sendAtomicBatch).toHaveBeenCalledOnce();
    expect(mocks.sendAtomicBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({ ...GRANT_EXCHANGE, account: STEWARD, chainId: ARBITRUM }),
      expect.objectContaining({ ...APPROVE_MINTER, account: STEWARD, chainId: ARBITRUM }),
    ]);
    expect(mocks.sendAtomicBatch.mock.calls[0][1].batchBudget).toMatchObject({ maxCalls: 2 });
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
    expect(recordedWhileSending).toMatchObject({
      kind: "approval",
      steps: ["exchangeApproved", "minterApproved"],
    });
    expect(pendingRecord()).toBeUndefined();
  });

  it("keeps both approvals pending until the reads can show them", async () => {
    mocks.sendAtomicBatch.mockImplementation(async () => {
      mocks.checkApprovals.mockRejectedValue(new Error("RPC unavailable"));
      return { hash: `0x${"ef".repeat(32)}`, sponsored: true };
    });
    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    await waitFor(() => expect(result.current.signatures).toBe(1));

    act(() => result.current.grantApprovals());

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(result.current.pendingSteps).toEqual(["exchangeApproved", "minterApproved"]);
  });

  it("holds both behind a wallet's call ID when nobody can say yet whether they landed", async () => {
    mocks.authMode = "wallet";
    const reference = { kind: "wallet-calls", id: "0xcalls", account: STEWARD, chainId: ARBITRUM };
    mocks.sendAtomicBatch.mockImplementation(async (_calls, options) => {
      await options.onBeforeBroadcast();
      await options.onBatchReference(reference);
      throw new BatchConfirmationPendingError({
        status: "unresolved",
        reference,
        receipts: [],
        sponsored: false,
      } as never);
    });
    mocks.reconcileBatch.mockResolvedValue({ status: "unresolved", reference, receipts: [] });
    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    await waitFor(() => expect(result.current.signatures).toBe(1));

    act(() => result.current.grantApprovals());

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.pendingReference).toBe("0xcalls");
    act(() => result.current.checkPending());
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(mocks.reconcileBatch).toHaveBeenCalledWith(reference);
    expect(result.current.isPending).toBe(true);
  });

  it("reads a one-step record saved before both could go together", async () => {
    localStorage.setItem(
      "green-goods:marketplace-pending",
      JSON.stringify({
        state: { pending: { [scope]: { kind: "approval", step: "minterApproved" } } },
        version: 0,
      })
    );
    await useMarketplacePendingStore.persist.rehydrate();

    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });

    expect(result.current.pendingSteps).toEqual(["minterApproved"]);
    expect(result.current.isPending).toBe(true);
  });
});
