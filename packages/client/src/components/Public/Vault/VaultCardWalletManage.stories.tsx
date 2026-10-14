/** Staged — not yet wired into the live checkout. */
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import VaultCardWalletManage from "./VaultCardWalletManage";

const meta = {
  title: "Client/Public/Vault/Staged Wallet Manager",
  component: VaultCardWalletManage,
  tags: ["staged"],
  decorators: [
    (Story) => (
      <IntlProvider locale="en">
        <Story />
      </IntlProvider>
    ),
  ],
  args: { owners: [] },
} satisfies Meta<typeof VaultCardWalletManage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Staged: Story = {};
