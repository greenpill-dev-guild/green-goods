/**
 * @vitest-environment happy-dom
 */

/**
 * A member's own service on the promise page (PRD-1299 slice 2): Teo's lesson. Teo approves
 * each booking from his own account and the garden's stewards accept it, so no step names Teo
 * as the one who accepts. The lesson counts in minutes: it stopped after 30 of 60, and the
 * split returns half each way.
 */

import type { ServiceAccessSnapshot } from "@green-goods/shared/commitment-pooling";
import en from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { BookingStoryStage } from "../../../../shared/.storybook/voucherBookingFixtures";
import {
  LESSON_STORY_APPROVAL,
  LESSON_STORY_ISSUER,
  lessonStoryCoreState,
  lessonStorySnapshot,
} from "../../../../shared/.storybook/voucherLessonFixtures";
import { vouchers } from "../../../../shared/.storybook/voucherPilotFixtures";
import { serviceBookingView } from "../../views/Home/Garden/Commitment/serviceBooking";
import { ServiceRedeemSheet } from "../../views/Home/Garden/Commitment/ServiceRedeemSheet";
import { renderWithProviders, screen } from "../test-utils";

const intl = createIntl({ locale: "en", messages: en });

function lesson(
  stage: BookingStoryStage,
  snapshot: ServiceAccessSnapshot = lessonStorySnapshot(stage),
  issuer = LESSON_STORY_ISSUER
) {
  const view = serviceBookingView(
    {
      snapshot,
      coreState: lessonStoryCoreState(stage),
      issuer,
      approval: LESSON_STORY_APPROVAL,
      // Enough for the booking at hand, or none at all: the shortfall copy is its own test.
      held:
        stage === "notEnough"
          ? 0n
          : (snapshot.offer?.voucher?.units ??
            snapshot.voucherSetups[0]?.authorization.voucherUnits ??
            vouchers(1)),
      // At starting the steward's start didn't go: accepted long ago, so the fallback is due.
      acceptedAt: stage === "starting" ? 0 : undefined,
    },
    intl
  );
  if (!view) throw new Error(`No booking view at ${stage}`);
  return view;
}

const fact = (stage: BookingStoryStage, id: string) =>
  lesson(stage).facts.find((entry) => entry.id === id);

const PAUSED = {
  ...LESSON_STORY_ISSUER,
  standing: { bookings: "paused", exchange: "listed" },
} as const;

/** The lesson booked for two vouchers instead of one, at a stage. */
function twoVouchers(stage: BookingStoryStage): ServiceAccessSnapshot {
  const snapshot = lessonStorySnapshot(stage);
  if (snapshot.offer?.voucher)
    snapshot.offer.voucher = { ...snapshot.offer.voucher, units: vouchers(2) };
  for (const setup of snapshot.voucherSetups) {
    setup.authorization = { ...setup.authorization, voucherUnits: vouchers(2) };
    const result = setup.destination?.result;
    if (setup.destination && result && result.depositedUnits > 0n)
      setup.destination.result = { ...result, depositedUnits: vouchers(2) };
    const observed = setup.source.setupResult;
    if (observed && observed.depositedUnits > 0n)
      setup.source.setupResult = { ...observed, depositedUnits: vouchers(2) };
  }
  return snapshot;
}

function sheet(view: ReturnType<typeof lesson>) {
  return renderWithProviders(
    <ServiceRedeemSheet
      open
      onOpenChange={vi.fn()}
      view={view}
      reviewed={null}
      agreeDeadline="Nov 2"
      outcome={null}
      held={vouchers(1)}
      isPending={false}
      onAgree={vi.fn()}
      onDeposit={vi.fn()}
      onCheck={vi.fn()}
      onExchange={vi.fn()}
      canExchange={false}
    />
  );
}

