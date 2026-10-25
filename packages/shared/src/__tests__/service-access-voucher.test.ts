import { describe, expect, it } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import {
  selectServiceAccessAction,
  serviceAccessAvailableActions,
} from "../modules/commitment-pooling/service-access";
import { voucherSetupAvailableActions } from "../modules/commitment-pooling/service-access-voucher";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200",
};
const OTHER = "0x0000000000000000000000000000000000000999";
const HASH = `0x${"e".repeat(64)}` as const;
const seed = () => createServiceRehearsalSnapshot(key);
const bound = (s: ReturnType<typeof seed>, index = 0) => {
  const r = s.voucherSetups[index]!;
  return {
    sourceChainId: r.authorization.sourceChainId,
    sourceModule: r.authorization.sourceModule,
    setupId: r.setupId,
    expectedAuthorizationHash: r.authorizationHash,
  };
};
const allocation = {
  approvedDeliveredServiceUnits: 3n,
  releaseVoucherUnits: 40n,
  refundVoucherUnits: 60n,
};
const freeze = (s: ReturnType<typeof seed>) => ({
  action: "finalizeVoucherAllocation" as const,
  ...bound(s),
  expectedActivationDecisionId: s.voucherSetups[0]!.destination!.result.appliedDecisionId!,
  allocation,
});

async function pending() {
  const s = createServiceRehearsalSnapshot({ ...key, commitmentId: 1023n });
  const adapter = createServiceRehearsalAdapter(
    () => true,
    () => s
  );
  await adapter.execute(s.key, {
    action: "requestClaim",
    expectedRevision: 1n,
    expectedTermsHash: s.offer!.termsHash,
    requestNonce: 1n,
    buyerGarden: s.eligibleBuyerGardens[0]!.address,
    voucherHolder: s.key.buyer,
  });
  return { s, adapter };
}

describe("setup before acceptance", () => {
  it("does not offer incremental release or return before one immutable final allocation", () => {
    const snapshot = createServiceRehearsalSnapshot(key);
    const actions = serviceAccessAvailableActions(snapshot);
    expect(actions).not.toContain("approveDelivered");
    expect(actions).not.toContain("returnUndelivered");
  });

  it("offers pending setup review while the exact service claim is still Offered", async () => {
    const pendingKey = { ...key, commitmentId: 1023n };
    const adapter = createServiceRehearsalAdapter();
    const initial = await adapter.read(pendingKey);
    const requested = await adapter.execute(pendingKey, {
      action: "requestClaim",
      expectedRevision: initial.offer!.revision,
      expectedTermsHash: initial.offer!.termsHash,
      requestNonce: initial.nextRequestNonce,
      buyerGarden: initial.eligibleBuyerGardens[0]!.address,
      voucherHolder: pendingKey.buyer,
    });
    expect(requested.snapshot.coreState).toBe("OFFERED");
    expect(requested.snapshot.consent?.state).toBe("pending");
    expect(serviceAccessAvailableActions(requested.snapshot)).toContain("prepareVoucherSetup");
  });

  it("binds pending exact consent and a reviewed source deadline without accepting or approving issuer terms", async () => {
    const { s, adapter } = await pending();
    const action = {
      action: "prepareVoucherSetup" as const,
      expectedRevision: 1n,
      expectedTermsHash: s.offer!.termsHash,
      expectedClaimHash: s.consent!.claimHash,
      expectedRequestNonce: 1n,
      acceptanceDeadline: 1000n,
    };
    for (const patch of [
      { acceptanceDeadline: 999n },
      { acceptanceDeadline: 1n << 64n },
      { expectedRequestNonce: 2n },
      { expectedClaimHash: HASH },
      { expectedRevision: 2n },
    ])
      await expect(adapter.execute(s.key, { ...action, ...patch })).rejects.toThrow();
    await adapter.execute(s.key, action);
    const row = s.voucherSetups[0]!;
    expect(row.authorization.acceptanceDeadline).toBe(1000n);
    expect(s.coreState).toBe("OFFERED");
    expect(s.consent!.state).toBe("pending");
    const sent = await adapter.execute(s.key, {
      action: "dispatchVoucherSetupCommand",
      ...bound(s),
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: 0n,
    });
    expect(sent.snapshot.voucherSetups[0]!.destination!.result.issuerApproved).toBe(false);
    expect(sent.snapshot.voucherSetups[0]!.availableActions).not.toContain("presentVoucherSetup");
    expect(sent).not.toHaveProperty("transactionHash");
  });

  it("keeps the actual holder signer fixed when a different holder is named", async () => {
    const { s, adapter } = await pending();
    s.consent!.voucherHolder = OTHER;
    await adapter.execute(s.key, {
      action: "prepareVoucherSetup",
      expectedRevision: 1n,
      expectedTermsHash: s.offer!.termsHash,
      expectedClaimHash: s.consent!.claimHash,
      expectedRequestNonce: 1n,
      acceptanceDeadline: 1200n,
    });
    await adapter.execute(s.key, {
      action: "dispatchVoucherSetupCommand",
      ...bound(s),
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: 0n,
    });
    s.voucherSetups[0]!.destination!.result.issuerApproved = true;
    expect(s.capabilities.gnosisHolder).toBe(key.buyer);
    expect(voucherSetupAvailableActions(s, s.voucherSetups[0]!)).not.toContain(
      "approveVoucherAllowance"
    );
  });

  it.each([
    "ACCEPTED",
    "FULFILLED",
    "CANCELLED",
    "EXPIRED",
    "DISPUTED",
  ])("retains permanent exact acceptance through %s", (state) => {
    const s = seed(),
      row = s.voucherSetups[0]!;
    s.coreState = state;
    s.pause.sourceVoucher = true;
    row.source.timestamp = 99999n;
    row.source.decision = "none";
    row.source.decisionId = null;
    expect(voucherSetupAvailableActions(s, row)).toContain("finalizeVoucherActivation");
    expect(voucherSetupAvailableActions(s, row)).not.toContain("abortVoucherSetup");
  });

  it("uses per-setup holder capabilities rather than borrowing a new claim's signer", () => {
    const s = seed();
    const old = structuredClone(s.voucherSetups[0]!);
    old.setupId = HASH;
    old.authorization.holder = OTHER;
    s.voucherSetups = [...s.voucherSetups, old];
    expect(selectServiceAccessAction(s, { ...freeze(s), ...bound(s, 1) }).allowed).toBe(false);
    expect(selectServiceAccessAction(s, freeze(s)).allowed).toBe(true);
  });
});

