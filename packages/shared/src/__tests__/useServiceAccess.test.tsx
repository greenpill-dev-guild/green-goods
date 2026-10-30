/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useServiceAccess,
  useServiceAccessMutation,
} from "../hooks/commitment-pooling/useServiceAccess";
import { useServiceOfferLines } from "../hooks/commitment-pooling/useServiceOfferLines";
import {
  useIssuerSafeThreshold,
  useVoucherIssuerApproval,
  useVoucherWallet,
} from "../hooks/commitment-pooling/useVoucherWallet";
import { unavailableServiceAccess } from "../modules/commitment-pooling/data-service-access";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { REHEARSAL_VOUCHER_ISSUERS } from "../modules/commitment-pooling/demo/demo-service-wallet";
import type {
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "../modules/commitment-pooling/service-access-types";
import type {
  VoucherIssuer,
  VoucherWalletScope,
  VoucherWalletSnapshot,
} from "../modules/commitment-pooling/service-access-wallet-types";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  rehearsal: true,
  online: true,
  read: vi.fn(),
  error: vi.fn(),
  /** Stands in for the chain's wallet read, which answers "unavailable" until adoption. */
  wallet: null as ((scope: VoucherWalletScope) => Promise<VoucherWalletSnapshot>) | null,
}));
vi.mock("../modules/commitment-pooling/demo/demo-mode", () => ({
  isDemoPoolingActive: () => mocks.rehearsal,
}));
vi.mock("../modules/commitment-pooling/service-access-wallet", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/commitment-pooling/service-access-wallet")>();
  return {
    ...actual,
    readLiveVoucherWallet: (scope: VoucherWalletScope) =>
      mocks.wallet ? mocks.wallet(scope) : actual.readLiveVoucherWallet(scope, { routes: [] }),
  };
});
// These cases read through mocked snapshots on Arbitrum's pooling core, which #1350 made a live
// route. Inject no live routes at the read seams without replacing the shared reviewed catalog.
vi.mock("../modules/commitment-pooling/service-access-live", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/commitment-pooling/service-access-live")>();
  return {
    ...actual,
    createLiveServiceAccessAdapter: (
      deps: Parameters<typeof actual.createLiveServiceAccessAdapter>[0]
    ) => actual.createLiveServiceAccessAdapter({ ...deps, routes: [] }),
  };
});
vi.mock("../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => mocks.online }));
vi.mock("../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: key.buyer, authMode: "wallet", passkeyAccountProfile: null }),
}));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => key.buyer }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({ useTransactionSender: () => null }));
vi.mock("../modules/commitment-pooling/service-access-read-repository", () => ({
  createServiceAccessReadRepository: () => ({ getServiceAccess: mocks.read }),
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
const walletScope = {
  sourceChainId: key.sourceChainId,
  coreModule: key.coreModule,
  account: key.buyer,
};

describe("service access hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rehearsal = true;
    mocks.online = true;
    mocks.wallet = null;
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

  it("does not let an older refresh overwrite the confirmed result of a member action", async () => {
    const scope = { ...key, buyer: "0x0000000000000000000000000000000000000005" as Address };
    const { serviceRehearsalAdapter } = await import(
      "../modules/commitment-pooling/demo/demo-service-access"
    );
    const { result } = renderHookWithProviders(() => ({
      read: useServiceAccess(scope),
      mutation: useServiceAccessMutation(scope),
    }));
    await waitFor(() => expect(result.current.read.data?.mode).toBe("personal-gd"));
    const stale = structuredClone(result.current.read.data!);
    let release!: (value: ServiceAccessSnapshot) => void;
    const read = vi.spyOn(serviceRehearsalAdapter, "read").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    let earlierRead!: ReturnType<typeof result.current.read.refetch>;
    try {
      act(() => {
        earlierRead = result.current.read.refetch();
      });
      await waitFor(() => expect(read).toHaveBeenCalled());
      await act(async () => {
        await result.current.mutation.mutateAsync({
          action: "requestClaim",
          expectedRevision: stale.offer!.revision,
          expectedTermsHash: stale.offer!.termsHash,
          requestNonce: stale.nextRequestNonce,
          buyerGarden: stale.eligibleBuyerGardens[0]!.address,
          voucherHolder: `0x${"0".repeat(40)}`,
        });
      });
      await waitFor(() => expect(result.current.read.data?.consent?.state).toBe("pending"));
      await act(async () => {
        release(stale);
        await earlierRead;
      });
      await waitFor(() => expect(result.current.read.data?.consent?.state).toBe("pending"));
    } finally {
      read.mockRestore();
    }
  });

  it("refreshes the same member's service holdings after an independent request reward", async () => {
    const requestKey = { ...key, commitmentId: 1025n };
    const serviceKey = { ...key, commitmentId: 1023n };
    const { result } = renderHookWithProviders(() => {
      const wallet = useVoucherWallet(walletScope);
      const issuer =
        wallet.data?.holdings.find((holding) => holding.issuer.name === "Tech and Sun")?.issuer ??
        null;
      return {
        request: useServiceAccess(requestKey),
        service: useServiceAccess(serviceKey),
        mutation: useServiceAccessMutation(requestKey),
        held: wallet.data?.holdings.find((holding) => holding.issuer === issuer)?.available,
        approval: useVoucherIssuerApproval(issuer),
        safe: useIssuerSafeThreshold({ chainId: 100, safe: issuer?.account }),
      };
    });
    await waitFor(() => expect(result.current.request.data?.pilot?.holdings.b).toBe(0n));
    await waitFor(() => expect(result.current.service.data?.pilot?.holdings.b).toBe(0n));
    await waitFor(() => expect(result.current.held).toBe(0n));
    await waitFor(() =>
      expect(result.current.approval.data).toMatchObject({ kind: "safe", threshold: 1, owners: 1 })
    );
    await waitFor(() =>
      expect(result.current.safe.data).toMatchObject({
        status: "observed",
        threshold: 1,
        owners: 1,
      })
    );
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
    await waitFor(() => expect(result.current.held).toBe(1_000_000n));
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
      wallet: useVoucherWallet(walletScope),
      noSafe: useIssuerSafeThreshold({ chainId: 100, safe: undefined }),
    }));
    await waitFor(() => expect(result.current.read.data?.mode).toBe("unavailable"));
    // Disabled until the garden names an issuer Safe.
    expect(result.current.noSafe.fetchStatus).toBe("idle");
    expect(result.current.noSafe.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.wallet.data).toMatchObject({
        evidence: "unavailable",
        reason: "routes-unconfigured",
        holdings: [],
      })
    );
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

  it("keys an issuer's approval by its authority, so one account read both ways never shares it", async () => {
    const collective = REHEARSAL_VOUCHER_ISSUERS.greenGoods;
    const { result, rerender } = renderHookWithProviders(
      ({ issuer }) => useVoucherIssuerApproval(issuer),
      { initialProps: { issuer: collective as VoucherIssuer } }
    );
    await waitFor(() =>
      expect(result.current.data).toMatchObject({ kind: "safe", threshold: 2, owners: 5 })
    );
    rerender({ issuer: { ...collective, kind: "individual" } });
    await waitFor(() =>
      expect(result.current.data).toEqual({ kind: "account", evidence: "local-rehearsal" })
    );
  });

  it("tells a listed offer what the reader's Gnosis holder holds, not the source buyer", async () => {
    mocks.rehearsal = false;
    const gnosis = "0x0000000000000000000000000000000000000004" as Address;
    const techAndSun = REHEARSAL_VOUCHER_ISSUERS.techAndSun;
    const hubDay = createServiceRehearsalSnapshot({ ...key, commitmentId: 1023n });
    hubDay.capabilities.gnosisHolder = gnosis;
    // A personal G$ service listed first names no Gnosis holder, and its read answers first.
    const personal = createServiceRehearsalSnapshot({ ...key, commitmentId: 1022n });
    mocks.read.mockImplementation(async (read: ServiceAccessKey) =>
      read.commitmentId === 1022n
        ? personal
        : new Promise((resolve) => setTimeout(() => resolve(hubDay), 20))
    );
    mocks.wallet = async (scope) => ({
      account: scope.account,
      evidence: "onchain",
      complete: true,
      reason: null,
      issuers: [techAndSun],
      holdings: [{ issuer: techAndSun, available: scope.account === gnosis ? 9_000_000n : 0n }],
      bookings: [],
      returns: [],
    });
    const offer = {
      commitmentId: 1023n,
      direction: "OFFER",
      onchainState: "OFFERED",
      claimMode: "APPROVAL_GATED",
      claimType: "INDIVIDUAL",
    } as const;
    const { result } = renderHookWithProviders(() =>
      useServiceOfferLines({ chainId: 42161, offers: [{ ...offer, commitmentId: 1022n }, offer] })
    );
    await waitFor(() =>
      expect(result.current.get("1023")).toEqual({
        promisedBy: "Tech and Sun",
        booking: { kind: "hold", held: 9_000_000n, decimals: 6 },
      })
    );
    expect(result.current.has("1022")).toBe(false);
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

  it("observes a remote arrival on an open page, then stops its pending refresh on completion and unmount", async () => {
    mocks.rehearsal = false;
    const waiting = createServiceRehearsalSnapshot({ ...key, commitmentId: 1024n });
    waiting.voucherSetups[0]!.destination!.result.phase = "none";
    mocks.read.mockResolvedValue(waiting);
    vi.useFakeTimers();
    const { result, unmount } = renderHookWithProviders(() => useServiceAccess(waiting.key));
    const arrived = structuredClone(waiting);
    arrived.voucherSetups[0]!.destination!.result.phase = "active";
    arrived.voucherSetups[0]!.destination!.result.decision =
      arrived.voucherSetups[0]!.source.decision;
    for (const ack of Object.values(arrived.voucherSetups[0]!.acknowledgments)) {
      ack.pending = false;
      ack.sourceObservedSequence = ack.destinationSequence ?? ack.sourceObservedSequence;
    }
    mocks.read.mockResolvedValue(arrived);
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.data?.voucherSetups[0]?.destination?.result.phase).toBe("none");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(result.current.data?.voucherSetups[0]?.destination?.result.phase).toBe("active");
      const calls = mocks.read.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mocks.read).toHaveBeenCalledTimes(calls);
      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mocks.read).toHaveBeenCalledTimes(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pauses pending refresh while offline and resumes after reconnect", async () => {
    mocks.rehearsal = false;
    const waiting = createServiceRehearsalSnapshot({ ...key, commitmentId: 1024n });
    waiting.voucherSetups[0]!.destination!.result.phase = "none";
    mocks.read.mockResolvedValue(waiting);
    const { result, rerender, unmount } = renderHookWithProviders(() =>
      useServiceAccess(waiting.key)
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    mocks.online = false;
    rerender();
    const calls = mocks.read.mock.calls.length;
    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mocks.read).toHaveBeenCalledTimes(calls);
      mocks.online = true;
      rerender();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(mocks.read.mock.calls.length).toBeGreaterThan(calls);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps checking a completed cancellation until its source confirmation arrives", async () => {
    mocks.rehearsal = false;
    const waiting = createServiceRehearsalSnapshot({ ...key, commitmentId: 1024n });
    const setup = waiting.voucherSetups[0]!;
    setup.destination!.result.phase = "aborted";
    for (const ack of Object.values(setup.acknowledgments)) {
      ack.pending = false;
      ack.sourceObservedSequence = ack.destinationSequence ?? ack.sourceObservedSequence;
    }
    setup.acknowledgments.setup.pending = true;
    setup.acknowledgments.setup.destinationSequence = 10n;
    setup.acknowledgments.setup.sourceObservedSequence = 9n;
    mocks.read.mockResolvedValue(waiting);
    vi.useFakeTimers();
    const { result, unmount } = renderHookWithProviders(() => useServiceAccess(waiting.key));
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.data?.voucherSetups[0]?.acknowledgments.setup.pending).toBe(true);
      const arrived = structuredClone(waiting);
      arrived.voucherSetups[0]!.acknowledgments.setup.pending = false;
      arrived.voucherSetups[0]!.acknowledgments.setup.sourceObservedSequence = 10n;
      mocks.read.mockResolvedValue(arrived);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001);
      });
      expect(
        result.current.data?.voucherSetups[0]?.acknowledgments.setup.sourceObservedSequence
      ).toBe(10n);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("refreshes actual wallet holdings when a live reward arrives without a local transaction", async () => {
    mocks.rehearsal = false;
    const waiting = createServiceRehearsalSnapshot({ ...key, commitmentId: 1025n });
    delete waiting.pilot;
    waiting.coreState = "FULFILLED";
    waiting.acceptancePolicy.earned.status = "bound";
    const issuer = REHEARSAL_VOUCHER_ISSUERS.techAndSun;
    waiting.earnedReward = {
      id: `0x${"a".repeat(64)}`,
      kind: "voucher",
      asset: issuer.asset,
      amount: 1_000_000n,
      funder: issuer.account,
      status: "on-the-way",
      shortOf: null,
      receipt: null,
      attempts: 0n,
    };
    mocks.read.mockResolvedValue(waiting);
    let credited = false;
    mocks.wallet = async () => ({
      account: key.buyer,
      evidence: "onchain",
      complete: true,
      reason: null,
      issuers: [issuer],
      holdings: [{ issuer, available: credited ? 1_000_000n : 0n }],
      bookings: [],
      returns: [],
    });
    vi.useFakeTimers();
    const { result, unmount } = renderHookWithProviders(() => ({
      read: useServiceAccess(waiting.key),
      wallet: useVoucherWallet(walletScope),
    }));
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.wallet.data?.holdings[0]?.available).toBe(0n);
      credited = true;
      const arrived = structuredClone(waiting);
      arrived.earnedReward!.status = "received";
      mocks.read.mockResolvedValue(arrived);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_010);
      });
      expect(result.current.read.data?.earnedReward?.status).toBe("received");
      expect(result.current.wallet.data?.holdings[0]?.available).toBe(1_000_000n);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });
});
