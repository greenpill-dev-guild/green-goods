import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminIdentity } from "../../../../../shared/.storybook/decorators";
import { JarCooldownEditor, JarLimitEditor } from "./CookieJarSettingEditors";

const GARDEN = "0x1111111111111111111111111111111111111111";
// The default chain's DAI and WETH, so the claim-limit rule recognises the assets.
const DAI = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address as Address;
const WETH = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "weth")?.address as Address;

// The live Arbitrum shape: 9.98 DAI in a jar that pays one cent per claim, once a day.
const oneCentDaiJar: CookieJar = {
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

const meta: Meta<typeof JarLimitEditor> = {
  title: "Admin/Workflows/Hub/CookieJarSettingEditors",
  component: JarLimitEditor,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The in-place editors behind Edit on a jar card. Each names its change in a confirmation and writes through the garden account, because a steward's own wallet cannot change a jar.",
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
    jar: oneCentDaiJar,
    gardenAddress: GARDEN,
    gardenName: "Riverbend Garden",
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof JarLimitEditor>;

/** A low limit opens on the suggested value, with the asset as a suffix. */
export const LowLimitOpensOnSuggestion: Story = {};

/** A deliberate limit opens on itself. */
export const SensibleLimitOpensOnItself: Story = {
  args: { jar: { ...oneCentDaiJar, assetAddress: WETH, currency: WETH } },
};

/** A value under the floor warns in claims; it never blocks the update. */
export const UnderFloorWarns: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Per-claim limit" });
    await expect(input).toHaveValue("10");
    await userEvent.clear(input);
    await userEvent.type(input, "0.01");
    await expect(canvas.getByText(/Emptying this jar would take 998 claims\./)).toBeVisible();
    await userEvent.clear(input);
    await userEvent.type(input, "2");
    await expect(canvas.getByRole("button", { name: "Update Limit" })).toBeEnabled();
  },
};

export const Cooldown: Story = {
  render: (args) => <JarCooldownEditor {...args} />,
};
