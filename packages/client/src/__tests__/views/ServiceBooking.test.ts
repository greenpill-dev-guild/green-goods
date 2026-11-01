import {
  type CommitmentDerivedState,
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  serviceAccessAvailableActions,
  selectServiceAccessAction,
} from "@green-goods/shared/commitment-pooling";
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
import {
  activateStep,
  agreeStep,
  runServiceAct,
  serviceActOffered,
  type ServiceActStep,
} from "../../views/Home/Garden/Commitment/serviceActs";
import {
  bookingVoucherIssuer,
  ownServiceOfferView,
  serviceBookingView,
} from "../../views/Home/Garden/Commitment/serviceBooking";
import { exchangeStateFromPilot } from "../../views/Home/Garden/Commitment/serviceExchange";
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

describe("a voucher offer as the person who made it reads it", () => {
  const own = (
    change: Partial<Parameters<typeof ownServiceOfferView>[0]> = {},
    snapshot = bookingStorySnapshot("hubDay", "open")
  ) =>
    ownServiceOfferView(
      { snapshot, coreState: "OFFERED", issuer: ISSUER.hubDay, paused: false, ...change },
      intl
    );

  it("says what a booking takes, in the count's own words", () => {
    expect(own()?.takes).toBe("1 Tech and Sun voucher");
    const two = bookingStorySnapshot("hubDay", "open");
    two.offer!.voucher!.units = vouchers(2);
    expect(own({}, two)?.takes).toBe("2 Tech and Sun vouchers");
  });

  it("speaks only while nobody can book an open offer, leaving every other sentence to the promise", () => {
    expect(own()?.band).toBeNull();
    expect(own({ paused: true })?.band?.sentence).toContain("New bookings are paused");
    expect(own({ paused: true, coreState: "ACTIVE" })?.band).toBeNull();
  });

  it("has nothing to say about an offer with no voucher route", () => {
    const personal = bookingStorySnapshot("hubDay", "open");
    personal.offer!.route = "personal-gd";
    expect(own({}, personal)).toBeNull();
  });
});

