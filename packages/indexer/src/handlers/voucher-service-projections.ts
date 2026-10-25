import type {
  VoucherServiceCustody,
  VoucherServiceSetup,
  VoucherServiceFinalAllocation,
} from "envio";
import {
  assertSame,
  cosmoId,
  cursor,
  identity,
  integer,
  smallInteger,
  text,
  times,
  type CosmoContext,
  type CosmoEvent,
} from "./cosmo-local-projections";

/** Compare emitted immutable facts without fabricating fields omitted by a different event. */
export function sameFacts(existing: object, facts: object, label: string): void {
  const known = existing as Readonly<Record<string, unknown>>;
  for (const [key, value] of Object.entries(facts)) {
    if (known[key] !== undefined) assertSame(known[key], value, `${label} ${key}`);
  }
}

function authDefaults() {
  return {
    protocolVersion: undefined,
    sourceChainId: undefined,
    sourceModule: undefined,
    coreModule: undefined,
    commitmentId: undefined,
    termsRevision: undefined,
    termsHash: undefined,
    claimHash: undefined,
    requestNonce: undefined,
    buyer: undefined,
    holder: undefined,
    buyerGarden: undefined,
    providerGarden: undefined,
    destinationChainId: undefined,
    destinationEscrow: undefined,
    issuer: undefined,
    token: undefined,
    voucherUnits: undefined,
    serviceUnits: undefined,
    unitLabelHash: undefined,
    serviceTermsRef: undefined,
    remedyTermsRef: undefined,
    acceptanceDeadline: undefined,
    remedyPolicy: undefined,
  };
}

export function authorization(p: Readonly<Record<string, unknown>>) {
  const protocolVersion = smallInteger(p, "version", 2n);
  if (protocolVersion !== 2) throw new Error("Unsupported voucher setup protocol");
  const facts = {
    protocolVersion,
    sourceChainId: integer(p, "sourceChainId"),
    sourceModule: text(p, "sourceModule"),
    coreModule: text(p, "coreModule"),
    commitmentId: integer(p, "commitmentId"),
    termsRevision: integer(p, "termsRevision"),
    termsHash: text(p, "termsHash"),
    claimHash: text(p, "claimHash"),
    requestNonce: integer(p, "requestNonce"),
    buyer: text(p, "buyer"),
    holder: text(p, "holder"),
    buyerGarden: text(p, "buyerGarden"),
    providerGarden: text(p, "providerGarden"),
    destinationChainId: integer(p, "destinationChainId"),
    destinationEscrow: text(p, "destinationEscrow"),
    issuer: text(p, "issuer"),
    token: text(p, "token"),
    voucherUnits: integer(p, "voucherUnits"),
    serviceUnits: integer(p, "serviceUnits"),
    unitLabelHash: text(p, "unitLabelHash"),
    serviceTermsRef: text(p, "serviceTermsRef"),
    remedyTermsRef: text(p, "remedyTermsRef"),
    acceptanceDeadline: integer(p, "acceptanceDeadline"),
    remedyPolicy: smallInteger(p, "remedyPolicy", 1n),
  };
  if (
    facts.voucherUnits === 0n ||
    facts.serviceUnits === 0n ||
    facts.termsRevision === 0n ||
    facts.requestNonce === 0n ||
    facts.remedyPolicy !== 1
  ) {
    throw new Error("Invalid voucher setup authorization");
  }
  return facts;
}

export function checkAuthScope(
  event: CosmoEvent,
  facts: ReturnType<typeof authorization>,
  source: boolean
): void {
  assertSame(
    source ? facts.sourceChainId : facts.destinationChainId,
    BigInt(event.chainId),
    "setup emitting chain"
  );
  assertSame(
    source ? facts.sourceModule : facts.destinationEscrow,
    event.srcAddress.toLowerCase(),
    "setup emitting module"
  );
}

