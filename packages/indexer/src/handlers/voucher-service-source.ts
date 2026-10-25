import { indexer } from "envio";
import { cursorWins } from "./commitment-pool-projections";
import {
  assertSame,
  cosmoId,
  cursor,
  flag,
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
  serviceSetup,
} from "./voucher-service-projections";
import { projectFinalResult, projectSetupResult } from "./voucher-service-results";

export async function projectVoucherServiceSource(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  if (event.eventName === "VoucherSetupResultRecorded")
    return projectSetupResult(event, context, true);
  if (event.eventName === "VoucherFinalResultRecorded") return projectFinalResult(event, context);
  const p = event.params,
    record = await serviceSetup(event, context);
  let next = { ...record, ...times(event, record) };
  if (event.eventName === "VoucherSetupPrepared") {
    const facts = authorization(tuple(p, "authorization"));
    checkAuthScope(event, facts, true);
    const authorizationHash = text(p, "authorizationHash");
    assertSame(event.params.commitmentId, facts.commitmentId, "prepared commitment");
    sameFacts(record, { ...facts, authorizationHash }, "immutable setup authorization");
    if (record.latestFinalResultId !== undefined) {
      const final = await context.VoucherServiceFinalResult.get(record.latestFinalResultId);
      if (final) checkFinalQuantities(final, facts);
    }
    if (record.latestSetupResultId !== undefined) {
      const result = await context.VoucherServiceSetupResult.get(record.latestSetupResultId);
      if (result) checkSetupQuantities(result, facts);
    }
    if (record.authorizationSeen) return;
    next = {
      ...next,
      ...facts,
      authorizationHash,
      authorizationSeen: true,
      coreAcceptanceEntityId: cosmoId(facts.sourceChainId, facts.coreModule, facts.commitmentId),
      claimEntityId: cosmoId(facts.sourceChainId, facts.coreModule, facts.claimHash),
      destinationCustodyEntityId: cosmoId(
        facts.destinationChainId,
        facts.destinationEscrow,
        record.setupId
      ),
      ...cursor("prepared", event),
    };
  } else if (event.eventName === "VoucherSetupDecisionSelected") {
    const command = tuple(p, "command");
    assertSame(smallInteger(command, "version", 2n), 2, "setup decision version");
    assertSame(text(command, "setupId"), record.setupId, "setup decision identity");
    const facts = {
      authorizationHash: text(command, "authorizationHash"),
      decisionId: text(p, "decisionId"),
      selectedDecision: smallInteger(command, "decision", 2n),
      expectedDepositReceiptHash: text(command, "expectedDepositReceiptHash"),
      coreAcceptanceHash: text(command, "coreAcceptanceHash"),
      abortReason: smallInteger(command, "abortReason", 4n),
    };
    if (facts.selectedDecision === 0) throw new Error("Missing setup decision");
    sameFacts(record, facts, "immutable source setup decision");
    if (record.decisionSeen) return;
    next = { ...next, ...facts, decisionSeen: true, ...cursor("decision", event) };
  } else if (event.eventName === "VoucherSetupDispatched") {
    const facts = {
      lastMessageId: text(p, "messageId"),
      lastDispatchKind: smallInteger(p, "kind", 2n),
    };
    if (
      record.dispatchedBlockNumber === BigInt(event.block.number) &&
      record.dispatchedLogIndex === event.logIndex
    ) {
      sameFacts(record, facts, "setup dispatch position");
      return;
    }
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        record.dispatchedBlockNumber,
        record.dispatchedLogIndex
      )
    )
      return;
    next = { ...next, ...facts, dispatchSeen: true, ...cursor("dispatched", event) };
  } else if (event.eventName === "VoucherHolderAbortRequested") {
    if (record.holder !== undefined)
      assertSame(record.holder, text(p, "holder"), "source abort holder");
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        record.holderAbortBlockNumber,
        record.holderAbortLogIndex
      )
    )
      return;
    next = {
      ...next,
      holder: text(p, "holder"),
      holderAbortRequestSeen: true,
      holderAbortAlreadyAccepted: flag(p, "alreadyAccepted"),
      ...cursor("holderAbort", event),
    };
  } else throw new Error("Unrouted voucher service source event");
  await context.VoucherServiceSetup.set(next);
}
for (const event of [
  "VoucherSetupPrepared",
  "VoucherSetupDecisionSelected",
  "VoucherSetupDispatched",
  "VoucherSetupResultRecorded",
  "VoucherFinalResultRecorded",
  "VoucherHolderAbortRequested",
] as const) {
  indexer.onEvent({ contract: "VoucherRedemptionModule", event }, async ({ event, context }) => {
    await projectVoucherServiceSource(event, context);
  });
}
