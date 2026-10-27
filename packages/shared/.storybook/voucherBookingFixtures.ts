import { keccak256, stringToHex, type Hex } from "viem";
import { commitmentPoolingKeys } from "../src/config/query-keys/commitment-pooling";
import {
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "../src/__tests__/test-utils/commitment-pooling-fixtures";
import { gardenCommitmentControllerFixture } from "../src/__tests__/test-utils/controller-fixtures";
import type { CommitmentDerivedState } from "../src/modules/commitment-pooling";
import { serviceAccessAvailableActions } from "../src/modules/commitment-pooling/service-access";
import type { ServiceAccessPilot } from "../src/modules/commitment-pooling/service-access-pilot-types";
import type { ServiceAccessSnapshot } from "../src/modules/commitment-pooling/service-access-types";
import { voucherSetupAvailableActions } from "../src/modules/commitment-pooling/service-access-voucher";
import type {
  ServiceVoucherSetup,
  VoucherSetupPhase,
} from "../src/modules/commitment-pooling/service-access-voucher-types";
import {
  voucherBookingEscrow,
  voucherPendingReturn,
} from "../src/modules/commitment-pooling/service-access-wallet";
import type {
  VoucherIssuer,
  VoucherWalletSnapshot,
} from "../src/modules/commitment-pooling/service-access-wallet-types";
import type { GardenCommitmentController } from "../src/hooks/client-ui/commitment/controller.types";
import type { Address, Garden } from "../src/types/domain";
import { VOUCHER_STORY_ISSUERS, VOUCHER_STORY_SCOPE, vouchers } from "./voucherPilotFixtures";

/**
 * Storybook-only voucher bookings for the pilot's journeys: a Tech and Sun hub day for one
 * voucher and Green Goods' Claude access for ten, at every stage the design draws, and a request
 * that rewards vouchers with optional G$. Fictional accounts and receipts; the acts each stage
 * offers come from the real shared selectors, so a story only shows what the page could send.
 */
export type BookingStoryService = "hubDay" | "access";
export type BookingStoryStage =
  | "open"
  | "notEnough"
  | "waitingApproval"
  | "readyToDeposit"
  | "confirmingDeposit"
  | "waitingAcceptance"
  | "starting"
  | "inProgress"
  | "readyToClose"
  | "returnProposed"
  | "transfersPending"
  | "returnFailed"
  | "closed"
  | "canceling"
  | "canceled"
  | "acceptedFirst"
  | "termsChanged"
  | "problemReported";

const hash = (value: string): Hex => keccak256(stringToHex(`STORYBOOK_VOUCHER_PILOT:${value}`));
const DAY = 86_400n;
/** 26 October 2026 at noon UTC: the day the reader agrees, so the deadline reads 2 November. */
export const VOUCHER_STORY_AGREED_AT = BigInt(Date.UTC(2026, 9, 26, 12) / 1000);
export const VOUCHER_STORY_HOME_GARDEN = "0x000000000000000000000000000000000000f103" as Address;
const ESCROW = "0x000000000000000000000000000000000000f104" as Address;
const SOURCE_MODULE = "0x000000000000000000000000000000000000f105" as Address;
const buyer = VOUCHER_STORY_SCOPE.account;

const SERVICES: Record<
  BookingStoryService,
  {
    commitmentId: bigint;
    issuer: VoucherIssuer;
    units: bigint;
    serviceUnits: bigint;
    unitLabel: string;
    title: string;
    note: string;
    /** What the reader holds of the voucher before booking. */
    held: bigint;
  }
> = {
  hubDay: {
    commitmentId: 4101n,
    issuer: VOUCHER_STORY_ISSUERS.techAndSun,
    units: vouchers(1),
    serviceUnits: 1n,
    unitLabel: "hub day",
    title: "Hub day, up to 4 hours",
    note: "A reserved visit to the Tech and Sun hub for one named person, with workspace, power and connectivity for up to four hours.",
    held: vouchers(9),
  },
  access: {
    commitmentId: 4102n,
    issuer: VOUCHER_STORY_ISSUERS.greenGoods,
    units: vouchers(10),
    serviceUnits: 30n,
    unitLabel: "days",
    title: "Claude access, 30 days",
    note: "Thirty days of a named Claude Team seat in Green Goods' organization, from the day you can sign in and confirm access. It doesn't renew on its own.",
    held: vouchers(10),
  },
};

/** The split each service ends on: a full hub day, or Claude access stopped after 12 of 30 days. */
const SPLIT: Record<BookingStoryService, { delivered: bigint; release: bigint; refund: bigint }> = {
  hubDay: { delivered: 1n, release: vouchers(1), refund: 0n },
  access: { delivered: 12n, release: vouchers(4), refund: vouchers(6) },
};

const ORDER: BookingStoryStage[] = [
  "waitingApproval",
  "readyToDeposit",
  "confirmingDeposit",
  "waitingAcceptance",
  "starting",
  "inProgress",
  "readyToClose",
  "transfersPending",
  "closed",
];
const reached = (stage: BookingStoryStage, step: BookingStoryStage) => {
  const at = {
    returnProposed: ORDER.indexOf("readyToClose"),
    returnFailed: ORDER.indexOf("transfersPending"),
    acceptedFirst: ORDER.indexOf("inProgress"),
    problemReported: ORDER.indexOf("inProgress"),
    termsChanged: ORDER.indexOf("waitingAcceptance"),
    canceling: ORDER.indexOf("confirmingDeposit"),
    canceled: ORDER.indexOf("confirmingDeposit"),
  }[stage as string];
  return (at ?? ORDER.indexOf(stage)) >= ORDER.indexOf(step);
};

/** The core promise's state at each stage: Kept only once the reader confirms it. */
export function bookingStoryCoreState(
  service: BookingStoryService,
  stage: BookingStoryStage,
  confirmed = false
): CommitmentDerivedState {
  if (stage === "problemReported") return "DISPUTED";
  if (["open", "notEnough", "canceling", "canceled", "termsChanged"].includes(stage) || !reached(stage, "starting"))
    return "OFFERED";
  if (stage === "closed") return service === "hubDay" ? "FULFILLED" : "CANCELLED";
  if (service === "hubDay" && (stage === "transfersPending" || stage === "returnFailed"))
    return confirmed ? "FULFILLED" : "READY_FOR_CONFIRMATION";
  if (stage === "readyToClose") return "READY_FOR_CONFIRMATION";
  return "ACCEPTED";
}

/** One booking's service snapshot at a stage, with the acts the shared selectors allow. */
export function bookingStorySnapshot(
  service: BookingStoryService,
  stage: BookingStoryStage,
  options: {
    confirmed?: boolean;
    held?: bigint;
    /** The shared pool's exchange, for an offer the reader holds too few vouchers for. */
    exchange?: ExchangeStoryState;
    /** False is the moment an acceptance lands, before the source records the activation. */
    activationRecorded?: boolean;
    /** False is a split whose transfers nobody sent yet: the reader declined their prompt. */
    legsSent?: boolean;
    /** A deposit whose confirmation to the source didn't go, so it waits on a retry. */
    ackStuck?: boolean;
    /** A deposit the escrow took but couldn't finish, kept to retry as it was stored. */
    depositRetry?: boolean;
    /** False is a cancellation recorded on the source but not yet sent to the escrow. */
    cancelSent?: boolean;
    pause?: Partial<ServiceAccessSnapshot["pause"]>;
  } = {}
): ServiceAccessSnapshot {
  const k = SERVICES[service];
  const key = {
    sourceChainId: VOUCHER_STORY_SCOPE.sourceChainId,
    coreModule: VOUCHER_STORY_SCOPE.coreModule,
    commitmentId: k.commitmentId,
    buyer,
  };
  const termsHash = hash(`${service}:terms:2`);
  const claimHash = hash(`${service}:claim:1`);
  const held = options.held ?? (stage === "notEnough" ? vouchers(2) : k.held);
  const s: ServiceAccessSnapshot = {
    key,
    mode: "voucher",
    knownService: true,
    evidence: "local-rehearsal",
    complete: true,
    offer: {
      route: "voucher",
      revision: stage === "termsChanged" ? 3n : 2n,
      termsHash: stage === "termsChanged" ? hash(`${service}:terms:3`) : termsHash,
      serviceTermsRef: hash(`${service}:service-terms`),
      remedyTermsRef: hash(`${service}:remedy-terms`),
      serviceUnits: k.serviceUnits,
      unitLabel: k.unitLabel,
      providerGarden: k.issuer.garden,
      gdPrice: 0n,
      voucher: { asset: k.issuer.asset, issuer: k.issuer.account, units: k.units },
    },
    consent: null,
    nextRequestNonce: 1n,
    coreState: bookingStoryCoreState(service, stage, options.confirmed),
    pause: { core: false, sourceVoucher: false, destinationVoucher: false },
    eligibleBuyerGardens: [{ address: VOUCHER_STORY_HOME_GARDEN, name: "Riverside Commons Garden" }],
    personalFeeQuote: null,
    personalPaymentAccount: null,
    availableActions: [],
    personalPurchase: null,
    sourceTimestamp: VOUCHER_STORY_AGREED_AT,
    sourceBlock: null,
    currentVoucherSetupId: null,
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
        claimType: null,
        viewerConsentRevision: null,
        modulePaused: null,
        accountRouteAvailable: false,
      },
    },
    capabilities: {
      mutation: "local-rehearsal",
      reasons: [],
      sourceBuyer: buyer,
      celoDepositor: null,
      gnosisHolder: buyer,
      canSignSource: true,
      canSendSource: true,
      canSignCelo: false,
      canSignHolder: true,
      canSendDestination: true,
    },
  };
  if (stage !== "open" && stage !== "notEnough") {
    const accepted = reached(stage, "starting") && !["canceling", "canceled", "termsChanged"].includes(stage);
    s.consent = {
      revision: 2n,
      requestNonce: 1n,
      termsHash,
      claimHash,
      buyerGarden: VOUCHER_STORY_HOME_GARDEN,
      voucherHolder: buyer,
      state: accepted ? "accepted" : "pending",
    };
    s.nextRequestNonce = 2n;
    const setup = bookingStorySetup(service, stage, {
      termsHash,
      claimHash,
      held,
      activationRecorded: options.activationRecorded ?? true,
      legsSent: options.legsSent ?? true,
      ackStuck: options.ackStuck ?? false,
      depositRetry: options.depositRetry ?? false,
      cancelSent: options.cancelSent ?? true,
    });
    if (options.pause) s.pause = { ...s.pause, ...options.pause };
    s.voucherSetups = [setup];
    s.currentVoucherSetupId = setup.setupId;
    setup.availableActions = voucherSetupAvailableActions(s, setup);
  }
  if (options.exchange) s.pilot = exchangeStoryPilot(options.exchange);
  s.availableActions = serviceAccessAvailableActions(s);
  return s;
}