export async function serviceSetup(
  event: CosmoEvent,
  context: CosmoContext
): Promise<VoucherServiceSetup> {
  const setupId = text(event.params, "setupId");
  return (
    (await context.VoucherServiceSetup.get(cosmoId(event.chainId, event.srcAddress, setupId))) ?? {
      ...identity(event, setupId),
      setupId,
      authorizationSeen: false,
      authorizationHash: undefined,
      ...authDefaults(),
      coreAcceptanceEntityId: undefined,
      claimEntityId: undefined,
      destinationCustodyEntityId: undefined,
      dispatchSeen: false,
      lastMessageId: undefined,
      lastDispatchKind: undefined,
      decisionSeen: false,
      decisionId: undefined,
      selectedDecision: undefined,
      expectedDepositReceiptHash: undefined,
      coreAcceptanceHash: undefined,
      abortReason: undefined,
      holderAbortRequestSeen: false,
      holderAbortAlreadyAccepted: undefined,
      latestSetupSequence: 0n,
      latestSetupResultId: undefined,
      latestFinalSequence: 0n,
      latestFinalResultId: undefined,
      ...cursor("prepared"),
      ...cursor("dispatched"),
      ...cursor("decision"),
      ...cursor("holderAbort"),
      ...times(event),
    }
  );
}

export async function serviceCustody(
  event: CosmoEvent,
  context: CosmoContext
): Promise<VoucherServiceCustody> {
  const setupId = text(event.params, "setupId");
  return (
    (await context.VoucherServiceCustody.get(
      cosmoId(event.chainId, event.srcAddress, setupId)
    )) ?? {
      ...identity(event, setupId),
      setupId,
      authorizationSeen: false,
      authorizationHash: undefined,
      authorizationMessageId: undefined,
      ...authDefaults(),
      sourceSetupEntityId: undefined,
      decisionAppliedSeen: false,
      decisionId: undefined,
      appliedDecision: undefined,
      latestSetupSequence: 0n,
      latestSetupResultId: undefined,
      finalAllocationEntityId: undefined,
      financialClosedSeen: false,
      holderAbortRequestSeen: false,
      holderAbortMessageId: undefined,
      ...cursor("authorization"),
      ...cursor("decision"),
      ...cursor("holderAbort"),
      ...cursor("closed"),
      ...times(event),
    }
  );
}

export async function finalAllocation(
  event: CosmoEvent,
  context: CosmoContext
): Promise<VoucherServiceFinalAllocation> {
  const setupId = text(event.params, "setupId"),
    decisionId = text(event.params, "decisionId");
  return (
    (await context.VoucherServiceFinalAllocation.get(
      cosmoId(event.chainId, event.srcAddress, `${setupId}-${decisionId}`)
    )) ?? {
      ...identity(event, `${setupId}-${decisionId}`),
      setupId,
      decisionId,
      custodyEntityId: cosmoId(event.chainId, event.srcAddress, setupId),
      freezeSeen: false,
      holder: undefined,
      payloadHash: undefined,
      activationDecisionId: undefined,
      approvedDeliveredServiceUnits: undefined,
      releaseVoucherUnits: undefined,
      refundVoucherUnits: undefined,
      issuerReturnApprovalAtFreeze: undefined,
      releaseState: undefined,
      releaseAttempts: undefined,
      releaseFailureHash: undefined,
      refundState: undefined,
      refundAttempts: undefined,
      refundFailureHash: undefined,
      financialClosedSeen: false,
      ...cursor("frozen"),
      ...cursor("closed"),
      ...times(event),
    }
  );
}

/** Check a complete split against independently observed full authorization, in either arrival order. */
export function checkFinalQuantities(
  allocation: {
    releaseVoucherUnits?: bigint;
    refundVoucherUnits?: bigint;
    approvedDeliveredServiceUnits?: bigint;
  },
  auth: { voucherUnits?: bigint; serviceUnits?: bigint }
): void {
  if (
    auth.voucherUnits !== undefined &&
    allocation.releaseVoucherUnits !== undefined &&
    allocation.refundVoucherUnits !== undefined
  ) {
    assertSame(
      allocation.releaseVoucherUnits + allocation.refundVoucherUnits,
      auth.voucherUnits,
      "final voucher conservation"
    );
  }
  if (
    auth.serviceUnits !== undefined &&
    allocation.approvedDeliveredServiceUnits !== undefined &&
    allocation.approvedDeliveredServiceUnits > auth.serviceUnits
  )
    throw new Error("Final delivered service units exceed authorization");
}

/** Setup escrow is all-or-nothing; a partial service outcome belongs only to the final split. */
export function checkSetupQuantities(
  result: { depositedUnits: bigint; setupRefundedUnits: bigint },
  auth: { voucherUnits?: bigint }
): void {
  if (auth.voucherUnits !== undefined && result.depositedUnits !== 0n) {
    assertSame(result.depositedUnits, auth.voucherUnits, "setup deposited units");
  }
  if (result.setupRefundedUnits !== 0n) {
    assertSame(result.setupRefundedUnits, result.depositedUnits, "setup refunded units");
  }
}