describe("a member's lesson on the promise page", () => {
  it("names the garden's stewards as who accepts, after the member approves", () => {
    const how = (id: string) => lesson("open").howItWorks.find((entry) => entry.id === id);
    expect(how("next")).toMatchObject({
      value: "Teo Alves approves, then the garden's stewards accept you",
      detail: "A steward can't approve for Teo Alves.",
    });
    expect(how("back")).toMatchObject({
      value: "All of it, if you cancel before the booking is accepted",
      detail: "After that, by minutes delivered out of 60. You approve the split.",
    });
    const accepted = lesson("waitingAcceptance").phases.find((phase) => phase.id === "accepted");
    expect(accepted?.who).toBe("The garden's stewards");
    expect(accepted?.steps[0]?.text).toBe("The garden's stewards accepted you");
  });

  it.each([
    [
      "waitingApproval",
      "Teo Alves approves from their own account. Your voucher is still in your account. You can cancel any time before the booking is accepted.",
    ],
    [
      "readyToDeposit",
      "Teo Alves approved. Deposit your voucher to hold your place. The garden's stewards accept by Nov 2.",
    ],
    [
      "confirmingDeposit",
      "Your voucher is held for this booking. The garden's stewards accept by Nov 2. Until then you can cancel and get it back.",
    ],
    [
      "waitingAcceptance",
      "Your voucher is held for this booking. The garden's stewards accept by Nov 2. Until then you can cancel and get it back.",
    ],
    [
      "starting",
      "You're accepted, but your booking hasn't started. Start the booking to fix its terms. Starting doesn't mean the service happened.",
    ],
  ] as const)("says who acts next while the booking is at %s", (stage, sentence) => {
    expect(lesson(stage).band.sentence).toBe(sentence);
  });

  // The steps a member's service waits on name who: Teo approves, the stewards accept.
  it.each([
    ["waitingApproval", 2, "waiting on Teo Alves"],
    ["confirmingDeposit", 3, "waiting on the garden's stewards"],
    ["waitingAcceptance", 3, "waiting on the garden's stewards"],
  ] as const)("waits on whoever acts next at %s", (stage, at, waiting) => {
    expect(lesson(stage).tracker).toMatchObject({ at, waiting });
  });

  it("counts the lesson in minutes and proposes half back", () => {
    const proposed = lesson("returnProposed");
    expect(proposed.band.sentence).toBe(
      "The session stopped after 30 of 60 minutes. Teo Alves proposes 0.5 back to you and 0.5 to their reserve, by minutes delivered. Nothing moves until you approve the split or report a problem."
    );
    expect(proposed.split).toEqual({
      delivered: 30n,
      release: vouchers(0.5),
      refund: vouchers(0.5),
    });
    expect(proposed.phases.find((phase) => phase.id === "delivery")?.title).toBe("Session");
    expect(lesson("transfersPending").delivery).toEqual({
      label: "Minutes delivered",
      done: 30,
      of: 60,
    });
    expect(lesson("transfersPending").howItWorks.find((entry) => entry.id === "back")?.value).toBe(
      "By minutes delivered, out of 60"
    );
    expect(fact("transfersPending", "reported")?.value).toBe("30 of 60 minutes");
  });

  it("closes an early end without promising the exchange or the capacity back", () => {
    expect(lesson("closed").band.sentence).toBe(
      "0.5 vouchers are back with you and 0.5 went to Teo Alves' reserve. The garden's stewards closed the promise as ended early. A return doesn't reverse an exchange or restore Teo Alves' capacity."
    );
  });

  // Pausing stops new bookings; one already under way goes ahead.
  it("holds a paused member's offer, and only the offer", () => {
    expect(lesson("open", undefined, PAUSED).issuerPaused).toBe(true);
    expect(lesson("open").issuerPaused).toBe(false);
    expect(lesson("waitingApproval", undefined, PAUSED).issuerPaused).toBe(false);
  });

  // Holding too few vouchers doesn't hide the pause: there is no door to exchange into it.
  it("keeps the pause for a reader with too few vouchers, with no exchange door", () => {
    const short = lesson("notEnough", undefined, PAUSED);
    expect(short.issuerPaused).toBe(true);
    expect(short.door).toEqual({
      title: "New bookings are paused.",
      body: "Teo Alves paused new bookings. Your voucher keeps its terms, and booked services go ahead.",
      act: null,
    });
  });

  // A pause read after the sheet opened still stops Agree before anything is sent.
  it("disables Agree in an open sheet once the issuer's pause is read", () => {
    sheet(lesson("open", undefined, PAUSED));
    expect(screen.getByText("New bookings are paused.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agree to These Terms" })).toBeDisabled();
  });

  it("gives the booking's deadline as Accept by, until the stewards accept", () => {
    expect(fact("waitingAcceptance", "deadline")).toMatchObject({
      label: "Accept by",
      value: "Nov 2",
    });
    expect(fact("inProgress", "deadline")).toBeUndefined();
  });

  // A member's terms set what a booking takes; the words count it.
  it("counts a member's booking that takes more than one voucher", () => {
    const of = (stage: BookingStoryStage) => lesson(stage, twoVouchers(stage));
    expect(of("readyToDeposit").band.sentence).toBe(
      "Teo Alves approved. Deposit your 2 vouchers to hold your place. The garden's stewards accept by Nov 2."
    );
    expect(of("waitingAcceptance").band.sentence).toBe(
      "Your 2 vouchers are held for this booking. The garden's stewards accept by Nov 2. Until then you can cancel and get them back."
    );
    expect(of("open").howItWorks.find((entry) => entry.id === "back")?.value).toBe(
      "All of them, if you cancel before the booking is accepted"
    );
  });

  it("tells a reader with no Teo voucher what the lesson takes", () => {
    expect(lesson("notEnough").door?.body).toBe(
      "This service takes 1. You can exchange other vouchers in the shared pool."
    );
  });

  it("names the stewards in the booking sheets, and counts what comes back in minutes", () => {
    const agree = sheet(lesson("open"));
    expect(
      screen.getByText(
        "Before the garden's stewards accept, you can cancel and get your voucher back."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("By minutes delivered, out of 60")).toBeInTheDocument();
    agree.unmount();

    const waiting = sheet(lesson("waitingApproval"));
    expect(
      screen.getByText(
        "Teo Alves approves from their own account. Nothing has left your account. When it's your turn to deposit, this booking says Needs you."
      )
    ).toBeInTheDocument();
    waiting.unmount();

    sheet(lesson("waitingAcceptance"));
    expect(screen.getByText("Next: the garden's stewards accept you")).toBeInTheDocument();
    // The sheet carries the page's own tracker, waiting on the stewards at Service.
    const steps = screen.getByRole("list", { name: "Steps" });
    expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Service, waiting on the garden's stewards"
    );
    expect(
      screen.getByText(
        "Green Goods checks the deposit first. Then the garden's stewards can accept you."
      )
    ).toBeInTheDocument();
  });
});