describe("voucher booking on the promise page", () => {
  it.each([false, true])("separates an unsent request from its network wait (sent=%s)", (sent) => {
    const snapshot = bookingStorySnapshot("hubDay", "waitingApproval");
    const setup = snapshot.voucherSetups[0]!;
    setup.destination!.result.phase = "none";
    setup.source.authorizationDispatched = sent;
    setup.source.authorizationMessageId = sent ? setup.setupId : null;
    const result = serviceBookingView(
      {
        snapshot,
        coreState: "OFFERED",
        issuer: ISSUER.hubDay,
        approval: APPROVAL.hubDay,
        held: vouchers(9),
      },
      intl
    )!;
    expect(result.stage).toBe(sent ? "requestInTransit" : "requestNotSent");
    expect(result.band.sentence).not.toContain("their Safe needs");
    expect(result.primary?.kind ?? null).toBe(sent ? null : "redeem");
    expect(result.messageLinks).toHaveLength(sent ? 1 : 0);
    expect(result.details[0]).toBe("No vouchers have been deposited for this booking.");
    expect(result.facts[0]?.value).toContain("still in your account");
    if (!sent) {
      snapshot.availableActions = serviceAccessAvailableActions(snapshot);
      setup.availableActions = ["dispatchVoucherSetupCommand"];
      expect(agreeStep(snapshot)).toMatchObject({
        action: "dispatchVoucherSetupCommand",
        kind: "authorization",
        setupId: setup.setupId,
      });
      expect(selectServiceAccessAction(snapshot, agreeStep(snapshot)!).allowed).toBe(true);
    }
  });
  it("waits for a dispatched activation without offering it for signing again", () => {
    const snapshot = bookingStorySnapshot("hubDay", "starting");
    snapshot.voucherSetups[0]!.source.decisionDispatched = true;
    const result = serviceBookingView(
      {
        snapshot,
        coreState: "ACCEPTED",
        issuer: ISSUER.hubDay,
        approval: APPROVAL.hubDay,
        held: vouchers(8),
      },
      intl
    )!;
    expect(result.stage).toBe("activationInTransit");
    expect(result.primary).toBeNull();
    expect(result.band.sentence).toContain("has been sent");
  });
  it.each([
    ["waitingApproval", "No vouchers have been deposited"],
    ["confirmingDeposit", "Vouchers are held in escrow"],
    ["closed", "No vouchers remain held"],
  ] as const)("reports confirmed custody at %s", (stage, expected) => {
    expect(view("hubDay", stage).details[0]).toContain(expected);
  });
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
    ["hubDay", "starting", "Starting fixes the terms", "Start the Booking", null],
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

  it("keeps Retry Transfer for a failed transfer after the member reported a problem", () => {
    const failed = view("hubDay", "returnFailed", { coreState: "DISPUTED" });
    expect(failed.stage).toBe("returnFailed");
    expect(failed.primary?.label).toBe("Retry Transfer");
    // Only a transfer to recover comes before the report; one on its way waits under it.
    expect(view("hubDay", "transfersPending", { coreState: "DISPUTED" }).stage).toBe(
      "problemReported"
    );
  });

  it("names a booking's frozen issuer even when another issuer shares its token", () => {
    const { techAndSun } = VOUCHER_STORY_ISSUERS;
    const twin = {
      ...techAndSun,
      account: "0x000000000000000000000000000000000000ab01" as `0x${string}`,
      name: "Another Collective",
    };
    const booked = bookingStorySnapshot("hubDay", "termsChanged");
    // The offer moved to the twin; the booking froze Tech and Sun.
    const snapshot = {
      ...booked,
      offer: booked.offer && {
        ...booked.offer,
        voucher: { ...booked.offer.voucher!, issuer: twin.account },
      },
    };
    expect(bookingVoucherIssuer(snapshot, [twin, techAndSun])?.name).toBe("Tech and Sun");
    expect(
      bookingVoucherIssuer(bookingStorySnapshot("hubDay", "open"), [twin, techAndSun])?.name
    ).toBe("Tech and Sun");
  });

  it("keeps a changed-terms booking on the revision it was set up on", () => {
    // The offer moved to version 3; the booking's deposit and authorization are bound to 2.
    const changed = view("hubDay", "termsChanged");
    expect(changed.termsVersion).toBe("Version 2");
    expect(changed.words.revision).toBe(2n);
  });

  it("tells Promise kept? the transfer arrived once the split's transfers finished", () => {
    expect(view("hubDay", "transfersPending").confirm?.split.detail).toBe(
      "Approved; the transfer is pending"
    );
    // Settlement and confirming are separate: the transfer can arrive before the member confirms.
    const settled = view("hubDay", "closed", { coreState: "READY_FOR_CONFIRMATION" });
    expect(settled.confirm?.split.detail).toBe("Approved; the transfer arrived");
  });

  it("counts a partial one-unit delivery as one, so its final split stays offered", () => {
    const proposed = bookingStorySnapshot("hubDay", "returnProposed");
    // Tech and Sun proposes half the voucher back for a hub day cut short.
    const snapshot = {
      ...proposed,
      voucherSetups: proposed.voucherSetups.map((row) => ({
        ...row,
        destination: row.destination && { ...row.destination, issuerReturnCeiling: vouchers(0.5) },
      })),
    };
    const booking = serviceBookingView(
      {
        snapshot,
        coreState: "ACCEPTED",
        issuer: ISSUER.hubDay,
        approval: APPROVAL.hubDay,
        held: vouchers(10),
      },
      intl
    );
    expect(booking?.split).toEqual({
      delivered: 1n,
      release: vouchers(0.5),
      refund: vouchers(0.5),
    });
    expect(serviceActOffered("review", snapshot, booking?.split ?? null)).toBe(true);
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
        takeUp: null,
      },
      intl
    )!;
    expect(rewards.rows.map((row) => row.status.label)).toEqual(pills);
    expect(rewards.band.sentence).toContain(sentence);
    expect(rewards.rows[0]?.title).toBe("2 Tech and Sun vouchers");
  });

  it.each([
    ["bothOnTheWay", false, "Your reward is on its way."],
    [
      "voucherDelayed",
      false,
      "The voucher transfer didn't go through, so it waits for Tech and Sun to retry it.",
    ],
    [
      "voucherDelayed",
      true,
      "The voucher transfer didn't go through, so it waits for Tech and Sun to retry it.",
    ],
  ] as const)("never says a lone or failed voucher reward is on its way with another (%s, G$ %s)", (state, withGd, sentence) => {
    const rewards = serviceRewardsView(
      {
        snapshot: rewardStorySnapshot(state, withGd),
        coreState: rewardStoryCoreState(state),
        issuer: VOUCHER_STORY_ISSUERS.techAndSun,
        garden: "Riverside Commons Garden",
        takeUp: null,
      },
      intl
    )!;
    expect(rewards.band.sentence).toContain(sentence);
    expect(rewards.band.sentence).not.toContain("Both rewards");
  });
});

