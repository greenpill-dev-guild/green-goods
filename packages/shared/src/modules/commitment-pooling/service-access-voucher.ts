import { maxUint256 } from "viem";
import type {
  ServiceAccessActionAvailability,
  ServiceAccessSnapshot,
} from "./service-access-types";
import type {
  ServiceVoucherSetup,
  VoucherSetupAction,
  VoucherSetupActionKind,
} from "./service-access-voucher-types";

const same = (a: string, b: string | null | undefined) => a.toLowerCase() === b?.toLowerCase();
const uint = (value: bigint, bits = 256) => value >= 0n && value < 1n << BigInt(bits);

/** Every recovery belongs to its frozen setup, including a previous claim's unpaid return. */
export function voucherSetupAvailableActions(
  s: ServiceAccessSnapshot,
  row: ServiceVoucherSetup
): VoucherSetupActionKind[] {
  if (
    s.evidence !== "local-rehearsal" ||
    s.capabilities.mutation !== "local-rehearsal" ||
    s.capabilities.reasons.includes("offline") ||
    !row.complete
  )
    return [];
  const a = row.authorization;
  if (
    a.sourceChainId !== s.key.sourceChainId ||
    !same(a.coreModule, s.key.coreModule) ||
    a.commitmentId !== s.key.commitmentId ||
    !same(a.buyer, s.key.buyer)
  )
    return [];
  const actions: VoucherSetupActionKind[] = [];
  const source = s.capabilities.canSendSource;
  const holder = s.capabilities.canSignHolder && same(a.holder, s.capabilities.gnosisHolder);
  const buyer = s.capabilities.canSignSource && same(a.buyer, s.capabilities.sourceBuyer);
  const accepted = row.source.acceptedEver;
  const exactAccepted =
    accepted !== null &&
    same(accepted.setupId, row.setupId) &&
    same(accepted.authorizationHash, row.authorizationHash) &&
    same(accepted.claimHash, a.claimHash) &&
    accepted.requestNonce === a.requestNonce &&
    accepted.termsRevision === a.termsRevision &&
    same(accepted.setupModule, a.sourceModule);
  if (source && row.source.decision === "none") {
    if (exactAccepted) actions.push("finalizeVoucherActivation");
    else {
      const current =
        s.coreState === "OFFERED" &&
        s.consent?.state === "pending" &&
        same(s.consent.claimHash, a.claimHash) &&
        s.consent.requestNonce === a.requestNonce &&
        s.offer?.revision === a.termsRevision &&
        same(s.offer.termsHash, a.termsHash);
      if (
        buyer ||
        (row.source.timestamp !== null && row.source.timestamp > a.acceptanceDeadline) ||
        !current
      )
        actions.push("abortVoucherSetup");
    }
  }
  if (source && (s.pause.sourceVoucher === false || row.source.decision === "abort"))
    actions.push("dispatchVoucherSetupCommand");
  const d = row.destination;
  if (!d) return actions;
  if (s.capabilities.canSendDestination) {
    if (row.acknowledgments.setup.pending) actions.push("retryVoucherSetupAcknowledgment");
    if (row.acknowledgments.final.pending) actions.push("retryVoucherFinalAcknowledgment");
    if (d.pendingAction && s.pause.destinationVoucher === false)
      actions.push("retryVoucherSetupAction");
    const f = d.finalAllocation;
    if (
      f &&
      s.pause.destinationVoucher === false &&
      [f.release.state, f.refund.state].some((state) => state === "pending" || state === "failed")
    )
      actions.push("executeVoucherFinalLeg");
  }
  if (!holder) return actions;
  if (d.result.decision === "none") {
    actions.push("requestVoucherSetupAbort");
    if (
      d.result.depositedUnits === 0n &&
      d.result.issuerApproved &&
      !d.pendingAction &&
      s.pause.destinationVoucher === false
    ) {
      if (d.allowance !== null && d.allowance < a.voucherUnits)
        actions.push("approveVoucherAllowance");
      else if (
        d.allowance !== null &&
        d.holderBalance !== null &&
        d.holderBalance >= a.voucherUnits
      )
        actions.push("presentVoucherSetup");
    }
  }
  if (
    d.result.phase === "active" &&
    d.result.decision === "activate" &&
    d.result.depositedUnits === a.voucherUnits &&
    !d.finalAllocation &&
    s.pause.destinationVoucher === false
  )
    actions.push("finalizeVoucherAllocation");
  return actions;
}

