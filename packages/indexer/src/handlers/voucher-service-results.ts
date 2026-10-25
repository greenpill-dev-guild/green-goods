import {
  assertSame,
  flag,
  identity,
  integer,
  position,
  smallInteger,
  text,
  times,
  tuple,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import {
  checkFinalQuantities,
  checkSetupQuantities,
  sameFacts,
  serviceCustody,
  serviceSetup,
} from "./voucher-service-projections";

export async function projectSetupResult(
  event: CosmoEvent,
  context: CosmoContext,
  source: boolean
): Promise<void> {
  const p = tuple(event.params, "result"),
    setupId = text(event.params, "setupId"),
    sequence = integer(event.params, "sequence");
  assertSame(text(p, "setupId"), setupId, "setup result identity");
  assertSame(integer(p, "resultSequence"), sequence, "setup result sequence");
  const facts = {
    protocolVersion: smallInteger(p, "version", 2n),
    authorizationHash: text(p, "authorizationHash"),
    sequence,
    phase: smallInteger(p, "phase", 5n),
    decision: smallInteger(p, "decision", 2n),
    issuerApproved: flag(p, "issuerApproved"),
    depositReceiptHash: text(p, "depositReceiptHash"),
    depositedUnits: integer(p, "depositedUnits"),
    setupRefundedUnits: integer(p, "setupRefundedUnits"),
    appliedDecisionId: text(p, "appliedDecisionId"),
    actionSucceeded: flag(p, "actionSucceeded"),
    failureHash: text(p, "failureHash"),
  };
  if (facts.protocolVersion !== 2 || sequence === 0n)
    throw new Error("Invalid setup result protocol/sequence");
  const record = source ? await serviceSetup(event, context) : await serviceCustody(event, context);
  sameFacts(record, { authorizationHash: facts.authorizationHash }, "setup result authorization");
  checkSetupQuantities(facts, record);
  const row = {
    ...identity(event, `${setupId}-${sequence}`),
    setupId,
    setupEntityId: record.id,
    endpointRole: source ? "SOURCE" : "DESTINATION",
    ...facts,
    ...position(event),
  };
  const existing = await context.VoucherServiceSetupResult.get(row.id);
  if (existing) {
    sameFacts(
      existing,
      { setupId, endpointRole: row.endpointRole, ...facts },
      "immutable setup sequence"
    );
    return;
  }
  if (record.latestSetupResultId !== undefined) {
    const prior = await context.VoucherServiceSetupResult.get(record.latestSetupResultId);
    if (prior) {
      if (prior.depositedUnits !== 0n && facts.depositedUnits !== 0n) {
        assertSame(prior.depositedUnits, facts.depositedUnits, "setup deposited units");
        assertSame(prior.depositReceiptHash, facts.depositReceiptHash, "setup deposit receipt");
      }
      const [earlier, later] = sequence < prior.sequence ? [facts, prior] : [prior, facts];
      if (earlier.depositedUnits > later.depositedUnits)
        throw new Error("Setup deposited units cannot regress");
      if (earlier.setupRefundedUnits > later.setupRefundedUnits)
        throw new Error("Setup refunded units cannot regress");
    }
  }
  await context.VoucherServiceSetupResult.set(row);
  if (sequence <= record.latestSetupSequence) return;
  const progress = {
    authorizationHash: facts.authorizationHash,
    latestSetupSequence: sequence,
    latestSetupResultId: row.id,
    ...times(event, record),
  };
  if (source)
    await context.VoucherServiceSetup.set({ ...(await serviceSetup(event, context)), ...progress });
  else
    await context.VoucherServiceCustody.set({
      ...(await serviceCustody(event, context)),
      ...progress,
    });
}

export async function projectFinalResult(event: CosmoEvent, context: CosmoContext): Promise<void> {
  const p = tuple(event.params, "result"),
    a = tuple(p, "allocation"),
    release = tuple(p, "release"),
    refund = tuple(p, "refund");
  const setupId = text(event.params, "setupId"),
    sequence = integer(event.params, "sequence");
  assertSame(text(p, "setupId"), setupId, "final result identity");
  assertSame(integer(p, "sequence"), sequence, "final result sequence");
  const facts = {
    protocolVersion: smallInteger(p, "protocolVersion", 2n),
    sequence,
    payloadHash: text(p, "payloadHash"),
    activationDecisionId: text(p, "activationDecisionId"),
    decisionId: text(p, "decisionId"),
    issuerReturnApprovalAtFreeze: integer(p, "issuerReturnApprovalAtFreeze"),
    approvedDeliveredServiceUnits: integer(a, "approvedDeliveredServiceUnits"),
    releaseVoucherUnits: integer(a, "releaseVoucherUnits"),
    refundVoucherUnits: integer(a, "refundVoucherUnits"),
    releaseState: smallInteger(release, "state", 3n),
    releaseAttempts: integer(release, "attempts"),
    releaseFailureHash: text(release, "failureHash"),
    refundState: smallInteger(refund, "state", 3n),
    refundAttempts: integer(refund, "attempts"),
    refundFailureHash: text(refund, "failureHash"),
  };
  if (facts.protocolVersion !== 2 || sequence === 0n)
    throw new Error("Invalid final result protocol/sequence");
  const record = await serviceSetup(event, context);
  sameFacts(record, { authorizationHash: facts.payloadHash }, "final result authorization");
  checkFinalQuantities(facts, record);
  const row = {
    ...identity(event, `${setupId}-${sequence}`),
    setupId,
    setupEntityId: record.id,
    ...facts,
    ...position(event),
  };
  const existing = await context.VoucherServiceFinalResult.get(row.id);
  if (existing) {
    sameFacts(existing, facts, "immutable final result sequence");
    return;
  }
  // A later source observation may repair a failed leg, never rewrite the selected allocation.
  if (record.latestFinalResultId !== undefined) {
    const prior = await context.VoucherServiceFinalResult.get(record.latestFinalResultId);
    if (prior)
      sameFacts(
        prior,
        {
          payloadHash: facts.payloadHash,
          activationDecisionId: facts.activationDecisionId,
          decisionId: facts.decisionId,
          issuerReturnApprovalAtFreeze: facts.issuerReturnApprovalAtFreeze,
          approvedDeliveredServiceUnits: facts.approvedDeliveredServiceUnits,
          releaseVoucherUnits: facts.releaseVoucherUnits,
          refundVoucherUnits: facts.refundVoucherUnits,
        },
        "immutable source final split"
      );
  }
  await context.VoucherServiceFinalResult.set(row);
  if (sequence > record.latestFinalSequence)
    await context.VoucherServiceSetup.set({
      ...record,
      authorizationHash: facts.payloadHash,
      latestFinalSequence: sequence,
      latestFinalResultId: row.id,
      ...times(event, record),
    });
}
