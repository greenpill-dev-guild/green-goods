import { FactList } from "@green-goods/shared/components/Cards/FactRow";
import type { CommitmentMetadataV1 } from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { expect, within } from "storybook/test";
import {
  PromiseRewardParts,
  PromiseRewardRow,
  promisePayoutOf,
  promiseRewardOf,
  promiseRewardText,
} from "./PromiseReward";

const G = 10n ** 18n;
/** $20.00 set at Create, which became 160,000 G$. */
const SET_WEI = 160_000n * G;
const G_DOLLAR_REWARD: CommitmentMetadataV1["reward"] = {
  version: 1,
  usdCents: "2000",
  goodDollarWei: SET_WEI.toString(),
};
/** The same $20.00 again in USDC on Arbitrum, paid from the steward's wallet (PRD-1556). */
const USDC_LEG = {
  version: 1 as const,
  chainId: 42161,
  token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  amount: "20000000",
  usdCents: "2000",
};
const NO_PRICE: GoodDollarPriceState = { status: "unavailable", reason: "missing" };

interface RewardLineProps {
  metadata: Pick<CommitmentMetadataV1, "reward" | "rewardLegs" | "rewardLegsUnreadable">;
  /** Whether the promise has a G$ part on chain. */
  goodDollars: boolean;
  derivedState: "ACCEPTED" | "FULFILLED";
  /** Show each part on its own row, as the promise page does. */
  parts?: boolean;
}

/** The reward row as a promise's facts draw it, from the record and its metadata. */
function RewardLine({ metadata, goodDollars, derivedState, parts = false }: RewardLineProps) {
  const intl = useIntl();
  const reward = promiseRewardOf(
    goodDollars
      ? { considerationRail: "CELO_SETTLEMENT", considerationAmount: SET_WEI }
      : { considerationRail: "NONE", considerationAmount: 0n },
    metadata
  );
  const payout = promisePayoutOf({ derivedState, considerationPaid: false });
  const text = promiseRewardText({
    intl,
    rewards: reward ? [reward] : [],
    price: NO_PRICE,
    payout,
  });
  return (
    <FactList>
      {text ? <PromiseRewardRow text={text} /> : null}
      {text && parts && reward ? (
        <PromiseRewardParts
          reward={reward}
          chainId={42161}
          commitmentId={19n}
          viewer={null}
          payout={payout}
        />
      ) : null}
    </FactList>
  );
}

/**
 * A promise's reward among its facts. A G$-only reward reads as it always has. A
 * reward with a USDC part paid from the steward's wallet reads as one total, paid in
 * both tokens. When part of a reward can't be shown, the row says so.
 */
const meta: Meta<typeof RewardLine> = {
  title: "Client/Commitments/PromiseReward",
  component: RewardLine,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  args: { metadata: { reward: G_DOLLAR_REWARD }, goodDollars: true, derivedState: "ACCEPTED" },
};

export default meta;
type Story = StoryObj<typeof RewardLine>;

export const GoodDollarsOnly: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("$20.00, paid in G$ after it's kept")
    ).toBeVisible();
  },
};

export const GoodDollarsAndUsdc: Story = {
  args: { metadata: { reward: G_DOLLAR_REWARD, rewardLegs: [USDC_LEG] } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("$40.00, paid in G$ and USDC after it's kept")
    ).toBeVisible();
  },
};

/** On the promise page, each part on its own row with its network and where it stands. */
export const PartsOnThePromisePage: Story = {
  args: {
    metadata: { reward: G_DOLLAR_REWARD, rewardLegs: [USDC_LEG] },
    derivedState: "FULFILLED",
    parts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("160,000 G$ on Celo")).toBeVisible();
    await expect(canvas.getByText("20 USDC on Arbitrum One, not paid yet")).toBeVisible();
  },
};

export const UsdcOnlyKept: Story = {
  args: { metadata: { rewardLegs: [USDC_LEG] }, goodDollars: false, derivedState: "FULFILLED" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("$20.00, not yet paid in USDC")).toBeVisible();
  },
};

export const PartCantBeShown: Story = {
  args: { metadata: { reward: G_DOLLAR_REWARD, rewardLegsUnreadable: true } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "$20.00, paid in G$ after it's kept. Part of this reward can't be shown here"
      )
    ).toBeVisible();
  },
};
