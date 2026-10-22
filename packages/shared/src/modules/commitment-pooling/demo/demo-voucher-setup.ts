import {
  voucherAuthorizationIdentity,
  voucherDepositReceiptHash,
  voucherFinalDecisionId,
} from "../service-access-voucher-hashes";
import { keccak256, stringToHex } from "viem";
import type { ServiceAccessSnapshot } from "../service-access-types";
import type {
  ServiceVoucherSetup,
  ServiceVoucherAuthorization,
  VoucherSetupAction,
  VoucherSetupResult,
} from "../service-access-voucher-types";
import { rehearsalHash, REHEARSAL_REDEMPTION } from "./demo-service-identities";
import type { Address } from "../../../types/domain";

const ESCROW = "0x000000000000000000000000000000000000f002" as Address;
const hash = (s: string) => rehearsalHash(`voucher-v2:${s}`);

/** Explicit fictional authorization and local stand-ins; no deployment or signature evidence. */
function createRehearsalSetup(
  s: ServiceAccessSnapshot,
  acceptanceDeadline: bigint
): ServiceVoucherSetup {
  const offer = s.offer!;
  const consent = s.consent!;
  const voucher = offer.voucher!;
  const authorization: ServiceVoucherAuthorization = {
    version: 2,
    sourceChainId: s.key.sourceChainId,
    sourceModule: REHEARSAL_REDEMPTION,
    coreModule: s.key.coreModule,
    commitmentId: s.key.commitmentId,
    termsRevision: offer.revision,
    termsHash: offer.termsHash,
    claimHash: consent.claimHash,
    requestNonce: consent.requestNonce,
    buyer: s.key.buyer,
    holder: consent.voucherHolder,
    buyerGarden: consent.buyerGarden,
    providerGarden: offer.providerGarden,
    destinationChainId: voucher.asset.chainId,
    destinationEscrow: ESCROW,
    issuer: voucher.issuer,
    token: voucher.asset.token,
    voucherUnits: voucher.units,
    serviceUnits: offer.serviceUnits,
    unitLabelHash: keccak256(stringToHex(offer.unitLabel)),
    serviceTermsRef: offer.serviceTermsRef,
    remedyTermsRef: offer.remedyTermsRef,
    acceptanceDeadline,
    remedyPolicy: 1,
  };
  const row: ServiceVoucherSetup = {
    ...voucherAuthorizationIdentity(authorization),
    complete: true,
    relationship: "current",
    asset: voucher.asset,
    authorization,
    source: {
      timestamp: s.sourceTimestamp,
      decision: "none",
      decisionId: null,
      acceptedEver: null,
      acceptedReceiptHash: null,
      authorizationDispatched: false,
      decisionDispatched: false,
      setupResult: null,
      finalResult: null,
    },
    destination: null,
    acknowledgments: {
      setup: {
        destinationSequence: null,
        sentSequence: null,
        sourceObservedSequence: 0n,
        pending: false,
        sent: false,
      },
      final: {
        destinationSequence: null,
        sentSequence: null,
        sourceObservedSequence: 0n,
        pending: false,
        sent: false,
      },
    },
    fees: {
      authorization: 0n,
      decision: 0n,
      holderAbortRequest: 0n,
      setupAcknowledgment: 0n,
      finalAcknowledgment: 0n,
    },
    availableActions: [],
  };
  return row;
}

function authorizedResult(): VoucherSetupResult {
  return {
    sequence: 0n,
    phase: "authorized",
    decision: "none",
    issuerApproved: false,
    depositReceiptHash: null,
    depositedUnits: 0n,
    setupRefundedUnits: 0n,
    appliedDecisionId: null,
    actionSucceeded: true,
    failureHash: null,
  };
}

