import { selectServiceAccessAction } from "../modules/commitment-pooling/service-access";
import { voucherSetupAvailableActions } from "../modules/commitment-pooling/service-access-voucher";
import { describe, expect, it } from "vitest";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { createServiceRehearsalAdapter } from "../modules/commitment-pooling/demo/demo-service-access";
import type { ServiceAccessKey } from "../modules/commitment-pooling/service-access-types";

const HASH = `0x${"e".repeat(64)}` as const;
const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: "0x0000000000000000000000000000000000000100",
  commitmentId: 1024n,
  buyer: "0x0000000000000000000000000000000000000200",
};
function deposited() {
  const s = createServiceRehearsalSnapshot(key),
    row = s.voucherSetups[0]!;
  s.coreState = "OFFERED";
  s.consent!.state = "pending";
  Object.assign(row.source, {
    decision: "none",
    decisionId: null,
    acceptedEver: null,
    acceptedReceiptHash: null,
    setupResult: null,
  });
  Object.assign(row.destination!.result, {
    phase: "deposited",
    decision: "none",
    appliedDecisionId: null,
  });
  row.acknowledgments.setup.sourceObservedSequence = 0n;
  const bound = {
    sourceChainId: row.authorization.sourceChainId,
    sourceModule: row.authorization.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
  return {
    s,
    row,
    bound,
    adapter: createServiceRehearsalAdapter(
      () => true,
      () => s
    ),
  };
}

describe("local rehearsal immutable Abort recovery", () => {
  it("returns the actual full destination deposit despite a lost deposit acknowledgment, only once", async () => {
    const f = deposited();
    await f.adapter.execute(key, { action: "abortVoucherSetup", ...f.bound });
    const command = {
      action: "dispatchVoucherSetupCommand" as const,
      ...f.bound,
      kind: "decision" as const,
      expectedDecisionId: f.row.source.decisionId,
      reviewedNativeFee: 0n,
    };
    await f.adapter.execute(key, command);
    expect(f.row.destination!.result).toMatchObject({
      phase: "aborted",
      depositedUnits: 100n,
      setupRefundedUnits: 100n,
    });
    expect(f.row.destination!.holderBalance).toBe(100n);
    await f.adapter.execute(key, command);
    expect(f.row.destination!.holderBalance).toBe(100n);
    expect(f.row.source.setupResult).toBeNull();
    expect(f.s.coreState).toBe("OFFERED");
  });

  it("tombstones a failed pre-deposit action so Abort cannot be followed by a late deposit retry", async () => {
    const f = deposited(),
      d = f.row.destination!;
    Object.assign(d.result, {
      phase: "authorized",
      depositedUnits: 0n,
      depositReceiptHash: null,
      actionSucceeded: false,
      failureHash: f.row.authorizationHash,
    });
    d.holderBalance = 100n;
    d.allowance = 100n;
    d.pendingAction = "deposit";
    await f.adapter.execute(key, { action: "abortVoucherSetup", ...f.bound });
    await f.adapter.execute(key, {
      action: "dispatchVoucherSetupCommand",
      ...f.bound,
      kind: "decision",
      expectedDecisionId: f.row.source.decisionId,
      reviewedNativeFee: 0n,
    });
    const tombstone = await f.adapter.read(key);
    expect(tombstone.voucherSetups[0]!.destination).toMatchObject({
      pendingAction: null,
      result: { phase: "aborted", actionSucceeded: true, failureHash: null, depositedUnits: 0n },
    });
    expect(tombstone.voucherSetups[0]!.availableActions).not.toContain("retryVoucherSetupAction");
    await f.adapter.execute(key, {
      action: "dispatchVoucherSetupCommand",
      ...f.bound,
      kind: "authorization",
      expectedDecisionId: null,
      reviewedNativeFee: 0n,
    });
    expect(f.row.destination!.result.phase).toBe("aborted");
    expect(f.row.destination!.result.depositedUnits).toBe(0n);
  });

  it("treats expiry only as source Abort eligibility and never a local destination refund", () => {
    const { s, row } = deposited();
    row.source.acceptedEver = null;
    row.source.acceptedReceiptHash = null;
    row.source.decision = "none";
    row.source.decisionId = null;
    s.coreState = "OFFERED";
    s.consent!.state = "pending";
    s.capabilities.canSignSource = false;
    row.source.timestamp = 2000n;
    expect(voucherSetupAvailableActions(s, row)).not.toContain("abortVoucherSetup");
    row.source.timestamp = 2001n;
    expect(voucherSetupAvailableActions(s, row)).toContain("abortVoucherSetup");
    expect(row.destination!.result.setupRefundedUnits).toBe(0n);
    expect(row.destination!.holderBalance).toBe(0n);
  });

  it("preserves old claim recovery when current consent and route change", () => {
    const { s, row, bound } = deposited();
    row.relationship = "prior";
    row.source.acceptedEver = null;
    row.source.decision = "none";
    row.source.decisionId = null;
    s.coreState = "ACCEPTED";
    s.consent!.state = "accepted";
    s.mode = "personal-gd";
    s.offer!.route = "personal-gd";
    s.offer!.revision = 2n;
    s.consent!.claimHash = HASH;
    s.consent!.requestNonce = 2n;
    s.pause.sourceVoucher = true;
    expect(selectServiceAccessAction(s, { action: "abortVoucherSetup", ...bound }).allowed).toBe(
      true
    );
    expect(s.personalPurchase).toBeNull();
  });
});
