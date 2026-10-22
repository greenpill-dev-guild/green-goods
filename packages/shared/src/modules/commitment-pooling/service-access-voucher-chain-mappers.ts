import { voucherDepositReceiptHash, voucherFinalDecisionId } from "./service-access-voucher-hashes";
import type { ServiceAccessKey } from "./service-access-types";
import type {
  ServiceVoucherAuthorization,
  VoucherAcceptedReceipt,
  VoucherFinalAllocationRecord,
  VoucherLegProgress,
  VoucherSetupResult,
} from "./service-access-voucher-types";
import {
  serviceAddress as address,
  serviceChainId as chain,
  serviceEnum as ordinal,
  serviceFlag as flag,
  serviceHash as hash,
  serviceTuple as tuple,
  serviceUint as uint,
  SERVICE_ZERO_HASH as ZERO,
} from "./service-access-chain-values";

const AUTH_FIELDS =
  "version sourceChainId sourceModule coreModule commitmentId termsRevision termsHash claimHash requestNonce buyer holder buyerGarden providerGarden destinationChainId destinationEscrow issuer token voucherUnits serviceUnits unitLabelHash serviceTermsRef remedyTermsRef acceptanceDeadline remedyPolicy".split(
    " "
  );
const phase = ["none", "authorized", "deposited", "active", "abort-refund-pending", "aborted"];
const decision = ["none", "activate", "abort"];
const legState = ["not-required", "pending", "failed", "succeeded"];
const nullableHash = (value: unknown) => {
  const parsed = hash(value);
  return parsed === ZERO ? null : parsed;
};

export function mapVoucherAuthorization(
  raw: unknown,
  key: ServiceAccessKey,
  source: string
): ServiceVoucherAuthorization {
  const a = tuple(raw, AUTH_FIELDS);
  if (a.version !== 2 || a.remedyPolicy !== 1) throw new Error("Unsupported voucher authorization");
  const parsed: ServiceVoucherAuthorization = {
    version: 2,
    sourceChainId: chain(a.sourceChainId),
    sourceModule: address(a.sourceModule),
    coreModule: address(a.coreModule),
    commitmentId: uint(a.commitmentId),
    termsRevision: uint(a.termsRevision, 64),
    termsHash: hash(a.termsHash),
    claimHash: hash(a.claimHash),
    requestNonce: uint(a.requestNonce, 64),
    buyer: address(a.buyer),
    holder: address(a.holder),
    buyerGarden: address(a.buyerGarden),
    providerGarden: address(a.providerGarden),
    destinationChainId: chain(a.destinationChainId),
    destinationEscrow: address(a.destinationEscrow),
    issuer: address(a.issuer),
    token: address(a.token),
    voucherUnits: uint(a.voucherUnits),
    serviceUnits: uint(a.serviceUnits),
    unitLabelHash: hash(a.unitLabelHash),
    serviceTermsRef: hash(a.serviceTermsRef),
    remedyTermsRef: hash(a.remedyTermsRef),
    acceptanceDeadline: uint(a.acceptanceDeadline, 64),
    remedyPolicy: 1,
  };
  if (
    parsed.sourceChainId !== key.sourceChainId ||
    parsed.sourceModule !== source.toLowerCase() ||
    parsed.coreModule !== key.coreModule.toLowerCase() ||
    parsed.commitmentId !== key.commitmentId ||
    parsed.buyer !== key.buyer.toLowerCase() ||
    parsed.termsRevision === 0n ||
    parsed.requestNonce === 0n ||
    parsed.voucherUnits === 0n ||
    parsed.voucherUnits === (1n << 256n) - 1n ||
    parsed.serviceUnits === 0n ||
    [
      parsed.termsHash,
      parsed.claimHash,
      parsed.unitLabelHash,
      parsed.serviceTermsRef,
      parsed.remedyTermsRef,
    ].includes(ZERO) ||
    [
      parsed.holder,
      parsed.issuer,
      parsed.token,
      parsed.destinationEscrow,
      parsed.buyerGarden,
      parsed.providerGarden,
    ].some((v) => /^0x0{40}$/.test(v))
  )
    throw new Error("Voucher authorization identity mismatch");
  return parsed;
}

