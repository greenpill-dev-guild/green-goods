import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { fn } from "storybook/test";
import { AssetSelector } from "./AssetSelector";
import type { GardenVault } from "../../types/vaults";

const mockVaults: GardenVault[] = [
  {
    id: "vault-1",
    address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
    asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}`,
    chainId: 42161,
    name: "USDC Vault",
    symbol: "USDC",
    decimals: 6,
    totalAssets: BigInt(1000000),
    totalSupply: BigInt(1000000),
    paused: false,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
  },
  {
    id: "vault-2",
    address: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
    asset: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as `0x${string}`,
    chainId: 42161,
    name: "DAI Vault",
    symbol: "DAI",
    decimals: 18,
    totalAssets: BigInt("5000000000000000000000"),
    totalSupply: BigInt("5000000000000000000000"),
    paused: false,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
  },
  {
    id: "vault-3",
    address: "0xdef1234567890abcdef1234567890abcdef123456" as `0x${string}`,
    asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`,
    chainId: 42161,
    name: "USDT Vault",
    symbol: "USDT",
    decimals: 6,
    totalAssets: BigInt(2500000),
    totalSupply: BigInt(2500000),
    paused: false,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
  },
] as unknown as GardenVault[];

const meta: Meta<typeof AssetSelector> = {
  title: "Vault/AssetSelector",
  component: AssetSelector,
  tags: ["autodocs"],
  argTypes: {
    selectedAsset: {
      control: "text",
      description: "Currently selected asset address",
    },
    ariaLabel: {
      control: "text",
      description: "Accessible label for the radio group",
    },
    size: {
      control: "select",
      options: ["sm", "xs"],
      description: "Text size variant",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AssetSelector>;

export const Default: Story = {
  args: {
    vaults: mockVaults,
    selectedAsset: mockVaults[0].asset,
    onSelect: fn(),
    ariaLabel: "Select vault asset",
  },
};

export const SmallSize: Story = {
  args: {
    ...Default.args,
    size: "xs",
  },
};

export const NoneSelected: Story = {
  args: {
    ...Default.args,
    selectedAsset: "",
  },
};

export const SingleVault: Story = {
  args: {
    ...Default.args,
    vaults: [mockVaults[0]],
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">Default (sm)</p>
        <AssetSelector
          vaults={mockVaults}
          selectedAsset={mockVaults[0].asset}
          onSelect={() => {}}
          ariaLabel="Default size"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">Extra small (xs)</p>
        <AssetSelector
          vaults={mockVaults}
          selectedAsset={mockVaults[1].asset}
          onSelect={() => {}}
          ariaLabel="Small size"
          size="xs"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">No selection</p>
        <AssetSelector
          vaults={mockVaults}
          selectedAsset=""
          onSelect={() => {}}
          ariaLabel="No selection"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">Single vault</p>
        <AssetSelector
          vaults={[mockVaults[0]]}
          selectedAsset={mockVaults[0].asset}
          onSelect={() => {}}
          ariaLabel="Single vault"
        />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radioGroup = canvas.getByRole("radiogroup");
    await expect(radioGroup).toBeVisible();

    const radios = canvas.getAllByRole("radio");
    await expect(radios).toHaveLength(3);
    await expect(radios[0]).toHaveAttribute("aria-checked", "true");

    await userEvent.click(radios[1]);
  },
};

export const DarkMode: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
