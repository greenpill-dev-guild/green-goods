import {
  type ServiceAccessSnapshot,
  type ServiceVoucherSetup,
  serviceAccessAvailableActions,
} from "@green-goods/shared/commitment-pooling";

const BUYER = "0x000000000000000000000000000000000000f011";
const GARDEN = "0x000000000000000000000000000000000000f012";
const MODULE = "0x000000000000000000000000000000000000f013";
const TOKEN = "0x000000000000000000000000000000000000f014";
const HASH = `0x${"ab".repeat(32)}` as const;
const DECISION = `0x${"cd".repeat(32)}` as const;

/** Fictional presentation fixtures, not deployments, signatures or service commitments. */
export function serviceAccessStorySnapshot(presented = false): ServiceAccessSnapshot {
  const snapshot: ServiceAccessSnapshot = {
    key: { sourceChainId: 42161, coreModule: MODULE, commitmentId: 1024n, buyer: BUYER },
    mode: "voucher",
    knownService: true,
    evidence: "local-rehearsal",
    complete: true,
    offer: {
      route: "voucher",
      revision: 1n,
      termsHash: HASH,
      serviceTermsRef: HASH,
      remedyTermsRef: HASH,
      serviceUnits: 10n,
      unitLabel: "lessons",
      providerGarden: GARDEN,
      gdPrice: 0n,
      voucher: {
        asset: { chainId: 100, token: TOKEN, symbol: "TEST-VOUCHER", decimals: 0 },
        issuer: MODULE,
        units: 100n,
      },
    },
    consent: presented
      ? {
          revision: 1n,
          requestNonce: 1n,
          termsHash: HASH,
          claimHash: HASH,
          buyerGarden: GARDEN,
          voucherHolder: BUYER,
          state: "accepted",
        }
      : null,
    nextRequestNonce: 1n,
    coreState: presented ? "ACCEPTED" : "OFFERED",
    pause: { core: false, sourceVoucher: false, destinationVoucher: false },
    eligibleBuyerGardens: [{ address: GARDEN, name: "Fictional local garden" }],
    personalFeeQuote: null,
    personalPaymentAccount: null,
    availableActions: [],
    personalPurchase: null,
    sourceTimestamp: 1000n,
    sourceBlock: null,
    currentVoucherSetupId: presented ? HASH : null,
    voucherSetups: [],
    acceptancePolicy: {
      kind: "service",
      knownOptIn: true,
      blockGenericMemberAcceptance: true,
      earned: {
        status: "unbound",
        module: null,
        revision: null,
        termsHash: null,
        acceptedRevision: null,
        acceptedTermsHash: null,
        acceptedCounterparty: null,
        terms: null,
        creator: null,
        creatorConsentRevision: null,
        participant: null,
        participantConsentRevision: null,
        accountRouteAvailable: false,
      },
    },
    capabilities: {
      mutation: "local-rehearsal",
      reasons: [],
      sourceBuyer: BUYER,
      celoDepositor: null,
      gnosisHolder: BUYER,
      canSignSource: true,
      canSendSource: true,
      canSignCelo: false,
      canSignHolder: true,
      canSendDestination: true,
    },
  };
  if (presented) {
    const row: ServiceVoucherSetup = {
      setupId: HASH,
      authorizationHash: HASH,
      complete: true,
      relationship: "current",
      asset: snapshot.offer!.voucher!.asset,
      authorization: {
        version: 2,
        sourceChainId: 42161,
        sourceModule: MODULE,
        coreModule: MODULE,
        commitmentId: 1024n,
        termsRevision: 1n,
        termsHash: HASH,
        claimHash: HASH,
        requestNonce: 1n,
        buyer: BUYER,
        holder: BUYER,
        buyerGarden: GARDEN,
        providerGarden: GARDEN,
        destinationChainId: 100,
        destinationEscrow: MODULE,
        issuer: MODULE,
        token: TOKEN,
        voucherUnits: 100n,
        serviceUnits: 10n,
        unitLabelHash: HASH,
        serviceTermsRef: HASH,
        remedyTermsRef: HASH,
        acceptanceDeadline: 2000n,
        remedyPolicy: 1,
      },
      source: {
        timestamp: 1000n,
        decision: "activate",
        decisionId: DECISION,
        acceptedEver: {
          setupModule: MODULE,
          claimHash: HASH,
          termsRevision: 1n,
          requestNonce: 1n,
          setupId: HASH,
          authorizationHash: HASH,
          depositReceiptHash: HASH,
        },
        acceptedReceiptHash: HASH,
        authorizationDispatched: true,
        decisionDispatched: true,
        setupResult: null,
        finalResult: null,
      },
      destination: {
        evidence: "local-rehearsal",
        result: {
          sequence: 3n,
          phase: "active",
          decision: "activate",
          issuerApproved: true,
          depositReceiptHash: HASH,
          depositedUnits: 100n,
          setupRefundedUnits: 0n,
          appliedDecisionId: DECISION,
          actionSucceeded: true,
          failureHash: null,
        },
        issuerReturnCeiling: 60n,
        pendingAction: null,
        holderAbortRequested: false,
        allowance: 0n,
        holderBalance: 0n,
        finalAllocation: null,
      },
      acknowledgments: {
        setup: {
          destinationSequence: 3n,
          sentSequence: null,
          sourceObservedSequence: 2n,
          pending: true,
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
    snapshot.voucherSetups = [row];
    row.availableActions = serviceAccessAvailableActions(snapshot).filter(
      (kind) =>
        kind !== "requestClaim" &&
        kind !== "withdrawClaim" &&
        kind !== "pledgePersonal" &&
        kind !== "payPersonal"
    );
  }
  snapshot.availableActions = serviceAccessAvailableActions(snapshot);
  return snapshot;
}
