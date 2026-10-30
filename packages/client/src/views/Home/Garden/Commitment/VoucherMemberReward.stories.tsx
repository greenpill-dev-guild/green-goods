import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { expect, waitFor } from "storybook/test";
import type { RewardStoryState } from "../../../../../../shared/.storybook/voucherBookingFixtures";
import { withSeededQueryClient } from "../../../../../../shared/.storybook/decorators";
import {
  LESSON_STORY_ISSUER,
  lessonStoryWallet,
} from "../../../../../../shared/.storybook/voucherLessonFixtures";
import {
  memberRewardStoryController,
  memberRewardStorySnapshot,
} from "../../../../../../shared/.storybook/voucherMemberRewardFixtures";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import {
  VOUCHER_STORY_PAGE_HOOKS,
  type VoucherStoryLang,
  VoucherStoryPage,
} from "../../../../../../shared/.storybook/voucherStoryPage";
import { GardenCommitment } from "./GardenCommitment";
import {
  requestRewardDeliveries,
  type RequestRewardDelivery,
} from "@green-goods/shared/commitment-pooling";

const NAMES = { [LESSON_STORY_ISSUER.account.toLowerCase()]: "Teo Alves" };

/** The request's page at one reward state; the reader holds the Teo voucher once it arrives. */
function MemberRewardPage({
  state,
  lang,
  delivery,
}: {
  state: RewardStoryState;
  lang: VoucherStoryLang;
  delivery?: RequestRewardDelivery["status"];
}) {
  const snapshot = useMemo(() => {
    const s = memberRewardStorySnapshot(state);
    if (delivery) {
      const reward = requestRewardDeliveries(s)![0]!;
      delete s.pilot;
      s.earnedReward = {
        ...reward,
        status: delivery,
        receipt: null,
        messageId: delivery === "preparing" ? null : reward.id,
      };
    }
    return s;
  }, [state, delivery]);
  const wallet = useMemo(
    () =>
      lessonStoryWallet(
        snapshot,
        (delivery ? delivery === "received" : state === "received") ? 1 : 0
      ),
    [snapshot, state, delivery]
  );
  return (
    <VoucherStoryPage
      snapshot={snapshot}
      controller={memberRewardStoryController(state)}
      wallet={wallet}
      names={NAMES}
      lang={lang}
      page={<GardenCommitment />}
    />
  );
}

/**
 * A request rewarded with a member's voucher (PRD-1299 SReward "Member voucher", slice 2): the
 * garden asks for its impact website's design and rewards 1 Teo voucher, sent from Teo's own
 * reserve under the allowance he approves for rewards. Fictional people from the design lab.
 * Pick the language with `lang`.
 */
const meta: Meta<typeof MemberRewardPage> = {
  title: "Client/Commitments/Voucher Member Reward",
  component: MemberRewardPage,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withSeededQueryClient([])],
  beforeEach: () => resetHookMocks(...VOUCHER_STORY_PAGE_HOOKS),
  argTypes: {
    state: { control: false },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { lang: "en" },
};
export default meta;
type Story = StoryObj<typeof MemberRewardPage>;

/** The page says what it should and leaks no message id, in whatever language is picked. */
const shows =
  (english: string): Story["play"] =>
  async ({ canvasElement, args }) => {
    await waitFor(() => expect(canvasElement.textContent).toMatch(/\S/));
    if (args.lang === "en")
      await waitFor(() => expect(canvasElement.textContent).toContain(english));
    await expect(canvasElement.textContent).not.toMatch(/app\.voucher\./);
  };

/** Open: the reward is 1 Teo voucher, sent from his reserve once the work is confirmed. */
export const Open: Story = {
  args: { state: "open" },
  play: shows("Teo Alves sends vouchers from their reserve when your work is confirmed."),
};

/** Agreeing to the reward on the source network still needs an operator. */
export const AgreementUnavailable: Story = {
  args: { state: "agreementUnavailable" },
  play: shows("1 Teo Alves voucher"),
};

/** The work is under way; the reward comes after it is confirmed. */
export const InProgress: Story = {
  args: { state: "inProgress" },
  play: shows("1 Teo Alves voucher"),
};

/** Teo's allowance for rewards doesn't cover this one: it waits for him to approve more. */
export const AllowanceShort: Story = {
  args: { state: "reserveShort" },
  play: shows("Sent when Teo Alves approves more."),
};

/** The voucher arrived, in the reader's account. */
export const Received: Story = {
  args: { state: "received" },
  play: shows("Your Teo Alves voucher is in your account."),
};

/** Synthetic distribution reads on the real promise page; no chain calls or signing. */
export const DistributionPreparing: Story = { args: { state: "received", delivery: "preparing" } };
export const DistributionInTransit: Story = { args: { state: "received", delivery: "on-the-way" } };
export const DistributionReadUnavailable: Story = {
  args: { state: "received", delivery: "unavailable" },
};
export const DistributionDelivered: Story = { args: { state: "received", delivery: "received" } };
