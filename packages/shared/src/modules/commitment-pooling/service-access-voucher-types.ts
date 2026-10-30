import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { ServiceAsset } from "./service-access-types";

/** Exact v2 setup authorization. Source acceptance cutoff is separate from core service terms. */
export interface ServiceVoucherAuthorization {
  version: 2;
  sourceChainId: number;
  sourceModule: Address;
  coreModule: Address;
  commitmentId: bigint;
  termsRevision: bigint;
  termsHash: Hex;
  claimHash: Hex;
  requestNonce: bigint;
  buyer: Address;
  holder: Address;
  buyerGarden: Address;
  providerGarden: Address;
  destinationChainId: number;
  destinationEscrow: Address;
  issuer: Address;
  token: Address;
  voucherUnits: bigint;
  serviceUnits: bigint;
  unitLabelHash: Hex;
  serviceTermsRef: Hex;
  remedyTermsRef: Hex;
  acceptanceDeadline: bigint;
  remedyPolicy: 1;
}

export type VoucherSetupDecision = "none" | "activate" | "abort";
export type VoucherSetupPhase =
  | "none"
  | "authorized"
  | "deposited"
  | "active"
  | "abort-refund-pending"
  | "aborted";
export type VoucherFinalLeg = "release" | "refund";
export type VoucherLegState = "not-required" | "pending" | "failed" | "succeeded";

export interface VoucherFinalAllocation {
  approvedDeliveredServiceUnits: bigint;
  releaseVoucherUnits: bigint;
  refundVoucherUnits: bigint;
}

export interface VoucherLegProgress {
  state: VoucherLegState;
  attempts: bigint;
  failureHash: Hex | null;
}

export interface VoucherFinalAllocationRecord {
  decisionId: Hex;
  activationDecisionId: Hex;
  issuerReturnApprovalAtFreeze: bigint;
  allocation: VoucherFinalAllocation;
  release: VoucherLegProgress;
  refund: VoucherLegProgress;
  financiallyClosed: boolean;
}

export interface VoucherSetupResult {
  sequence: bigint;
  phase: VoucherSetupPhase;
  decision: VoucherSetupDecision;
  issuerApproved: boolean;
  depositReceiptHash: Hex | null;
  depositedUnits: bigint;
  setupRefundedUnits: bigint;
  appliedDecisionId: Hex | null;
  actionSucceeded: boolean;
  failureHash: Hex | null;
}

export interface VoucherAcceptedReceipt {
  setupModule: Address;
  claimHash: Hex;
  termsRevision: bigint;
  requestNonce: bigint;
  setupId: Hex;
  authorizationHash: Hex;
  depositReceiptHash: Hex;
}

export interface VoucherAcknowledgment {
  destinationSequence: bigint | null;
  sentSequence: bigint | null;
  sourceObservedSequence: bigint;
  pending: boolean | null;
  sent: boolean;
}

export interface ServiceVoucherSetup {
  setupId: Hex;
  authorizationHash: Hex;
  authorization: ServiceVoucherAuthorization;
  complete: boolean;
  relationship: "current" | "prior";
  asset: ServiceAsset;
  source: {
    /** Authoritative source block time; never the device clock. */
    timestamp: bigint | null;
    decision: VoucherSetupDecision;
    decisionId: Hex | null;
    acceptedEver: VoucherAcceptedReceipt | null;
    acceptedReceiptHash: Hex | null;
    authorizationDispatched: boolean;
    decisionDispatched: boolean;
    authorizationMessageId?: Hex | null;
    decisionMessageId?: Hex | null;
    setupResult: VoucherSetupResult | null;
    finalResult: (VoucherFinalAllocationRecord & { sequence: bigint }) | null;
  };
  destination: null | {
    evidence: "onchain" | "indexed" | "local-rehearsal";
    result: VoucherSetupResult;
    issuerReturnCeiling: bigint | null;
    pendingAction: "deposit" | "abort-refund" | "unknown" | null;
    holderAbortRequested: boolean;
    allowance: bigint | null;
    holderBalance: bigint | null;
    finalAllocation: VoucherFinalAllocationRecord | null;
  };
  acknowledgments: { setup: VoucherAcknowledgment; final: VoucherAcknowledgment };
  fees: {
    authorization: bigint | null;
    decision: bigint | null;
    holderAbortRequest: bigint | null;
    setupAcknowledgment: bigint | null;
    finalAcknowledgment: bigint | null;
  };
  availableActions: readonly VoucherSetupActionKind[];
}

export interface EarnedVoucherAcceptance {
  status: "unknown" | "unbound" | "bound";
  module: Address | null;
  revision: bigint | null;
  termsHash: Hex | null;
  acceptedRevision: bigint | null;
  acceptedTermsHash: Hex | null;
  acceptedCounterparty: Address | null;
  terms: null | {
    issuer: Address;
    issuerAuthority: Address;
    asset: ServiceAsset;
    totalUnits: bigint;
    allocationPolicy: Hex;
    serviceTermsRef: Hex;
    season: bigint;
    issuerApproved: boolean;
    frozen: boolean;
  };
  creator: Address | null;
  creatorConsentRevision: bigint | null;
  participant: Address | null;
  participantConsentRevision: bigint | null;
  /** Only an individual claim's member agrees from their own account; a garden claim's account must. */
  claimType: "individual" | "garden" | null;
  /** The revision the reading account agreed to, 0 when it has not; read before it takes the promise up. */
  viewerConsentRevision: bigint | null;
  /** The reward module refuses every agreement while paused. */
  modulePaused: boolean | null;
  /** A steward's EOA is never substituted for an intended GardenAccount. */
  accountRouteAvailable: false;
}

export interface VoucherAcceptancePolicy {
  kind: "ordinary" | "earned" | "service" | "unknown";
  knownOptIn: boolean;
  blockGenericMemberAcceptance: boolean;
  earned: EarnedVoucherAcceptance;
}

interface BoundSetup {
  sourceChainId: number;
  sourceModule: Address;
  setupId: Hex;
  expectedAuthorizationHash: Hex;
}

export type VoucherSetupAction =
  | {
      action: "prepareVoucherSetup";
      expectedRevision: bigint;
      expectedTermsHash: Hex;
      expectedClaimHash: Hex;
      expectedRequestNonce: bigint;
      acceptanceDeadline: bigint;
    }
  | (BoundSetup & {
      action: "dispatchVoucherSetupCommand";
      kind: "authorization" | "decision";
      expectedDecisionId: Hex | null;
      reviewedNativeFee: bigint;
    })
  | (BoundSetup & { action: "abortVoucherSetup" })
  | (BoundSetup & { action: "finalizeVoucherActivation"; expectedAcceptedReceiptHash: Hex })
  | (BoundSetup & {
      action:
        | "approveVoucherAllowance"
        | "revokeVoucherAllowance"
        | "presentVoucherSetup"
        | "retryVoucherSetupAction";
    })
  | (BoundSetup & {
      action:
        | "requestVoucherSetupAbort"
        | "retryVoucherSetupAcknowledgment"
        | "retryVoucherFinalAcknowledgment";
      reviewedNativeFee: bigint;
    })
  | (BoundSetup & {
      action: "finalizeVoucherAllocation";
      expectedActivationDecisionId: Hex;
      allocation: VoucherFinalAllocation;
    })
  | (BoundSetup & {
      action: "executeVoucherFinalLeg";
      expectedDecisionId: Hex;
      leg: VoucherFinalLeg;
    });

export type VoucherSetupActionKind = VoucherSetupAction["action"];
