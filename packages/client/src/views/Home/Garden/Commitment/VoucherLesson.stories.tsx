import { useServiceAccess, useServiceAccessMutation } from "@green-goods/shared/commitment-pooling";
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
import { useLayoutEffect, useMemo } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, fn, mocked, waitFor, within } from "storybook/test";
import {
  type BookingStoryStage,
  VOUCHER_STORY_NAMES,
  VOUCHER_STORY_WALLET_KEY,
} from "../../../../../../shared/.storybook/voucherBookingFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import {
  LESSON_STORY_ISSUER,
  LESSON_STORY_PAUSED_ISSUER,
  lessonStoryController,
  lessonStorySnapshot,
  lessonStoryWallet,
} from "../../../../../../shared/.storybook/voucherLessonFixtures";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { VOUCHER_STORY_SCOPE } from "../../../../../../shared/.storybook/voucherPilotFixtures";
import { GardenCommitment } from "./GardenCommitment";

type Lang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;
const NAMES: Readonly<Record<string, string>> = {
  ...VOUCHER_STORY_NAMES,
  [LESSON_STORY_ISSUER.account.toLowerCase()]: "Teo Alves",
};

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
  lang: Lang;
  /** Teo paused new bookings. */
  paused?: boolean;
}) {
  const snapshot = useMemo(() => lessonStorySnapshot(stage), [stage]);
  const client = useQueryClient();
  useLayoutEffect(() => {
    const issuer = paused ? LESSON_STORY_PAUSED_ISSUER : LESSON_STORY_ISSUER;
    client.setQueryData(
      VOUCHER_STORY_WALLET_KEY,
      lessonStoryWallet(snapshot, heldAt(stage), issuer)
    );
  }, [client, snapshot, stage, paused]);
  mocked(useServiceAccess).mockReturnValue({
    data: snapshot,
    isLoading: false,
    isError: false,
    status: "success",
    fetchStatus: "idle",
    error: null,
    refetch: fn(),
  } as unknown as ReturnType<typeof useServiceAccess>);
  mocked(useServiceAccessMutation).mockReturnValue({
    isPending: false,
    mutateAsync: async () => ({ kind: "local-rehearsal", observationId: "story", snapshot }),
  } as unknown as ReturnType<typeof useServiceAccessMutation>);
  mocked(useGardenCommitmentController).mockReturnValue(lessonStoryController(stage));
  mocked(usePrimaryAddress).mockReturnValue(VOUCHER_STORY_SCOPE.account);
  mocked(useCommitmentActivity).mockReturnValue({
    events: [],
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
        data: address ? (NAMES[address.toLowerCase()] ?? null) : null,
      }) as ReturnType<typeof useGreenGoodsEnsName>
  );
  mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
  const garden = snapshot.offer?.providerGarden;
  return (
    <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
      <MemoryRouter
        key={stage}
        initialEntries={[`/home/${garden}/commitments/${snapshot.key.commitmentId.toString()}`]}
      >
        <Routes>
          <Route path="/home/:id/commitments/:commitmentId" element={<GardenCommitment />} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>
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
