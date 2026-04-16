import type { Meta, StoryObj } from "@storybook/react";
import { VaultPositionCard } from "./index";

const meta: Meta<typeof VaultPositionCard> = {
  title: "Cards/VaultPositionCard",
  component: VaultPositionCard,
  tags: ["autodocs"],
  argTypes: {
    gardenName: { control: "text", description: "Garden display name" },
    deposited: { control: "text", description: "Deposited amount" },
    currentValue: { control: "text", description: "Current value of position" },
    apy: { control: "text", description: "Annual percentage yield" },
    tokenSymbol: { control: "text", description: "Optional token symbol suffix" },
  },
};

export default meta;
type Story = StoryObj<typeof VaultPositionCard>;

export const Default: Story = {
  args: {
    gardenName: "Regenerative Garden Bogota",
    deposited: "1.5000",
    currentValue: "1.5234",
    apy: "3.12%",
    tokenSymbol: "WETH",
  },
};

export const WithoutTokenSymbol: Story = {
  args: {
    gardenName: "Berlin Composting Collective",
    deposited: "500.00 DAI",
    currentValue: "512.34 DAI",
    apy: "4.87%",
  },
};

export const LongGardenName: Story = {
  args: {
    gardenName: "A Very Long Garden Name That Should Be Truncated In The Card Display",
    deposited: "0.2500",
    currentValue: "0.2512",
    apy: "1.95%",
    tokenSymbol: "WETH",
  },
};

export const ZeroApy: Story = {
  args: {
    gardenName: "New Garden",
    deposited: "100.00",
    currentValue: "100.00",
    apy: "0.00%",
    tokenSymbol: "DAI",
  },
};

export const DarkMode: Story = {
  args: {
    gardenName: "Regenerative Garden Bogota",
    deposited: "1.5000",
    currentValue: "1.5234",
    apy: "3.12%",
    tokenSymbol: "WETH",
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