export function createActiveRehearsalSetup(s: ServiceAccessSnapshot): ServiceVoucherSetup {
  const row = createRehearsalSetup(s, 2000n);
  const receipt = voucherDepositReceiptHash(row.authorization);
  const decision = hash(`activate:${row.setupId}`);
  row.source.authorizationDispatched = true;
  row.source.decisionDispatched = true;
  row.source.decision = "activate";
  row.source.decisionId = decision;
  row.source.acceptedEver = {
    setupModule: row.authorization.sourceModule,
    claimHash: row.authorization.claimHash,
    termsRevision: row.authorization.termsRevision,
    requestNonce: row.authorization.requestNonce,
    setupId: row.setupId,
    authorizationHash: row.authorizationHash,
    depositReceiptHash: receipt,
  };
  row.source.acceptedReceiptHash = hash(`accepted:${row.setupId}`);
  row.source.setupResult = {
    ...authorizedResult(),
    sequence: 2n,
    phase: "deposited",
    issuerApproved: true,
    depositedUnits: 100n,
    depositReceiptHash: receipt,
  };
  row.destination = {
    evidence: "local-rehearsal",
    result: {
      ...row.source.setupResult,
      sequence: 3n,
      phase: "active",
      decision: "activate",
      appliedDecisionId: decision,
    },
    issuerReturnCeiling: 60n,
    pendingAction: null,
    holderAbortRequested: false,
    allowance: 0n,
    holderBalance: 0n,
    finalAllocation: null,
  };
  row.acknowledgments.setup = {
    destinationSequence: 3n,
    sentSequence: null,
    sourceObservedSequence: 2n,
    pending: true,
    sent: false,
  };
  return row;
}

/** Deterministic local transport/transfer observations. Provider/issuer acts are never implied. */
export function applyRehearsalVoucherAction(
  s: ServiceAccessSnapshot,
  action: VoucherSetupAction,
  transfer: () => boolean
): void {
  if (action.action === "prepareVoucherSetup") {
    const row = createRehearsalSetup(s, action.acceptanceDeadline);
    s.voucherSetups = [
      ...s.voucherSetups.map((old) => ({ ...old, relationship: "prior" as const })),
      row,
    ];
    s.currentVoucherSetupId = row.setupId;
    return;
  }
  const row = s.voucherSetups.find((r) => r.setupId === action.setupId)!;
  const a = row.authorization;
  let d = row.destination;
  switch (action.action) {
    case "dispatchVoucherSetupCommand":
      if (action.kind === "authorization") {
        row.source.authorizationDispatched = true;
        if (row.destination) return; // A retry cannot reopen an Abort tombstone.
        row.destination = authorizedDestination(a.voucherUnits);
      } else {
        row.source.decisionDispatched = true;
        row.destination ??= authorizedDestination(a.voucherUnits);
        d = row.destination;
        if (d.result.decision !== "none") {
          if (
            d.result.decision !== row.source.decision ||
            d.result.appliedDecisionId !== row.source.decisionId
          )
            throw new Error("Conflicting local setup decision");
          return; // A transport retry never repeats either outgoing transfer.
        }
        d.result.decision = row.source.decision;
        d.result.appliedDecisionId = row.source.decisionId;
        if (row.source.decision === "activate") {
          if (d.result.depositedUnits !== a.voucherUnits)
            throw new Error("Missing local setup deposit");
          d.result.phase = "active";
        } else if (d.result.depositedUnits === 0n) {
          d.result.phase = "aborted";
          d.pendingAction = null;
          d.result.actionSucceeded = true;
          d.result.failureHash = null;
        } else {
          d.result.phase = "abort-refund-pending";
          d.pendingAction = "abort-refund";
          attemptSetup(row, transfer, s.pause.destinationVoucher === false);
        }
      }
      changedSetup(row);
      return;
    case "abortVoucherSetup":
    case "finalizeVoucherActivation":
      row.source.decision = action.action === "abortVoucherSetup" ? "abort" : "activate";
      row.source.decisionId = hash(`${row.source.decision}:${row.setupId}`);
      return;
    case "approveVoucherAllowance":
      d!.allowance = a.voucherUnits;
      return;
    case "presentVoucherSetup":
      d!.pendingAction = "deposit";
      attemptSetup(row, transfer, s.pause.destinationVoucher === false);
      changedSetup(row);
      return;
    case "retryVoucherSetupAction":
      attemptSetup(row, transfer, s.pause.destinationVoucher === false);
      changedSetup(row);
      return;
    case "requestVoucherSetupAbort":
      d!.holderAbortRequested = true;
      return;
    case "retryVoucherSetupAcknowledgment":
    case "retryVoucherFinalAcknowledgment": {
      const ack =
        action.action === "retryVoucherSetupAcknowledgment"
          ? row.acknowledgments.setup
          : row.acknowledgments.final;
      ack.sent = true;
      ack.sentSequence = ack.destinationSequence;
      // Sending does not synthesize authenticated source observations.
      return;
    }
    case "finalizeVoucherAllocation": {
      const allocation = structuredClone(action.allocation);
      d!.finalAllocation = {
        decisionId: voucherFinalDecisionId(
          a,
          action.expectedActivationDecisionId,
          allocation,
          d!.issuerReturnCeiling!
        ),
        activationDecisionId: action.expectedActivationDecisionId,
        issuerReturnApprovalAtFreeze: d!.issuerReturnCeiling!,
        allocation,
        release: {
          state: allocation.releaseVoucherUnits ? "pending" : "not-required",
          attempts: 0n,
          failureHash: null,
        },
        refund: {
          state: allocation.refundVoucherUnits ? "pending" : "not-required",
          attempts: 0n,
          failureHash: null,
        },
        financiallyClosed: false,
      };
      changedFinal(row);
      return;
    }
    case "executeVoucherFinalLeg": {
      const final = d!.finalAllocation!;
      const leg = final[action.leg];
      leg.attempts++;
      if (!transfer()) {
        leg.state = "failed";
        leg.failureHash = hash("transfer-failed");
      } else {
        leg.state = "succeeded";
        leg.failureHash = null;
        if (action.leg === "refund")
          d!.holderBalance = (d!.holderBalance ?? 0n) + final.allocation.refundVoucherUnits;
      }
      final.financiallyClosed = [final.release.state, final.refund.state].every(
        (v) => v === "succeeded" || v === "not-required"
      );
      changedFinal(row);
    }
  }
}

