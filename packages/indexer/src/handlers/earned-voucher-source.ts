import { indexer, type EarnedVoucherDistribution, type EarnedVoucherTerms } from "envio";
import { cursorWins } from "./commitment-pool-projections";
import {
  cosmoId,
  cursor,
  flag,
  identity,
  integer,
  position,
  projectVoucherEndpoint,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { sameFacts } from "./voucher-service-projections";

/** Terms, approval and consent mirror module events; the core's binding still decides acceptance. */
export async function projectEarnedVoucherTerms(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params;
  const commitmentId = integer(p, "commitmentId");
  const revision = integer(p, "revision");
  const key = `${commitmentId}-${revision}`;
  if (event.eventName === "VoucherTermsConsented") {
    const participant = text(p, "participant");
    const id = cosmoId(event.chainId, event.srcAddress, `${key}-${participant}`);
    // Repeated consent to the same exact revision changes nothing; keep the first observation.
    if (await context.EarnedVoucherConsent.get(id)) return;
    await context.EarnedVoucherConsent.set({
      ...identity(event, `${key}-${participant}`),
      commitmentId,
      revision,
      participant,
      termsEntityId: cosmoId(event.chainId, event.srcAddress, key),
      ...position(event),
    });
    return;
  }
  const terms: EarnedVoucherTerms = (await context.EarnedVoucherTerms.get(
    cosmoId(event.chainId, event.srcAddress, key)
  )) ?? {
    ...identity(event, key),
    commitmentId,
    revision,
    termsHash: undefined,
    registeredSeen: false,
    issuerAuthority: undefined,
    approvedSeen: false,
    ...cursor("registered"),
    ...cursor("approved"),
    ...times(event),
  };
  if (event.eventName === "VoucherTermsRegistered") {
    const termsHash = text(p, "termsHash");
    sameFacts(terms, { termsHash }, "earned voucher terms");
    if (terms.registeredSeen) return;
    await context.EarnedVoucherTerms.set({
      ...terms,
      termsHash,
      registeredSeen: true,
      ...cursor("registered", event),
      ...times(event, terms),
    });
  } else if (event.eventName === "VoucherTermsApproved") {
    const issuerAuthority = text(p, "issuerAuthority");
    sameFacts(terms, { issuerAuthority }, "earned voucher approval");
    if (terms.approvedSeen) return;
    await context.EarnedVoucherTerms.set({
      ...terms,
      issuerAuthority,
      approvedSeen: true,
      ...cursor("approved", event),
      ...times(event, terms),
    });
  } else {
    throw new Error("Unrouted earned voucher terms event");
  }
}

/** A recorded result is the source's authenticated acknowledgment; dispatches prove only sends. */
export async function projectEarnedVoucherDistribution(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const p = event.params;
  const entitlementId = text(p, "entitlementId");
  const id = cosmoId(event.chainId, event.srcAddress, entitlementId);
  const row: EarnedVoucherDistribution = (await context.EarnedVoucherDistribution.get(id)) ?? {
    ...identity(event, entitlementId),
    entitlementId,
    commitmentId: undefined,
    payloadHash: undefined,
    preparedSeen: false,
    lastMessageId: undefined,
    resultSequence: undefined,
    delivered: undefined,
    failureHash: undefined,
    ...cursor("prepared"),
    ...cursor("dispatch"),
    ...cursor("result"),
    ...times(event),
  };
  if (event.eventName === "VoucherDistributionPrepared") {
    const facts = { commitmentId: integer(p, "commitmentId"), payloadHash: text(p, "payloadHash") };
    sameFacts(row, facts, "earned voucher distribution");
    if (row.preparedSeen) return;
    await context.EarnedVoucherDistribution.set({
      ...row,
      ...facts,
      preparedSeen: true,
      ...cursor("prepared", event),
      ...times(event, row),
    });
  } else if (event.eventName === "VoucherDistributionDispatched") {
    const messageId = text(p, "messageId");
    const known = await context.EarnedVoucherDispatch.get(
      cosmoId(event.chainId, event.srcAddress, messageId)
    );
    if (known) {
      sameFacts(known, { entitlementId }, "earned voucher dispatch");
      return;
    }
    await context.EarnedVoucherDispatch.set({
      ...identity(event, messageId),
      entitlementId,
      messageId,
      distributionEntityId: id,
      ...position(event),
    });
    if (
      !cursorWins(event.block.number, event.logIndex, row.dispatchBlockNumber, row.dispatchLogIndex)
    )
      return;
    await context.EarnedVoucherDistribution.set({
      ...row,
      lastMessageId: messageId,
      ...cursor("dispatch", event),
      ...times(event, row),
    });
  } else if (event.eventName === "VoucherResultRecorded") {
    const resultSequence = integer(p, "resultSequence");
    const result = { delivered: flag(p, "success"), failureHash: text(p, "failureHash") };
    if (row.resultSequence !== undefined && resultSequence <= row.resultSequence) {
      if (resultSequence === row.resultSequence) sameFacts(row, result, "earned voucher result");
      return;
    }
    await context.EarnedVoucherDistribution.set({
      ...row,
      resultSequence,
      ...result,
      ...cursor("result", event),
      ...times(event, row),
    });
  } else {
    throw new Error("Unrouted earned voucher distribution event");
  }
}

for (const event of [
  "VoucherTermsRegistered",
  "VoucherTermsApproved",
  "VoucherTermsConsented",
] as const) {
  indexer.onEvent({ contract: "VoucherEntitlementModule", event }, async ({ event, context }) => {
    await projectEarnedVoucherTerms(event, context);
  });
}
for (const event of [
  "VoucherDistributionPrepared",
  "VoucherDistributionDispatched",
  "VoucherResultRecorded",
] as const) {
  indexer.onEvent({ contract: "VoucherEntitlementModule", event }, async ({ event, context }) => {
    await projectEarnedVoucherDistribution(event, context);
  });
}
for (const event of ["VoucherEndpointPinned", "VoucherPauseChanged"] as const) {
  indexer.onEvent({ contract: "VoucherEntitlementModule", event }, async ({ event, context }) => {
    await projectVoucherEndpoint(event, context);
  });
}
