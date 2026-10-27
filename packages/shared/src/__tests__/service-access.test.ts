import { describe, expect, it } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import {
  selectServiceAccessAction,
  serviceAccessAvailableActions,
} from "../modules/commitment-pooling/service-access";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1022n,
  buyer: "0x0000000000000000000000000000000000000200",
};

describe("service access controller", () => {
  it("permits only the exact current service consent in a labeled rehearsal", () => {
    const snapshot = createServiceRehearsalSnapshot(key);
    expect(
      selectServiceAccessAction(snapshot, {
        action: "requestClaim",
        expectedRevision: snapshot.offer!.revision,
        expectedTermsHash: snapshot.offer!.termsHash,
        requestNonce: 1n,
        buyerGarden: snapshot.eligibleBuyerGardens[0]!.address,
        voucherHolder: `0x${"0".repeat(40)}`,
      })
    ).toEqual({ allowed: true, reason: null });
  });

  it("keeps production unavailable even with complete projected terms", () => {
    const snapshot = createServiceRehearsalSnapshot(key);
    snapshot.evidence = "indexed";
    snapshot.capabilities.mutation = "unavailable";
    expect(
      selectServiceAccessAction(snapshot, {
        action: "withdrawClaim",
        expectedClaimHash: snapshot.offer!.termsHash,
      }).allowed
    ).toBe(false);
  });

  it("rejects a stale revision, consent nonce, garden and route-specific holder", () => {
    const snapshot = createServiceRehearsalSnapshot(key);
    const request = {
      action: "requestClaim" as const,
      expectedRevision: 1n,
      expectedTermsHash: snapshot.offer!.termsHash,
      requestNonce: 1n,
      buyerGarden: snapshot.eligibleBuyerGardens[0]!.address,
      voucherHolder: `0x${"0".repeat(40)}` as const,
    };
    for (const changed of [
      { expectedRevision: 2n },
      { requestNonce: 2n },
      { requestNonce: 1n << 64n },
      { buyerGarden: key.buyer },
      { voucherHolder: key.buyer },
    ])
      expect(selectServiceAccessAction(snapshot, { ...request, ...changed }).allowed).toBe(false);
  });

  it("allows exact-hash withdrawal after a terms revision before requesting the new revision/nonce", async () => {
    const seed = createServiceRehearsalSnapshot(key);
    const adapter = createServiceRehearsalAdapter(
      () => true,
      () => seed
    );
    await adapter.execute(key, {
      action: "requestClaim",
      expectedRevision: 1n,
      expectedTermsHash: seed.offer!.termsHash,
      requestNonce: 1n,
      buyerGarden: seed.eligibleBuyerGardens[0]!.address,
      voucherHolder: `0x${"0".repeat(40)}`,
    });
    const oldHash = seed.consent!.claimHash;
    seed.offer!.revision = 2n;
    seed.offer!.termsHash = `0x${"c".repeat(64)}`;
    await expect(
      adapter.execute(key, {
        action: "pledgePersonal",
        expectedClaimHash: oldHash,
        authorizedDepositor: key.buyer,
        refundAccount: key.buyer,
        reviewedFee: seed.personalFeeQuote!,
      })
    ).rejects.toThrow("action-unavailable");
    await adapter.execute(key, { action: "withdrawClaim", expectedClaimHash: oldHash });
    const renewed = await adapter.execute(key, {
      action: "requestClaim",
      expectedRevision: 2n,
      expectedTermsHash: seed.offer!.termsHash,
      requestNonce: 2n,
      buyerGarden: seed.eligibleBuyerGardens[0]!.address,
      voucherHolder: `0x${"0".repeat(40)}`,
    });
    expect(renewed.snapshot.consent).toMatchObject({
      revision: 2n,
      requestNonce: 2n,
      state: "pending",
    });
    expect(renewed.snapshot.consent!.claimHash).not.toBe(oldHash);
  });
});

