/** Staged — not yet wired into the live checkout. */
import type { Meta, StoryObj } from "@storybook/react";
import type { OctantVaultCampaignManifest } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { IntlProvider } from "react-intl";
import VaultCardEndowFlow from "./VaultCardEndowFlow";

const campaign: OctantVaultCampaignManifest = {
  slug: "synthetic-complete",
  displayName: "Synthetic complete campaign",
  communityName: "Synthetic Community",
  fixtureRole: "standard_campaign",
  routePath: "/vaults",
  targetProtocol: "octant-v2-ethereum",
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

const meta = {
  title: "Client/Public/Vault/Staged Card Endow Flow",
  component: VaultCardEndowFlow,
  tags: ["staged"],
  decorators: [
    (Story) => (
      <IntlProvider locale="en">
        <Story />
      </IntlProvider>
    ),
  ],
  args: {
    campaign,
    amount: 1_000_000_000_000_000n,
    summaryItems: [],
    onBack: () => undefined,
    onComplete: () => undefined,
    onCheckoutGuardChange: () => undefined,
  },
} satisfies Meta<typeof VaultCardEndowFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Staged: Story = {};
