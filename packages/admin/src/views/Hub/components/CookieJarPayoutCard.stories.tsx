import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
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
          "One garden cookie jar on Community → Payouts, on the shared item row: the asset, the jar's one pill, its per-claim limit and its balance on the right, with no act on the row. The row opens the jar's page beneath it: the per-claim limit and cooldown as setting rows that edit in place, who can change them, and the deposit and claim acts. Jar settings are written by the garden account, so Edit is enabled only for an account that can sign for it.",
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

/** Opens the jar's page beneath its row, as a steward's tap does. */
async function openJarPage(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { expanded: false }));
  return canvas;
}

/** A sensible limit: the row says Active, and its page has both settings editable. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await openJarPage(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit Per-Claim Limit" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Claim" })).toBeVisible();
  },
};

/** The row as the Payouts list shows it, its page closed: no act on the row. */
export const Closed: Story = {};

/** Every Arbitrum DAI jar launched like this: one cent per claim, the row's one pill. */
export const LimitTooLow: Story = { args: { jar: daiJar } };

/** An editor opens the page with it; the editors have their own stories. */
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
    const canvas = await openJarPage(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit Per-Claim Limit" })).toBeDisabled();
    await expect(
      canvas.getByText("Only the garden owner's wallet can change this jar.")
    ).toBeVisible();
  },
};

export const Paused: Story = {
  args: { jar: { ...wethJar, isPaused: true } },
  play: async ({ canvasElement }) => {
    const canvas = await openJarPage(canvasElement);
    await expect(canvas.getByRole("button", { name: "Claim" })).toBeDisabled();
  },
};

/** The payout history list stops at 20, so a full list counts as at least 20. */
export const PayoutHistoryAtItsLimit: Story = {
  tags: ["storybook-ci"],
  args: { allocationCount: 20, allocationCountAtLeast: true },
  play: async ({ canvasElement }) => {
    const canvas = await openJarPage(canvasElement);
    await expect(canvas.getByText("20+ yield payouts so far.")).toBeVisible();
  },
};