describe("a request's reward record", () => {
  it("names the request and its reward terms' version under Transaction details", () => {
    const rewards = serviceRewardsView(
      {
        snapshot: rewardStorySnapshot("received", true),
        coreState: "FULFILLED",
        issuer: VOUCHER_STORY_ISSUERS.techAndSun,
        garden: "Riverside Commons Garden",
        takeUp: null,
      },
      intl
    )!;
    expect(rewards.details.at(-1)).toBe(
      "Record: request #4103, reward terms version 2, on Arbitrum"
    );
    expect(rewards.vouchersReceived).toBe(true);
  });
});

describe("the shared pool's exchange", () => {
  it.each([
    ["deadline", "expired"],
    ["minimum", "expired"],
    ["transfer", "failed"],
    ["allowance", "failed"],
    ["inventory", "short"],
  ] as const)("answers a %s failure as %s", (failure, state) => {
    const quoted = bookingStorySnapshot("access", "notEnough", { exchange: "quoted" });
    const failed = {
      ...quoted,
      pilot: {
        ...quoted.pilot!,
        exchange: { ...quoted.pilot!.exchange, status: "failed", failure },
      },
    } as ServiceAccessSnapshot;
    expect(exchangeStateFromPilot(failed, false)).toBe(state);
  });
});

describe("a member's act on a voucher booking", () => {
  /** Snapshots that carry only what the runner reads: each setup's final transfers. */
  const legs = (rows: [setupId: string, refund: string, release: string][]) =>
    ({
      voucherSetups: rows.map(([setupId, refund, release]) => ({
        setupId,
        destination: {
          finalAllocation: { refund: { state: refund }, release: { state: release } },
        },
      })),
    }) as unknown as ServiceAccessSnapshot;
  const leg = (setupId: string, name: "refund" | "release") =>
    ({ action: "executeVoucherFinalLeg", setupId, leg: name }) as unknown as ServiceAccessAction;
  const offered = () => true;

  it("checks only the acted-on booking's transfer before stopping", async () => {
    // An earlier booking's release failed; this booking's refund arrives, then its release runs.
    const before = legs([
      ["0xold", "succeeded", "failed"],
      ["0xnow", "pending", "pending"],
    ]);
    const afterRefund = legs([
      ["0xold", "succeeded", "failed"],
      ["0xnow", "succeeded", "pending"],
    ]);
    const done = legs([
      ["0xold", "succeeded", "failed"],
      ["0xnow", "succeeded", "succeeded"],
    ]);
    const step: ServiceActStep = (s) =>
      s === before ? leg("0xnow", "refund") : s === afterRefund ? leg("0xnow", "release") : null;
    const sent: ServiceAccessAction[] = [];
    const send = async (action: ServiceAccessAction) => {
      sent.push(action);
      return { snapshot: sent.length === 1 ? afterRefund : done };
    };
    expect(await runServiceAct(before, step, send, offered)).toBe("done");
    expect(sent.map((action) => "leg" in action && action.leg)).toEqual(["refund", "release"]);
  });

  it.each([
    [
      "declined after an earlier write landed",
      1,
      new Error("User rejected the request."),
      "stopped",
    ],
    [
      "declined before anything was sent",
      0,
      new Error("User rejected the request."),
      "nothingSent",
    ],
    ["failed for another reason", 1, new Error("execution reverted"), "noResult"],
  ] as const)("reports an act %s", async (_case, landed, error, end) => {
    const first = legs([["0xnow", "pending", "pending"]]);
    const allowance = {
      action: "approveVoucherAllowance",
      setupId: "0xnow",
    } as unknown as ServiceAccessAction;
    const step: ServiceActStep = () => allowance;
    let calls = 0;
    const send = async () => {
      calls += 1;
      if (calls > landed) throw error;
      return { snapshot: legs([["0xnow", "pending", "pending"]]) };
    };
    expect(await runServiceAct(first, step, send, offered)).toBe(end);
  });

  it("starts an accepted booking: records its activation, then sends it to the escrow", async () => {
    const accepted = bookingStorySnapshot("hubDay", "starting", { activationRecorded: false });
    const raced = {
      ...accepted,
      voucherSetups: accepted.voucherSetups.map((row) => ({
        ...row,
        destination: row.destination && { ...row.destination, holderAbortRequested: true },
      })),
    };
    // A cancellation that lost the race needs the same start; it says so once the booking runs.
    for (const snapshot of [accepted, raced]) {
      const booking = serviceBookingView(
        {
          snapshot,
          coreState: bookingStoryCoreState("hubDay", "starting"),
          issuer: ISSUER.hubDay,
          approval: APPROVAL.hubDay,
          held: vouchers(10),
        },
        intl
      );
      expect(booking?.stage).toBe("starting");
      expect(booking?.primary?.label).toBe("Start the Booking");
    }
    expect(serviceActOffered("activate", accepted, null)).toBe(true);
    const recorded = bookingStorySnapshot("hubDay", "starting");
    const started = bookingStorySnapshot("hubDay", "inProgress");
    const sent: ServiceAccessAction[] = [];
    const send = async (action: ServiceAccessAction) => {
      sent.push(action);
      return { snapshot: sent.length === 1 ? recorded : started };
    };
    expect(await runServiceAct(accepted, activateStep, send)).toBe("done");
    expect(sent.map((action) => ("kind" in action ? action.kind : action.action))).toEqual([
      "finalizeVoucherActivation",
      "decision",
    ]);
  });

  it("sends nothing for an act the shared selector doesn't offer", async () => {
    const sent: ServiceAccessAction[] = [];
    const send = async (action: ServiceAccessAction) => {
      sent.push(action);
      return { snapshot: legs([]) };
    };
    const result = await runServiceAct(
      legs([]),
      () => leg("0xnow", "refund"),
      send,
      () => false
    );
    expect(result).toBe("notOffered");
    expect(sent).toEqual([]);
  });

  it("shows an act only when its first write is offered, and never reads a garden that isn't there", () => {
    const open = bookingStorySnapshot("hubDay", "open");
    expect(serviceActOffered("redeem", open, null)).toBe(true);
    const noGarden = { ...open, eligibleBuyerGardens: [] };
    expect(agreeStep(noGarden)).toBeNull();
    expect(serviceActOffered("redeem", noGarden, null)).toBe(false);
    const closing = bookingStorySnapshot("hubDay", "readyToClose");
    const split = { delivered: 1n, release: vouchers(1), refund: 0n };
    expect(serviceActOffered("close", closing, split)).toBe(true);
    const refused = {
      ...closing,
      voucherSetups: closing.voucherSetups.map((row) => ({ ...row, availableActions: [] })),
    };
    expect(serviceActOffered("close", refused, split)).toBe(false);
  });
});