export function mapVoucherAcceptedReceipt(raw: unknown): VoucherAcceptedReceipt | null {
  const r = tuple(raw, [
    "setupModule",
    "claimHash",
    "termsRevision",
    "requestNonce",
    "setupId",
    "authorizationHash",
    "depositReceiptHash",
  ]);
  const parsed = {
    setupModule: address(r.setupModule),
    claimHash: hash(r.claimHash),
    termsRevision: uint(r.termsRevision, 64),
    requestNonce: uint(r.requestNonce, 64),
    setupId: hash(r.setupId),
    authorizationHash: hash(r.authorizationHash),
    depositReceiptHash: hash(r.depositReceiptHash),
  };
  if (parsed.setupId === ZERO) {
    if (
      !/^0x0{40}$/.test(parsed.setupModule) ||
      parsed.claimHash !== ZERO ||
      parsed.termsRevision !== 0n ||
      parsed.requestNonce !== 0n ||
      parsed.authorizationHash !== ZERO ||
      parsed.depositReceiptHash !== ZERO
    )
      throw new Error("Malformed empty accepted escrow receipt");
    return null;
  }
  if (
    parsed.termsRevision === 0n ||
    parsed.requestNonce === 0n ||
    parsed.depositReceiptHash === ZERO
  )
    throw new Error("Invalid accepted escrow receipt");
  return parsed;
}

export function mapVoucherSetupResult(
  raw: unknown,
  id: string,
  payload: string,
  a: ServiceVoucherAuthorization
): VoucherSetupResult | null {
  const r = tuple(raw, [
    "version",
    "setupId",
    "authorizationHash",
    "resultSequence",
    "phase",
    "decision",
    "issuerApproved",
    "depositReceiptHash",
    "depositedUnits",
    "setupRefundedUnits",
    "appliedDecisionId",
    "actionSucceeded",
    "failureHash",
  ]);
  const sequence = uint(r.resultSequence, 64);
  if (sequence === 0n) {
    if (
      r.version !== 0 ||
      hash(r.setupId) !== ZERO ||
      hash(r.authorizationHash) !== ZERO ||
      r.phase !== 0 ||
      r.decision !== 0 ||
      flag(r.issuerApproved) ||
      hash(r.depositReceiptHash) !== ZERO ||
      uint(r.depositedUnits) !== 0n ||
      uint(r.setupRefundedUnits) !== 0n ||
      hash(r.appliedDecisionId) !== ZERO ||
      flag(r.actionSucceeded) ||
      hash(r.failureHash) !== ZERO
    )
      throw new Error("Invalid empty setup result");
    return null;
  }
  if (r.version !== 2 || hash(r.setupId) !== id || hash(r.authorizationHash) !== payload)
    throw new Error("Setup result identity mismatch");
  const parsed: VoucherSetupResult = {
    sequence,
    phase: ordinal(r.phase, phase) as VoucherSetupResult["phase"],
    decision: ordinal(r.decision, decision) as VoucherSetupResult["decision"],
    issuerApproved: flag(r.issuerApproved),
    depositReceiptHash: nullableHash(r.depositReceiptHash),
    depositedUnits: uint(r.depositedUnits),
    setupRefundedUnits: uint(r.setupRefundedUnits),
    appliedDecisionId: nullableHash(r.appliedDecisionId),
    actionSucceeded: flag(r.actionSucceeded),
    failureHash: nullableHash(r.failureHash),
  };
  if (
    parsed.actionSucceeded === (parsed.failureHash !== null) ||
    parsed.phase === "none" ||
    (parsed.setupRefundedUnits !== 0n && parsed.setupRefundedUnits !== parsed.depositedUnits) ||
    (parsed.depositedUnits > 0n && !parsed.issuerApproved) ||
    (parsed.decision === "none"
      ? parsed.appliedDecisionId !== null || parsed.setupRefundedUnits !== 0n
      : parsed.appliedDecisionId === null) ||
    (parsed.phase === "authorized" &&
      (parsed.depositedUnits !== 0n || parsed.decision !== "none")) ||
    (parsed.phase === "deposited" && parsed.decision !== "none") ||
    (["deposited", "active"].includes(parsed.phase) && parsed.setupRefundedUnits !== 0n) ||
    (parsed.phase === "aborted" && parsed.setupRefundedUnits !== parsed.depositedUnits) ||
    (parsed.depositedUnits !== 0n && parsed.depositedUnits !== a.voucherUnits) ||
    (parsed.depositedUnits === 0n) !== (parsed.depositReceiptHash === null) ||
    (parsed.depositReceiptHash !== null &&
      parsed.depositReceiptHash !== voucherDepositReceiptHash(a)) ||
    (["deposited", "active", "aborted"].includes(parsed.phase) && !parsed.actionSucceeded) ||
    (["deposited", "active", "abort-refund-pending"].includes(parsed.phase) &&
      parsed.depositedUnits !== a.voucherUnits) ||
    (parsed.phase === "abort-refund-pending" &&
      (parsed.actionSucceeded || parsed.setupRefundedUnits !== 0n)) ||
    (parsed.phase === "active" && parsed.decision !== "activate") ||
    (["aborted", "abort-refund-pending"].includes(parsed.phase) && parsed.decision !== "abort")
  )
    throw new Error("Incoherent setup result");
  return parsed;
}