/** Where Lina's exchange stands; `short` and `failed` are the quote's failed runs. */
export type ExchangeStoryState = "none" | "quoted" | "unknown" | "confirmed" | "short" | "failed";

/**
 * Lina's exchange in the one shared pool: 8.01 Tech and Sun vouchers for 8 Green Goods vouchers
 * at the pilot's 1:1, with a 0.01 protocol fee, a minimum of 8 and a quote valid until 14:05. A
 * short pool has 5 left to give; a failed run's transfer didn't go through.
 */
function exchangeStoryPilot(status: ExchangeStoryState): ServiceAccessPilot {
  const { greenGoods, techAndSun } = VOUCHER_STORY_ISSUERS;
  const swapped = status === "unknown" || status === "confirmed";
  const quote =
    status === "none"
      ? null
      : {
          id: hash("exchange:quote:1"),
          chainId: 100 as const,
          pool: "0x000000000000000000000000000000000000fc01" as Address,
          holder: buyer,
          inputToken: techAndSun.asset.token,
          outputToken: greenGoods.asset.token,
          input: vouchers(8.01),
          grossOutput: vouchers(8.01),
          poolFee: 0n,
          protocolFee: vouchers(0.01),
          netOutput: vouchers(8),
          minimumOutput: vouchers(8),
          deadline: BigInt(Date.UTC(2026, 9, 25, 14, 5) / 1000),
          configuration: 1n,
        };
  return {
    evidence: "local-rehearsal",
    serviceCommitmentId: 1023n,
    // Claude access takes 10 Green Goods vouchers, so 2 held is short and the pool can quote.
    service: { access: "full", units: 1n, durationMinutes: 60, voucherUnits: vouchers(10), validUntil: 5000n },
    assets: { a: techAndSun.asset, b: greenGoods.asset },
    holdings: { a: swapped ? vouchers(0.99) : vouchers(9), b: swapped ? vouchers(10) : vouchers(2) },
    reward: null,
    inventory: { asset: greenGoods.asset, reserve: 0n, allowance: 0n, acceptedUndelivered: 0n },
    exchange: {
      pool: "0x000000000000000000000000000000000000fc01" as Address,
      inventory: swapped ? vouchers(6) : status === "short" ? vouchers(5) : vouchers(14),
      inputHolding: swapped ? vouchers(8.01) : 0n,
      inputLimit: vouchers(20),
      listed: true,
      allowance: quote ? quote.input : 0n,
      status: status === "short" || status === "failed" ? "failed" : status,
      failure: status === "short" ? "inventory" : status === "failed" ? "transfer" : null,
      quote,
      receipt: swapped
        ? {
            evidence: "local-rehearsal",
            observationId: "local-rehearsal:swap:story",
            pool: "0x000000000000000000000000000000000000fc01" as Address,
            chainId: 100,
          }
        : null,
    },
  } as ServiceAccessPilot;
}

