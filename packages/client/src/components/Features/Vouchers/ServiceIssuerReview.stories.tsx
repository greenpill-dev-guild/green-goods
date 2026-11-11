import type { ServiceIssuerAsset } from "@green-goods/shared/commitment-pooling";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { ServiceIssuerReview } from "./ServiceIssuerReview";
import {
  ISSUER_STORY_HASH,
  issuerStoryAssets,
  issuerStoryReview,
} from "@/views/Profile/serviceIssuerStoryFixtures";

const [engineerHelp, analystCoaching] = issuerStoryAssets as [
  ServiceIssuerAsset,
  ServiceIssuerAsset,
];

/** The coaching voucher with one reviewed offer, so the review can say what one books. */
const coachingWithOffer: ServiceIssuerAsset = {
  ...analystCoaching,
  service: {
    ...analystCoaching.service,
    offers: [
      {
        name: "Analyst coaching",
        unit: "minutes",
        serviceUnits: 45n,
        voucherUnits: 1_000_000n,
        serviceTermsRef: ISSUER_STORY_HASH,
        remedyTermsRef: ISSUER_STORY_HASH,
        capacity: 6_000_000n,
      },
    ],
  },
};

/** Half an engineer-help voucher for one coaching voucher, quoted at a 0.05 fee. */
const exchange = issuerStoryReview({
  kind: "exchange",
  outputAssetId: "analyst-help",
  amount: 500_000n,
  quotedOutput: 1_000_000n,
  minimumOutput: 1_000_000n,
  deadline: 1_900_000_300n,
});

/**
 * The exact review a member signs in Your Services (PRD-1299 `SMyService`): one immutable review
 * under the member's own words for the act. An exchange reads as the exchange sheet does, in the
 * issuers' words, with contract addresses folded under Transaction details and the consent last.
 * Switch the toolbar's Language for Spanish and Portuguese. Fictional data; nothing is sent.
 */
const meta: Meta<typeof ServiceIssuerReview> = {
  title: "Client/Profile/ServiceIssuerReview",
  component: ServiceIssuerReview,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: { review: { control: false }, asset: { control: false }, assets: { control: false } },
  args: {
    review: { ...exchange, expected: { grossOutput: 1_050_000n } },
    poolName: "Fictional local exchange",
    asset: engineerHelp,
    assets: [engineerHelp, coachingWithOffer],
    busy: false,
    onClose: fn(),
    onConfirm: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceIssuerReview>;

/** You spend, you receive, the fee, what the coaching voucher books, the pool and the deadline. */
export const ExchangeVouchers: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByText("You spend")).toBeVisible();
    await expect(dialog.getByText("Analyst coaching: 45 minutes for 1 voucher")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Exchange 0.5 vouchers" })).toBeDisabled();
  },
};

/** A quote that carried no gross output: the fee row says so instead of reading as zero. */
export const FeeNotQuoted: Story = { args: { review: exchange } };

/** An issuer's own act keeps its named review: Issue More, with the amount it issues. */
export const IssueMore: Story = {
  args: { review: issuerStoryReview({ kind: "issue", amount: 1_000_000n }), intent: "issue" },
};
