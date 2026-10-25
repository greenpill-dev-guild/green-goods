import { indexer } from "envio";
import {
  assertSame,
  cursor,
  identity,
  integer,
  position,
  smallInteger,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { finalAllocation, sameFacts, serviceCustody } from "./voucher-service-projections";

/** A complete immutable holder split; leg attempts never create a second allocation. */
export async function projectVoucherServiceFinal(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params,
    record = await finalAllocation(event, context),
    custody = await serviceCustody(event, context);
  if (custody.finalAllocationEntityId !== undefined)
    assertSame(custody.finalAllocationEntityId, record.id, "one final allocation per setup");
  let next = { ...record, ...times(event, record) };
  if (event.eventName === "FinalAllocationFrozen") {
    const facts = {
      holder: text(p, "holder"),
      payloadHash: text(p, "payloadHash"),
      activationDecisionId: text(p, "activationDecisionId"),
      approvedDeliveredServiceUnits: integer(p, "approvedDeliveredServiceUnits"),
      releaseVoucherUnits: integer(p, "releaseVoucherUnits"),
      refundVoucherUnits: integer(p, "refundVoucherUnits"),
      issuerReturnApprovalAtFreeze: integer(p, "issuerReturnApprovalAtFreeze"),
    };
    sameFacts(record, facts, "immutable holder final allocation");
    if (custody.holder !== undefined)
      assertSame(custody.holder, facts.holder, "final allocation holder");
    if (custody.authorizationHash !== undefined)
      assertSame(custody.authorizationHash, facts.payloadHash, "final allocation authorization");
    if (custody.voucherUnits !== undefined)
      assertSame(
        facts.releaseVoucherUnits + facts.refundVoucherUnits,
        custody.voucherUnits,
        "final voucher conservation"
      );
    if (
      (custody.serviceUnits !== undefined &&
        facts.approvedDeliveredServiceUnits > custody.serviceUnits) ||
      facts.refundVoucherUnits > facts.issuerReturnApprovalAtFreeze ||
      (facts.releaseVoucherUnits > 0n && facts.approvedDeliveredServiceUnits === 0n)
    )
      throw new Error("Invalid final split quantities");
    if (record.freezeSeen) return;
    for (const leg of [0, 1]) {
      const attempts = leg === 0 ? record.releaseAttempts : record.refundAttempts;
      if (attempts === undefined) continue;
      const previous = await context.VoucherServiceFinalLegResult.get(
        `${record.id}-${leg}-${attempts}`
      );
      if (previous) {
        assertSame(
          previous.voucherUnits,
          leg === 0 ? facts.releaseVoucherUnits : facts.refundVoucherUnits,
          "final leg amount"
        );
        if (leg === 1) assertSame(previous.recipient, facts.holder, "final refund holder");
      }
    }
    next = {
      ...next,
      ...facts,
      freezeSeen: true,
      releaseState: record.releaseState ?? (facts.releaseVoucherUnits === 0n ? 0 : 1),
      refundState: record.refundState ?? (facts.refundVoucherUnits === 0n ? 0 : 1),
      releaseAttempts: record.releaseAttempts ?? 0n,
      refundAttempts: record.refundAttempts ?? 0n,
      ...cursor("frozen", event),
    };
  } else if (event.eventName === "FinalLegResult") {
    const leg = smallInteger(p, "leg", 1n),
      attempts = integer(p, "attempts");
    const facts = {
      leg,
      legId: text(p, "legId"),
      recipient: text(p, "recipient"),
      voucherUnits: integer(p, "voucherUnits"),
      state: smallInteger(p, "state", 3n),
      attempts,
      failureHash: text(p, "failureHash"),
    };
    if (attempts === 0n || (facts.state !== 2 && facts.state !== 3))
      throw new Error("Invalid final leg attempt");
    const expectedUnits = leg === 0 ? record.releaseVoucherUnits : record.refundVoucherUnits;
    if (expectedUnits !== undefined)
      assertSame(expectedUnits, facts.voucherUnits, "final leg amount");
    const recipient = leg === 0 ? custody.issuer : custody.holder;
    if (recipient !== undefined) assertSame(recipient, facts.recipient, "final leg recipient");
    const row = {
      ...identity(event, `${record.setupId}-${record.decisionId}-${leg}-${attempts}`),
      setupId: record.setupId,
      decisionId: record.decisionId,
      allocationEntityId: record.id,
      ...facts,
      ...position(event),
    };
    const existing = await context.VoucherServiceFinalLegResult.get(row.id);
    if (existing) {
      sameFacts(existing, facts, "immutable final leg attempt");
      return;
    }
    const priorAttempts = leg === 0 ? record.releaseAttempts : record.refundAttempts;
    if (priorAttempts !== undefined && priorAttempts > 0n) {
      const prior = await context.VoucherServiceFinalLegResult.get(
        `${record.id}-${leg}-${priorAttempts}`
      );
      if (prior)
        sameFacts(
          prior,
          { legId: facts.legId, recipient: facts.recipient, voucherUnits: facts.voucherUnits },
          "immutable final leg payload"
        );
    }
    if (attempts > (priorAttempts ?? 0n)) {
      const priorState = leg === 0 ? record.releaseState : record.refundState;
      if (priorState === 3 && facts.state !== 3)
        throw new Error("Successful final leg cannot regress");
      next = {
        ...next,
        ...(leg === 0
          ? {
              releaseState: facts.state,
              releaseAttempts: attempts,
              releaseFailureHash: facts.failureHash,
            }
          : {
              refundState: facts.state,
              refundAttempts: attempts,
              refundFailureHash: facts.failureHash,
            }),
      };
    }
    await context.VoucherServiceFinalLegResult.set(row);
  } else if (event.eventName === "VoucherEscrowFinanciallyClosed") {
    if (record.financialClosedSeen) return;
    next = { ...next, financialClosedSeen: true, ...cursor("closed", event) };
  } else throw new Error("Unrouted final voucher event");
  await context.VoucherServiceFinalAllocation.set(next);
  await context.VoucherServiceCustody.set({
    ...custody,
    finalAllocationEntityId: record.id,
    financialClosedSeen: custody.financialClosedSeen || next.financialClosedSeen,
    ...(event.eventName === "VoucherEscrowFinanciallyClosed" ? cursor("closed", event) : {}),
    ...times(event, custody),
  });
}
for (const event of [
  "FinalAllocationFrozen",
  "FinalLegResult",
  "VoucherEscrowFinanciallyClosed",
] as const) {
  indexer.onEvent({ contract: "GnosisVoucherEscrow", event }, async ({ event, context }) => {
    await projectVoucherServiceFinal(event, context);
  });
}
