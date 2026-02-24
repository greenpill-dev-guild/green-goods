import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import type { Address, GardenVault } from "@green-goods/shared";
import { WithdrawModal } from "./WithdrawModal";

const MOCK_GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;

const mockVaults: GardenVault[] = [
  {
    id: "vault-usdc",
    chainId: 42161,
    garden: MOCK_GARDEN_ADDRESS,
    asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
    vaultAddress: "0x00000000000000000000000000000000000Aaaa1" as Address,
    totalDeposited: 50000000000n,
    totalWithdrawn: 5000000000n,
    totalHarvestCount: 12,
    donationAddress: null,
    depositorCount: 8,
    paused: false,
    createdAt: 1700000000,
  },
  {
    id: "vault-dai",
    chainId: 42161,
    garden: MOCK_GARDEN_ADDRESS,
    asset: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address,
    vaultAddress: "0x00000000000000000000000000000000000Aaaa2" as Address,
    totalDeposited: 25000000000000000000000n,
    totalWithdrawn: 1000000000000000000000n,
    totalHarvestCount: 5,
    donationAddress: null,
    depositorCount: 3,
    paused: false,
    createdAt: 1700100000,
  },
];

const meta: Meta<typeof WithdrawModal> = {
  title: "Admin/Vault/WithdrawModal",
  component: WithdrawModal,
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the withdrawal modal is visible",
    },
    onClose: {
      description: "Callback when the modal requests to close",
    },
    gardenAddress: {
      control: "text",
      description: "The garden's on-chain address (used for withdrawal routing)",
    },
    vaults: {
      control: "object",
      description: "Array of GardenVault objects representing vaults with potential positions",
    },
    defaultAsset: {
      control: "text",
      description: "Pre-selected asset address (defaults to first vault's asset)",
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Modal for withdrawing shares from a garden vault. Displays the user's share balance, allows entering a shares amount, previews the estimated assets received, and submits the withdrawal. Requires wallet connection for deposit/share data.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WithdrawModal>;

/**
 * Default open state with USDC vault selected.
 * Share balance and estimated assets require a connected wallet.
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: MOCK_GARDEN_ADDRESS,
    vaults: mockVaults,
  },
};

/**
 * Single vault — no asset toggle shown.
 */
export const SingleVault: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: MOCK_GARDEN_ADDRESS,
    vaults: [mockVaults[0]],
  },
};

/**
 * Pre-selected DAI vault via defaultAsset prop.
 */
export const PreselectedAsset: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: MOCK_GARDEN_ADDRESS,
    vaults: mockVaults,
    defaultAsset: mockVaults[1].asset,
  },
};

/**
 * Closed state — verifies modal does not render.
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: fn(),
    gardenAddress: MOCK_GARDEN_ADDRESS,
    vaults: mockVaults,
  },
};

export const DarkMode: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    gardenAddress: MOCK_GARDEN_ADDRESS,
    vaults: mockVaults,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-[500px]">
        <Story />
      </div>
    ),
  ],
};

/**
 * Gallery showing multi-vault and single-vault scenarios.
 */
export const Gallery: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-sm text-text-sub">
        Withdraw modals render as Radix portals. Share balances and estimated assets require a
        connected wallet; they show 0.0 / "--" in Storybook.
      </p>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Multi-vault (USDC + DAI)</h3>
        <div className="rounded-lg border border-stroke-soft p-1 relative min-h-[450px]">
          <WithdrawModal
            isOpen={true}
            onClose={fn()}
            gardenAddress={MOCK_GARDEN_ADDRESS}
            vaults={mockVaults}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Single vault (USDC only)</h3>
        <div className="rounded-lg border border-stroke-soft p-1 relative min-h-[450px]">
          <WithdrawModal
            isOpen={true}
            onClose={fn()}
            gardenAddress={MOCK_GARDEN_ADDRESS}
            vaults={[mockVaults[0]]}
          />
        </div>
      </div>
    </div>
  ),
};