function authorizedDestination(units: bigint): NonNullable<ServiceVoucherSetup["destination"]> {
  return {
    evidence: "local-rehearsal",
    result: authorizedResult(),
    issuerReturnCeiling: 0n,
    pendingAction: null,
    holderAbortRequested: false,
    allowance: 0n,
    holderBalance: units,
    finalAllocation: null,
  };
}

function attemptSetup(row: ServiceVoucherSetup, transfer: () => boolean, active: boolean) {
  const d = row.destination!;
  if (!active || !transfer()) {
    d.result.actionSucceeded = false;
    d.result.failureHash = hash("transfer-failed");
    return;
  }
  if (d.pendingAction === "deposit") {
    d.result.depositedUnits = row.authorization.voucherUnits;
    d.result.depositReceiptHash = voucherDepositReceiptHash(row.authorization);
    d.holderBalance = (d.holderBalance ?? 0n) - row.authorization.voucherUnits;
    d.allowance = (d.allowance ?? 0n) - row.authorization.voucherUnits;
    d.result.phase = "deposited";
  } else {
    d.result.setupRefundedUnits = d.result.depositedUnits;
    d.holderBalance = (d.holderBalance ?? 0n) + d.result.depositedUnits;
    d.result.phase = "aborted";
  }
  d.pendingAction = null;
  d.result.actionSucceeded = true;
  d.result.failureHash = null;
}
function changedSetup(row: ServiceVoucherSetup) {
  const d = row.destination!;
  d.result.sequence++;
  row.acknowledgments.setup.destinationSequence = d.result.sequence;
  row.acknowledgments.setup.pending = true;
  row.acknowledgments.setup.sent = false;
}
function changedFinal(row: ServiceVoucherSetup) {
  const ack = row.acknowledgments.final;
  ack.destinationSequence = (ack.destinationSequence ?? 0n) + 1n;
  ack.pending = true;
  ack.sent = false;
}
