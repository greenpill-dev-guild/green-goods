import { indexer } from "envio";

import {
  assertSame,
  flag,
  identity,
  integer,
  position,
  smallInteger,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";
import { redemptionAction, redemptionCustody } from "./voucher-redemption-custody";

/** Economic counters follow unique successful actions, independently of message delivery. */
export async function projectRedemptionActionResult(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  const params = event.params;
  const redemptionId = text(params, "redemptionId");
  const sequence = integer(params, "sequence");
  const action = await redemptionAction(event, context);
  const record = await redemptionCustody(event, context);
  const fields = {
    actionKind: smallInteger(params, "kind", 3n),
    voucherUnits: integer(params, "voucherUnits"),
    serviceUnits: integer(params, "serviceUnits"),
    success: flag(params, "success"),
    failureHash: text(params, "failureHash"),
    reason: text(params, "reason"),
  };
  if (sequence === 0n || fields.actionKind === 0)
    throw new Error("Invalid redemption action result");
  const result = {
    ...identity(event, `${redemptionId}-${sequence}`),
    redemptionId,
    sequence,
    custodyEntityId: record.id,
    actionEntityId: action.id,
    actionHash: action.actionHash,
    ...fields,
    ...position(event),
  };
  const existing = await context.VoucherRedemptionActionResult.get(result.id);
  if (existing) {
    for (const key of [
      "actionHash",
      "actionKind",
      "voucherUnits",
      "serviceUnits",
      "success",
      "failureHash",
      "reason",
    ] as const) {
      assertSame(existing[key], result[key], `immutable action result sequence ${sequence} ${key}`);
    }
    return;
  }
  if (action.actionKind !== undefined)
    assertSame(action.actionKind, fields.actionKind, "action result kind");
  if (action.voucherUnits !== undefined)
    assertSame(action.voucherUnits, fields.voucherUnits, "action result vouchers");
  if (action.serviceUnits !== undefined)
    assertSame(action.serviceUnits, fields.serviceUnits, "action result service");
  const newlySuccessful = fields.success && !action.everSucceeded;
  let next = { ...record, ...times(event, record) };
  if (newlySuccessful) {
    if (fields.actionKind === 1) {
      if (record.escrowedUnits !== 0n)
        assertSame(record.escrowedUnits, fields.voucherUnits, "action presented units");
      next = { ...next, escrowedUnits: fields.voucherUnits };
    } else if (fields.actionKind === 2) {
      next = { ...next, releasedUnits: record.releasedUnits + fields.voucherUnits };
    } else {
      next = { ...next, returnedUnits: record.returnedUnits + fields.voucherUnits };
    }
  }
  if (sequence > record.latestResultSequence) {
    next = {
      ...next,
      latestResultSequence: sequence,
      pendingActionHash: fields.success ? undefined : action.actionHash,
    };
  }
  await context.VoucherRedemptionActionResult.set(result);
  await context.VoucherRedemptionAction.set({
    ...action,
    actionKind: fields.actionKind,
    voucherUnits: fields.voucherUnits,
    serviceUnits: fields.serviceUnits,
    resultSeen: true,
    everSucceeded: action.everSucceeded || fields.success,
    ...(sequence > action.latestResultSequence
      ? {
          latestResultSequence: sequence,
          latestSuccess: fields.success,
          failureHash: fields.failureHash,
        }
      : {}),
    ...times(event, action),
  });
  await context.VoucherRedemptionCustody.set(next);
}

indexer.onEvent(
  { contract: "GnosisVoucherEscrow", event: "RedemptionActionResult" },
  async ({ event, context }) => {
    await projectRedemptionActionResult(event, context);
  }
);
