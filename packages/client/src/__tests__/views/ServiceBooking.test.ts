import type { CommitmentDerivedState } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  type BookingStoryService,
  type BookingStoryStage,
  bookingStoryCoreState,
  bookingStorySnapshot,
  type RewardStoryState,
  rewardStoryCoreState,
  rewardStorySnapshot,
} from "../../../../shared/.storybook/voucherBookingFixtures";
import {
  VOUCHER_STORY_APPROVALS,
  VOUCHER_STORY_ISSUERS,
  vouchers,
} from "../../../../shared/.storybook/voucherPilotFixtures";
import { serviceBookingView } from "../../views/Home/Garden/Commitment/serviceBooking";
import { serviceRewardsView } from "../../views/Home/Garden/Commitment/serviceRewards";

const intl = createIntl({ locale: "en", messages: en as Record<string, string> });
const ISSUER = {
  hubDay: VOUCHER_STORY_ISSUERS.techAndSun,
  access: VOUCHER_STORY_ISSUERS.greenGoods,
} as const;
const APPROVAL = {
  hubDay: VOUCHER_STORY_APPROVALS.techAndSunBootstrap,
  access: VOUCHER_STORY_APPROVALS.greenGoods,
} as const;

function view(
  service: BookingStoryService,
  stage: BookingStoryStage,
  options: {
    coreState?: CommitmentDerivedState;
    approval?: (typeof VOUCHER_STORY_APPROVALS)[keyof typeof VOUCHER_STORY_APPROVALS];
    held?: bigint;
  } = {}
) {
  const snapshot = bookingStorySnapshot(service, stage);
  const result = serviceBookingView(
    {
      snapshot,
      coreState: options.coreState ?? bookingStoryCoreState(service, stage),
      issuer: ISSUER[service],
      approval: options.approval ?? APPROVAL[service],
      held: options.held ?? (stage === "notEnough" ? vouchers(2) : vouchers(10)),
    },
    intl
  );
  if (!result) throw new Error(`No booking view for ${service} ${stage}`);
  return result;
}

