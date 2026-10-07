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
  checkMarketplaceApprovals: vi.fn(async () => ({
    exchangeApproved: false,
    minterApproved: false,
  })),
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

import { useMarketplaceApprovals } from "../../../hooks/hypercerts/useMarketplaceApprovals";

describe("useMarketplaceApprovals grant", () => {
  let queryClient: QueryClient;
  const grant = () => {
    const { result } = renderHookWithQueryClient(() => useMarketplaceApprovals(), { queryClient });
    act(() => result.current.grantApprovals());
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
    await waitFor(() => expect(mocks.loggerError).toHaveBeenCalled());
    expect(mocks.sendTransaction).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