function bookingStorySetup(
  service: BookingStoryService,
  stage: BookingStoryStage,
  ids: {
    termsHash: Hex;
    claimHash: Hex;
    held: bigint;
    activationRecorded: boolean;
    legsSent: boolean;
    ackStuck: boolean;
    depositRetry: boolean;
    cancelSent: boolean;
  }
): ServiceVoucherSetup {
  const k = SERVICES[service];
  const units = k.units;
  const setupId = hash(`${service}:setup:1`);
  const authorizationHash = hash(`${service}:authorization:1`);
  const decisionId = hash(`${service}:decision:${stage === "canceling" || stage === "canceled" ? "abort" : "activate"}`);
  const depositReceiptHash = hash(`${service}:deposit`);
  const approved = reached(stage, "readyToDeposit");
  const deposited = reached(stage, "confirmingDeposit");
  const observed = reached(stage, "waitingAcceptance") && stage !== "canceling" && stage !== "canceled";
  const accepted = reached(stage, "starting") && !["canceling", "canceled", "termsChanged"].includes(stage);
  const active = reached(stage, "inProgress") && accepted;
  const recorded = accepted && (active || ids.activationRecorded);
  const final = reached(stage, "transfersPending") && accepted;
  const aborting = stage === "canceling" || stage === "canceled";
  const split = SPLIT[service];
  const result = {
    sequence: deposited ? 2n : 1n,
    phase: (stage === "canceled"
      ? "aborted"
      : active
        ? "active"
        : deposited
          ? "deposited"
          : "authorized") as VoucherSetupPhase,
    decision: (aborting && stage === "canceled" ? "abort" : active ? "activate" : "none") as
      | "none"
      | "activate"
      | "abort",
    issuerApproved: approved,
    depositReceiptHash: deposited ? depositReceiptHash : null,
    depositedUnits: deposited ? units : 0n,
    setupRefundedUnits: stage === "canceled" ? units : 0n,
    appliedDecisionId: active || stage === "canceled" ? decisionId : null,
    actionSucceeded: !ids.depositRetry,
    failureHash: ids.depositRetry ? hash(`${service}:deposit-failed`) : null,
  };
  // A transfer the split fixed is on its way once sent (the design's pending row); until then
  // it waits for the reader's own act.
  const attempts =
    stage === "returnFailed" || (stage === "transfersPending" && ids.legsSent) ? 1n : 0n;
  // The deposit's confirmation goes to the source with it, unless it didn't go.
  const ackSent = observed || (deposited && !ids.ackStuck);
  const legState = (leg: "release" | "refund") => {
    if (stage === "closed") return "succeeded" as const;
    if (stage === "returnFailed")
      return service === "access"
        ? leg === "refund"
          ? ("failed" as const)
          : ("succeeded" as const)
        : ("failed" as const);
    return "pending" as const;
  };
  return {
    setupId,
    authorizationHash,
    complete: true,
    relationship: "current",
    asset: k.issuer.asset,
    authorization: {
      version: 2,
      sourceChainId: VOUCHER_STORY_SCOPE.sourceChainId,
      sourceModule: SOURCE_MODULE,
      coreModule: VOUCHER_STORY_SCOPE.coreModule,
      commitmentId: k.commitmentId,
      termsRevision: 2n,
      termsHash: ids.termsHash,
      claimHash: ids.claimHash,
      requestNonce: 1n,
      buyer,
      holder: buyer,
      buyerGarden: VOUCHER_STORY_HOME_GARDEN,
      providerGarden: k.issuer.garden,
      destinationChainId: k.issuer.asset.chainId,
      destinationEscrow: ESCROW,
      issuer: k.issuer.account,
      token: k.issuer.asset.token,
      voucherUnits: units,
      serviceUnits: k.serviceUnits,
      unitLabelHash: hash(k.unitLabel),
      serviceTermsRef: hash(`${service}:service-terms`),
      remedyTermsRef: hash(`${service}:remedy-terms`),
      acceptanceDeadline: VOUCHER_STORY_AGREED_AT + 7n * DAY,
      remedyPolicy: 1,
    },
    source: {
      timestamp: VOUCHER_STORY_AGREED_AT,
      decision: aborting ? "abort" : recorded ? "activate" : "none",
      decisionId: aborting || recorded ? decisionId : null,
      acceptedEver: accepted
        ? {
            setupModule: SOURCE_MODULE,
            claimHash: ids.claimHash,
            termsRevision: 2n,
            requestNonce: 1n,
            setupId,
            authorizationHash,
            depositReceiptHash,
          }
        : null,
      acceptedReceiptHash: accepted ? hash(`${service}:accepted`) : null,
      authorizationDispatched: true,
      decisionDispatched:
        active || stage === "canceled" || (stage === "canceling" && ids.cancelSent),
      setupResult: observed ? { ...result, phase: "deposited", decision: "none", appliedDecisionId: null } : null,
      finalResult: null,
    },
    destination: {
      evidence: "local-rehearsal",
      result,
      issuerReturnCeiling:
        stage === "returnProposed" ? (service === "hubDay" ? units : split.refund) : final ? split.refund : 0n,
      pendingAction: ids.depositRetry ? "deposit" : null,
      holderAbortRequested: stage === "acceptedFirst",
      allowance: deposited ? 0n : approved && stage !== "readyToDeposit" ? units : 0n,
      holderBalance: deposited ? ids.held - units : ids.held,
      finalAllocation: final
        ? {
            decisionId: hash(`${service}:final`),
            activationDecisionId: decisionId,
            issuerReturnApprovalAtFreeze: split.refund,
            allocation: {
              approvedDeliveredServiceUnits: split.delivered,
              releaseVoucherUnits: split.release,
              refundVoucherUnits: split.refund,
            },
            release: { state: legState("release"), attempts, failureHash: null },
            refund: split.refund
              ? { state: legState("refund"), attempts, failureHash: null }
              : { state: "not-required", attempts: 0n, failureHash: null },
            financiallyClosed: stage === "closed",
          }
        : null,
    },
    acknowledgments: {
      setup: {
        destinationSequence: result.sequence,
        sentSequence: ackSent ? result.sequence : null,
        sourceObservedSequence: observed ? result.sequence : 0n,
        pending: deposited && !ackSent,
        sent: ackSent,
      },
      final: {
        destinationSequence: final ? 1n : null,
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
}

/** The wallet query a story seeds, outside the DEV rehearsal flag. */
export const VOUCHER_STORY_WALLET_KEY = commitmentPoolingKeys.voucherWallet(
  VOUCHER_STORY_SCOPE.sourceChainId,
  VOUCHER_STORY_SCOPE.coreModule,
  VOUCHER_STORY_SCOPE.account,
  false
);

/** What the reader holds at each stage of a journey, and what bookings hold and owe back. */
export function bookingStoryWallet(
  snapshot: ServiceAccessSnapshot,
  holdings: { techAndSun: number; greenGoods: number }
): VoucherWalletSnapshot {
  const { greenGoods, techAndSun } = VOUCHER_STORY_ISSUERS;
  return {
    account: VOUCHER_STORY_SCOPE.account,
    evidence: "local-rehearsal",
    complete: true,
    reason: null,
    issuers: [techAndSun, greenGoods],
    holdings: [
      { issuer: techAndSun, available: vouchers(holdings.techAndSun) },
      { issuer: greenGoods, available: vouchers(holdings.greenGoods) },
    ],
    bookings: snapshot.voucherSetups
      .map(voucherBookingEscrow)
      .filter((escrow) => escrow.stage !== "closed"),
    returns: snapshot.voucherSetups.flatMap((setup) => voucherPendingReturn(setup) ?? []),
  };
}

/** The promise page's controller for a booking: the offer, its garden, and the reader's seat. */
export function bookingStoryController(
  service: BookingStoryService,
  coreState: CommitmentDerivedState
): GardenCommitmentController {
  const k = SERVICES[service];
  const taken = !["OFFERED"].includes(coreState);
  const commitment = commitmentFixture({
    id: `42161-${k.commitmentId}`,
    commitmentId: k.commitmentId,
    direction: "OFFER",
    creator: k.issuer.account,
    leadProvider: k.issuer.account,
    counterparty: taken ? buyer : null,
    counterpartyKind: taken ? "INDIVIDUAL" : null,
    unitLabel: k.unitLabel,
    targetUnits: k.serviceUnits,
    derivedState: coreState,
    onchainState: coreState === "READY_FOR_CONFIRMATION" ? "READY_FOR_CONFIRMATION" : coreState === "OFFERED" ? "OFFERED" : coreState === "FULFILLED" ? "FULFILLED" : coreState === "CANCELLED" ? "CANCELLED" : coreState === "DISPUTED" ? "DISPUTED" : "ACCEPTED",
    state: coreState === "OFFERED" ? "OFFERED" : "ACCEPTED",
    evidenceCount: coreState === "READY_FOR_CONFIRMATION" || coreState === "FULFILLED" ? 1 : 0,
    fulfilledBy: coreState === "FULFILLED" ? buyer : null,
    confirmationPath: coreState === "FULFILLED" ? "ORDINARY" : null,
    confirmers: [],
    dueDate: null,
  });
  return gardenCommitmentControllerFixture({
    chainId: VOUCHER_STORY_SCOPE.sourceChainId,
    routeGarden: k.issuer.garden,
    workGarden: k.issuer.garden,
    viewer: buyer,
    detail: commitmentDetailFixture({
      commitment,
      contributors: [
        contributorFixture({ commitmentId: k.commitmentId, contributor: k.issuer.account, isLead: true }),
      ],
    }),
    metadata: { version: 1, title: k.title, note: k.note },
    seat: taken ? "confirmer" : "bystander",
    actKind: coreState === "READY_FOR_CONFIRMATION" ? "confirm" : null,
    membership: { isMember: true, garden: null, unavailable: false, retry: () => undefined },
    confirmation: {
      phase: "ask",
      canNotYet: true,
      gardenAddress: k.issuer.garden,
      membershipNotRequired: true,
    },
  });
}

/** A request that rewards Tech and Sun vouchers, with optional G$, at each reward state. */
export type RewardStoryState =
  | "open"
  | "agreementUnavailable"
  | "inProgress"
  | "bothOnTheWay"
  | "vouchersIn"
  | "reserveShort"
  /** The voucher transfer failed with the reserve full enough: it waits on a retry. */
  | "voucherDelayed"
  | "gdDelayed"
  | "received";

export function rewardStorySnapshot(state: RewardStoryState, withGd: boolean): ServiceAccessSnapshot {
  const base = bookingStorySnapshot("hubDay", "open");
  const { techAndSun } = VOUCHER_STORY_ISSUERS;
  const commitmentId = withGd ? 4103n : 4104n;
  const due = !["open", "agreementUnavailable", "inProgress"].includes(state);
  const voucherState =
    !due || state === "bothOnTheWay"
      ? "pending"
      : state === "reserveShort" || state === "voucherDelayed"
        ? "failed"
        : "delivered";
  const gdState =
    !due || state === "bothOnTheWay" || state === "vouchersIn"
      ? "pending"
      : state === "gdDelayed"
        ? "failed"
        : "delivered";
  const item = (kind: "voucher" | "gd") => ({
    id: hash(`reward:${commitmentId}:${kind}`),
    asset:
      kind === "voucher"
        ? techAndSun.asset
        : {
            chainId: 42220,
            token: "0x000000000000000000000000000000000000fd01" as Address,
            symbol: "G$",
            decimals: 18,
          },
    amount: kind === "voucher" ? vouchers(2) : 120n * 10n ** 18n,
    recipient: buyer,
    funder: kind === "voucher" ? techAndSun.account : VOUCHER_STORY_HOME_GARDEN,
    paymentMethod: kind === "voucher" ? ("issuer-reserve-allowance" as const) : ("celo-gd" as const),
    state: kind === "voucher" ? voucherState : gdState,
    acknowledgment: "none" as const,
    attempts: (kind === "voucher" ? voucherState : gdState) === "pending" ? 0n : 1n,
    receipt:
      (kind === "voucher" ? voucherState : gdState) === "delivered"
        ? `local-rehearsal:reward:${commitmentId}:${kind}`
        : null,
  });
  const pilot = {
    evidence: "local-rehearsal",
    serviceCommitmentId: 1023n,
    service: { access: "full", units: 1n, durationMinutes: 60, voucherUnits: 1_000_000n, validUntil: 5000n },
    assets: { a: VOUCHER_STORY_ISSUERS.greenGoods.asset, b: techAndSun.asset },
    holdings: { a: 0n, b: voucherState === "delivered" ? vouchers(2) : 0n },
    reward: {
      workFulfilled: due,
      voucher: item("voucher"),
      gd: withGd ? item("gd") : null,
    },
    inventory: {
      asset: techAndSun.asset,
      reserve: state === "reserveShort" ? vouchers(1) : vouchers(12),
      allowance: vouchers(20),
      acceptedUndelivered: voucherState === "delivered" ? 0n : vouchers(2),
    },
    exchange: {
      pool: "0x000000000000000000000000000000000000fc01" as Address,
      inventory: vouchers(10),
      inputHolding: 0n,
      inputLimit: vouchers(20),
      listed: true,
      allowance: 0n,
      status: "none",
      failure: null,
      quote: null,
      receipt: null,
    },
  } as ServiceAccessPilot;
  return {
    ...base,
    key: { ...base.key, commitmentId },
    mode: "legacy",
    knownService: false,
    offer: null,
    consent: null,
    coreState: rewardStoryCoreState(state),
    pilot,
    acceptancePolicy: {
      ...base.acceptancePolicy,
      kind: "earned",
      earned: {
        ...base.acceptancePolicy.earned,
        status: state === "agreementUnavailable" ? "bound" : "unbound",
        // The reward terms' version the record carries (the design's sample says 2).
        revision: 2n,
      },
    },
    availableActions: [],
  };
}

export function rewardStoryCoreState(state: RewardStoryState): CommitmentDerivedState {
  if (state === "open" || state === "agreementUnavailable") return "REQUESTED";
  return state === "inProgress" ? "ACCEPTED" : "FULFILLED";
}

/** The request's garden as the page's garden record holds it: the name its rewards' copy says. */
const STORY_HOME_GARDEN_RECORD: Garden = {
  id: VOUCHER_STORY_HOME_GARDEN,
  chainId: VOUCHER_STORY_SCOPE.sourceChainId,
  tokenAddress: VOUCHER_STORY_HOME_GARDEN,
  tokenID: 1n,
  name: "Riverside Commons Garden",
  description: "",
  location: "",
  bannerImage: "",
  createdAt: 0,
  gardeners: [buyer],
  stewards: [],
  evaluators: [],
  owners: [],
  funders: [],
  communities: [],
  assessments: [],
  works: [],
};

/** The request's own promise: what Riverside Commons asks for, by when, and who confirms it. */
export function rewardStoryController(
  state: RewardStoryState,
  withGd: boolean
): GardenCommitmentController {
  const coreState = rewardStoryCoreState(state);
  const taken = coreState !== "REQUESTED";
  const commitmentId = withGd ? 4103n : 4104n;
  const commitment = commitmentFixture({
    id: `42161-${commitmentId}`,
    commitmentId,
    direction: "REQUEST",
    creator: VOUCHER_STORY_HOME_GARDEN,
    leadProvider: taken ? buyer : null,
    counterparty: taken ? buyer : null,
    counterpartyKind: taken ? "INDIVIDUAL" : null,
    unitLabel: withGd ? "workshops" : "map",
    targetUnits: withGd ? 2n : 1n,
    derivedState: coreState,
    onchainState: coreState === "REQUESTED" ? "OFFERED" : coreState === "FULFILLED" ? "FULFILLED" : "ACCEPTED",
    state: coreState === "REQUESTED" ? "OFFERED" : coreState === "FULFILLED" ? "FULFILLED" : "ACCEPTED",
    evidenceCount: coreState === "FULFILLED" ? 2 : 0,
    fulfilledBy: coreState === "FULFILLED" ? VOUCHER_STORY_HOME_GARDEN : null,
    confirmationPath: coreState === "FULFILLED" ? "ORDINARY" : null,
    confirmers: [],
    dueDate: BigInt(Date.UTC(2026, 11, 15) / 1000),
    // The optional G$ is the promise's own consideration, paid on Celo.
    ...(withGd
      ? {
          considerationRail: "CELO_SETTLEMENT" as const,
          considerationAmount: 120n * 10n ** 18n,
          considerationPaid: state === "received",
        }
      : {}),
  });
  const controller = gardenCommitmentControllerFixture({
    chainId: VOUCHER_STORY_SCOPE.sourceChainId,
    routeGarden: VOUCHER_STORY_HOME_GARDEN,
    workGarden: VOUCHER_STORY_HOME_GARDEN,
    viewer: buyer,
    detail: commitmentDetailFixture({
      commitment,
      contributors: taken
        ? [contributorFixture({ commitmentId, contributor: buyer, isLead: true })]
        : [],
    }),
    metadata: {
      version: 1,
      title: withGd ? "Teach two compost workshops" : "Map the garden's water lines",
      note: withGd
        ? "Run two hands-on compost workshops for neighbors at the garden, one in November and one in December."
        : "Walk the beds and draw where the water lines and taps run, so new gardeners can find them.",
    },
    seat: taken ? "provider" : "bystander",
    // The member could take the request up, so agreeing to its reward is theirs to do.
    actKind:
      state === "inProgress" ? "addProof" : state === "agreementUnavailable" ? "takeUp" : null,
    membership: { isMember: true, garden: null, unavailable: false, retry: () => undefined },
  });
  return { ...controller, roles: { ...controller.roles, garden: STORY_HOME_GARDEN_RECORD } };
}

/** Story names for the issuers' and garden's accounts, the way AddressDisplay shows them. */
export const VOUCHER_STORY_NAMES: Readonly<Record<string, string>> = {
  [VOUCHER_STORY_ISSUERS.techAndSun.account.toLowerCase()]: "Tech and Sun",
  [VOUCHER_STORY_ISSUERS.greenGoods.account.toLowerCase()]: "Green Goods",
  [VOUCHER_STORY_HOME_GARDEN.toLowerCase()]: "Riverside Commons Garden",
  [buyer.toLowerCase()]: "lina.greengoods.eth",
};