describe("local service rehearsal adapter", () => {
  async function requestPersonal() {
    const adapter = createServiceRehearsalAdapter();
    const snapshot = await adapter.read(key);
    await adapter.execute(key, {
      action: "requestClaim",
      expectedRevision: 1n,
      expectedTermsHash: snapshot.offer!.termsHash,
      requestNonce: 1n,
      buyerGarden: snapshot.eligibleBuyerGardens[0]!.address,
      voucherHolder: `0x${"0".repeat(40)}`,
    });
    return adapter;
  }

  it("binds personal payment facts and waits for a privileged steward after payment observation", async () => {
    const adapter = await requestPersonal();
    const snapshot = await adapter.read(key);
    const pledged = await adapter.execute(key, {
      action: "pledgePersonal",
      expectedClaimHash: snapshot.consent!.claimHash,
      authorizedDepositor: key.buyer,
      refundAccount: key.buyer,
      reviewedFee: snapshot.personalFeeQuote!,
    });
    const result = await adapter.execute(key, {
      action: "payPersonal",
      purchaseId: pledged.snapshot.personalPurchase!.purchaseId,
      reviewedFee: snapshot.personalFeeQuote!,
    });
    expect(result.kind).toBe("local-rehearsal");
    expect(result.observationId).toMatch(/^local-rehearsal:/);
    expect(result).not.toHaveProperty("hash");
    expect(result.snapshot.personalPurchase).toMatchObject({
      state: "pledged",
      deposit: null,
      outcome: "none",
      paymentObservation: "observed-awaiting-steward",
      authorizedDepositor: key.buyer,
      recipient: key.buyer,
    });
    expect(result.snapshot.consent!.state).toBe("pending");
    expect(result.snapshot.availableActions).not.toContain("payPersonal");
    expect(result.snapshot.voucherSetups).toEqual([]);
    await expect(
      adapter.execute(key, {
        action: "payPersonal",
        purchaseId: pledged.snapshot.personalPurchase!.purchaseId,
        reviewedFee: snapshot.personalFeeQuote!,
      })
    ).rejects.toThrow("action-unavailable");
  });

  it("requires a new fee review and keeps the immutable pledge unchanged", async () => {
    const adapter = await requestPersonal();
    const snapshot = await adapter.read(key);
    await expect(
      adapter.execute(key, {
        action: "pledgePersonal",
        expectedClaimHash: snapshot.consent!.claimHash,
        authorizedDepositor: key.buyer,
        refundAccount: key.buyer,
        reviewedFee: { ...snapshot.personalFeeQuote!, fee: 1n },
      })
    ).rejects.toThrow("fee-changed");
    expect((await adapter.read(key)).personalPurchase).toBeNull();
  });

  it("does not turn third-party depositing consent into signing authority", async () => {
    const adapter = await requestPersonal();
    const snapshot = await adapter.read(key);
    const other = "0x0000000000000000000000000000000000000999";
    const pledged = await adapter.execute(key, {
      action: "pledgePersonal",
      expectedClaimHash: snapshot.consent!.claimHash,
      authorizedDepositor: other,
      refundAccount: key.buyer,
      reviewedFee: snapshot.personalFeeQuote!,
    });
    expect(pledged.snapshot.personalPurchase!.authorizedDepositor).toBe(other);
    expect(pledged.snapshot.capabilities.celoDepositor).toBe(key.buyer);
    expect(pledged.snapshot.availableActions).not.toContain("payPersonal");
    await expect(
      adapter.execute(key, {
        action: "payPersonal",
        purchaseId: pledged.snapshot.personalPurchase!.purchaseId,
        reviewedFee: snapshot.personalFeeQuote!,
      })
    ).rejects.toThrow("action-unavailable");
  });

  it("permits only a genuinely renewed purchase after the previous funding is withdrawn or refunded", async () => {
    const adapter = await requestPersonal();
    const requested = await adapter.read(key);
    const pledged = await adapter.execute(key, {
      action: "pledgePersonal",
      expectedClaimHash: requested.consent!.claimHash,
      authorizedDepositor: key.buyer,
      refundAccount: key.buyer,
      reviewedFee: requested.personalFeeQuote!,
    });
    for (const state of [
      "withdrawn",
      "refunded",
      "pledged",
      "deposit-recorded",
      "consumed",
      "refund-queued",
    ] as const) {
      const current = structuredClone(pledged.snapshot);
      current.personalPurchase!.state = state;
      current.consent!.requestNonce = 2n;
      current.consent!.claimHash = `0x${"d".repeat(64)}`;
      expect(serviceAccessAvailableActions(current).includes("pledgePersonal")).toBe(
        state === "withdrawn" || state === "refunded"
      );
      expect(serviceAccessAvailableActions(current)).not.toContain("payPersonal");
      if (state === "withdrawn" || state === "refunded") {
        const renewed = createServiceRehearsalAdapter(
          () => true,
          () => current
        );
        const result = await renewed.execute(key, {
          action: "pledgePersonal",
          expectedClaimHash: current.consent!.claimHash,
          authorizedDepositor: key.buyer,
          refundAccount: key.buyer,
          reviewedFee: current.personalFeeQuote!,
        });
        expect(result.snapshot.personalPurchase!.requestNonce).toBe(2n);
        expect(result.snapshot.personalPurchase!.purchaseId).not.toBe(
          pledged.snapshot.personalPurchase!.purchaseId
        );
        expect(pledged.snapshot.personalPurchase!.requestNonce).toBe(1n);
      }
    }
    for (const nonce of [0n, 1n]) {
      const current = structuredClone(pledged.snapshot);
      current.personalPurchase!.state = "withdrawn";
      current.consent!.requestNonce = nonce;
      expect(serviceAccessAvailableActions(current)).not.toContain("pledgePersonal");
    }
  });
});
