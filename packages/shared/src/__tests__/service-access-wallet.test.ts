import { describe, expect, it } from "vitest";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import { REHEARSAL_VOUCHER_ISSUERS } from "../modules/commitment-pooling/demo/demo-service-wallet";
import type { ServiceChainRead } from "../modules/commitment-pooling/service-access-chain";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";
import {
  readVoucherIssuerApproval,
  requestRewardDeliveries,
} from "../modules/commitment-pooling/service-access-wallet";
import type { VoucherWalletScope } from "../modules/commitment-pooling/service-access-wallet-types";

const buyer = "0x0000000000000000000000000000000000000200";
const scope: VoucherWalletScope = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  account: buyer,
};
const key = (commitmentId: bigint): ServiceAccessKey => ({
  sourceChainId: scope.sourceChainId,
  coreModule: scope.coreModule,
  commitmentId,
  buyer,
});
const request = key(1025n);
const hubDay = key(1023n);
/** The rehearsal also carries commitment 1024's prepared booking; these cases follow the hub day. */
const ofHubDay = <T extends { booking: { commitmentId: bigint } }>(rows: readonly T[]) =>
  rows.filter((row) => row.booking.commitmentId === 1023n);
const observe = (
  observation:
    | "work-fulfilled"
    | "voucher-budget-repaired"
    | "issuer-approved"
    | "provider-accepted"
) => ({ action: "observePilotRole" as const, observation });

