import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { CookieJarPayoutCard } from "./CookieJarPayoutCard";

const GARDEN = "0x1111111111111111111111111111111111111111";
// The default chain's DAI and WETH, so the claim-limit rule recognises the assets.
const DAI = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address as Address;
const WETH = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "weth")?.address as Address;

const daiJar: CookieJar = {
  jarAddress: "0x7A3d0000000000000000000000000000000041C2",
  gardenAddress: GARDEN,
  assetAddress: DAI,
  currency: DAI,
  balance: 9_980_000_000_000_000_000n,
  decimals: 18,
  maxWithdrawal: 10_000_000_000_000_000n,
  withdrawalInterval: 86_400n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: true,
};

const wethJar: CookieJar = {
  ...daiJar,
  jarAddress: "0x2C4F000000000000000000000000000000009b10",
  assetAddress: WETH,
  currency: WETH,
  balance: 420_000_000_000_000_000n,
};

const canSign = { canSign: true, isResolved: true };

const meta: Meta<typeof CookieJarPayoutCard> = {
  title: "Admin/Workflows/Hub/CookieJarPayoutCard",
  component: CookieJarPayoutCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "One garden cookie jar on Community → Payouts: balance, the per-claim limit and cooldown as setting rows that edit in place, and the deposit and claim acts. Jar settings are written by the garden account, so Edit is enabled only for an account that can sign for it.",
      },
    },
  },
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="max-w-sm p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
  args: {
    jar: wethJar,
    gardenAddress: GARDEN,
    gardenName: "Riverbend Garden",
    allocationCount: 4,
    signer: canSign,
    editingField: null,
    onEdit: fn(),
    onDeposit: fn(),
    onClaim: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CookieJarPayoutCard>;

/** A sensible limit: no chip, both rows editable. */
export const Default: Story = {};

/** Every Arbitrum DAI jar launched like this: one cent per claim. */
export const LimitTooLow: Story = { args: { jar: daiJar } };

/** The row opens in place; the editors have their own stories. */
export const EditingLimit: Story = { args: { jar: daiJar, editingField: "limit" } };

/** Disabled, never hidden; the note names who can act. */
export const StewardCannotSign: Story = {
  tags: ["storybook-ci"],
  args: {
    jar: daiJar,
    signer: {
      canSign: false,
      isResolved: true,
      owner: "0x9E1b00000000000000000000000000000000C7f0",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit Per-Claim Limit" })).toBeDisabled();
    await expect(
      canvas.getByText("Only the garden owner's wallet can change this jar.")
    ).toBeVisible();
  },
};

export const Paused: Story = { args: { jar: { ...wethJar, isPaused: true } } };

/** The payout history list stops at 20, so a full list counts as at least 20. */
export const PayoutHistoryAtItsLimit: Story = {
  tags: ["storybook-ci"],
  args: { allocationCount: 20, allocationCountAtLeast: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("20+ yield payouts so far.")).toBeVisible();
  },
};
