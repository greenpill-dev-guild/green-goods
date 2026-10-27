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
      held: stage === "notEnough" ? 0n : vouchers(1),
    },
    intl
  );
  if (!view) throw new Error(`No booking view at ${stage}`);
  return view;
}

const fact = (stage: BookingStoryStage, id: string) =>
  lesson(stage).facts.find((entry) => entry.id === id);

describe("a member's lesson on the promise page", () => {
  it("names the garden's stewards as who accepts, after the member approves", () => {
    expect(fact("open", "next")).toMatchObject({
      value: "Teo Alves approves, then the garden's stewards accept you",
      detail: "A steward can't approve for Teo Alves.",
    });
    expect(fact("open", "back")).toMatchObject({
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
      "Teo Alves approved. Deposit your voucher into the escrow for this booking. The garden's stewards must accept by Nov 2.",
    ],
    [
      "confirmingDeposit",
      "Your voucher is in escrow. Green Goods confirms the deposit before the garden's stewards can accept. This can take a few minutes.",
    ],
    [
      "waitingAcceptance",
      "Your deposit is confirmed and Teo Alves approved. The garden's stewards accept by Nov 2. Until then, you can cancel and get your voucher back.",
    ],
    [
      "starting",
      "You're accepted. The booking is starting on the voucher network. Starting fixes the terms; it doesn't mean the service happened.",
    ],
  ] as const)("says who acts next while the booking is at %s", (stage, sentence) => {
    expect(lesson(stage).band.sentence).toBe(sentence);
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
    expect(lesson("transfersPending").facts.find((entry) => entry.id === "back")?.value).toBe(
      "By minutes delivered, out of 60"
    );
  });

  it("closes an early end without promising the exchange or the capacity back", () => {
    expect(lesson("closed").band.sentence).toBe(
      "0.5 vouchers are back with you and 0.5 went to Teo Alves' reserve. The garden's stewards closed the promise as ended early. A return doesn't reverse an exchange or restore Teo Alves' capacity."
    );
  });

  // Pausing stops new bookings; one already under way goes ahead.
  it("holds a paused member's offer, and only the offer", () => {
    const paused = {
      ...LESSON_STORY_ISSUER,
      standing: { bookings: "paused", exchange: "listed" },
    } as const;
    expect(lesson("open", undefined, paused).issuerPaused).toBe(true);
    expect(lesson("open").issuerPaused).toBe(false);
    expect(lesson("waitingApproval", undefined, paused).issuerPaused).toBe(false);
  });

  it("tells a reader with no Teo voucher what the lesson takes", () => {
    expect(lesson("notEnough").door?.body).toBe(
      "This service takes 1. You can exchange other vouchers in the shared pool."
    );
  });

  it("names the stewards in the booking sheets, and counts what comes back in minutes", () => {
    const sheet = (stage: BookingStoryStage) =>
      renderWithProviders(
        <ServiceRedeemSheet
          open
          onOpenChange={vi.fn()}
          view={lesson(stage)}
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
    const agree = sheet("open");
    expect(
      screen.getByText(
        "Before the garden's stewards accept, you can cancel and get your voucher back."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("By minutes delivered, out of 60")).toBeInTheDocument();
    agree.unmount();

    const waiting = sheet("waitingApproval");
    expect(
      screen.getByText(
        "Teo Alves approves from their own account. Nothing has left your account. We'll let you know when you can deposit."
      )
    ).toBeInTheDocument();
    waiting.unmount();

    sheet("waitingAcceptance");
    expect(screen.getByText("Next: the garden's stewards accept you")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Green Goods checks the deposit first. Then the garden's stewards can accept you."
      )
    ).toBeInTheDocument();
  });
});
