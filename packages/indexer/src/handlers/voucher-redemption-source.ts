import { indexer, type VoucherRedemption } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import {
  assertSame,
  cosmoId,
  cursor,
  flag,
  identity,
  integer,
  projectVoucherEndpoint,
  smallInteger,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";

export async function projectRedemptionSource(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  if (event.eventName.startsWith("Voucher")) return projectVoucherEndpoint(event, context);
  const params = event.params;
  const redemptionId = text(params, "redemptionId");
  const id = cosmoId(event.chainId, event.srcAddress, redemptionId);
  const existing = await context.VoucherRedemption.get(id);
  const record: VoucherRedemption = existing ?? {
    ...identity(event, redemptionId),
    redemptionId,
    endpointEntityId: cosmoId(event.chainId, event.srcAddress),
    preparedSeen: false,
    dispatchSeen: false,
    resultSeen: false,
    commitmentId: undefined,
    payloadHash: undefined,
    lastMessageId: undefined,
    sourceState: undefined,
    latestResultSequence: 0n,
    escrowedUnits: undefined,
    holderApprovedServiceUnits: undefined,
    holderApprovedVoucherUnits: undefined,
    mutualReturnUnits: undefined,
    releasedUnits: undefined,
    returnedUnits: undefined,
    actionSucceeded: undefined,
    failureHash: undefined,
    ...cursor("prepared"),
    ...cursor("dispatched"),
    ...cursor("result"),
    ...times(event),
  };
  let next = { ...record, ...times(event, record) };
  if (event.eventName === "RedemptionPrepared") {
    const commitmentId = integer(params, "commitmentId");
    const payloadHash = text(params, "payloadHash");
    if (record.preparedSeen) {
      assertSame(record.commitmentId, commitmentId, "redemption commitment");
      assertSame(record.payloadHash, payloadHash, "redemption payload");
      return;
    }
    next = {
      ...next,
      preparedSeen: true,
      commitmentId,
      payloadHash,
      sourceState: record.sourceState ?? 1,
      ...cursor("prepared", event),
    };
  } else if (event.eventName === "RedemptionDispatched") {
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        record.dispatchedBlockNumber,
        record.dispatchedLogIndex
      )
    ) {
      next = {
        ...next,
        dispatchSeen: true,
        lastMessageId: text(params, "messageId"),
        sourceState: record.resultSeen ? record.sourceState : 2,
        ...cursor("dispatched", event),
      };
    }
  } else if (event.eventName === "RedemptionResultRecorded") {
    const sequence = integer(params, "sequence");
    const fields = {
      sourceState: smallInteger(params, "state", 4n),
      escrowedUnits: integer(params, "escrowedUnits"),
      holderApprovedServiceUnits: integer(params, "holderApprovedServiceUnits"),
      holderApprovedVoucherUnits: integer(params, "holderApprovedVoucherUnits"),
      mutualReturnUnits: integer(params, "mutualReturnUnits"),
      releasedUnits: integer(params, "releasedUnits"),
      returnedUnits: integer(params, "returnedUnits"),
      actionSucceeded: flag(params, "actionSucceeded"),
      failureHash: text(params, "failureHash"),
    };
    if (sequence === 0n || (fields.sourceState !== 3 && fields.sourceState !== 4)) {
      throw new Error("Invalid authenticated redemption result");
    }
    if (sequence === record.latestResultSequence && record.resultSeen) {
      for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
        assertSame(record[key], fields[key], `redemption result sequence ${sequence} ${key}`);
      }
      return;
    }
    if (sequence < record.latestResultSequence) return;
    next = {
      ...next,
      ...fields,
      resultSeen: true,
      latestResultSequence: sequence,
      ...cursor("result", event),
    };
  } else {
    throw new Error(`Unrouted source redemption event: ${event.eventName}`);
  }
  await context.VoucherRedemption.set(next);
}

for (const eventName of [
  "VoucherEndpointPinned",
  "VoucherPauseChanged",
  "RedemptionPrepared",
  "RedemptionDispatched",
  "RedemptionResultRecorded",
] as const) {
  indexer.onEvent(
    { contract: "VoucherRedemptionModule", event: eventName },
    async ({ event, context }) => {
      await projectRedemptionSource(event, context);
    }
  );
}
