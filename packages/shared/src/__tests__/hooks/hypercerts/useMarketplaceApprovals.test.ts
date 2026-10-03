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
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const CHAIN = 11155111;
const STEWARD = "0x2222222222222222222222222222222222222222";
const SMART_ACCOUNT = "0x5555555555555555555555555555555555555555";
const GRANT_EXCHANGE = { to: "0x3333333333333333333333333333333333333333", data: "0xgrant" };
const APPROVE_MINTER = { to: "0x4444444444444444444444444444444444444444", data: "0xapprove" };

const mocks = vi.hoisted(() => ({
  auth: {} as {
    smartAccountClient: unknown;
    smartAccountAddress: string | null;
    eoaAddress: string | null;
  },
  buildApprovalTransactions: vi.fn(),
  readyWalletClient: vi.fn(),
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../hooks/auth/useAuth", () => ({ useAuth: () => mocks.auth }));

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
    mocks.auth = { smartAccountClient: null, smartAccountAddress: null, eoaAddress: STEWARD };
    mocks.buildApprovalTransactions.mockResolvedValue({
      grantExchange: GRANT_EXCHANGE,
      approveMinter: APPROVE_MINTER,
    });
    mocks.readyWalletClient.mockResolvedValue({ sendTransaction: mocks.sendTransaction });
    mocks.sendTransaction.mockResolvedValue("0xtxhash");
    mocks.waitForTransactionReceipt.mockResolvedValue({});
  });

  it("sends each approval through the wallet, readied for the steward before each one", async () => {
    grant();

    await waitFor(() => expect(mocks.sendTransaction).toHaveBeenCalledTimes(2));
    expect(mocks.readyWalletClient.mock.calls).toEqual([
      [CHAIN, STEWARD],
      [CHAIN, STEWARD],
    ]);
    expect(mocks.sendTransaction.mock.calls.map(([sent]) => sent)).toEqual([
      expect.objectContaining({ ...GRANT_EXCHANGE, account: STEWARD }),
      expect.objectContaining({ ...APPROVE_MINTER, account: STEWARD }),
    ]);
    // The second approval is asked for only once the first has landed.
    expect(mocks.waitForTransactionReceipt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readyWalletClient.mock.invocationCallOrder[1]
    );
  });

  // Regression: with no wallet client at render the grant resolved without
  // sending anything, and the caller saw a success.
  it("fails, and sends nothing, when the wallet cannot be readied", async () => {
    mocks.readyWalletClient.mockRejectedValue(new Error("Connector not connected."));
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
    expect(mocks.sendTransaction).toHaveBeenCalledWith(expect.objectContaining(APPROVE_MINTER));
  });

  it("sends through the smart account without asking the wallet", async () => {
    const sendUserOperation = vi.fn().mockResolvedValue("0xop");
    mocks.auth = {
      smartAccountClient: {
        account: { address: SMART_ACCOUNT },
        sendUserOperation,
        getUserOperationReceipt: vi.fn().mockResolvedValue({}),
      },
      smartAccountAddress: SMART_ACCOUNT,
      eoaAddress: null,
    };

    grant();

    await waitFor(() => expect(sendUserOperation).toHaveBeenCalledTimes(2));
    expect(mocks.readyWalletClient).not.toHaveBeenCalled();
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });
});
