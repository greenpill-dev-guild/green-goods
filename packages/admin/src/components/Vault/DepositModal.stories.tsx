import type { Address, GardenVault } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DepositModal } from "./DepositModal";

const MOCK_GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;

const mockVaults: GardenVault[] = [
  {
    id: "vault-usdc",
    chainId: 42161,
    garden: MOCK_GARDEN_ADDRESS,
    asset: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address, // USDC on Arbitrum
    vaultAddress: "0x00000000000000000000000000000000000Aaaa1" as Address,
    totalDeposited: 50000000000n, // 50,000 USDC (6 decimals)
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
    asset: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address, // DAI on Arbitrum
    vaultAddress: "0x00000000000000000000000000000000000Aaaa2" as Address,
    totalDeposited: 25000000000000000000000n, // 25,000 DAI (18 decimals)
    totalWithdrawn: 1000000000000000000000n,
    totalHarvestCount: 5,
    donationAddress: null,
    depositorCount: 3,
    paused: false,
    createdAt: 1700100000,
  },
];

const meta: Meta<typeof DepositModal> = {
  title: "Admin/Vault/DepositModal",
  component: DepositModal,
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the deposit modal is visible",
    },
    onClose: {
      description: "Callback when the modal requests to close",
    },
    gardenAddress: {
      control: "text",
      description: "The garden's on-chain address (used for deposit routing)",
    },
    vaults: {
      control: "object",
      description: "Array of GardenVault objects representing available deposit targets",
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
          "Modal for depositing ERC-20 tokens into a garden vault. Shows asset selection, amount input with max button, estimated shares preview, and gas estimation. Requires wallet connection (useUser) and wagmi hooks for balance/gas data.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DepositModal>;

/**
 * Default open state with USDC vault selected.
 * Note: Balance and gas estimation require a connected wallet,
 * so they will show "--" in Storybook.
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
 * Single vault — no asset selector toggle needed.
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
 * Pre-selected DAI vault via defaultAsset.
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
 * Closed state — verifies nothing renders when isOpen is false.
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
 * Gallery showing single-vault and multi-vault scenarios.
 */
export const Gallery: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-sm text-text-sub">
        Deposit modals render as Radix portals. Each variant is shown below. Balance and gas data
        require a connected wallet.
      </p>

      <div>
        <h3 className="text-sm font-medium text-text-sub mb-2">Multi-vault (USDC + DAI)</h3>
        <div className="rounded-lg border border-stroke-soft p-1 relative min-h-[450px]">
          <DepositModal
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
          <DepositModal
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
