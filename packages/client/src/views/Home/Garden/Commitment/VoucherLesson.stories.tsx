import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { expect, waitFor, within } from "storybook/test";
import type { BookingStoryStage } from "../../../../../../shared/.storybook/voucherBookingFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import {
  LESSON_STORY_ISSUER,
  LESSON_STORY_PAUSED_ISSUER,
  lessonStoryController,
  lessonStorySnapshot,
  lessonStoryWallet,
} from "../../../../../../shared/.storybook/voucherLessonFixtures";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import {
  VOUCHER_STORY_PAGE_HOOKS,
  type VoucherStoryLang,
  VoucherStoryPage,
} from "../../../../../../shared/.storybook/voucherStoryPage";
import { GardenCommitment } from "./GardenCommitment";

const NAMES = { [LESSON_STORY_ISSUER.account.toLowerCase()]: "Teo Alves" };

/** Teo vouchers in the reader's account: one before the deposit, half back after the split. */
function heldAt(stage: BookingStoryStage): number {
  if (stage === "notEnough") return 0;
  if (stage === "closed") return 0.5;
  return ["open", "waitingApproval", "readyToDeposit"].includes(stage) ? 1 : 0;
}

/** The lesson's promise page at one stage, with the reader's acts answered in place. */
function LessonPage({
  stage,
  lang,
  paused = false,
}: {
  stage: BookingStoryStage;
  lang: VoucherStoryLang;
  /** Teo paused new bookings. */
  paused?: boolean;
}) {
  const snapshot = useMemo(() => lessonStorySnapshot(stage), [stage]);
  const wallet = useMemo(
    () =>
      lessonStoryWallet(
        snapshot,
        heldAt(stage),
        paused ? LESSON_STORY_PAUSED_ISSUER : LESSON_STORY_ISSUER
      ),
    [snapshot, stage, paused]
  );
  return (
    <VoucherStoryPage
      snapshot={snapshot}
      controller={lessonStoryController(stage)}
      wallet={wallet}
      names={NAMES}
      lang={lang}
      page={<GardenCommitment />}
    />
  );
}

/**
 * A member's own lesson on the promise page (PRD-1299 SOffer and SRedeem, slice 2): Teo approves
 * each booking from his own account and the garden's stewards accept it; the lesson counts in
 * minutes and stopped after 30 of 60. Fictional people from the design lab. Pick the stage's
 * language with `lang`; the sheets are in Voucher Lesson Sheets.
 */
const meta: Meta<typeof LessonPage> = {
  title: "Client/Commitments/Voucher Lesson",
  component: LessonPage,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withSeededQueryClient([])],
  beforeEach: () => resetHookMocks(...VOUCHER_STORY_PAGE_HOOKS),
  argTypes: {
    stage: { control: false },
    paused: { control: false },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { lang: "en" },
};
export default meta;
type Story = StoryObj<typeof LessonPage>;

/** The page says what it should and leaks no message id, in whatever language is picked. */
const shows =
  (english: string): Story["play"] =>
  async ({ canvasElement, args }) => {
    await waitFor(() => expect(canvasElement.textContent).toMatch(/\S/));
    if (args.lang === "en")
      await waitFor(() => expect(canvasElement.textContent).toContain(english));
    await expect(canvasElement.textContent).not.toMatch(/app\.voucher\./);
  };

/** The offer: Teo approves, then the garden's stewards accept; what comes back goes by minutes. */
export const Offer: Story = {
  args: { stage: "open" },
  play: shows("Teo Alves approves, then the garden's stewards accept you"),
};

/** Teo paused new bookings: the offer's act stays, disabled, with the reason above it. */
export const Paused: Story = {
  args: { stage: "open", paused: true },
  play: async (context) => {
    await shows(
      "Teo Alves paused new bookings. Your voucher keeps its terms, and booked services go ahead."
    )?.(context);
    if (context.args.lang === "en")
      await expect(
        within(context.canvasElement).getByRole("button", { name: "Review and Redeem" })
      ).toBeDisabled();
  },
};

/** No Teo voucher yet: what the lesson takes, and the shared pool's exchange as the door. */
export const NotEnough: Story = {
  args: { stage: "notEnough" },
  play: shows("This service takes 1. You can exchange other vouchers in the shared pool."),
};

/** Agreed: Teo approves from his own account, with no Safe to count. */
export const WaitingForTeo: Story = {
  args: { stage: "waitingApproval" },
  play: shows("Teo Alves approves from their own account."),
};

/** Teo approved: the reader deposits the voucher, and the stewards accept by the deadline. */
export const Deposit: Story = {
  args: { stage: "readyToDeposit" },
  play: shows("The garden's stewards must accept by"),
};

/** The deposit is confirmed: the garden's stewards accept next. */
export const WaitingForStewards: Story = {
  args: { stage: "waitingAcceptance" },
  play: shows("The garden's stewards accepted you"),
};

/** The lesson stopped after 30 of 60 minutes: Teo proposes half back. */
export const ReturnProposed: Story = {
  args: { stage: "returnProposed" },
  play: shows("The session stopped after 30 of 60 minutes."),
};

/** Each transfer on its own, after the split: half to the reader, half to Teo's reserve. */
export const TransfersPending: Story = {
  args: { stage: "transfersPending" },
  play: shows("Minutes delivered"),
};

/** Ended early: the stewards closed it, and a return restores no capacity. */
export const EndedEarly: Story = {
  args: { stage: "closed" },
  play: shows("A return doesn't reverse an exchange or restore Teo Alves' capacity."),
};
