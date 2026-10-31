/** @vitest-environment happy-dom */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProtocolFundingOperationsController } from "../hooks/admin-ui/pool/useProtocolFundingOperationsController";
import type { PoolFundingSnapshot } from "../modules/commitment-pooling/pool-funding";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const PROTOCOL = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const TARGET = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const PROTOCOL_SAFE = "0xe41a1e446644034f24a4b2e1bfb28fd414dbc66d" as Address;
const TARGET_SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;

const mocks = vi.hoisted(() => ({
  capabilities: {
    canQueueFunding: true,
    canDispatchOrRetry: false,
    canRequeueOrCancel: false,
    showOperations: true,
    isLoading: false,
  },
  mutateAsync: vi.fn(),
  pinReason: vi.fn(),
  sourceSnapshot: null as PoolFundingSnapshot | null,
  sourceIsError: false,
  sourceRefetch: vi.fn(),
}));

vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => PROTOCOL }));
vi.mock("../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../hooks/gardener/useRole", () => ({ useRole: () => ({ isDeployer: false }) }));
vi.mock("../hooks/commitment-pooling/useSettlement", () => ({
  useSettlementOperationsCapabilities: () => mocks.capabilities,
  useSettlementMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("../modules/commitment-pooling/reasons", () => ({
  pinCommitmentReason: (...args: unknown[]) => mocks.pinReason(...args),
}));
vi.mock("../hooks/commitment-pooling/usePoolFunding", () => ({
  usePoolFunding: (input: { garden: Address }) => ({
    snapshot: input.garden.toLowerCase() === PROTOCOL.toLowerCase() ? mocks.sourceSnapshot : null,
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: mocks.sourceIsError,
    hasStaleBalance: false,
    lastReadAt: 1,
    ledgerReadAt: 1,
    refetch: mocks.sourceRefetch,
  }),
}));

function snapshot(
  state: "QUEUED" | "DISPATCHED" | "FAILED" = "QUEUED",
  limits: Partial<PoolFundingSnapshot["limits"]> = {}
): PoolFundingSnapshot {
  return {
    safe: PROTOCOL_SAFE,
    routeAddresses: { account: PROTOCOL_SAFE, indexed: PROTOCOL_SAFE, live: PROTOCOL_SAFE },
    token: null,
    balance: { value: 100n, blockNumber: 1n, blockTimestamp: 1, readAt: 1 },
    ledgerReadAt: 1,
    committed: 2n,
    expected: 0n,
    authorizedFeeBuffer: 0n,
    expectedFeeBuffer: 0n,
    feeBuffer: 0n,
    quotedFees: 0n,
    feeQuotes: [{ id: "42161-8", amount: 2n, fee: 0n, senderPays: false, recipient: TARGET_SAFE }],
    available: 0n,
    shortfall: 0n,
    suggestedTopUp: 0n,
    fundingState: "healthy",
    fundingUnavailableReasons: [],
    settlementReadiness: "ready",
    settlementUnavailableReasons: [],
    obligations: [],
    transit: { dispatched: 0n, executedAwaitingConfirmation: 0n, incoming: 0n },
    disbursements: [
      {
        id: "42161-8",
        disbursementId: 8n,
        commitmentId: null,
        payoutPlanId: null,
        fundingId: null,
        batchId: null,
        kind: "FUNDING",
        source: PROTOCOL_SAFE,
        recipient: TARGET_SAFE,
        amount: 2n,
        state,
        executionKey: null,
      },
    ],
    executions: [],
    limits: {
      rolesAllowanceRemaining: 100n,
      periodAllowanceRemaining: 100n,
      maxTransferAmount: 100n,
      maxBatchAmount: null,
      batchSizeLimit: null,
      ...limits,
    },
    nativeFeeBalance: null,
  };
}

describe("useProtocolFundingOperationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capabilities = {
      canQueueFunding: true,
      canDispatchOrRetry: false,
      canRequeueOrCancel: false,
      showOperations: true,
      isLoading: false,
    };
    mocks.sourceSnapshot = snapshot();
    mocks.sourceIsError = false;
    mocks.sourceRefetch.mockImplementation(async () => ({
      data: mocks.sourceSnapshot,
      isError: mocks.sourceIsError,
    }));
    mocks.mutateAsync.mockResolvedValue({ hash: "0xsubmitted", sponsored: false });
    mocks.pinReason.mockResolvedValue("ipfs://reason");
  });

  const dispatcher = {
    canQueueFunding: true,
    canDispatchOrRetry: true,
    canRequeueOrCancel: true,
    showOperations: true,
    isLoading: false,
  };
  const renderController = () =>
    renderHookWithProviders(() =>
      useProtocolFundingOperationsController({
        chainId: 42161,
        protocolGarden: PROTOCOL,
        targetGarden: TARGET,
      })
    );

  it.each([
    ["an unread allowance", snapshot("QUEUED", { rolesAllowanceRemaining: null }), "limits_unread"],
    ["a limit the transfer is over", snapshot("QUEUED", { maxTransferAmount: 1n }), "transfer_cap"],
  ])("holds a queued transfer's dispatch on %s, and leaves its cancel", (_case, read, block) => {
    mocks.capabilities = dispatcher;
    mocks.sourceSnapshot = read;
    const { result } = renderController();
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: false,
      canCancel: true,
      sendBlock: block,
    });
  });

  it("holds dispatch when the transfer's fee is over a limit or has no quote", () => {
    mocks.capabilities = dispatcher;
    const overCap = snapshot("QUEUED", { maxTransferAmount: 3n });
    overCap.feeQuotes = [
      { id: "42161-8", amount: 2n, fee: 2n, senderPays: true, recipient: TARGET_SAFE },
    ];
    mocks.sourceSnapshot = overCap;
    expect(renderController().result.current.rows[0]?.sendBlock).toBe("transfer_cap");

    const unquoted = snapshot();
    unquoted.feeQuotes = [];
    mocks.sourceSnapshot = unquoted;
    expect(renderController().result.current.rows[0]?.sendBlock).toBe("limits_unread");
  });

  it("holds dispatch on a snapshot kept from a failed refresh", () => {
    mocks.capabilities = dispatcher;
    mocks.sourceIsError = true;
    const { result } = renderController();
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: false,
      sendBlock: "limits_unread",
    });
  });

  it("reads the Safe again right before a send, and refuses what no longer fits", async () => {
    mocks.capabilities = dispatcher;
    mocks.sourceRefetch.mockResolvedValue({
      data: snapshot("QUEUED", { periodAllowanceRemaining: 1n }),
      isError: false,
    });
    const { result } = renderController();

    await act(async () => {
      await expect(result.current.queueFunding(TARGET, 2n)).rejects.toThrow(/period_allowance/);
      await expect(result.current.dispatch(8n)).rejects.toThrow(/period_allowance/);
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.lastAct?.phase).toBe("failed");

    // A row the latest read no longer holds isn't sent on an old amount.
    await act(async () => {
      await expect(result.current.dispatch(99n)).rejects.toThrow(/not in the latest read/);
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("closes every send after a Safe proposal, until the transfers read differently", async () => {
    mocks.capabilities = dispatcher;
    mocks.mutateAsync.mockResolvedValue({
      hash: "safe-proposal",
      sponsored: false,
      confirmation: "pending",
    });
    const { result, rerender } = renderController();
    expect(result.current.rows[0]?.canDispatch).toBe(true);

    await act(async () => {
      await result.current.dispatch(8n);
    });
    expect(result.current.lastAct).toMatchObject({ kind: "dispatch", phase: "proposed" });
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: false,
      canCancel: false,
    });

    mocks.sourceSnapshot = snapshot("DISPATCHED");
    rerender();
    expect(result.current.lastAct?.phase).toBe("submitted");
  });

  it("lets module-owner funding authority queue without exposing dispatch or recovery", async () => {
    const { result } = renderHookWithProviders(() =>
      useProtocolFundingOperationsController({
        chainId: 42161,
        protocolGarden: PROTOCOL,
        targetGarden: TARGET,
      })
    );

    expect(result.current.canQueueFunding).toBe(true);
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: false,
      canRequeue: false,
      canCancel: false,
    });
    await act(async () => {
      await result.current.queueFunding(TARGET, 2n);
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      action: "queueFunding",
      garden: TARGET,
      amount: 2n,
    });
    expect(result.current.lastAct?.phase).toBe("submitted");
  });

  it("lets an exact dispatcher dispatch but not requeue or cancel", () => {
    mocks.capabilities = {
      canQueueFunding: false,
      canDispatchOrRetry: true,
      canRequeueOrCancel: false,
      showOperations: true,
      isLoading: false,
    };
    const { result } = renderHookWithProviders(() =>
      useProtocolFundingOperationsController({
        chainId: 42161,
        protocolGarden: PROTOCOL,
        targetGarden: TARGET,
      })
    );
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: true,
      canRequeue: false,
      canCancel: false,
    });
  });

  it("lets the executor-garden steward recover a failed funding row", () => {
    mocks.capabilities = {
      canQueueFunding: false,
      canDispatchOrRetry: true,
      canRequeueOrCancel: true,
      showOperations: true,
      isLoading: false,
    };
    mocks.sourceSnapshot = snapshot("FAILED");
    const { result } = renderHookWithProviders(() =>
      useProtocolFundingOperationsController({
        chainId: 42161,
        protocolGarden: PROTOCOL,
        targetGarden: TARGET,
      })
    );
    expect(result.current.rows[0]).toMatchObject({
      canDispatch: false,
      canRequeue: true,
      canCancel: true,
    });
  });
});