describe("one final allocation and independent fixed legs", () => {
  it("freezes3 service units and40/60 vouchers with no transfer, then closes legs independently of core and source ACK", async () => {
    const s = seed(),
      adapter = createServiceRehearsalAdapter(
        () => true,
        () => s
      );
    const result = await adapter.execute(key, freeze(s));
    const f = result.snapshot.voucherSetups[0]!.destination!.finalAllocation!;
    expect(f.allocation).toEqual(allocation);
    expect(f.release.state).toBe("pending");
    expect(f.refund.state).toBe("pending");
    expect(s.voucherSetups[0]!.destination!.holderBalance).toBe(0n);
    for (const leg of ["refund", "release"] as const)
      await adapter.execute(key, {
        action: "executeVoucherFinalLeg",
        ...bound(s),
        expectedDecisionId: f.decisionId,
        leg,
      });
    const row = (await adapter.read(key)).voucherSetups[0]!;
    expect(row.destination!.finalAllocation!.financiallyClosed).toBe(true);
    expect(row.destination!.holderBalance).toBe(60n);
    const closed = structuredClone(row.destination!.finalAllocation);
    const sequence = s.voucherSetups[0]!.destination!.result.sequence;
    await adapter.execute(key, {
      action: "dispatchVoucherSetupCommand",
      ...bound(s),
      kind: "decision",
      expectedDecisionId: s.voucherSetups[0]!.source.decisionId,
      reviewedNativeFee: 0n,
    });
    expect(s.voucherSetups[0]!.destination!.finalAllocation).toEqual(closed);
    expect(s.voucherSetups[0]!.destination!.result.sequence).toBe(sequence);
    expect(s.coreState).toBe("ACCEPTED");
    expect(row.source.finalResult).toBeNull();
    expect(row.acknowledgments.final.pending).toBe(true);
    await adapter.execute(key, {
      action: "retryVoucherFinalAcknowledgment",
      ...bound(s),
      reviewedNativeFee: 0n,
    });
    expect(s.voucherSetups[0]!.acknowledgments.final.sent).toBe(true);
    expect(s.voucherSetups[0]!.acknowledgments.final.sourceObservedSequence).toBe(0n);
    await expect(
      adapter.execute(key, {
        action: "executeVoucherFinalLeg",
        ...bound(s),
        expectedDecisionId: f.decisionId,
        leg: "refund",
      })
    ).rejects.toThrow();
    await expect(adapter.execute(key, freeze(s))).rejects.toThrow();
  });

  it("stores a failed fixed release without preventing holder refund, then retries only that leg", async () => {
    let succeeds = false;
    const s = seed(),
      adapter = createServiceRehearsalAdapter(
        () => succeeds,
        () => s
      );
    await adapter.execute(key, freeze(s));
    const f = s.voucherSetups[0]!.destination!.finalAllocation!;
    const action = {
      action: "executeVoucherFinalLeg" as const,
      ...bound(s),
      expectedDecisionId: f.decisionId,
    };
    await adapter.execute(key, { ...action, leg: "release" });
    expect(f.release.state).toBe("failed");
    expect(f.release.attempts).toBe(1n);
    succeeds = true;
    await adapter.execute(key, { ...action, leg: "refund" });
    expect(f.refund.state).toBe("succeeded");
    expect(f.release.state).toBe("failed");
    await adapter.execute(key, { ...action, leg: "release" });
    expect(f.release.attempts).toBe(2n);
    expect(f.allocation).toEqual(allocation);
  });

  it("rejects stale setup, activation, final decision, fee and invalid full splits", async () => {
    const s = seed(),
      adapter = createServiceRehearsalAdapter(
        () => true,
        () => s
      );
    const action = freeze(s);
    for (const patch of [
      { setupId: HASH },
      { sourceModule: OTHER },
      { sourceChainId: 100 },
      { expectedAuthorizationHash: HASH },
      { expectedActivationDecisionId: HASH },
      { allocation: { ...allocation, releaseVoucherUnits: 41n } },
      { allocation: { ...allocation, approvedDeliveredServiceUnits: 11n } },
      { allocation: { ...allocation, approvedDeliveredServiceUnits: 0n } },
      { allocation: { ...allocation, releaseVoucherUnits: 39n, refundVoucherUnits: 61n } },
    ])
      await expect(adapter.execute(key, { ...action, ...patch })).rejects.toThrow();
    await expect(
      adapter.execute(key, {
        action: "retryVoucherSetupAcknowledgment",
        ...bound(s),
        reviewedNativeFee: 1n,
      })
    ).rejects.toThrow("fee-changed");
    expect(s.voucherSetups[0]!.destination!.finalAllocation).toBeNull();
  });

  it("keeps holder remedies independent of source signer/pause and blocks execution during destination pause while allowing ACK", () => {
    const s = seed();
    s.capabilities.canSignSource = false;
    s.capabilities.sourceBuyer = OTHER;
    s.pause.sourceVoucher = true;
    s.pause.core = true;
    expect(serviceAccessAvailableActions(s)).toContain("finalizeVoucherAllocation");
    s.pause.destinationVoucher = true;
    expect(serviceAccessAvailableActions(s)).not.toContain("finalizeVoucherAllocation");
    expect(serviceAccessAvailableActions(s)).toContain("retryVoucherSetupAcknowledgment");
    s.capabilities.gnosisHolder = OTHER;
    expect(serviceAccessAvailableActions(s)).not.toContain("finalizeVoucherAllocation");
  });

  it("does not satisfy independent earned consent by a deposited or accepted service setup", () => {
    const s = seed();
    s.acceptancePolicy.earned.status = "bound";
    s.acceptancePolicy.earned.revision = 9n;
    s.acceptancePolicy.earned.participantConsentRevision = null;
    s.acceptancePolicy.blockGenericMemberAcceptance = true;
    expect(s.voucherSetups[0]!.source.acceptedEver).not.toBeNull();
    expect(s.acceptancePolicy.earned.participantConsentRevision).toBeNull();
    expect(s.acceptancePolicy.earned.accountRouteAvailable).toBe(false);
    expect(serviceAccessAvailableActions(s)).toContain("finalizeVoucherAllocation");
  });
});
