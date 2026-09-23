/** @vitest-environment jsdom */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProtocolFundingOperationsController } from "../hooks/admin-ui/pool/useProtocolFundingOperationsController";
import type { PoolFundingSnapshot } from "../modules/commitment-pooling/pool-funding";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils";

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
    isError: false,
    hasStaleBalance: false,
    lastReadAt: 1,
    ledgerReadAt: 1,
    refetch: vi.fn(async () => undefined),
  }),
}));

function snapshot(state: "QUEUED" | "DISPATCHED" | "FAILED" = "QUEUED"): PoolFundingSnapshot {
  return {
    safe: PROTOCOL_SAFE,
    routeAddresses: { account: PROTOCOL_SAFE, indexed: PROTOCOL_SAFE, live: PROTOCOL_SAFE },
    token: null,
    balance: null,
    ledgerReadAt: 1,
    committed: 2n,
    expected: 0n,
    authorizedFeeBuffer: 0n,
    expectedFeeBuffer: 0n,
    feeBuffer: 0n,
    quotedFees: 0n,
    feeQuotes: [],
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
      rolesAllowanceRemaining: null,
      periodAllowanceRemaining: null,
      maxTransferAmount: null,
      maxBatchAmount: null,
      batchSizeLimit: null,
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
    mocks.mutateAsync.mockResolvedValue("0xsubmitted");
    mocks.pinReason.mockResolvedValue("ipfs://reason");
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
