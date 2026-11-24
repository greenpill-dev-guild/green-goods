import { indexer, type VoucherRedemptionAction, type VoucherRedemptionCustody } from "envio";

import {
  assertSame,
  cosmoId,
  cursor,
  identity,
  integer,
  maximum,
  projectVoucherEndpoint,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";

export async function redemptionCustody(
  event: CosmoEvent,
  context: CosmoContext
): Promise<VoucherRedemptionCustody> {
  const redemptionId = text(event.params, "redemptionId");
  return (
    (await context.VoucherRedemptionCustody.get(
      cosmoId(event.chainId, event.srcAddress, redemptionId)
    )) ?? {
      ...identity(event, redemptionId),
      redemptionId,
      endpointEntityId: cosmoId(event.chainId, event.srcAddress),
      authorizationSeen: false,
      payloadHash: undefined,
      commandMessageId: undefined,
      issuerApproved: false,
      issuer: undefined,
      holder: undefined,
      token: undefined,
      issuerReturnCeiling: 0n,
      presentedUnitsObserved: undefined,
      escrowedUnits: 0n,
      holderApprovedServiceUnits: 0n,
      holderApprovedVoucherUnits: 0n,
      mutualReturnUnits: 0n,
      releasedUnits: 0n,
      returnedUnits: 0n,
      latestResultSequence: 0n,
      pendingActionHash: undefined,
      ...cursor("authorization"),
      ...times(event),
    }
  );
}

export async function redemptionAction(
  event: CosmoEvent,
  context: CosmoContext
): Promise<VoucherRedemptionAction> {
  const redemptionId = text(event.params, "redemptionId");
  const actionHash = text(event.params, "actionHash");
  return (
    (await context.VoucherRedemptionAction.get(
      cosmoId(event.chainId, event.srcAddress, `${redemptionId}-${actionHash}`)
    )) ?? {
      ...identity(event, `${redemptionId}-${actionHash}`),
      redemptionId,
      actionHash,
      custodyEntityId: cosmoId(event.chainId, event.srcAddress, redemptionId),
      actionKind: undefined,
      voucherUnits: undefined,
      serviceUnits: undefined,
      holderApprovalSeen: false,
      approvedBy: undefined,
      cumulativeApprovedServiceUnits: undefined,
      cumulativeApprovedVoucherUnits: undefined,
      cumulativeReturnUnits: undefined,
      resultSeen: false,
      everSucceeded: false,
      latestResultSequence: 0n,
      latestSuccess: undefined,
      failureHash: undefined,
      ...cursor("approval"),
      ...times(event),
    }
  );
}

export async function projectRedemptionCustody(
  event: CosmoEvent,
  context: CosmoContext
): Promise<void> {
  if (event.eventName === "VoucherEndpointPinned" || event.eventName === "VoucherPauseChanged") {
    return projectVoucherEndpoint(event, context);
  }
  const params = event.params;
  const record = await redemptionCustody(event, context);
  let next = { ...record, ...times(event, record) };
  if (event.eventName === "RedemptionAuthorizationRecorded") {
    const payloadHash = text(params, "payloadHash");
    if (record.payloadHash !== undefined)
      assertSame(record.payloadHash, payloadHash, "custody payload");
    if (record.authorizationSeen) {
      assertSame(
        record.commandMessageId,
        text(params, "messageId"),
        "initial custody command message"
      );
      return;
    }
    next = {
      ...next,
      authorizationSeen: true,
      escrowedUnits: record.presentedUnitsObserved ?? record.escrowedUnits,
      payloadHash,
      commandMessageId: text(params, "messageId"),
      ...cursor("authorization", event),
    };
  } else if (event.eventName === "RedemptionIssuerApproved") {
    const payloadHash = text(params, "payloadHash");
    if (record.payloadHash !== undefined)
      assertSame(record.payloadHash, payloadHash, "issuer-approved payload");
    if (record.issuer !== undefined)
      assertSame(record.issuer, text(params, "issuer"), "custody issuer");
    next = { ...next, issuerApproved: true, issuer: text(params, "issuer"), payloadHash };
  } else if (event.eventName === "VoucherPresented") {
    const units = integer(params, "units");
    if (record.holder !== undefined)
      assertSame(record.holder, text(params, "holder"), "custody holder");
    if (record.token !== undefined)
      assertSame(record.token, text(params, "token"), "custody token");
    if (record.presentedUnitsObserved !== undefined)
      assertSame(record.presentedUnitsObserved, units, "shared presented voucher units");
    if (record.escrowedUnits !== 0n)
      assertSame(record.escrowedUnits, units, "presented voucher units");
    next = {
      ...next,
      holder: text(params, "holder"),
      token: text(params, "token"),
      presentedUnitsObserved: units,
      escrowedUnits: record.authorizationSeen ? units : record.escrowedUnits,
    };
  } else if (event.eventName === "RedemptionReturnAuthorized") {
    if (record.issuer !== undefined)
      assertSame(record.issuer, text(params, "issuer"), "custody issuer");
    next = {
      ...next,
      issuer: text(params, "issuer"),
      issuerReturnCeiling: maximum(
        record.issuerReturnCeiling,
        integer(params, "cumulativeReturnCeiling")
      ),
    };
  } else if (
    event.eventName === "HolderDeliveryApproved" ||
    event.eventName === "HolderReturnApproved"
  ) {
    const action = await redemptionAction(event, context);
    if (record.holder !== undefined)
      assertSame(record.holder, text(params, "holder"), "custody holder");
    const release = event.eventName === "HolderDeliveryApproved";
    const actionKind = release ? 2 : 3;
    const voucherUnits = integer(params, release ? "voucherUnits" : "units");
    const serviceUnits = release ? integer(params, "newlyApprovedServiceUnits") : 0n;
    if (action.actionKind !== undefined)
      assertSame(action.actionKind, actionKind, "approved action kind");
    if (action.voucherUnits !== undefined)
      assertSame(action.voucherUnits, voucherUnits, "approved voucher units");
    if (action.serviceUnits !== undefined)
      assertSame(action.serviceUnits, serviceUnits, "approved service units");
    const approvalFacts = {
      approvedBy: text(params, "holder"),
      cumulativeApprovedServiceUnits: release
        ? integer(params, "cumulativeApprovedServiceUnits")
        : undefined,
      cumulativeApprovedVoucherUnits: release
        ? integer(params, "cumulativeApprovedVoucherUnits")
        : undefined,
      cumulativeReturnUnits: release ? undefined : integer(params, "cumulativeReturnUnits"),
    };
    if (action.holderApprovalSeen) {
      for (const key of Object.keys(approvalFacts) as Array<keyof typeof approvalFacts>) {
        assertSame(action[key], approvalFacts[key], `immutable action approval ${key}`);
      }
    }
    await context.VoucherRedemptionAction.set({
      ...action,
      actionKind,
      voucherUnits,
      serviceUnits,
      holderApprovalSeen: true,
      ...approvalFacts,
      ...(action.holderApprovalSeen ? {} : cursor("approval", event)),
      ...times(event, action),
    });
    next = {
      ...next,
      holder: text(params, "holder"),
      holderApprovedServiceUnits: release
        ? maximum(
            record.holderApprovedServiceUnits,
            integer(params, "cumulativeApprovedServiceUnits")
          )
        : record.holderApprovedServiceUnits,
      holderApprovedVoucherUnits: release
        ? maximum(
            record.holderApprovedVoucherUnits,
            integer(params, "cumulativeApprovedVoucherUnits")
          )
        : record.holderApprovedVoucherUnits,
      mutualReturnUnits: release
        ? record.mutualReturnUnits
        : maximum(record.mutualReturnUnits, integer(params, "cumulativeReturnUnits")),
    };
  } else {
    throw new Error(`Unrouted custody redemption event: ${event.eventName}`);
  }
  await context.VoucherRedemptionCustody.set(next);
}

for (const eventName of [
  "VoucherEndpointPinned",
  "VoucherPauseChanged",
  "RedemptionAuthorizationRecorded",
  "RedemptionIssuerApproved",
  "VoucherPresented",
  "HolderDeliveryApproved",
  "RedemptionReturnAuthorized",
  "HolderReturnApproved",
] as const) {
  indexer.onEvent(
    { contract: "GnosisVoucherEscrow", event: eventName },
    async ({ event, context }) => {
      await projectRedemptionCustody(event, context);
    }
  );
}