export function selectVoucherSetupAction(
  s: ServiceAccessSnapshot,
  action: VoucherSetupAction
): ServiceAccessActionAvailability {
  const reject = (reason: string) => ({ allowed: false, reason });
  if (action.action === "prepareVoucherSetup") {
    if (
      !s.consent ||
      !s.offer ||
      action.expectedRevision !== s.offer.revision ||
      !same(action.expectedTermsHash, s.offer.termsHash) ||
      !same(action.expectedClaimHash, s.consent.claimHash) ||
      action.expectedRequestNonce !== s.consent.requestNonce
    )
      return reject("consent-changed");
    if (
      !uint(action.acceptanceDeadline, 64) ||
      s.sourceTimestamp === null ||
      action.acceptanceDeadline < s.sourceTimestamp
    )
      return reject("source-deadline-invalid");
    return { allowed: true, reason: null };
  }
  const row = s.voucherSetups.find(
    (item) =>
      same(item.setupId, action.setupId) &&
      item.authorization.sourceChainId === action.sourceChainId &&
      same(item.authorization.sourceModule, action.sourceModule)
  );
  if (!row || !same(row.authorizationHash, action.expectedAuthorizationHash))
    return reject("setup-changed");
  if (!voucherSetupAvailableActions(s, row).includes(action.action))
    return reject("action-unavailable");
  const d = row.destination;
  switch (action.action) {
    case "dispatchVoucherSetupCommand": {
      if (action.kind !== "authorization" && action.kind !== "decision")
        return reject("command-invalid");
      if (
        action.kind === "authorization"
          ? action.expectedDecisionId !== null || s.pause.sourceVoucher !== false
          : row.source.decision === "none" ||
            !same(row.source.decisionId ?? "", action.expectedDecisionId)
      )
        return reject("decision-changed");
      if (!uint(action.reviewedNativeFee) || action.reviewedNativeFee !== row.fees[action.kind])
        return reject("fee-changed");
      break;
    }
    case "finalizeVoucherActivation":
      if (!same(row.source.acceptedReceiptHash ?? "", action.expectedAcceptedReceiptHash))
        return reject("acceptance-changed");
      break;
    case "requestVoucherSetupAbort":
    case "retryVoucherSetupAcknowledgment":
    case "retryVoucherFinalAcknowledgment": {
      const fee =
        action.action === "requestVoucherSetupAbort"
          ? row.fees.holderAbortRequest
          : action.action === "retryVoucherSetupAcknowledgment"
            ? row.fees.setupAcknowledgment
            : row.fees.finalAcknowledgment;
      if (!uint(action.reviewedNativeFee) || action.reviewedNativeFee !== fee)
        return reject("fee-changed");
      break;
    }
    case "finalizeVoucherAllocation": {
      if (!d || !same(d.result.appliedDecisionId ?? "", action.expectedActivationDecisionId))
        return reject("activation-changed");
      const {
        approvedDeliveredServiceUnits: units,
        releaseVoucherUnits: release,
        refundVoucherUnits: refund,
      } = action.allocation;
      if (
        ![units, release, refund].every((v) => uint(v)) ||
        units > row.authorization.serviceUnits ||
        release > maxUint256 - refund ||
        release + refund !== row.authorization.voucherUnits ||
        (release > 0n && units === 0n) ||
        (refund > 0n && (d.issuerReturnCeiling === null || refund > d.issuerReturnCeiling))
      )
        return reject("final-allocation-invalid");
      break;
    }
    case "executeVoucherFinalLeg": {
      const f = d?.finalAllocation;
      if (
        !f ||
        !same(f.decisionId, action.expectedDecisionId) ||
        (action.leg !== "release" && action.leg !== "refund")
      )
        return reject("final-decision-changed");
      if (!["pending", "failed"].includes(f[action.leg].state))
        return reject("leg-already-complete");
      break;
    }
  }
  return { allowed: true, reason: null };
}
