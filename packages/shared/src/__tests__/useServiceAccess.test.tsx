/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useServiceAccess,
  useServiceAccessMutation,
} from "../hooks/commitment-pooling/useServiceAccess";
import { unavailableServiceAccess } from "../modules/commitment-pooling/data-service-access";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const mocks = vi.hoisted(() => ({ rehearsal: true, online: true, read: vi.fn(), error: vi.fn() }));
vi.mock("../modules/commitment-pooling/demo/demo-mode", () => ({
  isDemoPoolingActive: () => mocks.rehearsal,
}));
vi.mock("../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => mocks.online }));
vi.mock("../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: key.buyer, authMode: "wallet", passkeyAccountProfile: null }),
}));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({ useTransactionSender: () => null }));
vi.mock("../modules/commitment-pooling/read-repository", () => ({
  createCommitmentPoolingReadRepository: () => ({ getServiceAccess: mocks.read }),
}));
vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.error,
}));

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000001",
  commitmentId: 1022n,
  buyer: "0x0000000000000000000000000000000000000002",
};

describe("service access hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rehearsal = true;
    mocks.online = true;
  });

  it("consumes the real fixture adapter and replaces its scoped read after an explicit request", async () => {
    const { result } = renderHookWithProviders(() => ({
      read: useServiceAccess(key),
      mutation: useServiceAccessMutation(key),
    }));
    await waitFor(() => expect(result.current.read.data?.mode).toBe("personal-gd"));
    const snapshot = result.current.read.data!;
    await act(async () => {
      const sent = await result.current.mutation.mutateAsync({
        action: "requestClaim",
        expectedRevision: snapshot.offer!.revision,
        expectedTermsHash: snapshot.offer!.termsHash,
        requestNonce: snapshot.nextRequestNonce,
        buyerGarden: snapshot.eligibleBuyerGardens[0]!.address,
        voucherHolder: `0x${"0".repeat(40)}`,
      });
      expect(sent.kind).toBe("local-rehearsal");
    });
    await waitFor(() => expect(result.current.read.data?.consent?.state).toBe("pending"));
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("refreshes the same member's service holdings after an independent request reward", async () => {
    const requestKey = { ...key, commitmentId: 1025n };
    const serviceKey = { ...key, commitmentId: 1023n };
    const { result } = renderHookWithProviders(() => ({
      request: useServiceAccess(requestKey),
      service: useServiceAccess(serviceKey),
      mutation: useServiceAccessMutation(requestKey),
    }));
    await waitFor(() => expect(result.current.request.data?.pilot?.holdings.b).toBe(0n));
    await waitFor(() => expect(result.current.service.data?.pilot?.holdings.b).toBe(0n));
    await act(async () => {
      await result.current.mutation.mutateAsync({
        action: "observePilotRole",
        observation: "work-fulfilled",
      });
      await result.current.mutation.mutateAsync({
        action: "observePilotRole",
        observation: "voucher-budget-repaired",
      });
      await result.current.mutation.mutateAsync({ action: "deliverPilotReward", asset: "voucher" });
    });
    await waitFor(() => expect(result.current.service.data?.pilot?.holdings.b).toBe(1_000_000n));
    expect(result.current.service.data!.capabilities.sourceBuyer).toBe(key.buyer);
    expect(result.current.service.data!.capabilities.gnosisHolder).toBe(key.buyer);
    expect(result.current.request.data!.capabilities.celoDepositor).toBeNull();
  });

  it("keeps production mutations unavailable, surfaces the error and does not enter an offline queue", async () => {
    mocks.rehearsal = false;
    mocks.read.mockResolvedValue(unavailableServiceAccess(key));
    const { result } = renderHookWithProviders(() => ({
      read: useServiceAccess(key),
      mutation: useServiceAccessMutation(key),
    }));
    await waitFor(() => expect(result.current.read.data?.mode).toBe("unavailable"));
    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({
          action: "withdrawClaim",
          expectedClaimHash: `0x${"a".repeat(64)}`,
        })
      ).rejects.toThrow("reviewed deployment");
    });
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));
    expect(mocks.error).toHaveBeenCalledOnce();
  });

  it("withdraws visible action availability on offline change and rejects explicit sending", async () => {
    const voucherKey = { ...key, commitmentId: 1024n };
    const { result, rerender } = renderHookWithProviders(() => ({
      read: useServiceAccess(voucherKey),
      mutation: useServiceAccessMutation(voucherKey),
    }));
    await waitFor(() =>
      expect(result.current.read.data?.availableActions).toContain("finalizeVoucherAllocation")
    );
    mocks.online = false;
    rerender();
    expect(result.current.read.data!.availableActions).toEqual([]);
    expect(result.current.read.data!.capabilities.reasons).toContain("offline");
    const snapshot = result.current.read.data!;
    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({
          action: "retryVoucherSetupAcknowledgment",
          setupId: snapshot.voucherSetups[0]!.setupId,
          sourceChainId: snapshot.key.sourceChainId,
          sourceModule: snapshot.voucherSetups[0]!.authorization.sourceModule,
          expectedAuthorizationHash: snapshot.voucherSetups[0]!.authorizationHash,
          reviewedNativeFee: 0n,
        })
      ).rejects.toThrow("online connection");
    });
    expect(result.current.read.data!.voucherSetups[0]!.acknowledgments.setup.sent).toBe(false);
    expect(result.current.read.data!.voucherSetups[0]!.availableActions).toEqual([]);
  });

  it("uses a different cache identity after buyer or rehearsal-gate change", async () => {
    const { result, rerender } = renderHookWithProviders(
      ({ buyer }) => useServiceAccess({ ...key, buyer }),
      { initialProps: { buyer: key.buyer } }
    );
    await waitFor(() => expect(result.current.data?.evidence).toBe("local-rehearsal"));
    const other = "0x0000000000000000000000000000000000000003" as const;
    rerender({ buyer: other });
    await waitFor(() => expect(result.current.data?.key.buyer).toBe(other));
    expect(result.current.data!.consent).toBeNull();
    mocks.rehearsal = false;
    mocks.read.mockResolvedValue(unavailableServiceAccess({ ...key, buyer: other }));
    rerender({ buyer: other });
    await waitFor(() => expect(result.current.data?.mode).toBe("unavailable"));
    expect(result.current.data!.availableActions).toEqual([]);
  });
});