describe("agreeing to a request's reward before taking it up", () => {
  type RewardSnapshot = ReturnType<typeof rewardStorySnapshot>;
  function view(takeUp: "open" | "reviewed" | null, change?: (s: RewardSnapshot) => void) {
    const snapshot = rewardStorySnapshot("agreementUnavailable", false);
    snapshot.pause.core = false;
    snapshot.acceptancePolicy.earned.modulePaused = false;
    snapshot.acceptancePolicy.earned.claimType = "individual";
    change?.(snapshot);
    return serviceRewardsView(
      {
        snapshot,
        coreState: "REQUESTED",
        issuer: VOUCHER_STORY_ISSUERS.techAndSun,
        garden: "Riverside Commons Garden",
        takeUp,
      },
      intl
    )!;
  }
  const offered = (s: RewardSnapshot) => {
    s.availableActions = ["consentEarnedTerms"];
  };

  it("offers Agree to the Rewards in the words of how the request is taken up", () => {
    expect(view("open", offered)).toMatchObject({
      agree: "offered",
      agreementUnavailable: null,
      agreeSheet: {
        title: "Agree to the Rewards",
        cta: "Agree and Take It Up",
        value: "2 Tech and Sun vouchers to your account",
        consent:
          "Agreeing records these exact rewards. Then you take the promise up, and it's yours right away.",
      },
    });
    expect(view("reviewed", offered).agreeSheet?.consent).toBe(
      "Agreeing records these exact rewards with your request. Riverside Commons Garden's stewards then accept you."
    );
  });

  it("moves on to Take It Up once agreed, and keeps the help door for an agreement it can't sign", () => {
    const agreed = view("open", (s) => {
      s.acceptancePolicy.earned.viewerConsentRevision = s.acceptancePolicy.earned.revision;
    });
    expect(agreed).toMatchObject({ agree: "agreed", agreeSheet: null, agreementUnavailable: null });
    expect(view("open").agreementUnavailable?.title).toBe("Agreeing isn't available here yet");
    // Someone who can't take the request up has nothing to agree to.
    expect(view(null)).toMatchObject({ agree: null, agreementUnavailable: null });
  });
});