/** Earn one Tech and Sun voucher, then book the hub day and deposit it into escrow. */
async function depositedHubDay(transfer: () => boolean = () => true) {
  const adapter = createServiceRehearsalAdapter(transfer);
  await adapter.execute(request, observe("work-fulfilled"));
  await adapter.execute(request, observe("voucher-budget-repaired"));
  await adapter.execute(request, { action: "deliverPilotReward", asset: "voucher" });
  const offer = await adapter.read(hubDay);
  await adapter.execute(hubDay, {
    action: "requestClaim",
    expectedRevision: offer.offer!.revision,
    expectedTermsHash: offer.offer!.termsHash,
    requestNonce: 1n,
    buyerGarden: offer.eligibleBuyerGardens[0]!.address,
    voucherHolder: buyer,
  });
  const claim = await adapter.read(hubDay);
  const prepared = await adapter.execute(hubDay, {
    action: "prepareVoucherSetup",
    expectedRevision: claim.offer!.revision,
    expectedTermsHash: claim.offer!.termsHash,
    expectedClaimHash: claim.consent!.claimHash,
    expectedRequestNonce: 1n,
    acceptanceDeadline: 2000n,
  });
  const row = prepared.snapshot.voucherSetups[0]!;
  const bound = {
    sourceChainId: row.authorization.sourceChainId,
    sourceModule: row.authorization.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
  await adapter.execute(hubDay, {
    action: "dispatchVoucherSetupCommand",
    ...bound,
    kind: "authorization",
    expectedDecisionId: null,
    reviewedNativeFee: 0n,
  });
  const beforeApproval = await adapter.wallet(scope);
  await adapter.execute(hubDay, observe("issuer-approved"));
  const beforeDeposit = await adapter.wallet(scope);
  await adapter.execute(hubDay, { action: "approveVoucherAllowance", ...bound });
  await adapter.execute(hubDay, { action: "presentVoucherSetup", ...bound });
  return { adapter, bound, beforeApproval, beforeDeposit };
}

describe("voucher wallet reads", () => {
  it("follows one booking's escrow from approval to a settled split, returns pending until they arrive", async () => {
    let transfer = true;
    const { adapter, bound, beforeApproval, beforeDeposit } = await depositedHubDay(() => transfer);
    const tas = REHEARSAL_VOUCHER_ISSUERS.techAndSun;
    expect(ofHubDay(beforeApproval.bookings)).toMatchObject([
      { held: 0n, stage: "awaiting-approval" },
    ]);
    expect(ofHubDay(beforeDeposit.bookings)).toMatchObject([
      { held: 0n, stage: "awaiting-deposit" },
    ]);
    expect(beforeDeposit.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(
      1_000_000n
    );

    const held = await adapter.wallet(scope);
    expect(held.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(0n);
    expect(ofHubDay(held.bookings)).toMatchObject([
      {
        booking: { commitmentId: 1023n, setupId: bound.setupId },
        agreed: 1_000_000n,
        held: 1_000_000n,
        stage: "held",
      },
    ]);
    expect(ofHubDay(held.returns)).toEqual([]);

    await adapter.execute(hubDay, {
      action: "retryVoucherSetupAcknowledgment",
      ...bound,
      reviewedNativeFee: 0n,
    });
    await adapter.execute(hubDay, {
      action: "observePilotRole",
      observation: "deposit-acknowledged",
    });
    const accepted = await adapter.execute(hubDay, observe("provider-accepted"));
    const activated = await adapter.execute(hubDay, {
      action: "finalizeVoucherActivation",
      ...bound,
      expectedAcceptedReceiptHash: accepted.snapshot.voucherSetups[0]!.source.acceptedReceiptHash!,
    });
    const decision = activated.snapshot.voucherSetups[0]!.source.decisionId!;
    await adapter.execute(hubDay, {
      action: "dispatchVoucherSetupCommand",
      ...bound,
      kind: "decision",
      expectedDecisionId: decision,
      reviewedNativeFee: 0n,
    });
    const split = await adapter.execute(hubDay, {
      action: "finalizeVoucherAllocation",
      ...bound,
      expectedActivationDecisionId: decision,
      allocation: {
        approvedDeliveredServiceUnits: 1n,
        releaseVoucherUnits: 400_000n,
        refundVoucherUnits: 600_000n,
      },
    });
    const leg = (name: "release" | "refund") =>
      adapter.execute(hubDay, {
        action: "executeVoucherFinalLeg",
        ...bound,
        expectedDecisionId:
          split.snapshot.voucherSetups[0]!.destination!.finalAllocation!.decisionId,
        leg: name,
      });
    const settling = await adapter.wallet(scope);
    expect(ofHubDay(settling.bookings)).toMatchObject([{ held: 1_000_000n, stage: "settling" }]);
    expect(ofHubDay(settling.returns)).toMatchObject([
      { amount: 600_000n, cause: "split", state: "pending", attempts: 0n },
    ]);

    transfer = false;
    await leg("refund");
    const failed = await adapter.wallet(scope);
    expect(ofHubDay(failed.returns)).toMatchObject([
      { amount: 600_000n, state: "failed", attempts: 1n },
    ]);
    expect(failed.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(0n);

    transfer = true;
    await leg("refund");
    const back = await adapter.wallet(scope);
    expect(ofHubDay(back.returns)).toEqual([]);
    expect(ofHubDay(back.bookings)).toMatchObject([{ held: 400_000n, stage: "settling" }]);
    expect(back.holdings.find((h) => h.issuer.account === tas.account)?.available).toBe(600_000n);

    await leg("release");
    expect(ofHubDay((await adapter.wallet(scope)).bookings)).toEqual([]);
  });

  it("shows a cancellation's vouchers as coming back until the refund reaches the account", async () => {
    let transfer = true;
    const { adapter, bound } = await depositedHubDay(() => transfer);
    const aborted = await adapter.execute(hubDay, { action: "abortVoucherSetup", ...bound });
    const canceling = await adapter.wallet(scope);
    expect(ofHubDay(canceling.bookings)).toMatchObject([{ held: 1_000_000n, stage: "returning" }]);
    expect(ofHubDay(canceling.returns)).toMatchObject([
      { amount: 1_000_000n, cause: "cancellation", state: "pending" },
    ]);

    transfer = false;
    const dispatch = {
      action: "dispatchVoucherSetupCommand" as const,
      ...bound,
      kind: "decision" as const,
      expectedDecisionId: aborted.snapshot.voucherSetups[0]!.source.decisionId,
      reviewedNativeFee: 0n,
    };
    await adapter.execute(hubDay, dispatch);
    expect(ofHubDay((await adapter.wallet(scope)).returns)).toMatchObject([
      { amount: 1_000_000n, cause: "cancellation", state: "failed" },
    ]);

    transfer = true;
    await adapter.execute(hubDay, { action: "retryVoucherSetupAction", ...bound });
    const refunded = await adapter.wallet(scope);
    expect(ofHubDay(refunded.returns)).toEqual([]);
    expect(ofHubDay(refunded.bookings)).toEqual([]);
    expect(
      refunded.holdings.find(
        (h) => h.issuer.account === REHEARSAL_VOUCHER_ISSUERS.techAndSun.account
      )?.available
    ).toBe(1_000_000n);
  });

  it.each([
    [
      "a Safe's own threshold",
      2n,
      ["0x01", "0x02", "0x03", "0x04", "0x05"],
      { kind: "safe", threshold: 2, owners: 5 },
    ],
    [
      "a threshold above its owners",
      3n,
      ["0x01", "0x02"],
      { kind: "unavailable", reason: "read-failed" },
    ],
    ["a repeated owner", 1n, ["0x01", "0x01"], { kind: "unavailable", reason: "read-failed" }],
    ["a zero threshold", 0n, ["0x01"], { kind: "unavailable", reason: "read-failed" }],
  ] as const)("reads the signature count from the issuer: %s", async (_case, threshold, owners, expected) => {
    const read: ServiceChainRead = async ({ functionName, chainId, address }) => {
      expect([chainId, address]).toEqual([100, REHEARSAL_VOUCHER_ISSUERS.greenGoods.account]);
      return functionName === "getThreshold"
        ? threshold
        : owners.map((owner) => owner.padEnd(42, "0"));
    };
    expect(
      await readVoucherIssuerApproval(read, REHEARSAL_VOUCHER_ISSUERS.greenGoods)
    ).toMatchObject(expected);
  });

  it("answers without a Safe read for a member's own account, and reports a failed read", async () => {
    const reverting: ServiceChainRead = async () => {
      throw new Error("execution reverted");
    };
    const member = { ...REHEARSAL_VOUCHER_ISSUERS.techAndSun, kind: "individual" as const };
    expect(await readVoucherIssuerApproval(reverting, member)).toEqual({
      kind: "account",
      evidence: "onchain",
    });
    expect(
      await readVoucherIssuerApproval(reverting, REHEARSAL_VOUCHER_ISSUERS.techAndSun)
    ).toEqual({ kind: "unavailable", reason: "read-failed" });
  });

  it("keeps each reward's delivery apart: waiting on a short reserve while G$ arrives", async () => {
    let transfer = true;
    const adapter = createServiceRehearsalAdapter(() => transfer);
    const both = key(1026n);
    const status = async () =>
      requestRewardDeliveries(await adapter.read(both))!.map(({ kind, status, shortOf }) => ({
        kind,
        status,
        shortOf,
      }));
    expect(await status()).toEqual([
      { kind: "voucher", status: "after-work", shortOf: null },
      { kind: "gd", status: "after-work", shortOf: null },
    ]);
    await adapter.execute(both, observe("work-fulfilled"));
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    await adapter.execute(both, { action: "deliverPilotReward", asset: "gd" });
    expect(await status()).toEqual([
      { kind: "voucher", status: "waiting", shortOf: "reserve" },
      { kind: "gd", status: "received", shortOf: null },
    ]);
    await adapter.execute(both, observe("voucher-budget-repaired"));
    transfer = false;
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    expect((await status())[0]).toEqual({ kind: "voucher", status: "delayed", shortOf: null });
    transfer = true;
    await adapter.execute(both, { action: "deliverPilotReward", asset: "voucher" });
    expect((await status())[0]).toEqual({ kind: "voucher", status: "received", shortOf: null });
    expect(requestRewardDeliveries(await adapter.read(hubDay))).toBeNull();
  });
});
