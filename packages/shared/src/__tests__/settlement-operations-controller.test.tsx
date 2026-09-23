/** @vitest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSettlementOperationsController } from "../hooks/admin-ui/pool/useSettlementOperationsController";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const SETTLEMENT = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({
  deliveryEnabled: false,
  mutateAsync: vi.fn(),
  readState: vi.fn(),
}));

vi.mock("../modules/commitment-pooling/data-settlement-operations", () => ({
  readSettlementOperationsState: (...args: unknown[]) => mocks.readState(...args),
}));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => OWNER }));
vi.mock("../hooks/gardener/useRole", () => ({ useRole: () => ({ isDeployer: false }) }));
vi.mock("../hooks/commitment-pooling/useCommitmentPoolingAvailability", () => ({
  useCommitmentPoolingAvailability: () => ({
    status: "available",
    capability: {
      deployment: "deployed",
      activation: "active",
      integration: "integrated",
      availability: "available",
      evidence: [],
      verified_at: "2026-09-03",
    },
  }),
}));
vi.mock("../hooks/commitment-pooling/useSettlement", () => ({
  useSettlementMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock("../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({ settlementModule: SETTLEMENT }),
}));

function chainState() {
  return {
    owner: OWNER,
    dispatcher: null,
    gardenerDeliveryEnabled: mocks.deliveryEnabled,
    sourcePaused: false,
    readAt: 1_756_000_000,
  };
}

describe("useSettlementOperationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deliveryEnabled = false;
    mocks.mutateAsync.mockResolvedValue("0xsafe-proposal");
    mocks.readState.mockImplementation(async () => chainState());
  });

  it("keeps a Safe proposal submitted until a chain read returns the requested value", async () => {
    const { result } = renderHookWithProviders(() =>
      useSettlementOperationsController({ chainId: 42161 })
    );
    await waitFor(() => expect(result.current.gardenerDeliveryEnabled).toBe(false));

    await act(async () => {
      await result.current.setGardenerDelivery(true);
    });

    expect(result.current.lastAct).toMatchObject({
      kind: "set-gardener-delivery",
      phase: "submitted",
      hash: "0xsafe-proposal",
    });
    expect(result.current.gardenerDeliveryEnabled).toBe(false);

    mocks.deliveryEnabled = true;
    await act(async () => {
      await (
        result.current as unknown as { checkDeliveryStatus: () => Promise<void> }
      ).checkDeliveryStatus();
    });
    await waitFor(() => expect(result.current.gardenerDeliveryEnabled).toBe(true));
    expect(result.current.lastAct?.phase).toBe("confirmed");
  });

  it("confirms immediately when post-submission readback already matches", async () => {
    mocks.mutateAsync.mockImplementation(async () => {
      mocks.deliveryEnabled = true;
      return "0xexecuted";
    });
    const { result } = renderHookWithProviders(() =>
      useSettlementOperationsController({ chainId: 42161 })
    );
    await waitFor(() => expect(result.current.gardenerDeliveryEnabled).toBe(false));

    await act(async () => {
      await result.current.setGardenerDelivery(true);
    });

    await waitFor(() => expect(result.current.lastAct?.phase).toBe("confirmed"));
    expect(result.current.gardenerDeliveryEnabled).toBe(true);
  });

  it("leaves the chain state unchanged when submission is rejected", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("User rejected the request"));
    const { result } = renderHookWithProviders(() =>
      useSettlementOperationsController({ chainId: 42161 })
    );
    await waitFor(() => expect(result.current.gardenerDeliveryEnabled).toBe(false));

    await act(async () => {
      await expect(result.current.setGardenerDelivery(true)).rejects.toThrow("User rejected");
    });

    expect(result.current.lastAct?.phase).toBe("failed");
    expect(result.current.gardenerDeliveryEnabled).toBe(false);
  });
});