describe("voucher booking on the promise page", () => {
  it.each([
    ["hubDay", "open", "Open for booking.", "Review and Redeem", null],
    ["hubDay", "waitingApproval", "their Safe needs 1 signature", null, "Cancel Booking"],
    [
      "hubDay",
      "readyToDeposit",
      "Deposit your voucher into the escrow",
      "Deposit 1 Voucher",
      "Cancel Booking",
    ],
    ["hubDay", "confirmingDeposit", "Green Goods confirms the deposit", null, "Cancel Booking"],
    ["hubDay", "waitingAcceptance", "Tech and Sun accepts by", null, "Cancel Booking"],
    ["hubDay", "starting", "Starting fixes the terms", null, null],
    ["hubDay", "inProgress", "You're booked", null, "Report a Problem"],
    [
      "hubDay",
      "readyToClose",
      "Approve the final split, then confirm",
      "Close the Booking",
      "Report a Problem",
    ],
    [
      "hubDay",
      "returnProposed",
      "says the hub day didn't happen",
      "Review the Split",
      "Report a Problem",
    ],
    ["hubDay", "transfersPending", "Your voucher goes to Tech and Sun's reserve", null, null],
    ["hubDay", "returnFailed", "Your voucher is still in escrow", "Retry Transfer", null],
    [
      "hubDay",
      "canceling",
      "Your vouchers come back once the cancellation reaches the escrow",
      null,
      null,
    ],
    ["hubDay", "canceled", "Your voucher is back in your account.", null, null],
    [
      "hubDay",
      "acceptedFirst",
      "acceptance arrived before your cancellation",
      null,
      "Report a Problem",
    ],
    [
      "hubDay",
      "termsChanged",
      "Cancel to get your voucher back",
      "Cancel and Get Vouchers Back",
      null,
    ],
    ["hubDay", "problemReported", "You reported a problem", null, null],
    ["access", "notEnough", "Open for booking.", null, null],
    [
      "access",
      "readyToDeposit",
      "Deposit 10 vouchers into the escrow",
      "Deposit 10 Vouchers",
      "Cancel Booking",
    ],
    ["access", "inProgress", "Your access is active", null, "Report a Problem"],
    [
      "access",
      "returnProposed",
      "stopped working after 12 of 30 days. Green Goods proposes 6 back to you and 4 to its reserve",
      "Review the Split",
      "Report a Problem",
    ],
    [
      "access",
      "transfersPending",
      "6 vouchers come back to you and 4 go to Green Goods' reserve",
      null,
      null,
    ],
    ["access", "returnFailed", "The 6 vouchers for you didn't arrive", "Retry Transfer", null],
  ] as const)("draws %s %s with one status message and its acts", (service, stage, sentence, primary, secondary) => {
    const booking = view(service, stage);
    expect(booking.stage).toBe(stage);
    expect(booking.band.sentence).toContain(sentence);
    expect(booking.primary?.label ?? null).toBe(primary);
    expect(booking.secondary?.label ?? null).toBe(secondary);
  });

  it("says Kept only after the member confirms, and Ended early only after the stewards close", () => {
    expect(view("hubDay", "transfersPending").band.sentence).not.toMatch(/kept/i);
    expect(view("hubDay", "closed", { coreState: "FULFILLED" }).band).toMatchObject({
      tone: "kept",
      pillId: null,
      sentence:
        "You confirmed the hub day was kept, and your voucher went to Tech and Sun's reserve.",
    });
    const settled = view("access", "closed", { coreState: "ACCEPTED" }).band;
    expect(settled).toMatchObject({ sentence: "Settled", pillId: null });
    const early = view("access", "closed", { coreState: "CANCELLED" }).band;
    expect(early.pillId).toBe("app.voucher.pp.st.endedEarly");
    expect(early.sentence).toContain("closed the promise as ended early");
    expect(early.sentence).not.toMatch(/\bkept\b/i);
  });

  it("reads the Safe's signature count from the Safe and never states one it could not read", () => {
    expect(
      view("hubDay", "waitingApproval", { approval: VOUCHER_STORY_APPROVALS.techAndSunTwoOfThree })
        .band.sentence
    ).toContain("their Safe needs 2 of 3 signatures");
    const unread = view("hubDay", "waitingApproval", {
      approval: VOUCHER_STORY_APPROVALS.unavailable,
    }).band.sentence;
    expect(unread).toBe("Next: Tech and Sun approves your booking");
    expect(unread).not.toMatch(/signature/);
  });

  it("keeps a return pending until its transfer arrives, and a failed one for the same amount", () => {
    const pending = view("access", "transfersPending");
    expect(pending.transfers.map((t) => [t.label, t.stateLabel])).toEqual([
      ["6 back to you", "Pending"],
      ["4 to Green Goods' reserve", "Pending"],
    ]);
    expect(pending.facts[0]?.value).toBe("6 Green Goods vouchers on their way back to you");
    const failed = view("access", "returnFailed");
    expect(failed.transfers[0]).toMatchObject({
      stateLabel: "Didn't go through",
      detail: "Anyone can retry this transfer. It can only send the same 6 to you.",
    });
    expect(failed.split).toBeNull();
    expect(view("access", "returnProposed").split).toEqual({
      delivered: 12n,
      release: vouchers(4),
      refund: vouchers(6),
    });
  });

  it("gives a reader with too few vouchers one sentence and one door, not a dead act", () => {
    const short = view("access", "notEnough", { held: vouchers(2) });
    expect(short.primary).toBeNull();
    expect(short.door).toEqual({
      title: "You hold 2 Green Goods vouchers.",
      body: "Claude access takes 10. You can exchange other vouchers in the shared pool, or earn more.",
      act: { kind: "exchange", label: "Exchange Vouchers" },
    });
    expect(short.facts.find((fact) => fact.id === "give")).toMatchObject({
      value: "10 Green Goods vouchers",
      detail: "You hold 2.",
    });
  });
});

describe("a request's rewards", () => {
  it.each([
    ["inProgress", true, ["After the work", "After the work"], "Do the work and add it"],
    ["bothOnTheWay", true, ["On the way", "On the way"], "Both rewards are on their way"],
    [
      "vouchersIn",
      true,
      ["Received", "On the way"],
      "2 Tech and Sun vouchers arrived. The G$ is still on its way.",
    ],
    ["gdDelayed", true, ["Received", "Delayed"], "The payout didn't go through"],
    [
      "received",
      true,
      ["Received", "Received"],
      "2 Tech and Sun vouchers and 120 G$ are in your account.",
    ],
    ["reserveShort", false, ["Waiting"], "Tech and Sun's reserve is short right now"],
  ] as const)("keeps each reward apart while %s", (state, withGd, pills, sentence) => {
    const rewards = serviceRewardsView(
      {
        snapshot: rewardStorySnapshot(state as RewardStoryState, withGd),
        coreState: rewardStoryCoreState(state as RewardStoryState),
        issuer: VOUCHER_STORY_ISSUERS.techAndSun,
        garden: "Riverside Commons Garden",
      },
      intl
    )!;
    expect(rewards.rows.map((row) => row.status.label)).toEqual(pills);
    expect(rewards.band.sentence).toContain(sentence);
    expect(rewards.rows[0]?.title).toBe("2 Tech and Sun vouchers");
  });
});
