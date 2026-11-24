import type {
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
  VoucherSetupAction,
  VoucherSetupActionKind,
} from "@green-goods/shared/commitment-pooling";

export type VoucherReviewKind =
  | Exclude<
      VoucherSetupActionKind,
      | "prepareVoucherSetup"
      | "finalizeVoucherAllocation"
      | "executeVoucherFinalLeg"
      | "dispatchVoucherSetupCommand"
    >
  | "authorization"
  | "decision"
  | "release"
  | "refund";

/** Presentation binds the exact row; Shared owns action availability and validation. */
export function boundVoucherSetup(row: ServiceVoucherSetup) {
  return {
    sourceChainId: row.authorization.sourceChainId,
    sourceModule: row.authorization.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
}

export function voucherReviewAction(
  row: ServiceVoucherSetup,
  kind: VoucherReviewKind
): VoucherSetupAction | null {
  const bound = boundVoucherSetup(row);
  if (kind === "authorization" || kind === "decision") {
    const fee = row.fees[kind];
    if (fee === null || (kind === "decision" && !row.source.decisionId)) return null;
    return {
      ...bound,
      action: "dispatchVoucherSetupCommand",
      kind,
      expectedDecisionId: kind === "decision" ? row.source.decisionId : null,
      reviewedNativeFee: fee,
    };
  }
  if (kind === "release" || kind === "refund") {
    const final = row.destination?.finalAllocation;
    return final
      ? {
          ...bound,
          action: "executeVoucherFinalLeg",
          expectedDecisionId: final.decisionId,
          leg: kind,
        }
      : null;
  }
  if (kind === "finalizeVoucherActivation") {
    const receipt = row.source.acceptedReceiptHash;
    return receipt ? { ...bound, action: kind, expectedAcceptedReceiptHash: receipt } : null;
  }
  if (
    kind === "requestVoucherSetupAbort" ||
    kind === "retryVoucherSetupAcknowledgment" ||
    kind === "retryVoucherFinalAcknowledgment"
  ) {
    const fee =
      kind === "requestVoucherSetupAbort"
        ? row.fees.holderAbortRequest
        : kind === "retryVoucherSetupAcknowledgment"
          ? row.fees.setupAcknowledgment
          : row.fees.finalAcknowledgment;
    return fee === null ? null : { ...bound, action: kind, reviewedNativeFee: fee };
  }
  return { ...bound, action: kind };
}

/** A changed account, authorization, decision, fee or observation invalidates a modal draft. */
export function serviceReviewFingerprint(
  snapshot: ServiceAccessSnapshot,
  row?: ServiceVoucherSetup
) {
  return JSON.stringify(
    [
      snapshot.key,
      snapshot.offer,
      snapshot.consent,
      snapshot.sourceTimestamp,
      snapshot.capabilities,
      snapshot.pause,
      snapshot.availableActions,
      row,
    ],
    (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value)
  );
}
