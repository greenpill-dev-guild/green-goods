import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, waitFor, within } from "storybook/test";
import type { BookingStoryStage } from "../../../../../../shared/.storybook/voucherBookingFixtures";
import {
  LESSON_STORY_APPROVAL,
  LESSON_STORY_ISSUER,
  LESSON_STORY_TITLE,
  lessonStoryCoreState,
  lessonStorySnapshot,
} from "../../../../../../shared/.storybook/voucherLessonFixtures";
import { vouchers } from "../../../../../../shared/.storybook/voucherPilotFixtures";
import { serviceBookingView } from "./serviceBooking";
import { ServiceRedeemSheet } from "./ServiceRedeemSheet";
import { ServiceSplitSheet } from "./ServiceSplitSheet";

type Lang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;
type LessonSheetStep = "agree" | "waiting" | "deposit" | "deposited" | "split";
const STAGE: Record<LessonSheetStep, BookingStoryStage> = {
  agree: "open",
  waiting: "waitingApproval",
  deposit: "readyToDeposit",
  deposited: "waitingAcceptance",
  split: "returnProposed",
};

function Sheet({ step }: { step: LessonSheetStep }) {
  const intl = useIntl();
  const stage = STAGE[step];
  const view = serviceBookingView(
    {
      snapshot: lessonStorySnapshot(stage),
      coreState: lessonStoryCoreState(stage),
      issuer: LESSON_STORY_ISSUER,
      approval: LESSON_STORY_APPROVAL,
      held: vouchers(1),
    },
    intl
  );
  if (!view) return null;
  if (step === "split")
    return (
      <ServiceSplitSheet
        open
        onOpenChange={fn()}
        view={view}
        title={LESSON_STORY_TITLE}
        isPending={false}
        onApprove={fn()}
        onReport={fn()}
      />
    );
  return (
    <ServiceRedeemSheet
      open
      onOpenChange={fn()}
      view={view}
      reviewed={null}
      agreeDeadline={
        view.words.deadline ??
        intl.formatDate(Date.UTC(2026, 10, 2), { month: "short", day: "numeric" })
      }
      outcome={null}
      held={vouchers(1)}
      isPending={false}
      onAgree={fn()}
      onDeposit={fn()}
      onCheck={fn()}
      onExchange={fn()}
      canExchange={false}
    />
  );
}

function LessonSheet({ step, lang }: { step: LessonSheetStep; lang: Lang }) {
  return (
    <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
      <Sheet step={step} />
    </IntlProvider>
  );
}

/**
 * The booking sheets over a member's lesson (PRD-1299 SPay and SRedeem, slice 2): agreeing,
 * waiting for Teo's approval from his own account, the deposit, the garden's stewards accepting,
 * and the final split by minutes delivered. Pick the language with `lang`.
 */
const meta: Meta<typeof LessonSheet> = {
  title: "Client/Commitments/Voucher Lesson Sheets",
  component: LessonSheet,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  argTypes: {
    step: { control: false },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { lang: "en" },
};
export default meta;
type Story = StoryObj<typeof LessonSheet>;

/** The sheet says what it should and leaks no message id, in whatever language is picked. */
const shows =
  (english: string): Story["play"] =>
  async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    if (args.lang === "en") await waitFor(() => expect(dialog.textContent).toContain(english));
    await expect(dialog.textContent).not.toMatch(/app\.voucher\./);
  };

/** Review and Redeem: until the garden's stewards accept, the voucher can come back. */
export const Agree: Story = {
  args: { step: "agree" },
  play: shows("Before the garden's stewards accept, you can cancel and get your voucher back."),
};

/** Agreed: Teo approves from his own account; nothing has left the reader's account. */
export const WaitingForTeo: Story = {
  args: { step: "waiting" },
  play: shows("Teo Alves approves from their own account. Nothing has left your account."),
};

/** Teo approved: one voucher into the booking's escrow, perhaps two prompts. */
export const Deposit: Story = {
  args: { step: "deposit" },
  play: shows("Deposit 1 Voucher"),
};

/** Deposited: Green Goods checks it, then the garden's stewards accept. */
export const Deposited: Story = {
  args: { step: "deposited" },
  play: shows("Next: the garden's stewards accept you"),
};

/** The final split by minutes delivered: half to Teo's reserve, half back. */
export const ApproveSplit: Story = {
  args: { step: "split" },
  play: shows("I received 30 of the 60 minutes"),
};