function mapLeg(raw: unknown): VoucherLegProgress {
  const leg = tuple(raw, ["state", "attempts", "failureHash"]);
  const parsed = {
    state: ordinal(leg.state, legState) as VoucherLegProgress["state"],
    attempts: uint(leg.attempts, 64),
    failureHash: nullableHash(leg.failureHash),
  };
  if (
    (parsed.state === "failed") !== (parsed.failureHash !== null) ||
    (["failed", "succeeded"].includes(parsed.state) && parsed.attempts === 0n) ||
    (["pending", "not-required"].includes(parsed.state) && parsed.attempts !== 0n)
  )
    throw new Error("Invalid final leg progress");
  return parsed;
}
export function mapVoucherFinalResult(
  raw: unknown,
  id: string,
  payload: string,
  a: ServiceVoucherAuthorization
): (VoucherFinalAllocationRecord & { sequence: bigint }) | null {
  const r = tuple(raw, [
    "protocolVersion",
    "setupId",
    "payloadHash",
    "sequence",
    "activationDecisionId",
    "decisionId",
    "issuerReturnApprovalAtFreeze",
    "allocation",
    "release",
    "refund",
  ]);
  const sequence = uint(r.sequence, 64);
  if (sequence === 0n) {
    if (r.protocolVersion !== 0 || hash(r.setupId) !== ZERO || hash(r.payloadHash) !== ZERO)
      throw new Error("Malformed empty final result");
    return null;
  }
  if (r.protocolVersion !== 2 || hash(r.setupId) !== id || hash(r.payloadHash) !== payload)
    throw new Error("Final result identity mismatch");
  const allocation = tuple(r.allocation, [
    "approvedDeliveredServiceUnits",
    "releaseVoucherUnits",
    "refundVoucherUnits",
  ]);
  const parsed = {
    sequence,
    activationDecisionId: hash(r.activationDecisionId),
    decisionId: hash(r.decisionId),
    issuerReturnApprovalAtFreeze: uint(r.issuerReturnApprovalAtFreeze),
    allocation: {
      approvedDeliveredServiceUnits: uint(allocation.approvedDeliveredServiceUnits),
      releaseVoucherUnits: uint(allocation.releaseVoucherUnits),
      refundVoucherUnits: uint(allocation.refundVoucherUnits),
    },
    release: mapLeg(r.release),
    refund: mapLeg(r.refund),
    financiallyClosed: false,
  };
  if (
    parsed.allocation.releaseVoucherUnits + parsed.allocation.refundVoucherUnits !==
      a.voucherUnits ||
    parsed.issuerReturnApprovalAtFreeze > a.voucherUnits ||
    parsed.allocation.approvedDeliveredServiceUnits > a.serviceUnits ||
    parsed.allocation.refundVoucherUnits > parsed.issuerReturnApprovalAtFreeze ||
    (parsed.allocation.releaseVoucherUnits > 0n &&
      parsed.allocation.approvedDeliveredServiceUnits === 0n) ||
    parsed.activationDecisionId === ZERO ||
    parsed.decisionId === ZERO ||
    parsed.decisionId !==
      voucherFinalDecisionId(
        a,
        parsed.activationDecisionId,
        parsed.allocation,
        parsed.issuerReturnApprovalAtFreeze
      ) ||
    (parsed.allocation.releaseVoucherUnits === 0n) !== (parsed.release.state === "not-required") ||
    (parsed.allocation.refundVoucherUnits === 0n) !== (parsed.refund.state === "not-required")
  )
    throw new Error("Invalid frozen final allocation");
  parsed.financiallyClosed = [parsed.release.state, parsed.refund.state].every(
    (v) => v === "succeeded" || v === "not-required"
  );
  return parsed;
}
