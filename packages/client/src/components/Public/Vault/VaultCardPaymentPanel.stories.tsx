/** Staged — not yet wired into the live checkout. */
import type { Meta, StoryObj } from "@storybook/react";
import type { OctantVaultCampaignManifest } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { prepareOctantVaultCardEndowFallbackPlan } from "@green-goods/shared/modules/vault-crowdfunding/route-manage";
import { IntlProvider } from "react-intl";
import { createThirdwebClient } from "thirdweb";
import VaultCardPaymentPanel from "./VaultCardPaymentPanel";

const campaign: OctantVaultCampaignManifest = {
  slug: "synthetic-complete",
  displayName: "Synthetic complete campaign",
  communityName: "Synthetic Community",
  fixtureRole: "standard_campaign",
  routePath: "/vaults",
  targetProtocol: "octant-v2-ethereum",
  campaignCopy: {
    headline: "Fund a complete Octant vault",
    summary: "A complete fixture for staged component review.",
    fundingPurpose: "Support public goods work through a dedicated vault.",
    recipientLogic: "Yield routes through the supplied recipient configuration.",
    riskNote: "Vault deposits depend on the underlying token and strategy.",
  },
  vault: {
    chainId: 1,
    vaultAddress: "0x1111111111111111111111111111111111111111",
    asset: {
      address: "0x2222222222222222222222222222222222222222",
      symbol: "WETH",
      decimals: 18,
    },
    explorerLink: "https://etherscan.io/address/0x1111111111111111111111111111111111111111",
  },
  recipientRoutingSummary: "Yield routes to a verified public goods recipient.",
  protocolGuildDestinationContext: "Protocol Guild allocation context is recorded.",
};

const preparation = prepareOctantVaultCardEndowFallbackPlan({
  campaign,
  amount: "1000000000000000",
  receiverAddress: "0x3333333333333333333333333333333333333333",
});
if (!preparation.plan) throw new Error("Staged payment story requires a complete fallback plan");

const meta = {
  title: "Client/Public/Vault/Staged Card Payment Panel",
  component: VaultCardPaymentPanel,
  tags: ["staged"],
  decorators: [
    (Story) => (
      <IntlProvider locale="en">
        <Story />
      </IntlProvider>
    ),
  ],
  args: {
    client: createThirdwebClient({ clientId: "storybook-staged-client" }),
    plan: preparation.plan,
    campaign,
    summaryItems: [],
    onCardFundingSuccess: () => undefined,
    cardFundingComplete: false,
    statusBlock: null,
  },
} satisfies Meta<typeof VaultCardPaymentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Staged: Story = {};
