import { indexer } from "envio";
import {
  assertSame,
  cosmoId,
  cursor,
  flag,
  identity,
  position,
  smallInteger,
  text,
  times,
  tuple,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import {
  authorization,
  checkAuthScope,
  checkFinalQuantities,
  checkSetupQuantities,
  sameFacts,
  serviceCustody,
} from "./voucher-service-projections";
import { projectSetupResult } from "./voucher-service-results";

export async function projectVoucherServiceCustody(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  if (event.eventName === "VoucherSetupResultRecorded")
    return projectSetupResult(event, context, false);
  const p = event.params,
    record = await serviceCustody(event, context);
  let next = { ...record, ...times(event, record) };
  if (event.eventName === "VoucherSetupAuthorizationRecorded") {
    const facts = authorization(tuple(p, "authorization"));
    checkAuthScope(event, facts, false);
    const fields = {
      ...facts,
      authorizationHash: text(p, "authorizationHash"),
      authorizationMessageId: text(p, "messageId"),
    };
    sameFacts(record, fields, "immutable destination setup");
    if (record.finalAllocationEntityId !== undefined) {
      const final = await context.VoucherServiceFinalAllocation.get(record.finalAllocationEntityId);
      if (final) {
        if (final.holder !== undefined)
          assertSame(final.holder, facts.holder, "final allocation holder");
        if (final.payloadHash !== undefined)
          assertSame(final.payloadHash, fields.authorizationHash, "final allocation authorization");
        checkFinalQuantities(final, facts);
        for (const leg of [0, 1]) {
          const attempts = leg === 0 ? final.releaseAttempts : final.refundAttempts;
          if (attempts === undefined || attempts === 0n) continue;
          const prior = await context.VoucherServiceFinalLegResult.get(
            `${final.id}-${leg}-${attempts}`
          );
          if (prior)
            assertSame(
              prior.recipient,
              leg === 0 ? facts.issuer : facts.holder,
              "final leg recipient"
            );
        }
      }
    }
    if (record.latestSetupResultId !== undefined) {
      const result = await context.VoucherServiceSetupResult.get(record.latestSetupResultId);
      if (result) checkSetupQuantities(result, facts);
    }
    if (record.authorizationSeen) return;
    next = {
      ...next,
      ...fields,
      authorizationSeen: true,
      sourceSetupEntityId: cosmoId(facts.sourceChainId, facts.sourceModule, record.setupId),
      ...cursor("authorization", event),
    };
  } else if (event.eventName === "VoucherSetupDecisionApplied") {
    const facts = {
      decisionId: text(p, "decisionId"),
      appliedDecision: smallInteger(p, "decision", 2n),
    };
    if (facts.appliedDecision === 0) throw new Error("Missing applied setup decision");
    sameFacts(record, facts, "immutable destination decision");
    if (record.decisionAppliedSeen) return;
    next = { ...next, ...facts, decisionAppliedSeen: true, ...cursor("decision", event) };
  } else if (event.eventName === "VoucherSetupHolderAbortRequested") {
    if (record.holder !== undefined)
      assertSame(record.holder, text(p, "holder"), "destination abort holder");
    if (record.holderAbortRequestSeen) return;
    next = {
      ...next,
      holder: text(p, "holder"),
      holderAbortRequestSeen: true,
      holderAbortMessageId: text(p, "messageId"),
      ...cursor("holderAbort", event),
    };
  } else if (event.eventName === "VoucherSetupActionResult") {
    const facts = {
      action: smallInteger(p, "action", 2n),
      success: flag(p, "success"),
      failureHash: text(p, "failureHash"),
      reason: text(p, "reason"),
    };
    if (facts.action === 0) throw new Error("Missing setup action");
    const provenance = position(event),
      row = {
        ...identity(event, `${provenance.txHash}-${event.logIndex}`),
        setupId: record.setupId,
        custodyEntityId: record.id,
        ...facts,
        ...provenance,
      };
    const existing = await context.VoucherServiceSetupAction.get(row.id);
    if (existing) {
      sameFacts(existing, { setupId: record.setupId, ...facts }, "setup action observation");
      return;
    }
    await context.VoucherServiceSetupAction.set(row);
  } else throw new Error("Unrouted voucher service custody event");
  await context.VoucherServiceCustody.set(next);
}
for (const event of [
  "VoucherSetupAuthorizationRecorded",
  "VoucherSetupDecisionApplied",
  "VoucherSetupResultRecorded",
  "VoucherSetupActionResult",
  "VoucherSetupHolderAbortRequested",
] as const) {
  indexer.onEvent({ contract: "GnosisVoucherEscrow", event }, async ({ event, context }) => {
    await projectVoucherServiceCustody(event, context);
  });
}
