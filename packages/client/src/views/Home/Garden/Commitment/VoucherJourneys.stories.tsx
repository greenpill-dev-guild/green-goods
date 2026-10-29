import { claimFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import {
  type CommitmentDerivedState,
  type CommitmentEventRecord,
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  selectServiceAccessAction,
  serviceAccessAvailableActions,
  useServiceAccess,
  useServiceAccessMutation,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGardenCommitmentController } from "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController";
import {
  useCommitmentActivity,
  useCommitmentCycle,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import {
  type BookingStoryService,
  type BookingStoryStage,
  bookingStoryController,
  bookingStoryCoreState,
  bookingStorySnapshot,
  bookingStoryWallet,
  type ExchangeStoryState,
  type RewardStoryState,
  rewardStoryController,
  rewardStorySnapshot,
  VOUCHER_STORY_AGREED_AT,
  VOUCHER_STORY_NAMES,
  VOUCHER_STORY_WALLET_KEY,
} from "../../../../../../shared/.storybook/voucherBookingFixtures";
import {
  VOUCHER_STORY_ISSUERS,
  VOUCHER_STORY_SCOPE,
  voucherStorySeeds,
  vouchers,
  voucherWalletStory,
} from "../../../../../../shared/.storybook/voucherPilotFixtures";
import { GardenCommitment } from "./GardenCommitment";

type Lang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/** One step of a journey: the page's state, and who moves it on from here. */
interface JourneyStep {
  /** The narration band's line, as the lab's journeys tell it (story text, English only). */
  caption: string;
  booking?: {
    service: BookingStoryService;
    stage: BookingStoryStage;
    confirmed?: boolean;
    exchange?: ExchangeStoryState;
    /** A booking that stopped partway, or a read the page can't use yet. */
    options?: Omit<
      NonNullable<Parameters<typeof bookingStorySnapshot>[2]>,
      "confirmed" | "exchange"
    >;
    /** The promise's own state where it isn't the stage's usual one. */
    core?: CommitmentDerivedState;
    tweak?: (snapshot: ServiceAccessSnapshot) => ServiceAccessSnapshot;
    /** The service read failed, so the page has no snapshot. */
    readFailed?: boolean;
  };
  reward?: { state: RewardStoryState; withGd: boolean };
  /** The pool garden's steward decides the member's already-submitted reward claim. */
  stewardReview?: boolean;
  /** The promise's own History, newest first. */
  events?: CommitmentEventRecord[];
  /** What the reader holds now, in whole vouchers. */
  holds: { techAndSun: number; greenGoods: number };
  /** The other person's act that moves the journey on, as the band's button. */
  next?: string;
  /** Where the reader's own acts on the page lead. */
  acts?: Partial<Record<ServiceAccessAction["action"] | "confirm", number>>;
}

const HUB_DAY: JourneyStep[] = [
  {
    caption: "Lina holds 9 Tech and Sun vouchers. A hub day takes 1.",
    booking: { service: "hubDay", stage: "open" },
    holds: { techAndSun: 9, greenGoods: 0 },
    acts: { requestClaim: 1 },
  },
  {
    caption: "She agreed to the exact terms. Tech and Sun's Safe approves next.",
    booking: { service: "hubDay", stage: "waitingApproval" },
    holds: { techAndSun: 9, greenGoods: 0 },
    next: "Tech and Sun approves",
    acts: { abortVoucherSetup: 11 },
  },
  {
    caption: "Tech and Sun approved. Lina deposits her voucher into this booking's escrow.",
    booking: { service: "hubDay", stage: "readyToDeposit" },
    holds: { techAndSun: 9, greenGoods: 0 },
    acts: { approveVoucherAllowance: 3, presentVoucherSetup: 3, abortVoucherSetup: 11 },
  },
  {
    caption: "The voucher is in escrow. Green Goods confirms the deposit.",
    booking: { service: "hubDay", stage: "confirmingDeposit" },
    holds: { techAndSun: 8, greenGoods: 0 },
    next: "Green Goods confirms the deposit",
    acts: { abortVoucherSetup: 11 },
  },
  {
    caption: "Tech and Sun accepts by 2 November, or Lina can still cancel.",
    booking: { service: "hubDay", stage: "waitingAcceptance" },
    holds: { techAndSun: 8, greenGoods: 0 },
    next: "Tech and Sun accepts",
    acts: { abortVoucherSetup: 11 },
  },
  {
    caption: "Accepted. Lina starts the booking on the voucher network; that fixes the terms.",
    booking: { service: "hubDay", stage: "starting" },
    holds: { techAndSun: 8, greenGoods: 0 },
    acts: { dispatchVoucherSetupCommand: 6 },
  },
  {
    caption: "Lina is booked. After her visit, Tech and Sun reports it.",
    booking: { service: "hubDay", stage: "inProgress" },
    holds: { techAndSun: 8, greenGoods: 0 },
    next: "Tech and Sun reports the hub day",
  },
  {
    caption: "Tech and Sun reported the visit. Lina approves the final split.",
    booking: { service: "hubDay", stage: "readyToClose" },
    holds: { techAndSun: 8, greenGoods: 0 },
    acts: { finalizeVoucherAllocation: 8 },
  },
  {
    caption:
      "The split is fixed and its transfer is on its way. Lina confirms the promise was kept.",
    booking: { service: "hubDay", stage: "transfersPending" },
    holds: { techAndSun: 8, greenGoods: 0 },
    acts: { executeVoucherFinalLeg: 8, confirm: 9 },
  },
  {
    caption:
      "Kept, after Lina confirmed it. The voucher is still on its way to Tech and Sun's reserve.",
    booking: { service: "hubDay", stage: "transfersPending", confirmed: true },
    holds: { techAndSun: 8, greenGoods: 0 },
    next: "The transfer arrives",
  },
  {
    caption: "Kept, and the voucher arrived in Tech and Sun's reserve.",
    booking: { service: "hubDay", stage: "closed" },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption:
      "Lina canceled before Tech and Sun accepted. Her voucher comes back once the cancellation reaches the escrow.",
    booking: { service: "hubDay", stage: "canceling" },
    holds: { techAndSun: 8, greenGoods: 0 },
    next: "The cancellation reaches the escrow",
    acts: { dispatchVoucherSetupCommand: 12 },
  },
  {
    caption: "Canceled. Her voucher is back in her account.",
    booking: { service: "hubDay", stage: "canceled" },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
];

const EXCHANGE_THEN_REDEEM: JourneyStep[] = [
  {
    caption: "Claude access takes 10 Green Goods vouchers. Lina holds 2, and 9 of Tech and Sun's.",
    booking: { service: "access", stage: "notEnough", exchange: "none" },
    holds: { techAndSun: 9, greenGoods: 2 },
    acts: { quotePilotExchange: 1 },
  },
  {
    caption:
      "The shared pool quotes 8 Green Goods vouchers for 8.01 of Tech and Sun's, fees included.",
    booking: { service: "access", stage: "notEnough", exchange: "quoted" },
    holds: { techAndSun: 9, greenGoods: 2 },
    acts: { approvePilotExchange: 2, executePilotExchange: 2 },
  },
  {
    caption: "Sent. Until the result is known, no other paid exchange can start.",
    booking: { service: "access", stage: "open", exchange: "unknown" },
    holds: { techAndSun: 0.99, greenGoods: 10 },
    acts: { resolvePilotExchange: 3 },
  },
  {
    caption: "Exchanged. The swap booked nothing: Lina now redeems her 10 Green Goods vouchers.",
    booking: { service: "access", stage: "open", exchange: "confirmed" },
    holds: { techAndSun: 0.99, greenGoods: 10 },
    acts: { requestClaim: 4 },
  },
  {
    caption:
      "She agreed to the exact terms. Green Goods' Safe approves next; it takes 2 of 5 signatures.",
    booking: { service: "access", stage: "waitingApproval" },
    holds: { techAndSun: 0.99, greenGoods: 10 },
    next: "Green Goods approves",
  },
  {
    caption: "Approved. Lina deposits the 10 vouchers; her passkey may ask twice.",
    booking: { service: "access", stage: "readyToDeposit" },
    holds: { techAndSun: 0.99, greenGoods: 10 },
    acts: { approveVoucherAllowance: 6, presentVoucherSetup: 6 },
  },
  {
    caption: "In escrow. Green Goods confirms the deposit, then accepts.",
    booking: { service: "access", stage: "waitingAcceptance" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
    next: "Green Goods accepts",
  },
  {
    caption: "Accepted and started. Her 30 days run from the day she can sign in.",
    booking: { service: "access", stage: "inProgress" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
  },
];

const ENDS_EARLY: JourneyStep[] = [
  {
    caption: "Lina's Claude seat is active, but it stops working after 12 of 30 days.",
    booking: { service: "access", stage: "inProgress" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
    next: "Green Goods proposes a return",
  },
  {
    caption: "Green Goods proposes 6 back by days of access. Nothing moves until Lina approves.",
    booking: { service: "access", stage: "returnProposed" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
    acts: { finalizeVoucherAllocation: 2 },
  },
  {
    caption: "The split is fixed. Each transfer runs on its own.",
    booking: { service: "access", stage: "transfersPending" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
    acts: { executeVoucherFinalLeg: 3 },
  },
  {
    caption:
      "The 4 for Green Goods arrived; the 6 back to Lina didn't go through. Anyone can retry it.",
    booking: { service: "access", stage: "returnFailed" },
    holds: { techAndSun: 0.99, greenGoods: 0 },
    acts: { executeVoucherFinalLeg: 4 },
  },
  {
    caption: "Both transfers arrived: 6 back with Lina, 4 to Green Goods' reserve.",
    booking: { service: "access", stage: "closed" },
    holds: { techAndSun: 0.99, greenGoods: 6 },
    next: "The stewards close it as ended early",
  },
  {
    caption: "The garden's stewards closed the promise as ended early, never kept.",
    booking: { service: "access", stage: "closed" },
    holds: { techAndSun: 0.99, greenGoods: 6 },
  },
];

const EARN_WITH_GD: JourneyStep[] = [
  {
    caption:
      "Riverside Commons asks for two compost workshops, for 2 Tech and Sun vouchers and 120 G$.",
    reward: { state: "agreementUnavailable", withGd: true },
    holds: { techAndSun: 7, greenGoods: 0 },
    next: "Green Goods records Lina's agreement",
  },
  {
    caption: "Lina took it up. She does the work and adds it.",
    reward: { state: "inProgress", withGd: true },
    holds: { techAndSun: 7, greenGoods: 0 },
    next: "The stewards confirm her work",
  },
  {
    caption: "Her work is confirmed. Each reward is on its way on its own.",
    reward: { state: "bothOnTheWay", withGd: true },
    holds: { techAndSun: 7, greenGoods: 0 },
    next: "The vouchers arrive",
  },
  {
    caption: "The vouchers arrived; the G$ is still on its way.",
    reward: { state: "vouchersIn", withGd: true },
    holds: { techAndSun: 9, greenGoods: 0 },
    next: "The G$ payout fails",
  },
  {
    caption: "The G$ payout didn't go through and is being retried. The vouchers are unaffected.",
    reward: { state: "gdDelayed", withGd: true },
    holds: { techAndSun: 9, greenGoods: 0 },
    next: "The retried payout arrives",
  },
  {
    caption: "Both rewards arrived, each with its own receipt.",
    reward: { state: "received", withGd: true },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
];

const EARN_VOUCHERS_ONLY: JourneyStep[] = [
  {
    caption: "A vouchers-only request: map the garden's water lines for 2 Tech and Sun vouchers.",
    reward: { state: "inProgress", withGd: false },
    holds: { techAndSun: 7, greenGoods: 0 },
    next: "The stewards confirm the work",
  },
  {
    caption: "Tech and Sun's reserve is short, so the reward waits. It is unchanged, not lost.",
    reward: { state: "reserveShort", withGd: false },
    holds: { techAndSun: 7, greenGoods: 0 },
    next: "Tech and Sun tops up its reserve",
  },
  {
    caption: "Delivered once, after the repair.",
    reward: { state: "received", withGd: false },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
];

/** One of the hub day's events on the promise itself, minutes after Lina agreed. */
function hubDayEvent(eventType: string, minutes: number, byIssuer: boolean): CommitmentEventRecord {
  return {
    id: `story-hub-day-${eventType}`,
    chainId: VOUCHER_STORY_SCOPE.sourceChainId,
    poolId: null,
    cycleId: null,
    commitmentId: 4101n,
    eventType,
    actor: byIssuer ? VOUCHER_STORY_ISSUERS.techAndSun.account : VOUCHER_STORY_SCOPE.account,
    configurationKey: null,
    previousValue: null,
    newValue: null,
    units: null,
    data: null,
    txHash: `0x${minutes.toString(16).padStart(64, "0")}`,
    timestamp: Number(VOUCHER_STORY_AGREED_AT) + minutes * 60,
  };
}

/** A booking's setup with its destination changed, for the states a fixture stage doesn't draw. */
const withDestination =
  (change: Partial<NonNullable<ServiceAccessSnapshot["voucherSetups"][number]["destination"]>>) =>
  (snapshot: ServiceAccessSnapshot): ServiceAccessSnapshot => ({
    ...snapshot,
    voucherSetups: snapshot.voucherSetups.map((row) => ({
      ...row,
      destination: row.destination && { ...row.destination, ...change },
    })),
  });

/** The states a booking or a reward reaches when an act stops partway or a read can't be used. */
const RECOVERY: JourneyStep[] = [
  {
    caption:
      "The offer moved to version 3 and to Green Goods vouchers after Lina deposited: her booking keeps version 2 and Tech and Sun.",
    booking: {
      service: "hubDay",
      stage: "termsChanged",
      tweak: (snapshot) => ({
        ...snapshot,
        offer: snapshot.offer && {
          ...snapshot.offer,
          voucher: {
            asset: VOUCHER_STORY_ISSUERS.greenGoods.asset,
            issuer: VOUCHER_STORY_ISSUERS.greenGoods.account,
            units: vouchers(1),
          },
        },
      }),
    },
    holds: { techAndSun: 8, greenGoods: 2 },
  },
  {
    caption:
      "Lina approved the split, then declined the transfer's prompt. Close the Booking sends it.",
    booking: { service: "hubDay", stage: "transfersPending", options: { legsSent: false } },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption:
      "Lina confirmed while her voucher was still on its way: History shows the confirmation last, above the split.",
    booking: { service: "hubDay", stage: "transfersPending", confirmed: true },
    holds: { techAndSun: 8, greenGoods: 0 },
    events: [
      hubDayEvent("CONFIRMATION_RECORDED", 4 * 60, false),
      hubDayEvent("READY_FOR_CONFIRMATION", 3 * 60, true),
      hubDayEvent("ACCEPTED", 60, true),
      hubDayEvent("CLAIM_REQUESTED", 0, false),
      hubDayEvent("CREATED", -60, true),
    ],
  },
  {
    caption:
      "The transfer arrived before Lina confirmed. The promise still needs her, and Promise kept? says the transfer arrived.",
    booking: { service: "hubDay", stage: "closed", core: "READY_FOR_CONFIRMATION" },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption:
      "Lina canceled, then declined sending it. Cancel Booking sends the recorded cancellation.",
    booking: { service: "hubDay", stage: "canceling", options: { cancelSent: false } },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption:
      "The deposit's confirmation didn't reach the source. Retry Confirmation sends it again.",
    booking: { service: "hubDay", stage: "confirmingDeposit", options: { ackStuck: true } },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption: "The escrow took the deposit but couldn't finish it. Deposit runs its stored retry.",
    booking: { service: "hubDay", stage: "readyToDeposit", options: { depositRetry: true } },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
  {
    caption: "The escrow is paused. Deposit's sheet says so and can't send.",
    booking: {
      service: "hubDay",
      stage: "readyToDeposit",
      options: { pause: { destinationVoucher: true } },
    },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
  {
    caption: "Lina holds no Tech and Sun vouchers, and no pool can quote here: no Exchange act.",
    booking: { service: "hubDay", stage: "readyToDeposit", options: { held: 0n } },
    holds: { techAndSun: 0, greenGoods: 0 },
  },
  {
    caption: "A hub day cut short: half the voucher back, and the hub day counted as delivered.",
    booking: {
      service: "hubDay",
      stage: "returnProposed",
      tweak: withDestination({ issuerReturnCeiling: vouchers(0.5) }),
    },
    holds: { techAndSun: 8, greenGoods: 0 },
  },
  {
    caption: "A service in general words: 12 of the 30 sessions it authorized were delivered.",
    booking: {
      service: "access",
      stage: "returnProposed",
      tweak: (snapshot) => ({
        ...snapshot,
        offer: snapshot.offer && { ...snapshot.offer, unitLabel: "sessions" },
      }),
    },
    holds: { techAndSun: 0.99, greenGoods: 0 },
  },
  {
    caption: "The shared pool has only 5 to give. Try a Smaller Amount asks for that.",
    booking: { service: "access", stage: "notEnough", exchange: "short" },
    holds: { techAndSun: 9, greenGoods: 2 },
  },
  {
    caption:
      "The exchange's transfer didn't go through: nothing moved, and the quote didn't expire.",
    booking: { service: "access", stage: "notEnough", exchange: "failed" },
    holds: { techAndSun: 9, greenGoods: 2 },
  },
  {
    caption: "A vouchers-only reward on its way.",
    reward: { state: "bothOnTheWay", withGd: false },
    holds: { techAndSun: 7, greenGoods: 0 },
  },
  {
    caption: "The voucher transfer failed with the reserve full enough: it waits for a retry.",
    reward: { state: "voucherDelayed", withGd: false },
    holds: { techAndSun: 7, greenGoods: 0 },
  },
  {
    caption: "Agreeing isn't available in the app yet: Ask for Help opens the app's Help.",
    reward: { state: "agreementUnavailable", withGd: true },
    holds: { techAndSun: 7, greenGoods: 0 },
  },
  {
    caption: "The service read failed: taking this up waits, and Try Again reads it again.",
    booking: { service: "hubDay", stage: "open", readFailed: true },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
];

/** An agreed reward never replaces the service booking's own review and consent. */
const AGREED_REWARD_BOOKING: JourneyStep[] = [
  {
    caption: "Lina already agreed to this promise's reward. She reviews the service booking next.",
    booking: {
      service: "hubDay",
      stage: "open",
      core: "OFFERED",
      tweak: (snapshot) => {
        const issuer = VOUCHER_STORY_ISSUERS.techAndSun;
        const termsHash = `0x${"c".repeat(64)}` as const;
        snapshot.evidence = "onchain";
        snapshot.pause.core = false;
        snapshot.capabilities = {
          ...snapshot.capabilities,
          mutation: "onchain",
          reasons: [],
          sourceBuyer: snapshot.key.buyer,
          canSignSource: true,
        };
        snapshot.availableActions = ["requestClaim"];
        snapshot.acceptancePolicy.earned = {
          ...snapshot.acceptancePolicy.earned,
          status: "bound",
          module: issuer.account,
          revision: 2n,
          termsHash,
          creator: issuer.account,
          claimType: "individual",
          viewerConsentRevision: 2n,
          modulePaused: false,
          terms: {
            issuer: issuer.account,
            issuerAuthority: issuer.account,
            asset: issuer.asset,
            totalUnits: vouchers(1),
            allocationPolicy: termsHash,
            serviceTermsRef: termsHash,
            season: 3n,
            issuerApproved: true,
            frozen: true,
          },
        };
        return snapshot;
      },
    },
    holds: { techAndSun: 9, greenGoods: 0 },
  },
];

const INELIGIBLE_REWARD_BOOKING: JourneyStep[] = AGREED_REWARD_BOOKING.map((step) => ({
  ...step,
  caption: "Lina has no eligible buyer garden. Agreeing to a reward cannot yet lead to a booking.",
  booking: {
    ...step.booking!,
    tweak: (snapshot) => {
      const reward = step.booking!.tweak!(snapshot);
      reward.eligibleBuyerGardens = [];
      reward.acceptancePolicy.earned.viewerConsentRevision = 0n;
      reward.availableActions = serviceAccessAvailableActions(reward);
      return reward;
    },
  },
}));

const EARNED_CLAIM_REVIEW: JourneyStep[] = [
  {
    caption: "A member asked to take up this rewarded request. Its garden's steward decides.",
    reward: { state: "agreementUnavailable", withGd: true },
    stewardReview: true,
    holds: { techAndSun: 0, greenGoods: 0 },
  },
];

const JOURNEYS = {
  hubDay: HUB_DAY,
  exchange: EXCHANGE_THEN_REDEEM,
  endsEarly: ENDS_EARLY,
  earn: EARN_WITH_GD,
  earnVouchersOnly: EARN_VOUCHERS_ONLY,
  recovery: RECOVERY,
  agreedRewardBooking: AGREED_REWARD_BOOKING,
  ineligibleRewardBooking: INELIGIBLE_REWARD_BOOKING,
  earnedClaimReview: EARNED_CLAIM_REVIEW,
} as const;
type JourneyId = keyof typeof JOURNEYS;

function snapshotFor(step: JourneyStep): ServiceAccessSnapshot {
  if (step.reward) return rewardStorySnapshot(step.reward.state, step.reward.withGd);
  const { service, stage, confirmed, exchange, options, tweak } = step.booking!;
  const snapshot = bookingStorySnapshot(service, stage, { ...options, confirmed, exchange });
  return tweak ? tweak(snapshot) : snapshot;
}

function controllerFor(step: JourneyStep, onConfirm: () => void) {
  if (step.reward) {
    const controller = rewardStoryController(step.reward.state, step.reward.withGd);
    if (step.stewardReview && controller.detail) {
      controller.detail.commitment.claimMode = "APPROVAL_GATED";
      controller.actKind = null;
      controller.roles.stewardsPoolGarden = true;
      controller.pendingClaimRequests = [
        claimFixture({
          commitmentId: controller.detail.commitment.commitmentId,
          state: "PENDING",
        }),
      ];
    }
    return controller;
  }
  const { service, stage, confirmed } = step.booking!;
  const ended = stage === "closed" && service === "access" && step.next === undefined;
  const core =
    step.booking!.core ??
    (ended
      ? "CANCELLED"
      : stage === "closed" && service === "access"
        ? "ACCEPTED"
        : bookingStoryCoreState(service, stage, confirmed));
  const controller = bookingStoryController(service, core);
  return {
    ...controller,
    confirmation: {
      ...controller.confirmation,
      phase: confirmed ? ("confirmed" as const) : ("ask" as const),
    },
    acts: {
      ...controller.acts,
      confirm: async () => {
        onConfirm();
        return "story-confirm-job";
      },
    },
  };
}

/** Where See Your Vouchers leads: Home, with the wallet open on its Vouchers tab. */
function WalletDestination() {
  const { search } = useLocation();
  return (
    <p className="p-4 text-sm" data-component="VoucherJourneyDestination">
      Home opens with the wallet on its Vouchers tab ({`/home${search}`}).
    </p>
  );
}

/**
 * The page as the reader sees it, driven by the journey: the reader's own acts on the page
 * move it on through the real sheets and the shared selectors, and the band's button plays the
 * other person's step. Nothing here signs, reads a chain or reaches a service.
 */
function VoucherJourney({
  journey,
  start,
  lang,
}: {
  journey: JourneyId;
  start: number;
  lang: Lang;
}) {
  const steps = JOURNEYS[journey];
  const [index, setIndex] = useState(Math.min(start, steps.length - 1));
  const step = steps[index]!;
  const snapshot = useMemo(() => snapshotFor(step), [step]);
  const client = useQueryClient();
  const { account } = VOUCHER_STORY_SCOPE;
  const walletKey = VOUCHER_STORY_WALLET_KEY;
  // The wallet follows the journey: what the reader holds, what the booking holds and owes back.
  useLayoutEffect(() => {
    client.setQueryData(walletKey, bookingStoryWallet(snapshot, step.holds));
  }, [client, walletKey, snapshot, step.holds]);
  const go = (target: number | undefined) => {
    if (target !== undefined) setIndex(target);
  };
  const mutateAsync = async (action: ServiceAccessAction) => {
    const allowed =
      action.action.endsWith("PilotExchange") ||
      selectServiceAccessAction(snapshot, action).allowed;
    if (!allowed)
      throw new Error(`The page sent an action the selectors do not offer: ${action.action}`);
    const target = step.acts?.[action.action];
    if (target === undefined)
      return { kind: "local-rehearsal" as const, observationId: "story", snapshot };
    setIndex(target);
    return {
      kind: "local-rehearsal" as const,
      observationId: `story:${journey}:${target}`,
      snapshot: snapshotFor(steps[target]!),
    };
  };
  const readFailed = step.booking?.readFailed === true;
  mocked(useServiceAccess).mockReturnValue({
    data: readFailed ? undefined : snapshot,
    isLoading: false,
    isError: readFailed,
    status: readFailed ? "error" : "success",
    fetchStatus: "idle",
    error: readFailed ? new Error("Service read failed") : null,
    refetch: fn(),
  } as unknown as ReturnType<typeof useServiceAccess>);
  mocked(useServiceAccessMutation).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useServiceAccessMutation>);
  mocked(useGardenCommitmentController).mockReturnValue(
    controllerFor(step, () => go(step.acts?.confirm))
  );
  mocked(usePrimaryAddress).mockReturnValue(account);
  mocked(useCommitmentActivity).mockReturnValue({
    events: step.events ?? [],
    isError: false,
  } as unknown as ReturnType<typeof useCommitmentActivity>);
  mocked(useCommitmentCycle).mockReturnValue({
    cycle: null,
  } as unknown as ReturnType<typeof useCommitmentCycle>);
  mocked(useGardens).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useGardens>);
  mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
  mocked(useGreenGoodsEnsName).mockImplementation(
    (address) =>
      ({
        data: address ? (VOUCHER_STORY_NAMES[address.toLowerCase()] ?? null) : null,
      }) as ReturnType<typeof useGreenGoodsEnsName>
  );
  mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
  useEffect(() => {
    setIndex(Math.min(start, steps.length - 1));
  }, [start, steps.length]);
  const garden = snapshot.offer?.providerGarden ?? snapshot.eligibleBuyerGardens[0]?.address;
  return (
    <div className="flex min-h-dvh flex-col bg-bg-white-0 text-text-strong-950">
      <div
        className="sticky top-0 z-50 border-b border-stroke-soft-200 bg-bg-weak-50 p-3 text-xs"
        data-component="VoucherJourneyNarration"
      >
        <p className="font-semibold text-text-sub-600">
          Step {index + 1} of {steps.length}
        </p>
        <p className="mt-0.5 text-sm text-text-strong-950">{step.caption}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="compact"
            emphasis="secondary"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Back
          </Button>
          {step.next ? (
            <Button type="button" size="compact" onClick={() => setIndex(index + 1)}>
              {step.next}
            </Button>
          ) : null}
        </div>
      </div>
      <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
        <MemoryRouter
          key={`${journey}:${snapshot.key.commitmentId}`}
          initialEntries={[`/home/${garden}/commitments/${snapshot.key.commitmentId.toString()}`]}
        >
          <Routes>
            <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
            <Route path="/home" element={<WalletDestination />} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    </div>
  );
}

/**
 * The voucher pilot's slice-1 journeys on the real promise page, with fictional accounts: earn
 * vouchers (with optional G$), redeem a voucher you hold, exchange then redeem, and Claude access
 * that ends early. The reader's acts run through the page's sheets; the band plays everyone else.
 */
const meta: Meta<typeof VoucherJourney> = {
  title: "Client/Commitments/Voucher Journeys",
  component: VoucherJourney,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withSeededQueryClient(voucherStorySeeds(voucherWalletStory("empty")))],
  // The journey sets these hooks while it renders; give every later story the real ones back.
  beforeEach: () =>
    resetHookMocks(
      useServiceAccess,
      useServiceAccessMutation,
      useGardenCommitmentController,
      usePrimaryAddress,
      useCommitmentActivity,
      useCommitmentCycle,
      useGardens,
      useActions,
      useGreenGoodsEnsName,
      useEnsName
    ),
  argTypes: {
    journey: { control: false },
    start: { control: { type: "number", min: 0 } },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { start: 0, lang: "en" },
};
export default meta;
type Story = StoryObj<typeof VoucherJourney>;

/** Journey 1: a request that pays Tech and Sun vouchers and G$, each arriving on its own. */
export const EarnVouchers: Story = { args: { journey: "earn" } };

/** Journey 1, vouchers only: a short reserve leaves the reward waiting, never lost. */
export const EarnVouchersOnly: Story = { args: { journey: "earnVouchersOnly" } };

/** Journey 2: a Tech and Sun hub day for one voucher, from agreeing to kept. */
export const RedeemHubDay: Story = { args: { journey: "hubDay" } };

/** Journey 3: too few Green Goods vouchers, an exchange in the shared pool, then the booking. */
export const ExchangeThenRedeem: Story = { args: { journey: "exchange" } };

/** Journey 4: Claude access stops after 12 of 30 days and ends early, never kept. */
export const ClaudeAccessEndsEarly: Story = { args: { journey: "endsEarly" } };

/** When an act stops partway or a read can't be used: each state and the page's way on. */
export const RecoveryStates: Story = { args: { journey: "recovery" } };

/** Fictional reviewed reward, with the real booking page and its own consent sheet. */
export const AgreedRewardKeepsBooking: Story = {
  tags: ["storybook-ci"],
  args: { journey: "agreedRewardBooking" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.queryByRole("button", { name: "Take It Up" })).not.toBeInTheDocument();
    await userEvent.click(await canvas.findByRole("button", { name: "Review and Redeem" }));
    await expect(await page.findByRole("dialog", { name: "Review and Redeem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agree to These Terms" })).toBeVisible();
  },
};

/** No paid reward agreement is offered without a buyer garden eligible for the booking. */
export const RewardWaitsForBuyerEligibility: Story = {
  tags: ["storybook-ci"],
  args: { journey: "ineligibleRewardBooking" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("region", { name: "Rewards" })).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Agree to the Rewards" })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Agree and Take It Up" })
    ).not.toBeInTheDocument();
  },
};

/** Reward consent never hides the steward's decision on a submitted approval-gated claim. */
export const EarnedClaimStewardDecisions: Story = {
  tags: ["storybook-ci"],
  args: { journey: "earnedClaimReview" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const decisions = within(await canvas.findByRole("region", { name: "Waiting on you" }));
    await expect(decisions.getByRole("button", { name: /^Accept$/ })).toBeVisible();
    await expect(decisions.getByRole("button", { name: /^Decline$/ })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Ask again$/ })).toBeNull();
    await expect(canvas.queryByRole("button", { name: /^Take It Up$/ })).toBeNull();
  },
};

/** The hub day from the offer through the deposit, driven by the page's own acts. */
export const HubDayAgreeAndDeposit: Story = {
  tags: ["storybook-ci"],
  args: { journey: "hubDay" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Review and Redeem" }));
    await userEvent.click(await page.findByRole("button", { name: "Agree to These Terms" }));
    await expect(await page.findByText("Tech and Sun approves the booking next.")).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect(canvas.getByRole("region", { name: "Where this stands" })).toHaveTextContent(
      "their Safe needs 1 signature"
    );
    await userEvent.click(canvas.getByRole("button", { name: "Tech and Sun approves" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Deposit 1 Voucher" }));
    await userEvent.click(await page.findByRole("button", { name: "Deposit 1 Voucher" }));
    await expect(await page.findByText("Deposited.")).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "View Booking" }));
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: "Where this stands" })).toHaveTextContent(
        "Green Goods confirms the deposit"
      )
    );
  },
};
